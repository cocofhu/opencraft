import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createServer } from "vite";
const engines = await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE ?? "playwright");
const before=process.argv.includes("--record-before"), output=process.env.OPENCRAFT_SMOKE_OUTPUT??".local/home-composer-focus";
await mkdir(output,{recursive:true});
const vite=await createServer({configFile:false,root:process.cwd(),logLevel:"error",esbuild:{jsx:"automatic"},resolve:{dedupe:["react","react-dom"]},server:{host:"127.0.0.1",port:0},plugins:[{name:"home-focus",configureServer(server){server.middlewares.use((req,res,next)=>{if(!req.url?.startsWith("/?"))return next();res.setHeader("content-type","text/html");res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/tests/fixtures/home-composer-focus.tsx"></script>');});}}]});
await vite.listen();
const browser=await (process.env.OPENCRAFT_SMOKE_ENGINE === "webkit" ? engines.webkit : engines.chromium).launch({headless:true,executablePath:process.env.OPENCRAFT_CHROMIUM_EXECUTABLE,args:["--no-sandbox"]});
const evidence:unknown[]=[];
try {
 if(!before)assert.match(await readFile("apps/workbench-web/src/app.tsx","utf8"),/conversationHeader=\{conversationSurfaceVisible\}/,"production Home uses shared chrome");
 const cases=before?[{width:390,theme:"light",ordinary:false,reduce:false}]:[
 ...[320,390,430].flatMap(width=>["light","dark"].map(theme=>({width,theme,ordinary:false,reduce:false}))),
 ...["light","dark"].flatMap(theme=>[{width:390,theme,ordinary:false,reduce:true},{width:390,theme,ordinary:true,reduce:false},{width:1280,theme,ordinary:false,reduce:false}])];
 for(const test of cases){
  const desktop=test.width===1280,label=Object.values(test).join("-");
  const context=await browser.newContext({viewport:{width:test.width,height:844},hasTouch:!desktop,isMobile:!desktop,reducedMotion:test.reduce?"reduce":"no-preference",...(!desktop?{userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"}:{})});
  await context.addInitScript(({width})=>{(window as any).__name=(value:unknown)=>value;const v=new EventTarget();Object.assign(v,{height:844,width,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,"visualViewport",{value:v});(window as any).setViewport=(height:number,offsetTop:number)=>{Object.assign(v,{height,offsetTop});v.dispatchEvent(new Event("resize"));v.dispatchEvent(new Event("scroll"));};},{width:test.width});
  const page=await context.newPage(),errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  const inline=!desktop&&!test.ordinary&&!test.reduce;
  page.setDefaultNavigationTimeout(90000);
  await page.goto(`${vite.resolvedUrls!.local[0]}?theme=${test.theme}${inline?"&inline&toolbar":""}${desktop?"&desktop":""}${test.ordinary?"&ordinary":""}${before?"&legacyHeader":""}`);
  const editor=page.locator(".codex-composer-editor"),shell=page.locator(".codex-composer-shell");
  await editor.waitFor();await page.waitForTimeout(250);
  await editor.evaluate(el=>{(window as any).keptEditor=el;(el as HTMLElement).blur();});
  const initial=(await shell.boundingBox())!;await editor.focus();await page.waitForTimeout(250);const focused=(await shell.boundingBox())!;
  const header=await page.locator(".app-shell-header").evaluate(el=>({background:getComputedStyle(el).backgroundImage,before:getComputedStyle(el,"::before").display}));
  if(before){assert(focused.height>initial.height+20);assert.notEqual(header.background,"none");await page.screenshot({path:`${output}/before.png`});evidence.push({test,initial,focused,header});await context.close();continue;}
  assert.equal(focused.height,initial.height,`${label}: empty focus geometry`);
  assert(await page.locator(".codex-composer-mode--depth").isVisible(),`${label}: model/depth entry remains available in empty Composer`);
  if(!desktop&&!test.ordinary){assert.equal(header.background,"none");assert.equal(header.before,"none");}
  if(inline){
    const geometry=await shell.evaluate(el=>{
      const box=el.getBoundingClientRect();
      const children=['.codex-composer-input-row','.codex-composer-footer__attachment','.codex-composer-footer__controls','.codex-composer-footer__end'].map(selector=>{const r=el.querySelector(selector)!.getBoundingClientRect();return {selector,x:r.x,right:r.right,center:r.y+r.height/2};});
      return {box:box.toJSON(),children};
    });
    assert(geometry.box.height<=70,'default Composer must remain one control row: '+JSON.stringify(geometry));
    assert(Math.max(...geometry.children.map(x=>x.center))-Math.min(...geometry.children.map(x=>x.center))<=2,'default row vertical alignment: '+JSON.stringify(geometry));
    assert(geometry.children.every(x=>x.x>=geometry.box.x&&x.right<=geometry.box.right),'default row stays inside shell');
    const trigger=page.locator('.codex-composer-mode--depth');await trigger.tap();
    const menu=page.locator('.codex-composer-model-quick');await menu.waitFor();
    await menu.getByRole('menuitemcheckbox',{name:'Fast',exact:true}).tap();
    await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
    assert.equal((await shell.boundingBox())!.height,initial.height,'empty Fast toggle does not expand');
    assert(await trigger.locator('.codex-composer-mode__fast').isVisible(),'empty row projects enabled Fast');
    assert(await editor.evaluate(el=>el===(window as any).keptEditor),'empty menu keeps editor identity');
    await page.screenshot({path:`${output}/${label}-empty.png`});
  }
  const assertEmptyCaretOrigin=async()=>{
    const geometry=await editor.evaluate(el=>{
      const selection=getSelection()!,native=selection.getRangeAt(0);
      const paragraph=el.querySelector('.codex-composer-placeholder')!;
      const box=paragraph.getBoundingClientRect(),style=getComputedStyle(paragraph);
      // Chromium exposes an empty line through its BR box when a collapsed
      // native Range has no rectangle. This probe never changes Selection/DOM.
      const line=native.cloneRange();line.selectNodeContents(paragraph);
      const caret=native.getClientRects()[0]??line.getClientRects()[0];
      return {collapsed:selection.isCollapsed,inside:el.contains(selection.anchorNode),focused:document.activeElement===el,
        caret:caret?.toJSON(),start:box.left+parseFloat(style.paddingLeft),box:box.toJSON()};
    });
    assert(geometry.collapsed&&geometry.inside&&geometry.focused,'empty editor retains native selection: '+JSON.stringify(geometry));
    assert(geometry.caret&&geometry.caret.height>0,'empty native line has measurable geometry: '+JSON.stringify(geometry));
    assert(Math.abs(geometry.caret.x-geometry.start)<=1,'empty caret must meet placeholder start: '+JSON.stringify(geometry));
    return geometry;
  };
  const emptyCaretEvidence=[];
  emptyCaretEvidence.push(await assertEmptyCaretOrigin());
  await editor.pressSequentially("保留当前草稿");

  const assertNativeSelection=async()=>{
    const geometry=await editor.evaluate(el=>{
      const selection=getSelection()!,r=selection.getRangeAt(0),caret=r.getBoundingClientRect(),box=el.getBoundingClientRect();
      const ancestors=[];for(let a:Element|null=el;a;a=a.parentElement){const style=getComputedStyle(a);if(style.filter!=='none'||style.backdropFilter&&style.backdropFilter!=='none')ancestors.push(a.className);}
      return {inside:el.contains(selection.anchorNode),offset:selection.anchorOffset,caret:caret.toJSON(),box:box.toJSON(),ancestors,focused:document.activeElement===el};
    });
    assert(geometry.inside&&geometry.focused,JSON.stringify(geometry));
    assert(geometry.caret.height>0&&geometry.caret.y>=geometry.box.y-1&&geometry.caret.bottom<=geometry.box.bottom+1,'native selection bounds remain in editor: '+JSON.stringify(geometry));
    assert.deepEqual(geometry.ancestors,[],'editor has no filtered ancestor');
    return geometry;
  };
  if(inline){const typed=(await editor.boundingBox())!;assert(typed.height<32,'short draft must not reserve a second text line');}
  await assertNativeSelection();const content=(await shell.boundingBox())!;assert(content.height>=focused.height);
  const viewportEvidence=[];
  for(const [height,top] of desktop?[[844,0]]:[[420,0],[360,54],[280,120],[420,0],[844,0]]){
   await page.evaluate(([h,t])=>(window as any).setViewport(h,t),[height,top]);await page.waitForTimeout(150);
   if(inline){
    const trigger=page.locator('.codex-composer-mode--depth');await trigger.tap();
    const menu=page.locator('.codex-composer-model-quick');await menu.waitFor();
    const fast=menu.getByRole('menuitemcheckbox',{name:'Fast',exact:true});await fast.tap();
    assert.equal(await trigger.locator('.codex-composer-mode__fast').count(),await fast.getAttribute('aria-checked')==='true'?1:0);
    const control=menu.locator('.ui-discrete-slider__control'),box=(await control.boundingBox())!;
    await control.tap({position:{x:box.width-2,y:box.height/2}});
    await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
    assert(await editor.evaluate(el=>el===document.activeElement),'keyboard plus depth/Fast preserves native editing focus');
   }
   const send=page.locator(".codex-composer-submit");const visible=(await send.boundingBox())!;
   assert(visible.y>=top&&visible.y+visible.height<=top+height+1,`${label}: send clipped ${JSON.stringify({height,top,visible})}`);
   assert.equal(await editor.innerText(),"保留当前草稿");assert(await editor.evaluate(el=>el===(window as any).keptEditor));viewportEvidence.push({height,top,visible,selection:await assertNativeSelection()});
  }
  // Real attachment state and long editor growth must share the keyboard budget.
  if(!desktop){
   await page.evaluate(()=>{(window as any).fixture.controller.dispatch({type:"add-attachment",attachment:{id:"image",name:"screenshot.png",mimeType:"image/png",size:68,uri:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",lifecycle:"ready",error:null}});(window as any).setViewport(360,54);});
   if(inline){
     await editor.fill('');await page.waitForTimeout(100);
     const input=(await editor.boundingBox())!;assert(input.height<32,'attachment-only input stays one line');
     await page.screenshot({path:`${output}/${label}-attachment-only.png`});
    }
   await editor.fill(Array.from({length:18},(_,i)=>`草稿第${i}行`).join("\n"));await page.waitForTimeout(200);
   const visible=(await page.locator(".codex-composer-submit").boundingBox())!;
   assert(visible.y>=54&&visible.y+visible.height<=414,`${label}: attachment/long draft send clipped ${JSON.stringify(visible)}`);
   assert(await editor.evaluate(el=>el===(window as any).keptEditor));
   if(test.width===390&&!test.ordinary&&!test.reduce)await page.screenshot({path:`${output}/${label}-keyboard-attachment.png`});
   await page.evaluate(()=>{(window as any).fixture.controller.dispatch({type:"remove-attachment",id:"image"});(window as any).setViewport(844,0);});await page.waitForTimeout(150);
  }
  await editor.focus();await editor.press("ControlOrMeta+A");await editor.press("Backspace");await page.waitForFunction(()=>document.querySelector<HTMLElement>(".codex-composer-stack")?.dataset.composerEmpty==="true");await page.waitForTimeout(150);assert.equal((await shell.boundingBox())!.height,initial.height,JSON.stringify({initial,final:await shell.boundingBox(),parts:await shell.evaluate(el=>Array.from(el.children).map(c=>({class:c.className,box:c.getBoundingClientRect().toJSON()})))}));
  // Delete the last character with the keyboard raised, rather than fill('').
  await page.evaluate(()=>(window as any).setViewport(360,54));
  await editor.pressSequentially('删空');await editor.press('Backspace');await editor.press('Backspace');
  await page.waitForFunction(()=>document.querySelector<HTMLElement>('.codex-composer-stack')?.dataset.composerEmpty==='true');
  emptyCaretEvidence.push(await assertEmptyCaretOrigin());
  assert(await editor.evaluate(el=>el===(window as any).keptEditor),'deleting to empty keeps editor identity');
  await page.evaluate(()=>(window as any).setViewport(844,0));
  if(test.width===390&&!test.ordinary)await page.screenshot({path:`${output}/${label}.png`});assert.deepEqual(errors,[]);
  evidence.push({test,initial,focused,content,header,viewportEvidence,emptyCaretEvidence});console.log("PASS",label);await context.close();
 }
 await writeFile(`${output}/${before?"before":"after"}.json`,JSON.stringify(evidence,null,2));
}finally{await browser.close();await vite.close();}
