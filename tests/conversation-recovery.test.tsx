import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleRuntime } from "@opencraft/i18n";
import { IntlRuntimeProvider } from "@opencraft/i18n/react";
import {
  ConversationRecoveryNotice,
  ConversationRecoveryEmptyState,
  conversationRecoveryPresentation,
} from "../apps/workbench-web/src/components/conversation-recovery";

test("recovery presentation retains painted history across syncing and failure", () => {
  assert.equal(conversationRecoveryPresentation({ authoritative: false, hasVisibleHistory: true, failed: false }), "warm-loading");
  assert.equal(conversationRecoveryPresentation({ authoritative: false, hasVisibleHistory: true, failed: true }), "warm-error");
  assert.equal(conversationRecoveryPresentation({ authoritative: false, hasVisibleHistory: false, failed: false }), "cold-loading");
  assert.equal(conversationRecoveryPresentation({ authoritative: false, hasVisibleHistory: false, failed: true }), "cold-error");
  assert.equal(conversationRecoveryPresentation({ authoritative: true, hasVisibleHistory: true, failed: false }), "none");
});

test("only cold loading gets a passive ring; failures keep an actionable retry", () => {
  const runtime = new LocaleRuntime([]);
  const render = (child: ReactElement) => renderToStaticMarkup(createElement(IntlRuntimeProvider, { runtime, children: child }));
  const notice = render(createElement(ConversationRecoveryNotice, { failed: false, reconnecting: true }));
  const syncing = render(createElement(ConversationRecoveryNotice, { failed: false, reconnecting: false }));
  const error = render(createElement(ConversationRecoveryNotice, { failed: true, reconnecting: true, onRetry() {} }));
  const loading = render(createElement(ConversationRecoveryEmptyState, { failed: false }));
  const coldError = render(createElement(ConversationRecoveryEmptyState, { failed: true, onRetry() {} }));
  assert.match(notice, /conversation-recovery-notice/);
  assert.doesNotMatch(notice, /workbench-loading-spinner|conversation-hydration-stage/);
  assert.match(syncing, /Syncing/);
  assert.match(error, /role="alert"/);
  assert.match(error, /<button/);
  assert.match(loading, /role="status"/);
  assert.match(loading, /conversation-recovery-loading__label/);
  assert.match(loading, /<svg[^>]*aria-hidden="true"[^>]*focusable="false"/);
  assert.match(loading, /<circle[^>]*opacity="0.3"/);
  assert.doesNotMatch(loading, /<button|tabindex|skeleton__line/);
  assert.match(coldError, /role="alert"/);
  assert.match(coldError, /<button/);
  assert.doesNotMatch(coldError, /workbench-loading-spinner/);
  runtime.dispose();
});

test("incompatible clients get an update instruction in both cold and retained-history recovery", () => {
  const runtime = new LocaleRuntime([]);
  const render = (child: ReactElement) => renderToStaticMarkup(createElement(IntlRuntimeProvider, { runtime, children: child }));
  try {
    for (const child of [
      createElement(ConversationRecoveryEmptyState, { failed: true, requiresUpdate: true, onRetry() {} }),
      createElement(ConversationRecoveryNotice, { failed: true, reconnecting: true, requiresUpdate: true, onRetry() {} }),
    ]) {
      const markup = render(child);
      assert.match(markup, /role="alert"/);
      assert.match(markup, /Update or reload to reconnect/);
      assert.doesNotMatch(markup, /Reconnecting|Try again|<button|workbench-loading-spinner/);
    }
  } finally { runtime.dispose(); }
});

test("technical details distinguish history errors and never copy remote text or payloads", async () => {
  const { createConversationRecoveryDiagnostic, conversationRecoveryDiagnosticText } = await import("../apps/workbench-web/src/runtime/conversation-recovery-diagnostic");
  const diagnostic = createConversationRecoveryDiagnostic({
    stage: "history", error: { code: -32001, message: "secret body", data: { token: "secret-token" } },
    runtime: "ready", transport: { state: "open", reason: "secret-url", failure: {
      code: "APP_HOST_DISCONNECTED", recovery: "automatic", diagnostic: {
        attemptId: "stale-other-connection", occurredAt: "2026-10-17T14:00:00.000Z", phase: "connecting", failure: "socket-error",
      },
    } },
  }, "2026-10-17T14:01:00.000Z");
  const text = conversationRecoveryDiagnosticText(diagnostic);
  assert.match(text, /stage: history\ncode: -32001\noccurredAt: 2026-10-17T14:01:00.000Z/);
  assert.doesNotMatch(text, /secret|stale|APP_HOST|recoveryPolicy|attemptId/);
  assert.equal(createConversationRecoveryDiagnostic({ stage: "activation", error: { code: "private content" }, runtime: "ready", transport: { state: "open" } }).code, "UNCLASSIFIED");
  const runtime = new LocaleRuntime([]);
  try {
    for (const component of [
      createElement(ConversationRecoveryEmptyState, { failed: true, diagnostic }),
      createElement(ConversationRecoveryNotice, { failed: true, reconnecting: false, diagnostic }),
    ]) {
      const markup = renderToStaticMarkup(createElement(IntlRuntimeProvider, { runtime, children: component }));
      assert.match(markup, /<details[^>]*><summary>Technical details/);
      assert.match(markup, /History restore failed/);
      assert.match(markup, /Copy details/);
      assert.doesNotMatch(markup, /<details[^>]*open|secret|stale/);
    }
  } finally { runtime.dispose(); }
});
