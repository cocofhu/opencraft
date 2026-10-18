import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { c } from 'tar';
import { createOptionalResources, RESOURCE_PACKAGE, parseResources } from '../scripts/web-deployment/optional-resources.mjs';
import { createWorkbenchWebServer } from '../scripts/workbench-web-server.mjs';

async function fixture(root, buildId, { unsafe = false } = {}) {
  const releaseRoot = join(root, buildId); const payload = join(root, `${buildId}-payload`);
  await mkdir(join(releaseRoot, 'web'), { recursive: true });
  await mkdir(join(payload, 'package/web/assets'), { recursive: true });
  const file = `assets/preview-${buildId}.js`;
  await writeFile(join(releaseRoot, 'web/index.html'), '<html><head></head><body>core works</body></html>');
  await writeFile(join(payload, 'package/web', file), `export default '${buildId}'`);
  if (unsafe) await symlink('/etc/passwd', join(payload, 'package/web/assets/escape.js'));
  await writeFile(join(payload, 'package/package.json'), JSON.stringify({ name: RESOURCE_PACKAGE, version: '1.0.1', opencraftAssets: { buildId } }));
  const archive = join(root, `${buildId}.tgz`);
  await c({ file: archive, gzip: true, cwd: payload }, ['package']);
  const pack = { packageName: RESOURCE_PACKAGE, version: '1.0.1', buildId, files: [file],
    integrity: 'sha512-' + createHash('sha512').update(await readFile(archive)).digest('base64') };
  await writeFile(join(releaseRoot, 'web/optional-resources.json'), JSON.stringify({ schemaVersion: 1, packs: [pack] }));
  return { releaseRoot, archive, pack, file };
}

test('optional download failure preserves core, retries, coalesces requests and serves cached resources after restart/update', async t => {
  const root = await mkdtemp(join(tmpdir(), 'web-resources-')); t.after(() => rm(root, { recursive: true, force: true }));
  const first = await fixture(root, 'old12345'); let downloads = 0; let offline = true;
  const cacheDirectory = join(root, 'cache');
  const source = { async download(pack) { downloads++; assert.equal(pack.integrity, first.pack.integrity); if (offline) throw new Error('private-secret'); await new Promise(done => setTimeout(done, 40)); return first.archive; } };
  const resources = await createOptionalResources({ releaseRoot: first.releaseRoot, cacheDirectory, source });
  const app = await createWorkbenchWebServer({ root: join(first.releaseRoot, 'web'), appServerTarget: null, optionalResources: resources });
  t.after(() => app.close());
  const base = `http://127.0.0.1:${(await app.listen({ host: '127.0.0.1', port: 0 })).port}`;
  assert.match(await (await fetch(base)).text(), /core works/);
  const failed = await fetch(`${base}/__opencraft_resources/${first.pack.buildId}`);
  assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /private-secret/);
  assert.equal((await fetch(`${base}/__opencraft_health`)).status, 200);
  offline = false;
  const replies = await Promise.all(Array.from({ length: 4 }, () => fetch(`${base}/${first.file}`)));
  assert.ok(replies.every(reply => reply.status === 200)); assert.equal(downloads, 2);
  assert.match(replies[0].headers.get('content-type'), /javascript/);
  assert.match(replies[0].headers.get('cache-control'), /immutable/);
  const next = await fixture(root, 'new12345');
  const restarted = await createOptionalResources({ releaseRoot: next.releaseRoot, cacheDirectory,
    source: { async download() { throw new Error('offline after update'); } } });
  assert.match(await readFile(await restarted.resolveFile(`/${first.file}`), 'utf8'), /old12345/);
  assert.equal(await restarted.resolveFile('/assets/unknown.js'), null);
  // A separately built version can also be prepared without registry access.
  await restarted.prefetch(next.archive);
  assert.match(await readFile(await restarted.resolveFile(`/${next.file}`), 'utf8'), /new12345/);
  assert.equal(await restarted.prepare('unknown'), false);
});

test('resource archives reject wrong integrity and symlinks before exposing files, and retry after failure', async t => {
  const root = await mkdtemp(join(tmpdir(), 'web-resources-unsafe-')); t.after(() => rm(root, { recursive: true, force: true }));
  const good = await fixture(root, 'good1234'); const bad = await fixture(root, 'evil1234', { unsafe: true });
  const resources = await createOptionalResources({ releaseRoot: good.releaseRoot, cacheDirectory: join(root, 'cache'),
    source: { async download() { return bad.archive; } } });
  await assert.rejects(resources.prepare(good.pack.buildId), /integrity mismatch/);
  await resources.prefetch(good.archive);
  assert.ok((await stat(await resources.resolveFile(`/${good.file}`))).isFile());
  const unsafe = await createOptionalResources({ releaseRoot: bad.releaseRoot, cacheDirectory: join(root, 'unsafe-cache') });
  await assert.rejects(unsafe.prefetch(bad.archive), /Unsafe Web archive/);
  const input = { schemaVersion: 1, packs: [{ ...good.pack, files: ['../private.json'] }] };
  assert.throws(() => parseResources(input), /Invalid resource/);
});

test('an unusable optional cache does not prevent the core server from starting', async t => {
  const root = await mkdtemp(join(tmpdir(), 'web-resources-cache-failure-')); t.after(() => rm(root, { recursive: true, force: true }));
  const release = await fixture(root, 'disk1234');
  const blocked = join(root, 'blocked'); await writeFile(blocked, 'not a directory');
  const resources = await createOptionalResources({ releaseRoot: release.releaseRoot, cacheDirectory: blocked });
  const app = await createWorkbenchWebServer({ root: join(release.releaseRoot, 'web'), appServerTarget: null, optionalResources: resources });
  t.after(() => app.close());
  const base = `http://127.0.0.1:${(await app.listen({ host: '127.0.0.1', port: 0 })).port}`;
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await fetch(`${base}/__opencraft_resources/${release.pack.buildId}`)).status, 503);
  assert.match(await (await fetch(base)).text(), /core works/);
});
