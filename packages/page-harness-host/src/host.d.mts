import type { IncomingMessage, ServerResponse } from "node:http";

export interface PageHarnessHost {
  handle(request: IncomingMessage, response: ServerResponse): Promise<boolean>;
  dispose(): Promise<void>;
  noteWorkbenchPort(port: number): void;
}

export function createPageHarnessHost(options?: {
  readonly settingsFile?: string;
  readonly detectTimeoutMs?: number;
}): PageHarnessHost;
