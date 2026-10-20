import assert from "node:assert/strict";
import { test } from "node:test";
import { TASKS, type TaskDetail, type TaskEvent, type TasksRequestPort } from "@opencraft/appserver-protocol";
import { HUMAN_WAIT_THRESHOLD_MS, RESEARCH_HANDOFF_PREFIX, isMorningResearchTask, isOverdueHandoff, parseResearchHandoff, readResearchHandoff, researchHandoff } from "../plugins/tasks/src/research-handoff";
const body = { output: "Report with evidence", decision: "Approve scope A?", nextStep: "Design A after decision" };
const report = RESEARCH_HANDOFF_PREFIX + JSON.stringify(body);
function event(seq: number, type: TaskEvent["type"], payload: TaskEvent["payload"], createdAt = seq * 1000): TaskEvent {
  return { seq, eventId: `event-${seq}`, taskId: "task", type, payload, createdAt, taskRevision: seq, actor: null, channel: "agent" };
}
const start = event(1, "status_changed", { from: "backlog", to: "in_progress" });
const ready = event(2, "progress", { text: report });
const review = event(3, "status_changed", { from: "in_progress", to: "in_review" });
test("triage, ordinary reports, and review status alone never establish readiness", () => {
  for (const text of ["Done; please review", RESEARCH_HANDOFF_PREFIX + "{}", RESEARCH_HANDOFF_PREFIX + JSON.stringify({ ...body, decision: " " }), RESEARCH_HANDOFF_PREFIX + JSON.stringify({ ...body, readyAt: 123 })]) assert.equal(parseResearchHandoff(text), null);
  assert.equal(researchHandoff([start, review, event(4, "progress", { text: "Done" })]), null);
  assert.equal(researchHandoff([start, ready]), null);
});
test("ready time requires output AND entry into visible review; edits/repeated reports cannot reset it", () => {
  assert.deepEqual(researchHandoff([review, ready, start, event(4, "updated", { title: "Reworded" }), event(5, "progress", { text: report })]), { ...body, eventId: ready.eventId, readyAt: review.createdAt });
  assert.equal(researchHandoff([start, review, event(4, "progress", { text: report })])!.readyAt, 4000);
});
test("leaving review closes the round; re-entry needs a fresh handoff", () => {
  const exit = event(4, "status_changed", { from: "in_review", to: "in_progress" });
  const next = event(6, "status_changed", { from: "in_progress", to: "in_review" });
  assert.equal(researchHandoff([start, ready, review, exit, next]), null);
  assert.equal(researchHandoff([start, ready, review, exit, event(5, "progress", { text: report }), next])!.readyAt, 6000);
  assert.equal(researchHandoff([start, ready, review, event(4, "deleted", {}), event(5, "restored", {}), next]), null);
});
test("72 hours is strict, and future handoffs cannot be overdue", () => {
  const handoff = researchHandoff([start, ready, review])!;
  assert.equal(isOverdueHandoff(handoff, handoff.readyAt - 1), false);
  assert.equal(isOverdueHandoff(handoff, handoff.readyAt + HUMAN_WAIT_THRESHOLD_MS), false);
  assert.equal(isOverdueHandoff(handoff, handoff.readyAt + HUMAN_WAIT_THRESHOLD_MS + 1), true);
});
test("context, unassessed, completed, deleted and archived items stay off the morning queue", () => {
  const task = { status: "backlog", aiResearch: "proactive", deletedAt: null } as TaskDetail;
  assert.equal(isMorningResearchTask(task), true);
  for (const change of [{ aiResearch: "needs_context" }, { aiResearch: "unassessed" }, { aiResearch: "needs_decision" }, { status: "done" }, { status: "canceled" }, { deletedAt: 1 }, { archivedAt: 1 }]) assert.equal(isMorningResearchTask({ ...task, ...change } as TaskDetail), false);
  assert.equal(isMorningResearchTask({ ...task, aiResearch: "needs_decision", status: "in_review" }), true);
});
test("paged history finds the first handoff rather than the most recent report", async () => {
  const calls: unknown[] = [];
  const port: TasksRequestPort = { request: (async (method: string, params: unknown) => {
    assert.equal(method, TASKS.events); calls.push(params);
    return calls.length === 1 ? { events: [event(5, "progress", { text: report }), review], nextBeforeSeq: 3 } : { events: [ready, start], nextBeforeSeq: 1 };
  }) as TasksRequestPort["request"] };
  assert.equal((await readResearchHandoff(port, "task"))!.readyAt, 3000);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], { taskId: "task", limit: 100, beforeSeq: 3 });
});
test("unreadable or incomplete history is unknown, never a guessed clock", async () => {
  const failed: TasksRequestPort = { request: async () => { throw new Error("offline"); } };
  await assert.rejects(readResearchHandoff(failed, "task"), /offline/);
  const truncated: TasksRequestPort = { request: (async () => ({ events: [review], nextBeforeSeq: 3 })) as TasksRequestPort["request"] };
  await assert.rejects(readResearchHandoff(truncated, "task"), /cursor/);
});
