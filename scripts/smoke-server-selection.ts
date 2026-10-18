import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from '@playwright/test';
import { selectorFixture, waitFor } from '../tests/fixtures/server-selector';
import { AppHostServer } from '../packages/app-host-server/src';

const output=resolve(process.env.OPENCRAFT_SELECTOR_SMOKE_DIRECTORY??'.local/server-selector');await mkdir(output,{recursive:true});
const errors:string[]=[],requests:string[]=[],sockets:string[]=[];
const fixture=await selectorFixture({legacyDefaultUsers:['alice'],entryName:'LightVela',webRoot:resolve(process.env.OPENCRAFT_SELECTOR_WEB_ROOT??'apps/workbench-web/dist'),appHost:()=>new AppHostServer({logicalClientRouting:true,createTransport(){
  const messages=new Set<(frame:string)=>void>(),statuses=new Set<(status:any)=>void>();
  return {status:{state:'idle'} as any,async connect(){this.status={state:'open'};for(const listener of statuses)listener(this.status);},async send(frame:string){
    const rpc=JSON.parse(frame);if(rpc.id===undefined)return;
    const result=rpc.method==='initialize'?{serverInfo:{name:'Isolated selector fixture'}}:rpc.method==='opencraft/codex/accounts/list'?{accounts:[]}:rpc.method==='thread/list'?{data:[],nextCursor:null}:rpc.method==='model/list'?{data:[],nextCursor:null}:rpc.method==='config/read'?{config:{},origins:{}}:{};
    for(const listener of messages)listener(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result,__opencraftClient:rpc.__opencraftClient}));
  },subscribeMessage(listener:any){messages.add(listener);return()=>messages.delete(listener);},subscribeStatus(listener:any){statuses.add(listener);return()=>statuses.delete(listener);},async close(){this.status={state:'closed'};}};
}})});
const browser=await chromium.launch({executablePath:process.env.OPENCRAFT_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--no-proxy-server','--host-resolver-rules=MAP *.selection.test 127.0.0.1']});
try{
  const context=await browser.newContext({extraHTTPHeaders:{'x-fixture-user':'alice'},locale:'zh-CN'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(new URL(r.url()).pathname));page.on('websocket',s=>sockets.push(new URL(s.url()).pathname));
  await page.goto(fixture.origin+'/__opencraft_servers');await page.waitForURL('**/servers');await page.getByRole('heading',{name:'选择服务器',exact:true}).waitFor();
  await page.goto(fixture.origin);await page.waitForURL('**/servers/join/**');await page.locator('[data-action-id]').first().waitFor({timeout:60_000});
  await page.goto(fixture.origin+'/servers');await page.getByRole('heading',{name:'选择服务器',exact:true}).waitFor();
  assert.equal(await page.locator('[data-server="join"]').innerText(),'LightVela');
  for(const width of [320,390,1280])for(const colorScheme of ['light','dark'] as const){await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme});await page.screenshot({path:join(output,`chooser-${width}-${colorScheme}.png`)});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await page.locator('[data-server="lighthouse"]').click();await page.waitForURL('**/servers/lighthouse/**');
  await page.locator('[data-action-id]').first().waitFor({timeout:60_000});
  await page.screenshot({path:join(output,'lighthouse-workbench.png')});
  await page.goto(fixture.origin+'/__opencraft_servers/lighthouse/');await page.waitForURL('**/servers/lighthouse/');await page.locator('[data-action-id]').first().waitFor();
  const cookieIsolation=await page.evaluate(async()=>{await fetch('/servers/lighthouse/fixture/stream').then(r=>r.text());return fetch('/servers/lighthouse/fixture/headers').then(r=>r.json());});assert.equal(cookieIsolation.cookie,'private-target=not-shared');
  const session=await page.evaluate(()=>fetch('/servers/lighthouse/__opencraft_access/session').then(r=>r.json()));assert.equal(session.role,'member');
  const dataScope=await page.evaluate(()=>indexedDB.databases().then(xs=>xs.map(x=>x.name)));assert.ok(dataScope.some(x=>x?.includes('server:lighthouse:')));
  await page.reload();await page.locator('[data-action-id]').first().waitFor();assert.match(page.url(),/\/lighthouse(?:\/|\?|$)/u);
  // Choosing Join in a second tab changes only future entry preference, never tab A's URL or requests.
  const other=await context.newPage();await other.goto(fixture.origin+'/servers');await other.locator('[data-server="join"]').click();await other.locator('[data-action-id]').first().waitFor();
  assert.match(page.url(),/\/lighthouse(?:\/|\?|$)/u);assert.match(other.url(),/\/join(?:\/|\?|$)/u);
  const joinRole=await other.evaluate(()=>fetch('/servers/join/__opencraft_access/session').then(r=>r.json()));assert.equal(joinRole.role,'admin');const otherCookies=await other.evaluate(()=>fetch('/servers/join/fixture/headers').then(r=>r.json()));assert.equal(otherCookies.cookie,null);
  await page.goto(fixture.origin);await page.waitForURL(url=>url.pathname.startsWith('/servers/join'));await page.locator('[data-action-id]').first().waitFor();
  // The real switch control always opens the chooser, even though a last choice exists.
  await page.getByRole('button',{name:/切换服务器|Switch server/u}).click();await page.getByRole('heading',{name:'选择服务器',exact:true}).waitFor();
  await page.locator('[data-server="lighthouse"]').click();await page.locator('[data-action-id]').first().waitFor();
  fixture.stores[1]!.set(fixture.principals.alice!,'member',false,'fixture-administrator');await page.goto(fixture.origin);await page.getByRole('heading',{name:'选择服务器',exact:true}).waitFor();
  assert.equal(await page.locator('[data-server="lighthouse"]').count(),0);assert.match(await page.locator('p').first().innerText(),/不可用/u);
  await page.goto(fixture.origin);await page.getByRole('heading',{name:'选择服务器',exact:true}).waitFor();
  assert.match(await page.locator('p').first().innerText(),/不可用/u);
  // Different verified identity in the same browser does not inherit Alice's saved choice.
  const logout=await page.evaluate(()=>fetch('/__opencraft_relay/logout',{method:'POST'}).then(r=>r.status));assert.equal(logout,204);
  await context.setExtraHTTPHeaders({'x-fixture-user':'bob'});await page.goto(fixture.origin);await page.getByRole('heading',{name:'选择服务器',exact:true}).waitFor();
  assert.equal(await page.locator('[data-server="join"]').count(),1);assert.equal(await page.locator('[data-server="lighthouse"]').count(),0);
  const escaped=requests.filter(path=>/^(?:\/assets\/|\/apphost|\/appserver|\/__opencraft_access|\/__opencraft_enterprise_identity|\/__opencraft_ssh|\/__opencraft_updates|\/opencraft-icon\.svg)/u.test(path));assert.deepEqual(escaped,[],'business requests and assets stay under the selected target');
  assert.ok(sockets.some(x=>x.startsWith('/servers/lighthouse/apphost')));assert.ok(sockets.some(x=>x.startsWith('/servers/join/apphost')));
  await page.locator('[data-server="join"]').click();await page.locator('[data-action-id]').first().waitFor();
  fixture.clients[0]!.close();await waitFor(()=>!fixture.relay.connected('join'));
  await page.goto(fixture.origin);await page.getByRole('heading',{name:'选择服务器',exact:true}).waitFor();
  assert.equal(await page.locator('[data-server]').count(),0);assert.match(await page.locator('p').first().innerText(),/不可用/u);
  // A new browser for an existing identity still gets its migration default.
  // With that target offline it stays at the chooser, despite another admitted server.
  fixture.stores[1]!.set(fixture.principals.alice!,'member',true,'fixture-administrator');
  const fresh=await browser.newContext({extraHTTPHeaders:{'x-fixture-user':'alice'}}),freshPage=await fresh.newPage();
  await freshPage.goto(fixture.origin);await freshPage.getByRole('heading',{name:'选择服务器',exact:true}).waitFor();
  assert.equal(await freshPage.locator('[data-server="lighthouse"]').count(),1);
  assert.match(await freshPage.locator('p').first().innerText(),/不可用/u);await fresh.close();
  assert.deepEqual(errors,[]);
  await writeFile(join(output,'receipt.json'),JSON.stringify({actualBuiltWorkbench:true,existingUserDefault:true,defaultNeverOverridesChoice:true,newIdentityShowsChooser:true,unavailableDefaultNeverFallsBack:true,realRelayCoreMembership:true,rememberedChoice:true,multiTabIsolation:true,independentTargetRoles:true,revocationReturnsChooser:true,identitySwitchDoesNotReuseChoice:true,offlineReturnsChooser:true,dataScope,sockets,escaped,errors,boundary:'Synthetic verified identity and Codex transport only; actual packaged Workbench, Chromium, relay tunnel and target membership. No production IOA employee or model inference.'},null,2));
  console.log(JSON.stringify({output,success:true}));
} catch(error){await writeFile(join(output,'failure.json'),JSON.stringify({error:String(error),errors,requests,sockets},null,2));throw error;}
finally{await browser.close();await fixture.close();}
