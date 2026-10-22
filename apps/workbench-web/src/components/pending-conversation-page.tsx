import { LoadingRingIcon as LoaderCircle } from "@opencraft/design-system-web/action-icons";
import type { SubmitIntent } from "@opencraft/composer-core";
import { submittedMessageDisplay } from "@opencraft/workbench-runtime";
import type { NewThreadDraftSnapshot } from "@opencraft/workbench-runtime";


import { UserMessageBlock } from "./conversation/user-message";
import { ConversationDocumentContext, type ConversationDocumentContextValue } from "./conversation/document-context";

export interface PendingConversationPageProps {
  readonly conversation: NewThreadDraftSnapshot;
  readonly documentContext: ConversationDocumentContextValue;
  readonly onRetry: (intent: SubmitIntent) => void | Promise<void>;
}

/**
 * Conversation-owned presentation used between the local submit commit and
 * the authoritative Thread binding. It deliberately contains no Draft
 * Composer: the immutable first Turn has already crossed that ownership seam.
 */
export function PendingConversationPage({
  conversation,
  documentContext,
  onRetry,
}: PendingConversationPageProps) {
  const submission = conversation.submission;
  if (submission === null) {
    throw new Error(
      `Pending Conversation ${conversation.scopeId} has no immutable first Turn`,
    );
  }
  // Project only the immutable submitted input. The current account is not
  // evidence of this message's author, and rendering must never fetch identity.
  const message = submittedMessageDisplay(submission);

  return (
    <div
      className="pending-conversation-page"
      data-conversation-scope-id={conversation.scopeId}
      data-pending-conversation-phase={conversation.phase}
    >
      <main className="pending-conversation-scroll thread-scroll" aria-label="Conversation">
        <div className="thread-scroll-surface">
          <div className="pending-conversation-content thread-content thread-layout-width">
            <ConversationDocumentContext.Provider value={documentContext}>
              <UserMessageBlock block={message} />
            </ConversationDocumentContext.Provider>
            {conversation.phase === "submit-failed" ? (
              <section className="pending-conversation-error" role="alert">
                <div>
                  <strong>Could not start this task</strong>
                  <p>{conversation.error?.message ?? "The execution host rejected the request."}</p>
                </div>
                <button type="button" onClick={() => void onRetry(submission)}>
                  Try again
                </button>
              </section>
            ) : (
              <div className="pending-conversation-status" role="status">
                <LoaderCircle aria-hidden="true" size={15} />
                <span>Starting task…</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
