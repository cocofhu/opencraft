'use strict';

const MAX_TOUCH_POINTS = 10;
const types = new Set(['touchStart', 'touchMove', 'touchEnd', 'touchCancel']);
function points(input) {
  if (!types.has(input.type) || !Array.isArray(input.touchPoints) || input.touchPoints.length > MAX_TOUCH_POINTS) throw new Error('Invalid touch input');
  const ids = new Set();
  return input.touchPoints.map(point => {
    if (!point || !Number.isInteger(point.id) || point.id < 0 || point.id > 2147483647 || ids.has(point.id)) throw new Error('Invalid touch identity');
    ids.add(point.id);
    const result = { id: point.id };
    for (const [name, minimum, maximum, fallback] of [['x', -10000, 10000], ['y', -10000, 10000], ['radiusX', 0, 1000, 1], ['radiusY', 0, 1000, 1], ['force', 0, 1, 1]]) {
      const value = point[name] ?? fallback;
      if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error('Invalid touch geometry');
      result[name] = value;
    }
    return result;
  });
}

// The worker selects Chromium's per-contact dispatcher. Its touchStart/touchEnd
// describe changed contacts; the wire carries complete active-contact snapshots.
function createTouchInput(dispatch) {
  let active = new Map(), tail = Promise.resolve();
  const enqueue = operation => {
    const result = tail.then(operation); tail = result.catch(() => {}); return result;
  };
  const reset = async () => {
    if (!active.size) return;
    try { await dispatch({ type: 'touchCancel', touchPoints: [] }); }
    finally { active.clear(); }
  };
  const apply = async input => {
    const next = points(input), nextIds = new Set(next.map(p => p.id));
    if (input.type === 'touchCancel') {
      if (next.length) throw new Error('Invalid touch cancellation');
      return reset();
    }
    // Resize, parking or document replacement retires the old gesture. Late
    // moves/releases and an added finger cannot recreate that retired gesture.
    if (!active.size && (input.type !== 'touchStart' || next.length !== 1)) return;
    const added = next.filter(p => !active.has(p.id));
    const removed = [...active.values()].filter(p => !nextIds.has(p.id));
    if (input.type === 'touchStart' && (added.length !== 1 || removed.length)
      || input.type === 'touchMove' && (added.length || removed.length)
      || input.type === 'touchEnd' && (added.length || removed.length !== 1)) throw new Error('Invalid touch sequence');
    const touchPoints = input.type === 'touchStart' ? added : input.type === 'touchEnd' ? (next.length ? removed : []) : next;
    const modifiers = (Array.isArray(input.modifiers) ? input.modifiers : []).reduce((bits, modifier) => bits | ({ alt: 1, control: 2, meta: 4, shift: 8 }[modifier] ?? 0), 0);
    try {
      await dispatch({ type: input.type, touchPoints, modifiers });
      active = new Map(next.map(p => [p.id, p]));
    } catch (error) {
      // A failed ACK may follow native acceptance. Do not leave contacts held
      // or retry a press into a different document.
      try { await dispatch({ type: 'touchCancel', touchPoints: [] }); } catch {}
      active.clear(); throw error;
    }
  };
  return {
    get active() { return active.size > 0; },
    apply: input => enqueue(() => apply(input)),
    reset: () => enqueue(reset),
    mouse: event => enqueue(async () => {
      if (event.type === 'mouseDown') await reset();
      if (event.type !== 'mouseDown' && !active.size) return;
      return apply({ type: event.type === 'mouseDown' ? 'touchStart' : event.type === 'mouseMove' ? 'touchMove' : 'touchEnd',
        touchPoints: event.type === 'mouseUp' ? [] : [{ id: 0, x: event.x, y: event.y }], modifiers: event.modifiers });
    }),
  };
}
module.exports = { createTouchInput, MAX_TOUCH_POINTS };
