import React from "react";
import { ConversationPendingInteractionPanel } from "../../apps/workbench-web/src/components/conversation-renderers/interaction/interaction-renderers";
import { createIntlTestRoot as createRoot } from "./intl-root";
import "../../apps/workbench-web/src/styles/app.scss";
import { initializeAppearanceTheme, setThemePreference } from "../../apps/workbench-web/src/appearance-theme";
initializeAppearanceTheme(); setThemePreference("light");
(window as any).answers = [];
const block: any = { id: "question", type: "question", requestId: "request", method: "item/tool/requestUserInput", state: "pending", questions: [{ id: "q", header: "Plan review", prompt: "Choose steps", multiSelect: true, detail: "# Full fixture plan\n\nVerify the **complete** result before delivery.", intent: { kind: "plan-review", approve: "Verify" }, isOther: true, isSecret: false, options: [{ id: "a", label: "Verify", description: "Check behavior" }, { id: "b", label: "Deliver", description: "Finish delivery" }] }] };
createRoot(document.getElementById("root")!).render(<main style={{ maxWidth: 600, margin: "20px auto" }}><ConversationPendingInteractionPanel block={block} onRespondInteraction={async (_, action) => { (window as any).answers.push(action); }} /></main>);
