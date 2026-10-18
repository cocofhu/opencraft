/** Host-owned schedules. Times are UTC epoch milliseconds; zone is display metadata. */
export const CONVERSATION_SCHEDULES = {
  list: "opencraft/schedules/list", read: "opencraft/schedules/read", save: "opencraft/schedules/save", action: "opencraft/schedules/action",
} as const;
export const CONVERSATION_SCHEDULES_EXTENSION = "opencraft/conversation-schedules";
export interface ConversationSchedule {
  id: string; threadId: string; prompt: string; nextRunAt: number; intervalMinutes: number | null;
  timeZone: string; status: "active" | "paused" | "completed" | "deleted"; revision: number;
  createdBy: string | null; updatedAt: number;
}
export type ScheduleRunState = "waiting" | "submitting" | "running" | "completed" | "failed" | "unknown" | "reviewed";
export interface ConversationScheduleRun {
  id: string; scheduleId: string; threadId: string; scheduledAt: number; state: ScheduleRunState;
  turnId: string | null; updatedAt: number;
}
export interface ConversationScheduleView { schedule: ConversationSchedule | null; runs: ConversationScheduleRun[]; }
export interface ConversationScheduleSummary {
  threadId: string; status: ConversationSchedule["status"]; nextRunAt: number; needsReview: boolean;
}
export interface ConversationSchedulesMethodMap {
  "opencraft/schedules/list": { params: Record<string, never>; result: { schedules: ConversationScheduleSummary[] } };
  "opencraft/schedules/read": { params: { threadId: string }; result: ConversationScheduleView };
  "opencraft/schedules/save": { params: { threadId: string; expectedRevision: number; prompt: string;
    nextRunAt: number; intervalMinutes: number | null; timeZone: string }; result: ConversationScheduleView };
  "opencraft/schedules/action": { params: { threadId: string; expectedRevision: number;
    action: "pause" | "resume" | "delete" | "run-now" | "review" }; result: ConversationScheduleView };
}
export interface ConversationSchedulesRequestPort {
  request<M extends keyof ConversationSchedulesMethodMap>(method: M, params: ConversationSchedulesMethodMap[M]["params"]): Promise<ConversationSchedulesMethodMap[M]["result"]>;
}
