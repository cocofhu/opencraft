import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const playwright = await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE ?? 'playwright');
const {chromium} = playwright.default ?? playwright;
const source=`import React from 'react';
import {createIntlTestRoot} from '/tests/fixtures/intl-root.tsx';
import {createComposerController} from '@opencraft/composer-core';
import {OpenCraftComposer} from '@opencraft/composer-editor';
import {useTimelineViewportHost} from '/apps/workbench-web/src/timeline-viewport.ts';
import '/apps/workbench-web/src/styles/app.scss';
const controller=createComposerController({type:'existing-thread',key:{hostId:'fixture',threadId:'one'}},{now:Date.now,createId:()=>crypto.randomUUID()});
window.fixture={controller,sent:0};
const queued=Array.from({length:6},(_,i)=>({id:'q'+i,preview:'Queued message '+i,state:'queued',operation:'idle',actionable:true,editableContent:{document:controller.getSnapshot().draft.document,attachments:[],context:[]}}));
function App(){useTimelineViewportHost({kind:'browser',platform:'linux',safeArea:{left:0,right:0}});return <div className='app-shell-root'><div style={{height:56}}>Header</div><div className='thread-scroll-layout' style={{height:'calc(100% - 56px)'}}><div className='thread-scroll'><div className='thread-scroll-footer' data-thread-scroll-footer='true'><div className='thread-scroll-footer__content thread-layout-width'><OpenCraftComposer controller={controller} queuedSubmissions={queued} placeholder='Write a message' onSubmit={()=>{window.fixture.sent++;return false}} onCancel={()=>{}}/></div></div><div style={{height:1600,flexShrink:0}}>Long conversation</div></div></div></div>}
createIntlTestRoot(document.getElementById('root')).render(<App/>);`;
const vite=await createServer({configFile:false,root:process.cwd(),logLevel:'error',resolve:{dedupe:['react','react-dom']},cacheDir:'node_modules/.vite-composer-keyboard',esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:0},plugins:[{name:'fixture',resolveId:id=>id==='/keyboard.tsx'?id:null,load:id=>id==='/keyboard.tsx'?source:null,configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url!=='/')return next();res.setHeader('content-type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/keyboard.tsx"></script>')})}}]});
await mkdir('.local/composer-keyboard',{recursive:true});await vite.listen();const browser=await chromium.launch({executablePath:process.env.OPENCRAFT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});const evidence=[];
try{for(const theme of ['light','dark']) for(const newera of [false,true]){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'});
 await context.addInitScript(()=>{const v=new EventTarget();Object.assign(v,{width:390,height:844,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{value:v});(window as any).setViewport=(height:number,offsetTop:number)=>{Object.assign(v,{height,offsetTop});v.dispatchEvent(new Event('resize'));v.dispatchEvent(new Event('scroll'))}});
 const page=await context.newPage();await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as any).port}`);const editor=page.locator('.opencraft-composer-editor');await editor.waitFor();await page.evaluate(({theme,newera})=>{document.documentElement.dataset.theme=theme;document.documentElement.dataset.uiDensity='touch';document.documentElement.dataset.touchNewera=newera?'on':'off'}, {theme,newera});
 // Native selection stays owned by the editor while the conversation and visual
 // viewport move independently. This checks DOM geometry, not iOS caret pixels.
 await editor.fill('解决');
 await editor.evaluate(e=>{
  (window as any).keptEditor=e;
  const node=e.querySelector('p')!.firstChild!;
  const range=document.createRange();range.setStart(node,2);range.collapse(true);
  const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);
  (window as any).caretAnchor=node;
 });
 const caretEvidence=[];
 for(const [scroll,height,offset] of [[-160,360,120],[-500,360,120],[-80,280,220],[-320,360,0],[0,360,0]]){
  await page.locator('.thread-scroll').evaluate((e,top)=>{e.scrollTop=top},scroll);
  await page.evaluate(([h,t])=>(window as any).setViewport(h,t),[height,offset]);
  await page.waitForTimeout(100);
  const caret=await editor.evaluate(e=>{
   const selection=getSelection()!;
   const range=selection.getRangeAt(0);const caret=range.getBoundingClientRect();
   const character=range.cloneRange();character.setStart(range.startContainer,range.startOffset-1);
   const char=character.getBoundingClientRect();
   const filtered=[];
   for(let ancestor:HTMLElement|null=e as HTMLElement;ancestor;ancestor=ancestor.parentElement){
    const style=getComputedStyle(ancestor);
    if(style.filter!=='none'||style.backdropFilter!=='none'||(style.getPropertyValue('-webkit-backdrop-filter')||'none')!=='none')filtered.push(ancestor.className);
   }
   return {sameAnchor:selection.anchorNode===(window as any).caretAnchor,offset:selection.anchorOffset,
    active:document.activeElement===e,sameEditor:e===(window as any).keptEditor,
    deltaY:caret.top-char.top,deltaX:caret.right-char.right,filtered,scroll:(document.querySelector('.thread-scroll') as HTMLElement).scrollTop};
  });
  assert(caret.active&&caret.sameEditor&&caret.sameAnchor&&caret.offset===2,JSON.stringify(caret));
  assert(Math.abs(caret.deltaY)<1&&Math.abs(caret.deltaX)<1,JSON.stringify(caret));
  assert.deepEqual(caret.filtered,[],'native editor must have no filtered ancestor');
  caretEvidence.push(caret);
 }
 assert(new Set(caretEvidence.map(c=>c.scroll)).size>2,'exercise actual conversation scrolling');
 await page.locator('.thread-scroll').evaluate(e=>{e.scrollTop=0});
 const text=Array.from({length:28},(_,i)=>'Long mobile draft line '+i).join('\n');await editor.fill(text);const rendered=await editor.innerText();await editor.evaluate(e=>(window as any).keptEditor=e);
 // Exercise the editor's own scroll owner as well as the transcript's owner.
 await editor.evaluate(e=>{
  const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
  const node=walker.nextNode()!;
  const range=document.createRange();range.setStart(node,2);range.collapse(true);
  const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);
  (window as any).longDraftAnchor=node;
 });
 const editorScroll=[];
 for(const top of [0,40,120,0]){
  await editor.evaluate((e,top)=>{e.scrollTop=top},top);
  await page.waitForTimeout(50);
  const state=await editor.evaluate(e=>{
   const selection=getSelection()!;const range=selection.getRangeAt(0);
   const character=range.cloneRange();character.setStart(range.startContainer,range.startOffset-1);
   return {top:e.scrollTop,offset:selection.anchorOffset,same:selection.anchorNode===(window as any).longDraftAnchor,deltaY:range.getBoundingClientRect().top-character.getBoundingClientRect().top};
  });
  assert(state.same&&state.offset===2&&Math.abs(state.deltaY)<1,JSON.stringify(state));
  editorScroll.push(state.top);
 }
 assert(new Set(editorScroll).size>2,'exercise actual long-draft internal scrolling');
 for(const [height,offset] of [[360,120],[280,220],[360,0]]){
  await editor.focus();await page.evaluate(([h,t])=>(window as any).setViewport(h,t),[height,offset]);await page.waitForTimeout(200);
  const editRect=await editor.boundingBox();assert.ok(editRect&&editRect.y>=offset+56&&editRect.y+editRect.height<=offset+height,`Editor visible: ${JSON.stringify(editRect)}`);
  const send=page.locator('.opencraft-composer-submit').last();const rect=await send.boundingBox();assert.ok(rect&&rect.y>=offset+56&&rect.y+rect.height<=offset+height,`Send must remain above keyboard: ${JSON.stringify(rect)} in ${offset}..${offset+height}`);
  assert.ok(await send.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'Send hit target unobstructed');
  assert.equal(await editor.evaluate(e=>e===(window as any).keptEditor),true);assert.equal(await editor.innerText(),rendered);
  const before=await page.evaluate(()=>(window as any).fixture.sent);await send.tap();assert.equal(await page.evaluate(()=>(window as any).fixture.sent),before+1,'Send works on first touch without closing keyboard');
  evidence.push({theme,newera,height,offset,send:rect,caretEvidence});
 }
 await page.evaluate(()=>(window as any).setViewport(844,0));await page.waitForTimeout(150);assert.equal(await editor.innerText(),rendered);await page.screenshot({path:'.local/composer-keyboard/'+theme+'-'+newera+'.png'});await context.close();
}console.log('Keyboard viewport/send reachability and draft continuity passed');}
finally{await writeFile('.local/composer-keyboard/result.json',JSON.stringify(evidence,null,2));await browser.close();await vite.close()}
