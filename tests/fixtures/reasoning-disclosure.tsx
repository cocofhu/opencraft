import { FileCode2, MessageSquare, Globe2 } from "lucide-react";
import { ActivitySummaryRow } from "../../apps/workbench-web/src/components/conversation-renderers/activity/activity-summary-row";
import { activityIcon } from "../../apps/workbench-web/src/components/conversation-renderers/activity/activity-icon";
import React, { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Context } from "@deepseek-ai/cordis";
import { createConversationKey, createDefaultTimelineProjectorRegistry, projectTimeline,
  type TimelineSourceItem, type TimelineSourceTurn } from "@opencraft/chat-core";
import { buildOpenCraftThemeCssProperties } from "@opencraft/design-system/theme-engine";
import { TimelineBlockRendererProvider, TimelineBlockRendererRegistryService } from "@opencraft/timeline-render-react";
import { Conversation, type ConversationRestoreSnapshot } from "../../apps/workbench-web/src/components/conversation";
import { BuiltinTimelineRendererPlugin } from "../../apps/workbench-web/src/components/conversation-renderers/builtin-timeline-renderer-plugin";
import { embeddedLocaleCatalogs } from "../../apps/workbench-web/src/i18n/catalogs";
import { createIntlTestRoot } from "./intl-root";
import "../../apps/workbench-web/src/styles/app.scss";

const ctx = new Context();
await ctx.plugin(TimelineBlockRendererRegistryService);
await ctx.plugin(BuiltinTimelineRendererPlugin);
const params = new URLSearchParams(location.search);
const theme = params.get("theme") === "dark" ? "dark" : "light";
document.documentElement.dataset.theme = theme;
for (const [key, value] of Object.entries(buildOpenCraftThemeCssProperties(theme))) document.documentElement.style.setProperty(key, value);
const registry = createDefaultTimelineProjectorRegistry();
const probe = window as any;
let restore: ConversationRestoreSnapshot | null = null;
const text = "First returned line\nCurrent returned line";
const markdown = "# **Checking the result**\n\nRead *carefully* and `a_b`.\n\n- First step\n- Second step\n\n```js\nconst a_b = 42;\n```\n\n[The file](file:///work/a.ts) [Unsafe](javascript:alert(1))\n\n<script>window.__unsafeReasoning = true</script>\n\n**Current check**";
probe.openedReasoningResources = [];

function reasoning(engine: string, content = text, completed = false): TimelineSourceItem {
  return { id: "reason", type: "reasoning", payload: {
    summary: engine === "codex" ? [content] : [], content: !content ? [] : engine === "codex" ? ["Alternate returned detail"] : [content],
    completed, status: completed ? "completed" : "inProgress",
  } };
}

// The reported regression: one response with 60 tools interleaved by thirteen
// protocol reasoning Items that never returned readable text.
const emptyCycleCounts = [8, 6, 4, 4, 5, 5, 1, 5, 4, 4, 2, 5, 7];
function longEmptyResponse(engine: string, withClock: boolean): TimelineSourceTurn {
  const items: TimelineSourceItem[] = emptyCycleCounts.flatMap((count, cycle) => [
    ...Array.from({ length: count }, (_, index): TimelineSourceItem => ({
      id: `long-tool-${cycle}-${index}`, type: "commandExecution", payload: {
        command: `echo cycle-${cycle}-tool-${index}`, status: "completed", exitCode: 0,
      },
    })),
    { ...reasoning(engine, "", true), id: `long-empty-reason-${cycle}` },
  ]);
  items.push({ id: "long-answer", type: "agentMessage", payload: {
    text: "Long response final answer", phase: "final_answer", completed: true,
  } });
  return { id: "turn", status: "complete", items, ...(withClock ? {
    startedAtMs: 1_000, firstTurnWorkItemStartedAtMs: 1_050,
    finalAssistantStartedAtMs: 5_000, completedAtMs: 5_100, durationMs: 4_100,
  } : {}) };
}

function Demo() {
  const [engine, setEngine] = useState("codex");
  const [generation, setGeneration] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [revision, setRevision] = useState(0);
  const [turn, setTurn] = useState<TimelineSourceTurn>({ id: "turn", status: "streaming", items: [reasoning("codex")] });
  probe.update = (action: string, selectedEngine = engine) => {
    setRevision(value => value + 1);
    if (action.startsWith("diff-position-")) {
      if (action === "diff-position-pending-restore") {
        const reader = document.querySelector<HTMLElement>(".thread-unified-diff")!;
        let delivered = 0;
        reader.addEventListener("scroll", () => { delivered += 1; }, { once: true });
        reader.scrollTop = 260; reader.scrollLeft = 140;
        flushSync(() => setMounted(false));
        probe.pendingDiffScrollEvents = delivered;
        return;
      }
      const reset = action === "diff-position-reset";
      if (reset) { restore = null; setGeneration(value => value + 1); }
      const count = reset ? 200 : 220;
      const diff = `@@ -0,0 +1,${count} @@\n` + Array.from({ length: count }, (_, index) =>
        `+${reset ? "original" : "updated"}-position-${index} ${"long diff column ".repeat(12)}`).join("\n") + "\n";
      const item: ThreadItem = { id: "position-patch", type: "fileChange", status: "completed",
        changes: ["a", "b"].map(name => ({ path: `/work/${name}.ts`, kind: { type: "update", move_path: null }, diff })) };
      setTurn({ id: "turn", status: "complete", items: [{ id: item.id, type: item.type, payload: item }] }); return;
    }
    if (action.startsWith("diff-reading-")) {
      const reset = action === "diff-reading-reset";
      if (reset) { restore = null; setGeneration(value => value + 1); }
      const diff = "@@ -1,31 +1,481 @@\n" + Array.from({ length: 30 }, (_, index) => ` context-${index}`).join("\n")
        + "\n-before\n" + Array.from({ length: 451 }, (_, index) => `+${reset ? "original" : "updated"}-after-${index}`).join("\n") + "\n";
      const item: ThreadItem = { id: "reading-patch", type: "fileChange", status: "completed",
        changes: ["a", "b"].map(name => ({ path: `/work/${name}.ts`, kind: { type: "update", move_path: null }, diff })) };
      setTurn({ id: "turn", status: "complete", items: [{ id: item.id, type: item.type, payload: item }] }); return;
    }
    if (action.startsWith("detail-view-")) {
      const [, , kind, mode] = action.split("-");
      const running = mode === "running" || mode === "progress";
      if (mode === "reset" || mode === "running") { restore = null; setGeneration(value => value + 1); }
      const output = mode === "append" ? "Updated detail result" : "Original detail result";
      const item: ThreadItem = kind === "patch" ? {
        id: "view-patch", type: "fileChange", status: running ? "inProgress" : "completed",
        changes: [{ path: "/work/view-example.ts", kind: { type: "update", move_path: null },
          diff: `@@ -1 +1 @@\n-before\n+${output}\n` }],
      } : kind === "mcp" ? {
        id: "view-mcp", type: "mcpToolCall", server: "detail-fixture", tool: "inspect",
        status: running ? "inProgress" : "completed", arguments: {}, appContext: null,
        result: { content: [{ type: "text", text: output }] }, error: null, durationMs: null,
      } : {
        id: "view-dynamic", type: "dynamicToolCall", namespace: "deepseek-harness", tool: "write",
        status: running ? "inProgress" : "completed", arguments: { path: "/work/view-example.ts", content: output },
        contentItems: [{ type: "inputText", text: output }], success: running ? null : true, durationMs: null,
      };
      setTurn({ id: "turn", status: running ? "streaming" : "complete", items: [{ id: item.id, type: item.type, payload: item }] }); return;
    }
    if (action === "restore") { setMounted(false); return; }
    if (action === "reset" || action === "empty" || action === "markdown") {
      restore = null; setEngine(selectedEngine); setGeneration(value => value + 1);
      setTurn({ id: "turn", status: "streaming", items: [reasoning(selectedEngine, action === "empty" ? "" : action === "markdown" ? markdown : text)] }); return;
    }
    if (action === "long-detail") {
      restore = null; setEngine(selectedEngine); setGeneration(value => value + 1);
      setTurn({ id: "turn", status: "streaming", items: [reasoning(selectedEngine,
        "The user asked about a long discussion, so I will inspect the earlier context and compare several sources before answering in detail. ".repeat(3))] }); return;
    }
    if (action === "long-empty" || action === "long-empty-clock") {
      restore = null; setEngine(selectedEngine); setGeneration(value => value + 1);
      setTurn(longEmptyResponse(selectedEngine, action === "long-empty-clock")); return;
    }
    if (action === "activity-metrics") {
      restore = null; setEngine(selectedEngine); setGeneration(value => value + 1);
      setTurn({ id: "turn", status: "streaming", items: [
        { id: "metrics-command", type: "commandExecution", payload: { command: "echo before", status: "completed", exitCode: 0 } },
        { id: "metrics-agent-a", type: "collabAgentToolCall", payload: { tool: "spawnAgent", status: "completed", receiverThreadIds: ["agent-a"], prompt: "Inspect typography", agentsStates: { "agent-a": { status: "completed", displayName: "Typography" } } } },
        { id: "metrics-agent-b", type: "collabAgentToolCall", payload: { tool: "spawnAgent", status: "completed", receiverThreadIds: ["agent-b"], prompt: "Inspect icons", agentsStates: { "agent-b": { status: "completed", displayName: "Icons" } } } },
        { id: "metrics-compaction-complete", type: "contextCompaction", payload: { completed: true } },
        reasoning(selectedEngine, text, true),
        { id: "metrics-read", type: "commandExecution", payload: { command: "cat file.ts", status: "completed", exitCode: 0,
          commandActions: [{ type: "read", name: "file.ts", path: "file.ts" }] } },
        { id: "metrics-image", type: "imageView", payload: { path: "/work/image.png" } },
        { id: "metrics-compaction-active", type: "contextCompaction", payload: { completed: false } },
      ] }); return;
    }
    if (action === "activity-scale") {
      restore = null; setEngine(selectedEngine); setGeneration(value => value + 1);
      setTurn({ id: "turn", status: "streaming", items: [
        reasoning(selectedEngine),
        { id: "scale-command", type: "commandExecution", payload: { command: "echo done", status: "completed", exitCode: 0 } },
        { id: "scale-image", type: "imageView", payload: { path: "/work/image.png" } },
        { id: "scale-read", type: "commandExecution", payload: { command: "cat file.ts", status: "completed", exitCode: 0,
          commandActions: [{ type: "read", name: "file.ts", path: "file.ts" }] } },
      ] }); return;
    }
    if (action === "spacing-contract") {
      restore = null; setEngine(selectedEngine); setGeneration(value => value + 1);
      setTurn({ id: "turn", status: "streaming", items: [
        { id: "spacing-before", type: "commandExecution", payload: { command: "echo before", status: "completed", exitCode: 0, aggregatedOutput: "First command output\nSecond line" } },
        { id: "spacing-before-second", type: "commandExecution", payload: { command: "echo second", status: "completed", exitCode: 0, aggregatedOutput: "Second command output" } },
        { ...reasoning(selectedEngine, "First detail\n\n" + text, true), id: "spacing-first" },
        { id: "spacing-image", type: "imageView", payload: { path: "/work/image.png" } },
        { ...reasoning(selectedEngine, "Middle detail\n\n" + text, true), id: "spacing-middle" },
        { id: "spacing-read", type: "commandExecution", payload: { command: "cat file.ts", status: "completed", exitCode: 0,
          commandActions: [{ type: "read", name: "file.ts", path: "file.ts" }] } },
        { ...reasoning(selectedEngine, "Last detail\n\n" + text, true), id: "spacing-last" },
        { id: "spacing-prose", type: "agentMessage", payload: { text: "Independent prose boundary", phase: "commentary", completed: true } },
      ] }); return;
    }
    if (action === "middle-empty") {
      restore = null; setEngine(selectedEngine); setGeneration(value => value + 1);
      setTurn({ id: "turn", status: "streaming", items: [
        { id: "before-bash", type: "commandExecution", payload: { command: "echo earlier", status: "completed", exitCode: 0 } },
        { id: "before-read", type: "commandExecution", payload: { command: "cat earlier.ts", status: "completed", exitCode: 0 } },
        reasoning(selectedEngine, ""),
        { id: "after-bash", type: "commandExecution", payload: { command: "echo later", status: "completed", exitCode: 0 } },
        { id: "after-read", type: "commandExecution", payload: { command: "cat later.ts", status: "completed", exitCode: 0 } },
      ] }); return;
    }
    if (action === "reasoning-only-complete") {
      restore = null; setEngine(selectedEngine); setGeneration(value => value + 1);
      setTurn({ id: "turn", status: "complete", startedAtMs: 1_000,
        firstTurnWorkItemStartedAtMs: 1_050, finalAssistantStartedAtMs: 10_000,
        completedAtMs: 10_050, durationMs: 9_000, items: [
          reasoning(selectedEngine, text, true),
          { id: "answer", type: "agentMessage", payload: { text: "Final answer", phase: "final_answer", completed: true } },
        ] }); return;
    }
    setTurn(current => {
      if (action === "spacing-grow") return { ...current, items: current.items.map(item => item.id === "spacing-middle"
        ? { ...reasoning(engine, "Middle detail\n\n" + text + "\n\n" + "Additional returned content. ".repeat(30), true), id: item.id }
        : item) };
      if (action === "markdown-grow") return { ...current, items: [reasoning(engine, markdown + "\n\nNew **returned** line")] };
      if (action === "middle-fill") return { ...current, items: current.items.map(item => item.type === "reasoning" ? reasoning(engine) : item) };
      if (action === "grow") return { ...current, items: [reasoning(engine, text + "\nNew returned line")] };
      if (action === "tools") return { ...current, items: [...current.items,
        { id: "bash", type: "commandExecution", payload: { command: "echo tool", status: "completed", exitCode: 0 } },
        { id: "read", type: "commandExecution", payload: { command: "cat file.ts", status: "completed", exitCode: 0,
          commandActions: [{ type: "read", name: "file.ts", path: "file.ts" }] } }] };
      if (action === "complete") return { ...current, status: "complete", items: [...current.items.map(item => item.type === "reasoning"
        ? { ...item, payload: { ...(item.payload as object), completed: true, status: "completed" } } : item),
        { id: "answer", type: "agentMessage", payload: { text: "Final answer", phase: "final_answer", completed: true } }] };
      if (action === "prepend") return { ...current, items: [
        { id: "history", type: "agentMessage", payload: { text: "Earlier commentary", phase: "commentary", completed: true } }, ...current.items] };
      return current;
    });
  };
  // Let the real View emit its cleanup receipt before recreating it, as a
  // route return does. This is not a timer or a separate preference store.
  useEffect(() => { if (!mounted) { setGeneration(value => value + 1); setMounted(true); } }, [mounted]);
  const timeline = projectTimeline({ key: createConversationKey(engine, "thread"), revision, authoritative: true,
    phase: "live", turns: [turn] }, registry);
  return <div data-revision={revision} style={{ width: "100vw", height: "100dvh" }}>
    <TimelineBlockRendererProvider registry={ctx.timelineBlockRenderers}>
      {mounted ? <Conversation key={generation} timeline={timeline} scrollPolicy="natural" initialRestoreSnapshot={restore}
        documentContext={{ theme, conversationId: "thread", hostId: engine, cwd: "/work",
          onOpenResource: (target, decision) => probe.openedReasoningResources.push({ target, kind: decision.kind }) }}
        onRestoreSnapshotChange={value => { restore = value; }}
        footer={<div style={{ height: 48 }}>Composer fixture</div>} /> : null}
    </TimelineBlockRendererProvider>
    {turn.items[0]?.id === "metrics-command" ? <div data-activity-metrics-gallery>
      {(["terminal", "patch", "wrench", "search", "read", "files", "stop", "agent", "image", "browser", "computer"] as const).map(kind =>
        <ActivitySummaryRow key={kind} icon={activityIcon(kind)} summary={kind} />)}
      <ActivitySummaryRow icon={<FileCode2 />} summary="File change" />
      <ActivitySummaryRow icon={<MessageSquare />} summary="Interaction" />
      <ActivitySummaryRow icon={<Globe2 />} summary="Web tool" />
    </div> : null}
  </div>;
}
createIntlTestRoot(document.getElementById("root")!, undefined, params.get("locale") ?? "en-US", embeddedLocaleCatalogs).render(<Demo />);
