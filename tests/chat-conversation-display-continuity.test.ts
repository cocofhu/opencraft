import assert from "node:assert/strict";
import test from "node:test";

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
