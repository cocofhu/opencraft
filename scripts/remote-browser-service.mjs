import { prepareBrowserRuntimeAccess } from './remote-browser-access.mjs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

const methods = new Set(['viewport', 'navigate', 'reload', 'stop', 'back', 'forward', 'visible', 'keyframe', 'capture', 'zoom', 'input', 'text', 'ime', 'copy', 'automation', 'close']);
const quietMethods = new Set(['visible', 'keyframe', 'input', 'text']);
// The worker's bootstrap document is an empty tab, not an external URL.
const checkpointUrl = url => url === 'about:blank' || url === '' ? null : url;
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
    this.states = new Map(); this.persistence = Promise.resolve();
    this.diagnosticCount = 0;
    this.server = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 128 * 1024 });
  }
  async load() {
    this.loading ??= (async () => {
      await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
      let saved;
      try { saved = JSON.parse(await readFile(join(this.dataDirectory, 'tabs.json'), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') { this.loaded = true; return; } throw new Error('Browser state could not be read'); }
      if (saved.schemaVersion !== 1 || !Array.isArray(saved.pages) || !Array.isArray(saved.states)) throw new Error('Unsupported browser state');
      for (const p of saved.pages) {
        if (typeof p.ownerId !== 'string' || typeof p.key !== 'string' || p.id !== createHash('sha256').update(p.key).digest('hex')
          || JSON.parse(p.key)[0] !== p.ownerId) throw new Error('Invalid browser state');
        this.pages.set(p.key, { ...p, url: checkpointUrl(p.url), socket: null, live: false });
      }
      for (const [owner, state] of saved.states) this.states.set(owner, state);
      this.loaded = true;
    })();
    return this.loading;
  }
  persist() {
    const saved = JSON.stringify({ schemaVersion: 1,
      pages: [...this.pages.values()].map(({ id, key, ownerId, url, viewport, zoom }) => ({ id, key, ownerId, url, viewport, zoom })),
      states: [...this.states.entries()] });
    const operation = this.persistence.then(async () => {
      const temporary = join(this.dataDirectory, 'tabs-' + randomUUID() + '.tmp');
      await writeFile(temporary, saved, { mode: 0o600 });
      await rename(temporary, join(this.dataDirectory, 'tabs.json'));
    });
    this.persistence = operation.catch(() => {});
    return operation;
  }
  checkpoint() {
    if (this.checkpointTimer || this.closed) return;
    this.checkpointTimer = setTimeout(() => {
      this.checkpointTimer = null;
      void this.persist().catch(() => {
        for (const ws of this.sockets) if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: 'error', message: 'Browser recovery state could not be saved' }));
      });
    }, 150);
    this.checkpointTimer.unref();
  }
  async metadata(ownerId, input, authorize) {
    await this.load();
    const operation = (this.metadataQueue ?? Promise.resolve()).then(async () => {
      if (this.closed) throw new Error('Browser service closed');
      authorize();
      const previous = this.states.get(ownerId) ?? { revision: 0, values: {} };
      const scope = createHash('sha256').update(this.dataDirectory + '\0' + ownerId).digest('hex');
      if (input === undefined) return { ...previous, scope };
      if (input.scope !== scope) throw Object.assign(new Error('Browser account changed; reload to synchronize'), { code: 'STATE_CONFLICT' });
      const keys = ['pages', 'tabs', 'storage', 'bindings'];
      if (!keys.includes(input.key) || typeof input.value !== 'string' || input.value.length > 64 * 1024 || !/^[a-zA-Z0-9-]{20,100}$/.test(input.mutationId ?? '')) throw new Error('Invalid browser metadata');
      if (input.mutationId === previous.lastMutation) return { revision: previous.revision };
      if (input.expectedRevision !== previous.revision) throw Object.assign(new Error('Browser state changed in another client; reload to synchronize'), { code: 'STATE_CONFLICT' });
      const next = { revision: previous.revision + 1, lastMutation: input.mutationId, values: { ...previous.values, [input.key]: input.value } };
      this.states.set(ownerId, next);
      try { await this.persist(); } catch (error) { this.states.set(ownerId, previous); throw error; }
      return { revision: next.revision };
    });
    this.metadataQueue = operation.catch(() => {});
    return operation;
  }
  detach(page, ws) {
    if (page.socket !== ws) return;
    page.socket = null;
    // The tab owns the WebContents. Detaching only releases input and video.
    void this.request(page.id, 'visible', { visible: false }).catch(() => {});
  }
  async available() {
    try { await Promise.all([access(this.executable), access(join(this.directory, 'worker.cjs'))]); return process.platform === 'linux'; }
    catch { return false; }
  }
  async start() {
    if (this.closed) throw new Error('Browser service closed');
    if (this.starting) return this.starting;
    this.starting = (async () => {
      await this.load();
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
        for (const p of this.pages.values()) { p.live = false; p.socket?.close(1011, 'Browser process exited; reconnecting'); }
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
    if (message.type === 'error' && message.message === 'Browser renderer exited; reload this tab') this.diagnose('renderer_exited');
    const p = [...this.pages.values()].find(page => page.id === message.page);
    if (p && !p.recovering && message.type === 'navigation' && !message.state.isLoading) { p.url = checkpointUrl(message.state.url); this.checkpoint(); }
    if (p && message.type === 'viewport') { p.viewport = { width: message.width, height: message.height, deviceProfile: message.deviceProfile }; this.checkpoint(); }
    const ws = p?.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 128 * 1024) { ws.close(1013, 'Display behind'); ws.terminate(); return; }
    if (message.type === 'frame') ws.send(Buffer.from(message.bytes, 'base64'), { binary: true });
    else { const { page, ...event } = message; ws.send(JSON.stringify(event)); }
  }
  diagnose(event, method) {
    if (this.diagnosticCount >= 20) return;
    this.diagnosticCount++;
    // Only owned enums and process counters: never request input, actor/page
    // identifiers, URLs, arbitrary native stderr or exception messages.
    console.warn('[opencraft-browser]', JSON.stringify({ event,
      ...(method === 'create' || methods.has(method) ? { method } : {}),
      pendingRequests: this.requests.size }));
  }
  request(page, method, input) {
    if (!this.child || (this.isolated ? this.child.stdin.destroyed : !this.child.connected)) return Promise.reject(new Error('Browser unavailable'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.requests.delete(id); this.diagnose('request_timeout', method); reject(new Error(`Browser operation timed out (${method})`)); }, 20000);
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
          if (message.method === 'state') {
            const value = await this.metadata(ownerId, message.input, authorize); authorize(); reply(message.id, value); return;
          }
          if (message.method === 'discard') {
            if (!/^[a-zA-Z0-9-]{20,128}$/.test(message.input?.lease ?? '')) throw new Error('Invalid browser lease');
            await this.load(); authorize();
            const key = JSON.stringify([ownerId, message.input.lease]), target = this.pages.get(key);
            if (target) {
              this.pages.delete(key); target.socket?.close(1000, 'Browser tab closed');
              if (target.live) await this.request(target.id, 'close');
              await this.persist();
            }
            reply(message.id); return;
          }
          if (message.method === 'open') {
            if (page || opening) throw new Error('Browser already opened');
            opening = true;
            if (!/^[a-zA-Z0-9-]{20,128}$/.test(message.input?.lease ?? '')) throw new Error('Invalid browser lease');
            const key = JSON.stringify([ownerId, message.input.lease]);
            if (this.claims.has(key) && this.claims.get(key) !== ws) throw new Error('Browser page already attached');
            this.claims.set(key, ws); claimKey = key;
            await this.load(); authorize();
            const existing = this.pages.get(key);
            if (existing?.socket && existing.socket !== ws) throw new Error('Browser page already attached');
            if (!existing && (this.pages.size >= 64 || [...this.pages.values()].filter(p => p.ownerId === ownerId).length >= 16)) throw new Error('Browser page limit reached');
            await this.start(); authorize();
            if (ws.readyState !== WebSocket.OPEN) return;
            page = existing ?? { id: createHash('sha256').update(key).digest('hex'), key, ownerId, live: false, viewport: message.input?.viewport, zoom: 100, url: null };
            page.socket = ws; this.pages.set(key, page);
            let config;
            const resumed = page.live, recoveryUrl = page.url, recoveryZoom = page.zoom;
            page.recovering = !resumed && !!existing;
            try {
              config = await this.request(page.id, 'create', message.input?.viewport ?? page.viewport
                ?? { deviceProfile: message.input?.defaultDeviceProfile ?? 'desktop' });
              page.live = true;
              if (!resumed && existing) {
                if (recoveryZoom !== 100) await this.request(page.id, 'zoom', { percent: recoveryZoom });
                if (recoveryUrl) await this.request(page.id, 'navigate', { url: recoveryUrl });
                config = await this.request(page.id, 'snapshot');
                // loadURL has accepted the recovery, but may not have committed
                // its first document yet. Keep the saved remote target as the
                // authority so a viewer's stale initial URL cannot replace it.
                if (recoveryUrl && !checkpointUrl(config.navigation?.url)) {
                  config.navigation = { ...config.navigation, url: recoveryUrl, isLoading: true };
                }
              }
              page.recovering = false; page.url = checkpointUrl(config.navigation?.url) ?? null;
              page.viewport = { width: config.width, height: config.height, deviceProfile: config.deviceProfile };
              await this.persist(); authorize();
              if (ws.readyState !== WebSocket.OPEN) { this.detach(page, ws); return; }
              reply(message.id, { ...config, resumed, restored: !!existing && !resumed });
            } catch (error) {
              page.recovering = false;
              if (!existing) { this.pages.delete(key); void this.request(page.id, 'close').catch(() => {}); }
              else { this.detach(page, ws); if (!resumed) { page.live = false; page.url = recoveryUrl; void this.request(page.id, 'close').catch(() => {}); } }
              page = null; throw error;
            }
            opening = false; return;
          }
          if (!page || this.pages.get(page.key) !== page || !methods.has(message.method)) throw new Error('Browser page not opened');
          // Recheck at execution and before returning a result across async work.
          authorize();
          const target = page;
          const value = await this.request(target.id, message.method, message.input);
          authorize();
          if (page !== target || target.socket !== ws || this.pages.get(target.key) !== target || ws.readyState !== WebSocket.OPEN) return;
          if (message.method === 'close') { this.pages.delete(target.key); page = null; await this.persist(); }
          if (message.method === 'zoom') { target.zoom = Number(message.input.percent); await this.persist(); }
          if (['navigate', 'viewport'].includes(message.method)) await this.persist();
          if (!quietMethods.has(message.method)) reply(message.id, value);
        } catch (error) { opening = false; if (!page && claimKey && this.claims.get(claimKey) === ws) { this.claims.delete(claimKey); claimKey = null; }
          if (message?.id) reply(message.id, null, error); else ws.close(1008, 'Invalid browser request'); }
        finally { pending--; }
      });
      ws.on('close', () => {
        this.sockets.delete(ws);
        if (claimKey && this.claims.get(claimKey) === ws) this.claims.delete(claimKey);
        if (!page || page.socket !== ws) return;
        this.detach(page, ws);
      });
    });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const ws of this.sockets) ws.terminate();
    clearTimeout(this.checkpointTimer);
    if (this.loaded) void this.persist().catch(() => {});
    this.claims.clear();
    for (const request of this.requests.values()) { clearTimeout(request.timer); request.reject(new Error('Browser service closed')); }
    this.requests.clear();
    if (this.isolated) this.child?.stdin.end(); else this.child?.kill();
    this.server.close();
  }
}
