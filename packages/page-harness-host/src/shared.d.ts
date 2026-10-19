export const DEFAULT_PREVIEW_PORT: number;
export const DEV_PORTS: readonly number[];
export const PAGE_HARNESS_SYSTEM_PROMPT: string;
export const PAGE_HARNESS_DYNAMIC_TOOLS: readonly {
  readonly type: "namespace";
  readonly name: string;
  readonly description: string;
  readonly tools: readonly {
    readonly type: "function";
    readonly name: string;
    readonly description: string;
    readonly inputSchema: Readonly<Record<string, unknown>>;
  }[];
}[];
export function renderPreview(status: { needsAgent?: boolean; reason?: string; project?: string; command?: string; url?: string; waitingForPage?: boolean; running?: boolean; error?: string | null; label?: string } | null | undefined): string;
export function renderNotes(result: { project?: string; items?: readonly { n?: number; path?: string; label?: string; selector?: string; note?: string; patch?: unknown; replies?: readonly string[] }[] } | null | undefined): string;
export function normalizeTarget(raw: unknown): string;
export function assertLocalTarget(raw: unknown): string;
export function redactSecrets(value: unknown): string;
export function sameOrigin(headers: { origin?: string; host?: string; "x-forwarded-host"?: string }): boolean;
export function serializeQuote(pick: { outerHTML?: string; text?: string; url?: string; selector?: string; tagName?: string; tag?: string } | null | undefined): string;
export function appendPreviewQuote(controller: { appendQuote?: (text: string) => boolean } | null | undefined, pick: { outerHTML?: string; text?: string; url?: string; selector?: string; tagName?: string }): { ok: boolean; text?: string; message?: string };
export function previewFrame(status: { running?: boolean; page?: string; appUrl?: string; embedToken?: string } | null | undefined, pageProtocol: string): { src: string; mixed: boolean };
export function previewSurface(input: { view?: string; running?: boolean; mixed?: boolean }): "list" | "preview" | "mixed";
export function commandPort(command: string): number;
export function classifyTurn(blocks: readonly unknown[]): null | { mode: "server" | "html" | "script"; html: string[]; scripts: string[]; servers: { command: string; port: number }[]; previewed: boolean };
export function previewCardTitle(status: { needsAgent?: boolean; error?: string | null; running?: boolean }): string;
export const MIXED_CONTENT_MESSAGE: string;
export const QUOTE_BLOCKED_MESSAGE: string;
