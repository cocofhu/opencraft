import React, { useState } from "react";
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
const webMcpScenario = new URLSearchParams(location.search).get("scenario") === "webmcp";
const webMcpItems: TimelineSourceItem[] = [{ id: "webmcp-browser", type: "mcpToolCall", payload: {
  server: "node_repl", tool: "browser_click", status: "completed", arguments: {},
  result: { content: [], _meta: { "codex/toolSurface": { kind: "browserUse", backend: "iab", webMcpCalls: [
    { kind: "listTools", name: "webmcp_list_tools", sourceHostname: "catalog.example.test", outputJson: JSON.stringify([{ name: "lookup_item" }]) },
    { kind: "invokeTool", name: "lookup_item", title: "Look up an item", description: "Find an item in this website", readOnlyHint: true, sourceHostname: "catalog.example.test",
      inputJson: JSON.stringify({ query: { id: "INPUT_42", region: "上海" }, options: { limit: 40 } }),
      outputJson: JSON.stringify({ items: Array.from({ length: 40 }, (_, id) => ({ id, title: "RESULT_" + id, available: true })), last: "LAST_RESULT" }) },
    { kind: "invokeTool", name: "truncated_query", title: "Partial query", readOnlyHint: false, sourceHostname: "catalog.example.test",
      inputJson: '{"query":"PARTIAL_INPUT', inputTruncated: true, outputJson: '{"result":"PARTIAL_OUTPUT', outputTruncated: true },
    { kind: "invokeTool", name: "plain_response", title: "Plain response", inputJson: "PLAIN_INPUT", outputJson: "PLAIN_OUTPUT" },
    { kind: "invokeTool", name: "empty_response", title: "Empty response", inputJson: "false", outputJson: null },
  ] } } },
} }];
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
  const items: TimelineSourceItem[] = webMcpScenario ? webMcpItems : [
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
createIntlTestRoot(document.getElementById("root")!).render(<Demo />);
