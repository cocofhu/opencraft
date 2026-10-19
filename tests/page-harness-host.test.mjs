import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PagePreview,
  PreviewManager,
  StaticServer,
  appendNote,
  createPageHarnessHost,
  createSettingsStore,
  detectDevServers,
  readNotes,
  resolveCli,
} from "../packages/page-harness-host/src/host.mjs";
import {
  MIXED_CONTENT_MESSAGE,
  PAGE_HARNESS_DYNAMIC_TOOLS,
  PAGE_HARNESS_SYSTEM_PROMPT,
  appendPreviewQuote,
  classifyTurn,
  previewFrame,
  previewSurface,
  renderNotes,
  renderPreview,
  sameOrigin,
} from "../packages/page-harness-host/src/shared.mjs";

const cliPath = fileURLToPath(new URL("./fixtures/page-harness-fake-cli.mjs", import.meta.url));
const config = { previewPort: 27994, cliPath };
const tmp = () => mkdtempSync(path.join(os.tmpdir(), "ph-oc-"));
const cleanup = [];

test.afterEach(async () => {
  while (cleanup.length) await cleanup.pop()();
});

test("static server stays inside the workspace and refuses symlinks that leave it", async () => {
  const root = tmp();
  mkdirSync(path.join(root, "sub dir"));
  writeFileSync(path.join(root, "index.html"), "<h1>home</h1>");
  writeFileSync(path.join(root, "sub dir", "index.html"), "<h1>sub</h1>");
  const files = new StaticServer();
  cleanup.push(() => files.close());
  const origin = await files.serve(root);
  assert.equal(await (await fetch(origin + "/")).text(), "<h1>home</h1>");
  assert.equal((await fetch(origin + "/%2e%2e/%2e%2e/etc/passwd")).status, 404);
  const outside = tmp();
  writeFileSync(path.join(outside, "secret.txt"), "nope");
  symlinkSync(path.join(outside, "secret.txt"), path.join(root, "link.txt"));
  assert.equal((await fetch(origin + "/link.txt")).status, 404);
});

test("preview waits for an embed origin, serves workspace files, and reuses the same target", async () => {
  const cwd = tmp();
  writeFileSync(path.join(cwd, "index.html"), "x");
  const calls = [];
  const manager = new PreviewManager({ spawn: (cmd, args, opts) => (calls.push(args), spawn(cmd, args, opts)) });
  const preview = new PagePreview({ manager });
  cleanup.push(() => preview.dispose());
  const waiting = await preview.open({ path: "index.html", cwd }, config);
  assert.equal(waiting.waitingForPage, true);
  assert.equal(waiting.running, false);
  assert.equal(calls.length, 0);
  preview.setEmbedOrigin("http://127.0.0.1:4173");
  const opened = await preview.open(null, config);
  assert.equal(opened.running, true);
  assert.equal(opened.page, "/index.html");
  assert.equal(opened.label, "index.html");
  const args = calls[0];
  assert.equal(args[args.indexOf("--host") + 1], "127.0.0.1");
  assert.equal(args[args.indexOf("--embed-origin") + 1], "http://127.0.0.1:4173");
  assert.ok(args.includes("--no-agent"));
  assert.equal(args.includes("--share"), false);
  const again = await preview.open({ path: "index.html", cwd }, config);
  assert.equal(again.pid, opened.pid);
  assert.equal(again.rev, 2);
  assert.equal(calls.length, 1);
});

test("a non-loopback workbench listens on all interfaces and keeps the embed token out of logs", async () => {
  const cwd = tmp();
  writeFileSync(path.join(cwd, "index.html"), "x");
  const calls = [];
  const logs = [];
  const originals = ["log", "info", "warn", "error"].map((method) => [method, console[method]]);
  for (const [method] of originals) console[method] = (...parts) => logs.push(parts.join(" "));
  try {
    const manager = new PreviewManager({ spawn: (cmd, args, opts) => (calls.push(args), spawn(cmd, args, opts)) });
    const preview = new PagePreview({ manager });
    cleanup.push(() => preview.dispose());
    preview.setEmbedOrigin("http://21.130.250.101:3080");
    const status = await preview.open({ path: "index.html", cwd }, config);
    const args = calls[0];
    assert.equal(args[args.indexOf("--host") + 1], "0.0.0.0");
    assert.equal(args[args.indexOf("--public-host") + 1], "21.130.250.101");
    assert.equal(status.embedToken, "embed-secret-token");
    assert.equal(logs.some((line) => line.includes("embed-secret-token")), false);
  } finally {
    for (const [method, original] of originals) console[method] = original;
  }
});

test("rejects files outside the workspace, public URLs, and dead dev servers", async () => {
  const cwd = tmp();
  const outside = tmp();
  writeFileSync(path.join(outside, "index.html"), "x");
  writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
  const preview = new PagePreview({ probe: async () => ({ ok: false }) });
  cleanup.push(() => preview.dispose());
  preview.setEmbedOrigin("http://127.0.0.1:4173");
  await assert.rejects(preview.open({ path: path.join(outside, "index.html"), cwd }, config), /outside the workspace/);
  await assert.rejects(preview.open({ url: "http://169.254.169.254/", cwd }, config), /private-network/);
  await assert.rejects(preview.open({ url: "https://example.com/", cwd }, config), /private-network/);
  await assert.rejects(preview.open({ url: "5173", cwd }, config), /npm run dev -- --host 127\.0\.0\.1 --port 5173/);
  await assert.rejects(preview.open({ url: "5173", cwd }, config), /不要自己运行 page-harness/);
});

test("a static site is served locally when the requested URL is down", async () => {
  const cwd = tmp();
  writeFileSync(path.join(cwd, "index.html"), "x");
  const calls = [];
  const manager = new PreviewManager({ spawn: (cmd, args, opts) => (calls.push(args), spawn(cmd, args, opts)) });
  const preview = new PagePreview({ manager, probe: async () => ({ ok: false }) });
  cleanup.push(() => preview.dispose());
  preview.setEmbedOrigin("http://127.0.0.1:4173");
  const status = await preview.open({ url: "http://127.0.0.1:8000/index.html", cwd }, config);
  assert.equal(status.running, true);
  assert.match(calls[0][1], /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.doesNotMatch(calls[0][1], /:8000/);
});

test("a busy preview port is retried once on the next pair", async () => {
  const cwd = tmp();
  let n = 0;
  const manager = new PreviewManager({
    spawn: (cmd, args, opts) => {
      n += 1;
      return spawn(cmd, args, { ...opts, env: { ...process.env, FAKE_MODE: n === 1 ? "crash" : "ready" } });
    },
  });
  cleanup.push(() => manager.dispose());
  const status = await manager.start({ target: "http://127.0.0.1:5173/", project: cwd, port: 27990, host: "127.0.0.1", cliPath, embedOrigins: ["http://127.0.0.1:4173"] });
  assert.equal(n, 2);
  assert.equal(status.port, 27992);
  assert.equal(status.running, true);
});

test("stopping the preview and disposing the host kills the child", async () => {
  const cwd = tmp();
  writeFileSync(path.join(cwd, "index.html"), "x");
  const preview = new PagePreview();
  preview.setEmbedOrigin("http://127.0.0.1:4173");
  const status = await preview.open({ path: "index.html", cwd }, config);
  assert.equal(status.running, true);
  const pid = status.pid;
  await preview.stop();
  assert.equal(preview.status().running, false);
  await preview.dispose();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(exists(pid), false);
});

test("notes reader returns only unresolved items", () => {
  const project = tmp();
  mkdirSync(path.join(project, ".page-harness"));
  writeFileSync(path.join(project, ".page-harness", "review.json"), JSON.stringify({
    items: [
      { n: 1, path: "/", selector: "h1", label: "标题", note: "再大一点", status: "open", patch: { text: "报名" }, replies: [{ text: "好" }] },
      { n: 2, path: "/", selector: "p", note: "done", status: "resolved", replies: [] },
    ],
  }));
  const items = readNotes(project);
  assert.deepEqual(items.map((item) => item.n), [1]);
  assert.equal(items[0].patch.text, "报名");
  assert.deepEqual(items[0].replies, ["好"]);
  assert.match(renderNotes({ project, items }), /#1 \[\/\] 标题/);
  assert.match(renderNotes({ project, items: [] }), /没有未解决的意见/);
  const saved = appendNote(project, { note: "按钮再深一点", selector: "button", label: "提交按钮", path: "/" });
  assert.deepEqual(saved.map((item) => item.n), [1, 3]);
});

test("settings persist the preview port and CLI path", () => {
  const file = path.join(tmp(), "page-harness.json");
  const store = createSettingsStore(file);
  assert.equal(store.get().previewPort, 17994);
  assert.deepEqual(store.save({ previewPort: 18000, cliPath: "/tmp/cli.js" }), { previewPort: 18000, cliPath: "/tmp/cli.js" });
  assert.equal(createSettingsStore(file).get().previewPort, 18000);
  assert.throws(() => store.save({ previewPort: 0 }), /预览端口/);
});

test("the control route rejects cross-origin and non-JSON requests", async () => {
  const host = createPageHarnessHost({ settingsFile: path.join(tmp(), "settings.json"), detectTimeoutMs: 30 });
  cleanup.push(() => host.dispose());
  const server = http.createServer((request, response) => { void host.handle(request, response); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(() => new Promise((resolve) => server.close(() => resolve())));
  const port = server.address().port;
  const send = (headers, body) => fetch(`http://127.0.0.1:${port}/page-harness`, { method: "POST", headers, body });
  assert.equal((await send({ origin: "http://evil.example", host: `127.0.0.1:${port}`, "content-type": "application/json" }, "{}")).status, 403);
  assert.equal((await send({ origin: "http://evil.example", host: `127.0.0.1:${port}`, "x-forwarded-host": "evil.example", "content-type": "application/json" }, "{}")).status, 403);
  assert.equal((await send({ origin: `http://127.0.0.1:${port}`, host: `127.0.0.1:${port}`, "content-type": "text/plain" }, "{}")).status, 415);
  assert.equal((await send({ origin: `http://127.0.0.1:${port}`, host: `127.0.0.1:${port}`, "content-type": "application/json" }, "not-json")).status, 400);
  const ok = await send({ origin: `http://127.0.0.1:${port}`, host: `127.0.0.1:${port}`, "content-type": "application/json" }, JSON.stringify({ method: "settings" }));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).settings.previewPort, 17994);
});

test("dev server detection keeps HTML servers and skips excluded ports", async () => {
  const html = http.createServer((_request, response) => response.writeHead(200, { "content-type": "text/html" }).end("<title> Vite App </title>"));
  const json = http.createServer((_request, response) => response.writeHead(200, { "content-type": "application/json" }).end("{}"));
  await new Promise((resolve) => html.listen(0, "127.0.0.1", resolve));
  await new Promise((resolve) => json.listen(0, "127.0.0.1", resolve));
  cleanup.push(() => new Promise((resolve) => html.close(() => resolve())));
  cleanup.push(() => new Promise((resolve) => json.close(() => resolve())));
  const htmlPort = html.address().port;
  const jsonPort = json.address().port;
  const found = await detectDevServers({ ports: [htmlPort, jsonPort], exclude: [jsonPort], timeoutMs: 400 });
  assert.deepEqual(found.map((item) => item.port), [htmlPort]);
  assert.equal(found[0].title, "Vite App");
  const skipped = await detectDevServers({ ports: [htmlPort], exclude: [htmlPort], timeoutMs: 200 });
  assert.deepEqual(skipped, []);
});

test("tool contract, quote append, and preview surface stay exclusive", () => {
  const names = PAGE_HARNESS_DYNAMIC_TOOLS.flatMap((spec) => spec.tools.map((tool) => tool.name));
  assert.deepEqual(names, ["page_harness_preview", "page_harness_notes"]);
  assert.match(PAGE_HARNESS_SYSTEM_PROMPT, /do not run page-harness yourself/i);
  assert.match(PAGE_HARNESS_SYSTEM_PROMPT, /page-element/);
  assert.match(PAGE_HARNESS_SYSTEM_PROMPT, /page_harness_notes/);
  assert.equal(PAGE_HARNESS_DYNAMIC_TOOLS.some((spec) => spec.tools.some((tool) => /share|status|stop/.test(tool.name))), false);
  assert.match(renderPreview({ running: true, label: "index.html" }), /已在右侧预览：index.html/);
  assert.match(renderPreview({ needsAgent: true, reason: "GET http://127.0.0.1:5173/ 没有响应。", project: "/work", command: "npm run dev", url: "http://127.0.0.1:5173/" }), /不要换端口/);
  const sent = [];
  const quoted = appendPreviewQuote({
    appendQuote(text) { sent.push(text); return true; },
    submit() { throw new Error("sent"); },
  }, { tagName: "button", text: "提交按钮", selector: "button.submit", outerHTML: "<button>提交</button>", url: "http://127.0.0.1:5173/" });
  assert.equal(quoted.ok, true);
  assert.match(sent[0], /<page-element/);
  assert.match(sent[0], /提交按钮/);
  assert.match(sent[0], /<button>提交<\/button>/);
  assert.equal(appendPreviewQuote({ appendQuote: () => false }, { outerHTML: "<b>x</b>", text: "x" }).ok, false);
  assert.equal(previewSurface({ view: "list", running: true, mixed: false }), "list");
  assert.equal(previewSurface({ view: "page", running: true, mixed: false }), "preview");
  assert.equal(previewSurface({ view: "page", running: false, mixed: false }), "list");
  assert.equal(previewSurface({ view: "page", running: true, mixed: true }), "mixed");
  const frame = previewFrame({ running: true, page: "/index.html", appUrl: "http://127.0.0.1:17994", embedToken: "embed-secret-token" }, "https:");
  assert.equal(frame.mixed, true);
  assert.equal(frame.src, "");
  assert.match(MIXED_CONTENT_MESSAGE, /HTTPS/);
  const offer = classifyTurn([
    { type: "patch", changes: [{ path: "index.html" }, { path: "src/app.tsx" }] },
    { type: "command-execution", command: "npm run dev -- --port 5173" },
  ]);
  assert.equal(offer.mode, "server");
  assert.deepEqual(offer.html, ["index.html"]);
  assert.equal(offer.servers[0].port, 5173);
});

test("direct clients cannot satisfy origin with X-Forwarded-Host, and CLI lookup skips the packages sibling", () => {
  assert.equal(sameOrigin({ origin: "http://evil.example", host: "127.0.0.1:4173", "x-forwarded-host": "evil.example" }), false);
  assert.equal(sameOrigin({ origin: "http://127.0.0.1:4173", host: "127.0.0.1:4173" }), true);
  assert.equal(sameOrigin({ origin: "http://public.example", host: "127.0.0.1:4173" }, "public.example"), true);
  assert.equal(sameOrigin({ origin: "http://public.example", host: "127.0.0.1:4173" }), false);
  const hostSource = readFileSync(new URL("../packages/page-harness-host/src/host.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(hostSource, /\.\.\/\.\.\/dist\/cli\.js/);
  const sibling = path.resolve(fileURLToPath(new URL("../packages/dist/cli.js", import.meta.url)));
  const found = resolveCli("");
  assert.notEqual(found, sibling);
  assert.equal(resolveCli(cliPath), path.resolve(cliPath));
  assert.equal(resolveCli(path.join(tmp(), "missing.js")), null);
});

test("web and electron share one renderer panel and one host module", () => {
  const web = readFileSync(new URL("../scripts/serve-workbench-web.mjs", import.meta.url), "utf8");
  const desktop = readFileSync(new URL("../scripts/serve-workbench-static.mjs", import.meta.url), "utf8");
  const electron = readFileSync(new URL("../apps/workbench-electron/src/main.ts", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../apps/workbench-web/src/page-harness/panel.tsx", import.meta.url), "utf8");
  assert.match(web, /createPageHarnessHost/);
  assert.match(desktop, /createPageHarnessHost/);
  assert.match(electron, /createWorkbenchStaticServer/);
  assert.match(panel, /取点/);
  assert.match(panel, /引用/);
  assert.match(panel, /意见/);
  assert.match(panel, /ph:quote/);
  assert.match(panel, /ph:hello/);
  assert.match(panel, /ph:highlight/);
  assert.doesNotMatch(panel, /ph:pick/);
  assert.doesNotMatch(panel, /分享|邀请|评审者/);
  const client = readFileSync(new URL("../apps/workbench-web/src/page-harness/client.ts", import.meta.url), "utf8");
  const turn = readFileSync(new URL("../apps/workbench-web/src/page-harness/turn-tail.tsx", import.meta.url), "utf8");
  const submit = readFileSync(new URL("../apps/workbench-web/src/page-harness/submit-preview.ts", import.meta.url), "utf8");
  assert.match(client, /submitText\(previewRequestText/);
  assert.match(turn, /启动服务并预览/);
  assert.match(turn, /askAgentToPreview/);
  assert.match(submit, /createSubmitIntent/);
  assert.doesNotMatch(client, /insertText/);
  assert.equal(readFileSync(new URL("../packages/browser-appserver/src/dynamic-tools.ts", import.meta.url), "utf8").includes("page_harness"), false);
});

function exists(pid) {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}
