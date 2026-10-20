import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createModels } from "@earendil-works/pi-ai";
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { PiEngine, piModel } from "../plugins/pi-engine/src/index.js";
import type { ExecutionEngineClient } from "@opencraft/appserver-client";
import { startEngineHost } from "../apps/local-agent-host/src/engine-host.js";
import WebSocket from "ws";

const noTools: ExecutionEngineClient = { notify() {}, async request() { throw new Error("Unexpected tool"); } };
function fixtureModels(responses: Parameters<ReturnType<typeof fauxProvider>["setResponses"]>[0], tokensPerSecond = 10000) {
  const faux = fauxProvider({ tokensPerSecond }); faux.setResponses(responses);
  const models = createModels(); models.setProvider(faux.provider);
  return { faux, models: Object.assign(models, { getAvailableSnapshot: () => faux.models }) as unknown as ModelRuntime };
}
async function fixture(t: test.TestContext, responses: Parameters<typeof fixtureModels>[0], tokensPerSecond?: number) {
  const directory = await mkdtemp(join(tmpdir(), "opencraft-pi-durable-"));
  const { models, faux } = fixtureModels(responses, tokensPerSecond);
  const engine = new PiEngine({ directory, cwd: directory, models });
  t.after(async () => { await engine.close(); await rm(directory, { recursive: true, force: true }); });
  return { directory, engine, faux };
}
function completed(engine: PiEngine) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error("Pi did not settle")); }, 10_000);
    const stop = engine.subscribe((method, params) => {
      if (method === "turn/completed") { clearTimeout(timer); stop(); resolve(params.turn); }
    });
  });
}

test("native durable session streams, persists and restores without DSH", async t => {
  const f = await fixture(t, [fauxAssistantMessage("hello\u2028world")]);
  const created = await f.engine.request("thread/start", { model: piModel("faux", "faux-1"), cwd: f.directory }, noTools);
  const threadId = created.thread.id; assert.equal(created.thread.modelProvider, "pi");
  const done = completed(f.engine);
  const started = await f.engine.request("turn/start", { threadId, clientUserMessageId: "hello-client", input: [{ type: "text", text: "hello" }] }, noTools);
  assert.equal((await done).status, "completed");
  const retry = await f.engine.request("turn/start", { threadId, clientUserMessageId: "hello-client", input: [{ type: "text", text: "hello" }] }, noTools);
  assert.equal(retry.turn.id, started.turn.id);
  await f.engine.close();
  const models = fixtureModels([]).models;
  const reopened = new PiEngine({ directory: f.directory, cwd: f.directory, models }); t.after(() => reopened.close());
  const resumed = await reopened.request("thread/resume", { threadId }, noTools);
  assert.equal(resumed.thread.turns[0].id, started.turn.id);
  assert.equal(resumed.thread.turns.length, 1);
  assert.equal(resumed.thread.turns[0].items.find((item: any) => item.type === "userMessage").clientId, "hello-client");
  assert.equal(resumed.thread.turns[0].status, "completed");
  assert.equal(resumed.thread.turns[0].items.find((item: any) => item.type === "agentMessage").text, "hello\u2028world");
  await assert.rejects(reopened.request("turn/start", { threadId, model: "dsh:model", input: [{ type: "text", text: "wrong engine" }] }, noTools), /belongs to Pi/);
});

test("platform tool calls are namespaced and use the live owner", async t => {
  const f = await fixture(t, [fauxAssistantMessage([fauxToolCall("opencraft_0_lookup", { key: "one" }, { id: "tool-one" })], { stopReason: "toolUse" }), fauxAssistantMessage("done")]);
  let called = 0;
  const owner: ExecutionEngineClient = { notify() {}, async request(method, params) {
    called++; assert.equal(method, "item/tool/call"); assert.equal(params.namespace, "platform"); assert.equal(params.tool, "lookup");
    return { success: true, contentItems: [{ type: "inputText", text: "result" }] };
  } };
  const created = await f.engine.request("thread/start", { model: piModel("faux", "faux-1"), cwd: f.directory,
    dynamicTools: [{ type: "namespace", name: "platform", tools: [{ type: "function", name: "lookup", description: "Lookup a key", inputSchema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] } }] }] }, owner);
  const done = completed(f.engine);
  await f.engine.request("turn/start", { threadId: created.thread.id, input: [{ type: "text", text: "lookup" }] }, owner);
  assert.equal((await done).status, "completed"); assert.equal(called, 1);
  const read = await f.engine.request("thread/read", { threadId: created.thread.id, includeTurns: true }, owner);
  assert.equal(read.thread.turns[0].items.find((item: any) => item.type === "dynamicToolCall").status, "completed");
});

test("closing a durable owner suspends work; reopening resumes the same input", async t => {
  const f = await fixture(t, [fauxAssistantMessage("unfinished response ".repeat(20))], 20);
  const created = await f.engine.request("thread/start", { model: piModel("faux", "faux-1"), cwd: f.directory }, noTools);
  const threadId = created.thread.id;
  const partial = new Promise<void>(resolve => {
    const stop = f.engine.subscribe(method => { if (method === "item/agentMessage/delta") { stop(); resolve(); } });
  });
  const started = await f.engine.request("turn/start", { threadId, input: [{ type: "text", text: "work" }] }, noTools);
  await partial; await f.engine.close();
  const reopened = new PiEngine({ directory: f.directory, cwd: f.directory, models: fixtureModels([fauxAssistantMessage("recovered")]).models });
  t.after(() => reopened.close());
  const done = completed(reopened);
  const restored = await reopened.request("thread/resume", { threadId }, noTools);
  assert.equal(restored.thread.turns[0].id, started.turn.id);
  assert.equal((await done).status, "completed");
  const read = await reopened.request("thread/read", { threadId, includeTurns: true }, noTools);
  assert.equal(read.thread.turns.length, 1);
  assert.equal(read.thread.turns[0].items.filter((item: any) => item.type === "userMessage").length, 1);
});

test("Pi-only Host routes models and threads without allocating a legacy Host", async t => {
  const f = await fixture(t, []);
  const host = await startEngineHost({ providers: [f.engine], defaultEngine: "pi" }); t.after(() => host.close());
  const socket = new WebSocket(host.websocketUrl); t.after(() => socket.terminate());
  await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  let next = 0;
  const call = (method: string, params = {}) => new Promise<any>((resolve, reject) => {
    const id = ++next;
    const listener = (data: WebSocket.RawData) => { const reply = JSON.parse(data.toString()); if (reply.id !== id) return;
      socket.off("message", listener); reply.error ? reject(new Error(reply.error.message)) : resolve(reply.result); };
    socket.on("message", listener); socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  });
  const initialized = await call("initialize"); assert.equal(initialized.capabilities.extensions["opencraft/execution-engines"].defaultEngine, "pi");
  const models = await call("model/list"); assert.equal(models.data[0].groupLabel, "Pi · faux"); assert.equal(models.data[0].isDefault, true);
  const thread = await call("thread/start", { model: models.data[0].model, cwd: f.directory }); assert.match(thread.thread.id, /^pi_/);
  await assert.rejects(call("turn/start", { threadId: "existing-dsh-thread", model: models.data[0].model }), /change execution engines/);
});

test("cancelling a pending platform tool settles the turn and preserves native interruption", async t => {
  const f = await fixture(t, [fauxAssistantMessage([fauxToolCall("opencraft_0_wait", {}, { id: "blocked-tool" })], { stopReason: "toolUse" })]);
  let invoked!: () => void;
  const called = new Promise<void>(resolve => { invoked = resolve; });
  const owner: ExecutionEngineClient = { notify() {}, request() { invoked(); return new Promise(() => {}); } };
  const created = await f.engine.request("thread/start", { model: piModel("faux", "faux-1"),
    dynamicTools: [{ type: "function", name: "wait", description: "Wait", inputSchema: { type: "object", properties: {} } }] }, owner);
  const started = await f.engine.request("turn/start", { threadId: created.thread.id, input: [{ type: "text", text: "wait" }] }, owner);
  await called;
  await assert.rejects(f.engine.request("runtime/capabilities/register", { threadId: created.thread.id }, noTools), /owner during a Pi turn/);
  const done = completed(f.engine);
  f.engine.disconnect(owner);
  await f.engine.request("turn/interrupt", { threadId: created.thread.id, turnId: started.turn.id }, noTools);
  assert.equal((await done).status, "interrupted");
  await f.engine.close();
  const reopened = new PiEngine({ directory: f.directory, cwd: f.directory, models: fixtureModels([]).models }); t.after(() => reopened.close());
  const restored = await reopened.request("thread/resume", { threadId: created.thread.id }, noTools);
  assert.equal(restored.thread.turns[0].id, started.turn.id);
  assert.equal(restored.thread.turns[0].status, "interrupted");
});

test("engine capabilities override host defaults without changing legacy threads", async () => {
  const { executionEngineExtension } = await import("../packages/appserver-client/src/execution-engine.js");
  const goal = { version: 1 };
  const extensions = { "opencraft/thread-goal": goal, "opencraft/execution-engines": { providers: [{ threadPrefix: "pi_", modelPrefix: "pi:", extensions: {} }] } };
  assert.equal(executionEngineExtension(extensions, "dsh-existing", "opencraft/thread-goal"), goal);
  assert.equal(executionEngineExtension(extensions, "pi_session", "opencraft/thread-goal"), undefined);
  assert.equal(executionEngineExtension(extensions, piModel("faux", "faux-1"), "opencraft/thread-goal"), undefined);
});


test("durable Host clients send outbox input to Pi without DSH queue or history APIs", async t => {
  const { createAppServerWorkbenchRuntime } = await import("../packages/workbench-runtime/src/appserver-runtime.js");
  const { WebSocketTransport } = await import("../packages/appserver-transport-websocket/src/index.js");
  const f = await fixture(t, [fauxAssistantMessage("outbox accepted")]);
  const host = await startEngineHost({ providers: [f.engine], defaultEngine: "pi" }); t.after(() => host.close());
  const sent: string[] = [];
  let rows: any[] = [];
  const runtime = createAppServerWorkbenchRuntime({ hostId: "pi-fixture", hostKind: "durable",
    outbox: { read: () => rows, write: (_key, next) => { rows = [...next]; }, subscribe: () => () => {} },
    createTransport: () => {
      const transport = new WebSocketTransport(host.websocketUrl);
      const send = transport.send.bind(transport);
      transport.send = frame => { sent.push(JSON.parse(frame).method); return send(frame); };
      return transport;
    },
  });
  t.after(() => runtime.dispose());
  await runtime.connect();
  const thread = await runtime.resources.threads.start({ model: piModel("faux", "faux-1"), cwd: f.directory });
  const lease = await runtime.acquireThread(thread.id); t.after(() => lease.release());
  for (let i = 0; i < 100 && !lease.getSnapshot().authoritative; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(lease.getSnapshot().authoritative, true);
  const done = completed(f.engine);
  await lease.submit({ commandId: "command-one", clientMessageId: "outbox-client", target: { type: "existing-thread", key: lease.getSnapshot().key },
    document: { version: 1, blocks: [{ type: "paragraph", children: [{ type: "text", text: "outbox input" }] }] },
    attachments: [], context: [], selections: { model: piModel("faux", "faux-1"), permissionProfile: null }, options: { autoContext: true }, createdAt: 1 });
  assert.equal((await done).status, "completed");
  assert.ok(sent.includes("turn/start"));
  assert.ok(!sent.includes("thread/queue/add"));
  assert.ok(!sent.includes("thread/turns/list"));
});


test("workspace first submission accepts native full access and retains project ownership on restart", async t => {
  const f = await fixture(t, [fauxAssistantMessage("First workspace reply")]);
  const permissions = "opencraft:permission-mode:full";
  const created = await f.engine.request("thread/start", {
    model: piModel("faux", "faux-1"), permissions, projectId: "workspace-project", cwd: f.directory,
    runtimeWorkspaceRoots: [f.directory], serviceTier: null, historyMode: "paginated",
  }, noTools);
  assert.equal(created.thread.projectId, "workspace-project");
  assert.equal(created.activePermissionProfile.id, permissions);
  const done = completed(f.engine);
  await f.engine.request("turn/start", { threadId: created.thread.id, permissions,
    sandboxPolicy: { type: "dangerFullAccess" }, approvalPolicy: "never",
    clientUserMessageId: "workspace-first", input: [{ type: "text", text: "hello workspace" }] }, noTools);
  assert.equal((await done).status, "completed");
  await f.engine.close();
  const reopened = new PiEngine({ directory: f.directory, cwd: f.directory, models: fixtureModels([]).models });
  t.after(() => reopened.close());
  const restored = await reopened.request("thread/resume", { threadId: created.thread.id, permissions }, noTools);
  assert.equal(restored.thread.projectId, "workspace-project");
  assert.equal(restored.activePermissionProfile.id, permissions);
  assert.equal(restored.thread.turns[0].items.find((item: any) => item.type === "agentMessage").text, "First workspace reply");
  for (const method of ["thread/start", "thread/resume", "turn/start"]) {
    for (const override of [{ permissions: "opencraft:permission-mode:read-only" }, { permissions: "custom-profile" },
      { sandbox: "workspace-write" }, { sandboxPolicy: { type: "workspaceWrite" } }, { approvalPolicy: "on-request" }]) {
      await assert.rejects(reopened.request(method, { threadId: created.thread.id, model: piModel("faux", "faux-1"),
        input: [{ type: "text", text: "must not execute" }], ...override }, noTools), /Full access only/);
    }
  }
  await assert.rejects(reopened.request("thread/start", { model: piModel("faux", "faux-1"), developerInstructions: "do not discard" }, noTools), /custom instructions/);
  assert.equal((await reopened.request("thread/read", { threadId: created.thread.id, includeTurns: true }, noTools)).thread.turns.length, 1);
});

test("first Pi outbox submission drains after baseline without blocking on its own optimistic turn", async t => {
  const { createAppServerWorkbenchRuntime } = await import("../packages/workbench-runtime/src/appserver-runtime.js");
  const { WebSocketTransport } = await import("../packages/appserver-transport-websocket/src/index.js");
  const f = await fixture(t, [fauxAssistantMessage("workspace outbox replied ".repeat(10)), fauxAssistantMessage("queued follow-up replied")], 100);
  const host = await startEngineHost({ providers: [f.engine], defaultEngine: "pi" }); t.after(() => host.close());
  let rows: any[] = [];
  const methods: string[] = [];
  const runtime = createAppServerWorkbenchRuntime({ hostId: "pi-first-message", hostKind: "durable",
    dynamicTools: [{ type: "namespace", name: "platform", description: "Platform", tools: [{ type: "function", name: "lookup", description: "Lookup", inputSchema: { type: "object" } }] }],
    outbox: { read: () => rows, write: (_key, next) => { rows = [...next]; }, subscribe: () => () => {} },
    createTransport: () => {
      const transport = new WebSocketTransport(host.websocketUrl), send = transport.send.bind(transport);
      transport.send = frame => { methods.push(JSON.parse(frame).method); return send(frame); }; return transport;
    },
  });
  t.after(() => runtime.dispose()); await runtime.connect();
  const thread = await runtime.resources.threads.start({ model: piModel("faux", "faux-1"), cwd: f.directory,
    permissions: "opencraft:permission-mode:full", projectId: "first-message-project" });
  const lease = await runtime.acquireThread(thread.id); t.after(() => lease.release());
  assert.equal(lease.getSnapshot().authoritative, false);
  const partial = new Promise<void>(resolve => {
    const stop = f.engine.subscribe(method => { if (method === "item/agentMessage/delta") { stop(); resolve(); } });
  });
  const done = new Promise<void>((resolve, reject) => {
    let count = 0;
    const timer = setTimeout(() => { stop(); reject(new Error("Both Pi outbox messages did not settle")); }, 10_000);
    const stop = f.engine.subscribe((method, params) => {
      if (method !== "turn/completed") return;
      assert.equal(params.turn.status, "completed");
      if (++count === 2) { clearTimeout(timer); stop(); resolve(); }
    });
  });
  await lease.submit({ commandId: "first-workspace-command", clientMessageId: "first-workspace-client",
    target: { type: "existing-thread", key: lease.getSnapshot().key },
    document: { version: 1, blocks: [{ type: "paragraph", children: [{ type: "text", text: "first workspace input" }] }] },
    attachments: [], context: [], selections: { model: piModel("faux", "faux-1"), effort: "none", permissionProfile: "opencraft:permission-mode:full" },
    options: { autoContext: true }, createdAt: 1 });
  await partial;
  await lease.submit({ commandId: "second-workspace-command", clientMessageId: "second-workspace-client",
    target: { type: "existing-thread", key: lease.getSnapshot().key },
    document: { version: 1, blocks: [{ type: "paragraph", children: [{ type: "text", text: "second workspace input" }] }] },
    attachments: [], context: [], selections: { model: piModel("faux", "faux-1"), permissionProfile: "opencraft:permission-mode:full" },
    options: { autoContext: true }, createdAt: 2 });
  assert.equal(rows.length, 1, "follow-up stays local while the native Pi turn is active");
  await done;
  assert.ok(methods.includes("runtime/capabilities/register")); assert.ok(methods.includes("turn/start"));
  assert.ok(!methods.includes("thread/queue/add"));
  const restored = await f.engine.request("thread/read", { threadId: thread.id, includeTurns: true }, noTools);
  assert.equal(restored.thread.projectId, "first-message-project");
  assert.equal(restored.thread.turns.length, 2);
  assert.equal(restored.thread.turns[0].items.find((item: any) => item.type === "userMessage").clientId, "first-workspace-client");
  assert.equal(restored.thread.turns[1].items.find((item: any) => item.type === "userMessage").clientId, "second-workspace-client");
});
