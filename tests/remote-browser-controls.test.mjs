import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { createControls } = createRequire(import.meta.url)('../scripts/remote-browser/controls.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
const input = (type, x = 0, page = 'a') => ({ page, method: 'input', input: { type, x } });

test('slow native touch coalesces positions while preserving release, resize and every reply', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; }), seen = [];
  const dispatch = createControls(async message => { seen.push(message); if (seen.length === 1) await gate; });
  const results = [dispatch(input('mouseDown'))];
  await tick();
  for (let x = 1; x <= 150; x++) results.push(dispatch(input('mouseMove', x)));
  results.push(dispatch(input('mouseUp', 150)));
  results.push(dispatch({ page: 'a', method: 'viewport', input: { width: 390, height: 440 } }));
  assert.equal(seen.length, 1);
  release(); await Promise.all(results);
  assert.deepEqual(seen.map(m => m.input.type ?? m.method), ['mouseDown', 'mouseMove', 'mouseUp', 'viewport']);
  assert.equal(seen[1].input.x, 150);
});

test('in-flight positions, cancellation, editing and modifier boundaries cannot be replaced', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; }), seen = [];
  const dispatch = createControls(async message => { seen.push(message); if (seen.length === 1) await gate; });
  const results = [dispatch(input('mouseMove', 1))];
  await tick();
  results.push(dispatch(input('mouseMove', 2)), dispatch(input('touchCancel')));
  results.push(dispatch(input('mouseMove', 3)));
  results.push(dispatch({ page: 'a', method: 'ime', input: { type: 'commit', text: '你' } }));
  results.push(dispatch(input('mouseMove', 4)));
  results.push(dispatch({ ...input('mouseMove', 5), input: { type: 'mouseMove', x: 5, modifiers: ['shift'] } }));
  release(); await Promise.all(results);
  assert.deepEqual(seen.map(m => m.input.type), ['mouseMove', 'mouseMove', 'touchCancel', 'mouseMove', 'commit', 'mouseMove', 'mouseMove']);
  assert.deepEqual(seen.filter(m => m.input.type === 'mouseMove').map(m => m.input.x), [1, 2, 3, 4, 5]);
});

test('failure rejects merged requests and releases the page; other pages and stop stay independent', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; }), seen = [];
  const dispatch = createControls(async m => {
    seen.push(m);
    if (m.page === 'a' && m.input.type === 'mouseDown') await gate;
    if (m.input.type === 'mouseMove') throw Error('native failure');
  });
  const down = dispatch(input('mouseDown'));
  await tick();
  const first = assert.rejects(dispatch(input('mouseMove', 1)), /native failure/);
  const second = assert.rejects(dispatch(input('mouseMove', 2)), /native failure/);
  await dispatch(input('mouseDown', 0, 'b'));
  await dispatch({ page: 'a', method: 'stop', input: {} });
  assert.equal(seen.length, 3);
  release(); await Promise.all([down, first, second]);
  await dispatch(input('mouseUp'));
  assert.equal(seen.at(-1).input.type, 'mouseUp');
});

test('native pointer identity is a pending motion boundary on hybrid devices', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; }), seen = [];
  const dispatch = createControls(async m => { seen.push(m); if (seen.length === 1) await gate; });
  const down = dispatch(input('mouseDown')); await tick();
  const moves = ['touch', 'mouse', 'mouse'].map((pointerType, x) => dispatch({ page: 'a', method: 'input', input: { type: 'mouseMove', x, pointerType } }));
  release(); await Promise.all([down, ...moves]);
  assert.deepEqual(seen.slice(1).map(m => [m.input.pointerType, m.input.x]), [['touch', 0], ['mouse', 2]]);
});
