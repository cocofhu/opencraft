import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteBrowserSurfaceHost } from '../apps/workbench-web/src/browser/remote-browser-surface-host';
import type { BrowserPageId } from '@opencraft/browser-core';

test('transferred viewer stops retries and implicit navigation; explicit reload takes over', async t => {
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    static OPEN = 1;
    readyState = 1; sent: any[] = [];
    onopen?: () => void; onclose?: (event: { code: number }) => void; onmessage?: (event: { data: string }) => void;
    constructor(_url: URL) { sockets.push(this); }
    send(value: string) { this.sent.push(JSON.parse(value)); }
    close(code = 1000) { if (this.readyState === 3) return; this.readyState = 3; this.onclose?.({ code }); }
    result() { this.onmessage?.({ data: JSON.stringify({ type: 'result', id: this.sent[0].id, value: {
      width: 430, height: 932, deviceProfile: 'iphone', resumed: true,
      navigation: { url: 'https://example.test/live', title: 'Live', isLoading: false },
    } }) }); }
  }
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const originals = new Map(['WebSocket', 'window', 'location'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: FakeSocket });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { href: 'https://example.test/' } });
  const errors: string[] = [], events = { onError: (value: string) => errors.push(value), onLoaded() {}, onNavigation() {} };
  const host: any = new RemoteBrowserSurfaceHost({ getItem: () => null, setItem() {} }, 'proof');
  const id = 'page-owned' as BrowserPageId;
  const p: any = { lease: 'browser-12345678901234567890', connection: 0, closed: false, displaced: false,
    viewportMeasured: false, pending: new Map(), retries: 0, events, visible: true,
    navigation: 0, url: 'https://example.test/live' };
  // Exercise real connection and navigation; media/DOM teardown is independent.
  host.resetTransport = (page: any) => { host.rejectPending(page); page.opened = false; };
  host.keyboardChanged = host.applyViewport = host.queueViewport = host.run = () => {};
  host.pages.set(id, p);
  try {
    p.ready = host.connect(p); sockets[0].onopen?.();
    assert.equal(sockets[0].sent[0].input.takeover, true);
    sockets[0].result(); await p.ready;
    sockets[0].close(4009);
    assert.equal(p.displaced, true); assert.equal(p.disconnected, true);
    t.mock.timers.tick(60000); assert.equal(sockets.length, 1);
    assert.equal(host.navigate(id, '', 'https://example.test/live' as any, events), false);
    assert.equal(host.navigate(id, '', 'https://example.test/stale' as any, events), false);
    assert.equal(p.url, 'https://example.test/live'); assert.equal(sockets.length, 1);
    assert.match(errors.at(-1)!, /another client/);
    assert.equal(host.navigate(id, '', p.url, events, true), true);
    assert.equal(p.displaced, false); assert.equal(sockets.length, 2);
    sockets[1].onopen?.(); assert.equal(sockets[1].sent[0].input.takeover, true);
    sockets[1].result(); await p.ready; await Promise.resolve();
    assert.equal(sockets[1].sent[1].method, 'reload');
    sockets[0].onclose?.({ code: 4009 }); assert.equal(p.displaced, false); assert.equal(p.opened, true);
  } finally {
    p.closed = true; for (const socket of sockets) socket.close(); host.rejectPending(p);
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
  }
});
