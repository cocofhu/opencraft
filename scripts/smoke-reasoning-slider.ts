import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
const playwright = await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE ?? 'playwright');
const {chromium} = playwright.default ?? playwright;
const source = `import React,{useState} from 'react';
import {createIntlTestRoot} from '/tests/fixtures/intl-root.tsx';
import {createComposerController} from '@opencraft/composer-core';
import {CodexComposer} from '@opencraft/codex-composer';
import {bindTouchInteractionMode} from '/apps/workbench-web/src/runtime/pointer-modality.ts';
import * as themes from '@opencraft/design-system/theme-engine';
import '/apps/workbench-web/src/styles/app.scss';
const params=new URLSearchParams(location.search),mode=params.get('mode')||'light',palette=themes[(params.get('palette')||'codex')+'ThemePalette'];
document.documentElement.dataset.theme=mode;document.documentElement.dataset.uiDensity=params.has('touch')?'touch':'compact';
for(const [k,v] of Object.entries(themes.buildCodexThemeCssProperties(mode,palette[mode])))document.documentElement.style.setProperty(k,v);
bindTouchInteractionMode(document);
const controller=createComposerController({type:'existing-thread',key:{hostId:'fixture',threadId:'one'}},{now:Date.now,createId:()=>crypto.randomUUID()});
const counts=[6,3,1,0,3],values=['low','medium','high','xhigh','max','ultra'];
const models=counts.map((count,i)=>({id:'model'+i,value:'model'+i,label:i===0?'GPT-6.1-Sol':'Model '+i,description:null,isDefault:i===0,defaultEffort:count&&i!==4?values[Math.min(1,count-1)]:null,serviceTiers:i===0?[{id:'fast',name:'Fast',description:'Host-declared fast tier'}]:[],efforts:values.slice(0,count).map(value=>({value,label:value[0].toUpperCase()+value.slice(1),description:null}))}));
window.fixture={controller,remembered:[]};
function App(){const [frame,setFrame]=useState(0);window.fixture.rerender=()=>setFrame(f=>f+1);return <main data-frame={frame} style={{padding:16,paddingTop:200,maxWidth:800,margin:'auto'}}><CodexComposer controller={controller} selectionCatalog={{models,permissionProfiles:[],onRememberModelDefaults:value=>window.fixture.remembered.push(value)}} onSubmit={()=>false} onCancel={()=>{}} /></main>}
createIntlTestRoot(document.getElementById('root'),undefined,'zh-CN').render(<App/>);`;
const vite=await createServer({configFile:false,root:process.cwd(),logLevel:'error',cacheDir:'node_modules/.vite-reasoning-slider',optimizeDeps:{force:true,exclude:['@opencraft/codex-composer','@opencraft/design-system-web/discrete-slider']},resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:0},plugins:[{name:'fixture',resolveId:id=>id==='/reasoning-slider.tsx'?id:null,load:id=>id==='/reasoning-slider.tsx'?source:null,configureServer(server){server.middlewares.use((req,res,next)=>{if(!req.url?.startsWith('/?'))return next();res.setHeader('content-type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/reasoning-slider.tsx"></script>');});}}]});
await mkdir('.local/reasoning-slider',{recursive:true});await vite.listen();
const browser=await chromium.launch({executablePath:process.env.OPENCRAFT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});const results=[];
try {
 for(const palette of ['codex','lavender']) for(const mode of ['light','dark']) for(const touch of [false,true]){
  const context=await browser.newContext({viewport:{width:touch?390:1280,height:844},hasTouch:touch,isMobile:touch,deviceScaleFactor:touch?2:1,reducedMotion:"reduce"});
  const page=await context.newPage(),errors:string[]=[];page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript('window.__name=v=>v');
  await page.goto(vite.resolvedUrls!.local[0]+'?mode='+mode+'&palette='+palette+(touch?'&touch':''));
  console.log('scene',palette,mode,touch);
  const editor=page.locator('.codex-composer-editor'),trigger=page.locator('.codex-composer-mode--intelligence'),menu=page.locator('.codex-composer-model-quick');
  try{await editor.fill('Keep this draft')}catch(e){console.log(errors,await page.locator('body').innerText());throw e};
  await editor.evaluate(el=>{(window as any).keptEditor=el;(window as any).blurs=0;el.addEventListener('blur',()=>{(window as any).blurs++});const r=document.createRange();r.setStart(el.firstChild!.firstChild!,3);r.collapse(true);const s=getSelection()!;s.removeAllRanges();s.addRange(r);});
  if(touch)await trigger.tap();else await trigger.click();await menu.waitFor();
  assert.equal(await page.locator('.codex-composer-selection-menu--intelligence').count(),0,'first layer has no model choices');
  const chooseModel=async(name:string)=>{
    await menu.locator('.codex-composer-model-quick__title').click();
    const sheet=page.getByRole('dialog');await sheet.waitFor();
    if(name==='Model 1'){
      assert.equal(await sheet.locator('.codex-composer-model-config__row').count(),2);
      await sheet.screenshot({path:'.local/reasoning-slider/sheet-full-'+palette+'-'+mode+'-'+touch+'.png'});
      await sheet.locator('.codex-composer-model-config__row').nth(1).click();
      assert.equal(await page.getByRole('menuitemradio').count(),2);
      await page.getByRole('menuitemradio',{name:'Fast',exact:true}).click();
      assert.equal(await page.evaluate(()=>(window as any).fixture.controller.getSnapshot().draft.selections.serviceTier),'fast');
      assert(await sheet.isVisible(),'choosing speed leaves configuration open');
      await sheet.locator('.codex-composer-model-config__row').nth(1).click();
      await page.getByRole('menuitemradio',{name:'标准',exact:true}).click();
      assert.equal(await page.evaluate(()=>(window as any).fixture.controller.getSnapshot().draft.selections.serviceTier),null,'Standard explicitly resets Fast');
      await sheet.locator('.codex-composer-model-config__row').nth(1).click();
      await page.getByRole('menuitemradio',{name:'Fast',exact:true}).click();
    }
    await sheet.screenshot({path:'.local/reasoning-slider/sheet-'+palette+'-'+mode+'-'+touch+'.png'});
    await sheet.locator('.codex-composer-model-config__row').first().click();
    await page.locator('.codex-composer-selection-menu--intelligence').waitFor();
    await page.screenshot({path:'.local/reasoning-slider/configure-'+palette+'-'+mode+'-'+touch+'.png'});

    await page.getByRole('menuitem',{name,exact:true}).click();
    await page.keyboard.press('Escape');
    if(name==='Model 1'){
      assert.equal(await sheet.locator('.codex-composer-model-config__row').count(),1,'unsupported models have no Speed control');
      assert.equal(await page.evaluate(()=>(window as any).fixture.controller.getSnapshot().draft.selections.serviceTier),null,'switching models clears incompatible Fast');
    }
    await sheet.locator('.codex-composer-model-config__done').click();
    if(touch)await trigger.tap();else await trigger.click();await menu.waitFor();
  };
  const slider=menu.getByRole('slider'),control=menu.locator('.ui-discrete-slider__control');
  await slider.waitFor();assert.equal(await slider.getAttribute('aria-valuemax'),'5');assert.equal(await slider.getAttribute('aria-valuetext'),'Medium');
  await page.evaluate(()=>document.fonts.ready);await control.screenshot();
  const rect=await control.boundingBox();assert(rect);assert(rect.height>=44,JSON.stringify(await control.evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),height:getComputedStyle(el).height,token:getComputedStyle(el).getPropertyValue("--height-discrete-slider-hit")}))));
  const geometry:unknown[]=[];
  const assertFillMeetsThumb=async()=>{
   // ResizeObserver delivers a remounted thumb size after layout; sample its next rendered frame.
   await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
   const sample=await control.evaluate(el=>{
    const range=el.querySelector('.ui-discrete-slider__range')!.getBoundingClientRect();
    const thumb=el.querySelector('.ui-discrete-slider__thumb')!.getBoundingClientRect();
    return {value:el.querySelector('[role=slider]')!.getAttribute('aria-valuetext'),fillEnd:range.right,thumbCenter:thumb.x+thumb.width/2,thumbWidth:thumb.width};
   });
   geometry.push(sample);
   assert(Math.abs(sample.fillEnd-sample.thumbCenter)<=0.5,'selected fill must reach the actual thumb center: '+JSON.stringify(sample));
  };
  await assertFillMeetsThumb();
  const committed=()=>page.evaluate(()=>(window as any).fixture.controller.getSnapshot().draft.selections.effort);
  // Drag through stops while held: label previews but no domain/default write.
  if(!touch){
   await page.mouse.move(rect.x+rect.width*.3,rect.y+rect.height/2);await page.mouse.down();
   for(const fraction of [.55,.95,.72]){await page.mouse.move(rect.x+rect.width*fraction,rect.y+rect.height/2,{steps:3});assert.equal(await committed(),undefined);assert.equal(await page.evaluate(()=>(window as any).fixture.remembered.length),0);await assertFillMeetsThumb();}
   await page.evaluate(()=>(window as any).fixture.rerender());
   await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('data-frame')==='1');
   assert.equal(await slider.getAttribute('aria-valuetext'),'Max','parent rerender retains held preview');
   await page.mouse.up();assert.equal(await committed(),'max');
  }else{
   const cdp=await context.newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+5,y:rect.y+rect.height/2}]});
   for(const fraction of [.4,.6,.95])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x+rect.width*fraction,y:rect.y+rect.height/2}]});
   assert.equal(await committed(),undefined);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await committed(),'ultra');
   assert(await editor.evaluate(el=>el===document.activeElement),'touch slider retains editing focus');
   assert.equal(await page.evaluate(()=>(window as any).blurs),0);
   assert.equal(await page.evaluate(()=>getSelection()?.anchorOffset),3);
   // Cancellation rolls back preview and does not persist another choice.
   const previous=await committed();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+5,y:rect.y+rect.height/2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await committed(),previous);
   await cdp.detach();
  }
  assert(await menu.isVisible(),'adjustment keeps menu open');
  // Native Radix keyboard handling remains in this control, not menu roving focus.
  await menu.locator('.codex-composer-model-quick__title').focus();await page.keyboard.press('ArrowDown');
  await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='slider');
  await page.keyboard.press('Home');assert.equal(await committed(),'low');
  await page.keyboard.press('ArrowRight');assert.equal(await committed(),'medium');
  await page.keyboard.press('End');assert.equal(await committed(),'ultra');
  await page.keyboard.press('ArrowLeft');assert.equal(await committed(),'max');
  assert(await slider.evaluate(el=>el===document.activeElement));
  for(const [position,effort] of ['low','medium','high','xhigh','max','ultra'].entries()){
   const r=await control.boundingBox();assert(r);const point={x:Math.max(2,Math.min(r.width-2,r.width*position/5)),y:r.height/2};
   if(touch)await control.tap({position:point});else await control.click({position:point});
   assert.equal(await committed(),effort);await assertFillMeetsThumb();
   await control.screenshot({path:'.local/reasoning-slider/'+palette+'-'+mode+'-'+(touch?'touch':'desktop')+'-'+effort+'.png'});
  }
  const metrics=await control.evaluate(el=>{const q=(s:string)=>getComputedStyle(el.querySelector(s)!);return {height:el.getBoundingClientRect().height,track:getComputedStyle(el.closest('.ui-discrete-slider__surface')!).backgroundColor,fill:q('.ui-discrete-slider__range').backgroundColor,thumb:q('.ui-discrete-slider__thumb').backgroundColor};});
  assert.notEqual(metrics.track,'rgba(0, 0, 0, 0)');assert.notEqual(metrics.fill,metrics.track);assert.notEqual(metrics.thumb,'rgba(0, 0, 0, 0)');
  await page.screenshot({path:'.local/reasoning-slider/'+palette+'-'+mode+'-'+(touch?'touch':'desktop')+'.png'});
  for(const [name,count] of [['Model 1',3],['Model 2',1],['Model 3',0]] as const){
   await chooseModel(name);
   if(!count)assert.equal(await slider.count(),0);else{assert.equal(await slider.getAttribute('aria-valuemax'),String(count-1));if(count===1){assert.equal(await control.getAttribute('aria-disabled'),'true');await assertFillMeetsThumb();}else{
     await slider.focus();await page.keyboard.press('Home');await assertFillMeetsThumb();
     for(let stop=1;stop<count;stop++){await page.keyboard.press('ArrowRight');await assertFillMeetsThumb();}
    }}
  }
  await chooseModel('Model 4');
  assert.equal(await committed(),undefined);assert.equal(await menu.locator('.ui-discrete-slider').getAttribute('data-unset'),'true');
  await control.screenshot();const r=await control.boundingBox();assert(r);
  if(touch)await control.tap({position:{x:2,y:r.height/2}});else await control.click({position:{x:2,y:r.height/2}});
  assert.equal(await committed(),'low','explicit first stop resolves an unset choice');
  await page.evaluate(()=>(window as any).fixture.controller.dispatch({type:'set-selections',patch:{effort:undefined}}));
  await slider.focus();await page.keyboard.press('Home');assert.equal(await committed(),'low');
  assert(await editor.evaluate(el=>el===(window as any).keptEditor));assert.equal(await editor.innerText(),'Keep this draft');
  await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});assert.deepEqual(errors,[]);
  results.push({palette,mode,touch,metrics,geometry});await context.close();
 }
 await writeFile('.local/reasoning-slider/results.json',JSON.stringify(results,null,2));console.log('PASS '+results.length+' real Composer slider scenes: held drag/commit, touch focus/selection, cancel, keys, dynamic 6/3/1/0 options, themes, per-stop fill/thumb geometry and draft.');
}finally{await browser.close();await vite.close();}
