import { open, realpath } from "node:fs/promises";
import { relative, isAbsolute } from "node:path";
import { nativeUsageFact, nativeAcceptedInputFact, type NativeAcceptedInputFact } from "./token-usage-native-facts.js";
import type { CodexTokenUsageLedger } from "./token-usage-ledger.js";

export interface RolloutUsageResult {
  readonly cursor: number;
  readonly observed: number;
  readonly changed: number;
  readonly missing: number;
  readonly more: boolean;
  readonly blockedTurnId?: string;
}

/** Bounded replay of native count facts. Neither prompt lines nor full rollout
 * JSON escape this boundary. Paths must come from native thread/read and still
 * resolve inside the Host's native storage. Each source and cursor commit in
 * the ledger's existing transaction; a crash can replay but cannot skip a fact.
 */
export async function replayRolloutUsage(options: {
  readonly path: string;
  readonly nativeHome: string;
  readonly threadId: string;
  readonly ledger: CodexTokenUsageLedger;
  readonly cursor?: number;
  readonly maxBytes?: number;
  /** Exclusions verified from native turn start/coverage, never request input. */
  readonly excludedTurnIds?: ReadonlySet<string>;
  readonly onAdmission?: (fact: NativeAcceptedInputFact) => void;
  readonly onTerminal?: (turnId: string) => void;
  readonly maxFacts?: number;
  readonly onCommitCursor?: (cursor: number) => void;
  readonly signal?: AbortSignal;
  readonly onSourceTurn?: (key: {threadId:string;turnId:string}) => boolean;
}): Promise<RolloutUsageResult> {
  options.signal?.throwIfAborted();
  const root = await realpath(options.nativeHome);
  const path = await realpath(options.path);
  const child = relative(root, path);
  if (!child || child === ".." || child.startsWith("../") || isAbsolute(child)) throw new Error("Usage rollout is outside native storage");
  const file = await open(path, "r");
  try {
    const stat = await file.stat();
    const cursor = options.cursor ?? 0;
    const maxBytes = options.maxBytes ?? 1024 * 1024;
    const maxFacts = options.maxFacts ?? 32;
    if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > stat.size) throw new Error("Usage rollout cursor requires reconciliation");
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 8 * 1024 * 1024) throw new Error("Invalid usage replay batch");
    if (!Number.isSafeInteger(maxFacts) || maxFacts < 1 || maxFacts > 1000) throw new Error("Invalid usage fact batch");
    const buffer = Buffer.alloc(Math.min(maxBytes, stat.size - cursor));
    const { bytesRead } = await file.read(buffer, 0, buffer.length, cursor);
    options.signal?.throwIfAborted();
    return options.ledger.commitReplayBatch(() => {
      const finish = (result: RolloutUsageResult): RolloutUsageResult => { options.onCommitCursor?.(result.cursor); return result; };
      let committed = cursor, observed = 0, changed = 0, missing = 0, handled = 0;
      let start = 0;
      const started=performance.now();
      for (let index = 0; index < bytesRead; index++) {
        if (buffer[index] !== 10) continue;
        const end = cursor + index + 1;
        const line = buffer.subarray(start, index).toString("utf8");
        start = index + 1;
        // The stable native record tag precedes its payload. Skip unrelated
        // potentially sensitive history without parsing or returning its body.
        if (/^\s*\{[^\n]*?"type"\s*:\s*"(?:token_usage_record|event_msg)"/.test(line)) {
          let value: unknown;
          try { value = JSON.parse(line); } catch { missing++; committed = end; continue; }
          const admission = nativeAcceptedInputFact(value, options.threadId);
          if (admission && !options.excludedTurnIds?.has(admission.turnId) && options.onAdmission) { options.onAdmission(admission); handled++; }
          const row = value as { type?: unknown; payload?: {type?: unknown; turn_id?: unknown} };
          if (row.type === "event_msg" && row.payload?.type === "task_complete" && typeof row.payload.turn_id === "string" && !options.excludedTurnIds?.has(row.payload.turn_id)) {
            if (options.onTerminal) { options.onTerminal(row.payload.turn_id); handled++; }
          }
          const fact = nativeUsageFact(value, options.threadId);
          if (fact?.kind === "missing") { missing++; handled++; }
          if (fact?.kind === "source") {
            if (options.excludedTurnIds?.has(fact.source.turnId)) { committed = end; continue; }
            if (options.onSourceTurn && !options.onSourceTurn(fact.source)) { committed = end; continue; }
            observed++;
            handled++;
            // Do not advance across an unregistered turn: its trusted native
            // start/receipt must be recovered before importing its responses.
            if (!options.ledger.readTurn(fact.source)) return finish({ cursor: committed, observed, changed, missing, more: true, blockedTurnId: fact.source.turnId });
            // The report is a verified per-turn total from the same native
            // record, never thread_token_usage. Commit alternatives and cursor
            // atomically so a crash cannot skip a required fallback snapshot.
            if (fact.turnCounts) {
              const before = options.ledger.readTurn(fact.source)?.revision;
              options.ledger.recordSourceBatch([fact.source, { ...fact.source, kind: "turn-snapshot", sourceId: "native-turn",
                version: end, provider: null, model: null, counts: {...fact.turnCounts,totalTokens:fact.turnCounts.totalTokens!}, cursor: String(end) }]);
              if (options.ledger.readTurn(fact.source)?.revision !== before) changed++;
            } else {
              const result = options.ledger.recordSource({ ...fact.source, cursor: String(end) });
              if (result === "inserted" || result === "corrected") changed++;
            }
          }
        }
        committed = end;
        if (handled >= maxFacts || performance.now()-started>=8) return finish({ cursor: end, observed, changed, missing, more: end < stat.size });
      }
      // An incomplete tail remains unread until the native writer completes it.
      // A single oversized history line requires explicit reconciliation rather
      // than an unbounded buffer or silently skipping possible count evidence.
      if (start === 0 && bytesRead === maxBytes) throw new Error("Usage rollout line exceeds replay batch");
      return finish({ cursor: committed, observed, changed, missing, more: committed < stat.size });
    });
  } finally { await file.close(); }
}
