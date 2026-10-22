'use strict';

// A page has one ordered control stream. Only adjacent, not-yet-dispatched
// pointer positions may replace one another; gesture edges and editing never do.
function createControls(command) {
  const tails = new Map(), moves = new Map(), epochs = new Map();
  const ordered = new Set(['input', 'text', 'ime', 'copy', 'viewport', 'visible', 'zoom', 'close', 'control']);
  const dispatch = message => {
    const page = message.page;
    if (!epochs.has(page)) epochs.set(page, {});
    const epoch = epochs.get(page);
    const move = message.method === 'input' && ['mouseMove', 'touchMove'].includes(message.input?.type);
    const signature = move ? JSON.stringify([message.control, message.input.type, message.input.button, message.input.modifiers, message.input.pointerType, Array.isArray(message.input.touchPoints) ? message.input.touchPoints.map(p => p?.id).sort((a, b) => a - b) : null]) : null;
    const previous = moves.get(page);
    if (move && previous?.signature === signature) {
      previous.message = message;
      return previous.operation;
    }
    // Even unordered navigation is a coalescing boundary.
    moves.delete(page);
    if (!ordered.has(message.method) && message.control === undefined) return command(message);
    const slot = { message, signature };
    const operation = (tails.get(page) ?? Promise.resolve()).then(() => {
      if (epochs.get(page) !== epoch)
        throw Object.assign(new Error('Browser renderer replaced'), { code: 'BROWSER_UNAVAILABLE', retryable: true });
      if (moves.get(page) === slot) moves.delete(page);
      return command(slot.message);
    });
    slot.operation = operation;
    if (move) moves.set(page, slot);
    const tail = operation.catch(() => {});
    tails.set(page, tail);
    void tail.then(() => { if (tails.get(page) === tail) tails.delete(page); });
    return operation;
  };
  dispatch.retire = page => { epochs.delete(page); tails.delete(page); moves.delete(page); };
  return dispatch;
}
module.exports = { createControls };
