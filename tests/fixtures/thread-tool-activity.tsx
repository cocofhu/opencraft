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
const imageScenario = new URLSearchParams(location.search).get("scenario") === "images";
function resultImage(width: number, height: number, alt: string) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const paint = canvas.getContext("2d")!;
  for (const [index, color] of ["#194982", "#56a680", "#d1a84c", "#a56070"].entries()) {
    paint.fillStyle = color;
    paint.fillRect(index % 2 * width / 2, Math.floor(index / 2) * height / 2, width / 2, height / 2);
  }
  return { type: "image", mimeType: "image/png", data: canvas.toDataURL("image/png").split(",")[1], alt };
}
const imageItems: TimelineSourceItem[] = imageScenario ? [{
  id: "mcp-images", type: "mcpToolCall", payload: {
    server: "image-probe", tool: "inspect_images", status: "completed", arguments: {},
    result: { content: [
      resultImage(1200, 800, "Landscape result"), { type: "text", text: "After landscape image" },
      resultImage(600, 1400, "Portrait result"), { type: "text", text: "After portrait image" },
      resultImage(96, 64, "Small result"), { type: "text", text: "After small image" },
    ] },
  },
}] : [];
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
  const items: TimelineSourceItem[] = imageScenario ? imageItems : [
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
