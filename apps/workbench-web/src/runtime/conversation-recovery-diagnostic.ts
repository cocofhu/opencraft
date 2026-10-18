import { useMemo } from "react";
import type { TransportStatus } from "@opencraft/appserver-client/transport";

export interface ConversationRecoveryDiagnostic {
  /** Local view fence, excluded from copied details. */
  readonly viewKey?: string;
  readonly stage: "connection" | "activation" | "history";
  readonly code: string;
  readonly occurredAt: string;
  readonly runtime: string;
  readonly transport: string;
  readonly attemptId?: string;
  readonly connectionPhase?: string;
  readonly failure?: string;
  readonly closeCode?: number;
  readonly recovery?: "automatic" | "manual";
}

// Remote errors can contain content; display only bounded machine codes.
function machineCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  if (typeof error.code !== "string" && typeof error.code !== "number") return undefined;
  const code = String(error.code);
  return /^(?:[A-Z][A-Z0-9_]{0,79}|-?\d{1,10})$/.test(code) ? code : undefined;
}

export function createConversationRecoveryDiagnostic(input: {
  readonly stage: ConversationRecoveryDiagnostic["stage"];
  readonly error: unknown;
  readonly runtime: string;
  readonly transport: TransportStatus;
}, now = new Date().toISOString()): ConversationRecoveryDiagnostic {
  const failure = input.stage === "connection" ? input.transport.failure : undefined;
  const diagnostic = failure?.diagnostic;
  return {
    stage: input.stage, code: machineCode(failure) ?? machineCode(input.error) ?? "UNCLASSIFIED",
    occurredAt: diagnostic?.occurredAt ?? now, runtime: input.runtime, transport: input.transport.state,
    ...(failure ? { recovery: failure.recovery } : {}),
    ...(diagnostic ? {
      attemptId: diagnostic.attemptId, connectionPhase: diagnostic.phase, failure: diagnostic.failure,
      ...(diagnostic.closeCode === undefined ? {} : { closeCode: diagnostic.closeCode }),
    } : {}),
  };
}

/** Presentation snapshot only. Scope/error identity fences observation timestamps. */
export function useConversationRecoveryDiagnostic(input: {
  readonly scope: string;
  readonly failed: boolean;
  readonly stage: ConversationRecoveryDiagnostic["stage"];
  readonly error: unknown;
  readonly runtime: string;
  readonly transport: TransportStatus;
}): ConversationRecoveryDiagnostic | undefined {
  const { scope, failed, stage, error, runtime, transport } = input;
  const failure = transport.failure;
  const observedAt = useMemo(() => new Date().toISOString(), [scope, failed, stage, error, failure]);
  return failed ? { ...createConversationRecoveryDiagnostic({ stage, error, runtime, transport }, observedAt), viewKey: scope } : undefined;
}

/** Explicit allowlist; never stringify Error, transport reason or protocol payload. */
export function conversationRecoveryDiagnosticText(diagnostic: ConversationRecoveryDiagnostic): string {
  return [
    ["stage", diagnostic.stage], ["code", diagnostic.code], ["occurredAt", diagnostic.occurredAt],
    ["runtime", diagnostic.runtime], ["transport", diagnostic.transport],
    ["recoveryPolicy", diagnostic.recovery], ["attemptId", diagnostic.attemptId],
    ["connectionPhase", diagnostic.connectionPhase], ["failure", diagnostic.failure], ["closeCode", diagnostic.closeCode],
  ].filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${value}`).join("\n");
}
