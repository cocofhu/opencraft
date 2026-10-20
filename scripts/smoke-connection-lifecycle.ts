import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium } from "playwright";
import { WebSocketServer } from "ws";

// Isolated protocol fixture; no account, SSH, model or user data.
const bundle = process.env.OPENCRAFT_LIFECYCLE_MODULE
  ? await readFile(process.env.OPENCRAFT_LIFECYCLE_MODULE, "utf8")
  : (await build({ stdin: { contents: 'export { JsonRpcAppServerClient } from "./packages/appserver-client/src/client.ts"; export { WebSocketTransport } from "./packages/appserver-transport-websocket/src/websocket-transport.ts"; export { installBrowserDynamicToolHandler } from "./packages/browser-appserver/src/dynamic-tools.ts";', resolveDir: resolve(".") }, bundle: true, format: "esm", platform: "browser", write: false })).outputFiles[0]!.text;
const server = createServer(async (req, res) => {
  if (req.url === "/module.js") { res.setHeader("content-type", "text/javascript"); res.end(bundle); return; }
  if (process.env.OPENCRAFT_LIFECYCLE_ASSETS && /^\/assets\/[A-Za-z0-9._-]+\.js$/.test(req.url ?? "")) {
    res.setHeader("content-type", "text/javascript"); res.end(await readFile(process.env.OPENCRAFT_LIFECYCLE_ASSETS + req.url)); return;
  }
  res.setHeader("content-type", "text/html"); res.end('<!doctype html><title>Connection lifecycle</title><textarea aria-label="Draft">retained draft</textarea>');
});
const sockets = new WebSocketServer({ server });
const frames: Array<{ connection: number; message: any }> = [];
let connections = 0, pendingReuse: string | number | undefined;
sockets.on("connection", socket => {
  const connection = ++connections;
  socket.on("message", raw => {
    const message = JSON.parse(String(raw));
    if (message.method === "initialize") socket.send(JSON.stringify({ id: message.id, result: { codexHome: "/tmp/fixture", platformFamily: "unix", platformOs: "linux", userAgent: "fixture" } }));
    else if (message.method === "fixture/start") {
      socket.send(JSON.stringify({ id: 11, method: "item/tool/call", params: { namespace: "vela_browser", tool: "browser_use", arguments: { action: "wait", text: "fixture" }, threadId: "old-thread", turnId: "u", callId: "c" } }));
      socket.send(JSON.stringify({ method: "serverRequest/resolved", params: { requestId: 7, threadId: "old-thread" } }));
      socket.send(JSON.stringify({ id: message.id, result: null }));
    } else if (message.method === "fixture/reuse") {
      pendingReuse = message.id;
      socket.send(JSON.stringify({ id: 7, method: "fixture/instant", params: { threadId: "new-thread" } }));
    } else if (message.method === "fixture/fence") socket.send(JSON.stringify({ id: message.id, result: null }));
    else {
      frames.push({ connection, message });
      if (message.id === 7 && pendingReuse !== undefined) { socket.send(JSON.stringify({ id: pendingReuse, result: "new reply delivered" })); pendingReuse = undefined; }
    }
  });
});
server.listen(0, "127.0.0.1"); await once(server, "listening");
const address = server.address(); assert.ok(address && typeof address === "object");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage(); const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript("window.__name = fn => fn");
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.evaluate(async () => {
    const m = await import(/* @vite-ignore */ "/module.js");
    const transport = new m.WebSocketTransport({ url: location.origin.replace("http", "ws") });
    const client = new m.JsonRpcAppServerClient({ hostId: "browser-lifecycle", transport, requestTimeoutMs: 3000 });
    let release!: (value: unknown) => void;
    const gate = new Promise(resolve => { release = resolve; });
    const fixture = (window as any).fixture = { client, transport, release, module: m, started: false, draft: document.querySelector("textarea") };
    m.installBrowserDynamicToolHandler(client, { open() { throw new Error("unused"); }, getTabContext() { throw new Error("unused"); }, browserUse() { fixture.started = true; return gate; } }, { hostId: "browser-lifecycle" });
    client.handleServerRequest("fixture/instant", () => ({ current: true }));
    fixture.params = { clientInfo: { name: "browser-lifecycle", version: "1" }, capabilities: { experimentalApi: true } };
    await client.connect(fixture.params); await client.requestRaw("fixture/start", {});
  });
  await page.waitForFunction(() => (window as any).fixture.started);
  for (const socket of sockets.clients) socket.close(1012, "fixture reconnect");
  await page.waitForFunction(() => (window as any).fixture.transport.status.state === "closed");
  const result = await page.evaluate(async () => {
    const f = (window as any).fixture;
    await f.client.connect(f.params); f.release({ old: true });
    await f.client.requestRaw("fixture/fence", {});
    const reused = await f.client.requestRaw("fixture/reuse", {});
    let allocated = 0;
    const abort = new AbortController();
    const cancelled = new f.module.WebSocketTransport({ url: location.origin.replace("http", "ws"), createSocket: (url: string) => { allocated++; return new WebSocket(url); } });
    cancelled.subscribeStatus((s: any) => { if (s.state === "connecting") abort.abort(); });
    const cancellation = await cancelled.connect(abort.signal).then(() => "unexpected-open", (e: Error) => e.name);
    await cancelled.close();
    const result = { generation: f.client.connectionGeneration, reused, allocated, cancellation, sameDraft: document.querySelector("textarea") === f.draft, draft: f.draft.value };
    await f.client.close(); return result;
  });
  assert.deepEqual(result, { generation: 2, reused: "new reply delivered", allocated: 0, cancellation: "AbortError", sameDraft: true, draft: "retained draft" });
  assert.equal(connections, 2); assert.deepEqual(frames.map(f => ({ connection: f.connection, id: f.message.id })), [{ connection: 2, id: 7 }]);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ browser: "Chromium", ...result, connections, staleReplies: 0, pageErrors: errors.length, module: process.env.OPENCRAFT_LIFECYCLE_MODULE ? "provided artifact" : "current source bundle" }));
} finally {
  await browser.close(); for (const socket of sockets.clients) socket.terminate();
  await new Promise<void>(resolve => sockets.close(() => resolve()));
  await new Promise<void>(resolve => server.close(() => resolve()));
}
