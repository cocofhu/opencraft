'use strict';

/** Native capabilities stay inside the worker. The client owns only an input
 * transaction id, never a DOM editor mirror or a reusable native target token. */
function installIme(p, send) {
  const wc = p.window.webContents;
  let transaction = null, generation = 0, lastState = '';
  const supported = frame => typeof frame?.getNativeImeContextForTesting === 'function'
    && typeof frame?.applyNativeImeForTesting === 'function';
  async function retire() {
    ++generation;
    const previous = transaction; transaction = null;
    if (previous?.native.compositionId) {
      try { await previous.frame.applyNativeImeForTesting({ token: previous.native.token,
        compositionId: previous.native.compositionId, type: 'cancel', text: '', selectionStart: 0, selectionEnd: 0 }); } catch {}
    }
  }
  const observe = () => {
    if (p.closed || !p.visible) return;
    try {
      const state = wc.getNativeTextInputState?.();
      // Pinned Chromium native text/textarea/contenteditable types. The target
      // API independently validates the actual renderer before every write.
      const editable = supported(wc.mainFrame) && state?.active === true && [1,14,15].includes(state.type);
      const b = state?.caretBounds;
      const caret = editable && b && ['x','y','width','height'].every(key => Number.isFinite(b[key]) && Math.abs(b[key]) <= 100000) && b.height > 0
        ? { x: b.x, y: b.y, width: b.width, height: b.height } : undefined;
      const value = { editable, ...(caret ? { caret } : {}) }, encoded = JSON.stringify(value);
      if (lastState !== encoded) { lastState = encoded; send({ type: 'ime-state', page: p.id, ...value }); }
    } catch {}
  };
  const timer = setInterval(observe, 150); timer.unref();
  const onNavigation = () => { lastState = ''; void retire(); };
  wc.on('did-start-navigation', onNavigation);
  wc.on('render-process-gone', onNavigation);
  return {
    available: () => supported(wc.mainFrame),
    observe() { lastState = ''; observe(); },
    retire,
    async apply(input) {
      if (!/^[a-zA-Z0-9-]{20,100}$/.test(input?.id ?? '') || !['begin','compose','commit','cancel'].includes(input.type)) throw new Error('Invalid input transaction');
      if (input.type === 'cancel') { if (transaction?.id === input.id) await retire(); return; }
      if (p.closed || !p.visible) throw new Error('Input is unavailable');
      if (input.type === 'begin') {
        await retire();
        const version = generation, document = p.document, frame = wc.focusedFrame;
        if (!supported(frame)) throw new Error('Native input is unavailable in this browser runtime');
        const native = await frame.getNativeImeContextForTesting();
        if (generation !== version || p.closed || !p.visible || document !== p.document || !native?.available)
          throw new Error('Focus an editable text field before typing');
        transaction = { id: input.id, frame, native, document };
        return;
      }
      const current = transaction;
      if (!current || current.id !== input.id || current.document !== p.document) throw new Error('Input target changed; type again');
      if (typeof input.text !== 'string' || input.text.length > 16384) throw new Error('Invalid input text');
      const version = generation;
      const result = await current.frame.applyNativeImeForTesting({ token: current.native.token,
        compositionId: current.native.compositionId, type: input.type, text: input.text,
        selectionStart: input.text.length, selectionEnd: input.text.length });
      if (p.closed || !p.visible || transaction !== current || version !== generation || current.document !== p.document)
        throw new Error('Input was canceled');
      if (result?.status !== 'processed') { transaction = null; throw new Error('Input target changed or the website rejected input'); }
      if (input.type === 'commit') transaction = null;
      else current.native = result.context;
      observe();
    },
    dispose() { clearInterval(timer); transaction = null; ++generation; wc.off('did-start-navigation', onNavigation); wc.off('render-process-gone', onNavigation); },
  };
}
module.exports = { installIme };
