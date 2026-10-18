import React, { useState } from "react";
import { Context } from "@deepseek-ai/cordis";
import { createConversationKey, createDefaultTimelineProjectorRegistry, projectTimeline, renderAsyncQuestionReply, type AsyncQuestion } from "@opencraft/chat-core";
import { buildCodexThemeCssProperties } from "@opencraft/design-system/theme-engine";
import { TimelineBlockRendererProvider, TimelineBlockRendererRegistryService } from "@opencraft/timeline-render-react";
import { Conversation } from "../../apps/workbench-web/src/components/conversation";
import { BuiltinTimelineRendererPlugin } from "../../apps/workbench-web/src/components/conversation-renderers/builtin-timeline-renderer-plugin";
import { createIntlTestRoot as createRoot } from "./intl-root";
import "../../apps/workbench-web/src/styles/app.scss";

// Real Conversation owns drafts, pending/error state and the synchronous send
// guard. Only its external answer port is replaced; no real message is sent.
const ctx = new Context();
await ctx.plugin(TimelineBlockRendererRegistryService);
await ctx.plugin(BuiltinTimelineRendererPlugin);
const theme = new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light";
document.documentElement.dataset.theme = theme;
for (const [key, value] of Object.entries(buildCodexThemeCssProperties(theme))) document.documentElement.style.setProperty(key, value);
const registry = createDefaultTimelineProjectorRegistry();
const question: AsyncQuestion = { id: JSON.stringify(["request_user_input_async", "question", 0]), title: "How should we proceed?",
  options: new URLSearchParams(location.search).has("suggested") ? ["Suggested answer"] : [] };
type Mode = "pending" | "queued" | "disconnected" | "answered" | "dismissed";
let settle: ((failed: boolean) => void) | undefined;
const probe = window as typeof window & {
  answers: { id: string; text: string }[];
  setQuestionMode: (mode: Mode) => void;
  settleAnswer: (failed: boolean) => void;
};
probe.answers = [];
probe.settleAnswer = (failed) => settle?.(failed);

function Demo() {
  const [mode, setMode] = useState<Mode>("pending");
  probe.setQuestionMode = setMode;
  const items: { id: string; type: string; payload: Record<string, unknown> }[] = [{ id: "question", type: "agentMessage", payload: { id: "question", type: "agentMessage", phase: "finalAnswer", delivery: "async",
    content: [{ type: "text", text: question.title }], questions: [{ title: question.title, options: question.options }] } }];
  if (mode === "answered" || mode === "dismissed") items.push({ id: "reply", type: "steeringUserMessage", payload: {
    type: "steeringUserMessage", content: [{ type: "text", text: mode === "answered" ? renderAsyncQuestionReply(question, "Already answered") : "A later instruction" }],
  } });
  const timeline = projectTimeline({ key: createConversationKey("fixture", "thread"), revision: 1, authoritative: true, phase: "live",
    turns: [{ id: "turn", status: "streaming", items }] }, registry);
  return <div style={{ width: "100vw", height: "100dvh" }}>
    <TimelineBlockRendererProvider registry={ctx.timelineBlockRenderers}>
      <Conversation scrollPolicy="response-placement" timeline={timeline} queuedAsyncQuestionIds={mode === "queued" ? [question.id] : []}
        onAnswerAsyncQuestion={mode === "disconnected" ? undefined : async (item, text) => {
          probe.answers.push({ id: item.id, text });
          await new Promise<void>((resolve, reject) => { settle = (failed) => { settle = undefined; if (failed) reject(new Error("Please retry")); else resolve(); }; });
        }} />
    </TimelineBlockRendererProvider>
  </div>;
}
createRoot(document.getElementById("root")!).render(<Demo />);
