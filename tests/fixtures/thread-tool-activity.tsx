import type { ThreadItem } from "../../packages/appserver-protocol/src/generated/v2/ThreadItem";
import React, { useRef, useState } from "react";
import { Context } from "@deepseek-ai/cordis";
import { createConversationKey, createDefaultTimelineProjectorRegistry, projectTimeline, type TimelineSourceItem } from "@opencraft/chat-core";
import { buildOpenCraftThemeCssProperties } from "@opencraft/design-system/theme-engine";
import { TimelineBlockRendererProvider, TimelineBlockRendererRegistryService } from "@opencraft/timeline-render-react";
import { Conversation, type ConversationRestoreSnapshot } from "../../apps/workbench-web/src/components/conversation";
import { BuiltinTimelineRendererPlugin } from "../../apps/workbench-web/src/components/conversation-renderers/builtin-timeline-renderer-plugin";
import { createIntlTestRoot } from "./intl-root";
import "../../apps/workbench-web/src/styles/app.scss";

const context = new Context();
await context.plugin(TimelineBlockRendererRegistryService);
await context.plugin(BuiltinTimelineRendererPlugin);
const theme = new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light";
document.documentElement.dataset.theme = theme;
for (const [key, value] of Object.entries(buildOpenCraftThemeCssProperties(theme))) document.documentElement.style.setProperty(key, value);
const registry = createDefaultTimelineProjectorRegistry();
const probe = window as unknown as { changeThreadToolPhase: (phase: string) => void; openedThreads: string[] };
probe.openedThreads = [];
function tool(id: string, name: string, arguments_: unknown, status = "completed", output?: unknown): TimelineSourceItem {
  return { id, type: "dynamicToolCall", payload: {
    namespace: "codex_app", tool: name, arguments: arguments_, status, success: status !== "failed",
    ...(output === undefined ? {} : { contentItems: [{ type: "inputText", text: JSON.stringify(output) }] }),
  } };
}

function Demo() {
  const [phase, setPhase] = useState("inProgress");
  probe.changeThreadToolPhase = setPhase;
  const items: TimelineSourceItem[] = [
    tool("fork", "fork_thread", { environment: { type: "worktree" } }, phase),
    tool("read", "read_thread", { threadId: "read-target" }),
    tool("create", "create_thread", { target: { type: "project" } }, "completed", { threadId: "created-target", hostId: "local" }),
    tool("transfer", "handoff_thread", { threadId: "other", destinationHostId: "remote" }, "completed", {
      operationId: "transfer", status: "warning", threadTitle: "Review", destinationHostDisplayName: "Remote",
      destinationThreadId: "remote-target", steps: [{ id: "prepare-host-transfer", status: "done" }, { id: "transfer-host-artifacts", status: "failed" }, { id: "create-new-worktree", status: "pending" }],
    }),
    tool("poll", "get_handoff_status", { operationId: "missing" }, "failed"),
    tool("queued", "handoff_thread", { threadId: "queued-target" }, "completed", {
      operationId: "queued", status: "queued", steps: [{ id: "custom-prepare-step", status: "pending" }],
    }),
    { id: "browser", type: "mcpToolCall", payload: { server: "browser", tool: "browser_click", status: phase,
      arguments: {}, result: { content: [], _meta: { "codex/toolSurface": { kind: "browserUse", backend: "chrome" } } } } },
    { id: "computer", type: "mcpToolCall", payload: { server: "computer-use", tool: "scroll", status: phase,
      arguments: { direction: "down", app: "Notes" } } },
    { id: "custom", type: "dynamicToolCall", payload: { namespace: "custom", tool: "inspect_workspace", status: phase, success: phase !== "failed" } },
  ];
  const timeline = projectTimeline({ key: createConversationKey("fixture", "thread-tools"), revision: ["inProgress", "completed", "failed", "interrupted"].indexOf(phase),
    authoritative: true, phase: "live", turns: [{ id: "turn", status: phase === "inProgress" ? "streaming" : "complete", items }] }, registry);
  return <div data-phase={phase} style={{ width: "100vw", height: "100dvh" }}>
    <TimelineBlockRendererProvider registry={context.timelineBlockRenderers}>
      <Conversation timeline={timeline} scrollPolicy="natural" threadDetailLevel="STEPS_PROSE"
        onOpenSubagent={id => probe.openedThreads.push(id)}
        footer={<div style={{ height: 48 }}>Composer fixture</div>} />
    </TimelineBlockRendererProvider>
  </div>;
}
const liveQuery = new URLSearchParams(location.search);
const liveProbe = window as unknown as {
  setPhase: (phase: string) => void;
  setMounted: (mounted: boolean) => void;
  capturedRestore?: ConversationRestoreSnapshot;
  observed: Record<string, { status: string; content?: string }>;
};
liveProbe.observed = {};
function LiveToolsDemo() {
  const [mounted, setMounted] = useState(true);
  const restore = useRef<ConversationRestoreSnapshot | null>(null);
  const restoreScenario = liveQuery.get("restore") === "1";
  liveProbe.setMounted = setMounted;
  const [phase, setPhase] = useState(liveQuery.get("initial") ?? "running");
  liveProbe.setPhase = setPhase;
  type Dynamic = Extract<ThreadItem, { type: "dynamicToolCall" }>;
  const running = phase === "running" || phase === "progress";
  const status: Dynamic["status"] = running ? "inProgress" : phase === "failed" ? "failed" : "completed";
  const dynamic = (id: string, namespace: string, tool: string, args: Dynamic["arguments"], state = status): Dynamic => ({
    type: "dynamicToolCall", id, namespace, tool, arguments: args, status: state,
    success: state === "inProgress" ? null : state !== "failed", durationMs: state === "inProgress" ? null : 12,
    contentItems: [{ type: "inputText", text: phase === "progress" ? "UPDATED_WRITE_BODY" : "LIVE_WRITE_BODY" }],
  });
  const native: ThreadItem[] = [
    dynamic("live-write", "deepseek-harness", "write", {
      path: "/workspace/live.txt", content: phase === "progress" ? "UPDATED_WRITE_BODY" : "LIVE_WRITE_BODY",
    }),
    dynamic("settled-write", "deepseek-harness", "write", {
      path: "/workspace/settled.txt", content: "SETTLED_WRITE_BODY",
    }, "completed"),
    dynamic("compact", "unregistered", "inspect", { secret: "COMPACT_PAYLOAD_CONTROL" }),
    { type: "mcpToolCall", id: "mcp", server: "fixture", tool: "mcp_probe", arguments: {},
      appContext: null, mcpAppUi: null, pluginId: null, readOnlyHint: null, status: "inProgress",
      result: { _meta: null, content: [{ type: "text", text: "MCP_RESULT_CONTROL" }], structuredContent: null },
      error: null, durationMs: null },
  ];
  const items: TimelineSourceItem[] = native.filter(item => liveQuery.get("single") !== "1" || item.id === "live-write")
    .map(({ id, type, ...payload }) => ({ id, type, payload }));
  const historical = liveQuery.get("history") === "1";
  const timeline = projectTimeline({
    key: createConversationKey("fixture", "live-tools"), revision: ["running", "progress", "completed", "failed"].indexOf(phase),
    authoritative: true, phase: historical ? "painted" : "live",
    turns: [{ id: "turn", status: historical ? "complete" : "streaming", items }],
  }, registry);
  return <div data-phase={phase} style={{ width: "100vw", height: "100dvh" }}>
    <TimelineBlockRendererProvider registry={context.timelineBlockRenderers}>
      {mounted ? <Conversation timeline={timeline} scrollPolicy="natural" threadDetailLevel="STEPS_PROSE"
        initialRestoreSnapshot={restoreScenario ? restore.current : undefined}
        onRestoreSnapshotChange={restoreScenario ? snapshot => { restore.current = snapshot; liveProbe.capturedRestore = snapshot; } : undefined}
        renderToolCallIcon={block => {
          if (block.callId !== null) liveProbe.observed[block.callId] = {
            status: block.status, content: (block.input as { content?: string } | null)?.content,
          };
          return undefined;
        }} footer={<div style={{ height: 48 }}>Composer fixture</div>} /> : null}
    </TimelineBlockRendererProvider>
  </div>;
}

createIntlTestRoot(document.getElementById("root")!).render(new URLSearchParams(location.search).get("scenario") === "live" ? <LiveToolsDemo /> : <Demo />);
