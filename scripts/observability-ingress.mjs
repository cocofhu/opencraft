import { request as httpRequest } from 'node:http';
import { createHmac } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { socketRequest, nodeObserver } from '../packages/observability-contract/node.mjs';
import { sanitizeEvent } from '../packages/observability-contract/index.mjs';

function send(res,status,value){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));}
export async function createObservabilityIngress(path,{access,actors,executionHealth}={}) {
  if(!path)return null;
  const info=await stat(path);if(!info.isFile()||(info.mode&0o077)!==0||info.uid!==process.getuid())throw Error('Observation configuration must be private');
  const config=JSON.parse(await readFile(path,'utf8'));
  if(!config.socketPath?.startsWith('/')||!config.grafanaSocket?.startsWith('/')||!config.pseudonymKey?.match(/^[a-f0-9]{64}$/u))throw Error('Invalid observation configuration');
  const observer=nodeObserver('gateway',{socketPath:config.socketPath});
  const pseudonym=value=>createHmac('sha256',config.pseudonymKey).update(value).digest('hex');
  let closed=false,healthBusy=false;
  async function observeDependencies(){
    if(closed||healthBusy||!executionHealth)return;healthBusy=true;
    try{
      const health=await Promise.race([executionHealth(),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error()),5500);timer.unref();})]);
      for(const component of ['core','dsh']){
        const identity=health?.[component];if(!Number.isSafeInteger(identity?.pid)||identity.pid<1)continue;
        const version=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:+-]{1,128}$/u.test(value)?value:null;
        observer.emit({kind:'producer',component,producerId:pseudonym(JSON.stringify([component,identity.pid])),observedBy:'gateway',
          sourceRevision:version(identity.sourceRevision),buildId:version(identity.buildId),originClass:'operator'});
      }
    }catch{/* Independent dependency failure remains missing/stale in coverage. */}finally{healthBusy=false;}
  }
  void observeDependencies();const healthTimer=setInterval(()=>void observeDependencies(),30000);healthTimer.unref();
  const rates=new Map();let ingressActive=0;
  return {close:()=>{closed=true;clearInterval(healthTimer);observer.close();},async handle(req,res){
    const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/__opencraft_observe/'))return false;
    const principal=access?.authenticate(req),role=principal?access.role(principal):null;
    const full=role==='admin';
    if(url.pathname==='/__opencraft_observe/capabilities'&&req.method==='GET'){send(res,200,{available:full,telemetry:!!role,entry:full?'/__opencraft_observe/grafana/d/opencraft-overview':null});return true;}
    if(!principal||!role){send(res,principal?403:401,{error:{code:principal?'forbidden':'authentication_required'}});return true;}
    if(url.pathname==='/__opencraft_observe/events'&&req.method==='POST'){
      const rateKey=pseudonym(JSON.stringify([principal.provider,principal.subject]));
      const current=Date.now(),previous=rates.get(rateKey);
      const rate=!previous||current-previous.since>=10000?{since:current,count:0}:previous;
      if(rate.count>=2||ingressActive>=5){send(res,429,{error:{code:'telemetry_rate_limited'}});return true;}
      if(!rates.has(rateKey)&&rates.size>=1024)rates.delete(rates.keys().next().value);
      rate.count++;rates.set(rateKey,rate);
      const trusted=access.trustedOrigin(req);
      if(!trusted||req.headers.origin!==trusted||req.headers['sec-fetch-site']==='cross-site'){send(res,403,{error:{code:'origin_denied'}});return true;}
      let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>36864){send(res,413,{error:{code:'body_too_large'}});return true;}chunks.push(chunk);}
      let input;try{input=JSON.parse(Buffer.concat(chunks));}catch{send(res,400,{error:{code:'invalid_json'}});return true;}
      if(!Array.isArray(input.events)||input.events.length>32){send(res,400,{error:{code:'invalid_batch'}});return true;}
      const actor=actors?.findHuman(principal),verifiedActor=actor?pseudonym(actor.id):null;
      const events=input.events.map(raw=>{
        if(!['operation','rpc','recovery','client_signal','producer'].includes(raw?.kind))return null;
        const event=sanitizeEvent({...raw,component:'web',observedBy:'self',actorKind:actor?'human':'unknown',originClass:'interactive'});
        if(!event)return null;
        event.producerId=pseudonym(JSON.stringify([principal.provider,principal.subject,event.producerId]));
        event.eventId=pseudonym(JSON.stringify([event.producerId,event.eventId]));
        for(const key of ['operationId','executionId','recoveryId','requestId','incidentRef','pairId'])if(event[key])event[key]=pseudonym(JSON.stringify([event.producerId,event[key]]));
        return event;
      });
      ingressActive++;try{const result=await socketRequest(config.socketPath,'/events',{events,verifiedActor});send(res,200,result);}catch{send(res,503,{error:{code:'observation_unavailable',retryable:true}});}finally{ingressActive--;}return true;
    }
    if(!full){send(res,403,{error:{code:'observation_scope_denied'}});return true;}
    if(url.pathname.startsWith('/__opencraft_observe/api/')){
      const route=url.pathname.slice('/__opencraft_observe/api'.length);
      if(!['/capabilities','/query','/snapshot','/incident'].includes(route)){send(res,404,{error:{code:'missing'}});return true;}
      const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>65536){send(res,413,{error:{code:'body_too_large'}});return true;}chunks.push(chunk);}
      let body;try{body=chunks.length?JSON.parse(Buffer.concat(chunks)):undefined;}catch{send(res,400,{error:{code:'invalid_json'}});return true;}
      if(req.method!=='GET'&&(!access.trustedOrigin(req)||req.headers.origin!==access.trustedOrigin(req))){send(res,403,{error:{code:'origin_denied'}});return true;}
      try{send(res,200,await socketRequest(config.socketPath,route,body,req.method));}catch(error){send(res,error.status??503,{error:{code:error.code??'observation_unavailable',retryable:true}});}return true;
    }
    if(!url.pathname.startsWith('/__opencraft_observe/grafana/')){send(res,404,{error:{code:'missing'}});return true;}
    // The identity/membership authority has checked this exact request. No browser headers
    // or cookies reach Grafana. A previous Grafana cookie cannot extend host admission.
    const headers={'x-webauth-user':pseudonym(actors?.findHuman(principal)?.id??JSON.stringify([principal.provider,principal.subject])),
      'x-webauth-role':'Viewer',host:new URL(access.trustedOrigin(req)??'http://localhost').host,
      accept:req.headers.accept??'*/*','accept-encoding':req.headers['accept-encoding']??'identity',
      ...(req.headers['content-type']?{'content-type':req.headers['content-type']}:{}),
      ...(req.headers['content-length']?{'content-length':req.headers['content-length']}:{}),
      ...(req.headers.origin?{origin:req.headers.origin}:{})};
    if(!['GET','HEAD'].includes(req.method)&&(!access.trustedOrigin(req)||req.headers.origin!==access.trustedOrigin(req))){send(res,403,{error:{code:'origin_denied'}});return true;}
    await new Promise(resolve=>{
      const upstream=httpRequest({socketPath:config.grafanaSocket,path:req.url,method:req.method,headers},result=>{
        const output={...result.headers,'cache-control':'private, no-store'};delete output['set-cookie'];
        res.writeHead(result.statusCode,output);result.on('error',()=>res.destroy());result.pipe(res);result.on('end',resolve);
      });
      upstream.setTimeout(5000,()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)send(res,503,{error:{code:'dashboard_unavailable',retryable:true}});else res.destroy();resolve();});
      res.once('close',()=>{upstream.destroy();resolve();});req.pipe(upstream);
    });return true;
  }};
}
