import React, { useState } from "react";
import { ConversationPendingInteractionPanel } from "../../apps/workbench-web/src/components/conversation-renderers/interaction/interaction-renderers";
import { createIntlTestRoot as createRoot } from "./intl-root";
import "../../apps/workbench-web/src/styles/app.scss";
import { initializeAppearanceTheme, setThemePreference } from "../../apps/workbench-web/src/appearance-theme";
initializeAppearanceTheme(); setThemePreference("light");
(window as any).answers = [];
const block: any = { id: "question", type: "question", requestId: "request", method: "item/tool/requestUserInput", state: "pending", questions: [{ id: "q", header: "Plan review", prompt: "Choose steps", multiSelect: true, detail: "# Full fixture plan\n\nVerify the **complete** result before delivery.", intent: { kind: "plan-review", approve: "Verify" }, isOther: true, isSecret: false, options: [{ id: "a", label: "Verify", description: "Check behavior" }, { id: "b", label: "Deliver", description: "Finish delivery" }] }] };
function Demo() {
  const [current, setCurrent] = useState(block);
  (window as any).questionFixture = {
    refresh: () => setCurrent((value: any) => structuredClone(value)),
    replaceRequest: () => setCurrent((value: any) => ({ ...value, requestId: "replacement-request" })),
    changeQuestion: () => setCurrent((value: any) => ({ ...value, questions: value.questions.map((question: any) => ({ ...question, prompt: "Choose updated steps" })) })),
    showTwoQuestions: () => setCurrent({ ...block, requestId: "two-question-request", questions: [block.questions[0], { ...block.questions[0], id: "second", header: "Second question", prompt: "Describe second step", multiSelect: false, options: [] }] }),
  };
  return <main style={{ maxWidth: 600, margin: "20px auto" }}><ConversationPendingInteractionPanel block={current} onRespondInteraction={async (_, action) => { (window as any).answers.push(action); }} /></main>;
}
createRoot(document.getElementById("root")!).render(<Demo />);
