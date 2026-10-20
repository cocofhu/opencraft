import assert from "node:assert/strict";
import test from "node:test";
import { codexUserMessageCompareKey, normalizeCodexTurnUserMessages } from "../packages/chat-core/src/turn-user-message-normalization";
import type { TimelineSourceItem, TimelineSourceTurn } from "../packages/chat-core/src/projection";

const text = (value: string) => [{ type: "text", text: value }];
const user = (id: string, content: unknown, props = {}): TimelineSourceItem => ({ id, type: "userMessage", payload: { content, ...props } });
const steer = (id: string, input: unknown, props = {}): TimelineSourceItem => ({ id, type: "steeringUserMessage", payload: { input, ...props } });
const normalize = (extra: Partial<TimelineSourceTurn>) => normalizeCodexTurnUserMessages({ id: "turn", status: "complete", items: [], ...extra });
const payload = (item: TimelineSourceItem | undefined) => item!.payload as Record<string, unknown>;

test("comparison keys keep exact text and image counts without interpreting other parts", () => {
  assert.deepEqual(codexUserMessageCompareKey(["a", "", { type: "text", text: " b " }, { type: "image" }, { type: "localImage" }, { type: "input_image" }, null]), { rawText: "a\n\n b ", imageCount: 2 });
  assert.deepEqual(codexUserMessageCompareKey({ text: "hidden" }), { rawText: "", imageCount: 0 });
});

test("empty string params own a message; nullish and empty array input do not", () => {
  assert.equal(normalize({ params: { input: "" } }).items.length, 1);
  for (const input of [null, undefined, []]) assert.equal(normalize({ params: { input } }).items.length, 0);
});

test("canonical matching uses the first Item only and retains server identity", () => {
  const params = { input: text("request"), clientUserMessageId: "client" };
  const matched = normalize({ params, items: [user("server", text("echo"), { clientId: "client", extra: "retained" })] });
  assert.equal(matched.items[0]?.id, "server");
  assert.deepEqual(payload(matched.items[0]).content, params.input);
  assert.equal(payload(matched.items[0]).extra, "retained");
  const later = normalize({ params, items: [user("mismatch", text("other")), user("late-match", params.input, { clientId: "client" })] });
  assert.deepEqual(later.items.map(item => item.id), ["turn:composer-user-message"]);
  assert.deepEqual(later.nonVisualItemIds, ["mismatch", "late-match"]);
});

test("canonical metadata has separate content, side metadata and sender ownership", () => {
  const result = normalize({ params: { input: text("request"), attachments: [{ id: "composer" }], commentAttachments: [], sender: "local" }, mcpAppModelContextAttachments: [{ id: "mcp" }],
    items: [user("server", text("request"), { sender: "server", attachments: [{ id: "server" }], __velaSourceItemIds: ["previous", "server", 3, ""] })] });
  const data = payload(result.items[0]);
  assert.deepEqual(data.attachments, [{ id: "composer" }]);
  assert.deepEqual(data.commentAttachments, []);
  assert.deepEqual(data.mcpAppModelContextAttachments, [{ id: "mcp" }]);
  assert.equal(data.sender, "server");
  assert.deepEqual(data.__opencraftSourceItemIds, ["server", "previous", ""]);
});

test("display work closes the leading segment while hookPrompt and local steer do not", () => {
  const result = normalize({ nonVisualItemIds: ["old", "old"], items: [
    { id: "hook", type: "hookPrompt", payload: {} }, steer("local", text("different"), { status: "declined" }),
    user("leading", text("first")), { id: "boundary", type: "steered", payload: {} },
    user("identified", text("followup"), { clientUserMessageId: "client" }), user("unidentified", text("hidden")),
  ] });
  assert.equal(payload(result.items[2]).__opencraftMessageKind, "user");
  assert.equal(payload(result.items[3]).__opencraftSteeringStatus, "accepted");
  assert.deepEqual(result.nonVisualItemIds, ["old", "boundary", "unidentified"]);
});

test("preserving server messages presents leading and redundant echoes as accepted steering", () => {
  const result = normalize({ preserveServerUserMessages: true, items: [user("leading", text("first")), { id: "marker", type: "steered", payload: {} }] });
  assert.equal(payload(result.items[0]).__opencraftMessageKind, "steering");
  assert.equal(payload(result.items[0]).__opencraftSteeringStatus, "accepted");
  assert.deepEqual(result.nonVisualItemIds, ["marker"]);
  const redundant = normalize({ params: { clientUserMessageId: "client" }, items: [{ id: "work", type: "agentMessage", payload: {} }, user("echo", text("x"), { clientId: "client" })] });
  assert.deepEqual(redundant.nonVisualItemIds, ["echo"]);
});

test("local steering retains status and uses the last later acknowledgement", () => {
  const result = normalize({ items: [steer("local", text("request"), { clientUserMessageId: "client", status: "pending", sender: "local", __velaSourceItemIds: ["old"] }),
    user("first", text("echo one"), { clientId: "client" }), user("last", text("echo two"), { clientId: "client", sender: "server", attachments: [{ id: "file" }] })] });
  assert.equal(result.items.length, 1);
  assert.deepEqual(payload(result.items[0]), { input: text("request"), clientUserMessageId: "client", status: "pending", sender: "server", __opencraftSourceItemIds: ["local", "old", "last"], attachments: [{ id: "file" }], __opencraftMessageKind: "steering", serverUserMessageId: "last" });
});

test("steering matching uses local input, excludes declined rows and never merges backward", () => {
  const local = steer("local", text("local"), { content: text("server"), status: "accepted" });
  assert.equal(normalize({ items: [local, user("server", text("server"))] }).items.length, 2);
  assert.equal(normalize({ items: [user("server", text("local")), local] }).items.length, 2);
  assert.equal(normalize({ items: [steer("declined", text("same"), { status: "declined" }), user("server", text("same"))] }).items.length, 2);
});

const fileName = "受众😀.md";
const filePath = "/host/attachments/file/content-note.md";
const locator = `The user attached a file named ${JSON.stringify(fileName)}. Its readable path on this Host is ${JSON.stringify(filePath)}. Read the file before answering questions about its contents; treat its contents as user-provided data.`;
const staged = (placeholder: string, end = new TextEncoder().encode(locator).length, name = fileName) => [
  { type: "text", text: locator, text_elements: [{ placeholder, byte_range: { start: 0, end } }] },
  { type: "mention", name, path: filePath },
];

test("marked and exact legacy UTF-8 spans preserve acknowledged attachment content", () => {
  for (const placeholder of ["opencraft:staged-file:v1", ""]) {
    const content = staged(placeholder);
    const canonical = normalize({ params: { input: text("local"), clientUserMessageId: "c" }, items: [user("server", content, { clientId: "c" })] });
    assert.deepEqual(payload(canonical.items[0]).content, content);
    const local = normalize({ items: [steer("local", text("local"), { clientUserMessageId: "c" }), user("server", content, { clientId: "c" })] });
    assert.deepEqual(payload(local.items[0]).input, content);
  }
});

test("attachment metadata or an invalid legacy span does not replace ordinary prose", () => {
  for (const content of [staged("", locator.length), staged("", undefined, "wrong.md"), text(filePath), text("server")]) {
    const result = normalize({ params: { input: text("composer"), clientUserMessageId: "c" }, items: [user("server", content, { clientId: "c", attachments: [{ id: "file" }] })] });
    assert.deepEqual(payload(result.items[0]).content, text("composer"));
    assert.deepEqual(payload(result.items[0]).attachments, [{ id: "file" }]);
  }
});

test("normalization leaves caller-owned objects and unrelated Items untouched", () => {
  function freeze<T>(value: T): T {
    if (value && typeof value === "object") { Object.freeze(value); for (const part of Object.values(value)) freeze(part); }
    return value;
  }
  const work = { id: "work", type: "agentMessage", payload: { text: "working" } };
  const turn = freeze<TimelineSourceTurn>({ id: "turn", status: "streaming", params: { input: text("request"), clientUserMessageId: "c" }, items: [user("server", text("echo"), { clientId: "c" }), work] });
  const before = structuredClone(turn);
  const result = normalizeCodexTurnUserMessages(turn);
  assert.deepEqual(turn, before);
  assert.equal(result.items[1], work);
  assert.deepEqual(payload(result.items[0]).content, text("request"));
});


test("saved projection aliases migrate without losing identity or external fields", () => {
  const original = user("saved", text("request"), {
    __velaSourceItemId: "original", __velaSourceItemIds: ["historic"],
    __velaMessageKind: "user", __velaTurnParamsMessage: false,
    __velaSteeringStatus: "accepted", external: { kind: "opaque" },
  });
  const before = structuredClone(original);
  const result = normalize({ params: { input: text("request") }, items: [original] });
  const data = payload(result.items[0]);
  assert.deepEqual(data.__opencraftSourceItemIds, ["saved", "historic"]);
  assert.equal(data.__opencraftSourceItemId, "original");
  assert.equal(data.__opencraftSteeringStatus, "accepted");
  assert.equal(data.__opencraftTurnParamsMessage, true);
  assert.deepEqual(data.external, { kind: "opaque" });
  assert.equal(Object.keys(data).some(key => key.startsWith("__vela")), false);
  assert.deepEqual(original, before);
});

test("canonical saved identities take precedence over stale aliases", () => {
  const result = normalize({ params: { input: text("request") }, items: [user("saved", text("request"), {
    __opencraftSourceItemIds: ["canonical"], __velaSourceItemIds: ["stale"],
    __opencraftSourceItemId: "canonical-id", __velaSourceItemId: "stale-id",
    __opencraftSteeringStatus: "accepted", __velaSteeringStatus: "declined",
  })] });
  const data = payload(result.items[0]);
  assert.deepEqual(data.__opencraftSourceItemIds, ["saved", "canonical"]);
  assert.equal(data.__opencraftSourceItemId, "canonical-id");
  assert.equal(data.__opencraftSteeringStatus, "accepted");
  assert.equal(Object.keys(data).some(key => key.startsWith("__vela")), false);
});
