import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const source=`
import React from 'react';import {createIntlTestRoot} from '/tests/fixtures/intl-root.tsx';
import {Sidebar} from '/apps/workbench-web/src/components/sidebar.tsx';
import {initializeAppearanceTheme} from '/apps/workbench-web/src/appearance-theme.ts';
import {UiPreferencesProvider,openWorkbenchUiPreferences} from '/apps/workbench-web/src/runtime/ui-preferences-runtime.tsx';
import {SidebarLayoutStore} from '@opencraft/sidebar-layout';
import {legacyDirectServerProjectionFromHost} from '@opencraft/workbench-runtime';
import '/apps/workbench-web/src/styles/app.scss';initializeAppearanceTheme();
const layout=await SidebarLayoutStore.open({load:async()=>null,save:async(_,v)=>v});const preferences=await openWorkbenchUiPreferences();
const makeRows=(n)=>[...Array.from({length:8},(_,i)=>({id:'pin'+i,title:'Pinned '+String(i+1).padStart(2,'0'),pinned:true})),...Array.from({length:n},(_,i)=>({id:'recent'+i,title:'Recent '+String(i+1).padStart(2,'0')}))].map((row,i)=>({...row,project:'mono2',status:'ready',connectionHostId:'host',connectionHostLabel:'Local',updatedAt:Date.now()/1000-i*86400,...legacyDirectServerProjectionFromHost({hostId:'host',hostKind:'local',label:'Local'})}));
function Fixture(){const [rows,setRows]=React.useState(makeRows(31));window.setCount=n=>setRows(makeRows(n));return <UiPreferencesProvider runtime={preferences}><div style={{width:320,height:'100vh',display:'flex',flexDirection:'column'}}><Sidebar threads={rows} activeHostId='host' activeThreadId='recent30' sidebarLayout={layout} onSelectThread={()=>{}} onNewTask={()=>{}} onOpenSettings={()=>{}} showFooter={false}/></div></UiPreferencesProvider>};createIntlTestRoot(document.getElementById('root'),undefined,new URLSearchParams(location.search).get('locale')??'en-US').render(<Fixture/>);`;
const vite=await createServer({configFile:false,root:process.cwd(),logLevel:'error',resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'fixture',resolveId:id=>id==='/fixture.tsx'?id:null,load:id=>id==='/fixture.tsx'?source:null,configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('content-type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/fixture.tsx"></script>')})}}]});
let browser:any;
try{await vite.listen();const pw=await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE??'playwright');const {chromium}=pw.default??pw;browser=await chromium.launch({headless:true,executablePath:process.env.OPENCRAFT_CHROMIUM_EXECUTABLE});const output=await mkdtemp(join(tmpdir(),'sidebar-recent-pages-'));
for(const touch of [false,true])for(const theme of ['light','dark'])for(const locale of ['en-US','zh-CN']){
const page=await browser.newPage({viewport:{width:touch?390:1000,height:900},hasTouch:touch,isMobile:touch});const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));await page.addInitScript(t=>{(window as any).__name=(v:any)=>v;localStorage.setItem('vela.appearance-theme',t)},theme);await page.goto('http://127.0.0.1:'+(vite.httpServer!.address() as any).port+'/?locale='+locale);
const pinned=page.getByRole('region',{name:/^(Pinned|置顶)$/,exact:true});const recent=page.getByRole('region',{name:/^(Recent|最近)$/,exact:true});const rows=recent.locator('.sidebar-activity-item');const more=recent.getByRole('button',{name:/^(Show more|查看更多)$/,exact:true});const less=recent.getByRole('button',{name:/^(Show less|收起)$/,exact:true});await rows.first().waitFor({timeout:60000});
const activate=async(button:any)=>{if(touch)await button.tap();else{await button.focus();await button.press('Enter');}};
assert.equal(await rows.count(),10,'selected recent row outside the page does not change page size');assert.equal(await less.count(),0);assert.equal(await pinned.locator('.sidebar-activity-item').count(),6);
await activate(pinned.getByRole('button',{name:/^(Show more|查看更多)$/}));assert.equal(await pinned.locator('.sidebar-activity-item').count(),8);assert.equal(await rows.count(),10,'pinned paging is independent');
const typography=await more.evaluate(el=>({size:getComputedStyle(el).fontSize,color:getComputedStyle(el).color,height:el.getBoundingClientRect().height}));assert.equal(typography.size,'12px');assert.ok(typography.height>=(touch?44:30));
for(const count of [20,30,31]){await activate(more);assert.equal(await rows.count(),count);assert.equal(await less.count(),1);assert.equal(await pinned.locator('.sidebar-activity-item').count(),8);}
assert.equal(await more.count(),0);const last=await rows.last().boundingBox();const bottom=await less.boundingBox();assert.ok(bottom!.y>=last!.y+last!.height-1,'controls follow last recent row');await less.scrollIntoViewIfNeeded();await page.screenshot({path:join(output,locale+'-'+theme+'-'+(touch?'touch':'desktop')+'.png')});await activate(less);assert.equal(await rows.count(),10);assert.equal(await less.count(),0);await activate(more);assert.equal(await rows.count(),20);await recent.getByRole('button',{name:/^(Recent|最近)$/,exact:true}).click();assert.equal(await more.isVisible(),false);await recent.getByRole('button',{name:/^(Recent|最近)$/,exact:true}).click();assert.equal(await rows.count(),20);await activate(less);
for(const count of [10,11,0]){await page.evaluate(n=>(window as any).setCount(n),count);await page.waitForTimeout(30);assert.equal(await rows.count(),Math.min(count,10));assert.equal(await more.count(),count>10?1:0);assert.equal(await less.count(),0);}
assert.deepEqual(errors,[]);await page.close();}
console.log(JSON.stringify({passed:true,output}));}finally{await browser?.close();await vite.close();}
