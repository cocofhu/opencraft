// Right-rail page-harness process owned by the workbench Node process.
// The renderer never spawns page-harness. Share previews are not part of this host.
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readdirSync as readdir, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import {
  DEFAULT_PREVIEW_PORT,
  DEV_PORTS,
  assertLocalTarget,
  commandPort,
  redactSecrets,
  renderNotes,
  renderPreview,
  sameOrigin,
} from "./shared.mjs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const READY_TIMEOUT_MS = 60_000;
const TAIL_BYTES = 4096;

export function defaultSettingsFile() {
  return path.join(homedir(), ".opencraft", "page-harness.json");
}

export function normalizeSettings(raw) {
  const previewPort = Number(raw?.previewPort ?? DEFAULT_PREVIEW_PORT);
  if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65534) {
    throw new Error("预览端口必须是 1 到 65534 的整数");
  }
  const cliPath = String(raw?.cliPath ?? "").trim();
  return { previewPort, cliPath };
}

export function createSettingsStore(file = defaultSettingsFile()) {
  let settings = { previewPort: DEFAULT_PREVIEW_PORT, cliPath: "" };
  try {
    settings = normalizeSettings(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    if (error instanceof Error && /预览端口/.test(error.message)) throw error;
  }
  return {
    file,
    get() { return { ...settings }; },
    save(next) {
      settings = normalizeSettings({ ...settings, ...next });
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
      return this.get();
    },
  };
}

export function resolveCli(configured) {
  if (configured) return existsSync(configured) ? path.resolve(configured) : null;
  try {
    const pkg = createRequire(import.meta.url).resolve("page-harness/package.json");
    const cli = path.join(path.dirname(pkg), "dist", "cli.js");
    if (existsSync(cli)) return cli;
  } catch { /* not installed */ }
  return null;
}

export function withinRoot(root, file) {
  let base, real;
  try {
    base = realpathSync(root);
    real = realpathSync(file);
  } catch { return false; }
  const rel = path.relative(base, real);
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel));
}

export function pagePath(root, file) {
  return `/${path.relative(root, file).split(path.sep).map(encodeURIComponent).join("/")}`;
}

export class StaticServer {
  constructor() {
    this.root = "";
    this.server = null;
    this.port = 0;
  }

  get origin() { return `http://127.0.0.1:${this.port}`; }

  async serve(root, preferredPort = 0) {
    const next = path.resolve(root);
    if (this.server && this.root === next) return this.origin;
    if (this.server) await this.close();
    this.root = next;
    const server = http.createServer((request, response) => this.handle(request, response));
    const listen = (port) => new Promise((resolve, reject) => {
      const fail = (error) => { server.off("error", fail); reject(error); };
      server.once("error", fail);
      server.listen(port, "127.0.0.1", () => { server.off("error", fail); resolve(); });
    });
    try { await listen(preferredPort); }
    catch (error) {
      if (!preferredPort || error?.code !== "EADDRINUSE") throw error;
      await listen(0);
    }
    this.server = server;
    this.port = server.address().port;
    return this.origin;
  }

  resolve(urlPath) {
    let rel;
    try { rel = decodeURIComponent(String(urlPath || "/").split("?")[0]); }
    catch { return null; }
    const file = path.resolve(this.root, `.${path.posix.normalize(`/${rel}`)}`);
    if (file !== this.root && !file.startsWith(this.root + path.sep)) return null;
    if (!existsSync(file)) return null;
    const stat = statSync(file);
    let target = file;
    if (stat.isDirectory()) {
      target = path.join(file, "index.html");
      if (!existsSync(target) || !statSync(target).isFile()) return null;
    } else if (!stat.isFile()) return null;
    return withinRoot(this.root, target) ? target : null;
  }

  handle(request, response) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    const file = this.root ? this.resolve(request.url || "/") : null;
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
      return;
    }
    response.writeHead(200, {
      "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    if (request.method === "HEAD") { response.end(); return; }
    createReadStream(file).pipe(response);
  }

  async close() {
    const server = this.server;
    this.server = null;
    if (!server) return;
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(() => resolve()));
  }
}

function existingDir(cwd) {
  const raw = path.resolve(String(cwd || process.cwd()));
  if (existsSync(raw)) return raw;
  const trimmed = path.resolve(String(cwd || process.cwd()).trim());
  if (trimmed !== raw && existsSync(trimmed)) return trimmed;
  return raw;
}

function isProject(dir) {
  return ["package.json", "index.html", "pyproject.toml", "manage.py"].some((name) => existsSync(path.join(dir, name)));
}

function soleChildProject(dir) {
  try {
    const entries = readdir(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules");
    const projects = entries.map((entry) => path.join(dir, entry.name)).filter(isProject);
    return projects.length === 1 ? projects[0] : "";
  } catch { return ""; }
}

export function resolveProjectDir(cwd, rel = "") {
  const given = existingDir(cwd);
  if (rel) {
    const file = path.resolve(given, rel);
    if (existsSync(file)) return given;
  }
  if (isProject(given)) return given;
  return soleChildProject(given) || given;
}

function readScripts(dir) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
    return pkg && typeof pkg.scripts === "object" && pkg.scripts ? pkg.scripts : {};
  } catch { return {}; }
}

export function isStaticProject(dir) {
  const index = path.join(dir, "index.html");
  if (!existsSync(index) || !statSync(index).isFile()) return false;
  const scripts = readScripts(dir);
  return !scripts.dev && !scripts.start;
}

export function agentPlan(cwd, url) {
  const href = assertLocalTarget(url);
  const parsed = new URL(href);
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  const project = resolveProjectDir(cwd);
  const scripts = readScripts(project);
  let command = `start the server for this project so it listens on port ${port}`;
  if (scripts.dev) command = `npm run dev -- --host 127.0.0.1 --port ${port}`;
  else if (scripts.start) command = "npm start";
  else if (existsSync(path.join(project, "index.html"))) command = `python3 -m http.server ${port} --bind 127.0.0.1`;
  return {
    needsAgent: true,
    running: false,
    waitingForPage: false,
    url: href,
    project,
    command,
    reason: `GET ${href} 没有响应。`,
    error: `GET ${href} 没有响应。`,
  };
}

export function probeHttp(raw, timeoutMs = 800) {
  const href = assertLocalTarget(raw);
  const url = new URL(href);
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const request = lib.request({
      method: "GET",
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      timeout: timeoutMs,
      headers: { accept: "text/html,*/*" },
    }, (response) => {
      response.resume();
      resolve({ ok: response.statusCode < 500, status: response.statusCode });
    });
    request.on("timeout", () => request.destroy());
    request.on("error", (error) => resolve({ ok: false, error: error.code || error.message }));
    request.end();
  });
}

export async function waitForHttp(raw, { attempts = 4, gapMs = 300, timeoutMs = 800 } = {}) {
  let last = { ok: false, error: "no attempt" };
  for (let i = 0; i < attempts; i += 1) {
    last = await probeHttp(raw, timeoutMs);
    if (last.ok) return last;
    if (i + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, gapMs));
  }
  return last;
}

function cliArgs(cli, options) {
  const args = [cli, options.target, "--project", options.project, "--json", "--port", String(options.port), "--control-port", String(options.port + 1), "--host", options.host];
  if (options.publicHost) args.push("--public-host", options.publicHost);
  if (options.publicScheme === "https") args.push("--public-scheme", "https");
  for (const origin of options.embedOrigins ?? []) args.push("--embed-origin", origin);
  args.push("--no-agent");
  return args;
}

function runKey(options) {
  return JSON.stringify([
    options.target,
    options.project,
    options.host,
    options.publicHost ?? "",
    [...(options.embedOrigins ?? [])].sort(),
    options.port,
    options.publicScheme ?? "http",
  ]);
}

function parseReady(line) {
  if (!line.startsWith("{")) return null;
  try {
    const data = JSON.parse(line);
    if (data?.event !== "ready") return null;
    return {
      appUrl: data.appUrl,
      controlUrl: data.controlUrl,
      mode: data.mode,
      noAgent: !!data.noAgent,
      version: data.version,
      pid: data.pid,
      ...(data.embedToken ? { embedToken: data.embedToken } : {}),
    };
  } catch { return null; }
}

export class PreviewManager {
  constructor(opts = {}) {
    this.spawn = opts.spawn ?? spawn;
    this.readyTimeoutMs = opts.readyTimeoutMs ?? READY_TIMEOUT_MS;
    this.child = null;
    this.info = null;
    this.error = "";
    this.pending = null;
    this.chain = Promise.resolve();
    this.onExit = () => { this.child?.kill("SIGTERM"); };
    process.on("exit", this.onExit);
  }

  status() {
    const { key: _key, ...info } = this.info ?? {};
    return { running: !!this.info, starting: !!this.pending, error: this.error || null, ...info };
  }

  enqueue(fn) {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(() => {}, () => {});
    return run;
  }

  start(options) { return this.enqueue(() => this.startOne(options)); }

  async startOne(options) {
    const target = assertLocalTarget(options.target);
    const project = path.resolve(options.project || process.cwd());
    if (!existsSync(project) || !statSync(project).isDirectory()) throw new Error(`project directory not found: ${project}`);
    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 1 || port > 65534) throw new Error("port must be between 1 and 65534 (the control port is port + 1)");
    const run = { ...options, target, project, port, host: options.host || "127.0.0.1", share: false, withAgent: false };
    if (this.info && this.info.key === runKey(run)) return this.status();
    await this.stop();
    const cli = resolveCli(options.cliPath);
    if (!cli) throw new Error("找不到 page-harness CLI。请在设置里填写 dist/cli.js 的路径，或先安装 page-harness。");
    this.error = "";
    this.pending = this.launch(cli, run);
    let retry = null;
    try { await this.pending; }
    catch (error) {
      const message = redactSecrets(error instanceof Error ? error.message : String(error));
      if (!run._retried && run.port + 2 <= 65534 && /already in use|EADDRINUSE/i.test(message)) retry = { ...run, port: run.port + 2, _retried: true };
      else {
        this.error = message;
        throw new Error(message);
      }
    } finally { this.pending = null; }
    if (retry) return this.startOne(retry);
    return this.status();
  }

  launch(cli, options) {
    return new Promise((resolve, reject) => {
      const child = this.spawn(process.execPath, cliArgs(cli, options), {
        cwd: options.project,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
      this.child = child;
      let out = "";
      let tail = "";
      let settled = false;
      const fail = (message) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill("SIGTERM");
        reject(new Error(redactSecrets(message)));
      };
      const timer = setTimeout(() => fail(`page-harness did not start within ${Math.round(this.readyTimeoutMs / 1000)}s${tail ? `:\n${tail.trim()}` : ""}`), this.readyTimeoutMs);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => { tail = (tail + chunk).slice(-TAIL_BYTES); });
      child.stdout.on("data", (chunk) => {
        out += chunk;
        let index;
        while ((index = out.indexOf("\n")) >= 0) {
          const line = out.slice(0, index).trim();
          out = out.slice(index + 1);
          const ready = parseReady(line);
          if (!ready || settled || this.child !== child) continue;
          settled = true;
          clearTimeout(timer);
          this.info = {
            ...ready,
            key: runKey(options),
            target: options.target,
            project: options.project,
            port: options.port,
            controlPort: options.port + 1,
            startedAt: Date.now(),
          };
          resolve();
        }
      });
      child.on("error", (error) => fail(`failed to start page-harness: ${error.message}`));
      child.on("exit", (code, signal) => {
        if (this.child === child) {
          this.child = null;
          this.info = null;
        }
        if (!settled) fail(`page-harness exited (${signal ?? code})${tail ? `:\n${tail.trim()}` : ""}`);
        else if (code && !this.error) this.error = redactSecrets(`page-harness exited (${code})${tail ? `:\n${tail.trim()}` : ""}`);
      });
    });
  }

  async stop() {
    const child = this.child;
    this.child = null;
    this.info = null;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    await new Promise((resolve) => {
      const force = setTimeout(() => child.kill("SIGKILL"), 5000);
      child.once("exit", () => { clearTimeout(force); resolve(); });
      child.kill("SIGTERM");
    });
  }

  async dispose() {
    process.off("exit", this.onExit);
    await this.stop();
  }
}

export function readNotes(project) {
  if (!project) return [];
  let data;
  try { data = JSON.parse(readFileSync(path.join(project, ".page-harness", "review.json"), "utf8")); }
  catch { return []; }
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return items.filter((item) => item && item.status !== "resolved").map((item) => ({
    n: item.n,
    kind: item.kind,
    path: item.path,
    selector: item.selector,
    label: item.label,
    note: item.note,
    patch: item.patch,
    author: item.author?.name,
    replies: (item.replies ?? []).map((reply) => reply.text).filter(Boolean),
  }));
}

export function appendNote(project, note) {
  if (!project) throw new Error("没有正在预览的项目");
  const file = path.join(project, ".page-harness", "review.json");
  let data = { items: [] };
  try { data = JSON.parse(readFileSync(file, "utf8")); }
  catch { /* new file */ }
  if (!Array.isArray(data.items)) data.items = Array.isArray(data) ? data : [];
  const text = String(note?.note ?? "").trim();
  if (!text) throw new Error("意见不能为空");
  const nextNumber = data.items.reduce((max, item) => Math.max(max, Number(item?.n) || 0), 0) + 1;
  data.items.push({
    n: nextNumber,
    kind: "note",
    path: String(note.path || "/"),
    selector: String(note.selector || ""),
    label: note.label ? String(note.label) : undefined,
    note: text.slice(0, 2000),
    status: "open",
    replies: [],
  });
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return readNotes(project);
}

export class PagePreview {
  constructor(opts = {}) {
    this.manager = opts.manager ?? new PreviewManager(opts);
    this.files = opts.files ?? new StaticServer();
    this.embedOrigin = "";
    this.probe = opts.probe ?? ((url) => waitForHttp(url));
    this.request = null;
    this.page = "";
    this.label = "";
    this.rev = 0;
  }

  setEmbedOrigin(origin) {
    if (typeof origin === "string" && /^https?:\/\/[^/]+$/.test(origin)) this.embedOrigin = origin;
  }

  status() {
    const current = this.manager.status();
    return {
      ...current,
      page: this.page,
      label: this.label,
      rev: this.rev,
      waitingForPage: !!this.request && !current.running && !this.embedOrigin,
    };
  }

  async open(req, config) {
    const request = req && (req.path || req.url)
      ? { path: req.path || "", url: req.url || "", cwd: req.cwd || this.request?.cwd || "" }
      : this.request;
    if (!request) throw new Error("nothing to preview yet: pass a file path or a URL");
    this.request = request;
    if (!this.embedOrigin) return this.status();
    const cwd = resolveProjectDir(request.cwd || process.cwd(), request.url ? "" : request.path || "index.html");
    let target, page, label;
    if (request.url) {
      const requested = assertLocalTarget(request.url);
      const url = new URL(requested);
      const up = await this.probe(requested);
      if (!up.ok) {
        if (!isStaticProject(cwd)) throw new Error(renderPreview(agentPlan(cwd, requested)));
        target = `${await this.files.serve(cwd, config.previewPort ? config.previewPort + 2 : 0)}/`;
        page = url.pathname + url.search + url.hash;
        label = path.basename(page.split(/[?#]/)[0]) || "index.html";
      } else {
        target = `${url.origin}/`;
        page = url.pathname + url.search + url.hash;
        label = url.href;
      }
    } else {
      let file = path.resolve(cwd, request.path || "index.html");
      if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`file not found: ${file}`);
      if (!withinRoot(cwd, file)) throw new Error(`file is outside the workspace: ${file}`);
      target = `${await this.files.serve(cwd, config.previewPort ? config.previewPort + 2 : 0)}/`;
      page = pagePath(cwd, file);
      label = path.relative(cwd, file) || path.basename(file);
    }
    const viewer = new URL(this.embedOrigin).hostname.replace(/^\[|\]$/g, "");
    const local = viewer === "localhost" || viewer === "127.0.0.1" || viewer === "::1";
    await this.manager.start({
      target,
      project: cwd,
      port: config.previewPort,
      host: local ? "127.0.0.1" : "0.0.0.0",
      publicHost: local ? "" : viewer,
      embedOrigins: [this.embedOrigin],
      withAgent: false,
      share: false,
      publicScheme: config.publicScheme,
      cliPath: config.cliPath,
    });
    this.page = page;
    this.label = label;
    this.rev += 1;
    return this.status();
  }

  async stop() {
    this.request = null;
    this.page = "";
    this.label = "";
    await this.manager.stop();
  }

  async dispose() {
    await this.manager.dispose();
    await this.files.close();
  }
}

export async function detectDevServers({ exclude = [], ports = DEV_PORTS, timeoutMs = 400 } = {}) {
  const skip = new Set(exclude.map(Number));
  const probe = (port) => new Promise((resolve) => {
    const request = http.get({ host: "127.0.0.1", port, path: "/", timeout: timeoutMs, headers: { accept: "text/html" } }, (response) => {
      const type = String(response.headers["content-type"] ?? "");
      if (!/text\/html/i.test(type)) { response.resume(); resolve(null); return; }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; if (body.length > 64_000) response.destroy(); });
      const done = () => {
        const title = /<title[^>]*>([^<]*)<\/title>/i.exec(body)?.[1]?.trim() ?? "";
        resolve({ port, url: `http://localhost:${port}/`, title: title.slice(0, 80) });
      };
      response.on("end", done);
      response.on("close", done);
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(null));
  });
  const found = await Promise.all(ports.filter((port) => !skip.has(port)).map((port) => probe(port)));
  return found.filter(Boolean);
}

function sendJson(response, code, body) {
  const payload = JSON.stringify(body);
  response.statusCode = code;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(payload);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("request body too large");
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export function createPageHarnessHost(options = {}) {
  const settings = options.settings ?? createSettingsStore(options.settingsFile);
  const preview = options.preview ?? new PagePreview(options);
  let workbenchPort = 0;
  const host = {
    settings,
    preview,
    noteWorkbenchPort(port) { workbenchPort = Number(port) || 0; },
    async handle(request, response) {
      try {
        const url = new URL(request.url || "/", "http://127.0.0.1");
        if (url.pathname !== "/page-harness") return false;
        if (request.method !== "POST") { sendJson(response, 405, { ok: false, error: "POST only" }); return true; }
        const trustedForwardedHost = options.trustForwardedHost === true ? request.headers["x-forwarded-host"] : undefined;
        if (!sameOrigin(request.headers, trustedForwardedHost)) { sendJson(response, 403, { ok: false, error: "same-origin requests only" }); return true; }
        if (!/^application\/json\b/i.test(String(request.headers["content-type"] ?? ""))) {
          sendJson(response, 415, { ok: false, error: "JSON only" });
          return true;
        }
        preview.setEmbedOrigin(request.headers.origin);
        let body;
        try { body = await readBody(request); }
        catch { sendJson(response, 400, { ok: false, error: "JSON only" }); return true; }
        const config = settings.get();
        const method = String(body.method ?? "status");
        if (method === "status" || method === "previewStatus") {
          const current = preview.status();
          if (method === "previewStatus" && preview.request && !current.running && !current.starting && !current.error) {
            sendJson(response, 200, { ok: true, ...(await preview.open(null, config)) });
            return true;
          }
          sendJson(response, 200, { ok: true, ...current });
          return true;
        }
        if (method === "settings") { sendJson(response, 200, { ok: true, settings: config }); return true; }
        if (method === "saveSettings") {
          sendJson(response, 200, { ok: true, settings: settings.save({ previewPort: body.previewPort, cliPath: body.cliPath }) });
          return true;
        }
        if (method === "preview") {
          const next = body.path || body.url ? { path: String(body.path ?? ""), url: String(body.url ?? ""), cwd: String(body.cwd ?? "") } : null;
          sendJson(response, 200, { ok: true, ...(await preview.open(next, config)) });
          return true;
        }
        if (method === "previewStop") {
          await preview.stop();
          sendJson(response, 200, { ok: true, ...preview.status() });
          return true;
        }
        if (method === "detect") {
          const current = settings.get();
          const own = [current.previewPort, current.previewPort + 1, current.previewPort + 2, workbenchPort, request.socket?.localPort];
          const extra = (Array.isArray(body.ports) ? body.ports : []).map(Number).filter((port) => Number.isInteger(port) && port > 0 && port < 65536).slice(0, 10);
          const ports = [...new Set([...DEV_PORTS, ...extra])];
          sendJson(response, 200, { ok: true, servers: await detectDevServers({ exclude: own, ports, timeoutMs: options.detectTimeoutMs }) });
          return true;
        }
        if (method === "notes") {
          const project = preview.status().project || String(body.cwd ?? "");
          const items = readNotes(project);
          sendJson(response, 200, { ok: true, project, items, text: renderNotes({ project, items }) });
          return true;
        }
        if (method === "note") {
          const project = preview.status().project || resolveProjectDir(String(body.cwd || process.cwd()));
          const items = appendNote(project, body);
          sendJson(response, 200, { ok: true, project, items, text: renderNotes({ project, items }) });
          return true;
        }
        sendJson(response, 400, { ok: false, error: "unknown method" });
        return true;
      } catch (error) {
        const message = redactSecrets(error instanceof Error ? error.message : String(error));
        sendJson(response, 500, { ok: false, error: message });
        return true;
      }
    },
    async dispose() { await preview.dispose(); },
  };
  return host;
}

export function toolResult(status) {
  return { text: renderPreview(status), card: status?.running ? "已在右侧预览" : "预览打开失败" };
}

export { commandPort, renderNotes, renderPreview };
