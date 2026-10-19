/** Browser-safe preview contract. The Node host and the workbench renderer both import this module. */

export const DEFAULT_PREVIEW_PORT = 17994;

export const DEV_PORTS = [3000, 3001, 3002, 4000, 4173, 4200, 4321, 5000, 5173, 5174, 5175, 5500, 6006, 8000, 8008, 8080, 8081, 8888, 9000];

/** Shown to the agent as the tool namespace description. Share tools are intentionally absent. */
export const PAGE_HARNESS_SYSTEM_PROMPT = [
  "After you write or change a web page (HTML file or a dev server), call page_harness_preview with its path or URL: it shows the page in the preview pane on the right of this chat. Call it again after later edits to reload the pane.",
  "page_harness_preview checks that the URL responds before it starts, and serves a static site itself. If the result says the page is not up, run only the command it gives, in the directory it gives. When that port answers, call page_harness_preview again with the same URL. Do not pick another directory or port, and do not run page-harness yourself. Prefer an explicit port when you start a server.",
  "A <page-element url selector tag text>…</page-element> block in a user message is an element the user picked in the preview, with its outerHTML inside; the request around it is about that element. Edit the source file that produces it, and refer to it by what it is (the \"提交\" button), not by the raw block.",
  "When the user asks to apply their notes on the page (按意见改, 处理批注), call page_harness_notes and apply each open note.",
  "Never run page-harness or npx page-harness through bash: the host process manages it.",
].join(" ");

export const PAGE_HARNESS_PREVIEW_TOOL = Object.freeze({
  type: "function",
  name: "page_harness_preview",
  description: "Show a web page in the preview pane on the right of the chat, with page-harness tools on it (pick elements, quote them into this chat, leave notes). Call it after you write or change an HTML page, passing the file path (relative to the workspace), and after you start a web or dev server, passing its URL. Calling it again reloads the pane. Do not open the page through bash, and do not start page-harness yourself.",
  inputSchema: Object.freeze({
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string", description: "HTML file or directory to show, relative to the workspace, e.g. index.html. Default index.html." },
      url: { type: "string", description: "Dev server URL or port instead of a file, e.g. 5173." },
    },
  }),
});

export const PAGE_HARNESS_NOTES_TOOL = Object.freeze({
  type: "function",
  name: "page_harness_notes",
  description: "Read the open notes the user left on the preview pane (element, comment, suggested text or style change). Call it when the user asks you to apply their notes or comments on the page. Do not start page-harness yourself.",
  inputSchema: Object.freeze({
    type: "object",
    additionalProperties: false,
    properties: {},
  }),
});

export const PAGE_HARNESS_DYNAMIC_TOOLS = Object.freeze([
  Object.freeze({
    type: "namespace",
    name: "page_harness",
    description: PAGE_HARNESS_SYSTEM_PROMPT,
    tools: Object.freeze([PAGE_HARNESS_PREVIEW_TOOL, PAGE_HARNESS_NOTES_TOOL]),
  }),
]);

export function renderPreview(status) {
  if (status?.needsAgent) {
    return [
      `页面还没有起来，预览没有启动。${status.reason || ""}`.trim(),
      `在这个目录执行（不要换目录）：${status.project}`,
      status.command,
      `等它监听后，用同一个地址再调用 page_harness_preview：${status.url}`,
      "不要自己运行 page-harness，也不要换端口。",
    ].join("\n");
  }
  if (status?.waitingForPage) return "预览已准备好，用户打开工作台页面后会显示在右侧。对用户只说一句即可。";
  if (!status?.running) return `预览没有打开${status?.error ? `：${status.error}` : "。"}`;
  return [
    `已在右侧预览：${status.label}`,
    "用户可以在预览里取点并引用到对话，或留意见；需要按意见修改时调用 page_harness_notes。",
    "对用户只说一句即可，不要贴链接或命令。",
  ].join("\n");
}

export function renderNotes(result) {
  const items = result?.items ?? [];
  if (!items.length) return "预览上没有未解决的意见。";
  const lines = items.map((item) => {
    const change = item.patch ? ` 建议修改：${JSON.stringify(item.patch)}` : "";
    const replies = item.replies?.length ? ` 回复：${item.replies.join(" / ")}` : "";
    return `#${item.n} [${item.path}] ${item.label || item.selector}（${item.selector}）：${item.note || "(无文字)"}${change}${replies}`;
  });
  return [`未解决的意见 ${items.length} 条（项目 ${result.project}）：`, ...lines, "逐条修改对应的源文件，改完再调用 page_harness_preview 刷新。"].join("\n");
}

export function normalizeTarget(raw) {
  let value = String(raw ?? "").trim();
  if (!value) throw new Error("missing the page URL to preview");
  if (/^\d+(?:[/?#]|$)/.test(value)) value = `http://localhost:${value}`;
  else if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("the page URL must be http(s)");
  return url.href;
}

const LOCAL_V4 = [
  ["127.0.0.0", 8],
  ["10.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
];

function ipv4InCidr(host, base, bits) {
  const ip = host.split(".").map(Number);
  const network = base.split(".").map(Number);
  if (ip.length !== 4 || ip.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  const toInt = (parts) => parts.reduce((acc, part) => ((acc << 8) + part) >>> 0, 0);
  return (toInt(ip) & mask) === (toInt(network) & mask);
}

export function assertLocalTarget(raw) {
  const href = normalizeTarget(raw);
  const host = new URL(href).hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return href;
  if (host.includes(":")) {
    const lower = host.toLowerCase();
    if (lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd")) return href;
    throw new Error("the page URL must be a localhost or private-network address");
  }
  if (LOCAL_V4.some(([base, bits]) => ipv4InCidr(host, base, bits))) return href;
  throw new Error("the page URL must be a localhost or private-network address");
}

export function redactSecrets(value) {
  return String(value ?? "")
    .replace(/"embedToken"\s*:\s*"[^"]*"/g, "\"embedToken\":\"[redacted]\"")
    .replace(/([?&]t=)[^&\s"#]+/g, "$1[redacted]");
}

export function sameOrigin(headers) {
  const origin = headers.origin;
  if (typeof origin !== "string") return false;
  let from;
  try { from = new URL(origin).host.toLowerCase(); }
  catch { return false; }
  return [headers.host, headers["x-forwarded-host"]].some((header) =>
    typeof header === "string" && header.split(",")[0].trim().toLowerCase() === from);
}

const escAttr = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, " ");

export function serializeQuote(pick) {
  const html = String(pick?.outerHTML || "");
  const text = String(pick?.text || "").replace(/\s+/g, " ").trim();
  const attrs = [
    ["url", pick?.url || ""],
    ["selector", pick?.selector || ""],
    ["tag", String(pick?.tagName || pick?.tag || "").toLowerCase()],
    ["text", text.length > 160 ? `${text.slice(0, 160)}…` : text],
  ].filter(([, entry]) => entry).map(([key, entry]) => `${key}="${escAttr(entry)}"`).join(" ");
  const body = html.length > 1500 ? `${html.slice(0, 1500)}<!-- … -->` : html;
  return `<page-element ${attrs}>\n${body}\n</page-element>`;
}

/** Appends a picked element and never sends the draft. */
export function appendPreviewQuote(controller, pick) {
  if (!controller || typeof controller.appendQuote !== "function") {
    return { ok: false, message: "输入框正在发送或不能编辑，引用没有写入。" };
  }
  const text = serializeQuote(pick);
  const ok = controller.appendQuote(text) === true;
  return ok
    ? { ok: true, text }
    : { ok: false, message: "输入框正在发送或不能编辑，引用没有写入。" };
}

export function previewFrame(status, pageProtocol) {
  if (!status?.running || !status.page || !status.appUrl) return { src: "", mixed: false };
  let app;
  try { app = new URL(status.appUrl); }
  catch { return { src: "", mixed: false }; }
  const mixed = pageProtocol === "https:" && app.protocol === "http:";
  if (mixed) return { src: "", mixed: true };
  const next = status.page.startsWith("/") ? status.page : `/${status.page}`;
  if (!status.embedToken) return { src: app.origin + next, mixed: false };
  const embed = new URL("/__ph/embed", app.origin);
  embed.searchParams.set("t", status.embedToken);
  embed.searchParams.set("next", next);
  return { src: embed.href, mixed: false };
}

/** The service list and the preview page are never shown together. */
export function previewSurface({ view, running, mixed }) {
  if (view === "list" || !running) return "list";
  return mixed ? "mixed" : "preview";
}

const HTML_FILE = /\.html?$/i;
const SCRIPT_FILE = /(\.(m?[jt]sx?|cjs|vue|svelte|astro|css|scss|less|py|rb|php|go)|(^|[\\/])package\.json)$/i;
const SERVER_CMD = new RegExp([
  "\\b(npm|pnpm|yarn|bun)\\s+(run\\s+)?(dev|start|serve|preview)\\b",
  "\\bnpx\\s+(vite|next|nuxt|astro|serve|http-server|live-server|webpack)\\b",
  "(^|[\\s;&|(])(vite|next\\s+dev|nuxt\\s+dev|astro\\s+dev|webpack\\s+serve|webpack-dev-server|http-server|live-server|serve)(\\s|$)",
  "python3?\\s+-m\\s+http\\.server",
  "manage\\.py\\s+runserver",
  "\\b(flask\\s+run|uvicorn|gunicorn|hugo\\s+server|jekyll\\s+serve|rails\\s+s(erver)?)\\b",
  "\\bphp\\s+-S\\b",
  "\\b(node|bun|deno|tsx|ts-node|nodemon)\\s+(run\\s+)?\\S*(server|app|index|main|dev)\\.(m?[jt]s|cjs)\\b",
].join("|"), "i");

export function commandPort(command) {
  const match = /(?:--port[ =]|(?:^|\s)-[pl]\s+|\bPORT=|http\.server\s+|runserver\s+(?:[\w.]+:)?|-S\s+[\w.]+:|localhost:|127\.0\.0\.1:|0\.0\.0\.0:)(\d{2,5})\b/i.exec(command);
  return match ? Number(match[1]) : 0;
}

export function classifyTurn(blocks) {
  const html = [];
  const scripts = [];
  const servers = [];
  let previewed = false;
  for (const block of blocks ?? []) {
    if (block?.type === "patch") {
      for (const change of block.changes ?? []) {
        const file = String(change?.path ?? "");
        if (!file) continue;
        if (HTML_FILE.test(file) && !html.includes(file)) html.push(file);
        else if (SCRIPT_FILE.test(file) && !scripts.includes(file)) scripts.push(file);
      }
    } else if (block?.type === "turn-diff") {
      for (const fileInfo of block.files ?? []) {
        const file = String(fileInfo?.path ?? "");
        if (HTML_FILE.test(file) && !html.includes(file)) html.push(file);
        else if (SCRIPT_FILE.test(file) && !scripts.includes(file)) scripts.push(file);
      }
    } else if (block?.type === "command-execution") {
      const command = String(block.command ?? "");
      if (command && (SERVER_CMD.test(command) || commandPort(command))) {
        servers.push({ command: command.slice(0, 300), port: commandPort(command) });
      }
    } else if (block?.type === "tool-call" && (block.name === "page_harness_preview" || block.namespace === "page_harness" && block.name === "page_harness_preview")) {
      if (!block.errorMessage) previewed = true;
    }
  }
  if (!html.length && !scripts.length && !servers.length) return null;
  const mode = servers.length ? "server" : html.length ? "html" : "script";
  return { mode, html, scripts, servers, previewed };
}

export function previewCardTitle(status) {
  if (status?.needsAgent || status?.error || status?.running === false) return "预览打开失败";
  return "已在右侧预览";
}

export const MIXED_CONTENT_MESSAGE = "当前页面是 HTTPS，预览是 HTTP，浏览器会拦截嵌入。";
export const QUOTE_BLOCKED_MESSAGE = "输入框正在发送或不能编辑，引用没有写入。";
