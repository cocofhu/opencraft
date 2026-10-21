import type { BrowserMetadataStorage } from './desktop-browser-storage';
import { H264MediaSource } from './h264-media-source';
import { BrowserAutomationError, type BrowserAutomation, type BrowserDeviceProfile, type BrowserPageId, type BrowserUrl, type BrowserViewportLayout } from '@opencraft/browser-core';
import type { BrowserSurfaceEvents, BrowserSurfaceHost } from './web-browser-surface-host';
import type { PresentationHostPort } from './opencraft-presentation-host';
import { serverStorageKey, serverUrl } from '../runtime/server-context';
import { RemoteBrowserIme } from './remote-browser-ime';
import { BrowserLocalMenuController } from './browser-local-menu';

type Pending = { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };
interface Page {
  media: H264MediaSource | null; video: HTMLVideoElement | null; id: BrowserPageId; lease: string; container: HTMLDivElement; canvas: HTMLCanvasElement; receiver: HTMLTextAreaElement; ime: RemoteBrowserIme | null; editable: boolean; nativeIme: boolean;
  events: BrowserSurfaceEvents; url: BrowserUrl | null | undefined; socket: WebSocket | null;
  restored: boolean; ready: Promise<void>; opened: boolean; closed: boolean; visible: boolean; blocked: boolean;
  pending: Map<string, Pending>; decoder: VideoDecoder | null; latest: VideoFrame | null; raf: number;
  reconnect: ReturnType<typeof setTimeout> | null; connection: number; retries: number; needsKey: boolean;
  viewportMeasured: boolean; width: number; height: number; viewport: { width: number; height: number; deviceProfile?: BrowserDeviceProfile }; sentViewport: string;
  resizeTimer: ReturnType<typeof setTimeout> | null; resizing: boolean;
  nativeCopy: boolean; interaction: number; menuIntent: string | null; automation: BrowserAutomation; resetInput: () => void; inputDispose: () => void;
}
/** Physical pages live on the Server. Canvas is only a presentation consumer;
 * the existing tool host still owns thread/tab authorization and use claims. */
export class RemoteBrowserSurfaceHost implements BrowserSurfaceHost {
  readonly nativeNavigation = true;
  readonly localMenu = new BrowserLocalMenuController();
  private menuOwner: Page | null = null;
  private keyboardListeners = new Set<() => void>();
  onKeyboardState(listener: () => void) { this.keyboardListeners.add(listener); return () => { this.keyboardListeners.delete(listener); }; }
  keyboardState(id: BrowserPageId): 'unavailable' | 'idle' | 'ready' { return !this.pages.get(id)?.nativeIme ? 'unavailable' : this.canShowKeyboard(id) ? 'ready' : 'idle'; }
  canShowKeyboard(id: BrowserPageId) { const p = this.pages.get(id); return !!p && p.nativeIme && p.editable && this.acceptsInput(p); }
  showKeyboard(id: BrowserPageId) {
    const p = this.require(id); if (!this.canShowKeyboard(id)) return;
    // Must stay synchronous inside the local button gesture for mobile WebViews.
    // A canvas touch may already focus the manual receiver. Re-focus after
    // changing policy rather than relying on focus() on an active element.
    if (p.receiver.inputMode !== 'text' && document.activeElement === p.receiver) p.receiver.blur();
    p.receiver.inputMode = 'text'; p.receiver.setAttribute('virtualkeyboardpolicy', 'auto');
    p.receiver.focus({ preventScroll: true });
  }
  private keyboardChanged() { for (const listener of this.keyboardListeners) listener(); }
  private resetKeyboard(p: Page, blur = true) { if (blur || p.receiver.inputMode === 'text') p.receiver.blur(); p.editable = false; p.receiver.inputMode = 'none'; p.receiver.setAttribute('virtualkeyboardpolicy', 'manual'); this.keyboardChanged(); }
  private root: HTMLElement | null = null;
  private storageIds = new Map<BrowserPageId, string>();
  constructor(private readonly storage: BrowserMetadataStorage = localStorage, private readonly storageKey = serverStorageKey('opencraft.remote-browser-storage.v1')) {
    try { for (const [id, storage] of Object.entries(JSON.parse(this.storage.getItem(this.storageKey) || '{}')))
      if (typeof storage === 'string' && /^browser[:-][a-zA-Z0-9-]+$/.test(storage)) this.storageIds.set(id as BrowserPageId, storage); } catch {}
  }
  existingStorageId(id: BrowserPageId) { return this.storageIds.get(id) ?? null; }
  bindStorageId(id: BrowserPageId, storage: string) {
    this.storageIds.set(id, storage); this.persistStorage();
  }
  forget(id: BrowserPageId) { this.storageIds.delete(id); this.persistStorage(); }
  private persistStorage() { try { this.storage.setItem(this.storageKey, JSON.stringify(Object.fromEntries(this.storageIds))); } catch {} }

  private hostIdentities = new Set<BrowserPageId>();
  bindHostIdentity(id: BrowserPageId) { this.hostIdentities.add(id); }
  private pages = new Map<BrowserPageId, Page>();
  private backing: ((id: BrowserPageId) => void) | null = null;
  private inputFailed = false;
  private storageError: Error | null = null;
  private use: ((id: BrowserPageId) => () => void) | null = null;
  private closeListeners = new Set<(id: BrowserPageId) => void>();
  setBackingFactory(factory: ((id: BrowserPageId) => void) | null) { this.backing = factory; }
  setUseFactory(factory: ((id: BrowserPageId) => () => void) | null) { this.use = factory; }
  acquireUse(id: BrowserPageId) { return this.use?.(id) ?? (() => {}); }
  setRoot(root: HTMLElement | null) { this.root = root; if (root) for (const p of this.pages.values()) root.prepend(p.container); else { this.localMenu.retire(); for (const p of this.pages.values()) { p.resetInput(); this.resetKeyboard(p); } } }
  onClose(listener: (id: BrowserPageId) => void) { this.closeListeners.add(listener); return () => { this.closeListeners.delete(listener); }; }
  setZoom(id: BrowserPageId, percent: number) { this.run(this.require(id), 'zoom', { percent }); }
  async capture(id: BrowserPageId): Promise<string> { const p = this.require(id); await p.ready; return this.call(p, 'capture'); }
  async waitUntilReady(id: BrowserPageId) { await this.require(id).ready; }
  presentationPort(id: BrowserPageId): PresentationHostPort {
    const p = this.require(id);
    return { container: p.container, guest: p.receiver, ready: p.ready,
      commit: (layout, visible) => this.commit(id, layout, visible ? 'visible' : 'staged'),
      park: () => this.park(id), close: () => this.release(id, false), clearCover: () => {}, cover: () => {} };
  }
  navigate(id: BrowserPageId, _title: string, url: BrowserUrl | null, events: BrowserSurfaceEvents, force = false): boolean {
    const absent = !this.pages.has(id);
    if (absent && !this.hostIdentities.has(id)) this.backing?.(id);
    const p = this.ensure(id, events); p.events = events;
    if (!force && p.url === url) return absent;
    p.url = url;
    // Capture the requested URL; replacement before connection must not issue
    // an obsolete navigation after the latest one.
    void p.ready.then(() => { if (!p.closed && p.url === url && !(absent && p.restored && !force)) return this.call(p, force ? 'reload' : 'navigate', { url }); })
      .catch(error => { if (!p.closed && p.url === url) p.events.onError(error.message); });
    return true;
  }
  stop(id: BrowserPageId) { this.run(this.require(id), 'stop'); }
  goBack(id: BrowserPageId) { this.run(this.require(id), 'back'); }
  goForward(id: BrowserPageId) { this.run(this.require(id), 'forward'); }
  automation(id: BrowserPageId) { return this.pages.get(id)?.automation ?? null; }
  commit(id: BrowserPageId, layout: BrowserViewportLayout, phase: 'staged' | 'visible') {
    const p = this.require(id), bounds = layout.visualBounds, origin = this.root?.getBoundingClientRect();
    Object.assign(p.container.style, { left: `${bounds.x - (origin?.left ?? 0)}px`, top: `${bounds.y - (origin?.top ?? 0)}px`,
      width: `${bounds.width}px`, height: `${bounds.height}px`, visibility: 'visible', opacity: phase === 'visible' ? '1' : '.001',
      pointerEvents: phase === 'visible' && !p.blocked && !this.inputFailed ? 'auto' : 'none' });
    if (layout.viewportSize.width > 0 && layout.viewportSize.height > 0) {
      p.viewportMeasured = true;
      p.viewport = { width: Math.max(1, Math.round(layout.viewportSize.width)), height: Math.max(1, Math.round(layout.viewportSize.height)), deviceProfile: layout.deviceProfile ?? "desktop" };
      this.queueViewport(p);
    }
    p.blocked = false;
    const visible = phase === 'visible';
    if (p.visible !== visible) { p.visible = visible; this.run(p, 'visible', { visible }); }
  }
  block(id: BrowserPageId) { const p = this.pages.get(id); if (p) { this.retireMenu(p); p.resetInput(); this.run(p, 'input', { type: 'touchCancel' }); p.blocked = true; p.container.style.pointerEvents = 'none'; } }
  park(id: BrowserPageId) {
    const p = this.pages.get(id); if (!p) return;
    this.retireMenu(p);
    p.resetInput(); this.resetKeyboard(p); p.container.style.visibility = 'hidden'; p.container.style.pointerEvents = 'none';
    if (p.visible) { p.visible = false; this.run(p, 'visible', { visible: false }); }
  }
  close(id: BrowserPageId) {
    if (!this.pages.has(id)) { const lease = this.storageIds.get(id); if (lease) this.discard(lease.replace(':', '-')); return; }
    this.release(id, true);
  }
  private release(id: BrowserPageId, destroy: boolean) {
    const p = this.pages.get(id); if (!p || p.closed) return;
    this.retireMenu(p);
    if (destroy) {
      if (p.opened) { try { p.socket?.send(JSON.stringify({ id: crypto.randomUUID(), method: 'close' })); } catch {} }
      else this.discard(p.lease);
    }
    p.closed = true; if (p.reconnect) clearTimeout(p.reconnect); if (p.resizeTimer) clearTimeout(p.resizeTimer);
    p.inputDispose(); p.socket?.close(); this.resetDecoder(p);
    this.rejectPending(p); p.container.remove(); this.pages.delete(id); this.hostIdentities.delete(id);
    if (destroy) for (const listener of this.closeListeners) listener(id);
  }
  private discard(lease: string) {
    const url = new URL(serverUrl('/__opencraft_browser/stream'), location.href); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url), timer = setTimeout(() => ws.close(), 20000);
    ws.onopen = () => ws.send(JSON.stringify({ id: crypto.randomUUID(), method: 'discard', input: { lease } }));
    ws.onmessage = () => ws.close(); ws.onerror = () => ws.close(); ws.onclose = () => clearTimeout(timer);
  }
  dispose() { for (const id of [...this.pages.keys()]) this.release(id, false); this.root = null; }
  fail(error: Error) { this.inputFailed = true; this.storageError = error; for (const p of this.pages.values()) { p.blocked = true; p.resetInput(); this.resetKeyboard(p); p.container.style.pointerEvents = 'none'; p.events.onError(error.message); } }
  private require(id: BrowserPageId) { const p = this.pages.get(id); if (!p) throw new Error('Browser page closed'); return p; }
  private ensure(id: BrowserPageId, events: BrowserSurfaceEvents): Page {
    const old = this.pages.get(id); if (old) return old;
    const container = document.createElement('div'); container.className = 'web-browser-surface'; container.dataset.browserPageId = id;
    Object.assign(container.style, { visibility: 'hidden', overflow: 'hidden', background: 'var(--background, #fff)' });
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720; canvas.tabIndex = -1;
    const receiver = document.createElement('textarea'); receiver.tabIndex = 0; receiver.className = 'ui-text--mobile-input';
    receiver.setAttribute('aria-label', 'Remote browser keyboard input'); receiver.spellcheck = false;
    receiver.autocomplete = 'off'; receiver.setAttribute('autocorrect', 'off'); receiver.autocapitalize = 'none';
    receiver.inputMode = 'none'; receiver.setAttribute('virtualkeyboardpolicy', 'manual');
    Object.assign(receiver.style, { position: 'absolute', left: '0', top: '0', width: '1px', height: '1px',
      opacity: '0', padding: '0', border: '0', pointerEvents: 'none', resize: 'none' });
    canvas.setAttribute('aria-label', 'Browser page'); canvas.dataset.browserPageId = id;
    Object.assign(canvas.style, { width: '100%', height: '100%', objectFit: 'contain', outline: 'none', touchAction: 'none' });
    container.append(canvas, receiver); this.root?.prepend(container);
    const p: Page = { media: null, video: null, id, lease: (this.storageIds.get(id) ?? ('browser-' + crypto.randomUUID())).replace(':', '-'), container, canvas, receiver, ime: null, editable: false, nativeIme: false, events, url: undefined, socket: null,
      nativeCopy: false, interaction: 0, menuIntent: null, restored: false, ready: Promise.resolve(), opened: false, closed: false, visible: false, blocked: false, pending: new Map(), decoder: null,
      viewportMeasured: false, width: 1280, height: 720, viewport: { width: 1280, height: 720 }, sentViewport: '', resizeTimer: null, resizing: false,
      latest: null, raf: 0, reconnect: null, connection: 0, retries: 0, needsKey: true, automation: null!, resetInput: () => {}, inputDispose: () => {} };
    if (!this.storageIds.has(id)) { this.storageIds.set(id, p.lease); this.persistStorage(); }
    const call = async (method: string, input?: unknown) => { await p.ready; return this.call(p, 'automation', { method, input }); };
    p.automation = {
      capabilities: { protocolVersion: 1, backend: 'preview-bridge', domInspection: true, semanticInput: true, trustedInput: false,
        networkObservation: 'fetch-xhr', screenshot: true, deviceEmulation: 'full' },
      readContext: input => call('readContext', input), inspect: () => call('inspect'), click: input => call('click', input),
      fill: input => call('fill', input), press: input => call('press', input), scroll: input => call('scroll', input),
      wait: input => call('wait', input), dispose: () => {} };
    this.pages.set(id, p); if (this.storageError) p.events.onError(this.storageError.message); p.inputDispose = this.bindInput(p);
    p.ready = this.connect(p); void p.ready.catch(error => { if (!p.closed) p.events.onError(error.message); });
    return p;
  }
  private rejectPending(p: Page) { for (const request of p.pending.values()) { clearTimeout(request.timer); request.reject(new BrowserAutomationError('PAGE_CLOSED', 'Browser disconnected', true)); } p.pending.clear(); }
  private connect(p: Page): Promise<void> {
    const generation = ++p.connection;
    return new Promise((resolve, reject) => {
      const url = new URL(serverUrl('/__opencraft_browser/stream'), location.href); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(url); ws.binaryType = 'arraybuffer'; p.socket = ws;
      const timer = setTimeout(() => { reject(new Error('Browser connection timed out')); ws.close(); }, 20000);
      const current = () => !p.closed && p.connection === generation;
      ws.onopen = () => { if (!current()) return;
        const viewport = p.viewportMeasured ? { ...p.viewport } : undefined;
        void this.call(p, 'open', { lease: p.lease, viewport }).then(async config => {
          if (!current()) return; p.restored = (config.resumed || config.restored) && !!config.navigation?.url && config.navigation.url !== 'about:blank'; p.nativeCopy = config.nativeCopy === true; p.nativeIme = config.nativeIme === true; this.keyboardChanged(); this.applyViewport(p, config);
          const effective = { width: config.width, height: config.height, deviceProfile: config.deviceProfile };
          if (!p.viewportMeasured) p.viewport = effective;
          p.sentViewport = JSON.stringify(viewport ?? effective); p.opened = true; p.retries = 0; clearTimeout(timer); resolve();
          if (p.restored && config.navigation) { p.events.onNavigation?.(config.navigation); if (!config.navigation.isLoading) p.events.onLoaded(config.navigation.title || null); if (config.navigation.url) p.url = config.navigation.url; }
          if (generation > 1 && !p.restored) await this.call(p, 'navigate', { url: p.url ?? null });
          this.queueViewport(p); this.run(p, 'visible', { visible: p.visible });
        }).catch(error => { clearTimeout(timer); reject(error); p.events.onError(error.message); ws.close(1000); });
      };
      ws.onmessage = event => {
        if (!current()) return;
        if (typeof event.data !== 'string') { this.decode(p, event.data); return; }
        const message = JSON.parse(event.data);
        if (message.type === 'result') {
          const request = p.pending.get(message.id); if (!request) return;
          p.pending.delete(message.id); clearTimeout(request.timer);
          message.error ? request.reject(new BrowserAutomationError(message.error.code, message.error.message, message.error.retryable)) : request.resolve(message.value);
        } else if (message.type === 'navigation') {
          if (message.state.isLoading) { this.retireMenu(p); p.resetInput(); this.resetKeyboard(p); }
          p.events.onNavigation?.(message.state);
          if (!message.state.isLoading) { if (message.state.url && message.state.url !== 'about:blank') p.url = message.state.url; p.events.onLoaded(message.state.title || null); }
        } else if (message.type === 'viewport') this.applyViewport(p, message);
        else if (message.type === 'ime-state') {
          p.editable = message.editable === true; this.keyboardChanged();
          if (!p.editable) { p.ime?.retire(); this.resetKeyboard(p, false); }
          const b = message.caret, r = p.canvas.getBoundingClientRect();
          if (b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.height)) {
            const scale = Math.min(r.width / p.width, r.height / p.height);
            p.receiver.style.left = `${Math.max(0, Math.min(r.width - 1, (r.width - p.width * scale) / 2 + b.x * scale))}px`;
            p.receiver.style.top = `${Math.max(0, Math.min(r.height - 1, (r.height - p.height * scale) / 2 + (b.y + b.height) * scale))}px`;
          }
        }
        else if (message.type === 'context-menu') this.showMenu(p, message);
        else if (message.type === 'cursor' && typeof message.cursor === 'string' && /^[a-z-]+$/.test(message.cursor)) p.canvas.style.cursor = message.cursor;
        else if (message.type === 'new-window') p.events.onNewWindow?.(message.url, false);
        else if (message.type === 'error') p.events.onError(message.message);
      };
      ws.onerror = () => {}; // close owns recovery and pending rejection.
      ws.onclose = event => {
        clearTimeout(timer); reject(new Error('Browser connection closed'));
        if (!current()) return;
        this.retireMenu(p);
        p.resetInput(); this.resetKeyboard(p); p.opened = false; if (p.resizeTimer) clearTimeout(p.resizeTimer); p.resizeTimer = null; p.resizing = false; this.rejectPending(p); this.resetDecoder(p);
        if (event.code === 1000 || event.code === 1008 || p.retries >= 5) { p.events.onError('Browser disconnected; reload this tab'); return; }
        p.reconnect = setTimeout(() => { p.ready = this.connect(p); void p.ready.catch(() => {}); }, Math.min(5000, 250 * 2 ** p.retries++));
      };
    });
  }
  private applyViewport(p: Page, config: { width: number; height: number }) {
    if (!Number.isInteger(config.width) || !Number.isInteger(config.height) || config.width < 1 || config.height < 1) return;
    if (p.width === config.width && p.height === config.height) return;
    this.resetDecoder(p); p.width = p.canvas.width = config.width; p.height = p.canvas.height = config.height;
  }
  private retireMenu(p: Page) { ++p.interaction; p.menuIntent = null; if (this.menuOwner === p) { this.menuOwner = null; this.localMenu.retire(); } }
  private acceptsInput(p: Page) {
    return this.root !== null && !p.closed && !this.inputFailed && !p.blocked && p.visible && p.opened && p.container.style.pointerEvents !== 'none';
  }
  private copyCurrent(p: Page) {
    this.menuOwner = p;
    const connection = p.connection, interaction = p.interaction;
    const current = () => this.acceptsInput(p) && p.connection === connection && p.interaction === interaction;
    this.localMenu.copy(() => this.call(p, 'copy'), current, message => p.events.onError(message));
  }
  private showMenu(p: Page, menu: { intent?: unknown; context?: unknown; x?: unknown; y?: unknown; copy?: unknown; link?: unknown }) {
    if (!this.acceptsInput(p) || typeof menu.x !== 'number' || !Number.isFinite(menu.x)
      || typeof menu.y !== 'number' || !Number.isFinite(menu.y) || !p.menuIntent || menu.intent !== p.menuIntent) return;
    const context = typeof menu.context === 'string' && /^[a-zA-Z0-9-]{20,100}$/.test(menu.context) ? menu.context : undefined;
    let link: string | undefined;
    try { const url = new URL(String(menu.link)); if (['https:', 'http:'].includes(url.protocol) && url.href.length <= 16384) link = url.href; } catch {}
    const copy = p.nativeCopy && menu.copy === true && context !== undefined;
    if (!copy && !link) return;
    const connection = p.connection, interaction = p.interaction;
    const current = () => this.acceptsInput(p) && p.connection === connection && p.interaction === interaction;
    const r = p.canvas.getBoundingClientRect(), scale = Math.min(r.width / p.width, r.height / p.height);
    this.menuOwner = p;
    this.localMenu.open({ copy, link: link !== undefined,
      x: r.left + (r.width - p.width * scale) / 2 + menu.x * scale,
      y: r.top + (r.height - p.height * scale) / 2 + menu.y * scale,
      current, run: action => action === 'copy' ? this.call(p, 'copy', { context }) : Promise.resolve({ text: link! }),
      focus: () => { if (current()) p.receiver.focus({ preventScroll: true }); }, error: message => p.events.onError(message) });
  }
  private queueViewport(p: Page) {
    if (p.closed || !p.opened || p.resizing || p.resizeTimer || p.sentViewport === JSON.stringify(p.viewport)) return;
    // Existing presentation geometry owns resize. Bound reconfiguration to one
    // in flight plus the latest pending size; keep updating during held drags.
    const connection = p.connection;
    p.resizeTimer = setTimeout(() => {
      p.resizeTimer = null; if (p.closed || !p.opened || connection !== p.connection) return;
      const viewport = { ...p.viewport }; p.resizing = true;
      void this.call(p, 'viewport', viewport).then(() => {
        if (connection === p.connection) p.sentViewport = JSON.stringify(viewport);
      }).catch(error => { if (!p.closed && connection === p.connection) { p.sentViewport = JSON.stringify(viewport); p.events.onError(error.message); } })
        .finally(() => { if (connection === p.connection) { p.resizing = false; this.queueViewport(p); } });
    }, 100);
  }
  private call(p: Page, method: string, input?: unknown): Promise<any> {
    if (p.closed || p.socket?.readyState !== WebSocket.OPEN) return Promise.reject(new BrowserAutomationError('PAGE_CLOSED', 'Browser disconnected', true));
    const id = crypto.randomUUID();
    if (['input','text','visible','keyframe'].includes(method)) { p.socket.send(JSON.stringify({ id, method, input })); return Promise.resolve(); }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { p.pending.delete(id); reject(new Error('Browser operation timed out')); }, method === 'navigate' ? 50000 : 25000);
      p.pending.set(id, { resolve, reject, timer }); p.socket!.send(JSON.stringify({ id, method, input }));
    });
  }
  private run(p: Page, method: string, input?: unknown) { void p.ready.then(() => this.call(p, method, input)).catch(error => { if (!p.closed) p.events.onError(error.message); }); }
  private resetDecoder(p: Page) { if (p.decoder && p.decoder.state !== 'closed') p.decoder.close(); p.decoder = null; p.media?.dispose(); p.media = null; p.video?.remove(); p.video = null; p.latest?.close(); p.latest = null; cancelAnimationFrame(p.raf); p.raf = 0; p.needsKey = true; }
  private decode(p: Page, bytes: ArrayBuffer) {
    if (bytes.byteLength < 10) return;
    if (typeof VideoDecoder === 'undefined' || typeof EncodedVideoChunk === 'undefined') {
      if (!p.media) {
        const video = document.createElement('video');
        Object.assign(video.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' });
        p.canvas.style.position = 'relative'; p.container.prepend(video); p.video = video;
        p.media = new H264MediaSource(video, p.width, p.height, () => { this.resetDecoder(p); this.run(p, 'keyframe'); }, () => this.run(p, 'keyframe'));
      }
      p.media.push(bytes);
    } else {
      const data = new Uint8Array(bytes), key = data[0] === 1;
      const recover = () => { this.resetDecoder(p); this.run(p, 'keyframe'); };
      if (p.decoder && p.decoder.decodeQueueSize > 2) { recover(); return; }
      if (p.needsKey && !key) return;
      if (!p.decoder) {
        const decoder = new VideoDecoder({ output: frame => {
          if (p.closed || p.decoder !== decoder) { frame.close(); return; }
          p.latest?.close(); p.latest = frame;
          if (!p.raf) p.raf = requestAnimationFrame(() => { p.raf = 0; const latest = p.latest; p.latest = null;
            if (latest) { p.canvas.getContext('2d', { alpha: false })?.drawImage(latest, 0, 0, p.width, p.height); latest.close(); } });
        }, error: recover });
        p.decoder = decoder;
        p.decoder.configure({ codec: 'avc1.42E028', optimizeForLatency: true });
      }
      p.needsKey = false;
      try { p.decoder.decode(new EncodedVideoChunk({ type: key ? 'key' : 'delta', timestamp: Number(new DataView(bytes).getBigUint64(1)), data: data.subarray(9) })); }
      catch { recover(); }
    }
  }
  private bindInput(p: Page) {
    const canvas = p.canvas, receiver = p.receiver, cleanup: (() => void)[] = [];
    const listen = (name: string, handler: (event: any) => void, options?: AddEventListenerOptions) => { canvas.addEventListener(name, handler, options); cleanup.push(() => canvas.removeEventListener(name, handler, options)); };
    const modifiers = (event: MouseEvent | KeyboardEvent) => [event.shiftKey && 'shift', event.ctrlKey && 'control', event.altKey && 'alt', event.metaKey && 'meta'].filter(Boolean);
    const point = (event: MouseEvent) => { const r = canvas.getBoundingClientRect(), scale = Math.min(r.width / p.width, r.height / p.height);
      return { x: Math.round((event.clientX - r.left - (r.width - p.width * scale) / 2) / scale), y: Math.round((event.clientY - r.top - (r.height - p.height * scale) / 2) / scale) }; };
    const send = (input: unknown) => { if (!p.closed && !this.inputFailed && !p.blocked && p.visible && p.container.style.pointerEvents !== 'none' && p.opened) void this.call(p, 'input', input).catch(() => {}); };
    let move: PointerEvent | null = null, raf = 0;
    const captured = new Set<number>();
    const flushMove = () => {
      cancelAnimationFrame(raf); raf = 0;
      if (move) { send({ type: 'mouseMove', ...point(move), modifiers: [...modifiers(move), ...(move.buttons & 1 ? ['leftButtonDown'] : [])] }); move = null; }
    };
    listen('pointermove', (event: PointerEvent) => { move = event; if (!raf) raf = requestAnimationFrame(flushMove); });
    listen('pointerdown', (event: PointerEvent) => { event.preventDefault(); flushMove(); p.ime?.retire(); receiver.focus({ preventScroll: true }); captured.add(event.pointerId); canvas.setPointerCapture(event.pointerId);
      this.retireMenu(p); p.menuIntent = crypto.randomUUID();
      send({ type: 'mouseDown', ...point(event), menuIntent: p.menuIntent, button: ['left','middle','right'][event.button], clickCount: event.detail || 1, modifiers: modifiers(event) }); });
    listen('pointerup', (event: PointerEvent) => { flushMove(); send({ type: 'mouseUp', ...point(event), button: ['left','middle','right'][event.button], clickCount: event.detail || 1, modifiers: modifiers(event) }); captured.delete(event.pointerId); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); });
    const cancel = () => { move = null; cancelAnimationFrame(raf); raf = 0; captured.clear(); send({ type: 'touchCancel' }); };
    listen('pointercancel', cancel);
    listen('lostpointercapture', (event: PointerEvent) => { if (captured.has(event.pointerId)) cancel(); });
    listen('contextmenu', event => event.preventDefault());
    listen('wheel', (event: WheelEvent) => { event.preventDefault(); this.retireMenu(p); send({ type: 'mouseWheel', ...point(event), deltaX: -event.deltaX, deltaY: -event.deltaY, modifiers: modifiers(event) }); }, { passive: false });
    const ime = p.ime = new RemoteBrowserIme(receiver, input => this.call(p, 'ime', input),
      () => this.acceptsInput(p), message => p.events.onError(message));
    const textListen = (name: string, handler: (event: any) => void) => { receiver.addEventListener(name, handler); cleanup.push(() => receiver.removeEventListener(name, handler)); };
    p.resetInput = () => { move = null; cancelAnimationFrame(raf); raf = 0; captured.clear(); ime.retire(); };
    textListen('blur', () => { cancel(); p.resetInput(); receiver.inputMode = 'none'; receiver.setAttribute('virtualkeyboardpolicy', 'manual'); });
    textListen('compositionstart', () => ime.start());
    textListen('compositionupdate', (event: CompositionEvent) => ime.update(event.data));
    textListen('compositionend', (event: CompositionEvent) => ime.end(event.data));
    textListen('beforeinput', (event: InputEvent) => {
      if (ime.composing || event.isComposing || event.inputType.includes('Composition') || !this.acceptsInput(p)) return;
      if (!event.cancelable) return; // Non-cancelable mobile edits are read once in input.
      if (event.inputType === 'insertText' && event.data) { event.preventDefault(); ime.commit(event.data); }
      else if (['deleteContentBackward', 'deleteContentForward', 'insertLineBreak', 'insertParagraph'].includes(event.inputType)) {
        event.preventDefault(); const keyCode = event.inputType === 'deleteContentBackward' ? 'Backspace' : event.inputType === 'deleteContentForward' ? 'Delete' : 'Return';
        send({ type: 'keyDown', keyCode }); send({ type: 'keyUp', keyCode });
      }
    });
    textListen('input', (event: InputEvent) => {
      if (ime.composing || event.isComposing) return;
      const text = receiver.value; receiver.value = '';
      if (text && this.acceptsInput(p)) ime.commit(text);
    });
    textListen('paste', (event: ClipboardEvent) => { event.preventDefault(); const text = event.clipboardData?.getData('text/plain'); if (text && this.acceptsInput(p)) ime.commit(text.slice(0, 10000)); });
    const keys: Record<string, string> = { ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', ' ': 'Space' };
    textListen('keydown', (event: KeyboardEvent) => { if (ime.composing || event.isComposing || ['Process', 'Unidentified'].includes(event.key) || event.keyCode === 229) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        if (!event.repeat && this.acceptsInput(p)) {
          if (p.nativeCopy) this.copyCurrent(p); else p.events.onError('This browser runtime does not support copying yet');
        }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') return;
      this.retireMenu(p);
      if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) p.menuIntent = crypto.randomUUID();
      event.preventDefault(); send({ type: 'keyDown', keyCode: keys[event.key] || event.key, menuIntent: p.menuIntent, modifiers: modifiers(event) });
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) send({ type: 'char', keyCode: event.key }); });
    textListen('keyup', (event: KeyboardEvent) => { if (ime.composing || event.isComposing || ['Process', 'Unidentified'].includes(event.key) || event.keyCode === 229) return; if ((event.ctrlKey || event.metaKey) && ['c', 'v'].includes(event.key.toLowerCase())) return; event.preventDefault(); send({ type: 'keyUp', keyCode: keys[event.key] || event.key, modifiers: modifiers(event) }); });
    return () => { p.resetInput(); cleanup.forEach(dispose => dispose()); };
  }
}
