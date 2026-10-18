/** Recovery scheduling only. Session/Replica keep data and authority ownership. */
export type RecoveryDemand = "visible" | "open" | "cache";
export interface RecoveryClock {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(timer: unknown): void;
  now?(): number;
}
export interface RecoveryTask {
  readonly key: object;
  demand(): RecoveryDemand;
  run(): Promise<void>;
  retryable(error: unknown): boolean;
  readonly propagateFailure?: boolean;
}
interface Work { task: RecoveryTask; attempt: number; propagateFailure: boolean; resolve(error?: unknown): void; promise: Promise<void> }
const rank = { visible: 0, open: 1, cache: 2 } as const;
const delays = [500, 1_000, 2_000, 5_000, 15_000, 30_000, 60_000];
let episodeSequence = 0;

/** One owner per Host, independent of DOM retention and physical transport. */
export class ConversationRecoveryOwner {
  private attempt = 0;
  private connectionTimer: unknown = null;
  private stableTimer: unknown = null;
  private stableTicket = 0;
  private connectionTicket = 0;
  private generation = 0;
  private work = new Map<object, Work>();
  private timers = new Map<object, unknown>();
  private active = new Set<object>();
  private disposed = false;
  private connected = true;
  private stages = 0;
  private episode: { id: string; start: number; requests: number; bytes: number; projectionMs: number; extraConversations: Set<object> } | null = null;
  constructor(private readonly input: {
    hostId: string; clock: RecoveryClock; reconnect(): Promise<unknown>;
    delaysMs?: readonly number[]; stableMs?: number; concurrency?: number;
    log?(event: Readonly<Record<string, string | number>>): void;
  }) {}
  get reconnectAttempt() { return this.attempt; }
  get observing() { return this.episode !== null; }
  get waiting() { return this.connectionTimer !== null; }
  private now() { return this.input.clock.now?.() ?? Date.now(); }
  begin(reason: string) {
    if (["transport-unavailable", "waiting", "connecting", "manual-block"].includes(reason)) this.connected = false;
    if (this.episode === null) this.episode = {
      id: `recovery-${this.now().toString(36)}-${++episodeSequence}`, start: this.now(),
      requests: 0, bytes: 0, projectionMs: 0, extraConversations: new Set(),
    };
    this.stage(reason);
  }
  stage(stage: string, fields: Record<string, string | number> = {}) {
    if (!this.episode) return;
    const event = { hostId: this.input.hostId, recoveryId: this.episode.id, stage,
      elapsedMs: Math.max(0, this.now() - this.episode.start), ...fields };
    try { if (this.input.log) this.input.log(event); else console.log("[appserver-recovery]", event); } catch { /* Diagnostics cannot affect recovery. */ }
  }
  requestStarted() { if (this.episode) this.episode.requests++; }
  response(bytes = 0) { if (this.episode) this.episode.bytes += bytes; }
  scheduled() { this.settle(); }
  async span<T>(stage: string, run: () => Promise<T>): Promise<T> {
    const episode = this.episode, start = this.now(); this.stages++;
    try { const result = await run(); if (this.episode === episode) this.stage(stage, { durationMs: this.now() - start }); return result; }
    catch (error) { if (this.episode === episode) this.stage(stage + "-failed", { durationMs: this.now() - start }); throw error; }
    finally { this.stages--; this.settle(); }
  }
  private settle() {
    if (!this.connected || this.work.size || this.stages || !this.episode) return;
    this.stage("settled", { requests: this.episode.requests, responseBytes: this.episode.bytes,
      projectionMs: this.episode.projectionMs, extraConversations: this.episode.extraConversations.size });
    this.episode = null;
  }
  projection(duration: number) { if (this.episode) this.episode.projectionMs += duration; }
  cancelConnection() {
    this.connectionTicket++;
    if (this.connectionTimer !== null) this.input.clock.clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
  }
  unstable() {
    this.stableTicket++;
    if (this.stableTimer !== null) this.input.clock.clearTimeout(this.stableTimer);
    this.stableTimer = null;
  }
  ready(stillReady: () => boolean, stable = true) {
    this.connected = true;
    this.unstable();
    this.stage("host-ready");
    if (!stable) return;
    const ticket = this.stableTicket;
    this.stableTimer = this.input.clock.setTimeout(() => {
      if (ticket !== this.stableTicket || this.disposed) return;
      this.stableTimer = null;
      if (stillReady()) this.attempt = 0;
    }, this.input.stableMs ?? 60_000);
  }
  schedule(manual: boolean, enabled = true) {
    if (this.disposed || !enabled) return;
    if (manual) { this.begin("manual-block"); this.cancelConnection(); return; }
    if (this.waiting) return;
    this.begin("waiting");
    const schedule = this.input.delaysMs ?? delays;
    const delayMs = schedule[Math.min(this.attempt++, schedule.length - 1)] ?? 60_000;
    this.stage("backoff", { attempt: this.attempt, delayMs });
    const ticket = ++this.connectionTicket;
    this.connectionTimer = this.input.clock.setTimeout(() => {
      if (ticket !== this.connectionTicket || this.disposed) return;
      this.connectionTimer = null;
      void this.input.reconnect().catch(() => undefined);
    }, delayMs);
  }
  invalidate() {
    this.generation++;
    for (const timer of this.timers.values()) this.input.clock.clearTimeout(timer);
    this.timers.clear();
    for (const work of this.work.values()) work.resolve();
    this.work.clear();
    // In-flight operations are fenced by the runtime's connection revision.
    this.active.clear();
  }
  remove(key: object) {
    const timer = this.timers.get(key);
    if (timer !== undefined) this.input.clock.clearTimeout(timer);
    this.timers.delete(key);
    this.work.get(key)?.resolve(); this.work.delete(key);
  }
  recover(task: RecoveryTask): Promise<void> {
    if (this.disposed || task.demand() === "cache") return Promise.resolve();
    const previous = this.work.get(task.key);
    if (previous) { previous.propagateFailure ||= task.propagateFailure === true; this.pump(); return previous.promise; }
    let resolve!: (error?: unknown) => void;
    const promise = new Promise<void>((done, reject) => { resolve = error => error === undefined ? done() : reject(error); });
    this.work.set(task.key, { task, attempt: 0, propagateFailure: task.propagateFailure === true, resolve, promise });
    this.pump();
    return promise;
  }
  private pump() {
    if (this.disposed) return;
    const pending = [...this.work.values()].filter(w => !this.active.has(w.task.key) && !this.timers.has(w.task.key))
      .sort((a, b) => rank[a.task.demand()] - rank[b.task.demand()]);
    for (const work of pending) {
      if (this.active.size >= (this.input.concurrency ?? 2)) break;
      if (work.task.demand() === "cache") { this.remove(work.task.key); continue; }
      // Reserve a slot for a newly visible conversation. Background recovery
      // has concurrency one, so a navigation cannot wait behind hidden work.
      if (work.task.demand() !== "visible" && this.active.size > 0) break;
      // Hidden work waits for visible recovery to settle, including failure.
      if (work.task.demand() !== "visible" && [...this.active].some(key => this.work.get(key)?.task.demand() === "visible")) break;
      const key = work.task.key, generation = this.generation;
      this.active.add(key);
      const started = this.now(), demand = work.task.demand();
      if (demand !== "visible" && this.episode) this.episode.extraConversations.add(key);
      void Promise.resolve().then(() => {
        if (generation !== this.generation || this.work.get(key) !== work || this.disposed) return;
        return work.task.run();
      }).then(() => {
        if (generation !== this.generation || this.work.get(key) !== work) return;
        this.stage("history-authoritative", { demand, durationMs: this.now() - started });
        work.resolve(); this.work.delete(key);
      }, error => {
        if (generation !== this.generation || this.work.get(key) !== work) return;
        this.stage("history-failed", { demand, durationMs: this.now() - started });
        if (work.attempt < 3 && work.task.retryable(error)) {
          const delayMs = (this.input.delaysMs ?? delays)[Math.min(work.attempt++, 6)] ?? 5_000;
          this.timers.set(key, this.input.clock.setTimeout(() => {
            if (generation !== this.generation || this.work.get(key) !== work) return;
            this.timers.delete(key); this.pump();
          }, delayMs));
        } else { work.resolve(work.propagateFailure ? error : undefined); this.work.delete(key); }
      }).finally(() => {
        if (generation !== this.generation) return;
        this.active.delete(key); this.pump();
        this.settle();
      });
    }
  }
  dispose() { this.disposed = true; this.cancelConnection(); this.unstable(); this.invalidate(); }
}

/**
 * Presentation independent policy for revalidating a visible conversation.
 * Platform adapters report foreground and connectivity changes. The Host
 * runtime remains the only authority for the resulting history.
 */
export interface ConversationReturnProbe {
  background(now: number): void;
  foreground(now: number): boolean;
  offline(): void;
  online(now: number): boolean;
}

export function createConversationReturnProbe(input: {
  readonly minimumBackgroundMs?: number;
  readonly minimumProbeIntervalMs?: number;
} = {}): ConversationReturnProbe {
  const minimumBackgroundMs = input.minimumBackgroundMs ?? 15_000;
  const minimumProbeIntervalMs = input.minimumProbeIntervalMs ?? 5_000;
  let backgroundAt: number | null = null;
  let disconnected = false;
  let lastProbeAt = Number.NEGATIVE_INFINITY;
  const admit = (now: number) => {
    if (now - lastProbeAt < minimumProbeIntervalMs) return false;
    lastProbeAt = now;
    return true;
  };
  return {
    background(now) { backgroundAt = now; },
    foreground(now) {
      const duration = backgroundAt === null ? 0 : Math.max(0, now - backgroundAt);
      backgroundAt = null;
      if (disconnected || duration < minimumBackgroundMs) return false;
      return admit(now);
    },
    offline() { disconnected = true; },
    online(now) {
      if (!disconnected) return false;
      disconnected = false;
      return admit(now);
    },
  };
}
