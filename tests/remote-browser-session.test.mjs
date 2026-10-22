import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import WebSocket from 'ws';
import { RemoteBrowserService } from '../scripts/remote-browser-service.mjs';

// Replace only Electron process transport. Real admission-scoped service, WS,
// persistence and reconnect behavior are exercised against a deterministic page.
class FixtureService extends RemoteBrowserService {
  commands = []; physical = new Map();
  async start() { await this.load(); }
  async request(id, method, input) {
    this.commands.push({ id, method, input });
    let p = this.physical.get(id);
    if (method === 'create') {
      if (!p) this.physical.set(id, p = { width: 1280, height: 720, deviceProfile: 'desktop', url: '', memory: randomUUID() });
      Object.assign(p, input); return { ...p, navigation: { url: p.url, title: 'Fixture', isLoading: false } };
    }
    if (method === 'close') { this.physical.delete(id); return; }
    if (method === 'navigate') { p.url = input.url; this.receive({ type: 'navigation', page: id, state: { url: p.url, title: 'Fixture', isLoading: false } }); }
    if (method === 'snapshot') return { ...p, navigation: { url: p.url, title: 'Fixture', isLoading: false } };
  }
}
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'remote-tab-session-'));
  let service = new FixtureService({ root: directory, dataDirectory: directory });
  const server = createServer();
  let revoked = false;
  server.on('upgrade', (request, socket, head) => service.upgrade(request, socket, head, {
    ownerId: request.url.slice(1), authorize() { if (revoked) throw new Error('Revoked'); },
  }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  async function connect(owner) {
    const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/${owner}`); await once(ws, 'open');
    const pending = new Map();
    ws.on('message', bytes => { const m = JSON.parse(bytes); const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(Object.assign(new Error(m.error.message), { code: m.error.code })) : p.resolve(m.value); } });
    ws.on('close', () => { for(const p of pending.values())p.reject(new Error('Connection closed')); pending.clear(); });
    const call = (method, input) => new Promise((resolve, reject) => { const id = randomUUID(); pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, input })); });
    return { ws, call, async detach() { if(ws.readyState===WebSocket.CLOSED)return; ws.close(); await once(ws, 'close'); await new Promise(resolve => setImmediate(resolve)); } };
  }
  return { directory, get service() { return service; }, connect,
    revoke() { revoked = true; },
    async restart() { service.close(); await service.persistence; service = new FixtureService({ root: directory, dataDirectory: directory }); },
    async close() { service.close(); await service.persistence; await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); },
  };
}

test('detach keeps the same live page; restart restores URL/config while explicit close retires it', async () => {
  const f = await fixture();
  try {
    const lease = randomUUID(), first = await f.connect('owner-a');
    assert.equal((await first.call('open', { lease, viewport: { width: 430, height: 932, deviceProfile: 'iphone' } })).resumed, false);
    await first.call('navigate', { url: 'https://example.test/actual' });
    const record = [...f.service.pages.values()][0], memory = f.service.physical.get(record.id).memory;
    await first.detach();
    assert.equal(record.socket, null); assert.equal(record.timer, undefined, 'no timer may evict a disconnected live tab');
    assert(f.service.commands.some(c => c.method === 'visible' && c.input.visible === false));
    const second = await f.connect('owner-a');
    const resumed = await second.call('open', { lease });
    assert.equal(resumed.resumed, true); assert.equal(resumed.memory, memory);
    assert.equal(f.service.commands.filter(c => c.method === 'navigate').length, 1, 'reattach must not navigate');
    await second.detach(); await f.restart();
    const third = await f.connect('owner-a'), restored = await third.call('open', { lease });
    assert.equal(restored.resumed, false); assert.equal(restored.restored, true);
    assert.notEqual(restored.memory, memory); assert.equal(restored.navigation.url, 'https://example.test/actual');
    assert.equal(restored.width, 430); assert.equal(restored.deviceProfile, 'iphone');
    await third.call('close'); await third.detach();
    assert.equal(f.service.pages.size, 0);
    assert.deepEqual(JSON.parse(await readFile(join(f.directory, 'remote-browser/tabs.json'), 'utf8')).pages, []);
    assert.equal((await stat(join(f.directory, 'remote-browser/tabs.json'))).mode & 0o777, 0o600);
  } finally { await f.close(); }
});

test('metadata survives restart, is owner scoped and rejects stale/unauthorized writes; lost ACK is idempotent', async () => {
  const f = await fixture();
  try {
    const a = await f.connect('owner-a'), b = await f.connect('owner-b');
    const scope = (await a.call('state')).scope;
    const mutation = { scope, key: 'tabs', value: '["a-tab"]', expectedRevision: 0, mutationId: randomUUID() };
    assert.equal((await a.call('state', mutation)).revision, 1);
    assert.equal((await a.call('state', mutation)).revision, 1);
    assert.deepEqual((await b.call('state')).values, {});
    await assert.rejects(b.call('state', {...mutation,mutationId:randomUUID()}), {code:'STATE_CONFLICT'});
    await assert.rejects(a.call('state', { ...mutation, mutationId: randomUUID() }), { code: 'STATE_CONFLICT' });
    await assert.rejects(a.call('state', { ...mutation, key: '../secret', expectedRevision: 1 }), /Invalid browser metadata/);
    await a.detach(); await b.detach(); await f.restart();
    const resumed = await f.connect('owner-a');
    assert.equal((await resumed.call('state')).values.tabs, '["a-tab"]');
    f.revoke();
    await assert.rejects(resumed.call('state', { ...mutation, expectedRevision: 1, mutationId: randomUUID() }), /closed/);
    await resumed.detach();
  } finally { await f.close(); }
});

test('another owner with the same lease gets a separate page and cannot discard its peer', async () => {
  const f = await fixture();
  try {
    const lease = randomUUID(), a = await f.connect('a'), b = await f.connect('b'), duplicate = await f.connect('a');
    await a.call('open', { lease });
    await assert.rejects(duplicate.call('open', { lease }), /already attached/);
    await duplicate.call('discard', { lease: randomUUID() });
    assert.equal(f.service.pages.size, 1);
    await b.call('open', { lease }); assert.equal(f.service.pages.size, 2);
    await b.call('close'); assert.equal(f.service.pages.size, 1);
    await a.call('close'); await a.detach(); await b.detach(); await duplicate.detach();
  } finally { await f.close(); }
});

test('corrupt state fails closed and is preserved instead of being replaced with an empty catalog', async () => {
  const f = await fixture();
  try {
    await f.service.load();
    const path = join(f.directory, 'remote-browser/tabs.json'); await writeFile(path, '{broken');
    await f.restart();
    // restart checkpoints valid state first; corrupt the new instance before its first load.
    await writeFile(path, '{broken');
    const a = await f.connect('a'); await assert.rejects(a.call('state'), /could not be read/); await a.detach();
    assert.equal(await readFile(path, 'utf8'), '{broken');
  } finally { await f.close(); }
});
