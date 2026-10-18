import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CodexHostStateDatabase, CODEX_HOST_STATE_BASELINE, CODEX_HOST_BOT_STATE } from "../apps/opencraft-daemon/src/codex-host-state-database.js";
import { CodexBotBridge, type CodexBotPort } from "../apps/opencraft-daemon/src/codex-bot-bridge.mjs";

async function fixture(run: (directory: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "oc-bot-owner-"));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}
const layouts = [
  "thread_id TEXT PRIMARY KEY, created_ms INTEGER NOT NULL",
  "thread_id TEXT PRIMARY KEY, created_ms INTEGER NOT NULL, native_thread_id TEXT, cwd TEXT, draft INTEGER NOT NULL DEFAULT 0",
  "thread_id TEXT PRIMARY KEY, created_ms INTEGER NOT NULL, cwd TEXT, draft INTEGER NOT NULL DEFAULT 0, native_thread_id TEXT",
];
for (const [index, columns] of layouts.entries()) test(`known deployed Bot layout ${index} preserves rooms, receipts and slots`, async () => fixture(async root => {
  const path = join(root, "codex-host-queue.sqlite");
  const old = new DatabaseSync(path);
  old.exec(CODEX_HOST_STATE_BASELINE + CODEX_HOST_BOT_STATE.replace(/CREATE TABLE codex_bot_rooms \([\s\S]*?\);/, `CREATE TABLE codex_bot_rooms (${columns});`));
  old.prepare("INSERT INTO codex_bot_rooms(thread_id,created_ms) VALUES (?,?)").run("room", 42);
  if (index) old.exec("UPDATE codex_bot_rooms SET native_thread_id='native',cwd='/synthetic',draft=1");
  old.exec("INSERT INTO codex_bot_commands VALUES ('send:room:pending','fp',NULL); INSERT INTO codex_bot_message_slots VALUES('room','turn','agentMessage',0,'item');");
  old.close();
  const owner = new CodexHostStateDatabase(root);
  assert.equal(owner.outcome.status, "migrated");
  assert.equal(owner.outcome.appliedVersion, 5); assert.ok(owner.outcome.backupPath); assert.deepEqual(owner.outcome.movedAsidePaths, []);
  const row = owner.database.prepare("SELECT * FROM codex_bot_rooms").get()!;
  assert.equal(row.thread_id, "room"); assert.equal(row.created_ms, 42);
  assert.equal(row.native_thread_id, index ? "native" : null); assert.equal(row.draft, index ? 1 : 0);
  assert.equal(owner.database.prepare("SELECT result_json FROM codex_bot_commands").get()?.result_json, null);
  assert.equal(owner.database.prepare("SELECT native_id FROM codex_bot_message_slots").get()?.native_id, "item");
  const ledger = owner.database.prepare("SELECT version,name,checksum FROM schema_migrations ORDER BY version").all();
  assert.equal(ledger.length, 5); assert.equal(ledger[0]?.name, "codex-host-state");
  assert.equal(ledger[0]?.checksum, "c2508ef065ded8821d7c071fab1603b403b4e5e9220569916f1cee53f82025c3", "published v1 checksum is immutable");
  owner.close();
  // Exact old constructor/SQL ignores the additive ledger and still accepts this code rollback.
  const rollback = new DatabaseSync(path);
  rollback.exec("CREATE TABLE IF NOT EXISTS codex_bot_rooms (thread_id TEXT PRIMARY KEY, created_ms INTEGER NOT NULL);");
  rollback.prepare("INSERT INTO codex_bot_rooms(thread_id,created_ms,cwd,draft) VALUES (?,?,?,?)").run("rollback-room", 50, "/retained", 1);
  assert.equal(rollback.prepare("SELECT thread_id FROM codex_bot_rooms WHERE thread_id='room'").get()?.thread_id, "room"); rollback.close();
  const reopened = new CodexHostStateDatabase(root); assert.equal(reopened.outcome.status, "up-to-date"); reopened.close();
}));

test("unknown Bot schema remains rejected without moving user data", async () => fixture(async root => {
  const path = join(root, "codex-host-queue.sqlite"), db = new DatabaseSync(path);
  db.exec(CODEX_HOST_STATE_BASELINE + CODEX_HOST_BOT_STATE + "CREATE INDEX unknown_room_policy ON codex_bot_rooms(cwd)"); db.close();
  assert.throws(() => new CodexHostStateDatabase(root), (e: any) => e.kind === "unsupported-legacy");
  assert.ok(!(await readdir(root)).some(name => name.includes(".legacy-")));
}));

test("known room conversion failure rolls back records and leaves a pre-write snapshot", async t => fixture(async root => {
  const path = join(root, "codex-host-queue.sqlite"), db = new DatabaseSync(path);
  db.exec(CODEX_HOST_STATE_BASELINE + CODEX_HOST_BOT_STATE.replace(/CREATE TABLE codex_bot_rooms \([\s\S]*?\);/, `CREATE TABLE codex_bot_rooms (${layouts[0]});`));
  db.exec("INSERT INTO codex_bot_rooms VALUES('room',42)"); db.close();
  const original = DatabaseSync.prototype.exec;
  const mock = t.mock.method(DatabaseSync.prototype, "exec", function (this: DatabaseSync, sql: string) {
    if (sql.startsWith("INSERT INTO codex_bot_rooms(thread_id,created_ms,cwd")) throw new Error("synthetic write failure");
    return original.call(this, sql);
  });
  assert.throws(() => new CodexHostStateDatabase(root)); mock.mock.restore();
  const read = new DatabaseSync(path, { readOnly: true });
  assert.equal(read.prepare("SELECT thread_id FROM codex_bot_rooms").get()?.thread_id, "room");
  assert.equal(read.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").get(), undefined); read.close();
  assert.ok((await readdir(root)).some(name => name.includes(".pre-v5-")));
}));

function nativePort() {
  let serial = 0, failedTurn = false; const calls: string[] = [], events: any[] = [], missing = new Set<string>();
  const threads = new Map<string, any>();
  const port: CodexBotPort = {
    async request(_owner, method, params) {
      calls.push(method);
      if (method === "thread/start") {
        const thread = { id: `native-${++serial}`, createdAt: 1, updatedAt: 1, cwd: params.cwd ?? "/synthetic", historyMode: "legacy", turns: [] };
        threads.set(thread.id, thread); return { thread };
      }
      if (method === "thread/read" || method === "thread/resume") {
        if (missing.has(String(params.threadId))) throw Object.assign(new Error(`no rollout found for thread id ${params.threadId}`), { code: -32600 });
        return { thread: threads.get(String(params.threadId)) };
      }
      if (method === "turn/start") {
        if (failedTurn) throw new Error("result not confirmed");
        return { turn: { id: "turn", status: "inProgress" } };
      }
      throw new Error(`Unexpected native operation ${method}`);
    },
    hasNativeSubscription: () => false, attach() {}, async reply() {}, activeTurn: () => null,
    emit(event) { events.push(event); },
  };
  return { port, calls, events, threads, missing, failTurn() { failedTurn = true; } };
}
const create = { topology: "direct", participantIds: ["bot:opencraft.codex"], clientRequestId: "create", cwd: "/synthetic" };

test("Bot command receipts survive restart, retain logical drafts and fence unknown sends", async () => fixture(async root => {
  const owner = new CodexHostStateDatabase(root), native = nativePort();
  let bridge = new CodexBotBridge(owner.database, native.port);
  const first: any = await bridge.request("client", "bot/conversation/create", create);
  assert.equal((await bridge.request("client", "bot/conversation/create", create) as any).replayed, true);
  assert.equal(native.calls.filter(x => x === "thread/start").length, 1);
  bridge.dispose(); assert.equal(owner.database.prepare("SELECT count(*) as n FROM codex_bot_rooms").get()?.n, 1, "borrower does not close owner's DB");
  bridge = new CodexBotBridge(owner.database, native.port);
  native.missing.add(first.conversation.conversationId);
  const resumed: any = await bridge.request("client", "bot/conversation/read", { conversationId: first.conversation.conversationId });
  assert.equal(resumed.conversation.conversationId, first.conversation.conversationId);
  assert.equal(owner.database.prepare("SELECT native_thread_id FROM codex_bot_rooms").get()?.native_thread_id, "native-2");
  native.failTurn();
  const input = { conversationId: first.conversation.conversationId, clientMessageId: "message", content: [{ type: "text", text: "synthetic" }] };
  await assert.rejects(bridge.request("client", "bot/message/send", input));
  const count = native.calls.filter(x => x === "turn/start").length;
  bridge.dispose(); bridge = new CodexBotBridge(owner.database, native.port);
  await assert.rejects(bridge.request("client", "bot/message/send", input), (e: any) => e.domainCode === "BOT_RESULT_UNKNOWN");
  assert.equal(native.calls.filter(x => x === "turn/start").length, count);
  bridge.dispose(); owner.close();
}));

test("history and live replay retain one stable message identity through borrower restart", async () => fixture(async root => {
  const owner = new CodexHostStateDatabase(root), native = nativePort();
  let bridge = new CodexBotBridge(owner.database, native.port);
  const created: any = await bridge.request("client", "bot/conversation/create", create);
  const id = created.conversation.conversationId;
  native.threads.get(id).turns = [{ id: "turn", status: "completed", items: [{ id: "item", type: "agentMessage", text: "retained" }] }];
  const history: any = await bridge.request("client", "bot/conversation/read", { conversationId: id });
  const messageId = history.initialMessagesPage.data[0].messageId;
  bridge.observe({ method: "item/completed", params: { threadId: id, turnId: "turn", item: { id: "item", type: "agentMessage", text: "retained" } } });
  assert.equal(native.events.at(-1).params.message.messageId, messageId);
  bridge.dispose(); bridge = new CodexBotBridge(owner.database, native.port);
  const again: any = await bridge.request("client", "bot/conversation/read", { conversationId: id });
  assert.equal(again.initialMessagesPage.data[0].messageId, messageId);
  assert.equal(owner.database.prepare("SELECT count(*) as n FROM codex_bot_message_slots").get()?.n, 1);
  bridge.dispose(); owner.close();
}));

test("live second message before history hydration preserves both IDs through another read and restart", async () => fixture(async root => {
  const owner = new CodexHostStateDatabase(root), native = nativePort();
  let bridge = new CodexBotBridge(owner.database, native.port);
  const created: any = await bridge.request("client", "bot/conversation/create", create);
  const id = created.conversation.conversationId;
  const first = { id: "first", type: "agentMessage", text: "first history" }, second = { id: "second", type: "agentMessage", text: "second live" };
  native.threads.get(id).turns = [{ id: "turn", status: "completed", items: [first, second] }];
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const original = native.port.request;
  native.port.request = async (client, method, params, context) => {
    if (method === "thread/read" && params.includeTurns === true) await hold;
    return original(client, method, params, context);
  };
  const reading = bridge.request("client", "bot/conversation/read", { conversationId: id });
  await new Promise(resolve => setTimeout(resolve, 10));
  bridge.observe({ method: "item/completed", params: { threadId: id, turnId: "turn", item: second } });
  const published = native.events.at(-1).params.message.messageId;
  release();
  const snapshot: any = await reading;
  assert.equal(snapshot.initialMessagesPage.data.find((message: any) => message.content[0].text === second.text).messageId, published);
  assert.equal(new Set(snapshot.initialMessagesPage.data.map((message: any) => message.messageId)).size, 2);
  bridge.dispose(); bridge = new CodexBotBridge(owner.database, native.port);
  const restored: any = await bridge.request("client", "bot/conversation/read", { conversationId: id });
  assert.equal(restored.initialMessagesPage.data.find((message: any) => message.content[0].text === second.text).messageId, published);
  assert.equal(owner.database.prepare("SELECT count(*) as n FROM codex_bot_message_slots").get()?.n, 2);
  bridge.dispose(); owner.close();
}));
