import type { AddressInfo } from "node:net";

export interface WorkbenchWebServer {
  readonly staticRoot: string;
  readonly appServerTarget: string | null;
  listen(options?: { host?: string; port?: number }): Promise<AddressInfo>;
  close(): Promise<void>;
}

export function createWorkbenchWebServer(options?: {
  root?: string;
  appServerTarget?: string | null;
  resolveAppServerTarget?: () => Promise<string>;
  /** Hub-owned metadata overlay; trusted submission identity comes from server authentication. */
  appServerIdentity?: import("../apps/opencraft-daemon/src/appserver-identity-overlay").AppServerIdentityOverlay | null;
  hyperNodeUser?: string;
  codexServerTarget?: string | null;
}): Promise<WorkbenchWebServer>;
