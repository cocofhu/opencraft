import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { AppHostServer } from '../packages/app-host-server/src/index';
import { createWorkbenchWebServer } from './serve-workbench-web.mjs';
import { createWorkbenchWebServer as createStaticWorker } from './workbench-web-server.mjs';
import { createHeadlessBackendProxy } from './web-deployment/headless-backend.mjs';

// Full built Application: a Conversation-only fixture misses a parent hiding
// valid display data behind a network-backed lease. Both smoke and gate use it.
const root = resolve(process.env.OPENCRAFT_COLD_OPEN_WEB_ROOT ?? 'apps/workbench-web/dist');
const output = resolve(process.env.OPENCRAFT_COLD_OPEN_EVIDENCE ?? '.local/session-cold-open');
const samples = Number(process.env.OPENCRAFT_COLD_OPEN_SAMPLES ?? 1);
assert.ok(Number.isSafeInteger(samples) && samples >= 1 && samples <= 100);
const timing = samples >= 10;
const version = JSON.parse(await readFile(join(root, 'version.json'), 'utf8'));
assert.equal(version.headlessServer, true, 'Build the Headless Web profile');
await mkdir(output, { recursive: true });
const threadId='cold-open-fixture',question='Previously seen question',cachedAnswer='Previously seen answer',restoredAnswer='Fresh authoritative answer';
const thread={id:threadId,name:'Cold open fixture',preview:question,cwd:'/fixture',path:null,historyMode:'paginated',modelProvider:'openai',createdAt:1,updatedAt:1,status:{type:'idle'},source:'appServer',turns:[]};
let hold=false,fresh=false;
let heldArrived: (() => void) | undefined;
const held:Array<()=>void>=[],requests:string[]=[],mutations:string[]=[];
const release=()=>{hold=false;for(const deliver of held.splice(0))deliver()};
const appHost=new AppHostServer({logicalClientRouting:true,createTransport(){
 let status:any={state:'idle'};
 const messages=new Set<(frame:string)=>void>(),statuses=new Set<(value:any)=>void>();
 return {get status(){return status},async connect(){status={state:'open'};for(const listener of statuses)listener(status)},
  subscribeMessage(listener){messages.add(listener);return()=>{messages.delete(listener)}},subscribeStatus(listener){statuses.add(listener);return()=>{statuses.delete(listener)}},
  async send(frame){
   const rpc=JSON.parse(frame);if(rpc.id===undefined)return;requests.push(rpc.method);
   let result:unknown,error:unknown;
   const turn={id:'fixture-turn',status:'completed',error:null,itemsView:'full',items:[
    {type:'userMessage',id:'fixture-question',content:[{type:'text',text:question,textElements:[]}]},
    {type:'agentMessage',id:'fixture-answer',text:fresh?restoredAnswer:cachedAnswer,phase:'final_answer'}]};
   switch(rpc.method){
    case 'initialize':result={userAgent:'cold-open-fixture',codexHome:'/fixture',platformFamily:'unix',platformOs:'linux',capabilities:{extensions:{'opencraft/resume-history':{version:1,mode:'paginated',initialTurnsPage:true}}}};break;
    case 'thread/list':result={data:[thread],nextCursor:null};break;
    case 'thread/read':result={thread};break;
    case 'thread/resume':result={thread,model:'fixture-model',modelProvider:'openai',cwd:'/fixture',runtimeWorkspaceRoots:['/fixture'],approvalPolicy:'on-request',approvalsReviewer:'user',sandbox:{type:'readOnly'},initialTurnsPage:{data:[turn],nextCursor:null}};break;
    case 'thread/turns/list':result={data:[turn],nextCursor:null};break;
    case 'thread/items/list':result={data:turn.items.map(item=>({turnId:turn.id,item})),nextCursor:null};break;
    case 'thread/loaded/list':result={data:[threadId]};break;
    case 'model/list':case 'permissionProfile/list':case 'thread/queue/list':result={data:[],nextCursor:null};break;
    case 'config/read':result={config:{},origins:{}};break;
    case 'skills/list':result={data:[]};break;
    default:
     if(/^(?:turn\/|thread\/(?:start|fork)|.*\/(?:set|write|create|delete)$)/.test(rpc.method))mutations.push(rpc.method);
     error={code:-32601,message:'Read-only fixture operation unavailable'};
   }
   const reply=JSON.stringify({id:rpc.id,...(error?{error}:{result}),__opencraftClient:rpc.__opencraftClient});
   const deliver=()=>{for(const listener of messages)listener(reply)};
   if(hold&&rpc.method==='initialize') { held.push(deliver); heldArrived?.(); } else { await new Promise(resolve => setTimeout(resolve, 40)); deliver(); }
  },async close(){status={state:'closed'};for(const listener of statuses)listener(status)}};
}});

const backend = await createWorkbenchWebServer({ root, appHostServer: appHost, appServerTarget: null, loopbackOnly: true });
const backendAddress = await backend.listen({ host: '127.0.0.1', port: 0 });
const backendTarget = `http://127.0.0.1:${backendAddress.port}`;
// Serve the production compressed assets, proxying the isolated AppHost only.
const web = await createStaticWorker({ root, appServerTarget: null, headlessServer: true, headlessBackendTarget: backendTarget });
web.server.removeAllListeners('upgrade');
const proxy = createHeadlessBackendProxy(backendTarget)!;
web.server.on('upgrade', (request, socket, head) => proxy.upgrade(request, socket, head, () => {}, new Set()));
const address = await web.listen({ host: '127.0.0.1', port: 0 });
const url = `http://127.0.0.1:${address.port}/local/${threadId}?hostId=local-codex`;
const browser = await chromium.launch({ executablePath: process.env.OPENCRAFT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
const results: unknown[] = [], evidence: unknown[] = [];
let activePage: Page | undefined;

async function openPage(width: number, cpuRate: number, storageState?: Awaited<ReturnType<BrowserContext['storageState']>>) {
  const context = await browser.newContext({ viewport: { width, height: 850 }, hasTouch: width === 390, storageState });
  const page = await context.newPage(); activePage = page;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  // A new browser context has no HTTP cache. Only persisted display state can
  // be carried across navigation; time starts at navigation, before bootstrap.
  await page.addInitScript('window.__name = value => value');
  await page.addInitScript(({ cachedAnswer, restoredAnswer }) => {
    const metrics: { firstPaintMs?: number } = {};
    (window as any).coldOpenMetrics = metrics;
    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled) return;
      const frames = [...document.querySelectorAll('.thread-frame')];
      if (!frames.some(frame => frame.textContent?.includes(cachedAnswer) || frame.textContent?.includes(restoredAnswer))) return;
      scheduled = true;
      requestAnimationFrame(() => { metrics.firstPaintMs = performance.now(); });
    }).observe(document, { childList: true, subtree: true, characterData: true });
  }, { cachedAnswer, restoredAnswer });
  return { context, page, errors };
}
async function firstPaint(page: Page) {
  await page.waitForFunction(() => (window as any).coldOpenMetrics?.firstPaintMs !== undefined);
  return page.evaluate(() => ({ firstPaintMs: (window as any).coldOpenMetrics.firstPaintMs as number }));
}
async function waitForHeldInitialize() {
  if (held.length) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { heldArrived = undefined; reject(new Error('No held initialize request arrived')); }, 5000);
    heldArrived = () => { clearTimeout(timer); heldArrived = undefined; resolve(); };
  });
}
try {
  for (const { id, width, cpuRate } of [{ id: 'desktop', width: 1100, cpuRate: 1 }, { id: 'narrow', width: 390, cpuRate: 4 }]) {
    const coldSamples: unknown[] = [], cachedSamples: unknown[] = [];
    for (let n = 0; n < samples + (timing ? 1 : 0); n++) {
      release(); fresh = false;
      const cold = await openPage(width, cpuRate);
      await cold.page.goto(url, { waitUntil: 'domcontentloaded' });
      await cold.page.getByText(cachedAnswer, { exact: true }).waitFor();
      const coldMetric = await firstPaint(cold.page);
      await cold.page.waitForFunction(() => Object.keys(localStorage).some(key => key.startsWith('opencraft.display.') && localStorage.getItem(key)?.includes('Previously seen answer')));
      const state = await cold.context.storageState();
      assert.deepEqual(cold.errors, []);
      await cold.context.close();
      // New context: cold resources, with an actually persisted display cache.
      hold = true; fresh = true;
      const cached = await openPage(width, cpuRate, state);
      const requestStart = requests.length;
      await cached.page.goto(url, { waitUntil: 'domcontentloaded' });
      await cached.page.getByText(cachedAnswer, { exact: true }).waitFor({ timeout: 5000 });
      const cachedMetric = await firstPaint(cached.page);
      await waitForHeldInitialize();
      assert.equal(requests.slice(requestStart).includes('thread/resume'), false, 'Cached paint cannot resume or authorize execution');
      assert.equal(await cached.page.locator('.conversation-recovery-cold-stage').count(), 0);
      const editor = cached.page.locator('[contenteditable="true"]').first();
      await editor.fill('Keep this unsent draft');
      if (n === (timing ? 1 : 0)) await cached.page.screenshot({ path: join(output, `cached-before-connect-${width}.png`) });
      release();
      await cached.page.getByText(restoredAnswer, { exact: true }).waitFor();
      assert.equal(await editor.innerText(), 'Keep this unsent draft', 'Canonical restoration preserves the unsent draft');
      assert.equal(await cached.page.getByText(cachedAnswer, { exact: true }).count(), 0, 'Canonical history replaces old display');
      assert.deepEqual(cached.errors, []);
      await cached.context.close();
      if (!timing || n > 0) { coldSamples.push(coldMetric); cachedSamples.push(cachedMetric); }
    }
    // With no local display, a held connection must still show cold recovery.
    hold = true;
    const isolated = await openPage(width, cpuRate);
    await isolated.page.goto(url, { waitUntil: 'domcontentloaded' });
    await isolated.page.locator('.local-conversation-page').waitFor();
    await waitForHeldInitialize();
    assert.equal(await isolated.page.getByText(cachedAnswer, { exact: true }).count(), 0);
    assert.equal(await isolated.page.getByText(restoredAnswer, { exact: true }).count(), 0);
    assert.equal(await isolated.page.locator('.conversation-recovery-cold-stage').count(), 1);
    release(); await isolated.page.getByText(restoredAnswer, { exact: true }).waitFor();
    assert.deepEqual(isolated.errors, []); await isolated.context.close();
    results.push({ width, cpuRate, cacheBeforeConnection: true, baselineStillRequired: true, canonicalReplacement: true, draftPreserved: true, isolatedProfile: true });
    evidence.push({ id: `session-navigation-cold-${id}`, samples: coldSamples }, { id: `session-navigation-cached-${id}`, samples: cachedSamples });
  }
  assert.deepEqual(mutations, []);
  await writeFile(join(output, 'receipt.json'), JSON.stringify({ workloadVersion: 2, browser: browser.version(), build: version, results, mutations, evidence,
    boundary: 'Built Application and compressed static worker, isolated identity/protocol. Navigation through first history DOM plus next animation frame. Cached context retains display storage only; initialize remains held until cache is visible. Synthetic fixture excludes real network/login/model and is not a population p95.' }, null, 2));
  console.log(JSON.stringify({ success: true, results }));
} catch (error) {
  await activePage?.screenshot({ path: join(output, 'failure.png') }).catch(() => {});
  throw error;
} finally { release(); await browser.close(); await web.close(); await backend.close(); await appHost.close(); }
