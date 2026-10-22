import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { createWidgetWheelDispatcher } = createRequire(import.meta.url)('../scripts/remote-browser/touch.cjs');

test('wheel native hit testing follows current pinch/zoom with original physical deltas', async () => {
  let scale = 1, zoom = 1;
  const events = [];
  const wheel = createWidgetWheelDispatcher({ async sendCommand(method, input) {
    if (method === 'Page.getLayoutMetrics') return { cssVisualViewport: { scale, offsetX: 100, pageY: 900 } };
    assert.equal(method, 'Input.dispatchMouseEvent'); events.push(input);
  } }, () => zoom);
  const event = { x: 300, y: 240, deltaX: -12, deltaY: -120, modifiers: ['shift', 'control', 'leftButtonDown'] };
  await wheel(event);
  scale = 2; zoom = 1.5; await wheel(event);
  assert.deepEqual(events, [
    { type: 'mouseWheel', x: 300, y: 240, deltaX: 12, deltaY: 120, modifiers: 10 },
    { type: 'mouseWheel', x: 100, y: 80, deltaX: 12, deltaY: 120, modifiers: 10 },
  ]);
});

test('wheel fails closed on invalid metrics or failed native ACK, without retry', async () => {
  let scale = 0, attempts = 0;
  const wheel = createWidgetWheelDispatcher({ async sendCommand(method) {
    if (method === 'Page.getLayoutMetrics') return { cssVisualViewport: { scale } };
    attempts++; throw new Error('document gone');
  } }, () => 1);
  await assert.rejects(wheel({ deltaY: -50 }), /native wheel scale/);
  assert.equal(attempts, 0);
  scale = 1; await assert.rejects(wheel({ deltaY: -50 }), /document gone/);
  assert.equal(attempts, 1);
});
