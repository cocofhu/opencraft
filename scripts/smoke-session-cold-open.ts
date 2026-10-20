import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium,type Page} from 'playwright';
import {AppHostServer} from '../packages/app-host-server/src/index';
import {createWorkbenchWebServer} from './serve-workbench-web.mjs';

// Use the built Application: a Conversation-only fixture misses a parent
// hiding valid display data until it has acquired a network-backed lease.
const root=resolve(process.env.OPENCRAFT_COLD_OPEN_WEB_ROOT??'apps/workbench-web/dist');
const output=resolve(process.env.OPENCRAFT_COLD_OPEN_EVIDENCE??'.local/session-cold-open');
assert.equal(JSON.parse(await readFile(join(root,'version.json'),'utf8')).headlessServer,true,'Build the Headless Web profile');
await mkdir(output,{recursive:true});
const threadId='cold-open-fixture',question='Previously seen question',cachedAnswer='Previously seen answer',restoredAnswer='Fresh authoritative answer';
const thread={id:threadId,name:'Cold open fixture',preview:question,cwd:'/fixture',path:null,historyMode:'paginated',modelProvider:'openai',createdAt:1,updatedAt:1,status:{type:'idle'},source:'appServer',turns:[]};
let hold=false,fresh=false,active=false,previewStage=false,longActive=false;
const previewAnswer='Fresh preview answer';
const heldResume:Array<()=>void>=[];
const releaseResume=()=>{for(const deliver of heldResume.splice(0))deliver()};
const held:Array<()=>void>=[],requests:string[]=[],mutations:string[]=[];
const release=()=>{hold=false;for(const deliver of held.splice(0))deliver()};
const appHost=new AppHostServer({logicalClientRouting:true,createTransport(){
 let status:any={state:'idle'};
 const messages=new Set<(frame:string)=>void>(),statuses=new Set<(value:any)=>void>();
 return {get status(){return status},async connect(){status={state:'open'};for(const listener of statuses)listener(status)},
  subscribeMessage(listener){messages.add(listener);return()=>{messages.delete(listener)}},subscribeStatus(listener){statuses.add(listener);return()=>{statuses.delete(listener)}},
  async send(frame){
   const rpc=JSON.parse(frame);if(rpc.id===undefined)return;requests.push(rpc.method);
   let result:unknown,error:unknown;
   const turn={id:'fixture-turn',historyWindowId:'fixture-window',status:active?'inProgress':'completed',error:null,itemsView:'full',startedAtMs:1700000000000,firstTurnWorkItemStartedAtMs:1700000000000,finalAssistantStartedAtMs:active?null:1700000054000,durationMs:active?null:54000,items:[
    {type:'userMessage',id:'fixture-question',sentAtMs:1700000000000,content:[{type:'text',text:question,textElements:[]}]},
    {type:'reasoning',id:'fixture-reasoning',summary:['Checking the answer'],content:[],startedAtMs:1700000000000},
    {type:'agentMessage',id:'fixture-answer',startedAtMs:1700000054000,text:fresh?restoredAnswer:cachedAnswer,phase:'final_answer'}]};
   if (active && longActive) turn.items.splice(1, 0, ...Array.from({ length: 68 }, (_, i) => ({
    type: 'reasoning', id: `long-reasoning-${i}`, summary: [`Long active reasoning ${i}`], content: [], startedAtMs: 1700000000000 + i,
   })));
   switch(rpc.method){
    case 'initialize':result={userAgent:'cold-open-fixture',codexHome:'/fixture',platformFamily:'unix',platformOs:'linux',capabilities:{extensions:{'opencraft/resume-history':{version:1,mode:previewStage?'message-window':'paginated',initialTurnsPage:true}}}};break;
    case 'thread/list':result={data:[{...thread,historyMode:previewStage?'message-window':'paginated'}],nextCursor:null};break;
    case 'thread/read':result={thread:{...thread,historyMode:previewStage?'message-window':'paginated'}};break;
    case 'thread/resume':result={thread:{...thread,historyMode:previewStage?'message-window':'paginated'},model:'fixture-model',modelProvider:'openai',cwd:'/fixture',runtimeWorkspaceRoots:['/fixture'],approvalPolicy:'on-request',approvalsReviewer:'user',sandbox:{type:'readOnly'},initialTurnsPage:{data:[turn],nextCursor:null}};break;
    case 'thread/turns/list':result={data:[turn],nextCursor:null};break;
    case 'thread/items/list':result={data:turn.items.map(item=>({turnId:turn.id,item})),nextCursor:null};break;
    case 'thread/loaded/list':result={data:[threadId]};break;
    case 'model/list':case 'permissionProfile/list':case 'thread/queue/list':result={data:[],nextCursor:null};break;
    case 'config/read':result={config:{},origins:{}};break;
    case 'skills/list':result={data:[]};break;
    default:
     if(/^(?:turn\/|thread\/(?:start|fork)|.*\/(?:set|write|create|delete)$)/.test(rpc.method))mutations.push(rpc.method);
     error={code:-32601,message:'Read-only fixture operation unavailable'};
   }
   const reply=JSON.stringify({id:rpc.id,...(error?{error}:{result}),__opencraftClient:rpc.__opencraftClient});
   const deliver=()=>{for(const listener of messages)listener(reply)};
   if(previewStage&&rpc.method==='thread/resume') {
    assert.equal(typeof rpc.params.historyPreviewToken,'string','Preview has a request-scoped owner');
    const {startedAtMs,firstTurnWorkItemStartedAtMs,finalAssistantStartedAtMs,durationMs,...partial}=turn;
    const preview={...partial,items:turn.items.map(item=>{
      const {startedAtMs,sentAtMs,...message}=item as any;
      return message.type==='agentMessage'?{...message,text:previewAnswer}:message;
    })};
    await new Promise(resolve=>setTimeout(resolve,40));
    for(const listener of messages) listener(JSON.stringify({method:'thread/history/preview',params:{threadId,token:rpc.params.historyPreviewToken,turns:[preview]},__opencraftClient:rpc.__opencraftClient}));
    heldResume.push(deliver); return;
   }
   if(hold&&rpc.method==='initialize')held.push(deliver);else deliver();
  },async close(){status={state:'closed'};for(const listener of statuses)listener(status)}};
}});
const web=await createWorkbenchWebServer({root,appHostServer:appHost,appServerTarget:null,loopbackOnly:true});
const address=await web.listen({host:'127.0.0.1',port:0});
const url=`http://127.0.0.1:${address.port}/local/${threadId}?hostId=local-codex`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results=[];
async function assertDatesVisible(page: Page) {
  // DOM presence does not catch a timestamp inside transparent hover controls.
  await page.mouse.move(0, 0);
  for (const selector of ['.thread-user-message time', '[data-assistant-message-sent-time]']) {
    const date = page.locator(selector).first();
    await date.waitFor();
    assert.equal(await date.evaluate(element => {
      let opacity = 1;
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        opacity *= Number(style.opacity);
      }
      const rect = element.getBoundingClientRect();
      return opacity > 0.99 && rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight;
    }), true, `${selector} must be visibly painted without hover`);
  }
  assert.equal(await page.locator('[data-assistant-message-sent-time]').first().getAttribute('datetime'), '2023-11-14T22:14:14.000Z');
}
try{for(const width of [390,1100]){
 releaseResume();previewStage=false;release();fresh=false;
 const context=await browser.newContext({viewport:{width,height:850}}),page=await context.newPage(),errors:string[]=[];
 await page.addInitScript('window.__name = value => value');
 await page.addInitScript(() => {
  requestAnimationFrame(function capture() {
   if (!document.querySelector('.thread-frame')) { requestAnimationFrame(capture); return; }
   (window as any).firstTimingPaint = {
    user: document.querySelectorAll('.thread-user-message time').length,
    assistant: document.querySelectorAll('[data-assistant-message-sent-time]').length,
    work: document.querySelector('[data-work-status]')?.textContent ?? '',
   };
  });
 });
 page.on('pageerror',error=>errors.push(error.message));await page.goto(url);
 await page.getByText(cachedAnswer,{exact:true}).waitFor();
 await page.waitForFunction(()=>Object.keys(localStorage).some(key=>key.startsWith('opencraft.display.')&&localStorage.getItem(key)?.includes('Previously seen answer')));
 assert.equal(await page.locator('.thread-user-message time').getAttribute('datetime'),'2023-11-14T22:13:20.000Z');
 await page.locator('[data-work-status]').filter({hasText:'54'}).waitFor();
 hold=true;fresh=true;previewStage=true;const requestStart=requests.length;await page.reload();await page.locator('.local-conversation-page').waitFor();
 await page.getByText(cachedAnswer,{exact:true}).waitFor({timeout:3000});
 const first = await page.evaluate(() => (window as any).firstTimingPaint);
 assert.equal(first.user,1,'User date exists at the first text paint');
 assert.equal(first.assistant,1,'Assistant date exists at the first text paint');
 assert.match(first.work,/54/,'Completed clock exists at the first text paint');
 assert.equal(await page.locator('.thread-user-message time').getAttribute('datetime'),'2023-11-14T22:13:20.000Z','Date paints before initialization completes');
 assert.match(await page.locator('[data-work-status]').innerText(),/54/,'Completed clock paints with cached text');
 await assertDatesVisible(page);
 assert.equal(await page.locator('.thread-agent-activity button').count(),0,'Cached work has no tool actions');
 assert.ok(held.length>0,'Cached history paints while connection initialization remains held');
 assert.equal(requests.slice(requestStart).includes('thread/resume'),false,'Cached paint cannot resume or authorize execution');
 assert.equal(await page.locator('.conversation-recovery-cold-stage').count(),0);
 const editor=page.locator('[contenteditable="true"]').first();
 await editor.fill('Keep this unsent draft');
 await page.screenshot({path:join(output,`cached-before-connect-${width}.png`)});
 release();await page.getByText(previewAnswer,{exact:true}).waitFor();
 assert.ok(heldResume.length>0);await assertDatesVisible(page);
 assert.match(await page.locator('[data-work-status]').innerText(),/54/);
 await page.screenshot({path:join(output,`preview-before-resume-${width}.png`)});
 releaseResume();previewStage=false;await page.getByText(restoredAnswer,{exact:true}).waitFor();
 assert.equal(await editor.innerText(),'Keep this unsent draft','Canonical restoration preserves the unsent draft');
 assert.equal(await page.getByText(cachedAnswer,{exact:true}).count(),0,'Canonical history replaces old display');assert.deepEqual(errors,[]);await context.close();
 // A streaming Turn also paints its received input/progress/answer on reload.
 release();active=true;fresh=false;
 const running=await browser.newContext({viewport:{width,height:850},hasTouch:width===390}),live=await running.newPage(),liveErrors:string[]=[];
 live.on('pageerror',error=>liveErrors.push(error.message));await live.goto(url);
 await live.getByText(cachedAnswer,{exact:true}).waitFor();
 await live.waitForFunction(()=>Object.keys(localStorage).some(key=>{
  if(!key.startsWith('opencraft.display.'))return false;
  const saved=JSON.parse(localStorage.getItem(key)!);
  return saved.messages?.some((message:any)=>message.kind==='reasoning')&&saved.messages?.some((message:any)=>message.text==='Previously seen answer'&&message.completed===false);
 }));
 hold=true;active=false;fresh=true;const activeRequestStart=requests.length;await live.reload();
 await live.getByText(cachedAnswer,{exact:true}).waitFor({timeout:3000});
 await live.getByText(question,{exact:true}).waitFor();
 const progressToggle=live.locator('.thread-agent-activity__turn-toggle button').first();
 await progressToggle.focus();await progressToggle.press('Enter');
 await live.getByText('Checking the answer',{exact:true}).first().waitFor();
 assert.ok(held.length>0);
 assert.equal(requests.slice(activeRequestStart).includes('thread/resume'),false);
 assert.equal(await live.locator('[data-work-status="working"]').count(),0);
 assert.match(await live.locator('[data-work-status="worked"]').innerText(),/54/,'Ended work paints with the cached partial reply');
 await assertDatesVisible(live);
 const activeEditor=live.locator('[contenteditable="true"]').first();await activeEditor.fill('Draft while reconnecting');
 await live.screenshot({path:join(output,`active-before-connect-${width}.png`)});
 release();await live.getByText(restoredAnswer,{exact:true}).waitFor();
 assert.equal(await live.getByText(cachedAnswer,{exact:true}).count(),0);
 assert.equal(await activeEditor.innerText(),'Draft while reconnecting');
 assert.deepEqual(liveErrors,[]);await running.close();
 // More than 24 activity blocks must not evict the dated user question.
 release();active=true;fresh=false;longActive=true;
 const longContext=await browser.newContext({viewport:{width,height:850},hasTouch:width===390,isMobile:width===390});
 const longPage=await longContext.newPage(),longErrors:string[]=[];
 longPage.on('pageerror',error=>longErrors.push(error.message));await longPage.goto(url);
 await longPage.getByText(cachedAnswer,{exact:true}).waitFor();
 await longPage.waitForFunction(()=>Object.keys(localStorage).some(key=>{
  if(!key.startsWith('opencraft.display.'))return false;
  const value=JSON.parse(localStorage.getItem(key)!);
  return value.messages?.some((message:any)=>message.id==='user-message:fixture-question')
   && value.messages?.some((message:any)=>message.id==='reasoning:long-reasoning-67');
 }));
 hold=true;await longPage.reload();await longPage.getByText(question,{exact:true}).waitFor({timeout:3000});
 await longPage.getByText(cachedAnswer,{exact:true}).waitFor();
 assert.ok(held.length>0);await assertDatesVisible(longPage);
 assert.equal(await longPage.locator('[data-work-status="working"]').count(),0,'Long activity cannot resume a live clock');
 assert.match(await longPage.locator('[data-work-status="worked"]').innerText(),/54/,'Observed ended work stays static while the reply arrives');
 assert.deepEqual(longErrors,[]);await longContext.close();release();active=false;fresh=true;longActive=false;
 // A separate browser profile cannot see the first profile's local display.
 hold=true;const cold=await browser.newContext({viewport:{width,height:850}}),empty=await cold.newPage();
 await empty.goto(url);await empty.locator('.local-conversation-page').waitFor();
 assert.equal(await empty.getByText(cachedAnswer,{exact:true}).count(),0);assert.equal(await empty.getByText(restoredAnswer,{exact:true}).count(),0);
 assert.equal(await empty.locator('.conversation-recovery-cold-stage').count(),1);
 release();await empty.getByText(restoredAnswer,{exact:true}).waitFor();await cold.close();
 results.push({width,cacheBeforeConnection:true,baselineStillRequired:true,canonicalReplacement:true,draftPreserved:true,isolatedProfile:true,activeTurnBeforeConnection:true,previewTimingContinuous:true});
 }
 assert.deepEqual(mutations,[]);
 await writeFile(join(output,'receipt.json'),JSON.stringify({results,mutations,boundary:'Built Workbench Application; isolated protocol and identity. Held initialization tests behavior, not real-network speed.'},null,2));
 console.log(JSON.stringify({success:true,results}));
}finally{releaseResume();release();await browser.close();await web.close();await appHost.close()}
