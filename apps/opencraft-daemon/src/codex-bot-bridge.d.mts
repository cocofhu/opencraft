import type { TransportSubmissionContext } from "@opencraft/appserver-client/transport";
import type { DatabaseSync } from "node:sqlite";
import type { AppServerBotConversationEvent, BotConversationsCapability } from "@opencraft/appserver-protocol";
export interface CodexBotPort {
  request(owner: string, method: string, params: Record<string, unknown>, context?: TransportSubmissionContext): Promise<unknown>;
  hasNativeSubscription(threadId: string): boolean;
  attach(owner: string, threadId: string): void;
  reply(owner: string, id: string | number, result: unknown): Promise<void>;
  activeTurn(threadId: string): string | null;
  emit(event: AppServerBotConversationEvent, owner: string): void;
}
export const CODEX_BOT_CAPABILITY: BotConversationsCapability;
export class CodexBotError extends Error { readonly domainCode: string; }
export class CodexBotBridge {
  constructor(database: DatabaseSync, port: CodexBotPort);
  request(owner: string, method: string, raw: unknown, context?: TransportSubmissionContext): Promise<unknown>;
  observe(frame: Record<string, unknown>): void;
  observeInteraction(owner: string, frame: Record<string, unknown>): void;
  disconnect(owner: string): void;
  dispose(): void;
}
