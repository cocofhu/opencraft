import assert from "node:assert/strict";
import test from "node:test";
import { visibleQueuedSubmissions } from "../apps/workbench-web/src/queued-submission-presentation";
import type { QueuedSubmission } from "@opencraft/chat-runtime";

import { asTurnId, createConversationKey, groupTimelineFramesByTurn, type TimelineSnapshot } from "@opencraft/chat-core";
import {
  createConversationDisplayContinuity,
  type ConversationDisplayStorage,
} from "@opencraft/workbench-runtime";

function storage(): ConversationDisplayStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    load: async key => data.get(key) ?? null,
    save: async (key, value) => { data.set(key, value); },
    remove: async key => { data.delete(key); },
  };
}

function timeline(authoritative: boolean): TimelineSnapshot {
  const common = { status: "complete" as const, durationMs: null, hookStats: null, anchors: [] };
  return {
    key: createConversationKey("host", "thread"), revision: 4, phase: "live", authoritative,
    anchorFrameIds: new Map(),
    frames: [
      {
        ...common, id: "user-frame", turnId: asTurnId("turn"), type: "user",
        blocks: [{
          type: "user-message", id: "user", sourceItemIds: [], message: "Hello",
          content: [], attachments: [], messageKind: "user", clientId: null,
          steeringStatus: null, sentAtMs: null, deliveryStatus: "sent",
          referencesPriorConversation: false, reviewMode: false, pullRequestFixMode: false,
          autoResolveSync: false, goal: false, hookFeedback: false,
          commentCount: 0, hasExternalAttachments: false,
        }],
      },
      {
        ...common, id: "assistant-frame", turnId: asTurnId("turn"), type: "assistant",
        blocks: [{ type: "text", id: "answer", sourceItemIds: [], text: "Hi", streaming: false, phase: "final_answer" }],
      },
    ],
  };
}

test("only authoritative completed text becomes a paint-only cached timeline", async () => {
  const local = storage();
  const cache = createConversationDisplayContinuity({ namespace: "account.bot", storage: local, now: () => 1_000 });
  await cache.observe(timeline(false));
  assert.equal(local.data.size, 0);
  await cache.observe(timeline(true));
  const result = await cache.load("host", "thread");
  assert.equal(result?.phase, "painted");
  assert.equal(result?.authoritative, false);
  assert.equal(result?.frames.length, 2);
  assert.equal(groupTimelineFramesByTurn(result!).length, 1);
  assert.deepEqual(result?.frames.flatMap(frame => frame.blocks.map(block => block.type)), ["user-message", "text"]);
  assert.equal(await cache.load("host", "another-thread"), null);
});

test("expired display data is not reused", async () => {
  const local = storage();
  const old = createConversationDisplayContinuity({ namespace: "account", storage: local, now: () => 1_000 });
  await old.observe(timeline(true));
  const later = createConversationDisplayContinuity({ namespace: "account", storage: local,
    now: () => 1_000 + 8 * 24 * 60 * 60 * 1_000 });
  assert.equal(await later.load("host", "thread"), null);
});

function submission() {
  return {
    commandId: "command", clientMessageId: "client-message",
    target: { type: "new-thread" as const, draftId: "draft",
      execution: { hostId: createConversationKey("host", "thread").hostId,
        workspace: { cwd: "/fixture", runtimeWorkspaceRoots: ["/fixture"] } } },
    document: { version: 1 as const, blocks: [{ type: "paragraph" as const,
      children: [{ type: "text" as const, text: "Keep my submitted message" }] }] },
    attachments: [{ id: "file", name: "notes.txt", mimeType: "text/plain", size: 1,
      uri: "/fixture/notes.txt", lifecycle: "ready" as const, error: null }],
    context: [], selections: {}, options: { autoContext: false }, createdAt: 10,
  };
}
const accepted = { commandId: "command", clientMessageId: "client-message", hostId: "host",
  threadId: "thread", turnId: null, acceptedAt: 11, replayed: false };

test("first submission survives promotion and empty baselines without a storage or identity read", async () => {
  const local = storage();
  local.load = async () => { throw new Error("display handoff must be synchronous"); };
  const cache = createConversationDisplayContinuity({ namespace: "account", storage: local });
  const intent = submission();
  cache.retainSubmission(intent, accepted);
  const first = cache.peekSubmission("host", "thread")!;
  assert.equal(first.authoritative, false);
  assert.equal(first.phase, "painted");
  const block = first.frames[0]!.blocks[0]!;
  assert.equal(block.type, "user-message");
  if (block.type !== "user-message") throw new Error("missing submitted message");
  assert.equal(block.message, "Keep my submitted message");
  assert.equal(block.attachments[0]?.type, "file");
  assert.equal(block.clientId, intent.clientMessageId);
  assert.equal(block.sender, undefined);
  assert.equal(await cache.load("host", "thread"), null, "unconfirmed content is not persisted");
  await cache.observe({ ...timeline(true), frames: [] });
  assert.equal(cache.peekSubmission("host", "thread"), first, "empty baseline cannot erase local input");
  cache.retainSubmission(intent, accepted);
  assert.equal(cache.peekSubmission("host", "thread"), first, "promotion retries retain identity");
  await cache.observe(timeline(false));
  assert.equal(cache.peekSubmission("host", "thread"), first, "unconfirmed remote data cannot retire the handoff");
  await cache.observe(timeline(true));
  assert.equal(cache.peekSubmission("host", "thread"), null, "canonical user message replaces local presentation");
});

test("first submission cannot leak across Host, Thread, account or application restart", () => {
  const local = storage();
  const a = createConversationDisplayContinuity({ namespace: "account-a", storage: local });
  a.retainSubmission(submission(), accepted);
  assert.equal(a.peekSubmission("other-host", "thread"), null);
  assert.equal(a.peekSubmission("host", "other-thread"), null);
  for (const namespace of ["account-b", "account-a"]) {
    const fresh = createConversationDisplayContinuity({ namespace, storage: local });
    assert.equal(fresh.peekSubmission("host", "thread"), null);
  }
  assert.throws(() => a.retainSubmission(submission(), { ...accepted, hostId: "other-host" }), /does not match/);
});

test("attachment-only first submission stays visible and transient handoffs are bounded", () => {
  const cache = createConversationDisplayContinuity({ namespace: "account", storage: storage() });
  const intent = { ...submission(), document: { version: 1 as const, blocks: [] } };
  for (let i = 0; i < 65; i++) cache.retainSubmission(intent, { ...accepted, threadId: `thread-${i}` });
  assert.equal(cache.peekSubmission("host", "thread-0"), null);
  const block = cache.peekSubmission("host", "thread-64")!.frames[0]!.blocks[0]!;
  assert.equal(block.type, "user-message");
  if (block.type === "user-message") {
    assert.equal(block.message, "");
    assert.equal(block.attachments.length, 1);
  }
});

test("completed display is available synchronously before persistence completes", async () => {
  const local = storage();
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  local.save = async () => new Promise<void>(resolve => { release = resolve; entered(); });
  const cache = createConversationDisplayContinuity({ namespace: "account", storage: local });
  const writing = cache.observe(timeline(true));
  const painted = cache.peek("host", "thread");
  assert.equal(painted?.authoritative, false);
  assert.equal(painted?.frames.length, 2);
  assert.equal(cache.peek("other-host", "thread"), null);
  await started; release(); await writing;
  local.load = async () => { throw Error("warm display must not wait on storage"); };
  assert.equal(await cache.load("host", "thread"), painted);
});

test("display memory is bounded, expires and is cleared by an authoritative empty transcript", async () => {
  let now = 1_000;
  const cache = createConversationDisplayContinuity({ namespace: "account", storage: storage(), now: () => now });
  for (let i = 0; i < 65; i++) await cache.observe({ ...timeline(true), key: createConversationKey("host", `thread-${i}`) });
  assert.equal(cache.peek("host", "thread-0"), null);
  assert.ok(cache.peek("host", "thread-64"));
  await cache.observe({ ...timeline(true), key: createConversationKey("host", "thread-64"), frames: [] });
  assert.equal(cache.peek("host", "thread-64"), null);
  now += 8 * 24 * 60 * 60 * 1_000;
  assert.equal(cache.peek("host", "thread-63"), null);
});


test("a delayed disk read cannot replace a newer authoritative display", async () => {
  const local = storage();
  const original = createConversationDisplayContinuity({ namespace: "account", storage: local });
  await original.observe(timeline(true));
  const old = [...local.data.values()][0]!;
  let release!: (value: string) => void;
  local.load = async () => new Promise<string>(resolve => { release = resolve; });
  const cache = createConversationDisplayContinuity({ namespace: "account", storage: local });
  const reading = cache.load("host", "thread");
  await new Promise(resolve => setImmediate(resolve));
  const next = { ...timeline(true), frames: [] };
  await cache.observe(next);
  release(old);
  assert.equal(await reading, null);
  assert.equal(cache.peek("host", "thread"), null);
});

test("synchronous display memory cannot cross account namespaces", async () => {
  const local = storage();
  const a = createConversationDisplayContinuity({ namespace: "account-a", storage: local });
  const b = createConversationDisplayContinuity({ namespace: "account-b", storage: local });
  await a.observe(timeline(true));
  assert.ok(a.peek("host", "thread"));
  assert.equal(b.peek("host", "thread"), null);
  assert.equal(await b.load("host", "thread"), null);
});


test("first-send queue display suppresses only the input already painted by its handoff", () => {
  const cache = createConversationDisplayContinuity({ namespace: "account", storage: storage() });
  cache.retainSubmission(submission(), accepted);
  const first = cache.peekSubmission("host", "thread");
  const row: QueuedSubmission = { commandId: "command", clientMessageId: "client-message",
    serverSubmissionId: "queue-first", input: [], preview: "Keep my submitted message",
    state: "queued", operation: "idle", createdAt: 10, pausedReason: null, error: null };
  const followup = { ...row, commandId: "next", clientMessageId: "next-message", serverSubmissionId: "next" };
  assert.deepEqual(visibleQueuedSubmissions([row, followup], first), [followup], "identical text in a distinct message stays queued");
  assert.deepEqual(visibleQueuedSubmissions([{ ...row, state: "submitting" }], first), []);
  assert.deepEqual(visibleQueuedSubmissions([{ ...row, local: true, pausedReason: "outbox-waiting" }], first), []);
  for (const visible of [
    { ...row, state: "failed" as const }, { ...row, state: "unknown" as const },
    { ...row, error: new Error("delivery failed") },
    { ...row, pausedReason: "outbox-unconfirmed" }, { ...row, pausedReason: "outbox-failed" },
    { ...row, pausedReason: "interrupted" }, { ...row, operation: "updating" as const },
  ]) assert.deepEqual(visibleQueuedSubmissions([visible], first), [visible], "recovery/action state must remain accessible");
  const queue = [row, followup];
  assert.equal(visibleQueuedSubmissions(queue, null), queue, "existing conversations keep their queue");
  assert.equal(visibleQueuedSubmissions(queue, cache.peekSubmission("host", "another-thread")), queue);
  assert.equal(queue.length, 2, "presentation never deletes execution queue state");
});
