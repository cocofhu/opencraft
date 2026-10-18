/** Browser deployment context only. Authorization always remains at the target. */
export interface BrowserServerContext { readonly id: string; readonly name: string; readonly basePath: string; readonly selectorPath: string; }
export function parseServerContext(raw: string | null): BrowserServerContext | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as BrowserServerContext;
  if (!value || !/^[A-Za-z0-9._-]{1,128}$/u.test(value.id) || typeof value.name !== 'string'
    || !['/servers', '/__opencraft_servers'].includes(value.selectorPath)
    || value.basePath !== value.selectorPath + '/' + encodeURIComponent(value.id)) throw new Error('Invalid server context');
  return Object.freeze(value);
}
export function browserServerContext(): BrowserServerContext | null {
  return typeof document === 'undefined' || typeof document.getElementById !== 'function' ? null : parseServerContext(document.getElementById('opencraft-server-context')?.textContent ?? null);
}
export function serverUrl(path: string): string {
  const base = browserServerContext()?.basePath ?? '';
  return base && path.startsWith('/') && !path.startsWith('//') && !path.startsWith(base + '/') ? base + path : path;
}
export function serverPath(path: string): string {
  const base = browserServerContext()?.basePath ?? '';
  return base && path === base ? '/' : base && path.startsWith(base + '/') ? path.slice(base.length) : path;
}
export const serverFetch: typeof fetch = (input, init) => {
  if (typeof input === 'string' && !/^(?:https?:)?\/\//u.test(input)) return globalThis.fetch(serverUrl(input), init);
  if (typeof window !== 'undefined') {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    if (url.origin === window.location.origin) {
      const scoped = new URL(serverUrl(url.pathname) + url.search + url.hash, url.origin);
      return globalThis.fetch(typeof input === 'string' || input instanceof URL ? scoped : new Request(scoped, input), init);
    }
  }
  return globalThis.fetch(input, init);
};
export function serverStorageKey(key: string): string {
  const id = browserServerContext()?.id;
  return id ? `server:${id}:${key}` : key;
}
