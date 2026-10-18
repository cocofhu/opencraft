import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import { pluginBranding } from "../apps/workbench-web/plugin-branding.vite";
const { chromium } = await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE ?? "playwright");
const output = process.env.OPENCRAFT_NEWERA_HEADER_OUTPUT ?? "/tmp/opencraft-newera-header";
const source = `
import React,{useState}from'react';
import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
import{ConversationTaskMenu}from'/apps/workbench-web/src/components/conversation-task-menu.tsx';
import{createIntlTestRoot}from'/tests/fixtures/intl-root.tsx';
import{AppShell}from'/apps/workbench-web/src/components/app-shell.tsx';
import{AppShellHeader}from'/apps/workbench-web/src/components/app-shell-header.tsx';
import{initializeAppearanceTheme,setThemePreference}from'/apps/workbench-web/src/appearance-theme.ts';
import'/apps/workbench-web/src/styles/app.scss';
initializeAppearanceTheme();
const fixture=window.fixture={setThemePreference};const noop=()=>{};const client=new QueryClient();
const navigation={layout:'unified',actions:[],onOpenSettings:noop,account:{snapshot:{phase:'authenticated',name:'Synthetic employee',avatarUrl:null},onOpen:noop,onRefresh:async()=>{}}};
function App(){const[open,setOpen]=useState(false),[preview,setPreview]=useState(false),[conversation,setConversation]=useState(true);Object.assign(fixture,{setConversation});
return <QueryClientProvider client={client}><AppShell layoutScope='measurement' navigation={navigation} mainContentLayout='thread-edge-scroll' sidebarOpen={open} sidebarWidth={335} windowChrome={{kind:'browser',platform:'linux',safeArea:{left:0,right:0}}} onSidebarCollapse={()=>setOpen(false)} onSidebarExpand={()=>setOpen(true)} onSidebarResizeEnd={noop} rightPanel={<div>Preview</div>} rightPanelOpen={preview} rightPanelFullWidth={false} onRightPanelOpenChange={setPreview}
header={<AppShellHeader conversationHeader={conversation} headerAction={<ConversationTaskMenu scope="fixture" serverId="local" threadId="synthetic" title="Measurement" verifyConversation={async()=>{}} onOpenTasks={noop} onRename={async()=>{}}/>} navigationBrand={<span className="application-brand" data-probe-brand style={{whiteSpace:'nowrap',fontSize:14}}>OpenCraft</span>} title='Measurement' project={null} sidebarOpen={open} rightPanelOpen={preview} rightPanelFullWidth={false} showRightPanelAction={true} onToggleSidebar={()=>setOpen(!open)} onToggleRightPanel={()=>setPreview(v=>!v)} onHome={noop} canGoBack={false} canGoForward={false} onBack={noop} onForward={noop} navigationActions={['sidebar-toggle','back','forward']}/>}
floatingSidebarHeader={()=>null} leftPanel={<div>Sidebar</div>}><div data-scroll style={{height:'100%',overflowY:'auto'}}><div style={{padding:'90px 20px 20px'}}><input aria-label='Draft' defaultValue='Keep draft'/>{Array.from({length:80},(_,i)=><p key={i}>Conversation content {i}</p>)}</div></div></AppShell></QueryClientProvider>}
createIntlTestRoot(document.getElementById('root')).render(<App/>);
`;
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", resolve: { dedupe: ["react", "react-dom"] }, cacheDir: "node_modules/.vite-newera-header", esbuild: { jsx: "automatic", target: "esnext" }, optimizeDeps: { entries: [], include: ["react", "react-dom/client", "react-intl", "@radix-ui/react-tooltip", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-popover", "@radix-ui/react-alert-dialog", "@deepseek-ai/cordis", "@radix-ui/react-context-menu", "lucide-react", "marked", "mermaid", "motion/react", "react-dom", "sonner", "tslib"] }, server: { host: "127.0.0.1", port: 0, hmr: false }, plugins: [pluginBranding(process.cwd(), ["join.server"]), { name: "header-measurement-fixture", resolveId: id => id === "/header-fixture.tsx" ? id : null, load: id => id === "/header-fixture.tsx" ? source : null, configureServer(server) { server.middlewares.use((req,res,next) => { if (req.url !== "/") return next(); res.setHeader("content-type","text/html"); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/header-fixture.tsx"></script>'); }); } }] });

let browser:any;const evidence:any[]=[];
try {
 await mkdir(output,{recursive:true});await vite.listen();browser=await chromium.launch({headless:true,executablePath:process.env.OPENCRAFT_CHROMIUM_EXECUTABLE});
 for(const width of [320,390,820,1280])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:width<640});
 await context.addInitScript(()=>{(window as any).__name=(v:unknown)=>v});
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.goto(vite.resolvedUrls!.local[0]!);await page.getByLabel('Draft').waitFor({timeout:60000});await page.evaluate(()=>{document.documentElement.dataset.uiDensity='touch';document.documentElement.dataset.touchNewera='on'});await page.evaluate(theme=>(window as any).fixture.setThemePreference(theme),theme);await page.waitForTimeout(350);
 const controls=page.locator('.app-shell-header__window-controls button:visible, .app-shell-header__end-actions button:visible, .app-shell-touch-sidebar-toggle button:visible');
 assert.equal(await controls.count(),3,'sidebar, menu and preview');assert.equal(await page.locator('.thread-header-title').isVisible(),false);assert.equal(await page.locator('.app-shell-header__right-panel-toggle').last().isVisible(),true);
 const bounds=await controls.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,width:r.width,height:r.height,filter:s.backdropFilter,shadow:s.boxShadow}}));
 for(const b of bounds){assert.ok(b.width>=44&&b.height>=44,JSON.stringify({width,bounds}));assert.ok(b.x>=12&&b.x+b.width<=width-12&&b.y>=0);assert.notEqual(b.filter,'none');const layers=b.shadow.split(/,(?![^()]*\))/);assert.ok(layers.length>0&&layers.every((layer:string)=>layer.includes('inset')),'floating glass must not cast an outer shadow: '+b.shadow)}
 assert.ok(bounds.some(b=>b.x>width-90),'menu on trailing edge');
 const fade=await page.locator('.main-content-top-fade').evaluate(e=>{const s=getComputedStyle(e);return{display:s.display,opacity:s.opacity,pointer:s.pointerEvents,background:s.backgroundImage}});assert.equal(await page.locator('.main-content-frame').evaluate(e=>getComputedStyle(e).marginTop),'0px');assert.equal(fade.display,'block');assert.equal(fade.opacity,'1');assert.equal(fade.pointer,'none');
 await page.getByLabel('Draft').fill('Retained draft');await page.evaluate(()=>{(window as any).editor=document.querySelector('input')});
 const trigger=page.getByRole('button',{name:'Conversation actions',exact:true});await page.getByRole('button',{name:'Open preview panel',exact:true}).click();
 await page.getByRole('button',{name:'Close preview panel',exact:true}).click();
 await trigger.click();await page.getByRole('menuitem',{name:'Rename',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Show sidebar',exact:true}).click();await page.waitForTimeout(450);await page.getByRole('button',{name:width<640?'Close sidebar':'Hide sidebar',exact:true}).click();await page.waitForTimeout(450);
 await page.locator('[data-scroll]').evaluate((e:HTMLElement)=>e.scrollTop=220);assert.ok(await page.locator('[data-scroll]').evaluate(e=>e.scrollTop)>200);
 await page.screenshot({path:output+'/'+width+'-'+theme+'.png'});
 if(width===390){await page.emulateMedia({forcedColors:'active'});assert.equal(await trigger.evaluate(e=>getComputedStyle(e).backdropFilter),'none');await page.emulateMedia({forcedColors:'none'});}

 await page.evaluate(()=>document.documentElement.dataset.touchNewera='off');assert.equal(await page.locator('.thread-header-title').isVisible(),true);assert.equal(await page.locator('.app-shell-header__right-panel-toggle').last().isVisible(),true);
 await trigger.click();assert.equal(await page.getByRole('menuitem',{name:'Open preview panel',exact:true}).count(),0);await page.keyboard.press('Escape');
 await page.evaluate(()=>{document.documentElement.dataset.uiDensity='compact';document.documentElement.dataset.touchNewera='on'});await page.waitForTimeout(100);assert.equal(await page.locator('.thread-header-title').isVisible(),true);
 await page.evaluate(()=>{document.documentElement.dataset.uiDensity='touch';(window as any).fixture.setConversation(false)});await page.waitForTimeout(100);assert.equal(await page.locator('.thread-header-title').isVisible(),true);
 assert.equal(await page.evaluate(()=>(window as any).editor===document.querySelector('input')),true);assert.equal(await page.getByLabel('Draft').inputValue(),'Retained draft');assert.deepEqual(errors,[]);
 evidence.push({width,theme,bounds,fade,errors});await context.close();
 }
 console.log(JSON.stringify({ok:true,evidence}));await writeFile(output+'/result.json',JSON.stringify({ok:true,evidence},null,2));
}finally{await browser?.close();await vite.close()}
