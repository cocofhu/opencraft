import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CodexHostStateDatabase } from "../apps/opencraft-daemon/src/codex-host-state-database.js";
import { TokenUsageStateDatabase } from "../apps/opencraft-daemon/src/token-usage-state-database.js";
import { CodexTokenUsageLedger } from "../apps/opencraft-daemon/src/token-usage-ledger.js";
import { CodexTokenUsageRuntime } from "../apps/opencraft-daemon/src/token-usage-runtime.js";

const key = { threadId: "thread", turnId: "turn" };
function seed(state: CodexHostStateDatabase | TokenUsageStateDatabase, id = "response", tokens = "600") {
  const ledger = new CodexTokenUsageLedger(state, "server", () => 1000);
  ledger.startTurn(key, 1000, "human", true);
  for (const actorId of ["A", "B"]) ledger.recordInput(key, { inputId: actorId, actorId, actorKind: "human", mode: "start", admission: "confirmed" });
  ledger.recordSource({ ...key, lineage: "native", sourceId: id, kind: "response", version: 0, provider: "provider", model: "model", counts: { totalTokens: tokens } });
  ledger.reconcile(key, { executionState: "completed", participantsComplete: true, usageComplete: true, responsesComplete: true });
  ledger.rememberRollout(key.threadId, "/fixture/rollout.jsonl");
  ledger.advanceRollout(key.threadId, "/fixture/rollout.jsonl", "123");
  return ledger;
}
async function fixture(run: (directory: string, legacy: CodexHostStateDatabase) => void | Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "oc-token-owner-"));
  const legacy = new CodexHostStateDatabase(directory);
  try { await run(directory, legacy); } finally { legacy.close(); await rm(directory, { recursive: true, force: true }); }
}

test("dedicated metering owner copies all facts and recovery state exactly once without sender data or legacy writes", () => fixture((directory, legacy) => {
  const old = seed(legacy);
  legacy.database.prepare("INSERT INTO message_senders VALUES(?,?,?,?)").run("thread", "body", "SENSITIVE_SYNTHETIC_CANARY", 1000);
  const before = legacy.database.prepare("SELECT * FROM token_usage_sources").all();
  const path = join(directory, "codex-host-queue.sqlite");
  let isolated = new TokenUsageStateDatabase(directory, path);
  assert.deepEqual(isolated.database.prepare("SELECT * FROM token_usage_sources").all(), before);
  assert.equal(isolated.database.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name='message_senders'").get()!.n, 0);
  const ledger = new CodexTokenUsageLedger(isolated, "server", () => 1000);
  assert.equal(ledger.readTurn(key)?.observedTokens, "600");
  assert.deepEqual(ledger.readAllocations(key).map(row => row.tokens), ["300", "300"]);
  assert.equal(ledger.rollout(key.threadId)?.cursor, "123");
  seed(isolated, "new-response", "200");
  isolated.close();
  isolated = new TokenUsageStateDatabase(directory, path);
  try {
    assert.equal(new CodexTokenUsageLedger(isolated, "server", () => 1000).readTurn(key)?.observedTokens, "800");
    assert.equal(isolated.database.prepare("SELECT count(*) AS n FROM token_usage_legacy_import").get()!.n, 1);
    assert.equal(old.readTurn(key)?.observedTokens, "600");
    assert.deepEqual(legacy.database.prepare("SELECT * FROM token_usage_sources").all(), before);
    assert.equal(legacy.database.prepare("SELECT sender_json FROM message_senders").get()!.sender_json, "SENSITIVE_SYNTHETIC_CANARY");
  } finally { isolated.close(); }
}));

test("a failed late import rolls back every copied table and can retry with the same managed destination", () => fixture((directory, legacy) => {
  seed(legacy);
  legacy.database.exec("ALTER TABLE token_usage_turns ADD COLUMN synthetic_extra TEXT");
  assert.throws(() => new TokenUsageStateDatabase(directory, join(directory, "codex-host-queue.sqlite")), /schema mismatch/);
  const raw = new DatabaseSync(join(directory, "token-usage.sqlite"));
  try {
    assert.equal(raw.prepare("SELECT count(*) AS n FROM token_usage_sources").get()!.n, 0);
    assert.equal(raw.prepare("SELECT count(*) AS n FROM token_usage_legacy_import").get()!.n, 0);
  } finally { raw.close(); }
  legacy.database.exec("ALTER TABLE token_usage_turns DROP COLUMN synthetic_extra");
  const isolated = new TokenUsageStateDatabase(directory, join(directory, "codex-host-queue.sqlite"));
  try { assert.equal(isolated.database.prepare("SELECT count(*) AS n FROM token_usage_sources").get()!.n, 1); }
  finally { isolated.close(); }
}));

test("a metering writer lock cannot lock the Host sender owner, and unwritable gap evidence remains visible in memory", () => fixture((directory, legacy) => {
  const isolated = new TokenUsageStateDatabase(directory, join(directory, "codex-host-queue.sqlite"));
  const ledger = new CodexTokenUsageLedger(isolated, "server", () => 1000);
  const runtime = new CodexTokenUsageRuntime(ledger, { request: async () => ({}), diagnostic: () => {} });
  const blocker = new DatabaseSync(join(directory, "token-usage.sqlite"));
  blocker.exec("BEGIN IMMEDIATE");
  try {
    legacy.database.prepare("INSERT INTO message_senders VALUES(?,?,?,?)").run("thread", "input", "{}", 1000);
    runtime.submission({ threadId: "thread", inputId: "input", actorId: "A", actorKind: "human", mode: "start", sourceKind: "human", submittedAt: 1000 });
    assert.equal(runtime.liveGapCount(), 1, "failure remains partial even though the fault could not persist itself");
    assert.equal(legacy.database.prepare("SELECT count(*) AS n FROM message_senders").get()!.n, 1);
  } finally { blocker.exec("ROLLBACK"); blocker.close(); runtime.close(); isolated.close(); }
}));

test("a legacy writer after cutover is rejected without overwriting either history", () => fixture((directory, legacy) => {
  seed(legacy);
  const path = join(directory, "codex-host-queue.sqlite");
  const isolated = new TokenUsageStateDatabase(directory, path);
  seed(isolated, "new-owner", "200");
  isolated.close();
  seed(legacy, "legacy-writer", "300");
  assert.throws(() => new TokenUsageStateDatabase(directory, path), /changed after cutover/);
  const raw = new DatabaseSync(join(directory, "token-usage.sqlite"), { readOnly: true });
  try { assert.equal(raw.prepare("SELECT observed_tokens FROM token_usage_turns").get()!.observed_tokens, "800"); }
  finally { raw.close(); }
  assert.equal(new CodexTokenUsageLedger(legacy, "server", () => 1000).readTurn(key)?.observedTokens, "900");
}));
