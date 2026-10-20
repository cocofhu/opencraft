import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import { WebSocketServer } from "ws";
const { chromium } = await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE ?? "playwright");
const output = await mkdtemp("/tmp/opencraft-scheduled-tasks-page-");
const counts: Record<string, number> = {};
const stamp = Date.now() + 3_600_000;
let paused = false, failList = false;
const source = `
import React from 'react';
import {createIntlTestRoot} from '/tests/fixtures/intl-root.tsx';
import {createWebWorkbenchApplication,WorkbenchRoot} from '/apps/workbench-web/src/workbench-root.tsx';
import {initializeAppearanceTheme,setThemePreference} from '/apps/workbench-web/src/appearance-theme.ts';
import {createSmokeClientProduct} from '/tests/fixtures/client-product.ts';
import '/apps/workbench-web/src/styles/app.scss';
initializeAppearanceTheme();
const config=document.createElement('script');config.id='opencraft-deployment-config';config.type='application/json';config.textContent=JSON.stringify({hosts:[{hostId:'fixture-host',label:'Codex Fixture',kind:'remote-ssh',url:location.origin.replace('http','ws')+'/fixture-rpc'}],builtinAgents:false,hypernode:false});document.head.append(config);
const application=await createWebWorkbenchApplication({hostProfileMode:'configured',navigationMode:'memory',clientProduct:createSmokeClientProduct()});
const supervisor=application.supervisor;
await supervisor.extensions.activate({manifest:{manifestVersion:1,id:'example.plugins',name:'Plugins fixture',version:'1.0.0',apiVersion:1,trust:'trusted',platforms:['web'],activationEvents:['onStartupFinished']},activate(api){api.views.register({id:'example.plugins.view',title:'Plugins',viewType:'example.plugins'});api.settings.registerPage({id:'example.plugins',title:'Plugins',viewId:'example.plugins.view',icon:'plug',order:303,management:{familyId:'example.plugins',scope:'host',entryPoint:'workbench'}});api.internal.register('platformViewRenderer',{viewType:'example.plugins',Component:()=>React.createElement('div',null,'Plugins')});}});
await supervisor.registry.ensureConnected('fixture-host');
const nav=supervisor.navigation;nav.openSettings('opencraft.schedules');
createIntlTestRoot(document.getElementById('app'),undefined,'zh-CN').render(<WorkbenchRoot application={application}/>);
window.proof={route:()=>nav.getSnapshot().applicationRoute,open:()=>nav.openSettings('opencraft.schedules'),back:()=>nav.back(),forward:()=>nav.forward(),theme:setThemePreference,registry:supervisor.registry};document.body.dataset.ready='true';
`;
const vite = await createServer({ configFile: false, root: process.cwd(), cacheDir: output + "/vite", logLevel: "error",
  define: { 'process.env.NEXT_PUBLIC_REGION': '"cn"', 'process.env.NEXT_PUBLIC_PREVIEW_LOCALES':'""', 'import.meta.env.VITE_INCLUDE_HYPERNODE_PLUGIN':'"false"','import.meta.env.VITE_INCLUDE_BUILTIN_AGENTS_PLUGIN':'"false"' },
  esbuild: { jsx: "automatic" }, resolve: { dedupe: ["react", "react-dom"] }, server: { host: "127.0.0.1", port: 0, hmr: false },
  plugins: [{ name: "schedule-catalog-proof", resolveId: id => id === "/proof.tsx" ? id : null, load: id => id === "/proof.tsx" ? source : null,
    configureServer(server) { server.middlewares.use((req, res, next) => { if (req.url !== "/") return next(); res.setHeader("content-type", "text/html");res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script type="module" src="/proof.tsx"></script>'); }); } }] });
const ws = new WebSocketServer({ noServer: true });
const thread = { id: "scheduled-thread", name: "Synthetic scheduled conversation", preview: "Catalog fixture", cwd: "/synthetic", createdAt: 1, updatedAt: 1, historyMode: "legacy", status: { type: "idle" }, turns: [] };
function summaries() { return [{ threadId: thread.id, status: paused ? "paused" : "active", nextRunAt: stamp, needsReview: false }, { threadId: "not-paginated", status: "paused", nextRunAt: stamp + 1, needsReview: false }]; }
const plan = () => ({ id: "schedule", threadId: thread.id, prompt: "Synthetic prompt", nextRunAt: stamp, intervalMinutes: 60, timeZone: "UTC", status: paused ? "paused" : "active", revision: paused ? 2 : 1, createdBy: null, updatedAt: 1 });
ws.on("connection", socket => socket.on("message", raw => {
  const { id, method, params } = JSON.parse(String(raw)); if (id == null) return;
  counts[method] = (counts[method] ?? 0) + 1;
  let result: unknown = {};
  if (method === "initialize") result = { serverInfo: { name: "fixture", version: "1" }, capabilities: { extensions: { "opencraft/conversation-schedules": { version: 1, summary: true } } } };
  else if (method === "thread/list") result = { data: [thread], nextCursor: null };
  else if (method === "thread/read" || method === "thread/resume") result = { thread };
  else if (method === "thread/loaded/list") result = { data: [] };
  else if (method === "thread/items/list" || method === "thread/turns/list") result = { data: [], nextCursor: null };
  else if (method === "model/list" || method === "project/list" || method === "skills/list" || method === "permissionProfile/list") result = { data: [] };
  else if (method === "account/read") result = { account: null, requiresOpenaiAuth: false };
  else if (method === "config/read") result = { config: {}, origins: {}, layers: [] };
  else if (method === "opencraft/schedules/list") {
    if (failList) { socket.send(JSON.stringify({ id, error: { code: -32000, message: "Synthetic unavailable" } })); return; }
    result = { schedules: summaries() };
  } else if (method === "opencraft/schedules/read") result = { schedule: plan(), runs: [] };
  else if (method === "opencraft/schedules/action") { assert.equal(params.action, "pause"); paused = true; result = { schedule: plan(), runs: [] }; for (const client of ws.clients) client.send(JSON.stringify({ method: "opencraft/schedules/changed", params: {} })); }
  socket.send(JSON.stringify({ id, result }));
}));
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await vite.listen(); vite.httpServer!.on("upgrade", (request, socket, head) => { if (request.url === "/fixture-rpc") ws.handleUpgrade(request, socket, head, connection => ws.emit("connection", connection, request)); });
  const url = vite.resolvedUrls!.local[0]!;
  browser = await chromium.launch({ headless: true, executablePath: process.env.OPENCRAFT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors: string[] = [];
  page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
  await page.goto(url); await page.locator('body[data-ready="true"]').waitFor({ timeout: 90_000 });
  const catalog = page.locator(".scheduled-tasks-page"); await catalog.getByText(thread.name, { exact: true }).waitFor();
  assert.equal(await catalog.locator(".settings-control-list-item").count(), 2, "task without paginated thread metadata remains visible");
  assert.equal(counts["opencraft/schedules/read"] ?? 0, 0, "catalog has no per-row schedule reads");
  const ids = await page.locator('.shell-sidebar-navigation [data-action-id]').evaluateAll(elements => elements.map(el => el.getAttribute("data-action-id")));
  assert.ok(ids.indexOf("opencraft.schedules") === ids.indexOf("example.plugins") + 1, JSON.stringify(ids));
  await catalog.getByRole("button", { name: "管理", exact: true }).first().click();
  const dialog = page.getByRole("dialog"); await dialog.getByText("Synthetic prompt", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "暂停", exact: true }).click(); await dialog.getByText("已暂停", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "完成", exact: true }).click(); await dialog.waitFor({ state: "detached" });
  assert.equal(counts["opencraft/schedules/action"], 1);
  await catalog.getByText("已暂停", { exact: true }).first().waitFor();
  await catalog.getByRole("button", { name: "打开会话", exact: true }).first().click();
  await page.waitForFunction(() => (window as any).proof.route().kind === "conversation");
  await page.evaluate(() => (window as any).proof.back());
  await catalog.getByText(thread.name, { exact: true }).waitFor();
  assert.equal(await page.getByRole("dialog").count(), 0, "back restores the catalog route without a modal");
  const beforeFailure = await catalog.locator(".settings-control-group").boundingBox();
  failList = true; for (const client of ws.clients) client.send(JSON.stringify({ method: "opencraft/schedules/changed", params: {} }));
  await page.getByText("无法刷新定时任务。", { exact: true }).first().waitFor();
  assert.equal(await catalog.locator(".settings-control-list-item").count(), 2, "refresh failure preserves known tasks");
  assert.equal(await catalog.getByText("无法刷新定时任务。", { exact: true }).count(), 0, "error is delivered by Toast outside the catalog");
  const afterFailure = await catalog.locator(".settings-control-group").boundingBox();
  assert.deepEqual(afterFailure, beforeFailure, "error Toast does not shift catalog geometry");
  failList = false; await catalog.getByRole("button", { name: "刷新", exact: true }).click();
  await catalog.getByRole("button", { name: "管理", exact: true }).first().waitFor();
  const closeToast = page.locator('.workbench-notices button[data-close-button]'); if (await closeToast.count()) await closeToast.first().click();
  const evidence = [];
  for (const theme of ["light", "dark"]) for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 920 }); await page.evaluate(theme => (window as any).proof.theme(theme), theme);
    await page.waitForTimeout(150);
    const geometry = await catalog.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, page: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(geometry.scroll <= geometry.width + 1, JSON.stringify(geometry)); assert.ok(geometry.page <= geometry.viewport + 1);
    await page.screenshot({ path: `${output}/${theme}-${width}.png` }); evidence.push({ theme, width, geometry });
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/result.json`, JSON.stringify({ evidence, counts, errors }, null, 2));
  console.log(JSON.stringify({ output, scenarios: evidence.length, counts, passed: true }));
} finally { await browser?.close(); for (const client of ws.clients) client.terminate(); ws.close(); await vite.close(); }
