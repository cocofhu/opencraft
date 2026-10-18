/** Recovered from join runtime SHA256
 * ac9737d51dfe4b5b9896f9de96070f5a69b115f71c7fdad1d5fe7217d6877686.
 * The surviving 2026-10-06 TypeScript covered only earlier rooms/receipts.
 * This module retains the deployed draft/native mapping, idempotency and slot
 * behavior; it borrows CodexHostStateDatabase rather than opening a second writer.
 * Recovery evidence and comparison boundaries: docs/managed-headless.md.
 */
// apps/opencraft-daemon/src/codex-bot-bridge.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = (value) => typeof value === "string" ? value : "";
const array = (value) => Array.isArray(value) ? value : [];
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value !== null && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)])) : value;
const required = (value) => {
  const result = text(value);
  if (!result || result.length > 1024) throw new CodexBotError("BOT_INVALID_INPUT", "无效的聊天请求。");
  return result;
};
const missingNativeThread = (error2, id) => error2 instanceof Error && record(error2).code === -32600 && (error2.message === `no rollout found for thread id ${id}` || error2.message === `thread not loaded: ${id}`);
const HUMAN = { participantId: "person:you", kind: "human", displayName: "You" };
const BOT = { participantId: "bot:opencraft.codex", kind: "bot", displayName: "Codex" };
const BOT_DESCRIPTOR = {
  botId: "opencraft.codex",
  revision: 1,
  name: "Codex 聊天",
  subtitle: "Codex",
  status: "available",
  capabilities: ["messageStreaming", "executionCancellation", "interactions"]
};
export const CODEX_BOT_CAPABILITY = {
  version: 1,
  topologies: ["direct"],
  features: {
    messageStreaming: true,
    executionCancellation: true,
    interactions: true,
    attachments: false,
    botManagement: false,
    botAssets: false,
    groupMembership: false,
    configuration: false,
    routines: false
  },
  limits: { maxPageSize: 100, maxInlineAttachmentBytes: 0, maxParticipants: 2 }
};
export const CodexBotError = class extends Error {
  constructor(domainCode, message) {
    super(message);
    this.domainCode = domainCode;
  }
  domainCode;
};
export const CodexBotBridge = class {
  /** Borrows the sole Host DB; schema and connection lifetime belong to its owner. */
  constructor(database, port) {
    this.port = port;
    this.db = database;
  }
  port;
  db;
  rooms = /* @__PURE__ */ new Map();
  operations = /* @__PURE__ */ new Map();
  hydrations = /* @__PURE__ */ new Map();
  disposed = false;
  submissionContexts = new AsyncLocalStorage();
  requestNative(clientId, method, params) {
    return this.port.request(clientId, method, params, this.submissionContexts.getStore());
  }
  dispose() {
    this.disposed = true;
    this.rooms.clear();
  }
  disconnect(clientId) {
    for (const [id, room] of this.rooms) {
      room.clients.delete(clientId);
      if (room.clients.size === 0) this.rooms.delete(id);
    }
  }
  owned(id) {
    if (this.disposed) throw new CodexBotError("BOT_UNAVAILABLE", "聊天连接已关闭。");
    if (!this.db.prepare("SELECT thread_id FROM codex_bot_rooms WHERE thread_id = ?").get(id))
      throw new CodexBotError("BOT_CONVERSATION_NOT_FOUND", "找不到此聊天。");
    let room = this.rooms.get(id);
    if (!room) {
      room = { clients: /* @__PURE__ */ new Set(), epoch: randomUUID(), seq: 0, live: /* @__PURE__ */ new Map(), executions: /* @__PURE__ */ new Map(), interactions: /* @__PURE__ */ new Map() };
      this.rooms.set(id, room);
    }
    return room;
  }
  emit(id, event) {
    const room = this.owned(id);
    const wire = { ...event, params: { ...event.params, conversationId: id, stamp: { epoch: room.epoch, seq: ++room.seq } } };
    for (const clientId of room.clients) this.port.emit(wire, clientId);
  }
  nativeId(id) {
    return text(record(this.db.prepare("SELECT native_thread_id FROM codex_bot_rooms WHERE thread_id = ?").get(id)).native_thread_id) || id;
  }
  roomId(nativeId) {
    return text(record(this.db.prepare("SELECT thread_id FROM codex_bot_rooms WHERE COALESCE(native_thread_id, thread_id) = ?").get(nativeId)).thread_id);
  }
  descriptor(thread, roomId = required(thread.id)) {
    const id = roomId;
    const created = Number(thread.createdAt) * 1e3 || Number(record(this.db.prepare("SELECT created_ms FROM codex_bot_rooms WHERE thread_id = ?").get(id)).created_ms);
    return {
      conversationId: id,
      revision: Math.max(1, Number(thread.updatedAt) || 1),
      topology: "direct",
      title: text(thread.name) || text(thread.preview) || "Codex 聊天",
      participantIds: [HUMAN.participantId, BOT.participantId],
      createdAtMs: created,
      updatedAtMs: Number(thread.updatedAt) * 1e3 || created
    };
  }
  messageIdentity(id, turnId2, item, ordinal) {
    if (item.type === "userMessage" && text(item.clientId)) return `codex:${turnId2}:user:${text(item.clientId)}`;
    const kind = required(item.type);
    const nativeId = required(item.id);
    const existing = record(this.db.prepare("SELECT ordinal FROM codex_bot_message_slots WHERE room_id = ? AND turn_id = ? AND kind = ? AND native_id = ?").get(id, turnId2, kind, nativeId));
    if (typeof existing.ordinal === "number") ordinal = existing.ordinal;
    else {
      const next = () => Number(record(this.db.prepare("SELECT COALESCE(MAX(ordinal), -1) + 1 AS ordinal FROM codex_bot_message_slots WHERE room_id = ? AND turn_id = ? AND kind = ?").get(id, turnId2, kind)).ordinal);
      if (ordinal === undefined) ordinal = next();
      const occupied = this.db.prepare("SELECT native_id FROM codex_bot_message_slots WHERE room_id = ? AND turn_id = ? AND kind = ? AND ordinal = ?").get(id, turnId2, kind, ordinal);
      // Already published IDs are immutable, even when live events preceded hydration.
      // Adopt an old NULL history slot, but never rebind another native message.
      if (occupied && occupied.native_id !== null && occupied.native_id !== nativeId) ordinal = next();
      this.db.prepare(`INSERT INTO codex_bot_message_slots VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(room_id,turn_id,kind,ordinal) DO UPDATE SET native_id=excluded.native_id
        WHERE codex_bot_message_slots.native_id IS NULL`).run(id, turnId2, kind, ordinal, nativeId);
    }
    return `codex:${turnId2}:${kind}:${ordinal}`;
  }
  message(id, turnId2, item, time3, streaming = false, ordinal) {
    if (item.type !== "userMessage" && item.type !== "agentMessage") return null;
    const content = item.type === "agentMessage" ? [{ type: "text", text: text(item.text) }] : array(item.content).flatMap((part) => {
      const value = record(part);
      if (value.type !== "text" || array(value.text_elements).some((element) => record(element).placeholder === "opencraft:staged-file:v1")) return [];
      return [{ type: "text", text: text(value.text) }];
    });
    const messageId = this.messageIdentity(id, turnId2, item, ordinal);
    if (!content.some((part) => part.text.length > 0)) return null;
    return {
      messageId,
      conversationId: id,
      author: item.type === "userMessage" ? HUMAN : BOT,
      ...text(item.clientId) ? { clientMessageId: text(item.clientId) } : {},
      executionId: turnId2,
      createdAtMs: Number(item.createdAtMs) || time3,
      updatedAtMs: time3,
      state: streaming ? "streaming" : "complete",
      content
    };
  }
  execution(id, turn) {
    const status = turn.status === "inProgress" ? "running" : turn.status === "interrupted" ? "cancelled" : turn.status === "failed" ? "failed" : "completed";
    return {
      executionId: required(turn.id),
      conversationId: id,
      participantId: BOT.participantId,
      causalMessageId: text(record(array(turn.items).find((item) => record(item).type === "userMessage")).id),
      status,
      ...Number(turn.startedAt) > 0 ? { startedAtMs: Number(turn.startedAt) * 1e3 } : {},
      ...Number(turn.completedAt) > 0 ? { completedAtMs: Number(turn.completedAt) * 1e3 } : {},
      ...status === "failed" ? { error: { code: "CODEX_EXECUTION_FAILED", retryable: false } } : {}
    };
  }
  remember(room, message) {
    room.live.set(message.messageId, message);
    if (room.live.size > 100) for (const [key, value] of room.live) {
      if (value.state !== "streaming") room.live.delete(key);
      if (room.live.size <= 100) break;
    }
  }
  async read(clientId, id, cursor, direction = "backwards", limit = 100) {
    while (this.hydrations.has(id)) await this.hydrations.get(id);
    const operation = this.readSnapshot(clientId, id, cursor, direction, limit);
    this.hydrations.set(id, operation);
    try {
      return await operation;
    } finally {
      if (this.hydrations.get(id) === operation) this.hydrations.delete(id);
    }
  }
  async readSnapshot(clientId, id, cursor, direction, limit) {
    const room = this.owned(id);
    room.clients.add(clientId);
    const seqAtStart = room.seq;
    let nativeId = this.nativeId(id);
    let thread;
    try {
      thread = record(record(await this.requestNative(clientId, "thread/read", { threadId: nativeId, includeTurns: false })).thread);
    } catch (error2) {
      const saved = record(this.db.prepare("SELECT cwd, draft FROM codex_bot_rooms WHERE thread_id = ?").get(id));
      if (!missingNativeThread(error2, nativeId) || saved.draft !== 1 || !text(saved.cwd) || this.db.prepare("SELECT 1 FROM codex_bot_commands WHERE command_key LIKE ? LIMIT 1").get(`send:${id}:%`)) throw error2;
      const started = record(await this.requestNative(clientId, "thread/start", { threadSource: "opencraft.bot.codex", historyMode: "legacy", cwd: saved.cwd }));
      thread = record(started.thread);
      nativeId = required(thread.id);
      if (this.disposed) throw new Error("Chat owner was disposed");
      this.db.prepare("UPDATE codex_bot_rooms SET native_thread_id = ? WHERE thread_id = ?").run(nativeId, id);
    }
    if (thread.id !== nativeId) throw new CodexBotError("BOT_CONVERSATION_NOT_FOUND", "无法恢复此聊天。");
    if (!this.port.hasNativeSubscription(nativeId) || record(thread.status).type === "notLoaded" && thread.historyMode !== "paginated")
      thread = record(record(await this.requestNative(clientId, "thread/resume", { threadId: nativeId, excludeTurns: true })).thread);
    if (thread.id !== nativeId) throw new CodexBotError("BOT_CONVERSATION_NOT_FOUND", "无法恢复此聊天。");
    let turns = await this.history(clientId, nativeId, thread);
    if (thread.historyMode === "paginated" && turns.length === 0 && !this.port.activeTurn(nativeId) && !this.db.prepare("SELECT 1 FROM codex_bot_commands WHERE command_key LIKE ? LIMIT 1").get(`send:${id}:%`)) {
      const started = record(await this.requestNative(clientId, "thread/start", {
        threadSource: "opencraft.bot.codex",
        historyMode: "legacy",
        ...text(thread.cwd) ? { cwd: text(thread.cwd) } : {}
      }));
      const replacement = record(started.thread);
      nativeId = required(replacement.id);
      if (this.disposed) throw new Error("Chat owner was disposed");
      if (this.port.activeTurn(this.nativeId(id)) || this.db.prepare("SELECT 1 FROM codex_bot_commands WHERE command_key LIKE ? LIMIT 1").get(`send:${id}:%`))
        throw new CodexBotError("BOT_RESULT_UNKNOWN", "聊天状态已更新，请重新打开核对。");
      this.db.prepare("UPDATE codex_bot_rooms SET native_thread_id = ?, cwd = ?, draft = 1 WHERE thread_id = ?").run(nativeId, text(replacement.cwd) || text(thread.cwd), id);
      thread = replacement;
      turns = await this.history(clientId, nativeId, thread);
    }
    if (record(thread.status).type === "notLoaded") {
      thread = record(record(await this.requestNative(clientId, "thread/resume", { threadId: nativeId, excludeTurns: true })).thread);
      if (thread.id !== nativeId) throw new CodexBotError("BOT_CONVERSATION_NOT_FOUND", "无法恢复此聊天。");
    }
    if (turns.length > 0) this.db.prepare("UPDATE codex_bot_rooms SET draft = 0 WHERE thread_id = ?").run(id);
    this.port.attach(clientId, nativeId);
    for (const turn of turns) {
      const execution = this.execution(id, turn);
      if (room.seq === seqAtStart || !room.executions.has(execution.executionId)) room.executions.set(execution.executionId, execution);
    }
    const baseline = this.descriptor(thread, id).createdAtMs;
    const messages = turns.flatMap((turn) => {
      const ordinals = /* @__PURE__ */ new Map();
      return array(turn.items).flatMap((item) => {
        const value = record(item), kind = text(value.type), ordinal = ordinals.get(kind) ?? 0;
        ordinals.set(kind, ordinal + 1);
        const message = this.message(id, text(turn.id), value, room.executions.get(text(turn.id))?.startedAtMs ?? baseline, false, ordinal);
        return message ? [message] : [];
      });
    });
    for (const live of room.live.values()) {
      const index = messages.findIndex((message) => message.messageId === live.messageId);
      if (index < 0) messages.push(live);
      else messages[index] = live;
    }
    for (const [messageId, live] of room.live) if (live.state !== "streaming") room.live.delete(messageId);
    const backwards = direction !== "forwards";
    const prefix = backwards ? "before:" : "after:";
    const anchor = cursor ? messages.findIndex((message) => prefix + message.messageId === cursor) : -1;
    if (cursor && anchor < 0) throw new CodexBotError("BOT_INVALID_INPUT", "聊天记录已更新，请重新打开聊天。");
    const end = backwards ? cursor ? anchor : messages.length : Math.min(messages.length, (cursor ? anchor + 1 : 0) + limit);
    const start = backwards ? Math.max(0, end - limit) : cursor ? anchor + 1 : 0;
    const data = messages.slice(start, end);
    const nextCursor = backwards ? start > 0 ? "before:" + messages[start].messageId : void 0 : end < messages.length ? "after:" + messages[end - 1].messageId : void 0;
    return {
      conversation: this.descriptor(thread, id),
      participants: [HUMAN, BOT],
      initialMessagesPage: {
        data,
        ...nextCursor ? { nextCursor } : {}
      },
      executions: [...new Map([...turns.map((turn) => {
        const execution = this.execution(id, turn);
        return [execution.executionId, execution];
      }), ...room.executions]).values()],
      interactions: [...room.interactions.values()].map((value) => value.interaction),
      presence: [],
      liveCursor: { epoch: room.epoch, nextSeq: room.seq + 1 }
    };
  }
  async history(clientId, id, thread) {
    try {
      if (thread.historyMode !== "paginated") {
        const result = record(await this.requestNative(clientId, "thread/read", { threadId: id, includeTurns: true }));
        return array(record(result.thread).turns).map(record);
      }
      const turns = [];
      let cursor;
      const seen = /* @__PURE__ */ new Set();
      for (let page3 = 0; page3 < 100; page3++) {
        const summary = record(await this.requestNative(clientId, "thread/turns/list", {
          threadId: id,
          cursor,
          limit: 100,
          sortDirection: "asc",
          itemsView: "summary"
        }));
        if (array(summary.data).length === 0 && !text(summary.nextCursor)) return turns;
        const result = record(await this.requestNative(clientId, "thread/turns/list", {
          threadId: id,
          cursor,
          limit: 100,
          sortDirection: "asc",
          itemsView: "full"
        }));
        turns.push(...array(result.data).map(record));
        cursor = text(result.nextCursor) || void 0;
        if (!cursor) return turns;
        if (seen.has(cursor)) throw new CodexBotError("BOT_HISTORY_UNAVAILABLE", "聊天记录暂时无法读取，请重试。");
        seen.add(cursor);
      }
      throw new CodexBotError("BOT_HISTORY_UNAVAILABLE", "聊天记录暂时无法读取，请重试。");
    } catch (error2) {
      if (error2 instanceof Error && record(error2).code === -32600 && error2.message.includes("is not materialized yet;")) return [];
      throw error2;
    }
  }
  command(key, input, operation) {
    const fingerprint = createHash("sha256").update(JSON.stringify(canonical(input))).digest("hex");
    const previous = record(this.db.prepare("SELECT fingerprint, result_json FROM codex_bot_commands WHERE command_key = ?").get(key));
    if (previous.fingerprint && previous.fingerprint !== fingerprint) return Promise.reject(new CodexBotError("BOT_IDEMPOTENCY_CONFLICT", "此消息已使用不同内容提交。"));
    const pending = this.operations.get(key);
    if (pending) return pending;
    if (previous.result_json) return Promise.resolve({ ...record(JSON.parse(text(previous.result_json))), replayed: true });
    if (previous.fingerprint) return Promise.reject(new CodexBotError("BOT_RESULT_UNKNOWN", "结果尚未确认，请重新打开聊天核对。"));
    this.db.prepare("INSERT INTO codex_bot_commands(command_key, fingerprint) VALUES (?, ?)").run(key, fingerprint);
    const running = operation().then((result) => {
      if (!this.disposed) this.db.prepare("UPDATE codex_bot_commands SET result_json = ? WHERE command_key = ?").run(JSON.stringify(result), key);
      return result;
    }).finally(() => this.operations.delete(key));
    this.operations.set(key, running);
    return running;
  }
  request(clientId, method, raw, context) {
    return this.submissionContexts.run(context, () => this.performRequest(clientId, method, raw));
  }
  async performRequest(clientId, method, raw) {
    const params = record(raw);
    if (method === "bot/list") return { data: [BOT_DESCRIPTOR] };
    if (method === "bot/read") {
      if (params.botId !== BOT_DESCRIPTOR.botId) throw new CodexBotError("BOT_NOT_FOUND", "找不到此助手。");
      return { bot: BOT_DESCRIPTOR };
    }
    if (method === "bot/conversation/list") {
      if (params.botId && params.botId !== BOT_DESCRIPTOR.botId) return { data: [] };
      if (params.archived === true) return { data: [] };
      let anchor;
      if (text(params.cursor)) {
        try {
          const value = JSON.parse(Buffer.from(text(params.cursor), "base64url").toString("utf8"));
          if (!Array.isArray(value) || value.length !== 2 || !Number.isSafeInteger(value[0]) || typeof value[1] !== "string") throw new Error("Invalid cursor");
          anchor = value;
        } catch {
          throw new CodexBotError("BOT_INVALID_INPUT", "请刷新聊天列表。");
        }
      }
      const limit = Math.min(100, Math.max(1, Number(params.limit) || 100));
      const rows = (anchor ? this.db.prepare("SELECT * FROM codex_bot_rooms WHERE created_ms < ? OR (created_ms = ? AND thread_id < ?) ORDER BY created_ms DESC, thread_id DESC LIMIT ?").all(anchor[0], anchor[0], anchor[1], limit) : this.db.prepare("SELECT * FROM codex_bot_rooms ORDER BY created_ms DESC, thread_id DESC LIMIT ?").all(limit)).map(record);
      const data = [];
      for (const row of rows) {
        const id2 = text(row.thread_id), nativeId = this.nativeId(id2);
        let thread;
        try {
          thread = record(record(await this.requestNative(clientId, "thread/read", { threadId: nativeId, includeTurns: false })).thread);
        } catch (error2) {
          if (!missingNativeThread(error2, nativeId) || this.db.prepare("SELECT 1 FROM codex_bot_commands WHERE command_key LIKE ? LIMIT 1").get(`send:${id2}:%`)) throw error2;
          if (row.draft !== 1 || !text(row.cwd)) continue;
          thread = { id: nativeId, cwd: row.cwd };
        }
        if (thread.id !== nativeId) throw new CodexBotError("BOT_CONVERSATION_NOT_FOUND", "聊天列表暂时无法更新。");
        if (text(params.cwd) && text(thread.cwd) !== text(params.cwd)) continue;
        data.push(this.descriptor(thread, id2));
      }
      const last = rows.at(-1);
      return { data, ...rows.length === limit && last ? { nextCursor: Buffer.from(JSON.stringify([last.created_ms, last.thread_id])).toString("base64url") } : {} };
    }
    if (method === "bot/conversation/create") {
      if (params.topology !== "direct" || JSON.stringify(params.participantIds) !== JSON.stringify([BOT.participantId]))
        throw new CodexBotError("BOT_INVALID_INPUT", "此助手目前仅支持直接聊天。");
      return this.command(`create:${required(params.clientRequestId)}`, params, async () => {
        const result = record(await this.requestNative(clientId, "thread/start", {
          threadSource: "opencraft.bot.codex",
          historyMode: "legacy",
          ...text(params.cwd) ? { cwd: text(params.cwd) } : {}
        }));
        const thread = record(result.thread);
        const id2 = required(thread.id);
        if (this.disposed) throw new Error("Chat owner was disposed");
        this.db.prepare("INSERT OR IGNORE INTO codex_bot_rooms(thread_id, created_ms, cwd, draft) VALUES (?, ?, ?, 1)").run(id2, Date.now(), text(thread.cwd) || text(result.cwd) || text(params.cwd));
        return { conversation: this.descriptor(thread), replayed: false };
      });
    }
    const id = required(params.conversationId);
    const room = this.owned(id);
    if (method === "bot/conversation/read") return this.read(clientId, id);
    if (method === "bot/messages/list") {
      return (await this.read(
        clientId,
        id,
        text(params.cursor) || void 0,
        text(params.direction) || "backwards",
        Math.min(100, Math.max(1, Number(params.limit) || 50))
      )).initialMessagesPage;
    }
    if (method === "bot/message/send") {
      const content = array(params.content).map(record);
      if (params.replyToMessageId || content.length === 0 || content.some((part) => part.type !== "text" || !text(part.text)))
        throw new CodexBotError("BOT_INVALID_INPUT", "此聊天目前支持文字消息。");
      const clientMessageId = required(params.clientMessageId);
      await this.read(clientId, id);
      return this.command(`send:${id}:${clientMessageId}`, params, async () => {
        const nativeId = this.nativeId(id);
        const active = this.port.activeTurn(nativeId) ?? [...room.executions.values()].find((execution2) => execution2.status === "running")?.executionId ?? null;
        const receipt = record(await this.requestNative(clientId, active ? "turn/steer" : "turn/start", {
          threadId: nativeId,
          clientUserMessageId: clientMessageId,
          input: content.map((part) => ({ type: "text", text: text(part.text), text_elements: [] })),
          ...active ? { expectedTurnId: active } : {}
        }));
        const turnId2 = active || text(record(receipt.turn).id);
        const snapshot = await this.read(clientId, id);
        let message = snapshot.initialMessagesPage.data.find((value) => value.executionId === turnId2 && value.clientMessageId === clientMessageId);
        const deadline = Date.now() + 5e3;
        while (!message && !this.disposed && Date.now() < deadline) {
          await new Promise((resolve7) => setTimeout(resolve7, 25));
          message = [...room.live.values()].find((value) => value.executionId === turnId2 && value.clientMessageId === clientMessageId);
        }
        if (!message) throw new CodexBotError("BOT_RESULT_UNKNOWN", "消息已提交，正在核对结果。");
        this.remember(room, message);
        this.emit(id, { method: "bot/message/completed", params: { message } });
        const execution = room.executions.get(turnId2) ?? this.execution(id, { ...record(receipt.turn), id: turnId2, status: "inProgress" });
        room.executions.set(turnId2, execution);
        this.emit(id, { method: "bot/execution/updated", params: { execution } });
        return { messageId: message.messageId, executionId: turnId2, replayed: false };
      }).then(async (receipt) => {
        const snapshot = await this.read(clientId, id);
        const message = snapshot.initialMessagesPage.data.find((value) => value.messageId === receipt.messageId);
        if (!message) throw new CodexBotError("BOT_RESULT_UNKNOWN", "正在核对消息结果。");
        return { message, executions: snapshot.executions.filter((execution) => execution.executionId === receipt.executionId), replayed: receipt.replayed };
      });
    }
    if (method === "bot/execution/cancel") {
      const executionId = required(params.executionId);
      return this.command(`cancel:${id}:${required(params.commandId)}`, params, async () => {
        if ((this.port.activeTurn(this.nativeId(id)) ?? [...room.executions.values()].find((execution) => execution.status === "running")?.executionId) !== executionId) throw new CodexBotError("BOT_EXECUTION_NOT_FOUND", "此次回复已经结束。");
        await this.requestNative(clientId, "turn/interrupt", { threadId: this.nativeId(id), turnId: executionId });
        return { execution: this.execution(id, { id: executionId, status: "interrupted" }), replayed: false };
      });
    }
    if (method === "bot/interaction/respond") {
      const request2 = room.interactions.get(required(params.interactionId));
      if (!request2 || request2.clientId !== clientId || request2.interaction.executionId !== params.executionId || request2.interaction.status !== "pending")
        throw new CodexBotError("BOT_INTERACTION_NOT_FOUND", "此问题已失效。");
      const response = record(params.response);
      let result;
      if (request2.interaction.kind === "approval" && response.type === "approval" && request2.interaction.choices.some((choice) => choice.choiceId === response.choiceId)) result = { decision: response.choiceId };
      else if (request2.interaction.kind === "clarification" && response.type === "clarification") result = { answers: Object.fromEntries(Object.entries(record(response.answers)).map(([key, value]) => [key, { answers: Array.isArray(value) ? value : [text(value)] }])) };
      else throw new CodexBotError("BOT_INVALID_INPUT", "请检查回答内容。");
      await this.command(`respond:${id}:${required(params.commandId)}`, params, async () => {
        await this.port.reply(clientId, request2.nativeId, result);
        return { interactionId: request2.interaction.interactionId, replayed: false };
      });
      const interaction = { ...request2.interaction, status: "resolved" };
      room.interactions.set(interaction.interactionId, { ...request2, interaction });
      this.emit(id, { method: "bot/interaction/resolved", params: { interaction } });
      return { interaction, replayed: false };
    }
    throw new CodexBotError("BOT_CAPABILITY_UNAVAILABLE", "此测试入口暂不支持该操作。");
  }
  /** Called once per native notification, before logical fanout. */
  observe(frame) {
    const params = record(frame.params);
    const id = this.disposed ? "" : this.roomId(text(params.threadId));
    const room = this.rooms.get(id);
    if (!room) return;
    const turnId2 = text(params.turnId) || text(record(params.turn).id);
    if (frame.method === "item/started" || frame.method === "item/completed") {
      if (record(params.item).type === "userMessage") this.db.prepare("UPDATE codex_bot_rooms SET draft = 0 WHERE thread_id = ?").run(id);
      const message = this.message(id, turnId2, record(params.item), Date.now(), frame.method === "item/started");
      if (message) {
        this.remember(room, message);
        this.emit(id, { method: frame.method === "item/started" ? "bot/message/started" : "bot/message/completed", params: { message } });
      }
    } else if (frame.method === "item/agentMessage/delta") {
      const messageId = this.messageIdentity(id, turnId2, { type: "agentMessage", id: required(params.itemId) });
      const previous = room.live.get(messageId);
      const message = {
        messageId,
        conversationId: id,
        executionId: turnId2,
        author: BOT,
        createdAtMs: previous?.createdAtMs ?? Date.now(),
        updatedAtMs: Date.now(),
        state: "streaming",
        content: [{ type: "text", text: (previous?.content[0]?.type === "text" ? previous.content[0].text : "") + text(params.delta) }]
      };
      this.remember(room, message);
      this.emit(id, { method: "bot/message/started", params: { message } });
    } else if (frame.method === "turn/started" || frame.method === "turn/completed") {
      const execution = this.execution(id, record(params.turn));
      room.executions.set(execution.executionId, execution);
      if (room.executions.size > 100) for (const [key, value] of room.executions) {
        if (value.status !== "running") room.executions.delete(key);
        if (room.executions.size <= 100) break;
      }
      this.emit(id, { method: "bot/execution/updated", params: { execution } });
    } else if (frame.method === "serverRequest/resolved") {
      const request2 = room.interactions.get(String(params.requestId));
      if (request2) {
        const interaction = { ...request2.interaction, status: "resolved" };
        room.interactions.delete(interaction.interactionId);
        this.emit(id, { method: "bot/interaction/resolved", params: { interaction } });
      }
    }
  }
  observeInteraction(clientId, frame) {
    const params = record(frame.params);
    const id = this.disposed ? "" : this.roomId(text(params.threadId)), room = this.rooms.get(id);
    if (!room || typeof frame.id !== "string" && typeof frame.id !== "number") return;
    const interactionId = String(frame.id);
    const common = { interactionId, conversationId: id, executionId: text(params.turnId), participantId: BOT.participantId, status: "pending" };
    let interaction;
    if (frame.method === "item/tool/requestUserInput") interaction = {
      ...common,
      kind: "clarification",
      title: "需要你的回答",
      questions: array(params.questions).map((value) => {
        const question = record(value);
        return { questionId: required(question.id), prompt: text(question.question), choices: array(question.options).map((value2) => ({ value: text(record(value2).label), label: text(record(value2).label) })) };
      })
    };
    else if (frame.method === "item/commandExecution/requestApproval" || frame.method === "item/fileChange/requestApproval") interaction = {
      ...common,
      kind: "approval",
      title: "需要你的确认",
      description: text(params.reason),
      choices: [{ choiceId: "accept", label: "允许" }, { choiceId: "decline", label: "拒绝" }, { choiceId: "cancel", label: "取消" }]
    };
    else return;
    room.interactions.set(interactionId, { clientId, nativeId: frame.id, interaction });
    this.emit(id, { method: "bot/interaction/requested", params: { interaction } });
  }
};
