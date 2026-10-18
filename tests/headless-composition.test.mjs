import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startHeadlessServer } from '../scripts/headless-server.mjs';
import { buildHeadlessBundle } from '../scripts/package-headless-linux.mjs';

async function fixture(t) {
  const runtime = fileURLToPath(new URL('../.runtime/', import.meta.url));
  await mkdir(runtime, { recursive: true });
  const root = await mkdtemp(join(runtime, 'headless-composition-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const webRoot = join(root, 'web'); await mkdir(webRoot);
  await writeFile(join(webRoot, 'index.html'), '<!doctype html><title>Public workbench</title>');
  await writeFile(join(webRoot, 'version.json'), JSON.stringify({ schemaVersion: 1, buildId: 'composition-test', headlessServer: true, headlessHostId: 'opencraft-server' }));
  let starts = 0;
  const options = { root, webRoot, dataDirectory: join(root, 'data'), port: 0,
    startAgentHost: async () => { starts++; return { websocketUrl: 'ws://127.0.0.1:9/rpc', close: async () => {} }; } };
  return { root, options, starts: () => starts };
}

test('public Headless artifact has no enterprise implementation and its CLI rejects private configuration', async t => {
  const f = await fixture(t), bundle = join(f.root, 'server.mjs');
  const result = await buildHeadlessBundle(bundle);
  const inputs = Object.keys(result.metafile.inputs);
  assert.ok(inputs.length > 100, 'inspect the real transitive graph');
  assert.deepEqual(inputs.filter(path => path.includes('/enterprise-identity/') || path.includes('products/join/')), []);
  const source = await readFile(bundle, 'utf8');
  assert.ok(!source.includes('TencentOaServerPlugin'));
  const run = promisify(execFile);
  const help = await run(process.execPath, [bundle, '--help'], { timeout: 10_000 });
  assert.match(help.stdout, /human-auth-config/); assert.ok(!help.stdout.includes('enterprise-identity'));
  await assert.rejects(run(process.execPath, [bundle, '--enterprise-identity-token-file', '/not-loaded'], { timeout: 10_000 }), /Unknown option/);
  const api = await import(pathToFileURL(bundle).href);
  const app = await api.startHeadlessServer(f.options); t.after(() => app.close());
  assert.equal((await fetch(app.url)).status, 200);
  assert.equal((await fetch(app.url + '/__opencraft_actors/me')).status, 401);
});

test('verified external human identity does not require an enterprise provider name or numeric identifier', async t => {
  const f = await fixture(t);
  let current = true;
  const principal = { provider: 'fixture-directory', subject: 'opaque-human-id', displayName: 'Fixture Human', expiresAt: Date.now() + 60_000 };
  const app = await startHeadlessServer({ ...f.options, accessMemberProviders: [principal.provider] }, {
    createIdentity: async () => ({ providers: [{ authenticate: request => current && request.headers['x-fixture-proof'] === 'verified' ? principal : null }], close() {} }),
  }); t.after(() => app.close());
  const headers = { 'x-fixture-proof': 'verified' };
  assert.equal((await fetch(app.url)).status, 401);
  const response = await fetch(app.url + '/__opencraft_actors/me', { headers });
  assert.equal(response.status, 200); const first = await response.json(); assert.equal(first.actor.kind, 'human');
  current = false;
  assert.equal((await fetch(app.url + '/__opencraft_actors/me', { headers })).status, 401);
  assert.equal((await fetch(app.url, { headers })).status, 401);
});

test('missing or malformed identity fails before execution and rollback releases the data lock', async t => {
  const f = await fixture(t);
  await assert.rejects(startHeadlessServer({ ...f.options, accessMemberProviders: ['fixture'] }), /identity provider/);
  let closed = 0;
  await assert.rejects(startHeadlessServer(f.options, { createIdentity: async () => ({ providers: [{}], close() { closed++; } }) }), /identity adapter/);
  assert.equal(closed, 1); assert.equal(f.starts(), 0);
  const app = await startHeadlessServer(f.options); t.after(() => app.close());
  assert.equal((await fetch(app.url)).status, 200);
});

test('public listener accepts explicit membership protection without requiring an anonymous-access acknowledgement', async t => {
  const f = await fixture(t);
  await assert.rejects(startHeadlessServer({ ...f.options, host: '0.0.0.0' }), /unauthenticated-public/);
  assert.equal(f.starts(), 0);
  const app = await startHeadlessServer({ ...f.options, host: '0.0.0.0', accessControl: true }); t.after(() => app.close());
  assert.equal((await fetch(app.url)).status, 401, 'no identity provider or member cannot downgrade to anonymous admission');
  assert.equal((await fetch(app.url + '/__opencraft_actors/me')).status, 401);
});

test('an identity disposal failure is reported after all owned resources and directory lock are released', async t => {
  const f = await fixture(t); let closes = 0;
  const app = await startHeadlessServer(f.options, { createIdentity: async () => ({ providers: [], close() { closes++; throw new Error('fixture disposal failure'); } }) });
  const first = app.close(), second = app.close(); assert.equal(first, second);
  await assert.rejects(first, AggregateError); assert.equal(closes, 1);
  const replacement = await startHeadlessServer(f.options); t.after(() => replacement.close());
  assert.equal((await fetch(replacement.url)).status, 200);
});
