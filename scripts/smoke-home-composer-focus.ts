import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createServer } from "vite";
const { chromium } = await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE ?? "playwright");
const before=process.argv.includes("--record-before"), output=process.env.OPENCRAFT_SMOKE_OUTPUT??".local/home-composer-focus";
await mkdir(output,{recursive:true});
const vite=await createServer({configFile:false,root:process.cwd(),logLevel:"error",esbuild:{jsx:"automatic"},resolve:{dedupe:["react","react-dom"]},server:{host:"127.0.0.1",port:0},plugins:[{name:"home-focus",configureServer(server){server.middlewares.use((req,res,next)=>{if(!req.url?.startsWith("/?"))return next();res.setHeader("content-type","text/html");res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/tests/fixtures/home-composer-focus.tsx"></script>');});}}]});
await vite.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.OPENCRAFT_CHROMIUM_EXECUTABLE,args:["--no-sandbox"]});
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
  await page.goto(`${vite.resolvedUrls!.local[0]}?theme=${test.theme}${desktop?"&desktop":""}${test.ordinary?"&ordinary":""}${before?"&legacyHeader":""}`);
  const editor=page.locator(".codex-composer-editor"),shell=page.locator(".codex-composer-shell");
  await editor.waitFor();await page.waitForTimeout(250);
  await editor.evaluate(el=>{(window as any).keptEditor=el;(el as HTMLElement).blur();});
  const initial=(await shell.boundingBox())!;await editor.focus();await page.waitForTimeout(250);const focused=(await shell.boundingBox())!;
  const header=await page.locator(".app-shell-header").evaluate(el=>({background:getComputedStyle(el).backgroundImage,before:getComputedStyle(el,"::before").display}));
  if(before){assert(focused.height>initial.height+20);assert.notEqual(header.background,"none");await page.screenshot({path:`${output}/before.png`});evidence.push({test,initial,focused,header});await context.close();continue;}
  assert.equal(focused.height,initial.height,`${label}: empty focus geometry`);
  if(!desktop&&!test.ordinary){assert.equal(header.background,"none");assert.equal(header.before,"none");}
  await editor.fill("保留当前草稿");const content=(await shell.boundingBox())!;assert(content.height>=focused.height);
  const viewportEvidence=[];
  for(const [height,top] of desktop?[[844,0]]:[[420,0],[360,54],[280,120],[420,0],[844,0]]){
   await page.evaluate(([h,t])=>(window as any).setViewport(h,t),[height,top]);await page.waitForTimeout(150);
   const send=page.locator(".codex-composer-submit");const visible=(await send.boundingBox())!;
   assert(visible.y>=top&&visible.y+visible.height<=top+height+1,`${label}: send clipped ${JSON.stringify({height,top,visible})}`);
   assert.equal(await editor.innerText(),"保留当前草稿");assert(await editor.evaluate(el=>el===(window as any).keptEditor));viewportEvidence.push({height,top,visible});
  }
  // Real attachment state and long editor growth must share the keyboard budget.
  if(!desktop){
   await page.evaluate(()=>{(window as any).fixture.controller.dispatch({type:"add-attachment",attachment:{id:"image",name:"screenshot.png",mimeType:"image/png",size:68,uri:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",lifecycle:"ready",error:null}});(window as any).setViewport(360,54);});
   await editor.fill(Array.from({length:18},(_,i)=>`草稿第${i}行`).join("\n"));await page.waitForTimeout(200);
   const visible=(await page.locator(".codex-composer-submit").boundingBox())!;
   assert(visible.y>=54&&visible.y+visible.height<=414,`${label}: attachment/long draft send clipped ${JSON.stringify(visible)}`);
   assert(await editor.evaluate(el=>el===(window as any).keptEditor));
   if(test.width===390&&!test.ordinary&&!test.reduce)await page.screenshot({path:`${output}/${label}-keyboard-attachment.png`});
   await page.evaluate(()=>{(window as any).fixture.controller.dispatch({type:"remove-attachment",id:"image"});(window as any).setViewport(844,0);});await page.waitForTimeout(150);
  }
  await editor.focus();await editor.press("ControlOrMeta+A");await editor.press("Backspace");await page.waitForFunction(()=>document.querySelector<HTMLElement>(".codex-composer-stack")?.dataset.composerEmpty==="true");await page.waitForTimeout(150);assert.equal((await shell.boundingBox())!.height,initial.height,JSON.stringify({initial,final:await shell.boundingBox(),parts:await shell.evaluate(el=>Array.from(el.children).map(c=>({class:c.className,box:c.getBoundingClientRect().toJSON()})))}));
  if(test.width===390&&!test.ordinary)await page.screenshot({path:`${output}/${label}.png`});assert.deepEqual(errors,[]);
  evidence.push({test,initial,focused,content,header,viewportEvidence});console.log("PASS",label);await context.close();
 }
 await writeFile(`${output}/${before?"before":"after"}.json`,JSON.stringify(evidence,null,2));
}finally{await browser.close();await vite.close();}
