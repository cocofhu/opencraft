import { H264MediaSource } from './h264-media-source';
import { BrowserAutomationError, type BrowserAutomation, type BrowserPageId, type BrowserUrl, type BrowserViewportLayout } from '@opencraft/browser-core';
import type { BrowserSurfaceEvents, BrowserSurfaceHost } from './web-browser-surface-host';
import type { PresentationHostPort } from './opencraft-presentation-host';
import { serverStorageKey, serverUrl } from '../runtime/server-context';

type Pending = { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };
interface Page {
  media: H264MediaSource | null; video: HTMLVideoElement | null; id: BrowserPageId; lease: string; container: HTMLDivElement; canvas: HTMLCanvasElement;
  events: BrowserSurfaceEvents; url: BrowserUrl | null | undefined; socket: WebSocket | null;
  ready: Promise<void>; opened: boolean; closed: boolean; visible: boolean; blocked: boolean;
  pending: Map<string, Pending>; decoder: VideoDecoder | null; latest: VideoFrame | null; raf: number;
  reconnect: ReturnType<typeof setTimeout> | null; connection: number; retries: number; needsKey: boolean;
  automation: BrowserAutomation; inputDispose: () => void;
}
/** Physical pages live on the Server. Canvas is only a presentation consumer;
 * the existing tool host still owns thread/tab authorization and use claims. */
export class RemoteBrowserSurfaceHost implements BrowserSurfaceHost {
  readonly nativeNavigation = true;
  private root: HTMLElement | null = null;
  private storageIds = new Map<BrowserPageId, string>();
  constructor() {
    try { for (const [id, storage] of Object.entries(JSON.parse(localStorage.getItem(serverStorageKey('opencraft.remote-browser-storage.v1')) || '{}')))
      if (typeof storage === 'string' && /^browser[:-][a-zA-Z0-9-]+$/.test(storage)) this.storageIds.set(id as BrowserPageId, storage); } catch {}
  }
  existingStorageId(id: BrowserPageId) { return this.storageIds.get(id) ?? null; }
  bindStorageId(id: BrowserPageId, storage: string) {
    this.storageIds.set(id, storage); this.persistStorage();
  }
  forget(id: BrowserPageId) { this.storageIds.delete(id); this.persistStorage(); }
  private persistStorage() { try { localStorage.setItem(serverStorageKey('opencraft.remote-browser-storage.v1'), JSON.stringify(Object.fromEntries(this.storageIds))); } catch {} }

  private hostIdentities = new Set<BrowserPageId>();
  bindHostIdentity(id: BrowserPageId) { this.hostIdentities.add(id); }
  private pages = new Map<BrowserPageId, Page>();
  private backing: ((id: BrowserPageId) => void) | null = null;
  private use: ((id: BrowserPageId) => () => void) | null = null;
  private closeListeners = new Set<(id: BrowserPageId) => void>();
  setBackingFactory(factory: ((id: BrowserPageId) => void) | null) { this.backing = factory; }
  setUseFactory(factory: ((id: BrowserPageId) => () => void) | null) { this.use = factory; }
  acquireUse(id: BrowserPageId) { return this.use?.(id) ?? (() => {}); }
  setRoot(root: HTMLElement | null) { this.root = root; if (root) for (const p of this.pages.values()) root.prepend(p.container); }
  onClose(listener: (id: BrowserPageId) => void) { this.closeListeners.add(listener); return () => { this.closeListeners.delete(listener); }; }
  setZoom(id: BrowserPageId, percent: number) { this.run(this.require(id), 'zoom', { percent }); }
  async capture(id: BrowserPageId): Promise<string> { const p = this.require(id); await p.ready; return this.call(p, 'capture'); }
  async waitUntilReady(id: BrowserPageId) { await this.require(id).ready; }
  presentationPort(id: BrowserPageId): PresentationHostPort {
    const p = this.require(id);
    return { container: p.container, guest: p.canvas, ready: p.ready,
      commit: (layout, visible) => this.commit(id, layout, visible ? 'visible' : 'staged'),
      park: () => this.park(id), close: () => this.close(id), clearCover: () => {}, cover: () => {} };
  }
  navigate(id: BrowserPageId, _title: string, url: BrowserUrl | null, events: BrowserSurfaceEvents, force = false): boolean {
    const absent = !this.pages.has(id);
    if (absent && !this.hostIdentities.has(id)) this.backing?.(id);
    const p = this.ensure(id, events); p.events = events;
    if (!force && p.url === url) return absent;
    p.url = url;
    // Capture the requested URL; replacement before connection must not issue
    // an obsolete navigation after the latest one.
    void p.ready.then(() => { if (!p.closed && p.url === url) return this.call(p, force ? 'reload' : 'navigate', { url }); })
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
      pointerEvents: phase === 'visible' && !p.blocked ? 'auto' : 'none' });
    p.blocked = false;
    const visible = phase === 'visible';
    if (p.visible !== visible) { p.visible = visible; this.run(p, 'visible', { visible }); }
  }
  block(id: BrowserPageId) { const p = this.pages.get(id); if (p) { p.blocked = true; p.container.style.pointerEvents = 'none'; } }
  park(id: BrowserPageId) {
    const p = this.pages.get(id); if (!p) return;
    p.container.style.visibility = 'hidden'; p.container.style.pointerEvents = 'none';
    if (p.visible) { p.visible = false; this.run(p, 'visible', { visible: false }); }
  }
  close(id: BrowserPageId) {
    const p = this.pages.get(id); if (!p || p.closed) return;
    if (p.opened) { try { p.socket?.send(JSON.stringify({ id: crypto.randomUUID(), method: 'close' })); } catch {} }
    p.closed = true; if (p.reconnect) clearTimeout(p.reconnect);
    p.inputDispose(); p.socket?.close(); this.resetDecoder(p);
    this.rejectPending(p); p.container.remove(); this.pages.delete(id); this.hostIdentities.delete(id);
    for (const listener of this.closeListeners) listener(id);
  }
  dispose() { for (const id of [...this.pages.keys()]) this.close(id); this.root = null; }
  private require(id: BrowserPageId) { const p = this.pages.get(id); if (!p) throw new Error('Browser page closed'); return p; }
  private ensure(id: BrowserPageId, events: BrowserSurfaceEvents): Page {
    const old = this.pages.get(id); if (old) return old;
    const container = document.createElement('div'); container.className = 'web-browser-surface'; container.dataset.browserPageId = id;
    Object.assign(container.style, { visibility: 'hidden', overflow: 'hidden', background: 'var(--background, #fff)' });
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720; canvas.tabIndex = 0; canvas.contentEditable = 'true'; canvas.spellcheck = false;
    canvas.setAttribute('aria-label', 'Browser page'); canvas.dataset.browserPageId = id;
    Object.assign(canvas.style, { width: '100%', height: '100%', objectFit: 'contain', outline: 'none', touchAction: 'none' });
    container.append(canvas); this.root?.prepend(container);
    const p: Page = { media: null, video: null, id, lease: (this.storageIds.get(id) ?? ('browser-' + crypto.randomUUID())).replace(':', '-'), container, canvas, events, url: undefined, socket: null,
      ready: Promise.resolve(), opened: false, closed: false, visible: false, blocked: false, pending: new Map(), decoder: null,
      latest: null, raf: 0, reconnect: null, connection: 0, retries: 0, needsKey: true, automation: null!, inputDispose: () => {} };
    const call = async (method: string, input?: unknown) => { await p.ready; return this.call(p, 'automation', { method, input }); };
    p.automation = {
      capabilities: { protocolVersion: 1, backend: 'preview-bridge', domInspection: true, semanticInput: true, trustedInput: false,
        networkObservation: 'fetch-xhr', screenshot: true, deviceEmulation: 'none' },
      readContext: input => call('readContext', input), inspect: () => call('inspect'), click: input => call('click', input),
      fill: input => call('fill', input), press: input => call('press', input), scroll: input => call('scroll', input),
      wait: input => call('wait', input), dispose: () => {} };
    this.pages.set(id, p); p.inputDispose = this.bindInput(p);
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
        void this.call(p, 'open', { lease: p.lease }).then(async config => {
          if (!current()) return; p.opened = true; p.retries = 0; clearTimeout(timer); resolve();
          if (generation > 1 && !config.resumed) await this.call(p, 'navigate', { url: p.url ?? null });
          this.run(p, 'visible', { visible: p.visible });
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
          p.events.onNavigation?.(message.state);
          if (!message.state.isLoading) { if (message.state.url && message.state.url !== 'about:blank') p.url = message.state.url; p.events.onLoaded(message.state.title || null); }
        } else if (message.type === 'cursor' && typeof message.cursor === 'string' && /^[a-z-]+$/.test(message.cursor)) p.canvas.style.cursor = message.cursor;
        else if (message.type === 'new-window') p.events.onNewWindow?.(message.url, false);
        else if (message.type === 'error') p.events.onError(message.message);
      };
      ws.onerror = () => {}; // close owns recovery and pending rejection.
      ws.onclose = event => {
        clearTimeout(timer); reject(new Error('Browser connection closed'));
        if (!current()) return;
        p.opened = false; this.rejectPending(p); this.resetDecoder(p);
        if (event.code === 1000 || event.code === 1008 || p.retries >= 5) { p.events.onError('Browser disconnected; reload this tab'); return; }
        p.reconnect = setTimeout(() => { p.ready = this.connect(p); void p.ready.catch(() => {}); }, Math.min(5000, 250 * 2 ** p.retries++));
      };
    });
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
        p.media = new H264MediaSource(video, () => { this.resetDecoder(p); this.run(p, 'keyframe'); }, () => this.run(p, 'keyframe'));
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
            if (latest) { p.canvas.getContext('2d', { alpha: false })?.drawImage(latest, 0, 0, 1280, 720); latest.close(); } });
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
    const canvas = p.canvas, cleanup: (() => void)[] = [];
    const listen = (name: string, handler: (event: any) => void, options?: AddEventListenerOptions) => { canvas.addEventListener(name, handler, options); cleanup.push(() => canvas.removeEventListener(name, handler, options)); };
    const modifiers = (event: MouseEvent | KeyboardEvent) => [event.shiftKey && 'shift', event.ctrlKey && 'control', event.altKey && 'alt', event.metaKey && 'meta'].filter(Boolean);
    const point = (event: MouseEvent) => { const r = canvas.getBoundingClientRect(), scale = Math.min(r.width / 1280, r.height / 720);
      return { x: Math.round((event.clientX - r.left - (r.width - 1280 * scale) / 2) / scale), y: Math.round((event.clientY - r.top - (r.height - 720 * scale) / 2) / scale) }; };
    const send = (input: unknown) => { if (!p.closed && !p.blocked && p.visible && p.container.style.pointerEvents !== 'none' && p.opened) void this.call(p, 'input', input).catch(() => {}); };
    let move: PointerEvent | null = null, raf = 0;
    listen('pointermove', (event: PointerEvent) => { move = event; if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (move) send({ type: 'mouseMove', ...point(move), modifiers: [...modifiers(move), ...(move.buttons & 1 ? ['leftButtonDown'] : [])] }); }); });
    listen('pointerdown', (event: PointerEvent) => { event.preventDefault(); canvas.focus(); canvas.setPointerCapture(event.pointerId);
      send({ type: 'mouseDown', ...point(event), button: ['left','middle','right'][event.button], clickCount: event.detail || 1, modifiers: modifiers(event) }); });
    listen('pointerup', (event: PointerEvent) => { send({ type: 'mouseUp', ...point(event), button: ['left','middle','right'][event.button], clickCount: event.detail || 1, modifiers: modifiers(event) }); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); });
    listen('contextmenu', event => event.preventDefault());
    listen('wheel', (event: WheelEvent) => { event.preventDefault(); send({ type: 'mouseWheel', ...point(event), deltaX: -event.deltaX, deltaY: -event.deltaY, modifiers: modifiers(event) }); }, { passive: false });
    let composing = false;
    listen('compositionstart', () => { composing = true; });
    listen('compositionend', (event: CompositionEvent) => { composing = false; if (p.visible && p.container.style.pointerEvents !== 'none') this.run(p, 'text', { text: event.data }); canvas.textContent = ''; });
    listen('paste', (event: ClipboardEvent) => { event.preventDefault(); const text = event.clipboardData?.getData('text/plain'); if (text && p.visible && p.container.style.pointerEvents !== 'none') this.run(p, 'text', { text: text.slice(0, 10000) }); });
    const keys: Record<string, string> = { ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', ' ': 'Space' };
    listen('keydown', (event: KeyboardEvent) => { if (composing || event.isComposing || event.key === 'Process') return; if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') return; event.preventDefault(); send({ type: 'keyDown', keyCode: keys[event.key] || event.key, modifiers: modifiers(event) });
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) send({ type: 'char', keyCode: event.key }); });
    listen('keyup', (event: KeyboardEvent) => { if (composing || event.isComposing || event.key === 'Process') return; if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') return; event.preventDefault(); send({ type: 'keyUp', keyCode: keys[event.key] || event.key, modifiers: modifiers(event) }); });
    return () => { cancelAnimationFrame(raf); cleanup.forEach(dispose => dispose()); };
  }
}
