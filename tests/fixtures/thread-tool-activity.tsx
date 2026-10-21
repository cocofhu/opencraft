import React, { useState } from "react";
import type { ThreadItem } from "../../packages/appserver-protocol/src/generated/v2/ThreadItem";
import { Context } from "@deepseek-ai/cordis";
import { createConversationKey, createDefaultTimelineProjectorRegistry, projectTimeline, type TimelineSourceItem } from "@opencraft/chat-core";
import { buildOpenCraftThemeCssProperties } from "@opencraft/design-system/theme-engine";
import { TimelineBlockRendererProvider, TimelineBlockRendererRegistryService } from "@opencraft/timeline-render-react";
import { Conversation } from "../../apps/workbench-web/src/components/conversation";
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
const hostContentScenario = new URLSearchParams(location.search).get("scenario") === "host-content";
const probe = window as unknown as { changeThreadToolPhase: (phase: string) => void; openedThreads: string[]; changeHostContentMode: (mode: string) => void; hostActions: string[]; hostRenderedModes: Record<string, string> };
probe.openedThreads = [];
probe.hostActions = [];
probe.hostRenderedModes = {};
function tool(id: string, name: string, arguments_: unknown, status = "completed", output?: unknown): TimelineSourceItem {
  return { id, type: "dynamicToolCall", payload: {
    namespace: "codex_app", tool: name, arguments: arguments_, status, success: status !== "failed",
    ...(output === undefined ? {} : { contentItems: [{ type: "inputText", text: JSON.stringify(output) }] }),
  } };
}

function hostToolItems(failed: boolean): TimelineSourceItem[] {
  type Dynamic = Extract<ThreadItem, { type: "dynamicToolCall" }>;
  const native = (id: string, tool: string, args: Dynamic["arguments"], output: unknown, fail = failed): Dynamic => ({
    id, type: "dynamicToolCall", namespace: "codex_app", tool, arguments: args,
    status: fail ? "failed" : "completed", success: !fail, durationMs: 12,
    contentItems: [{ type: "inputText", text: JSON.stringify(output) }],
  });
  return [
    native("create", "create_thread", { target: { type: "project" } }, { threadId: "created-ai" }),
    native("read", "read_thread", { threadId: "read-ai" }, { threadId: "read-ai" }),
    native("handoff", "handoff_thread", { threadId: "source-ai" }, { status: "warning", threadTitle: "Review", steps: [
      { id: "prepare-host-transfer", status: "done" }, { id: "transfer-host-artifacts", status: "failed" },
      { id: "create-new-worktree", status: "pending" },
    ] }),
    native("empty", "handoff_thread", { threadId: "queued-ai" }, { status: "queued", steps: [] }),
    native("poll", "get_handoff_status", { operationId: "waiting-ai" }, { status: "queued", steps: [] }, false),
  ].map(({ id, type, ...payload }) => ({ id, type, payload }));
}

function Demo() {
  const [phase, setPhase] = useState("inProgress");
  probe.changeThreadToolPhase = setPhase;
  const [hostMode, setHostMode] = useState("content");
  probe.changeHostContentMode = mode => { setHostMode(mode); setPhase("inProgress"); };
  const items: TimelineSourceItem[] = hostContentScenario ? hostToolItems(phase === "failed") : [
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
    authoritative: true, phase: "live", turns: [{ id: "turn", status: hostContentScenario || phase === "inProgress" ? "streaming" : "complete", items }] }, registry);
  return <div data-phase={phase} data-host-mode={hostMode} style={{ width: "100vw", height: "100dvh" }}>
    <TimelineBlockRendererProvider registry={context.timelineBlockRenderers}>
      <Conversation key={hostContentScenario ? hostMode : undefined} timeline={timeline} scrollPolicy="natural" threadDetailLevel="STEPS_PROSE"
        onOpenSubagent={id => probe.openedThreads.push(id)}
        renderToolCallContent={hostContentScenario && hostMode !== "absent" ? block => { probe.hostRenderedModes[block.callId] = hostMode; return hostMode === "fallback" ? undefined
          : hostMode === "null" ? null : hostMode === "false" ? false
          : <section data-host-body={block.callId}>
              <label>Host note {block.callId}<input aria-label={"Host note " + block.callId} defaultValue="" /></label>
              <button type="button" onClick={() => probe.hostActions.push(block.callId)}>Host action {block.callId}</button>
            </section>; } : undefined}
        footer={<div style={{ height: 48 }}>Composer fixture</div>} />
    </TimelineBlockRendererProvider>
  </div>;
}
createIntlTestRoot(document.getElementById("root")!).render(<Demo />);
