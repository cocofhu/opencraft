import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountModelDefaultsStore } from "../scripts/account-model-defaults-store";

const selection = { model: 'provider/model', effort: 'high' };
test('personal defaults survive restart, isolate users/Hosts, and reject stale device writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'account-model-'));
  try {
    const path = join(directory, 'defaults.sqlite');
    const first = new AccountModelDefaultsStore(path), second = new AccountModelDefaultsStore(path);
    assert.deepEqual(first.read('alice', 'host'), { revision: 0, selection: null });
    assert.equal(first.write('alice', 'host', 0, selection).updated, true);
    assert.equal(second.write('alice', 'host', 0, { model: 'stale', effort: null }).updated, false);
    second.write('bob', 'host', 0, { model: 'bob-model', effort: null });
    second.write('alice', 'other', 0, { model: 'other-host', effort: null });
    first.close(); second.close();
    const restored = new AccountModelDefaultsStore(path);
    assert.deepEqual(restored.read('alice', 'host'), { revision: 1, selection });
    assert.equal(restored.read('bob', 'host').selection?.model, 'bob-model');
    assert.equal(restored.read('alice', 'other').selection?.model, 'other-host');
    for (const value of [null, { model: '' }, { model: 'x', effort: 1 }, { ...selection, account: 'bob' }]) {
      assert.throws(() => restored.write('alice', 'host', 1, value));
    }
    assert.deepEqual(restored.read('alice', 'host').selection, selection);
    restored.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
