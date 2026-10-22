import { TASKS, type TaskDetail, type TaskEvent, type TasksRequestPort } from "@opencraft/appserver-protocol";
import { researchHandoff } from "./research-handoff";

export const AI_FOLLOW_UP_PREFIX = "AI_FOLLOW_UP_V1\n";
export const FOLLOW_UP_LANES = ["todo", "working", "needs", "review", "ready"] as const;
export type FollowUpLane = typeof FOLLOW_UP_LANES[number];
/** A recorded collaboration fact, not an execution command or a CI attestation. */
export interface FollowUpReport {
  readonly lane: FollowUpLane;
  readonly summary: string;
  readonly artifact: string;
  readonly phase?: string;
  readonly decision?: string;
  readonly roundId?: string;
  readonly judgeId?: string | null;
}
export interface FollowUpProjection {
  readonly lane: FollowUpLane;
  readonly report: FollowUpReport | null;
  readonly readyAt: number | null;
  readonly decision: string | null;
  readonly updatedAt: number;
}
export function parseFollowUpReport(text: unknown): FollowUpReport | null {
  if (typeof text !== "string" || text.length > 4096 || !text.startsWith(AI_FOLLOW_UP_PREFIX)) return null;
  try {
    const v = JSON.parse(text.slice(AI_FOLLOW_UP_PREFIX.length));
    if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some(k => !["lane", "summary", "artifact", "phase", "decision", "roundId", "judgeId"].includes(k))) return null;
    const nonempty = (s: unknown): s is string => typeof s === "string" && !!s.trim() && !s.includes("\0");
    if (!FOLLOW_UP_LANES.includes(v.lane) || !nonempty(v.summary) || !nonempty(v.artifact)) return null;
    for (const k of ["phase", "decision", "roundId"]) if (v[k] !== undefined && !nonempty(v[k])) return null;
    if (v.judgeId !== undefined && v.judgeId !== null && !nonempty(v.judgeId)) return null;
    if (v.lane === "needs" && (!nonempty(v.decision) || !nonempty(v.roundId))) return null;
    return v as FollowUpReport;
  } catch { return null; }
}
export function activeFollowUpTask(task: TaskDetail): boolean {
  return task.deletedAt === null && !task.archivedAt && task.status !== "done" && task.status !== "canceled";
}
export function followUpProjection(task: TaskDetail, events: readonly TaskEvent[] = []): FollowUpProjection {
  let current: { report: FollowUpReport; at: number; readyAt: number | null } | null = null;
  for (const event of [...events].sort((a, b) => a.seq - b.seq)) {
    // Status changes close structured rounds. Writers move first, then publish the fact.
    if (["created", "deleted", "restored", "status_changed"].includes(event.type)) current = null;
    if (event.type !== "progress") continue;
    const report = parseFollowUpReport(event.payload.text);
    if (report) current = { report, at: event.createdAt, readyAt: report.lane === "needs"
      ? current?.report.lane === "needs" && current.report.roundId === report.roundId ? current.readyAt : event.createdAt
      : null };
  }
  const compatible = (lane: FollowUpLane) => lane === "todo" ? ["backlog", "todo"].includes(task.status)
    : lane === "working" ? task.status === "in_progress" : task.status === "in_review";
  if (current && compatible(current.report.lane)) return { lane: current.report.lane, report: current.report, readyAt: current.readyAt, decision: current.report.decision ?? null, updatedAt: current.at };
  const legacy = !current && task.status === "in_review" ? researchHandoff(events) : null;
  return { lane: legacy ? "needs" : ["todo", "backlog"].includes(task.status) ? "todo" : task.status === "in_review" ? "review" : "working",
    report: null, readyAt: legacy?.readyAt ?? null, decision: legacy?.decision ?? null,
    updatedAt: task.latestProgress?.createdAt ?? task.updatedAt };
}
/** Current-cycle reads are bounded. A truncated history never supplies a waiting clock. */
export async function readFollowUpEvents(port: TasksRequestPort, taskId: string): Promise<readonly TaskEvent[]> {
  const events: TaskEvent[] = [];
  let beforeSeq: number | undefined;
  for (let i = 0; i < 50; i++) {
    const page = await port.request(TASKS.events, { taskId, limit: 100, ...(beforeSeq === undefined ? {} : { beforeSeq }) });
    events.push(...page.events);
    if (page.events.some(e => ["created", "deleted", "restored"].includes(e.type) || e.type === "status_changed" && e.payload.to !== "in_review") || page.nextBeforeSeq === null) return events;
    if (beforeSeq !== undefined && page.nextBeforeSeq >= beforeSeq) throw new Error("Invalid follow-up activity cursor");
    beforeSeq = page.nextBeforeSeq;
  }
  throw new Error("Follow-up activity is incomplete");
}
export function followUpTaskKey(task: TaskDetail): string {
  return JSON.stringify([task.id, task.revision, task.latestProgress?.eventId]);
}
