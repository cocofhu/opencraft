import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../apps/workbench-web/index.html", import.meta.url), "utf8");
const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes("isResizeObserverDeliveryWarning"))!;

function fixture() {
  const listeners = new Map<string, (event: any) => void>();
  const reports: { url: string; body?: any }[] = [];
  const elements = new Map<string, any>();
  const field = (selector: string) => {
    if (!elements.has(selector)) elements.set(selector, { textContent: "", hidden: false, addEventListener() {} });
    return elements.get(selector);
  };
  let surface: any = null;
  let reloads = 0;
  const context = vm.createContext({
    addEventListener: (type: string, listener: (event: any) => void) => listeners.set(type, listener),
    document: {
      getElementById: () => surface,
      querySelector: () => ({ getAttribute: () => "same-build", setAttribute() {} }),
      createElement: () => ({ style: {}, setAttribute() {}, querySelector: field }),
      body: { append: (element: any) => { surface = element; } },
      documentElement: { dataset: {}, classList: { add() {} }, style: {} },
    },
    fetch: async (url: string, options?: { body?: string }) => {
      reports.push({ url, body: options?.body ? JSON.parse(options.body) : undefined });
      return { ok: true, json: async () => ({ buildId: "same-build" }) };
    },
    location: { href: "https://example.test/", reload: () => { ++reloads; } },
    localStorage: { getItem: () => null },
    sessionStorage: { getItem: () => null, setItem() {} },
    setTimeout() {},
  });
  vm.runInContext(bootstrap, context);
  return { context, listeners, reports, field, reloads: () => reloads };
}

test("Vite must propagate storage evaluation failures to the application boundary", () => {
  const f = fixture();
  let prevented = false;
  f.listeners.get("vite:preloadError")!({
    payload: { name: "BrowserStorageError", message: "Browser storage timeout" },
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, false, "preventDefault would turn a rejected import into undefined");
  assert.equal(f.reports.length, 0, "the owning application boundary reports the failure");
});

test("pre-React storage recovery preserves data and never tries release reload", async () => {
  const f = fixture();
  await vm.runInContext(`__opencraftRecoverRelease(Object.assign(new Error('Browser storage timeout'), {
    name: 'BrowserStorageError', storageDiagnostics: { storage: 'host-profiles', stage: 'opening', elapsedMs: 10000 }
  }))`, f.context);
  assert.equal(f.field("[data-recovery-title]").textContent, "暂时无法读取本地配置");
  assert.match(f.field("[data-recovery-summary]").textContent, /已保存的配置会保留/);
  assert.equal(f.field("[data-release-error]").hidden, true);
  assert.equal(f.field("[data-release-error]").textContent, "");
  assert.equal(f.reloads(), 0);
  assert.deepEqual(f.reports.map(report => report.url), ["/__opencraft_runtime_error"]);
  assert.equal(f.reports[0].body.source, "browser-storage-bootstrap");
  assert.equal(f.reports[0].body.storageDiagnostics.stage, "opening");
});

test("actual resource failures still use the existing release recovery", async () => {
  const f = fixture();
  let prevented = false;
  f.listeners.get("vite:preloadError")!({ payload: new Error("chunk unavailable"), preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(f.reports[0].url, /^\/version.json\?recovery=/);
  assert.equal(f.field("[data-recovery-title]").textContent, "界面资源未能加载");
  assert.equal(f.field("[data-release-error]").hidden, false);
});
