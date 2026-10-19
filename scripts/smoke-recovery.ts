import assert from "node:assert/strict";
import { createServer } from "vite";
import { WebSocketServer } from "ws";
import { DshAppServerAdapter } from "../apps/local-agent-host/src/dsh-appserver-adapter";
import type { DshClient } from "../apps/local-agent-host/src/dsh-client";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import("playwright");
const events: any[] = [], calls: any[] = [], diagnostics: any[] = [];
const push=(type:string,data:any)=>events.push({event:{seq:events.length,time:1000,type,data}});
const addTurn=(turn:number)=>{
 push("turn/start",{turn});push("user/message",{source:{kind:"user"},content:[{type:"text",text:`Question ${turn}`} ]});
 push("assistant/message",{turn,message:{content:[{type:"text",text:`Answer ${turn}\n`+"Recovery content. ".repeat(150)}]}});
 push("turn/end",{turn,reason:{kind:"completed"}});
};
for(let i=0;i<10;i++)addTurn(i);
const adapter=new DshAppServerAdapter({call:async(method:string,payload:any)=>{
 assert.equal(method,"session.history");calls.push(payload);
 const rows=events.filter(e=>payload.beforeSeq===undefined||e.event.seq<payload.beforeSeq);
 return {events:rows.slice(-50),hasMore:rows.length>50};
}} as unknown as DshClient);
(adapter as any).summaries.set("s",{sessionId:"s",running:false,blank:false,cwd:"/",updatedAt:1});
adapter.setThreadEngine({describe:async()=>({historyHead:{nextSeq:events.length},selection:{provider:"p",model:"m"},permissions:{approval:"ask",sandbox:{mode:"workspace-write",workspaceRoot:"/"},preset:"custom"}}),
 resume:async()=>{throw Error("Unexpected activation");},create:async()=>{},fork:async()=>{},inject:async()=>{},release:async()=>{}});
const vite=await createServer({configFile:false,root:process.cwd(),logLevel:"error",resolve:{dedupe:["react","react-dom"]},
 cacheDir:"node_modules/.vite-recovery-smoke",optimizeDeps:{entries:["tests/fixtures/recovery-browser.tsx"]},server:{host:"127.0.0.1",port:0},plugins:[{name:"recovery-fixture",configureServer(server){
 server.middlewares.use(async(req,res,next)=>{
 if(req.url==="/__opencraft_apphost_diagnostic") {
  let body="";for await(const chunk of req)body+=chunk;
  diagnostics.push(JSON.parse(body));res.statusCode=202;res.end('{}');return;
 }
 if(req.url?.split("?")[0]!=="/")return next();res.setHeader("content-type","text/html");
 res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/tests/fixtures/recovery-browser.tsx"></script>');
 });
}}]});
let browser:any; const sockets=new WebSocketServer({noServer:true});
let dropNextResume = false, resumeRequests = 0;
let releaseResume: (() => void) | undefined, holdNextResume = false;
try {
 await vite.listen();vite.httpServer!.on("upgrade",(req,socket,head)=>{
 if(req.url==="/fixture-rpc")sockets.handleUpgrade(req,socket,head,ws=>sockets.emit("connection",ws,req));
 });
 sockets.on("connection",ws=>ws.on("message",async frame=>{
  const request=JSON.parse(frame.toString());if(request.id===undefined)return;
  if(request.method === "thread/resume") {
    resumeRequests++;
    if(holdNextResume){holdNextResume=false;await new Promise<void>(resolve=>{releaseResume=resolve;});}
    if(dropNextResume){dropNextResume=false;return;}
  }
  try { const result=request.method==="initialize"?{codexHome:"/tmp",platformFamily:"unix",platformOs:"linux",userAgent:"fixture",capabilities:{extensions:{"opencraft/resume-history":{version:1,mode:"paginated",initialTurnsPage:true,boundedRecovery:true}}}}:await adapter.dispatch(request.method,request.params);
   ws.send(JSON.stringify({id:request.id,result}));
  }catch(error){ws.send(JSON.stringify({id:request.id,error:{code:-32000,message:String(error)}}));}
 }));
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const output=process.env.OPENCRAFT_RECOVERY_EVIDENCE??"/run/opencraft-recovery-policy-20261017/browser";await mkdir(output,{recursive:true});
 const results=[];
 for(const {width,theme} of [390,1100].flatMap(width=>["light","dark"].map(theme=>({width,theme})))) {
  events.length=0;for(let i=0;i<10;i++)addTurn(i);
  const page=await browser.newPage({viewport:{width,height:850},hasTouch:width===390,isMobile:width===390});
  const errors:string[]=[];page.on("pageerror",(e:Error)=>errors.push(e.message));await page.addInitScript("window.__name=value=>value");
  await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as any).port}/?theme=${theme}`);
  await page.waitForSelector('[data-authoritative="true"]');
  await page.getByText('Question 9',{exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Unsent draft'}).fill('Preserve my unsent words');
  await page.evaluate(()=>{(window as any).originalRow=document.querySelector('[data-turn-key="dsh-turn-s-9"]');});
  await page.evaluate(()=>{(window as any).recovery.trace.length=0;});
  const before=calls.length;
  for(const socket of sockets.clients)socket.close(1012,"synthetic reconnect");
  await page.waitForFunction(()=> (window as any).recovery.trace.some((e:any)=>e.stage==='settled'));
  await page.waitForSelector('[data-authoritative="true"]');
  assert.equal(await page.getByRole('textbox',{name:'Unsent draft'}).inputValue(),'Preserve my unsent words');
  assert.equal(await page.evaluate(()=>document.querySelector('[data-turn-key="dsh-turn-s-9"]')===(window as any).originalRow),true);
  assert.equal(calls.length,before,'unchanged native head eliminates history reads and retains navigation index');
  await page.screenshot({path:`${output}/unchanged-${width}-${theme}.png`});
  const trace=await page.evaluate(()=>(window as any).recovery.trace);
  assert.equal(new Set(trace.map((e:any)=>e.recoveryId)).size,1);
  assert.ok(trace.find((e:any)=>e.stage==='settled'&&e.requests>=2&&e.responseBytes>0));
  const unchangedReads=calls.length-before;
  // Hold the real RPC boundary to inspect in-progress UI before a failure.
  holdNextResume=true;
  await page.evaluate(()=>{void (window as any).recovery.revalidate();});
  await page.getByText('Restoring conversation history',{exact:true}).waitFor();
  const notice=page.locator('.conversation-recovery-notice');
  await notice.locator('summary').click();
  await page.waitForFunction(()=>document.querySelector('.conversation-recovery-details pre')?.textContent?.includes('attemptsStarted: 1'));
  await page.waitForFunction(()=>/elapsedMs: [1-9]\d{3,}/.test(document.querySelector(".conversation-recovery-details pre")?.textContent??""));
  const pendingBefore=resumeRequests;
  await notice.getByRole('button',{name:'Copy details'}).click();
  assert.equal(resumeRequests,pendingBefore,'opening/copying diagnostics never starts a read');
  assert.ok(await notice.locator('details').evaluate((node:any)=>node.open));
  assert.equal(await page.evaluate(()=>document.querySelector('[data-turn-key="dsh-turn-s-9"]')===(window as any).originalRow),true);
  const bounds=await notice.boundingBox();assert.ok(bounds && bounds.x>=0 && bounds.x+bounds.width<=width);
  await page.screenshot({path:`${output}/progress-${width}-${theme}.png`});
  releaseResume!();releaseResume=undefined;
  await page.waitForSelector('[data-authoritative="true"]');
  assert.equal(await notice.count(),0,'authoritative recovery removes progress');
  const resumedBefore = resumeRequests;
  const timeoutStart = Date.now();
  dropNextResume = true;
  const observedRetry=page.getByText('Last failure: TIMEOUT',{exact:true}).waitFor();
  await page.evaluate(()=>{void (window as any).recovery.revalidate();});
  try { await observedRetry; } catch(error) { console.error(JSON.stringify(await page.evaluate(()=>(window as any).recovery.progressTrace))); throw error; }
  await page.waitForSelector('[data-authoritative="true"]');
  const timeoutRecoveryMs = Date.now()-timeoutStart;
  assert.equal(resumeRequests-resumedBefore,2,'one timed-out history request retries without a page reload');
  assert.equal(await page.evaluate(()=>(window as any).recovery.runtime().phase),'ready');
  assert.equal(await page.evaluate(()=>(window as any).recovery.snapshot().authoritative),true);
  assert.equal(await page.evaluate(()=>document.querySelector('[data-turn-key="dsh-turn-s-9"]')===(window as any).originalRow),true);
  assert.equal(await page.getByRole('textbox',{name:'Unsent draft'}).inputValue(),'Preserve my unsent words');
  for(let turn=10;turn<110;turn++)addTurn(turn);
  const gapStart=calls.length;
  await page.evaluate(()=>(window as any).recovery.revalidate());
  await page.waitForSelector('[data-turn-key="dsh-turn-s-109"]');
  assert.equal(calls.length,gapStart+2,'large gap probes once then replaces with latest tail; unused navigation stays lazy');
  await page.evaluate(()=>(window as any).recovery.navigation.prepare());
  assert.equal(await page.evaluate(()=>(window as any).recovery.navigation.getSnapshot().anchors.length),110,'navigation discovers the new gap only when requested');
  assert.equal(await page.locator('[data-turn-key="dsh-turn-s-9"]').count(),0,'old disjoint range does not masquerade as continuous history');
  assert.equal(await page.getByRole('textbox',{name:'Unsent draft'}).inputValue(),'Preserve my unsent words');
  await page.evaluate(()=>(window as any).recovery.loadOlder());
  await page.screenshot({path:`${output}/gap-${width}-${theme}.png`});
  assert.deepEqual(errors,[]);results.push({width,theme,unchangedReads,gapReads:2,timeoutRecoveryMs,timeoutReads:2,retainedDOM:true,draftPreserved:true,trace});
  await page.close();
 }
 await writeFile(`${output}/results.json`,JSON.stringify({results,diagnostics},null,2));console.log(JSON.stringify(results));
} finally { await browser?.close(); for(const socket of sockets.clients)socket.terminate();await new Promise<void>(r=>sockets.close(()=>r()));await vite.close();adapter.close(); }
