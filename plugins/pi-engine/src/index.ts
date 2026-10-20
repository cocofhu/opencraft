import { permissionModeProfileId } from "@opencraft/appserver-protocol";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai/models";
import { PiDurableSession, createPiModels } from "./session.js";
import type { ExecutionEngineClient as EngineClient } from "@opencraft/appserver-client";

type Value = Record<string, any>;
interface Session {
  format: "pi-durable-1"; id: string; cwd: string; model: string; name: string | null; preview: string;
  createdAt: number; updatedAt: number; archived: boolean; projectId?: string | null; pendingRecovery?: boolean; tools: Value[];
  native?: PiDurableSession; starting?: Promise<PiDurableSession>; owner?: EngineClient;
  active?: Value; items?: Map<string, Value>; stopped?: boolean;
}
export const piModel = (provider: string, model: string) => `pi:${encodeURIComponent(provider)}:${encodeURIComponent(model)}`;
const selection = (model: string) => {
  const match = /^pi:([^:]+):(.+)$/u.exec(model);
  if (!match) throw new Error("Select a Pi model; changing an existing thread's engine requires a new thread");
  return { provider: decodeURIComponent(match[1]!), modelId: decodeURIComponent(match[2]!) };
};
const fullAccessProfile = permissionModeProfileId("full");
function assertNativePermissions(params: Value) {
  const sandbox = params.sandboxPolicy;
  if (params.permissions != null && params.permissions !== fullAccessProfile
    || params.sandbox != null && params.sandbox !== "danger-full-access"
    || sandbox != null && (typeof sandbox !== "object" || sandbox.type !== "dangerFullAccess" || Object.keys(sandbox).some(key => key !== "type"))
    || params.approvalPolicy != null && params.approvalPolicy !== "never") {
    throw new Error("Pi supports Full access only; choose Full access or use another engine for restricted permissions");
  }
}
const seconds = () => Math.floor(Date.now() / 1000);
const textOf = (content: any) => typeof content === "string" ? content : (content ?? []).filter((part: Value) => part.type === "text").map((part: Value) => part.text).join("\n");

export function flattenPiTools(specs: Value[]): Value[] {
  const tools = specs.flatMap(spec => spec.type === "namespace" ? spec.tools.map((tool: Value) => ({ ...tool, namespace: spec.name })) : [{ ...spec, namespace: null }]);
  const names = new Set<string>();
  return tools.map((tool, index) => {
    if (typeof tool.name !== "string" || !tool.inputSchema || typeof tool.inputSchema !== "object") throw new Error("Invalid platform tool declaration");
    const identity = JSON.stringify([tool.namespace, tool.name]);
    if (names.has(identity)) throw new Error("Duplicate platform tool declaration"); names.add(identity);
    // A reserved prefix keeps native Pi tools and namespace-local names distinct.
    return { ...tool, piName: `opencraft_${index}_${tool.name.replace(/[^a-zA-Z0-9_]/gu, "_")}` };
  });
}

/** Owns native Pi sessions. The index contains routing/display metadata, never a replacement native ledger. */
export class PiEngine {
  readonly id = "pi";
  readonly label = "Pi Coding Agent";
  readonly threadPrefix = "pi_";
  readonly modelPrefix = "pi:";
  readonly extensions = Object.freeze({
    "opencraft/thread-lifecycle": { version: 1, fork: false, ephemeral: false, injectItems: false, rename: true, archive: true, unsubscribe: true, pin: false },
    "opencraft/host-capabilities": { version: 1 },
    "opencraft/scoped-model-catalog": { version: 1 },
    "opencraft/resume-history": { version: 1, mode: "legacy" },
    "opencraft/thread-follow-up": { version: 1, queue: false, steer: false },
  });
  private readonly sessions = new Map<string, Session>();
  private readonly listeners = new Set<(method: string, params: Value) => void>();
  private loading?: Promise<void>;
  private closed = false;
  private readonly writes = new Map<string, Promise<void>>();
  private readonly operations = new Map<string, Promise<unknown>>();
  private catalog?: Promise<Value[]>;
  private readonly modelsRuntime: ReturnType<typeof createPiModels>;
  constructor(private readonly options: { directory: string; cwd: string; modelDirectory?: string; models?: Awaited<ReturnType<typeof createPiModels>> }) { this.modelsRuntime = options.models ? Promise.resolve(options.models) : createPiModels(options.modelDirectory ?? options.directory); }
  ownsThread(id: string) { return id.startsWith("pi_"); }
  ownsModel(id: string) { return id.startsWith("pi:"); }

  subscribe(listener: (method: string, params: Value) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify(method: string, params: Value) { for (const listener of this.listeners) listener(method, params); }
  private load() {
    return this.loading ??= (async () => {
      await mkdir(this.options.directory, { recursive: true, mode: 0o700 });
      for (const file of await readdir(this.options.directory)) {
        if (!/^pi_[a-f0-9-]+\.json$/u.test(file)) continue;
        const record = JSON.parse(await readFile(join(this.options.directory, file), "utf8"));
        if (record.format !== "pi-durable-1" || `${record.id}.json` !== file) throw new Error("Invalid Pi session index");
        this.sessions.set(record.id, record);
      }
    })();
  }
  async start() {
    await this.load(); await this.modelsRuntime;
    for (const session of this.sessions.values()) {
      if (!session.pendingRecovery || session.archived) continue;
      await this.history(session);
      if (session.active) await (await this.native(session)).call("resume");
      else { session.pendingRecovery = false; await this.save(session); }
    }
  }
  private save(session: Session): Promise<void> {
    const { native: _native, starting: _starting, owner: _owner, active: _active, items: _items, stopped: _stopped, ...record } = session;
    const file = join(this.options.directory, `${session.id}.json`), temporary = `${file}.${randomUUID()}.tmp`;
    const operation = (this.writes.get(session.id) ?? Promise.resolve()).catch(() => {}).then(async () => {
      await writeFile(temporary, JSON.stringify(record), { mode: 0o600 }); await rename(temporary, file);
    });
    this.writes.set(session.id, operation);
    void operation.finally(() => { if (this.writes.get(session.id) === operation) this.writes.delete(session.id); }).catch(() => {});
    return operation;
  }
  private async session(id: string) {
    await this.load(); const session = this.sessions.get(id);
    if (!session) throw new Error("Pi thread not found"); return session;
  }
  private async native(session: Session): Promise<PiDurableSession> {
    if (this.closed) throw new Error("Pi engine is closed");
    if (session.native) return session.native;
    return session.starting ??= (async () => {
      const rpc = await PiDurableSession.open({ cwd: session.cwd,
        file: join(this.options.directory, `${session.id}.sqlite`), agentDirectory: this.options.modelDirectory ?? this.options.directory, models: await this.modelsRuntime, tools: session.tools,
        onEvent: event => this.event(session, event),
        onTool: async request => {
          const tool = session.tools.find(tool => tool.piName === request.name);
          if (!tool || !session.owner || !session.active) throw new Error("No live platform tool owner");
          return session.owner.request("item/tool/call", { threadId: session.id, turnId: session.active.id,
            callId: request.id, namespace: tool.namespace, tool: tool.name, arguments: request.arguments });
        },
        onExit: () => { session.native = undefined; session.active = undefined; session.items = undefined;
          this.notify("thread/status/changed", { threadId: session.id, status: { type: "systemError" } }); },
      });
      try {
        await rpc.call("get_state");
        await rpc.call("set_model", selection(session.model));
        if (this.closed) throw new Error("Pi engine is closed");
        session.native = rpc; return rpc;
      } catch (error) { await rpc.close(); throw error; }
      finally { session.starting = undefined; }
    })();
  }
  async models(): Promise<Value[]> {
    return this.catalog ??= (async () => {
      const models = (await this.modelsRuntime).getAvailableSnapshot();
      try {
        return models.map((model: Value) => ({ id: piModel(model.provider, model.id), model: piModel(model.provider, model.id),
          displayName: model.name ?? model.id, description: `${model.provider} · Pi Coding Agent`,
          groupKey: `pi:${model.provider}`, groupLabel: `Pi · ${model.provider}`, hidden: false, isDefault: false,
          supportedReasoningEfforts: getSupportedThinkingLevels(model as any).map(reasoningEffort => ({ reasoningEffort: reasoningEffort === "off" ? "none" : reasoningEffort, description: reasoningEffort })),
          defaultReasoningEffort: getSupportedThinkingLevels(model as any).includes("medium") ? "medium" : (getSupportedThinkingLevels(model as any)[0] === "off" ? "none" : getSupportedThinkingLevels(model as any)[0]) ?? "none", inputModalities: ["text"],
          contextWindow: model.contextWindow, maxTokens: model.maxTokens, source: "builtin", additionalSpeedTiers: [], serviceTiers: [], upgrade: null,
        }));
      } finally { this.catalog = undefined; }
    })();
  }
  private thread(session: Session, turns: Value[] = []) {
    return { id: session.id, sessionId: session.id, forkedFromId: null, parentThreadId: null,
      name: session.name, preview: session.preview, ephemeral: false, projectId: session.projectId ?? null,
      historyMode: "legacy", modelProvider: "pi", model: session.model, reasoningEffort: null,
      createdAt: session.createdAt, updatedAt: session.updatedAt, recencyAt: session.updatedAt,
      status: session.active ? { type: "active", activeFlags: [] } : { type: "idle" },
      path: join(this.options.directory, `${session.id}.sqlite`), cwd: session.cwd, cliVersion: "1.3.0",
      source: "appServer", originator: "opencraft", canAcceptDirectInput: true,
      threadSource: null, agentNickname: null, agentRole: null, gitInfo: null, daybreakEnabled: null,
      environments: null, extra: null, section: null, sectionEnteredAt: null, turns };
  }
  private response(session: Session, turns: Value[] = []) {
    return { thread: this.thread(session, turns), model: session.model, modelProvider: "pi", serviceTier: null,
      cwd: session.cwd, runtimeWorkspaceRoots: [session.cwd], instructionSources: [], disabledPluginIds: [],
      approvalPolicy: "never", approvalsReviewer: "user", sandbox: { type: "dangerFullAccess" }, activePermissionProfile: { id: fullAccessProfile, extends: null },
      reasoningEffort: null, multiAgentMode: "explicitRequestOnly" };
  }
  private async history(session: Session): Promise<Value[]> {
    const rpc = await this.native(session), { messages, live } = await rpc.call("get_messages");
    const turns: Value[] = []; let turn: Value | undefined;
    for (let index = 0; index < messages.length; index++) {
      const message = messages[index];
      if (message.role === "user") {
        turn = { id: message.submission?.requestId ?? `${session.id}:turn:${turns.length}`, items: [], itemsView: "complete", status: "completed", error: null,
          startedAt: message.timestamp ? Math.floor(message.timestamp / 1000) : null, completedAt: null, durationMs: null };
        turns.push(turn);
        if (message.submission?.status === "placed" || message.submission?.status === "queued") turn.status = "inProgress";
        else if (message.submission?.status === "unanswered") {
          turn.status = message.submission.reason === "aborted" ? "interrupted" : "failed";
          if (turn.status === "failed") turn.error = { message: String(message.submission.detail ?? message.submission.reason), codexErrorInfo: null, additionalDetails: null };
        }
        turn.items.push({ type: "userMessage", id: `${turn.id}:user`, clientId: typeof message.submission?.requestId === "string" && message.submission.requestId.startsWith(`${session.id}:turn:client:`) ? message.submission.requestId.slice(`${session.id}:turn:client:`.length) : null, content: [{ type: "text", text: textOf(message.content), text_elements: [] }] });
      } else if (turn && message.role === "assistant") {
        const text = textOf(message.content);
        if (text) turn.items.push({ type: "agentMessage", id: `${session.id}:message:${index}`, text, phase: null, memoryCitation: null, delivery: null, questions: null });
        for (const tool of (message.content ?? []).filter((part: Value) => part.type === "toolCall")) turn.items.push(this.toolItem(tool.id, tool.name, tool.arguments));
      } else if (turn && message.role === "toolResult") {
        const item = turn.items.find((item: Value) => item.id === message.toolCallId);
        if (item) Object.assign(item, { status: message.isError ? "failed" : "completed", success: !message.isError,
          contentItems: [{ type: "inputText", text: textOf(message.content) }] });
      }
    }
    if (!session.active && turns.at(-1)?.status === "inProgress") {
      session.active = turns.at(-1); session.items = new Map();
      const partial = live?.generation?.message;
      if (partial) {
        const item = { type: "agentMessage", id: `${session.active!.id}:partial`, text: textOf(partial.content), phase: null, memoryCitation: null, delivery: null, questions: null };
        session.active!.items.push(item); session.items.set("assistant", item);
      }
      for (const tool of live?.tools ?? []) {
        const existing = session.active!.items.find((item: Value) => item.id === tool.callId);
        const item = existing ?? this.toolItem(tool.callId, tool.name, {});
        if (!existing) session.active!.items.push(item); session.items.set(tool.callId, item);
      }
    }
    if (session.active && turns.length) turns[turns.length - 1] = session.active;
    return turns;
  }
  private toolItem(id: string, tool: string, args: Value): Value {
    return { type: "dynamicToolCall", id, namespace: null, tool, arguments: args, status: "inProgress", contentItems: null, success: null, durationMs: null };
  }
  private event(session: Session, event: Value) {
    if (!session.active) return;
    const common = { threadId: session.id, turnId: session.active.id };
    if (event.type === "snapshot") {
      this.notify("thread/status/changed", { threadId: session.id, status: { type: "active", activeFlags: [] } });
    } else if (event.type === "message_start" && event.message?.role === "assistant") {
      const item = { type: "agentMessage", id: randomUUID(), text: "", phase: null, memoryCitation: null, delivery: null, questions: null };
      session.items!.set("assistant", item); session.active.items.push(item);
      this.notify("item/started", { ...common, item });
    } else if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
      const item = session.items!.get("assistant"); if (!item) return;
      item.text += event.assistantMessageEvent.delta;
      this.notify("item/agentMessage/delta", { ...common, itemId: item.id, delta: event.assistantMessageEvent.delta });
    } else if (event.type === "message_end" && event.message?.role === "assistant") {
      const item = session.items!.get("assistant");
      if (item) { item.text = textOf(event.message.content); this.notify("item/completed", { ...common, item }); }
      if (event.message.stopReason === "error") session.active.error = { message: event.message.errorMessage ?? "Pi model failed", codexErrorInfo: null, additionalDetails: null };
    } else if (event.type === "tool_execution_start") {
      const item = this.toolItem(event.toolCallId, event.toolName, event.args);
      session.items!.set(event.toolCallId, item); session.active.items.push(item);
      this.notify("item/started", { ...common, item });
    } else if (event.type === "tool_execution_end") {
      const item = session.items!.get(event.toolCallId); if (!item) return;
      Object.assign(item, { status: event.isError ? "failed" : "completed", success: !event.isError,
        contentItems: [{ type: "inputText", text: textOf(event.result?.content) }] });
      this.notify("item/completed", { ...common, item });
    } else if (event.type === "agent_settled") this.finish(session, session.stopped ? "interrupted" : session.active.error ? "failed" : "completed");
  }
  private finish(session: Session, status: string, error?: string) {
    if (!session.active) return;
    const turn = session.active;
    Object.assign(turn, { status, completedAt: seconds(), durationMs: Date.now() - turn.startedAt * 1000,
      ...(error ? { error: { message: error, codexErrorInfo: null, additionalDetails: null } } : {}) });
    session.active = undefined; session.items = undefined; session.stopped = false; session.pendingRecovery = false; session.updatedAt = seconds();
    this.notify("turn/completed", { threadId: session.id, turn });
    this.notify("thread/status/changed", { threadId: session.id, status: { type: "idle" } });
    void this.save(session).catch(() => {});
  }

  request(method: string, params: Value, client: EngineClient): Promise<any> {
    const key = params.threadId;
    if (typeof key !== "string") return this.handle(method, params, client);
    const operation = (this.operations.get(key) ?? Promise.resolve()).catch(() => {}).then(() => this.handle(method, params, client));
    this.operations.set(key, operation);
    void operation.finally(() => { if (this.operations.get(key) === operation) this.operations.delete(key); }).catch(() => {});
    return operation;
  }
  private async handle(method: string, params: Value, client: EngineClient): Promise<any> {
    await this.load();
    if (this.closed) throw new Error("Pi engine is closed");
    if (method === "config/read") {
      let saved: Value = {};
      try { saved = JSON.parse(await readFile(join(this.options.directory, "defaults.json"), "utf8")); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      const models = await this.models();
      return { config: { model: saved.model ?? models[0]?.model ?? null, model_reasoning_effort: saved.effort ?? null }, origins: {}, layers: null };
    }
    if (method === "config/batchWrite") {
      const previous = (await this.handle("config/read", {}, client)).config;
      const saved: Value = { model: previous.model, effort: previous.model_reasoning_effort };
      for (const edit of params.edits ?? []) {
        if (edit.keyPath === "model") { selection(edit.value); saved.model = edit.value; }
        else if (edit.keyPath === "model_reasoning_effort") saved.effort = edit.value;
        else throw new Error("Unsupported Pi default setting");
      }
      const temporary = join(this.options.directory, `defaults.${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(saved), { mode: 0o600 }); await rename(temporary, join(this.options.directory, "defaults.json"));
      return { status: "ok" };
    }
    if (method === "permissionProfile/list") return { data: [], nextCursor: null };
    if (method === "model/list") return { data: await this.models(), nextCursor: null };
    if (method === "thread/list") return { data: [...this.sessions.values()].filter(s => s.archived === (params.archived === true))
      .filter(s => !params.searchTerm || `${s.name ?? ""} ${s.preview}`.toLowerCase().includes(params.searchTerm.toLowerCase()))
      .sort((a,b) => b.updatedAt - a.updatedAt).map(s => this.thread(s)), nextCursor: null };
    if (method === "thread/start") {
      assertNativePermissions(params);
      if (params.ephemeral || params.baseInstructions || params.developerInstructions)
        throw new Error("Pi supports persistent workspace sessions; custom instructions and temporary sessions are not available");
      if (params.projectId != null && (typeof params.projectId !== "string" || !params.projectId.trim())) throw new Error("Invalid workspace project identity");
      const selectedModel = params.model ?? (await this.models())[0]?.model;
      selection(selectedModel ?? "");
      const session: Session = { format: "pi-durable-1", id: `pi_${randomUUID()}`, cwd: resolve(params.cwd ?? this.options.cwd), model: selectedModel,
        projectId: params.projectId ?? null, name: null, preview: "", createdAt: seconds(), updatedAt: seconds(), archived: false, tools: flattenPiTools(params.dynamicTools ?? []), owner: client };
      this.sessions.set(session.id, session);
      try { await this.native(session); await this.save(session); return this.response(session); }
      catch (error) { this.sessions.delete(session.id); await session.native?.close(); throw error; }
    }
    const session = await this.session(params.threadId);
    if (params.model && !String(params.model).startsWith("pi:")) throw new Error("This thread belongs to Pi; create a new thread to change engines");
    if (method === "thread/read") return { thread: this.thread(session, params.includeTurns ? await this.history(session) : []) };
    if (method === "thread/resume") {
      assertNativePermissions(params);
      if (!session.active) session.owner = client;
      const turns = await this.history(session);
      await (await this.native(session)).call("resume");
      return this.response(session, turns);
    }
    if (method === "thread/name/set") { session.name = params.name; await this.save(session);
      this.notify("thread/name/updated", { threadId: session.id, threadName: session.name }); return {}; }
    if (method === "thread/archive" || method === "thread/unarchive") {
      if (session.active) throw new Error("Stop the Pi turn before archiving");
      session.archived = method === "thread/archive"; await this.save(session); return method === "thread/unarchive" ? { thread: this.thread(session) } : {};
    }
    if (method === "thread/unsubscribe") { if (session.owner === client) session.owner = undefined; return { status: "unsubscribed" }; }
    if (method === "runtime/capabilities/register") {
      if (session.active && session.owner !== client) throw new Error("Cannot replace the platform tool owner during a Pi turn");
      const tools = flattenPiTools(params.dynamicTools ?? []);
      if (JSON.stringify(tools) !== JSON.stringify(session.tools)) {
        if (session.active) throw new Error("Cannot replace platform tools during a Pi turn");
        await session.native?.close(); session.native = undefined; session.tools = tools; await this.save(session);
      }
      session.owner = client; await this.native(session); return { registered: tools.length };
    }
    if (method === "turn/start") {
      const clientId = typeof params.clientUserMessageId === "string" && params.clientUserMessageId.length > 0 ? params.clientUserMessageId : null;
      if (clientId && clientId.length > 1000) throw new Error("Client message identity is too long");
      const turnId = clientId ? `${session.id}:turn:client:${clientId}` : `${session.id}:turn:${randomUUID()}`;
      const history = await this.history(session);
      const existing = clientId && history.find(turn => turn.id === turnId);
      if (existing) return { turn: existing };
      if (session.active) throw new Error("Pi thread already has an active turn");
      if (session.archived) throw new Error("Unarchive the Pi thread before executing");
      assertNativePermissions(params);
      if (!Array.isArray(params.input) || params.input.some((part: Value) => part.type !== "text")) throw new Error("Pi currently accepts text input only");
      const rpc = await this.native(session);
      if (params.model) { await rpc.call("set_model", selection(params.model)); session.model = params.model; }
      if (params.effort) await rpc.call("set_thinking_level", { level: params.effort });
      const turn = { id: turnId, items: [] as Value[], itemsView: "complete", status: "inProgress", error: null,
        startedAt: seconds(), completedAt: null, durationMs: null };
      const text = params.input.map((part: Value) => part.text).join("\n");
      turn.items.push({ type: "userMessage", id: `${turn.id}:user`, clientId, content: params.input });
      session.owner = client; session.active = turn; session.items = new Map(); session.stopped = false; session.pendingRecovery = true;
      session.preview ||= text.slice(0, 200); session.updatedAt = seconds(); await this.save(session);
      this.notify("turn/started", { threadId: session.id, turn });
      try { await rpc.call("prompt", { message: text, requestId: turn.id }); }
      catch (error) { this.finish(session, "failed", (error as Error).message); throw error; }
      return { turn: { ...turn, items: [...turn.items] } };
    }
    if (method === "turn/interrupt") {
      if (params.turnId && session.active?.id !== params.turnId) throw new Error("Pi turn identity changed");
      if (!session.active) return {};
      session.stopped = true;
      const rpc = await this.native(session); await rpc.call("clear_queue"); await rpc.call("abort");
      this.finish(session, "interrupted"); return {};
    }
    throw new Error(`Pi does not support ${method}`);
  }
  disconnect(client: EngineClient) { for (const session of this.sessions.values()) if (session.owner === client) session.owner = undefined; }
  async close() {
    this.closed = true;
    await Promise.allSettled(this.operations.values());
    await Promise.allSettled([...this.sessions.values()].map(async session => {
      const rpc = session.native ?? await session.starting?.catch(() => undefined); await rpc?.close();
      session.active = undefined; session.items = undefined;
    }));
    await Promise.allSettled(this.writes.values());
    this.listeners.clear();
  }
}
