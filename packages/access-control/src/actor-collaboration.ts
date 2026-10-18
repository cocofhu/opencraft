import { randomUUID, createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { openManagedDatabase, createSchemaValidator } from '@opencraft/sqlite-node';
import type { ActorContext } from '@opencraft/identity-core/actors';
import type { ActorStore } from './actors.js';
import type { ActorAccess } from './actor-access.js';

export const ACTOR_INPUT_PREFIX = 'actor-input:';
export type InputMode = 'queue' | 'steer';
export interface RunBinding { actorId: string; hostId: 'local-codex'; threadId: string; epoch: number }
export interface ExecutionReceipt { id: string; state: string; targetTurnId: string | null }
export interface ActorExecutionPort {
  validate(binding: RunBinding): Promise<void>;
  receipt(binding: RunBinding, requestId: string): Promise<ExecutionReceipt | null>;
  add(binding: RunBinding, requestId: string, input: string): Promise<ExecutionReceipt>;
  steer(binding: RunBinding, requestId: string, queueId: string, expectedTurnId: string): Promise<void>;
  cancel(binding: RunBinding, requestId: string, queueId: string): Promise<boolean>;
}
export class CollaborationError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
const SCHEMA = `
CREATE TABLE actor_run_bindings(actor_id TEXT PRIMARY KEY, host_id TEXT NOT NULL, thread_id TEXT NOT NULL UNIQUE, epoch INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT;
CREATE TABLE actor_messages(id TEXT PRIMARY KEY, seq INTEGER NOT NULL UNIQUE, channel_id TEXT NOT NULL, author_id TEXT NOT NULL, target_id TEXT NOT NULL, content TEXT NOT NULL, reply_to TEXT, created_at INTEGER NOT NULL) STRICT;
CREATE INDEX actor_messages_channel ON actor_messages(channel_id,seq);
CREATE TABLE actor_deliveries(message_id TEXT NOT NULL REFERENCES actor_messages(id), receiver_id TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('received','read')), received_at INTEGER NOT NULL, read_at INTEGER, PRIMARY KEY(message_id,receiver_id)) STRICT;
CREATE TABLE actor_execution_requests(id TEXT PRIMARY KEY, requester_id TEXT NOT NULL, requester_generation INTEGER NOT NULL, target_id TEXT NOT NULL, target_generation INTEGER NOT NULL, binding_epoch INTEGER NOT NULL, thread_id TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('queue','steer')), expected_turn_id TEXT, state TEXT NOT NULL CHECK(state IN ('accepted','transferring','queued','submitted','injected','rejected','cancelled','unknown')), queue_id TEXT, turn_id TEXT, reason TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT;
CREATE TABLE actor_collaboration_audit(id TEXT PRIMARY KEY, action TEXT NOT NULL, actor_id TEXT NOT NULL, resource_id TEXT NOT NULL, detail TEXT NOT NULL, happened_at INTEGER NOT NULL) STRICT;
CREATE INDEX actor_execution_pending ON actor_execution_requests(state,created_at);
CREATE TABLE actor_execution_inputs(request_id TEXT NOT NULL REFERENCES actor_execution_requests(id), message_id TEXT NOT NULL REFERENCES actor_messages(id), position INTEGER NOT NULL, PRIMARY KEY(request_id,message_id), UNIQUE(request_id,position)) STRICT;
CREATE TABLE actor_send_keys(actor_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, fingerprint TEXT NOT NULL, message_id TEXT, request_id TEXT, PRIMARY KEY(actor_id,idempotency_key)) STRICT;
`;
type Row = Record<string, unknown>;
const terminal = new Set(['submitted', 'injected', 'rejected', 'cancelled']);
function text(value: unknown, max = 256): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/u.test(value)) throw new CollaborationError(400, 'invalid_field');
  return value;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CollaborationError(400, 'invalid_body');
  return value as Record<string, unknown>;
}
function executionIntent(value: unknown) {
  const intent = record(value); fields(intent, ['mode', 'expectedTurnId']);
  if (intent.mode !== 'queue' && intent.mode !== 'steer') throw new CollaborationError(400, 'invalid_execution_mode');
  if (intent.mode === 'queue' && intent.expectedTurnId !== undefined) throw new CollaborationError(400, 'unexpected_turn');
  return intent.mode === 'steer' ? { mode: intent.mode, expectedTurnId: text(intent.expectedTurnId) } : { mode: intent.mode };
}
function fields(body: Record<string, unknown>, keys: string[]) {
  if (Object.keys(body).some(key => !keys.includes(key))) throw new CollaborationError(400, 'unexpected_field');
}
export function actorChannelId(a: string, b: string): string {
  return 'dm:' + createHash('sha256').update(JSON.stringify([a, b].sort())).digest('hex');
}

/** Single-Hub collaboration authority. Stores communication facts, never a second runnable queue. */
export class ActorCollaboration {
  private readonly database: DatabaseSync;
  readonly outcome;
  #closed = false;
  #cursor = 0;
  #pump: Promise<void> | null = null;
  #operations: Promise<unknown> = Promise.resolve();
  #timer: ReturnType<typeof setInterval> | null = null;
  constructor(path: string, readonly actors: ActorStore, readonly execution: ActorExecutionPort, readonly now = Date.now, readonly admittedActor: (actorId: string) => boolean = () => true) {
    const managed = openManagedDatabase({ path, legacyPolicy: 'reject', migrations: [{ version: 1, name: 'actor-collaboration', sql: SCHEMA }], validateSchema: createSchemaValidator(SCHEMA) });
    this.database = managed.database; this.outcome = managed.outcome;
  }
  #transaction<T>(operation: () => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try { const result = operation(); this.database.exec('COMMIT'); return result; }
    catch (error) { this.database.exec('ROLLBACK'); throw error; }
  }
  start() {
    if (this.#timer || this.#closed) return;
    this.#timer = setInterval(() => { void this.pump().catch(() => {}); }, 500); this.#timer.unref();
  }
  async close() {
    if (this.#closed) return;
    this.#closed = true; if (this.#timer) clearInterval(this.#timer);
    await this.#operations; this.database.close();
  }
  get available() { return !this.#closed; }
  binding(actorId: string): RunBinding | null {
    const r = this.database.prepare('SELECT * FROM actor_run_bindings WHERE actor_id=?').get(actorId);
    return r ? { actorId, hostId: 'local-codex', threadId: r.thread_id as string, epoch: r.epoch as number } : null;
  }
  async bind(actorId: string, threadId: string, expectedEpoch: number, assertAdmission: () => void, changedBy = 'local-operator'): Promise<RunBinding> {
    if (this.actors.get(actorId)?.kind !== 'session' || !this.actors.get(actorId)?.enabled) throw new CollaborationError(400, 'session_required');
    text(threadId); if (!Number.isSafeInteger(expectedEpoch) || expectedEpoch < 0) throw new CollaborationError(400, 'invalid_epoch');
    const binding: RunBinding = { actorId, hostId: 'local-codex', threadId, epoch: expectedEpoch + 1 };
    await this.execution.validate(binding);
    assertAdmission();
    if (!this.actors.get(actorId)?.enabled) throw new CollaborationError(403, 'actor_action_denied');
    return this.#transaction(() => {
      if ((this.binding(actorId)?.epoch ?? 0) !== expectedEpoch) throw new CollaborationError(409, 'binding_changed');
      if (this.database.prepare('SELECT actor_id FROM actor_run_bindings WHERE thread_id=? AND actor_id<>?').get(threadId, actorId)) throw new CollaborationError(409, 'thread_already_bound');
      this.database.prepare('INSERT INTO actor_run_bindings VALUES(?,?,?,?,?) ON CONFLICT(actor_id) DO UPDATE SET host_id=excluded.host_id,thread_id=excluded.thread_id,epoch=excluded.epoch,updated_at=excluded.updated_at')
        .run(actorId, 'local-codex', threadId, binding.epoch, this.now());
      this.#audit('binding.set', changedBy, actorId, JSON.stringify(binding));
      return binding;
    });
  }
  #audit(action: string, actorId: string, resourceId: string, detail: string) {
    this.database.prepare('INSERT INTO actor_collaboration_audit VALUES(?,?,?,?,?,?)').run(randomUUID(), action, actorId, resourceId, detail, this.now());
  }
  #request(id: string): Row | null { return this.database.prepare('SELECT * FROM actor_execution_requests WHERE id=?').get(id) ?? null; }
  #message(id: string): Row | null { return this.database.prepare('SELECT * FROM actor_messages WHERE id=?').get(id) ?? null; }
  #require(context: ActorContext, target: string, action: string) {
    if (this.#closed || !this.actors.isCurrent(context) || !this.actors.get(target)?.enabled || !this.actors.can(context, target, action)) throw new CollaborationError(403, 'actor_action_denied');
  }
  #createRequest(context: ActorContext, target: string, messageIds: string[], execution: unknown): string {
    const intent = record(execution); fields(intent, ['mode', 'expectedTurnId']);
    if (intent.mode !== 'queue' && intent.mode !== 'steer') throw new CollaborationError(400, 'invalid_execution_mode');
    const expectedTurn = intent.mode === 'steer' ? text(intent.expectedTurnId) : null;
    if (intent.mode === 'queue' && intent.expectedTurnId !== undefined) throw new CollaborationError(400, 'unexpected_turn');
    this.#require(context, target, 'execution.' + intent.mode);
    const binding = this.binding(target), actor = this.actors.get(target);
    if (!binding || actor?.kind !== 'session') throw new CollaborationError(409, 'session_not_bound');
    if (!messageIds.length || messageIds.length > 32 || new Set(messageIds).size !== messageIds.length) throw new CollaborationError(400, 'invalid_inputs');
    for (const id of messageIds) {
      const m = this.#message(text(id));
      if (!m || (m.author_id !== context.actorId && m.target_id !== context.actorId) || (m.target_id !== target && m.author_id !== target)) throw new CollaborationError(403, 'input_not_visible');
    }
    const id = randomUUID(), now = this.now();
    this.database.prepare("INSERT INTO actor_execution_requests VALUES(?,?,?,?,?,?,?,?,?,'accepted',NULL,NULL,NULL,?,?)")
      .run(id, context.actorId, context.generation, target, actor.generation, binding.epoch, binding.threadId, intent.mode, expectedTurn, now, now);
    messageIds.forEach((messageId, position) => this.database.prepare('INSERT INTO actor_execution_inputs VALUES(?,?,?)').run(id, messageId, position));
    return id;
  }
  #dedupe(context: ActorContext, key: unknown, payload: unknown, create: () => { messageId: string | null; requestId: string | null }) {
    const idempotencyKey = text(key, 128), fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return this.#transaction(() => {
      const prior = this.database.prepare('SELECT * FROM actor_send_keys WHERE actor_id=? AND idempotency_key=?').get(context.actorId, idempotencyKey);
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new CollaborationError(409, 'idempotency_key_reused');
        return { messageId: prior.message_id as string | null, requestId: prior.request_id as string | null, replayed: true };
      }
      const result = create();
      this.database.prepare('INSERT INTO actor_send_keys VALUES(?,?,?,?,?)').run(context.actorId, idempotencyKey, fingerprint, result.messageId, result.requestId);
      return { ...result, replayed: false };
    });
  }
  send(context: ActorContext, body: Record<string, unknown>) {
    fields(body, ['targetActorId', 'content', 'replyTo', 'idempotencyKey', 'execution']);
    const target = text(body.targetActorId), content = text(body.content, 16_384), reply = body.replyTo === undefined ? null : text(body.replyTo);
    this.#require(context, target, 'message.send');
    const intent = body.execution === undefined ? null : executionIntent(body.execution);
    if (intent) this.#require(context, target, 'execution.' + intent.mode);
    const channelId = actorChannelId(context.actorId, target);
    if (reply && this.#message(reply)?.channel_id !== channelId) throw new CollaborationError(403, 'reply_not_visible');
    return this.#dedupe(context, body.idempotencyKey, ['message', target, content, reply, intent], () => {
      const id = randomUUID(), now = this.now();
      const seq = Number(this.database.prepare('SELECT COALESCE(MAX(seq),0)+1 AS seq FROM actor_messages').get()!.seq);
      this.database.prepare('INSERT INTO actor_messages VALUES(?,?,?,?,?,?,?,?)').run(id, seq, channelId, context.actorId, target, content, reply, now);
      this.database.prepare("INSERT INTO actor_deliveries VALUES(?,?,'received',?,NULL)").run(id, target, now);
      return { messageId: id, requestId: intent ? this.#createRequest(context, target, [id], intent) : null };
    });
  }
  request(context: ActorContext, body: Record<string, unknown>) {
    fields(body, ['targetActorId', 'messageIds', 'execution', 'idempotencyKey']);
    const target = text(body.targetActorId);
    if (!Array.isArray(body.messageIds)) throw new CollaborationError(400, 'invalid_inputs');
    const ids = body.messageIds.map(id => text(id));
    const intent = executionIntent(body.execution);
    this.#require(context, target, 'execution.' + intent.mode);
    return this.#dedupe(context, body.idempotencyKey, ['execution', target, ids, intent], () => ({ messageId: null, requestId: this.#createRequest(context, target, ids, intent) }));
  }
  inbox(context: ActorContext, after: number, limit: number) {
    if (!this.actors.isCurrent(context)) throw new CollaborationError(401, 'actor_authentication_required');
    return this.database.prepare('SELECT m.*,d.state AS delivery_state,d.read_at FROM actor_messages m JOIN actor_deliveries d ON d.message_id=m.id WHERE d.receiver_id=? AND m.seq>? ORDER BY m.seq LIMIT ?').all(context.actorId, after, limit);
  }
  messages(context: ActorContext, peer: string, after: number, limit: number) {
    if (!this.actors.isCurrent(context)) throw new CollaborationError(401, 'actor_authentication_required');
    return this.database.prepare('SELECT * FROM actor_messages WHERE channel_id=? AND seq>? ORDER BY seq LIMIT ?').all(actorChannelId(context.actorId, peer), after, limit);
  }
  read(context: ActorContext, messageId: string) {
    if (!this.actors.isCurrent(context)) throw new CollaborationError(401, 'actor_authentication_required');
    if (!this.database.prepare('SELECT 1 FROM actor_deliveries WHERE message_id=? AND receiver_id=?').get(messageId, context.actorId)) throw new CollaborationError(404, 'missing');
    this.database.prepare("UPDATE actor_deliveries SET state='read',read_at=COALESCE(read_at,?) WHERE message_id=? AND receiver_id=?").run(this.now(), messageId, context.actorId);
  }
  getRequest(context: ActorContext, id: string): Row & { messageIds: unknown[] } {
    const row = this.#request(id);
    if (!this.actors.isCurrent(context) || !row || (row.requester_id !== context.actorId && row.target_id !== context.actorId)) throw new CollaborationError(404, 'missing');
    return { ...row, messageIds: this.database.prepare('SELECT message_id FROM actor_execution_inputs WHERE request_id=? ORDER BY position').all(id).map(r => r.message_id) };
  }
  #allowed(row: Row): boolean {
    const binding = this.binding(row.target_id as string), target = this.actors.get(row.target_id as string);
    return !this.#closed && this.admittedActor(row.requester_id as string) && this.admittedActor(row.target_id as string) && !['rejected', 'cancelled'].includes(row.state as string) && !!target?.enabled
      && target.generation === row.target_generation && !!binding && binding.threadId === row.thread_id && binding.epoch === row.binding_epoch
      && this.actors.canAdmitted(row.requester_id as string, row.requester_generation as number, row.target_id as string, 'execution.' + row.mode);
  }
  /** Called synchronously by the existing queue authority immediately before claiming input. */
  authorizeInput(threadId: string, clientId: string, mode: InputMode, expectedTurnId?: string): boolean {
    if (!clientId.startsWith(ACTOR_INPUT_PREFIX)) return true;
    if (this.#closed) return false;
    const row = this.#request(clientId.slice(ACTOR_INPUT_PREFIX.length));
    return !!row && row.thread_id === threadId && row.mode === mode && !terminal.has(row.state as string)
      && (mode !== 'steer' || row.expected_turn_id === expectedTurnId) && this.#allowed(row);
  }
  inputMode(clientId: string): InputMode | null {
    if (this.#closed) return null;
    const row = this.#request(clientId.slice(ACTOR_INPUT_PREFIX.length));
    return row && !terminal.has(row.state as string) && this.#allowed(row) && (row.mode === 'queue' || row.mode === 'steer') ? row.mode : null;
  }
  #update(id: string, state: string, reason: string | null = null, receipt?: ExecutionReceipt) {
    this.database.prepare('UPDATE actor_execution_requests SET state=?,reason=?,queue_id=COALESCE(?,queue_id),turn_id=COALESCE(?,turn_id),updated_at=? WHERE id=?')
      .run(state, reason, receipt?.id ?? null, receipt?.targetTurnId ?? null, this.now(), id);
  }
  #serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#operations.then(operation); this.#operations = result.catch(() => {}); return result;
  }
  cancel(context: ActorContext, id: string, assertAdmission: () => void) {
    return this.#serial(() => this.#cancel(context, id, assertAdmission));
  }
  async #cancel(context: ActorContext, id: string, assertAdmission: () => void) {
    const row = this.getRequest(context, id);
    if (row.requester_id !== context.actorId) this.#require(context, row.target_id as string, 'execution.cancel');
    const binding = { actorId: row.target_id as string, hostId: 'local-codex' as const, threadId: row.thread_id as string, epoch: row.binding_epoch as number };
    // Serialize with the handoff pump; then obtain the durable queue's actual claim state.
    assertAdmission();
    const current = this.#request(id)!;
    if (terminal.has(current.state as string)) throw new CollaborationError(409, 'execution_already_settled');
    const receipt = await this.execution.receipt(binding, id); assertAdmission();
    if (row.requester_id !== context.actorId) this.#require(context, row.target_id as string, 'execution.cancel');
    if (receipt && (receipt.state !== 'queued' || !await this.execution.cancel(binding, id, receipt.id))) throw new CollaborationError(409, 'execution_already_claimed');
    if (!receipt && current.state !== 'accepted') throw new CollaborationError(409, 'execution_outcome_unknown');
    this.#transaction(() => { this.#update(id, 'cancelled'); this.#audit('execution.cancel', context.actorId, id, '{}'); });
  }
  pump(): Promise<void> {
    if (this.#pump) return this.#pump;
    if (this.#closed) return Promise.resolve();
    this.#pump = this.#serial(() => this.#drain()).finally(() => { this.#pump = null; }); return this.#pump;
  }
  async #drain() {
    const rows = this.database.prepare("SELECT rowid AS cursor,* FROM actor_execution_requests WHERE state IN ('accepted','transferring','queued','unknown') ORDER BY (rowid > ?) DESC,rowid LIMIT 32").all(this.#cursor);
    for (const snapshot of rows) {
      if (this.#closed) return;
      this.#cursor = Number(snapshot.cursor);
      const id = snapshot.id as string, binding = { actorId: snapshot.target_id as string, hostId: 'local-codex' as const, threadId: snapshot.thread_id as string, epoch: snapshot.binding_epoch as number };
      try {
        let receipt = await this.execution.receipt(binding, id);
        if (this.#closed) return;
        // An engine receipt remains factual after revocation. Never relabel committed input as unexecuted.
        if (receipt?.state === 'delivered' || receipt?.state === 'steering') {
          this.#update(id, receipt.state === 'delivered' ? (snapshot.mode === 'queue' ? 'submitted' : 'injected') : 'unknown', null, receipt); continue;
        }
        const row = this.#request(id)!;
        if (!this.#allowed(row)) {
          if (receipt?.state === 'queued' && !await this.execution.cancel(binding, id, receipt.id)) {
            const claimed = await this.execution.receipt(binding, id);
            this.#update(id, 'unknown', 'authorization_changed_after_claim', claimed ?? receipt); continue;
          }
          if (receipt && ['unknown', 'dispatching'].includes(receipt.state)) this.#update(id, 'unknown', 'authorization_changed_after_claim', receipt);
          else this.#update(id, 'rejected', 'authorization_or_binding_changed', receipt ?? undefined);
          continue;
        }
        if (receipt?.state === 'discarded') { this.#update(id, 'rejected', 'queue_discarded', receipt); continue; }
        if (receipt && receipt.state !== 'queued') { this.#update(id, 'unknown', 'engine_outcome_unknown', receipt); continue; }
        if (!receipt) {
          if (row.state !== 'accepted') { this.#update(id, 'unknown', 'handoff_unconfirmed'); continue; }
          const inputs = this.database.prepare('SELECT m.* FROM actor_execution_inputs i JOIN actor_messages m ON m.id=i.message_id WHERE i.request_id=? ORDER BY i.position').all(id);
          this.#update(id, 'transferring');
          receipt = await this.execution.add(binding, id, inputs.map(m => `[Message ${m.id}; author ${m.author_id}]\n${m.content}`).join('\n\n'));
        }
        if (this.#closed) return;
        this.#update(id, 'queued', null, receipt);
        if (snapshot.mode === 'steer') {
          await this.execution.steer(binding, id, receipt.id, snapshot.expected_turn_id as string);
          this.#update(id, 'injected', null, { ...receipt, targetTurnId: snapshot.expected_turn_id as string });
        }
      } catch (error) {
        if (this.#closed) return;
        const code = (error as { code?: unknown }).code;
        if (code === -32600 || code === -32601 || code === -32602) {
          // A native rejection can still leave a claimed/ambiguous delivery. Its receipt wins.
          try {
            const receipt = await this.execution.receipt(binding, id);
            if (receipt && !['queued', 'discarded'].includes(receipt.state)) {
              this.#update(id, receipt.state === 'delivered' ? (snapshot.mode === 'queue' ? 'submitted' : 'injected') : 'unknown', 'engine_outcome_unknown', receipt); continue;
            }
            this.#update(id, 'rejected', 'execution_rejected', receipt ?? undefined);
            if (receipt?.state === 'queued') await this.execution.cancel(binding, id, receipt.id);
          } catch { this.#update(id, 'unknown', 'engine_outcome_unknown'); }
        } else this.#update(id, 'unknown', 'engine_outcome_unknown');
      }
    }
  }
}

/** HTTP adapter: only authenticated Actor contexts enter the domain service. */
export class ActorCollaborationApi {
  constructor(readonly service: ActorCollaboration, readonly access: ActorAccess) {}
  async handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const url = new URL(request.url ?? '/', 'http://actors.invalid'), prefix = '/__opencraft_actors/collaboration/';
    if (!url.pathname.startsWith(prefix)) return false;
    const send = (status: number, value: unknown) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }); response.end(JSON.stringify(value)); };
    try {
      const context = this.access.authenticate(request);
      if (!context) throw new CollaborationError(401, 'actor_authentication_required');
      const current = () => { const next = this.access.authenticate(request); if (!next || next.actorId !== context.actorId || next.generation !== context.generation) throw new CollaborationError(401, 'actor_authentication_required'); };
      const path = url.pathname.slice(prefix.length);
      if (request.method === 'GET') {
        const after = Number(url.searchParams.get('after') ?? 0), limit = Number(url.searchParams.get('limit') ?? 50);
        if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new CollaborationError(400, 'invalid_pagination');
        if (path === 'inbox') send(200, { messages: this.service.inbox(context, after, limit) });
        else if (path === 'messages') send(200, { messages: this.service.messages(context, text(url.searchParams.get('peerActorId')), after, limit) });
        else if (path === 'requests') send(200, { request: this.service.getRequest(context, text(url.searchParams.get('id'))) });
        else if (path === 'bindings') {
          const actorId = text(url.searchParams.get('actorId'));
          if (actorId !== context.actorId && !this.access.manages(request, context)) throw new CollaborationError(403, 'actor_management_denied');
          send(200, { binding: this.service.binding(actorId) });
        } else throw new CollaborationError(404, 'missing');
        return true;
      }
      if (request.method !== 'POST') throw new CollaborationError(405, 'method_not_allowed');
      const origin = request.headers.origin, trusted = this.access.options.trustedOrigin?.(request);
      if (request.headers['content-type']?.split(';')[0] !== 'application/json' || (context.credentialId === null && (typeof origin !== 'string' || (origin !== trusted && !['http:', 'https:'].some(s => origin === s + '//' + request.headers.host))))) throw new CollaborationError(403, 'matching_origin_required');
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) { size += Buffer.byteLength(chunk); if (size > 65_536) throw new CollaborationError(413, 'body_too_large'); chunks.push(Buffer.from(chunk)); }
      let body: Record<string, unknown>;
      try { body = record(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
      catch { throw new CollaborationError(400, 'invalid_body'); }
      current();
      if (path === 'messages') send(200, this.service.send(context, body));
      else if (path === 'requests') send(200, this.service.request(context, body));
      else if (path === 'read') { fields(body, ['messageId']); this.service.read(context, text(body.messageId)); send(200, { ok: true }); }
      else if (path === 'cancel') { fields(body, ['requestId']); await this.service.cancel(context, text(body.requestId), current); send(200, { cancelled: true }); }
      else if (path === 'bindings') {
        fields(body, ['actorId', 'threadId', 'expectedEpoch']);
        const admission = () => { current(); if (!this.access.manages(request, context)) throw new CollaborationError(403, 'actor_management_denied'); };
        admission(); send(200, { binding: await this.service.bind(text(body.actorId), text(body.threadId), Number(body.expectedEpoch), admission, context.actorId) });
      } else throw new CollaborationError(404, 'missing');
      void this.service.pump().catch(() => {});
    } catch (error) { send(error instanceof CollaborationError ? error.status : 503, { error: error instanceof CollaborationError ? error.code : 'collaboration_unavailable' }); }
    return true;
  }
}
