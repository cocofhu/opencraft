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
const makeRows=(n)=>[...Array.from({length:n},(_,i)=>({id:'pin'+i,title:'Pinned '+String(i+1).padStart(2,'0'),pinned:true})),{id:'recent',title:'Recent conversation'}].map((row,i)=>({...row,project:'opencraft',status:'ready',connectionHostId:'host',connectionHostLabel:'Local',updatedAt:Date.now()/1000-i,...legacyDirectServerProjectionFromHost({hostId:'host',hostKind:'local',label:'Local'})}));
function Fixture(){const [rows,setRows]=React.useState(makeRows(19));window.setCount=n=>setRows(makeRows(n));return <UiPreferencesProvider runtime={preferences}><div style={{width:320,height:'100vh',display:'flex',flexDirection:'column'}}><Sidebar threads={rows} activeHostId='host' activeThreadId='recent' sidebarLayout={layout} onSelectThread={()=>{}} onNewTask={()=>{}} onOpenSettings={()=>{}} showFooter={false}/></div></UiPreferencesProvider>};createIntlTestRoot(document.getElementById('root'),undefined,new URLSearchParams(location.search).get('locale')??'en-US').render(<Fixture/>);`;
const vite=await createServer({configFile:false,root:process.cwd(),logLevel:'error',resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'fixture',resolveId:id=>id==='/fixture.tsx'?id:null,load:id=>id==='/fixture.tsx'?source:null,configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('content-type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/fixture.tsx"></script>')})}}]});
let browser:any;
try{await vite.listen();const pw=await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE??'playwright');const {chromium}=pw.default??pw;browser=await chromium.launch({headless:true,executablePath:process.env.OPENCRAFT_CHROMIUM_EXECUTABLE});const output=await mkdtemp(join(tmpdir(),'sidebar-pinned-pages-'));
for(const touch of [false,true])for(const theme of ['light','dark'])for(const locale of ['en-US','zh-CN']){
const page=await browser.newPage({viewport:{width:touch?390:1000,height:900},hasTouch:touch,isMobile:touch});const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));await page.addInitScript(t=>{(window as any).__name=(v:any)=>v;localStorage.setItem('vela.appearance-theme',t)},theme);await page.goto('http://127.0.0.1:'+(vite.httpServer!.address() as any).port+'/?locale='+locale);
const pinned=page.getByRole('region',{name:/^(Pinned|置顶)$/,exact:true});const rows=pinned.locator('.sidebar-activity-item');const more=pinned.getByRole('button',{name:/^(Show more|查看更多)$/,exact:true});const less=pinned.getByRole('button',{name:/^(Show less|收起)$/,exact:true});try { await rows.first().waitFor({timeout:60000}); } catch(error) { await page.screenshot({path:join(output,'failure.png')}); console.error(JSON.stringify({touch,theme,locale,errors,body:await page.locator('body').innerText(),output})); throw error; }
const activate=async(button:any)=>{if(touch)await button.tap();else{await button.focus();await button.press('Enter');}};
assert.equal(await rows.count(),6);assert.equal(await less.count(),0);
if(locale==='zh-CN')assert.equal(await page.locator('.sidebar-list-toolbar > span').innerText(),'协同对话');
const typography=await more.evaluate(el=>{const probe=document.createElement('span');probe.style.color='var(--color-text-tertiary)';el.parentElement!.append(probe);const expected=getComputedStyle(probe).color;probe.remove();const style=getComputedStyle(el),heading=getComputedStyle(document.querySelector('.sidebar-list-toolbar > span')!);return {size:parseFloat(style.fontSize),headingSize:parseFloat(heading.fontSize),weight:style.fontWeight,color:style.color,expected,height:el.getBoundingClientRect().height}});assert.ok(typography.size<typography.headingSize);assert.equal(typography.weight,'400');assert.equal(typography.color,typography.expected);assert.ok(typography.height>=30);console.log(JSON.stringify({touch,theme,locale,typography}));

for(const count of [12,18,19]){await activate(more);assert.equal(await rows.count(),count);assert.equal(await less.count(),1);assert.equal(await page.getByRole('button',{name:'Recent conversation',exact:false}).count(),1);}
assert.equal(await more.count(),0);const last=await rows.last().boundingBox();const bottom=await less.boundingBox();assert.ok(bottom!.y>=last!.y+last!.height-1,'controls follow last pin');await less.scrollIntoViewIfNeeded();await page.screenshot({path:join(output,locale+'-'+theme+'-'+(touch?'touch':'desktop')+'.png')});await activate(less);assert.equal(await rows.count(),6);assert.equal(await less.count(),0);await activate(more);assert.equal(await rows.count(),12);await pinned.getByRole('button',{name:/^(Pinned|置顶)$/,exact:true}).click();assert.equal(await more.isVisible(),false);await pinned.getByRole('button',{name:/^(Pinned|置顶)$/,exact:true}).click();assert.equal(await rows.count(),12);await activate(less);
for(const count of [6,7,0]){await page.evaluate(n=>(window as any).setCount(n),count);await page.waitForTimeout(30);assert.equal(await rows.count(),Math.min(count,6));assert.equal(await more.count(),count>6?1:0);assert.equal(await less.count(),0);}
assert.deepEqual(errors,[]);await page.close();}
console.log(JSON.stringify({passed:true,output}));}finally{await browser?.close();await vite.close();}
