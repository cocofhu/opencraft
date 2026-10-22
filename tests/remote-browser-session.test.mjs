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
  commands = []; physical = new Map(); pendingNavigation = false;
  async start() { await this.load(); }
  async request(id, method, input) {
    this.commands.push({ id, method, input });
    let p = this.physical.get(id);
    if (method === 'create') {
      if (!p) this.physical.set(id, p = { width: 1280, height: 720, deviceProfile: 'desktop', url: 'about:blank', memory: randomUUID() });
      Object.assign(p, input); return { ...p, navigation: { url: p.url, title: 'Fixture', isLoading: false } };
    }
    if (method === 'close') { this.physical.delete(id); return; }
    if (method === 'navigate') { if (input.url && !['https:', 'http:'].includes(new URL(input.url).protocol)) throw new Error('Unsupported browser URL'); if (!this.pendingNavigation) p.url = input.url ?? 'about:blank'; this.receive({ type: 'navigation', page: id, state: { url: p.url, title: 'Fixture', isLoading: this.pendingNavigation } }); }
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

test('first unmeasured navigation gets client device identity without overriding a stored or explicit viewport', async () => {
  const f = await fixture();
  try {
    const lease = randomUUID(), first = await f.connect('owner');
    assert.equal((await first.call('open', { lease, defaultDeviceProfile: 'iphone' })).deviceProfile, 'iphone');
    await first.detach(); await f.restart();
    const restored = await f.connect('owner');
    assert.equal((await restored.call('open', { lease, defaultDeviceProfile: 'desktop' })).deviceProfile, 'iphone');
    await restored.detach();
    const explicit = await f.connect('owner');
    assert.equal((await explicit.call('open', { lease, defaultDeviceProfile: 'iphone', viewport: { width: 1024, height: 768, deviceProfile: 'desktop' } })).deviceProfile, 'desktop');
    await explicit.detach();
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

test('explicit viewer handoff keeps the live document and fences the displaced socket', async () => {
  const f = await fixture();
  try {
    const lease = randomUUID(), a = await f.connect('owner'), b = await f.connect('owner');
    const original = await a.call('open', { lease });
    await a.call('navigate', { url: 'https://example.test/unsaved-document' });
    const record = [...f.service.pages.values()][0], oldSocket = record.socket;
    // Keep the displaced transport open to exercise delayed close and stale
    // requests rather than relying on the local TCP close arriving promptly.
    const close = oldSocket.close.bind(oldSocket); let transfer;
    oldSocket.close = (code, reason) => { transfer = { code, reason }; };
    const resumed = await b.call('open', { lease, takeover: true });
    assert.equal(resumed.memory, original.memory); assert.equal(resumed.resumed, true);
    assert.equal(resumed.navigation.url, 'https://example.test/unsaved-document');
    assert.equal(transfer.code, 4009);
    const count = f.service.commands.length;
    await assert.rejects(a.call('navigate', { url: 'https://example.test/stale' }), /transferred/);
    await assert.rejects(a.call('close'), /transferred/);
    assert.equal(f.service.commands.length, count, 'stale viewer cannot mutate or retire the winner');
    const winner = record.socket; close(4009, 'Browser viewer transferred'); await once(a.ws, 'close');
    assert.equal(record.socket, winner, 'late close cannot detach replacement');
    assert.equal(f.service.commands.filter(c => c.method === 'navigate').length, 1);
    assert.equal(f.service.commands.filter(c => c.method === 'close').length, 0);
    assert.equal(f.service.attachments.size, 0);
    await b.call('close'); await b.detach();
  } finally { await f.close(); }
});

test('concurrent takeover waits for bootstrap and a disconnected queued viewer cannot block its successor', async () => {
  const f = await fixture(); let finish;
  try {
    const lease = randomUUID(), a = await f.connect('owner'), abandoned = await f.connect('owner'), b = await f.connect('owner');
    let signal; const started = new Promise(resolve => signal = resolve), gate = new Promise(resolve => finish = resolve);
    const request = f.service.request.bind(f.service); let creates = 0;
    f.service.request = async (id, method, input) => {
      if (method === 'create' && ++creates === 1) { signal(); await gate; }
      return request(id, method, input);
    };
    const initial = a.call('open', { lease }); await started;
    const failed = abandoned.call('open', { lease, takeover: true }).catch(() => {});
    await abandoned.detach(); await failed;
    const replacement = b.call('open', { lease, takeover: true });
    finish();
    const first = await initial, next = await replacement;
    assert.equal(next.memory, first.memory); assert.equal(next.resumed, true);
    assert.equal(f.service.physical.size, 1); assert.equal(f.service.pages.size, 1);
    assert.equal(creates, 2, 'one initial bootstrap plus one ordered reconfiguration');
    assert.equal(f.service.attachments.size, 0);
    await b.call('close'); await b.detach();
  } finally { finish?.(); await f.close(); }
});

test('takeover remains scoped to the authenticated owner', async () => {
  const f = await fixture();
  try {
    const lease = randomUUID(), a = await f.connect('owner-a'), b = await f.connect('owner-b');
    const first = await a.call('open', { lease }), second = await b.call('open', { lease, takeover: true });
    assert.notEqual(second.memory, first.memory); assert.equal(f.service.pages.size, 2);
    assert.equal(a.ws.readyState, WebSocket.OPEN);
    await a.call('close'); await b.call('close'); await a.detach(); await b.detach();
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


test('blank bootstrap checkpoints reopen without navigating an unsupported external URL', async () => {
  const f = await fixture();
  try {
    const lease = randomUUID(), first = await f.connect('owner-a');
    await first.call('open', { lease });
    assert.equal([...f.service.pages.values()][0].url, null);
    await first.detach(); await f.restart();
    const second = await f.connect('owner-a');
    const restored = await second.call('open', { lease });
    assert.equal(restored.navigation.url, 'about:blank');
    assert.equal(f.service.commands.filter(c => c.method === 'navigate').length, 0);
    await second.call('navigate', { url: 'https://example.test/after-reopen' });
    assert.equal([...f.service.pages.values()][0].url, 'https://example.test/after-reopen');
    await second.call('navigate', { url: null });
    assert.equal([...f.service.pages.values()][0].url, null);
    await second.detach();
  } finally { await f.close(); }
});

test('legacy about:blank recovery records migrate on read without clearing tab identities', async () => {
  const f = await fixture();
  try {
    const lease = randomUUID(), first = await f.connect('owner-a');
    await first.call('open', { lease }); await first.detach(); await f.restart();
    const path = join(f.directory, 'remote-browser/tabs.json');
    const saved = JSON.parse(await readFile(path, 'utf8')); saved.pages[0].url = 'about:blank';
    await writeFile(path, JSON.stringify(saved));
    const second = await f.connect('owner-a');
    const restored = await second.call('open', { lease });
    assert.equal(restored.restored, true); assert.equal(restored.navigation.url, 'about:blank');
    assert.equal(f.service.pages.size, 1); assert.equal([...f.service.pages.values()][0].url, null);
    assert.equal(f.service.commands.filter(c => c.method === 'navigate').length, 0);
    assert.equal(JSON.parse(await readFile(path, 'utf8')).pages[0].id, saved.pages[0].id);
    await assert.rejects(second.call('navigate', { url: 'file:///tmp/private' }), /Unsupported browser URL/);
    await second.call('navigate', { url: 'https://example.test/recovered' }); await second.detach();
  } finally { await f.close(); }
});


test('recovery keeps the saved remote target before navigation commits, then follows native redirects', async () => {
  const f = await fixture();
  try {
    const lease = randomUUID(), first = await f.connect('owner-a');
    await first.call('open', { lease });
    await first.call('navigate', { url: 'https://example.test/remote-authority' });
    await first.detach(); await f.restart();
    f.service.pendingNavigation = true;
    const second = await f.connect('owner-a');
    const restored = await second.call('open', { lease });
    assert.equal(restored.restored, true);
    assert.equal(restored.navigation.url, 'https://example.test/remote-authority');
    assert.equal(restored.navigation.isLoading, true);
    await f.service.persistence;
    let saved = JSON.parse(await readFile(join(f.directory, 'remote-browser/tabs.json'), 'utf8'));
    assert.equal(saved.pages[0].url, 'https://example.test/remote-authority');
    const record = [...f.service.pages.values()][0];
    f.service.receive({ type: 'navigation', page: record.id, state: { url: 'https://example.test/redirected', isLoading: false } });
    assert.equal(record.url, 'https://example.test/redirected');
    await second.detach();
  } finally { await f.close(); }
});

test('accepted close completes after the viewer disconnects before native acknowledgement', async () => {
  const f = await fixture(); let finish;
  try {
    const first = await f.connect('owner'), lease = randomUUID(); await first.call('open', { lease });
    let signal; const started = new Promise(resolve => signal = resolve), gate = new Promise(resolve => finish = resolve);
    const request = f.service.request.bind(f.service);
    f.service.request = async (id, method, input) => { if (method === 'close') { signal(); await gate; } return request(id, method, input); };
    const closed = first.call('close').catch(() => {}); await started; await first.detach(); finish(); await closed;
    for (let i=0;i<100 && f.service.physical.size;i++) await new Promise(resolve=>setTimeout(resolve,5));
    await new Promise(resolve=>setImmediate(resolve)); await f.service.persistence;
    assert.equal(f.service.physical.size, 0, 'native page destroyed');
    assert.equal(f.service.pages.size, 0, 'closed page must stop occupying quota after detach');
    assert.deepEqual(JSON.parse(await readFile(join(f.directory,'remote-browser/tabs.json'),'utf8')).pages,[]);
    await f.restart(); const next = await f.connect('owner');
    await assert.rejects(next.call('open',{lease}), /closed/);
    assert.equal((await next.call('open',{lease:randomUUID()})).restored,false); await next.call('close'); await next.detach();
  } finally { finish?.(); await f.close(); }
});

test('discard waits for an in-flight create and cannot leave an orphan native page', async () => {
  const f=await fixture();let finish;
  try {
    const first=await f.connect('owner'), control=await f.connect('owner'), lease=randomUUID();
    let signal;const started=new Promise(resolve=>signal=resolve),gate=new Promise(resolve=>finish=resolve);
    const request=f.service.request.bind(f.service);
    f.service.request=async(id,method,input)=>{if(method==='create'){signal();await gate;}return request(id,method,input)};
    const opening=first.call('open',{lease}).catch(()=>{});await started;
    const discarding=control.call('discard',{lease});await new Promise(resolve=>setTimeout(resolve,15));finish();await discarding;await opening;
    await f.service.persistence;
    assert.equal(f.service.pages.size,0);assert.equal(f.service.physical.size,0,'created native page must be retired before discard acknowledges');
    assert.deepEqual(JSON.parse(await readFile(join(f.directory,'remote-browser/tabs.json'),'utf8')).pages,[]);
    await first.detach();await control.detach();
  }finally{finish?.();await f.close()}
});

const until = async predicate => {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  assert.fail('Lifecycle work did not finish');
};

test('accepted mapping removal retires only that lease without a viewer close request', async () => {
  const f = await fixture();
  try {
    const a = await f.connect('owner'), b = await f.connect('other'), state = await f.connect('owner');
    const keep = 'browser-' + randomUUID(), drop = 'browser-' + randomUUID();
    await a.call('open', { lease: keep }); await b.call('open', { lease: drop });
    const viewer = await f.connect('owner'); await viewer.call('open', { lease: drop }); await viewer.detach();
    const scope = (await state.call('state')).scope;
    const write = (value, revision) => state.call('state', { scope, key: 'storage', value: JSON.stringify(value), expectedRevision: revision, mutationId: randomUUID() });
    await write({ keep, drop }, 0); await write({ keep }, 1);
    await until(() => f.service.pages.size === 2); await f.service.persistence;
    assert.equal(f.service.physical.size, 2, 'keep and other-owner tabs survive');
    assert.equal([...f.service.pages.values()].filter(p => p.ownerId === 'owner').length, 1);
    await assert.rejects(state.call('open', { lease: drop }), /closed/);
    await a.detach(); await b.detach(); await state.detach();
  } finally { await f.close(); }
});

test('closure before native startup completes fences late creation, including after restart', async () => {
  const f = await fixture(); let release;
  try {
    const viewer = await f.connect('owner'), control = await f.connect('owner'), lease = randomUUID();
    let entered; const started = new Promise(resolve => entered = resolve), gate = new Promise(resolve => release = resolve);
    f.service.start = async () => { entered(); await gate; };
    const opening = viewer.call('open', { lease }).catch(error => error); await started;
    await control.call('discard', { lease }); release();
    assert.match((await opening).message, /closed/);
    assert.equal(f.service.physical.size, 0); assert.equal(f.service.pages.size, 0);
    await viewer.detach(); await control.detach(); await f.restart();
    const next = await f.connect('owner'); await assert.rejects(next.call('open', { lease }), /closed/); await next.detach();
  } finally { release?.(); await f.close(); }
});

test('failed native destruction remains durably closing and resumes after a server restart', async () => {
  const f = await fixture();
  try {
    const viewer = await f.connect('owner'), lease = randomUUID(); await viewer.call('open', { lease });
    const request = f.service.request.bind(f.service);
    f.service.request = async (id, method, input) => { if (method === 'close') throw new Error('temporary native failure'); return request(id, method, input); };
    await assert.rejects(viewer.call('close'), /temporary/);
    const saved = JSON.parse(await readFile(join(f.directory, 'remote-browser/tabs.json'), 'utf8'));
    assert.equal(saved.pages[0].closing, true);
    await viewer.detach();
    const reconnect = await f.connect('owner'); await assert.rejects(reconnect.call('open', { lease }), /closed/);
    await reconnect.detach(); await viewer.detach(); await f.restart();
    const state = await f.connect('owner'); await state.call('state');
    await until(() => f.service.pages.size === 0); await f.service.persistence;
    assert.deepEqual(JSON.parse(await readFile(join(f.directory, 'remote-browser/tabs.json'), 'utf8')).pages, []);
    await state.detach();
  } finally { await f.close(); }
});

test('missing or malformed historical mappings never trigger a sweep of unwatched tabs', async () => {
  const f = await fixture();
  try {
    const viewer = await f.connect('owner'), state = await f.connect('owner'); await viewer.call('open', { lease: randomUUID() }); await viewer.detach();
    const scope = (await state.call('state')).scope;
    for (const [revision, value] of ['{}', '[]', '{}'].entries()) {
      await state.call('state', { scope, key: 'storage', value, expectedRevision: revision, mutationId: randomUUID() });
    }
    assert.equal(f.service.physical.size, 1); assert.equal(f.service.pages.size, 1);
    await state.detach();
  } finally { await f.close(); }
});
