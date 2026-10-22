import { CodexCoreSocket } from "./codex-core-socket";
import { CodexCoreControlClient } from "@opencraft/account-pool-host";
import type { DuplexTransport, TransportStatus } from "@opencraft/appserver-client/transport";

/** A raw native connection: Host routing and overlays stay in CodexEngineAdapter.
 * Closing this connection never owns/stops the core or its CLI. No request retry. */
export class CodexNativeCoreTransport implements DuplexTransport {
  readonly control: CodexCoreControlClient;
  private readonly connection: CodexCoreSocket;
  private readonly messages = new Set<(frame: string) => void>();
  private readonly statuses = new Set<(status: TransportStatus) => void>();
  constructor(endpoint: string, token: string) {
    this.control = new CodexCoreControlClient(endpoint, token);
    this.connection = new CodexCoreSocket({
      health: signal => this.control.health(signal),
      message: frame => { for (const listener of this.messages) listener(frame); },
      status: value => { for (const listener of this.statuses) listener(value); },
    });
  }
  get status(): TransportStatus { return this.connection.status; }
  subscribeMessage(listener: (frame: string) => void): () => void { this.messages.add(listener); return () => this.messages.delete(listener); }
  subscribeStatus(listener: (status: TransportStatus) => void): () => void { this.statuses.add(listener); return () => this.statuses.delete(listener); }
  connect(signal?: AbortSignal): Promise<void> { return this.connection.connect(signal); }
  async send(frame: string): Promise<void> { this.connection.send(frame); }
  async close(): Promise<void> { this.connection.close(); }
}
