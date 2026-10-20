import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {TasksService} from '../plugins/tasks/src/server';
import {TasksSqliteStore} from '../plugins/tasks/src/sqlite';
import {RESEARCH_HANDOFF_PREFIX} from '../plugins/tasks/src/research-handoff';
import {TASKS} from '@opencraft/appserver-protocol';
const output=process.env.OPENCRAFT_SMOKE_OUTPUT??'/tmp/morning-research-ui';await mkdir(output,{recursive:true});
const isolated=await mkdtemp(join(tmpdir(),'morning-overview-'));let timestamp=Date.now();const now=timestamp;
const service=new TasksService(join(isolated,'tasks.sqlite'),undefined,new TasksSqliteStore(join(isolated,'tasks.sqlite'),()=>timestamp));
function create(id:string,aiResearch='proactive',status:import('@opencraft/appserver-protocol').TaskStatus='backlog'){service.handle(TASKS.create,{id,title:id,description:'Evidence',status,projectServerId:null,projectId:null,aiResearch,aiResearchReason:aiResearch==='unassessed'?'':'Recorded basis: '+id})}
function handoff(id:string,hours:number,mode='proactive'){timestamp=now-hours*3600000;create(id,mode,'in_progress');service.handle(TASKS.progress,{taskId:id,eventId:'report-'+id,text:RESEARCH_HANDOFF_PREFIX+JSON.stringify({output:'Report with evidence: '+id,decision:'Approve option A? Recommendation: A',nextStep:'Design A after judgment'})});const task=service.handle(TASKS.read,{id}) as import('@opencraft/appserver-protocol').TaskDetail;service.handle(TASKS.move,{id,expectedRevision:task.revision,status:'in_review',beforeId:null})}
create('Queued research');create('Running research','proactive','in_progress');create('Context request','needs_context');create('Unassessed','unassessed');create('Triage decision','needs_decision','in_review');create('No handoff','proactive','in_review');
handoff('Oldest handoff',80);handoff('Overdue handoff',74,'needs_decision');handoff('Recent handoff',1);handoff('Hidden context handoff',100,'needs_context');handoff('Completed',100);let completed=service.handle(TASKS.read,{id:'Completed'}) as import('@opencraft/appserver-protocol').TaskDetail;service.handle(TASKS.move,{id:'Completed',expectedRevision:completed.revision,status:'done',beforeId:null});
timestamp=now;service.handle(TASKS.progress,{taskId:'Oldest handoff',eventId:'wording-update',text:'Wording update must not reset the clock'});
let failReads=false;let mutations=0;
const source=`
import React from 'react';import {createIntlTestRoot} from '/tests/fixtures/intl-root.tsx';
import {createTasksView} from '/plugins/tasks/src/view.tsx';
import {initializeAppearanceTheme} from '/apps/workbench-web/src/appearance-theme.ts';
import {AsyncNoticesProvider,useAsyncNotices} from '/apps/workbench-web/src/components/async-notices.tsx';
import '/apps/workbench-web/src/styles/app.scss';initializeAppearanceTheme();
const request=async(_,method,params)=>{const res=await fetch('/rpc',{method:'POST',body:JSON.stringify({method,params})});const result=await res.json();if(result.error)throw Object.assign(new Error(result.error.message),result.error);return result.value};
const ports={storageHostId:'local',request,listThreads:async()=>[],listProjects:async()=>[],readConversation:async()=>({title:'Linked conversation',state:'idle'}),subscribe:()=>()=>{}};
const View=createTasksView(ports,new AbortController().signal);
const host={platform:'web',activeHostId:'local',profiles:[{hostId:'local',hostKind:'local',displayName:'Local',enabled:true}],openView(){},pushViewResource(){},replaceViewResource(){},openConversation(){},provisionHost:async()=>{},removeHost:async()=>false};
function App(){const notices=useAsyncNotices();return <View host={host} contribution={{id:'tasks'}} activation={{viewId:'tasks',resourceUri:null}} reportError={notices.error}/>}
createIntlTestRoot(document.getElementById('root'),undefined,new URLSearchParams(location.search).get('locale')??'en-US').render(<AsyncNoticesProvider><App/></AsyncNoticesProvider>);`;
const vite=await createServer({configFile:false,root:process.cwd(),logLevel:'error',resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:0,hmr:false},plugins:[{name:'fixture',resolveId:id=>id==='/fixture.tsx'?id:null,load:id=>id==='/fixture.tsx'?source:null,configureServer(server){server.middlewares.use(async(req,res,next)=>{
if(req.url==='/rpc'){try{let body='';for await(const chunk of req)body+=chunk;const {method,params}=JSON.parse(body);if(failReads&&method===TASKS.events)throw new Error('Simulated unavailable authority');if(![TASKS.capabilities,TASKS.list,TASKS.read,TASKS.events,TASKS.event].includes(method))mutations++;res.setHeader('content-type','application/json');res.end(JSON.stringify({value:service.handle(method,params)}));}catch(e:any){res.setHeader('content-type','application/json');res.end(JSON.stringify({error:{code:e.code,message:'Request failed'}}));}return;}
if(req.url?.split('?')[0]!=='/')return next();res.setHeader('content-type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}</style><div id="root"></div><script type="module" src="/fixture.tsx"></script>');})}}]});
let browser:any;const checks=[];
try{await vite.listen();const {chromium}=await import('playwright');browser=await chromium.launch({headless:true});
for(const width of [1200,390,320])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:900}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({colorScheme:theme});await page.addInitScript('window.__name=v=>v;localStorage.setItem("vela.appearance-theme","system")');await page.goto('http://127.0.0.1:'+(vite.httpServer!.address() as any).port+'/?locale=zh-CN');await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
 const entry=page.getByRole('button',{name:'晨会总览',exact:true});await entry.waitFor();const headingBounds=await entry.boundingBox();assert.ok(headingBounds&&headingBounds.x>=0&&headingBounds.x+headingBounds.width<=width);await page.locator('[data-task-id="Queued research"]').waitFor({state:'attached'});await page.getByRole('searchbox',{name:'搜索任务…',exact:true}).fill('Queued');
 const before=await page.locator('[data-task-id="Queued research"]').elementHandle();
 await entry.click();await page.getByRole('region',{name:'产品核心数据',exact:true}).waitFor();assert.equal(await page.locator('.tasks-morning__metric').count(),4);assert.equal(await page.locator('.tasks-morning__metric-value').allTextContents().then(x=>x.join(',')),'待补充,待补充,待补充,待补充');
 await page.getByText('等待判断 80 小时',{exact:true}).waitFor();assert.equal(await page.locator('[data-morning-task-id]').count(),6);
 assert.deepEqual(await page.locator('.tasks-morning__item--overdue').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-morning-task-id'))),['Oldest handoff','Overdue handoff']);
 for(const id of ['Context request','Unassessed','Triage decision','Hidden context handoff','Completed'])assert.equal(await page.locator('[data-morning-task-id="'+id+'"]').count(),0);
 await page.getByText('尚无有效交接 · 未开始计时',{exact:true}).waitFor();assert.equal(await page.locator('[data-morning-back]').evaluate(el=>el===document.activeElement),true);
 const bounds=await page.locator('.tasks-morning').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,body:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(bounds.scroll<=bounds.width+1&&bounds.body<=bounds.viewport+1,JSON.stringify({width,theme,bounds}));
 const entryBox=await page.locator('[data-morning-back]').boundingBox();assert.ok(entryBox&&entryBox.x>=0);
 await page.screenshot({path:join(output,`${width}-${theme}.png`)});
 await page.getByRole('button',{name:'查看事项：Oldest handoff',exact:true}).click();const title=page.locator('.tasks-editor').getByRole('textbox',{name:'标题',exact:true});await title.fill('Retained morning draft');await page.getByRole('button',{name:'关闭任务详情',exact:true}).click();
 await page.getByRole('button',{name:'查看事项：Oldest handoff',exact:true}).click();assert.equal(await title.inputValue(),'Retained morning draft');await page.getByRole('button',{name:'关闭任务详情',exact:true}).click();

 await page.getByRole('button',{name:'返回任务',exact:true}).click();assert.equal(await page.getByRole('searchbox',{name:'搜索任务…',exact:true}).inputValue(),'Queued');assert.equal(await before!.evaluate(el=>el.isConnected),true);assert.equal(await entry.evaluate(el=>el===document.activeElement),true);
 if(width===1200&&theme==='light'){failReads=true;await entry.click();await page.getByText('部分交接记录暂不可用，超时统计尚不完整。',{exact:true}).waitFor();assert.equal(await page.locator('.tasks-morning__item--overdue').count(),0);failReads=false;await page.getByRole('button',{name:'重新核实',exact:true}).click();await page.getByText('等待判断 80 小时',{exact:true}).waitFor();}
 assert.deepEqual(errors,[]);checks.push({width,theme,passed:true});await page.close();
}
assert.equal(mutations,0);await writeFile(join(output,'result.json'),JSON.stringify({passed:true,checks,realReactAndSqlite:true,fixtureOnly:true,mutationsDuringBrowsing:mutations,paidInference:false},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser?.close();await vite.close();service.close();}
