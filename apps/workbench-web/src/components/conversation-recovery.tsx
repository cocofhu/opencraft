import React, { useEffect, useState } from "react";
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

function RecoveryTechnicalDetails({ diagnostic, pending = false }: { readonly diagnostic: ConversationRecoveryDiagnostic; readonly pending?: boolean }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const text = conversationRecoveryDiagnosticText(diagnostic);
  return <details className="conversation-recovery-details">
    <summary><FormattedMessage id="chat.recovery.details" defaultMessage="Technical details" /></summary>
    {!pending ? <p><RecoveryFailureStage stage={diagnostic.stage} /></p> : null}
    <pre>{text}</pre>
    <button type="button" onClick={() => {
      void writeTextToClipboard(text).then(() => setCopyState("copied"), () => setCopyState("failed"));
    }}><FormattedMessage id="chat.recovery.copy" defaultMessage="Copy details" /></button>
    <span role="status">{copyState === "copied"
      ? <FormattedMessage id="chat.recovery.copied" defaultMessage="Copied" />
      : copyState === "failed" ? <FormattedMessage id="chat.recovery.copyFailed" defaultMessage="Could not copy. Select the details to copy manually." /> : null}</span>
  </details>;
}

/** The only timer is a visible presentation clock; it never drives retries or RPCs. */
function RecoveryProgressDetails({ diagnostic, failed = false }: { readonly diagnostic: ConversationRecoveryDiagnostic; readonly failed?: boolean }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      if (!document.hidden) { setNow(Date.now()); timer = setInterval(() => setNow(Date.now()), 1_000); }
    };
    sync(); document.addEventListener("visibilitychange", sync);
    return () => { if (timer !== undefined) clearInterval(timer); document.removeEventListener("visibilitychange", sync); };
  }, []);
  const progress = diagnostic.progress;
  const stage = progress?.stage ?? (diagnostic.stage === "connection" ? "connecting" : diagnostic.stage === "activation" ? "queued" : "history");
  const elapsed = Math.max(0, Math.floor((now - (progress?.startedAt ?? Date.parse(diagnostic.occurredAt))) / 1_000));
  const remaining = progress?.retryAt === undefined ? null : Math.max(0, Math.ceil((progress.retryAt - now) / 1_000));
  return <div className="conversation-recovery-progress">
    <span className="conversation-recovery-progress__stage">
      {stage === "connecting" ? <FormattedMessage id="chat.recovery.progress.connecting" defaultMessage="Connecting to server" />
        : stage === "initializing" ? <FormattedMessage id="chat.recovery.progress.initializing" defaultMessage="Initializing connection" />
        : stage === "backoff" ? <FormattedMessage id="chat.recovery.progress.backoff" defaultMessage="Waiting to retry" />
        : stage === "blocked" ? <FormattedMessage id="chat.recovery.progress.blocked" defaultMessage="Automatic retry stopped" />
        : stage === "failed" ? <FormattedMessage id="chat.recovery.progress.failed" defaultMessage="Recovery failed" />
        : stage === "queued" ? <FormattedMessage id="chat.recovery.progress.queued" defaultMessage="Preparing conversation" />
        : <FormattedMessage id="chat.recovery.progress.history" defaultMessage="Restoring conversation history" />}
    </span>
    <span className="conversation-recovery-progress__time" aria-live="off">
      <FormattedMessage id="chat.recovery.progress.elapsed" defaultMessage="{seconds}s elapsed" values={{ seconds: elapsed }} />
      {progress ? <> · <FormattedMessage id="chat.recovery.progress.attempt" defaultMessage="Attempts started: {count}" values={{ count: progress.attempt }} /></> : null}
      {remaining !== null ? <> · <FormattedMessage id="chat.recovery.progress.retry" defaultMessage="Retry in {seconds}s" values={{ seconds: remaining }} /></> : null}
    </span>
    {progress?.lastFailure ? <span className="conversation-recovery-progress__failure"><FormattedMessage id="chat.recovery.progress.lastFailure" defaultMessage="Last failure: {code}" values={{ code: progress.lastFailure.code }} /></span> : null}
    <RecoveryTechnicalDetails diagnostic={diagnostic} pending={!failed} />
  </div>;
}

/** An intermediate failed request can still be waiting for automatic retry. */
function RecoveryFailureDetails({ diagnostic }: { readonly diagnostic: ConversationRecoveryDiagnostic }) {
  if (diagnostic.progress) {
    if (diagnostic.progress.stage !== "failed" && diagnostic.progress.stage !== "blocked") return null;
    return <RecoveryProgressDetails diagnostic={diagnostic} failed />;
  }
  return <RecoveryTechnicalDetails diagnostic={diagnostic} />;
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
      {diagnostic ? <RecoveryFailureDetails key={diagnostic.progress ? diagnostic.viewKey : `${diagnostic.viewKey ?? ""}:${conversationRecoveryDiagnosticText(diagnostic)}`} diagnostic={diagnostic} /> : null}
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
  const syncing = !failed && !reconnecting;
  return (
    <div className={`conversation-recovery-notice${syncing ? " conversation-recovery-notice--syncing" : ""}`} role={failed ? "alert" : "status"}>
      {syncing ? <LoadingSpinner /> : <span className="conversation-recovery-notice__dot" aria-hidden="true" />}
      <span className={syncing ? "conversation-recovery-loading__label" : undefined}>{failed
        ? requiresUpdate ? <ClientUpdateRequired /> : <FormattedMessage id="chat.reconnect.failed" defaultMessage="Could not reconnect" />
        : reconnecting
          ? <FormattedMessage id="chat.reconnect.pending" defaultMessage="Reconnecting…" />
          : <FormattedMessage id="chat.sync.pending" defaultMessage="Syncing…" />}
      </span>
      {failed && !requiresUpdate && onRetry ? <button type="button" onClick={onRetry}><FormattedMessage id="common.retry" defaultMessage="Try again" /></button> : null}
      {failed && diagnostic ? <RecoveryFailureDetails key={diagnostic.progress ? diagnostic.viewKey : `${diagnostic.viewKey ?? ""}:${conversationRecoveryDiagnosticText(diagnostic)}`} diagnostic={diagnostic} /> : null}
    </div>
  );
}
