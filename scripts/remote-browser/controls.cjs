'use strict';

// A page has one ordered control stream. Only adjacent, not-yet-dispatched
// pointer positions may replace one another; gesture edges and editing never do.
function createControls(command) {
  const tails = new Map(), moves = new Map();
  const ordered = new Set(['input', 'text', 'ime', 'copy', 'viewport', 'visible', 'zoom', 'close']);
  return message => {
    const page = message.page;
    const move = message.method === 'input' && message.input?.type === 'mouseMove';
    const signature = move ? JSON.stringify([message.input.button, message.input.modifiers]) : null;
    const previous = moves.get(page);
    if (move && previous?.signature === signature) {
      previous.message = message;
      return previous.operation;
    }
    // Even unordered navigation is a coalescing boundary.
    moves.delete(page);
    if (!ordered.has(message.method)) return command(message);
    const slot = { message, signature };
    const operation = (tails.get(page) ?? Promise.resolve()).then(() => {
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
}
module.exports = { createControls };
