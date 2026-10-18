import { serverFetch } from "./server-context";
/** Bounded metadata only. No conversation IDs, params, content or error strings. */
const pending = new Map<string, Record<string, string | number>>();
let sending = false;
let listening = false;
const fields = new Set(["recoveryId", "stage", "elapsedMs", "attempt", "delayMs", "demand", "durationMs", "requests", "responseBytes", "projectionMs", "extraConversations", "nativeReads", "nativeEvents"]);
async function flush() {
  if (sending || typeof fetch !== "function") return;
  sending = true;
  try {
    for (const [id, report] of pending) {
      const response = await serverFetch("/__opencraft_apphost_diagnostic", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "recovery", ...report }), keepalive: true,
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) break;
      if (pending.get(id) === report) pending.delete(id);
    }
  } catch { /* Next lifecycle/report flushes the latest bounded summary. */ }
  finally { sending = false; }
}
export function reportRecoveryEvent(event: Readonly<Record<string, string | number>>) {
  console.info("[appserver-recovery]", event);
  const report = Object.fromEntries(Object.entries(event).filter(([key]) => fields.has(key)));
  if (typeof report.recoveryId !== "string") return;
  pending.set(`${report.recoveryId}:${report.stage}`, report);
  while (pending.size > 32) pending.delete(pending.keys().next().value!);
  if (!listening && typeof window !== "undefined") {
    listening = true; window.addEventListener("online", () => { void flush(); });
  }
  void flush();
}
