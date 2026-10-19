import { composerDocumentToPlainText, type ComposerController, type ComposerDocument, type SubmitIntent } from "@opencraft/composer-core";

function documentFromText(text: string): ComposerDocument {
  return {
    version: 1,
    blocks: text.replace(/\r\n/g, "\n").split("\n").map((line) => ({
      type: "paragraph",
      children: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

/** Puts the instruction into the current draft and submits it. A false result leaves the draft unsent. */
export function submitPageHarnessText(
  controller: ComposerController,
  send: (intent: SubmitIntent, followUp: "steer" | null) => boolean | Promise<boolean>,
  activeTurn: boolean,
  text: string,
): boolean {
  const draft = controller.getSnapshot().draft;
  if (draft.lifecycle.phase === "submitting" || draft.lifecycle.phase === "processing-assets") return false;
  if (draft.attachments.some((attachment) => attachment.lifecycle !== "ready" || attachment.uri === null)) return false;
  const previous = composerDocumentToPlainText(draft.document).trimEnd();
  const combined = previous ? `${previous}\n${text}` : text;
  const previousDocument = draft.document;
  controller.dispatch({ type: "set-document", document: documentFromText(combined) });
  let intent: SubmitIntent;
  try { intent = controller.createSubmitIntent(); }
  catch {
    controller.dispatch({ type: "set-document", document: previousDocument });
    return false;
  }
  const followUp = activeTurn ? "steer" as const : null;
  const draftId = controller.getSnapshot().draft.id;
  controller.dispatch({ type: "set-lifecycle", phase: "submitting" });
  let accepted: boolean | Promise<boolean>;
  try { accepted = send(intent, followUp); }
  catch (error) {
    controller.dispatch({
      type: "set-lifecycle",
      phase: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
  const finish = (ok: boolean) => {
    if (controller.getSnapshot().draft.id !== draftId) return;
    controller.dispatch(ok
      ? { type: "clear" }
      : { type: "set-lifecycle", phase: "editing" });
  };
  if (accepted === false) {
    finish(false);
    return false;
  }
  if (typeof accepted === "object" && accepted !== null) {
    void accepted.then((ok) => finish(ok !== false)).catch(() => finish(false));
    return true;
  }
  finish(true);
  return true;
}
