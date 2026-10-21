import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
const {chromium}=await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE??"playwright");
const output=process.env.OPENCRAFT_SMOKE_OUTPUT??"/tmp/opencraft-usage-dashboard";
await mkdir(output,{recursive:true});
const locale=process.env.OPENCRAFT_USAGE_SMOKE_LOCALE??"zh-CN";
const source=`
import React from 'react';
import {createIntlTestRoot as createRoot} from '/tests/fixtures/intl-root.tsx';
import {TokenUsageDashboardView} from '/apps/workbench-web/src/components/token-usage-dashboard.tsx';
import {buildOpenCraftThemeCssProperties} from '/packages/design-system/src/theme-engine.ts';
import '/apps/workbench-web/src/styles/app.scss';
window.setTheme=theme=>{for(const [key,value] of Object.entries(buildOpenCraftThemeCssProperties(theme)))document.documentElement.style.setProperty(key,value);};window.setTheme('light');
window.calls=[];window.mode='ok';window.expanded=false;window.pageDelay=20;
const connection={hostId:'fixture',phase:'ready',error:null};
const port={getSnapshot:()=>({...connection}),subscribe:()=>()=>{},request:async(host,method,params)=>{
 window.calls.push(params);if(window.mode==='unauthorized')throw Object.assign(new Error('unauthorized'),{code:401});
 if(window.mode==='unsupported')throw Object.assign(new Error('unsupported'),{code:-32601});
 if(window.mode==='failed')throw new Error('offline');
 await new Promise(r=>setTimeout(r,window.pageDelay));
 const personal=params.scope!=='team';
 const tokens=personal?'1000':'2000';
 return {serverId:'fixture',canQueryTeam:true,scope:params.scope,actorId:personal?'A':null,asOf:Date.now(),snapshotRevision:3,timezone:'Asia/Shanghai',policyVersion:'equal-turn-v1',view:params.view,
 coverage:{enabled:true,enabledAt:Date.now()-100000,partial:false,openGaps:0,missingUsage:0,unknownModelTurns:0},summary:{tokens,allocatedTokens:tokens,turns:1,categories:{settled:tokens,provisional:'0',pending:'0',system:'0',unknown:'0'}},
 diagnostics:{since:Date.now(),counts:{collected:3,corrected:1,deduplicated:7,excluded:0,missing:0,reconciled:1,writeFailures:0,queryFailures:0},lastSourceSuccessAt:Date.now()-1000,lastReconcileAt:Date.now()-1000,writeLatency:{count:20,samples:20,p95Ms:1.2,maxMs:2},queryLatency:{count:2,samples:2,p95Ms:3.4,maxMs:4}},
 daily:[{key:params.from,tokens,turns:1}],models:[{key:'["provider","actual-model"]',tokens,turns:1}],
 rows:params.view==='turns'?[{threadId:'thread-fixture',turnId:'turn-fixture',startedAt:Date.now(),executionState:'completed',allocationState:'settled',rawTokens:'2000',allocatedTokens:tokens,participantCount:2,revision:3,models:[]}]:window.expanded?Array.from({length:30},(_,n)=>({key:(params.cursor?'thread-page2-':'thread-page1-')+n,tokens,turns:1})):[{key:params.view==='actors'?'A':'thread-fixture',tokens,turns:1}],nextCursor:window.expanded&&!params.cursor?'fixture-page2':null};
}};
createRoot(document.getElementById('root')).render(<div className="settings-page__viewport" data-layout="document"><div className="settings-page__content"><TokenUsageDashboardView hostId="fixture" agentRuntimes={port} locale={${JSON.stringify(locale)}}/></div></div>);`;
const vite=await createServer({configFile:false,root:process.cwd(),logLevel:"error",server:{host:"127.0.0.1",port:0},plugins:[{
 name:"usage-dashboard-smoke",resolveId:id=>id==="/probe.tsx"?id:null,load:id=>id==="/probe.tsx"?source:null,
 configureServer(server){server.middlewares.use((request,response,next)=>{if(request.url!=="/")return next();response.setHeader("content-type","text/html");response.end('<style>html,body,#root{height:100%;margin:0;overflow:hidden}</style><div id="root"></div><script type="module" src="/probe.tsx"></script>');});},
}]});
let browser:any;
try {
 await vite.listen();browser=await chromium.launch({headless:true,executablePath:process.env.OPENCRAFT_CHROMIUM_EXECUTABLE,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:1440,height:900}}), errors:string[]=[];
 page.on("pageerror",(error:Error)=>errors.push(error.message));
 await page.goto(vite.resolvedUrls!.local[0]!);
 await page.getByRole("heading",{name:locale==="en-US"?"My allocated usage":"我的分摊用量"}).waitFor();
 await page.getByRole("button",{name:"thread-fixture",exact:true}).click();
 await page.getByText("turn-fixture",{exact:true}).waitFor();
 await page.getByRole("button",{name:locale==="en-US"?"Back to summary":"返回汇总"}).click();
 await page.getByRole("button",{name:"thread-fixture",exact:true}).waitFor();
 await page.evaluate(()=>{(window as any).expanded=true;});
 await page.getByRole("button",{name:locale==="en-US"?"Refresh":"刷新",exact:true}).click();
 await page.getByRole("button",{name:"thread-page1-0",exact:true}).waitFor();
 const next=page.getByRole("button",{name:locale==="en-US"?"Next page":"下一页",exact:true});
 await next.focus();await page.keyboard.press("Enter");
 const row=page.getByRole("button",{name:"thread-page2-20",exact:true});
 await row.scrollIntoViewIfNeeded();await row.focus();
 const savedTop=await page.locator(".settings-page__viewport").evaluate((node:HTMLElement)=>node.scrollTop);
 assert.ok(savedTop>100,"fixture has a real scrolled Settings viewport");
 await page.evaluate(()=>{(window as any).pageDelay=500;});
 await page.keyboard.press("Enter");
 await page.waitForTimeout(100);
 const pendingGeometry=await page.locator(".settings-page__viewport").evaluate((node:HTMLElement)=>({top:node.scrollTop,height:node.scrollHeight,viewport:node.clientHeight,page:node.querySelector(".token-usage__page")?.getBoundingClientRect().height,busy:node.querySelector(".token-usage__page")?.getAttribute("aria-busy")}));
 assert.ok(Math.abs(pendingGeometry.top-savedTop)<=1,"pending drilldown preserves layout and scroll "+JSON.stringify({savedTop,...pendingGeometry}));
 const back=page.getByRole("button",{name:locale==="en-US"?"Back to summary":"返回汇总",exact:true});
 await back.waitFor();await back.focus();await page.keyboard.press("Enter");
 await row.waitFor();
 await page.waitForFunction(()=>document.activeElement?.getAttribute("data-usage-thread")==="thread-page2-20");
 assert.ok(Math.abs(await page.locator(".settings-page__viewport").evaluate((node:HTMLElement)=>node.scrollTop)-savedTop)<=1,"return restores summary scroll");
 assert.equal((await page.evaluate(()=>(window as any).calls.at(-1))).cursor,"fixture-page2","return restores summary page");
 await page.evaluate(()=>{(window as any).expanded=false;(window as any).pageDelay=20;});
 await page.getByRole("button",{name:locale==="en-US"?"First page":"回到第一页",exact:true}).click();
 await page.getByRole("button",{name:"thread-fixture",exact:true}).waitFor();
 const diagnostics=page.getByText(locale==="en-US"?"View runtime diagnostics":"查看运行诊断",{exact:true});
 await diagnostics.focus();await page.keyboard.press("Enter");
 await page.getByText(locale==="en-US"?"Deduplicated":"去重",{exact:true}).waitFor();
 for(const width of [320,390,1440])for(const theme of ["light","dark"]){
   await page.setViewportSize({width,height:900});await page.evaluate(theme=>(window as any).setTheme(theme),theme);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`horizontal overflow at ${width}/${theme}`);
   await page.screenshot({path:output+`/${width}-${theme}.png`,fullPage:true});
 }
 await page.getByLabel(locale==="en-US"?"Scope":"用量范围").selectOption("team");await page.getByRole("heading",{name:locale==="en-US"?"Team usage":"团队用量",exact:true}).waitFor();
 await page.evaluate(()=>{(window as any).mode="unauthorized";});await page.getByRole("button",{name:locale==="en-US"?"Refresh":"刷新",exact:true}).click();
 await page.getByText(locale==="en-US"?"Sign in to view usage.":"请登录后查看用量。",{exact:true}).waitFor();
 assert.equal(await page.getByRole("heading",{name:locale==="en-US"?"Team usage":"团队用量",exact:true}).count(),0,"revocation clears the previous user's snapshot");
 await page.evaluate(()=>{(window as any).mode="unsupported";});await page.getByRole("button",{name:locale==="en-US"?"Refresh":"刷新",exact:true}).click();
 await page.getByText(locale==="en-US"?"This Host does not support token statistics.":"此执行服务暂不支持 Token 统计。",{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,locale,realRenderer:true,syntheticQueryPort:true,widths:[320,390,1440],themes:["light","dark"],drilldown:true,keyboardDiagnostics:true,keyboardDrilldown:true,summaryCursorAndScrollRestored:true,pendingLayoutPreserved:true,revocationClearsData:true,unsupported:true,screenshots:output}));
}finally{await browser?.close();await vite.close();}
