import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, open, access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLocalReleaseSource } from '../scripts/web-deployment/local-release.mjs';
import { MAX_ARCHIVE_BYTES } from '../scripts/web-deployment/archive-limits.mjs';

const integrity = bytes => 'sha512-' + createHash('sha512').update(bytes).digest('base64');
test('local release verifies copied bytes and rejects a changed archive', async t => {
  const root = await mkdtemp(join(tmpdir(), 'local-release-integrity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = join(root, 'source.tgz'); const bytes = Buffer.from('fixed archive');
  await writeFile(archive, bytes);
  const source = createLocalReleaseSource(archive);
  const copied = await source.download({ integrity: integrity(bytes) }, join(root, 'valid'));
  assert.deepEqual(await readFile(copied), bytes);
  await assert.rejects(source.download({ integrity: integrity(Buffer.from('changed')) }, join(root, 'changed')), /integrity mismatch/);
  await assert.rejects(source.download({ integrity: 'sha512-invalid!' }, join(root, 'invalid')), /Invalid local release integrity/);
});
test('local release rejects an oversized sparse archive before copying it', async t => {
  const root = await mkdtemp(join(tmpdir(), 'local-release-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = join(root, 'oversized.tgz'); const file = await open(archive, 'w');
  try { await file.truncate(MAX_ARCHIVE_BYTES + 1); } finally { await file.close(); }
  const destination = join(root, 'download');
  await assert.rejects(createLocalReleaseSource(archive).download({ integrity: integrity(Buffer.alloc(0)) }, destination), /Local release is too large/);
  await assert.rejects(access(join(destination, 'release.tgz')), { code: 'ENOENT' });
});
