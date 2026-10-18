import React, { useState } from "react";
import { writeTextToClipboard } from "@opencraft/chat-render-web/clipboard";
import { conversationRecoveryDiagnosticText, type ConversationRecoveryDiagnostic } from "../runtime/conversation-recovery-diagnostic";
import { FormattedMessage } from "@opencraft/i18n/react";

import { LoadingSpinner } from "./ui/loading-spinner";

export type ConversationRecoveryPresentation = "none" | "cold-loading" | "cold-error" | "warm-loading" | "warm-error";

/** Presentation only: a retained timeline is useful even before it is authoritative. */
export function conversationRecoveryPresentation(input: {
  readonly authoritative: boolean;
  readonly hasVisibleHistory: boolean;
  readonly failed: boolean;
}): ConversationRecoveryPresentation {
  if (input.authoritative) return "none";
  return `${input.hasVisibleHistory ? "warm" : "cold"}-${input.failed ? "error" : "loading"}`;
}

function ClientUpdateRequired() {
  return <FormattedMessage id="chat.reconnect.updateRequired" defaultMessage="Update or reload to reconnect" />;
}

function RecoveryFailureStage({ stage }: { readonly stage: ConversationRecoveryDiagnostic["stage"] }) {
  if (stage === "connection") return <FormattedMessage id="chat.recovery.stage.connection" defaultMessage="Connection failed" />;
  if (stage === "activation") return <FormattedMessage id="chat.recovery.stage.activation" defaultMessage="Conversation activation failed" />;
  return <FormattedMessage id="chat.recovery.stage.history" defaultMessage="History restore failed" />;
}

function RecoveryTechnicalDetails({ diagnostic }: { readonly diagnostic: ConversationRecoveryDiagnostic }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const text = conversationRecoveryDiagnosticText(diagnostic);
  return <details className="conversation-recovery-details">
    <summary><FormattedMessage id="chat.recovery.details" defaultMessage="Technical details" /></summary>
    <p><RecoveryFailureStage stage={diagnostic.stage} /></p>
    <pre>{text}</pre>
    <button type="button" onClick={() => {
      void writeTextToClipboard(text).then(() => setCopyState("copied"), () => setCopyState("failed"));
    }}><FormattedMessage id="chat.recovery.copy" defaultMessage="Copy details" /></button>
    <span role="status">{copyState === "copied"
      ? <FormattedMessage id="chat.recovery.copied" defaultMessage="Copied" />
      : copyState === "failed" ? <FormattedMessage id="chat.recovery.copyFailed" defaultMessage="Could not copy. Select the details to copy manually." /> : null}</span>
  </details>;
}

export function ConversationRecoveryEmptyState({ failed, requiresUpdate = false, onRetry, diagnostic }: {
  readonly diagnostic?: ConversationRecoveryDiagnostic;
  readonly failed: boolean;
  readonly requiresUpdate?: boolean;
  readonly onRetry?: () => void;
}) {
  if (failed) return (
    <div className="conversation-recovery-empty-error thread-layout-width" role="alert">
      <p>{requiresUpdate ? <ClientUpdateRequired /> : <FormattedMessage id="chat.restore.failed" defaultMessage="Could not load this conversation" />}</p>
      {!requiresUpdate && onRetry ? <button type="button" onClick={onRetry}><FormattedMessage id="common.retry" defaultMessage="Try again" /></button> : null}
      {diagnostic ? <RecoveryTechnicalDetails key={`${diagnostic.viewKey ?? ""}:${conversationRecoveryDiagnosticText(diagnostic)}`} diagnostic={diagnostic} /> : null}
    </div>
  );
  return (
    <div className="conversation-recovery-loading" role="status">
      <span className="conversation-recovery-loading__label"><FormattedMessage id="chat.restore.loading" defaultMessage="Loading conversation history…" /></span>
      <LoadingSpinner />
    </div>
  );
}

export function ConversationRecoveryNotice({ failed, reconnecting, requiresUpdate = false, onRetry, diagnostic }: {
  readonly failed: boolean;
  readonly reconnecting: boolean;
  readonly diagnostic?: ConversationRecoveryDiagnostic;
  readonly requiresUpdate?: boolean;
  readonly onRetry?: () => void;
}) {
  return (
    <div className="conversation-recovery-notice" role={failed ? "alert" : "status"}>
      <span className="conversation-recovery-notice__dot" aria-hidden="true" />
      <span>{failed
        ? requiresUpdate ? <ClientUpdateRequired /> : <FormattedMessage id="chat.reconnect.failed" defaultMessage="Could not reconnect" />
        : reconnecting
          ? <FormattedMessage id="chat.reconnect.pending" defaultMessage="Reconnecting…" />
          : <FormattedMessage id="chat.sync.pending" defaultMessage="Syncing…" />}
      </span>
      {failed && !requiresUpdate && onRetry ? <button type="button" onClick={onRetry}><FormattedMessage id="common.retry" defaultMessage="Try again" /></button> : null}
      {failed && diagnostic ? <RecoveryTechnicalDetails key={`${diagnostic.viewKey ?? ""}:${conversationRecoveryDiagnosticText(diagnostic)}`} diagnostic={diagnostic} /> : null}
    </div>
  );
}
