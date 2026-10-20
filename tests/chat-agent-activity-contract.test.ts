import assert from "node:assert/strict";
import test from "node:test";
import {
  agentActivityHeaderAccessibleLabel, countAgentActivityContentItems,
  createAssistantTurnPresentationPlan, createConversationKey,
  createDefaultTimelineProjectorRegistry, deriveAgentActivityHeaderPresentation,
  projectTimeline, resolveAgentActivityLayout,
  type AssistantTimelineFrame, type TimelineSourceItem,
} from "@opencraft/chat-core";

function frame(items: readonly TimelineSourceItem[]): AssistantTimelineFrame {
  const snapshot = projectTimeline({
    key: createConversationKey("fixture", "independent-activity"), revision: 1,
    phase: "live", authoritative: true, turns: [{ id: "turn", status: "complete", items }],
  }, createDefaultTimelineProjectorRegistry());
  const result = snapshot.frames.find(frame => frame.type === "assistant");
  assert.ok(result?.type === "assistant");
  return result;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const command: TimelineSourceItem = { id: "command", type: "commandExecution", payload: { command: "pwd", status: "completed" } };
const answer: TimelineSourceItem = { id: "answer", type: "agentMessage", payload: { phase: "final_answer", text: "Done", completed: true } };

test("repeated changes to one path retain a singular completed file summary", () => {
  const value = frame(["first", "second"].map(id => ({
    id, type: "fileChange", payload: { status: "completed", changes: [{ path: "same.ts", kind: "update" }] },
  })));
  const header = deriveAgentActivityHeaderPresentation({ blocks: value.blocks, lifecycle: {
    isLatestVisibleUnit: true, isActivitySliceClosed: true, isExploring: false, inProgress: false,
  } });
  assert.equal(agentActivityHeaderAccessibleLabel(header.summary), "Edited a file");
});

test("a standalone work clock is visible metadata and cannot grant a disclosure by itself", () => {
  const value = frame([{ id: "hidden", type: "reasoning", payload: { summary: [] } }, answer]);
  const plan = createAssistantTurnPresentationPlan({ ...value, workStatus: {
    type: "worked-for", status: "worked", startedAtMs: 100, completedAtMs: 1400,
  } });
  const work = plan.slots[0];
  assert.ok(work?.type === "agent-activity");
  assert.equal(countAgentActivityContentItems(work.contentUnits), 1);
  assert.equal(work.collapsedItemCount, 0);
  const layout = resolveAgentActivityLayout(work, true);
  assert.equal(layout.showToggle, false);
  assert.equal(layout.collapsedItemCount, 1);
  assert.deepEqual(layout.visibleUnits.map(unit => unit.type), ["worked-for"]);
});

test("client cancellation replaces a stale working clock without changing frozen observations", () => {
  const value = freeze({ ...frame([command, answer]), status: "interrupted" as const,
    interruptedByThisClient: true, durationMs: 1300, workStatus: {
      type: "worked-for" as const, status: "working" as const, startedAtMs: 100, completedAtMs: null,
    } });
  const before = structuredClone(value);
  const first = createAssistantTurnPresentationPlan(value);
  assert.deepEqual(createAssistantTurnPresentationPlan(structuredClone(value)), first);
  assert.deepEqual(value, before);
  const work = first.slots[0];
  assert.ok(work?.type === "agent-activity");
  assert.deepEqual(work.contentUnits.find(unit => unit.type === "worked-for")?.item, {
    type: "worked-for", status: "stopped", startedAtMs: 0, completedAtMs: 1300,
  });
  assert.equal(resolveAgentActivityLayout(work, true).isCollapsed, false);
});
