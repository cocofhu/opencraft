import assert from "node:assert/strict";
import { createServer } from "vite";
const vite=await createServer({configFile:false,root:process.cwd(),logLevel:"error",esbuild:{jsx:"automatic"},resolve:{dedupe:["react","react-dom"]},server:{host:"127.0.0.1",port:0},plugins:[{name:"entry-defaults",configureServer(server){server.middlewares.use((req,res,next)=>{if(!req.url?.startsWith("/?"))return next();res.setHeader("content-type","text/html");res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/tests/fixtures/touch-newera.tsx"></script>')})}}]});
const playwright=await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE??"playwright");
const {chromium}=playwright.default??playwright;
await vite.listen();const browser=await chromium.launch({executablePath:process.env.OPENCRAFT_CHROMIUM_EXECUTABLE,args:["--no-sandbox"]});
try {
 for(const newera of [true,false]) for(const mode of ["light","dark"]){
  console.log("case",newera,mode);
  const context=await browser.newContext({viewport:{width:390,height:700},hasTouch:true,isMobile:true});
  const page=await context.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript("window.__name=value=>value");
  await page.goto(`${vite.resolvedUrls!.local[0]}?pickerFocus=1&mode=${mode}`);
  await page.waitForFunction(()=>typeof(window as any).setTouch==="function");
  await page.evaluate(async newera=>{await(window as any).setTouch(true);await(window as any).setNewera(newera)},newera);
  const editor=page.locator('.codex-composer-editor'),model=page.locator('.codex-composer-mode--intelligence'),permissions=page.locator('.codex-composer-mode--permissions');
  const menu=page.locator('[role="menu"]');
  await editor.fill('正在编辑的草稿');
  await editor.evaluate(el=>{const sel=getSelection()!;const range=document.createRange();range.setStart(el.firstChild!.firstChild!,2);range.collapse(true);sel.removeAllRanges();sel.addRange(range);(window as any).originalEditor=el;(window as any).blurs=0;el.addEventListener('blur',()=>{(window as any).blurs++})});
  const assertEditing=async()=>{
   assert(await editor.evaluate(el=>el===document.activeElement&&el===(window as any).originalEditor));
   assert.equal(await page.evaluate(()=>(window as any).blurs),0,'no editor blur during auxiliary touch selection');
   assert.equal(await page.evaluate(()=>getSelection()?.anchorOffset),2,'native selection retained');
  };
  await model.tap();await menu.waitFor();await assertEditing();
  await page.getByRole('menuitem',{name:'Beta',exact:false}).tap();await assertEditing();
  assert.equal(await page.evaluate(()=>(window as any).composerController.getSnapshot().draft.selections.model),'Beta');
  await page.waitForTimeout(220);
  const list=page.locator('.codex-composer-intelligence-models');const box=await list.boundingBox();assert(box);
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height-20}]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height-20-i*12}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>(document.querySelector('.codex-composer-intelligence-models')?.scrollTop ?? 0)>0);
  console.log("scroll passed");await assertEditing();
  await permissions.tap();await page.locator('.codex-composer-selection-menu--permissions').waitFor();await assertEditing();
  await page.getByRole('menuitem',{name:'只读',exact:false}).tap();await menu.waitFor({state:'hidden'});await assertEditing();
  // Escape and continued typing keep editing; opening does not change shell geometry.
  const shell=page.locator('.codex-composer-shell'),before=await shell.boundingBox();
  await model.tap();await menu.waitFor();await assertEditing();
  assert.deepEqual(await shell.boundingBox(),before);
  await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});await assertEditing();
  await model.tap();await menu.waitFor();await page.keyboard.type('x');await menu.waitFor({state:'hidden'});
  assert.equal(await editor.innerText(),'正在x编辑的草稿');
  // Explicit keyboard navigation releases the editor lease and uses native Radix items.
  await model.tap();await menu.waitFor();await page.keyboard.press('ArrowDown');
  assert(await menu.evaluate(el=>el.contains(document.activeElement)));
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
  assert(await model.evaluate(el=>el===document.activeElement),'keyboard escape returns to trigger');
  // Keyboard/AT opens without an editor lease; no focus interception.
  await permissions.focus();await page.keyboard.press('Enter');await menu.waitFor();
  assert(await menu.evaluate(el=>el.contains(document.activeElement)));
  await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
  assert(await permissions.evaluate(el=>el===document.activeElement));
  // A touch opening from a non-editing state remains an ordinary menu.
  await model.tap();await menu.waitFor();assert(await menu.evaluate(el=>el.contains(document.activeElement)));
  await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
  console.log('core passed');
  // Outside text entry may take focus and must not be stolen by delayed cleanup.
  await editor.click();await model.tap();await menu.waitFor();
  await page.getByLabel('Outside input').tap();await menu.waitFor({state:'hidden'});
  await page.waitForTimeout(80);assert(await page.getByLabel('Outside input').evaluate(el=>el===document.activeElement));
  // Unmount revokes pending return-to-editor behavior.
  await editor.click();await model.tap();await menu.waitFor();
  await page.evaluate(()=>(window as any).setComposerVisible(false));await menu.waitFor({state:'hidden'});
  await page.getByLabel('Outside input').tap();await page.waitForTimeout(80);
  assert(await page.getByLabel('Outside input').evaluate(el=>el===document.activeElement));
  assert.deepEqual(errors,[]);await context.close();
 }
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage();await page.addInitScript("window.__name=value=>value");
 await page.goto(`${vite.resolvedUrls!.local[0]}?pickerFocus=1`);
 const editor=page.locator('.codex-composer-editor'),menu=page.locator('[role="menu"]');
 await editor.fill('桌面草稿');
 for(const selector of ['.codex-composer-mode--intelligence','.codex-composer-mode--permissions']){
  await editor.click();await page.locator(selector).click();await menu.waitFor();
  assert(await menu.evaluate(el=>el.contains(document.activeElement)),'mouse uses normal Radix focus');
  await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
  assert(await page.locator(selector).evaluate(el=>el===document.activeElement));
 }
 assert.equal(await editor.innerText(),'桌面草稿');await context.close();
 console.log('PASS: touch Newera on/off × light/dark; model/permissions selection, switching, no blur, native selection/draft, stable layout, typing, keyboard/AT entry and Escape');
}finally{await browser.close();await vite.close()}
