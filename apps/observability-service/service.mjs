import { createServer, request as httpRequest } from 'node:http';
import { mkdir, chmod, lstat, unlink, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ObserveStore } from './store.ts';
import { createEventQueue } from '../../packages/observability-contract/queue.mjs';
import { limits, schemaVersion, fault, windowFor } from '../../packages/observability-contract/index.mjs';
import { definitions, queryDefinitionRevision, requireQuery, compare, issues } from '../../packages/observability-query/index.mjs';

export async function readJson(request, max = limits.batchBytes + 4096) {
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size > max) throw fault('body_too_large',413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fault('invalid_json'); }
}
export function json(response, status, body) {
  const encoded = JSON.stringify(body);
  if (Buffer.byteLength(encoded) > limits.responseBytes) return json(response,413,{error:{code:'result_too_large'}});
  response.writeHead(status,{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}); response.end(encoded);
}

export async function startObserve({ directory, deploymentId, prometheus = 'http://127.0.0.1:23302', metricsHost = '127.0.0.1', metricsPort = 23305,
  collector = 'http://127.0.0.1:23304/v1/logs', sourceRevision = process.env.OPENCRAFT_OBSERVE_SOURCE_REVISION??null, buildId = process.env.OPENCRAFT_OBSERVE_BUILD_ID??null, now = Date.now } = {}) {
  if (!directory?.startsWith('/') || !/^[a-zA-Z0-9_.-]{1,80}$/u.test(deploymentId??'')) throw fault('invalid_configuration');
  for (const address of [prometheus,collector]) {const url=new URL(address);if(url.hostname!=='127.0.0.1'||url.protocol!=='http:'||url.username||url.password)throw fault('invalid_backend');}
  await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);
  const store = new ObserveStore(resolve(directory,'observe.sqlite'),now);
  const producerId = randomUUID();
  const essential=['web','gateway','core'];
  let active = 0, exportDropped=0, exporting=false;
  const exportQueue=createEventQueue();
  async function exportLogs() {
    if(exporting)return;const events=exportQueue.take();if(!events.length)return;exporting=true;
    try{const response=await fetch(collector,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({resourceLogs:[{resource:{attributes:[{key:'service.name',value:{stringValue:'opencraft'}}]},scopeLogs:[{scope:{name:'opencraft.observe'},logRecords:events.map(event=>({timeUnixNano:String(Math.floor(event.at*1e6)),body:{stringValue:JSON.stringify(event)}}))}]}]}),signal:AbortSignal.timeout(4000)});if(!response.ok)exportDropped+=events.length;}
    catch{exportDropped+=events.length;}finally{exporting=false;}
  }
  const exportTimer=setInterval(()=>void exportLogs(),1000);exportTimer.unref();
  let backendHealth={prometheus:'unknown',loki:'unknown',collector:'unknown',grafana:'unknown'};
  async function checkBackends() {
    const base=new URL(collector),health=new URL(collector);health.port=String(Number(base.port)+4);health.pathname='/';
    const jobs=[['prometheus',new URL('/-/ready',prometheus).href],['loki',new URL('/ready',`http://127.0.0.1:${Number(base.port)-1}`).href],['collector',health.href]];
    await Promise.all(jobs.map(async([name,url])=>{try{backendHealth[name]=(await fetch(url,{signal:AbortSignal.timeout(3500)})).ok?'available':'unavailable';}catch{backendHealth[name]='unavailable';}}));
    backendHealth.grafana=await new Promise(resolve=>{const req=httpRequest({socketPath:resolveGrafanaSocket(),path:'/__opencraft_observe/grafana/api/health'},res=>{res.resume();resolve(res.statusCode===200?'available':'unavailable');});req.setTimeout(3500,()=>req.destroy());req.on('error',()=>resolve('unavailable'));req.end();});
  }
  const resolveGrafanaSocket=()=>resolve(directory,'../grafana/grafana.sock');
  function coverage() {
    const all = store.producers();
    const producers=essential.map(component=>{const rows=all.filter(p=>p.component===component);const latest=rows.sort((a,b)=>b.received-a.received)[0];
      return {component,availability:!latest?'missing':now()-latest.received>limits.freshnessMs?'stale':'available',dataThrough:latest?new Date(latest.received).toISOString():null};});
    return {status:producers.every(p=>p.availability==='available')&&Object.values(backendHealth).every(v=>v==='available')?'ok':'unknown',coverage:producers.every(p=>p.availability==='available')&&Object.values(backendHealth).every(v=>v==='available')?'complete':'partial',producers,backends:{...backendHealth}};
  }
  function envelope(window) { return {schemaVersion,snapshotId:randomUUID(),deploymentId,queryDefinitionRevision,metricSchemaVersion:schemaVersion,
    window:{from:new Date(window.from).toISOString(),to:new Date(window.to).toISOString(),capturedAt:new Date(now()).toISOString(),dataThrough:new Date(now()).toISOString()},
    ...coverage(),components:store.producers().map(p=>({component:p.component,producerId:p.producer,sourceRevision:p.identity.sourceRevision??null,buildId:p.identity.buildId??null,observedAt:new Date(p.received).toISOString()})),
    sampling:{operation:1,diagnostic:1},loss:{accepted:store.accepted,rejected:store.rejected,dropped:store.dropped,exportDropped,unobservableLoss:'unknown'},
    correlationGaps:[],evidenceExpiresAt:new Date(window.from+limits.retentionMs).toISOString() }; }
  async function query(name,input={}) {
    const definition=requireQuery(name), window=windowFor(input,now(),name==='usage.activity'?limits.retentionMs:limits.maxWindowMs);
    const result={...envelope(window),query:name,measurementKind:definition.kind,unit:definition.unit,windowSemantics:definition.windowSemantics??'selected_window'};
    if(name==='components.versions')return result;
    if(name==='data.coverage'||name==='platform.status')return result;
    if(definition.promql) {
      const url=new URL('/api/v1/query',prometheus);url.searchParams.set('query',definition.promql);url.searchParams.set('time',String(window.to/1000));
      try {const response=await fetch(url,{signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error();const value=await response.json();
        if(value.status!=='success')throw Error();return {...result,evaluationAt:new Date(window.to).toISOString(),stepSeconds:15,expression:definition.promql,values:value.data.result};
      }catch{return {...result,status:'degraded',coverage:'partial',availability:'backend_unreachable',values:[]};}
    }
    return result;
  }
  async function snapshot(input={}) {
    const window=windowFor(input,now()); const result=envelope(window);
    const rows=store.events(window.from,window.to,now());
    result.truncated=rows.length>limits.rows; result.events=rows.slice(0,limits.rows);
    result.captureStatus=result.events.length?'captured':'no_capture';
    if(result.truncated){result.coverage='partial';result.captureStatus='partial';}
    result.observedDomainsAtCapture={executions:store.executions(window.from,window.to),verifiedHumanUnion:store.activity(window.from,window.to).humans};
    result.measurements={};
    const names=Object.keys(definitions).filter(name=>!['incident.read','baseline.compare'].includes(name));
    for(const name of names) result.measurements[name]=await query(name,{from:result.window.from,to:result.window.to});
    result.findings=issues(result);return result;
  }
  function metrics() {
    const nowMs=now(), lines=['# TYPE opencraft_telemetry_losses_total counter',`opencraft_telemetry_losses_total ${store.dropped+store.rejected+exportDropped}`];
    for(const component of ['web','gateway','core','codex','dsh','pi','observe']) {
      const p=store.producers().filter(p=>p.component===component).sort((a,b)=>b.received-a.received)[0];
      if(p){lines.push(`opencraft_producer_age_seconds{component="${component}"} ${Math.max(0,nowMs-p.received)/1000}`,
        `opencraft_component_identity_known{component="${component}"} ${p.identity.sourceRevision?1:0}`);
        if(p.identity.rssBytes!==undefined)lines.push(`opencraft_process_rss_bytes{component="${component}"} ${p.identity.rssBytes}`);}
    }
    lines.push(`opencraft_active_humans_7d ${store.activity(nowMs-limits.retentionMs,nowMs).humans}`);
    for(const row of store.executions(nowMs-86400000,nowMs))lines.push(`opencraft_executions{outcome="${row.outcome}"} ${row.count}`);
    const recoveries=store.db.prepare("SELECT count(DISTINCT json_extract(body,'$.recoveryId')) AS value FROM events WHERE kind='recovery' AND at>=?").get(nowMs-86400000);
    lines.push(`opencraft_recovery_episodes ${recoveries.value}`);
    // Finite dimensions only. Counts persist across service restarts in the derived store.
    for(const row of store.db.prepare('SELECT name,dimension,value FROM metrics').all()) {
      if(row.name==='operation_bucket'){const [operation,le]=JSON.parse(row.dimension);lines.push(`opencraft_operation_duration_seconds_bucket{operation="${operation}",le="${le}"} ${row.value}`);}
      if(row.name==='operation_count'||row.name==='operation_sum')lines.push(`opencraft_operation_duration_seconds_${row.name==='operation_count'?'count':'sum'}{operation="${row.dimension}"} ${row.value}`);
      if(row.name==='rpc'){const [method,outcome]=JSON.parse(row.dimension);lines.push(`opencraft_rpc_total{method="${method}",outcome="${outcome}"} ${row.value}`);}
    }
    return lines.join('\n')+'\n';
  }
  const api=createServer(async(req,res)=>{
    if(active>=limits.concurrency){json(res,429,{error:{code:'query_limit'}});return;}active++;
    try {
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/capabilities'){json(res,200,{schemaVersion,deploymentId,queryDefinitionRevision,limits,permissions:['deployment.observe.read'],queries:definitions,adapters:coverage().producers});return;}
      if(req.method==='POST'&&url.pathname==='/events'){
        const input=await readJson(req);if(!Array.isArray(input.events)||input.events.length>32)throw fault('invalid_batch');
        const receipt=store.ingest(input.events,typeof input.verifiedActor==='string'&&/^[a-f0-9]{64}$/u.test(input.verifiedActor)?input.verifiedActor:null);
        json(res,200,receipt);
        for(const raw of input.events) {const safe=sanitizeForExport(raw);if(safe&&!exportQueue.emit(safe))exportDropped++;}
        return;
      }
      if(req.method!=='POST')throw fault('method_not_allowed',405);
      const input=await readJson(req,65536);
      if(Object.keys(input).some(k=>!['name','from','to','ref'].includes(k)))throw fault('unknown_argument');
      if(url.pathname==='/query'){json(res,200,await query(input.name,input));return;}
      if(url.pathname==='/snapshot'){json(res,200,await snapshot(input));return;}
      if(url.pathname==='/incident'){
        if(typeof input.ref!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/u.test(input.ref))throw fault('invalid_reference');
        const row=store.db.prepare("SELECT at FROM events WHERE json_extract(body,'$.incidentRef')=? ORDER BY at LIMIT 1").get(input.ref);
        if(!row){json(res,200,{schemaVersion,captureStatus:'no_capture',ref:input.ref,events:[]});return;}
        const window={from:new Date(Number(row.at)-300000).toISOString(),to:new Date(Math.min(now(),Number(row.at)+300000)).toISOString()};
        const result=await snapshot(window);result.events=result.events.filter(e=>e.incidentRef===input.ref);json(res,200,result);return;
      }
      throw fault('missing',404);
    }catch(error){json(res,error.status??503,{error:{code:error.code??'storage_unavailable'}});}finally{active--;}
  });
  const socketPath=resolve(directory,'observe.sock');
  try{const info=await lstat(socketPath);if(!info.isSocket())throw fault('socket_path_exists');await unlink(socketPath);}catch(error){if(error.code!=='ENOENT')throw error;}
  await new Promise((yes,no)=>{api.once('error',no);api.listen(socketPath,yes);});await chmod(socketPath,0o600);
  const exporter=createServer((req,res)=>{if(req.method!=='GET'||!['/metrics','/health'].includes(req.url)){json(res,404,{error:{code:'missing'}});return;}if(req.url==='/health'){json(res,200,{ok:true,...coverage(),sourceRevision,buildId});return;}try{res.writeHead(200,{'content-type':'text/plain; version=0.0.4'});res.end(metrics());}catch{json(res,503,{error:{code:'storage_unavailable'}});}});
  await new Promise((yes,no)=>{exporter.once('error',no);exporter.listen(metricsPort,metricsHost,yes);});
  function heartbeat(){store.ingest([{schemaVersion,kind:'resource',component:'observe',producerId,eventId:randomUUID(),at:now(),rssBytes:process.memoryUsage().rss,cpuSeconds:(process.cpuUsage().user+process.cpuUsage().system)/1e6,sourceRevision,buildId,originClass:'operator'}]);}
  heartbeat();void checkBackends();const timer=setInterval(()=>{void checkBackends();try{heartbeat();store.prune();}catch{store.dropped++;}},30000);timer.unref();
  return {socketPath,store,query,snapshot,close:async()=>{clearInterval(timer);clearInterval(exportTimer);await Promise.all([new Promise(r=>api.close(r)),new Promise(r=>exporter.close(r))]);store.close();await unlink(socketPath).catch(()=>{});}};
}
import { sanitizeEvent as sanitizeForExport } from '../../packages/observability-contract/index.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const config=JSON.parse(await readFile(process.env.OPENCRAFT_OBSERVE_CONFIG,'utf8'));
  const service=await startObserve(config);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void service.close().then(()=>process.exit(0)));
}
