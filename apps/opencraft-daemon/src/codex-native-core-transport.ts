import WebSocket from "ws";
import { CodexCoreControlClient } from "@opencraft/account-pool-host";
import type { DuplexTransport, TransportStatus } from "@opencraft/appserver-client/transport";

/** A raw native connection: Host routing and overlays stay in CodexEngineAdapter.
 * Closing this connection never owns/stops the core or its CLI. No request retry. */
export class CodexNativeCoreTransport implements DuplexTransport {
  readonly control: CodexCoreControlClient;
  private socket: WebSocket | null = null;
  private value: TransportStatus = { state: "idle" };
  private readonly messages = new Set<(frame: string) => void>();
  private readonly statuses = new Set<(status: TransportStatus) => void>();
  constructor(endpoint: string, token: string) { this.control = new CodexCoreControlClient(endpoint, token); }
  get status(): TransportStatus { return this.value; }
  subscribeMessage(listener: (frame: string) => void): () => void { this.messages.add(listener); return () => this.messages.delete(listener); }
  subscribeStatus(listener: (status: TransportStatus) => void): () => void { this.statuses.add(listener); return () => this.statuses.delete(listener); }
  private publish(value: TransportStatus): void { this.value = value; for (const listener of this.statuses) listener(value); }
  async connect(signal?: AbortSignal): Promise<void> {
    if (this.value.state === "open") return;
    signal?.throwIfAborted(); this.publish({ state: "connecting" });
    try {
      const health = await this.control.health(signal);
      const socket = new WebSocket(`ws+unix://${health.nativeSocket}:/`, { handshakeTimeout: 5000 });
      this.socket = socket;
      socket.on("message", data => { for (const listener of this.messages) listener(String(data)); });
      const failed = () => {
        if (this.value.state !== "open") return;
        this.publish({ state: "failed", reason: "Codex core connection closed", failure: { code: "codex-core-connection-failed", recovery: "automatic" } });
      };
      socket.on("error", failed); socket.on("close", failed);
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => { socket.off("open", opened); socket.off("error", error); socket.off("close", closed); signal?.removeEventListener("abort", aborted); };
        const opened = () => { cleanup(); resolve(); };
        const error = () => { cleanup(); reject(new Error("Codex core native connection failed")); };
        const closed = () => { cleanup(); reject(new Error("Codex core closed during connection")); };
        const aborted = () => { cleanup(); socket.terminate(); reject(signal?.reason); };
        socket.once("open", opened); socket.once("error", error); socket.once("close", closed);
        signal?.addEventListener("abort", aborted, { once: true }); if (signal?.aborted) aborted();
      });
      this.publish({ state: "open" });
    } catch (error) {
      this.socket?.terminate(); this.socket = null;
      this.publish({ state: "failed", reason: "Codex core is unavailable", failure: { code: "codex-core-connection-failed", recovery: "automatic" } });
      throw error;
    }
  }
  async send(frame: string): Promise<void> {
    if (this.value.state !== "open" || this.socket?.readyState !== WebSocket.OPEN) throw new Error("Codex core native connection is closed");
    this.socket.send(frame);
  }
  async close(): Promise<void> {
    this.publish({ state: "closing" }); const socket = this.socket; this.socket = null;
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => { socket.terminate(); resolve(); }, 2000); timer.unref();
        socket.once("close", () => { clearTimeout(timer); resolve(); }); socket.close();
      });
    }
    this.publish({ state: "closed" });
  }
}
