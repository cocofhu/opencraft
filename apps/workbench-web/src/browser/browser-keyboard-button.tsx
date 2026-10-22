import { useCallback, useSyncExternalStore } from 'react';
import { useIntl } from '@opencraft/i18n/react';
import type { BrowserPageId } from '@opencraft/browser-core';
import type { BrowserSurfaceHost } from './web-browser-surface-host';

export function BrowserKeyboardButton({ surfaces, pageId }: { surfaces?: BrowserSurfaceHost; pageId: BrowserPageId }) {
  const intl = useIntl();
  const subscribe = useCallback((listener: () => void) => surfaces?.onKeyboardState?.(listener) ?? (() => {}), [surfaces]);
  const snapshot = useCallback(() => surfaces?.keyboardState?.(pageId) ?? 'unavailable', [surfaces, pageId]);
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (state === 'unavailable') return null;
  return <button type="button" className="browser-toolbar-button browser-toolbar-button--keyboard"
    disabled={state !== 'ready'} onClick={() => surfaces?.showKeyboard?.(pageId)}
    title={intl.formatMessage({ id: 'browser.keyboard.hint', defaultMessage: 'Select a text field, then open the keyboard' })}>
    {intl.formatMessage({ id: 'browser.keyboard', defaultMessage: 'Keyboard' })}
  </button>;
}
