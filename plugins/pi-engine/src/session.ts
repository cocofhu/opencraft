import { ModelRuntime, loadProjectContextFiles } from "@earendil-works/pi-coding-agent";
import { BACKGROUND_CONTEXT as context, type Context } from "@earendil-works/chord/context";
import { createRegistry, defineExtension, defineTool, Harness, section, watchEvents,
  LiveDoc, type AgentEventStream, type Conversation, type Storage } from "@earendil-works/pi-durable";
import { NodeExecutionEnv } from "@earendil-works/pi-durable/env/node";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { CodingTools } from "@earendil-works/pi-durable/tools";
import lockfile from "proper-lockfile";

type Value = Record<string, any>;
export const createPiModels = (directory: string) => ModelRuntime.create({ allowModelNetwork: false, authPath: `${directory}/auth.json`, modelsPath: `${directory}/models.json` });

/** One native durable owner. Closing suspends work; abort explicitly cancels it. */
export class PiDurableSession {
  private closed = false;
  private stream!: AgentEventStream;
  private harness!: Awaited<ReturnType<typeof Harness.open>>;
  private root!: Conversation;
  private storage!: Storage;
  private release?: () => Promise<void>;
  private readonly env: NodeExecutionEnv;
  private constructor(private readonly options: { cwd: string; file: string; agentDirectory: string; models: ModelRuntime; tools: Value[];
    onEvent(event: Value): void; onTool(request: Value): Promise<unknown>; onExit(error: Error): void }) {
    this.env = new NodeExecutionEnv({ cwd: options.cwd });
  }
  static async open(options: PiDurableSession["options"]) {
    const session = new PiDurableSession(options);
    try { await session.open(); return session; }
    catch (error) { await session.close(); throw error; }
  }
  private async open() {
    this.release = await lockfile.lock(this.options.file, { realpath: false, stale: 10_000,
      retries: { retries: 12, minTimeout: 1000, maxTimeout: 1000 } });
    const registry = createRegistry(); registry.install(CodingTools);
    registry.install(defineExtension({ name: "opencraft", sections: [section("preamble", () =>
      "You are a coding assistant. Complete the user task using the available tools. Preserve existing work.", { tag: false }),
      section("workspace", () => `Working directory: ${this.options.cwd}\n` + loadProjectContextFiles({ cwd: this.options.cwd, agentDir: this.options.agentDirectory }).map(file => `# ${file.path}\n${file.content}`).join("\n\n"), { tag: false })],
      tools: this.options.tools.map(tool => defineTool({
        name: tool.piName, description: tool.description, parameters: tool.inputSchema,
        // Host calls are not replay-safe. Durable records an interrupted result
        // after a crash instead of duplicating an external side effect.
        execute: async (args: unknown, api: Value, ctx: Context) => {
          if (this.closed || ctx.abortSignal?.aborted) throw new Error("Platform tool cancelled");
          let cancel: (() => void) | undefined;
          const cancelled = new Promise<never>((_resolve, reject) => {
            cancel = () => reject(new Error("Platform tool cancelled"));
            ctx.abortSignal?.addEventListener("abort", cancel, { once: true });
          });
          let result: Value;
          try { result = await Promise.race([this.options.onTool({ id: api.callId, name: tool.piName, arguments: args }), cancelled]) as Value; }
          finally { if (cancel) ctx.abortSignal?.removeEventListener("abort", cancel); }
          if (!result?.success) throw new Error("Platform tool failed");
          return { output: (result.contentItems ?? []).map((item: Value) => item.type === "inputText"
            ? { type: "text" as const, text: item.text } : { type: "text" as const, text: "[Unsupported platform tool output]" }) };
        },
      })) }));
    this.storage = await openNodeSqliteStorage(this.options.file);
    this.harness = await Harness.open(this.storage,
      { models: this.options.models, registry, env: () => this.env }, context);
    void this.harness.closed.then(async end => {
      if (!this.closed && end.reason === "failed") {
        this.options.onExit(new Error("Pi durable storage failed"));
        await this.close();
      }
    }).catch(() => {});
    this.root = await this.harness.root(context);
    this.stream = await watchEvents(this.harness, this.root.id, context);
    this.stream.start(async events => {
      for (const event of events) {
        if (event.type === "message_update") {
          for (const change of event.changes) if (change.type === "text_delta") this.options.onEvent({ type: "message_update", assistantMessageEvent: change });
        } else if (event.type === "message_end") {
          for (const message of event.entry.model ?? []) this.options.onEvent({ type: "message_end", message });
        } else if (event.type === "tool_execution_end") {
          const result = event.entry?.model?.[0] ?? event.result;
          this.options.onEvent({ ...event, result, isError: result && "isError" in result ? result.isError : true });
        } else if (event.type === "run_end") {
          this.options.onEvent({ type: "agent_settled" });
        } else this.options.onEvent(event);
      }
    });
  }
  private async pages(read: (cursor: any) => Promise<{ items: readonly any[]; next?: any }>) {
    const values: any[] = []; let cursor: any;
    do { const page = await read(cursor); values.push(...page.items); cursor = page.next; } while (cursor !== undefined);
    return values;
  }
  async call(type: string, params: Value = {}): Promise<any> {
    if (this.closed) throw new Error("Pi durable session is closed");
    if (type === "get_state") return { version: "1.3.0", pending: (await this.harness.inspect(context)).submissions.some(s => s.type === "input") };
    if (type === "set_model") {
      if (!this.options.models.getModel(params.provider, params.modelId)) throw new Error("Pi model is unavailable");
      await this.root.configure({ model: { provider: params.provider, modelId: params.modelId } }, context); return {};
    }
    if (type === "set_thinking_level") { await this.root.configure({ thinkingLevel: params.level === "none" ? "off" : params.level }, context); return {}; }
    if (type === "get_messages") {
      const entries = await this.pages(cursor => this.root.entries({ order: "ascending" }, 100, cursor, context));
      const submissions = await this.pages(cursor => this.storage.scanSubmissions({ conversationId: this.root.id }, 100, cursor, context));
      return { live: await this.harness.snapshot(LiveDoc, this.root.id, context), messages: entries.flatMap(entry => (entry.model ?? []).map((message: Value) => ({ ...message, entryId: entry.id,
        submission: submissions.find(s => s.type === "input" && s.entry === entry.id) }))) };
    }
    if (type === "resume") { this.harness.resume(); return {}; }
    if (type === "prompt") {
      const submission = await this.root.submit({ type: "input", content: params.message, whenBusy: "reject", requestId: params.requestId }, context);
      return { submissionId: submission.id };
    }
    if (type === "abort") { await this.root.abort(context); return {}; }
    if (type === "clear_queue") return {}; // Native abort atomically withdraws queued inputs too.
    throw new Error(`Unsupported Pi durable operation ${type}`);
  }
  async close() {
    if (this.closed) return; this.closed = true;
    try { try { await this.stream?.stop(); } finally { await this.harness?.close(context); } }
    finally { try { await this.env.cleanup(context); } finally { await this.release?.(); } }
  }
}
