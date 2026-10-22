import { prepareBrowserRuntimeAccess } from './remote-browser-access.mjs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

const methods = new Set(['viewport', 'navigate', 'reload', 'stop', 'back', 'forward', 'visible', 'keyframe', 'capture', 'zoom', 'input', 'text', 'automation', 'close']);
const quietMethods = new Set(['visible', 'keyframe', 'input', 'text']);
/** Gateway-owned process and page leases. A client gets only its own page port,
 * never a CDP endpoint, filesystem path or arbitrary JavaScript evaluator. */
export class RemoteBrowserService {
  constructor({ root, dataDirectory, executable, allowNoSandbox = false, spawnImpl = spawn }) {
    this.directory = join(root, 'runtime/browser');
    this.executable = executable ?? join(this.directory, 'electron/electron');
    this.dataDirectory = join(dataDirectory, 'remote-browser');
    this.allowNoSandbox = allowNoSandbox;
    this.spawnImpl = spawnImpl;
    this.claims = new Map(); this.pages = new Map(); this.requests = new Map(); this.sockets = new Set();
    this.server = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 128 * 1024 });
  }
  async available() {
    try { await Promise.all([access(this.executable), access(join(this.directory, 'worker.cjs'))]); return process.platform === 'linux'; }
    catch { return false; }
  }
  async start() {
    if (this.closed) throw new Error('Browser service closed');
    if (this.starting) return this.starting;
    this.starting = (async () => {
      if (!await this.available()) throw new Error('Bundled browser runtime unavailable');
      await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
      const env = { ...process.env, OPENCRAFT_BROWSER_DATA_DIR: this.dataDirectory };
      // A trusted runtime needs no inherited Node hooks or ambient desktop.
      for (const name of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH','DISPLAY','WAYLAND_DISPLAY']) delete env[name];
      const flags = ['--ozone-platform=headless', '--ozone-override-screen-size=1920,1080', '--disable-gpu'];
      const isolated = process.getuid?.() === 0 && !this.allowNoSandbox;
      this.isolated = isolated;
      let child;
      if (isolated) {
        await prepareBrowserRuntimeAccess(this.directory);
        // Root gateways never run hostile pages as root or silently disable the
        // Chromium sandbox. systemd gives this child a private dynamic UID and
        // mounts only public runtime assets through the root-private release.
        const state = 'opencraft-browser-' + createHash('sha256').update(this.dataDirectory).digest('hex').slice(0, 16);
        this.unit = 'opencraft-browser-' + randomUUID();
        child = this.spawnImpl('systemd-run', ['--pipe', '--wait', '--collect', '--quiet', '--service-type=exec', '--unit=' + this.unit,
          '-p', 'DynamicUser=yes', '-p', 'PrivateTmp=yes', '-p', 'NoNewPrivileges=yes', '-p', 'StateDirectory=' + state, '-p', 'StateDirectoryMode=0700',
          '-p', 'BindReadOnlyPaths=' + this.directory + ':/opt/opencraft-browser',
          '-p', 'Environment=OPENCRAFT_BROWSER_DATA_DIR=/var/lib/' + state,
          '-p', 'Environment=HOME=/var/lib/' + state,
          '/usr/bin/env', '/opt/opencraft-browser/electron/electron', ...flags, '/opt/opencraft-browser/worker.cjs'],
          { env, stdio: ['pipe', 'pipe', 'pipe'] });
        createInterface({ input: child.stdout }).on('line', line => { try { child.emit('message', JSON.parse(line)); } catch {} });
      } else {
        child = this.spawnImpl(this.executable, [...flags, ...(this.allowNoSandbox ? ['--no-sandbox'] : []), join(this.directory, 'worker.cjs')],
          { env, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], serialization: 'json' });
      }
      this.child = child;
      // Do not log visited URLs, page content, cookies or arbitrary Chromium stderr.
      child.stderr?.resume();
      child.on('message', message => this.receive(message));
      child.on('exit', () => {
        if (this.child !== child) return;
        this.child = null; this.starting = null;
        for (const request of this.requests.values()) { clearTimeout(request.timer); request.reject(new Error('Browser process exited')); }
        this.requests.clear();
        for (const p of this.pages.values()) { clearTimeout(p.timer); p.socket?.close(1011, 'Browser process exited; reload tab'); }
        this.pages.clear();
      });
      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = error => { if (settled) return; settled = true; clearTimeout(timer); child.off('message', ready); error ? reject(error) : resolve(); };
        const ready = message => { if (message.type === 'ready') finish(); };
        const timer = setTimeout(() => { child.kill(); finish(new Error('Browser startup timed out')); }, 15000);
        child.on('message', ready); child.once('error', () => finish(new Error('Browser process could not start')));
        child.once('exit', () => finish(new Error('Browser process exited during startup')));
      });
    })();
    try { return await this.starting; } catch (error) { this.starting = null; throw error; }
  }
  receive(message) {
    if (message.type === 'result') {
      const request = this.requests.get(message.id); if (!request) return;
      this.requests.delete(message.id); clearTimeout(request.timer);
      message.error ? request.reject(Object.assign(new Error(message.error.message), message.error)) : request.resolve(message.value); return;
    }
    const p = [...this.pages.values()].find(page => page.id === message.page);
    const ws = p?.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 128 * 1024) { ws.close(1013, 'Display behind'); ws.terminate(); return; }
    if (message.type === 'frame') ws.send(Buffer.from(message.bytes, 'base64'), { binary: true });
    else { const { page, ...event } = message; ws.send(JSON.stringify(event)); }
  }
  request(page, method, input) {
    if (!this.child || (this.isolated ? this.child.stdin.destroyed : !this.child.connected)) return Promise.reject(new Error('Browser unavailable'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.requests.delete(id); reject(new Error('Browser operation timed out')); }, method === 'navigate' ? 45000 : 20000);
      timer.unref(); this.requests.set(id, { resolve, reject, timer });
      const failed = error => { if (error) { clearTimeout(timer); this.requests.delete(id); reject(new Error('Browser disconnected')); } };
      if (this.isolated) this.child.stdin.write(JSON.stringify({ id, page, method, input }) + '\n', failed);
      else this.child.send({ id, page, method, input }, failed);
    });
  }
  upgrade(request, socket, head, { ownerId, authorize = () => {}, track = () => {} }) {
    this.server.handleUpgrade(request, socket, head, ws => {
      this.sockets.add(ws); track(ws);
      let page = null, claimKey = null, pending = 0, opening = false;
      const reply = (id, value, error) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'result', id, value,
        ...(error ? { error: { code: error.code || 'BROWSER_ERROR', message: error.message, retryable: !!error.retryable } } : {}) })); };
      ws.on('error', () => ws.terminate());
      ws.on('message', async (bytes, binary) => {
        if (binary || pending >= 128) { ws.close(1008, 'Invalid browser request'); return; }
        let message;
        pending++;
        try {
          authorize(); message = JSON.parse(bytes.toString());
          if (typeof message.id !== 'string' || message.id.length > 100) throw new Error('Invalid request id');
          if (message.method === 'open') {
            if (page || opening) throw new Error('Browser already opened');
            opening = true;
            if (!/^[a-zA-Z0-9-]{20,128}$/.test(message.input?.lease ?? '')) throw new Error('Invalid browser lease');
            const key = JSON.stringify([ownerId, message.input.lease]);
            if (this.claims.has(key) && this.claims.get(key) !== ws) throw new Error('Browser page already attached');
            this.claims.set(key, ws); claimKey = key;
            const existing = this.pages.get(key);
            if (existing?.socket && existing.socket !== ws) throw new Error('Browser page already attached');
            if (!existing && [...this.pages.values()].filter(p => p.ownerId === ownerId).length >= 16) throw new Error('Browser page limit reached');
            await this.start(); authorize();
            if (ws.readyState !== WebSocket.OPEN) return;
            page = existing ?? { id: createHash('sha256').update(key).digest('hex'), key, ownerId, socket: ws };
            clearTimeout(page.timer); page.socket = ws; this.pages.set(key, page);
            let config;
            try { config = await this.request(page.id, 'create', message.input?.viewport); }
            catch (error) { this.pages.delete(key); page = null; throw error; }
            if (ws.readyState !== WebSocket.OPEN) { this.pages.delete(page.key); void this.request(page.id, 'close').catch(() => {}); page = null; return; }
            reply(message.id, { ...config, resumed: !!existing });
            opening = false; return;
          }
          if (!page || !methods.has(message.method)) throw new Error('Browser page not opened');
          // Recheck at execution and before returning a result across async work.
          authorize();
          const value = await this.request(page.id, message.method, message.input);
          authorize();
          if (message.method === 'close') { this.pages.delete(page.key); page = null; }
          if (!quietMethods.has(message.method)) reply(message.id, value);
        } catch (error) { opening = false; if (!page && claimKey && this.claims.get(claimKey) === ws) { this.claims.delete(claimKey); claimKey = null; }
          if (message?.id) reply(message.id, null, error); else ws.close(1008, 'Invalid browser request'); }
        finally { pending--; }
      });
      ws.on('close', () => {
        this.sockets.delete(ws);
        if (claimKey && this.claims.get(claimKey) === ws) this.claims.delete(claimKey);
        if (!page || page.socket !== ws) return;
        page.socket = null;
        void this.request(page.id, 'visible', { visible: false }).catch(() => {});
        const orphan = page;
        orphan.timer = setTimeout(() => { if (orphan.socket) return; this.pages.delete(orphan.key); void this.request(orphan.id, 'close').catch(() => {}); }, 60000);
        orphan.timer.unref();
      });
    });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const ws of this.sockets) ws.terminate();
    for (const p of this.pages.values()) clearTimeout(p.timer);
    this.pages.clear(); this.claims.clear();
    for (const request of this.requests.values()) { clearTimeout(request.timer); request.reject(new Error('Browser service closed')); }
    this.requests.clear();
    if (this.isolated) this.child?.stdin.end(); else this.child?.kill();
    this.server.close();
  }
}
