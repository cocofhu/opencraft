import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const { installClipboard } = createRequire(import.meta.url)('../scripts/remote-browser/clipboard.cjs');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
function fixture() {
  const wc = new EventEmitter(), sent = [], operations = [];
  let native = { available: true, token: 'opaque-native-token' };
  let result = { status: 'ok', dispatched: true, text: '网站复制结果', html: '<b>网站复制结果</b>' };
  const frame = { async getNativeClipboardContextForTesting() { return native; },
    async copyNativeClipboardForTesting(token) { operations.push(token); return result; } };
  wc.mainFrame = wc.focusedFrame = frame;
  const p = { id: 'page-a', window: { webContents: wc }, visible: true, closed: false, document: 'doc-a', contextIntent: 'local-intent' };
  const port = installClipboard(p, event => sent.push(event));
  const params = { frame, x: 20, y: 30, linkURL: '', editFlags: { canCopy: true } };
  return { p, wc, frame, port, sent, operations, params, native(value) { native = value; }, result(value) { result = value; },
    async menu() { wc.emit('context-menu', {}, params); await new Promise(resolve => setImmediate(resolve)); return sent.at(-1); } };
}
test('native menu context contains no selected content and copy returns the final native payload once', async () => {
  const f = fixture(), menu = await f.menu();
  assert.equal(menu.copy, true); assert.equal(menu.intent, 'local-intent');
  assert.equal(Object.hasOwn(menu, 'text'), false); assert.equal(Object.hasOwn(menu, 'selectionText'), false);
  assert.deepEqual(await f.port.copy(menu.context), { text: '网站复制结果', html: '<b>网站复制结果</b>' });
  await assert.rejects(f.port.copy(menu.context), /Selection changed/); assert.deepEqual(f.operations, ['opaque-native-token']);
  f.port.dispose(); assert.equal(f.wc.listenerCount('context-menu'), 0);
});
test('shortcut uses the focused child frame rather than mainFrame or selectionText', async () => {
  const f = fixture(); let copied = false;
  f.wc.focusedFrame = { async getNativeClipboardContextForTesting() { return { available: true, token: 'child' }; },
    async copyNativeClipboardForTesting(token) { assert.equal(token, 'child'); copied = true; return { status: 'ok', text: 'child result' }; } };
  assert.deepEqual(await f.port.copy(), { text: 'child result' }); assert(copied); assert.equal(f.operations.length, 0);
});
test('retired document, hidden view and capture races cannot authorize copy', async () => {
  const f = fixture(), menu = await f.menu();
  f.port.retire(); await assert.rejects(f.port.copy(menu.context), /Selection changed/);
  const pending = deferred(); f.frame.getNativeClipboardContextForTesting = () => pending.promise;
  const copying = f.port.copy(); f.p.document = 'new'; f.port.retire();
  pending.resolve({ available: true, token: 'old' }); await assert.rejects(copying, /Selection changed/);
  assert.equal(f.operations.length, 0); f.p.visible = false;
  await assert.rejects(f.port.copy(), /unavailable/);
});
test('late native results after detach are discarded and never emitted as clipboard events', async () => {
  const f = fixture(), menu = await f.menu(), pending = deferred();
  f.frame.copyNativeClipboardForTesting = () => pending.promise;
  const copying = f.port.copy(menu.context); f.port.retire(); f.p.visible = false;
  pending.resolve({ status: 'ok', text: 'late' }); await assert.rejects(copying, /canceled/);
  assert.equal(f.sent.filter(event => event.type === 'clipboard').length, 0);
});
test('stock runtime fails closed; link menus exclude unsafe schemes', async () => {
  const f = fixture(); f.wc.mainFrame = f.wc.focusedFrame = f.params.frame = {};
  assert.equal(f.port.available(), false); await assert.rejects(f.port.copy(), /Selection changed/);
  f.params.linkURL = 'javascript:alert(1)'; assert.equal(await f.menu(), undefined);
  f.params.linkURL = 'https://example.test/link'; const menu = await f.menu();
  assert.equal(menu.copy, false); assert.equal(menu.link, 'https://example.test/link');
});
test('separate pages do not share capabilities or clipboard data', async () => {
  const a = fixture(), b = fixture(), menu = await a.menu();
  await assert.rejects(b.port.copy(menu.context), /Selection changed/);
  assert.equal(b.operations.length, 0); assert.equal((await a.port.copy(menu.context)).text, '网站复制结果');
});
test('native denial or unsupported formats never become a success result', async () => {
  for (const status of ['no-data', 'stale-context', 'unsupported-format']) {
    const f = fixture(); f.result({ status, dispatched: true });
    await assert.rejects(f.port.copy(), /Selection changed|format is not supported/);
  }
});
