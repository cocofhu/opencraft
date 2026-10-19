import { appendPreviewQuote, previewFrame } from "@opencraft/page-harness-host/shared";

export interface PageHarnessPick {
  readonly url?: string;
  readonly selector?: string;
  readonly tagName?: string;
  readonly text?: string;
  readonly outerHTML?: string;
  readonly label?: string;
}

export interface PageHarnessStatus {
  readonly running?: boolean;
  readonly starting?: boolean;
  readonly error?: string | null;
  readonly page?: string;
  readonly label?: string;
  readonly rev?: number;
  readonly appUrl?: string;
  readonly target?: string;
  readonly project?: string;
  readonly embedToken?: string;
  readonly waitingForPage?: boolean;
  readonly port?: number;
}

export interface PageHarnessServer {
  readonly port: number;
  readonly url: string;
  readonly title: string;
}

export interface PageHarnessSettings {
  readonly previewPort: number;
  readonly cliPath: string;
}

type Snapshot = {
  readonly status: PageHarnessStatus | null;
  readonly view: "list" | "page";
  readonly notice: string;
  readonly pick: PageHarnessPick | null;
};

let snapshot: Snapshot = { status: null, view: "list", notice: "", pick: null };
const listeners = new Set<() => void>();

function publish(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

export function subscribePageHarness(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPageHarnessSnapshot(): Snapshot {
  return snapshot;
}

export function setPageHarnessStatus(status: PageHarnessStatus | null) {
  publish({ status, notice: "" });
}

export function setPageHarnessView(view: "list" | "page") {
  publish({ view });
}

export function setPageHarnessNotice(notice: string) {
  publish({ notice });
}

export function setPageHarnessPick(pick: PageHarnessPick | null) {
  publish({ pick });
}

interface Session {
  ownerId: string;
  cwd: string;
  threadId: string;
}

let session: Session = { ownerId: "", cwd: "", threadId: "" };
let quote: (text: string) => boolean = () => false;
let insertText: (text: string) => void = () => undefined;
let panels: { open(ownerId: string, kind: string, params: Record<string, never>, options?: { activate?: boolean }): void } | null = null;

export function bindPageHarnessPanels(service: {
  open(ownerId: string, kind: string, params?: object, options?: { activate?: boolean }): unknown;
}) {
  panels = {
    open: (ownerId, kind, params, options) => { service.open(ownerId, kind, params, options); },
  };
}

export function setPageHarnessSession(next: Partial<Session>) {
  session = { ...session, ...next };
}

export function pageHarnessSession() {
  return session;
}

export function setPageHarnessQuote(handler: (text: string) => boolean) {
  quote = handler;
}

export function setPageHarnessInsert(handler: (text: string) => void) {
  insertText = handler;
}

export function askAgentToPreview(names: string) {
  insertText(`用 page_harness_preview 预览刚改的 ${names}。如果它说页面还没起来，只执行它给的那一条命令、在它给的目录里，等端口通了再用同一个地址调用一次。`);
}

export function openPageHarness(view: "list" | "page" = "list") {
  publish({ view });
  if (!session.ownerId || panels === null) return false;
  panels.open(session.ownerId, "page-harness", {}, { activate: true });
  return true;
}

export async function pageHarnessApi<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch("/page-harness", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, cwd: session.cwd, ...payload }),
  });
  const body = await response.json() as T & { ok?: boolean; error?: string };
  if (!response.ok || body.ok === false) throw new Error(body.error || "预览没有打开");
  return body;
}

export function quotePickedElement(pick: PageHarnessPick) {
  const result = appendPreviewQuote({ appendQuote: quote }, pick);
  publish({ notice: result.ok ? "" : result.message });
  return result.ok;
}

export function frameFor(status: PageHarnessStatus | null) {
  return previewFrame(status, typeof location === "undefined" ? "http:" : location.protocol) as { src: string; mixed: boolean };
}
