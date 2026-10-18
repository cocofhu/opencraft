import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { openManagedDatabase, createSchemaValidator } from "@opencraft/sqlite-node";
import type { ConversationSchedule, ConversationScheduleRun, ConversationScheduleView, ConversationScheduleSummary } from "@opencraft/appserver-protocol";

/** Engine boundary: a stable occurrence ID must survive retries and Host restarts.
 * submit must not steer. An ambiguous acceptance must return unknown, never throw
 * a retryable error after it might have reached the engine. */
export interface ScheduleExecutionPort {
  validate(threadId: string): Promise<void>;
  submit(run: ConversationScheduleRun, prompt: string, canAdmit: () => boolean): Promise<{ state: "waiting" | "running" | "completed" | "failed" | "unknown"; turnId?: string }>;
  inspect(run: ConversationScheduleRun): Promise<{ state: "running" | "completed" | "failed" | "unknown" }>;
}
const schema = `
CREATE TABLE schedules (thread_id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
CREATE TABLE schedule_runs (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, value TEXT NOT NULL) STRICT;
CREATE INDEX schedule_runs_thread ON schedule_runs(thread_id);
`;
const unfinished = new Set(["waiting", "submitting", "running", "unknown"]);
export class ScheduleFault extends Error { constructor(readonly code: number, message: string) { super(message); } }
function fault(): never { throw new ScheduleFault(-32602, "Invalid schedule command"); }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
/** One writer per Host, guarded by the Host's existing writer lease. No browser lifetime. */
export class ConversationSchedules {
  private readonly managed;
  readonly outcome;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: Promise<void> | null = null;
  private stopped = false;
  private closing: Promise<void> | null = null;
  private inTransaction = false;
  private summarySignature = "";
  private readonly retries = new Map<string, number>();
  constructor(directory: string, private readonly port: ScheduleExecutionPort,
    private readonly now = Date.now, private readonly diagnostic: (event: { event: string; scheduleId?: string }) => void = () => {},
    private readonly changed: () => void = () => {}) {
    this.managed = openManagedDatabase({ path: join(directory, "conversation-schedules.sqlite"), legacyPolicy: "reject-unknown",
      validateSchema: createSchemaValidator(schema), migrations: [{ version: 1, name: "conversation-schedules", sql: schema }] });
    this.outcome = this.managed.outcome;
    this.summarySignature = JSON.stringify(this.list());
  }
  private get db() { return this.managed.database; }
  private schedule(threadId: string): ConversationSchedule | null {
    const row = this.db.prepare("SELECT value FROM schedules WHERE thread_id=?").get(threadId);
    return row ? JSON.parse(String(row.value)) : null;
  }
  private runs(threadId: string): ConversationScheduleRun[] {
    return this.db.prepare("SELECT value FROM schedule_runs WHERE thread_id=? ORDER BY rowid DESC LIMIT 30").all(threadId)
      .map(row => JSON.parse(String(row.value)) as ConversationScheduleRun);
  }
  private writeSchedule(value: ConversationSchedule) {
    this.db.prepare("INSERT INTO schedules VALUES(?,?) ON CONFLICT(thread_id) DO UPDATE SET value=excluded.value").run(value.threadId, JSON.stringify(value));
    this.publishChanged();
  }
  private writeRun(value: ConversationScheduleRun) {
    this.db.prepare("INSERT INTO schedule_runs VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").run(value.id, value.threadId, JSON.stringify(value));
    this.publishChanged();
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE"); this.inTransaction = true;
    let result: T;
    try { result = fn(); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
    finally { this.inTransaction = false; }
    this.publishChanged(); return result;
  }
  /** Public catalog projection: no prompts, creator identities or execution history. */
  list(): { schedules: ConversationScheduleSummary[] } {
    const rows = this.db.prepare(`SELECT s.value,
      EXISTS(SELECT 1 FROM schedule_runs r WHERE r.thread_id=s.thread_id AND json_extract(r.value,'$.state')='unknown') AS needs_review
      FROM schedules s ORDER BY s.thread_id`).all();
    return { schedules: rows.flatMap(row => {
      const plan = JSON.parse(String(row.value)) as ConversationSchedule;
      const needsReview = Boolean(row.needs_review);
      return plan.status === "active" || plan.status === "paused" || needsReview
        ? [{ threadId: plan.threadId, status: plan.status, nextRunAt: plan.nextRunAt, needsReview }] : [];
    }) };
  }
  private publishChanged() {
    if (this.inTransaction) return;
    const signature = JSON.stringify(this.list());
    if (signature === this.summarySignature) return;
    this.summarySignature = signature;
    try { this.changed(); } catch { /* A notification observer cannot roll back committed state. */ }
  }
  read(threadId: string): ConversationScheduleView { return { schedule: this.schedule(threadId), runs: this.runs(threadId) }; }
  async handle(method: string, input: unknown, createdBy: string | null): Promise<ConversationScheduleView> {
    const p = object(input), threadId = p.threadId;
    if (typeof threadId !== "string" || !threadId.trim() || threadId.length > 512) fault();
    if (method === "opencraft/schedules/read") return this.read(threadId);
    if (method !== "opencraft/schedules/save" && method !== "opencraft/schedules/action") throw new ScheduleFault(-32601, "Unsupported schedule method");
    await this.port.validate(threadId);
    if (this.stopped) throw new ScheduleFault(-32000, "Schedule service is closing");
    this.transaction(() => {
      const prior = this.schedule(threadId), now = this.now();
      if (!Number.isInteger(p.expectedRevision) || p.expectedRevision !== (prior?.revision ?? 0)) throw new ScheduleFault(-32009, "Schedule changed; reload before editing");
      const pending = this.runs(threadId).find(run => unfinished.has(run.state));
      if (method.endsWith("/save")) {
        if (pending) throw new ScheduleFault(-32009, "Previous occurrence is unfinished; review it before replacing the schedule");
        if (typeof p.prompt !== "string" || !p.prompt.trim() || p.prompt.length > 32000
          || !Number.isSafeInteger(p.nextRunAt) || Number(p.nextRunAt) < now - 5000
          || Number(p.nextRunAt) > now + 5 * 366 * 86400000
          || !(p.intervalMinutes === null || Number.isInteger(p.intervalMinutes) && Number(p.intervalMinutes) >= 1 && Number(p.intervalMinutes) <= 525600)
          || typeof p.timeZone !== "string") fault();
        try { new Intl.DateTimeFormat("en", { timeZone: p.timeZone }); } catch { fault(); }
        this.writeSchedule({ id: prior?.status !== "deleted" && prior ? prior.id : randomUUID(), threadId, prompt: p.prompt.trim(),
          nextRunAt: Number(p.nextRunAt), intervalMinutes: p.intervalMinutes as number | null, timeZone: p.timeZone,
          status: "active", revision: (prior?.revision ?? 0) + 1, createdBy: prior && prior.status !== "deleted" ? prior.createdBy : createdBy, updatedAt: now });
      } else {
        if (!prior || prior.status === "deleted" && p.action !== "review") fault();
        if (!["pause", "resume", "delete", "run-now", "review"].includes(String(p.action))) fault();
        if (p.action === "run-now" && (pending || prior.status !== "active")) throw new ScheduleFault(-32009, "Previous occurrence is unfinished");
        const value = { ...prior, revision: prior.revision + 1, updatedAt: now };
        if (p.action === "review") {
          if (!pending || pending.state !== "unknown") fault();
          this.writeRun({ ...pending, state: "reviewed", updatedAt: now });
          // Explicit acknowledgement is NOT successful execution and never resends.
          value.status = prior.status === "deleted" ? "deleted" : "paused";
        } else if (p.action === "pause" || p.action === "delete") {
          value.status = p.action === "pause" ? "paused" : "deleted";
          if (pending?.state === "waiting") this.writeRun({ ...pending, state: "failed", updatedAt: now });
        } else if (p.action === "resume") {
          value.status = "active"; value.nextRunAt = Math.max(now, prior.nextRunAt);
        } else {
          this.writeRun({ id: `schedule:${prior.id}:manual:${value.revision}`, scheduleId: prior.id, threadId,
            scheduledAt: now, state: "waiting", turnId: null, updatedAt: now });
        }
        this.writeSchedule(value);
      }
    });
    return this.read(threadId);
  }
  suspend(threadId: string) {
    if (this.stopped) return;
    this.transaction(() => {
      const plan = this.schedule(threadId);
      if (!plan || plan.status !== "active") return;
      const now = this.now();
      this.writeSchedule({ ...plan, status: "paused", revision: plan.revision + 1, updatedAt: now });
      for (const run of this.runs(threadId)) if (run.state === "waiting") this.writeRun({ ...run, state: "failed", updatedAt: now });
    });
  }
  start() {
    if (this.timer || this.stopped) return;
    this.timer = setInterval(() => { void this.tick(); }, 2000); this.timer.unref();
    void this.tick();
  }
  tick(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.stopped) return Promise.resolve();
    this.pending = Promise.resolve().then(() => this.advance()).catch(() => this.diagnostic({ event: "schedule-tick-failed" })).finally(() => { this.pending = null; });
    return this.pending;
  }
  private async advance() {
    const schedules = this.db.prepare("SELECT value FROM schedules").all().map(row => JSON.parse(String(row.value)) as ConversationSchedule);
    for (const snapshot of schedules) {
      if (this.stopped) break;
      let plan = this.schedule(snapshot.threadId)!;
      let run = this.runs(plan.threadId).find(value => unfinished.has(value.state));
      if (!run && plan.status === "active" && plan.nextRunAt <= this.now()) {
        run = { id: `schedule:${plan.id}:${plan.nextRunAt}`, scheduleId: plan.id, threadId: plan.threadId,
          scheduledAt: plan.nextRunAt, state: "waiting", turnId: null, updatedAt: this.now() };
        this.writeRun(run);
      }
      if (run?.state === "waiting" && plan.status !== "active") { this.writeRun({ ...run, state: "failed", updatedAt: this.now() }); continue; }
      if (!run || run.state === "unknown" || (this.retries.get(run.id) ?? 0) > this.now()) continue;
      try {
        if (run.state === "waiting" || run.state === "submitting") {
          // Persist intent before crossing the engine boundary. Re-entry uses the SAME ID.
          if (run.state === "waiting") { run = { ...run, state: "submitting", updatedAt: this.now() }; this.writeRun(run); }
          const occurrence = run;
          const result = await this.port.submit(run, plan.prompt, () => {
            const current = this.schedule(occurrence.threadId);
            return !this.stopped && current?.id === occurrence.scheduleId && current.status === "active";
          });
          run = { ...run, state: result.state, turnId: result.turnId ?? run.turnId, updatedAt: this.now() };
        } else {
          const result = await this.port.inspect(run);
          run = { ...run, state: result.state, updatedAt: this.now() };
        }
        const settled = run;
        this.transaction(() => {
          this.writeRun(settled);
          plan = this.schedule(plan.threadId)!;
          if ((settled.state === "completed" || settled.state === "failed") && plan.status === "active" && !settled.id.includes(":manual:")) {
            const step = plan.intervalMinutes === null ? null : plan.intervalMinutes * 60000;
            this.writeSchedule({ ...plan, status: step === null ? "completed" : "active",
              nextRunAt: step === null ? plan.nextRunAt : plan.nextRunAt + Math.max(1, Math.floor((this.now() - plan.nextRunAt) / step) + 1) * step,
              revision: plan.revision + 1, updatedAt: this.now() });
          }
        });
        if (run.state === "waiting" || run.state === "running") this.retries.set(run.id, this.now() + (run.state === "waiting" ? 5000 : 15000));
        else this.retries.delete(run.id);
      } catch {
        this.retries.set(run.id, this.now() + 30000);
        this.diagnostic({ event: "schedule-execution-check-failed", scheduleId: plan.id });
      }
    }
  }
  close(): Promise<void> {
    return this.closing ??= (async () => {
      this.stopped = true;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      await this.pending;
      this.db.close();
    })();
  }
}
