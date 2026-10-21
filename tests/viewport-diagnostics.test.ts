import assert from "node:assert/strict";
import test from "node:test";
import { createViewportDiagnostics } from "../apps/workbench-web/src/runtime/viewport-diagnostics";

function fixture(t: test.TestContext) {
  let now = 0;
  let top = 0;
  let revision = "a".repeat(40);
  const reports: Record<string, number | string>[] = [];
  class Element {
    isContentEditable = true;
    getBoundingClientRect() { return { top, height: 394, bottom: top + 394 }; }
  }
  const shell = new Element();
  const doc = {
    visibilityState: "visible",
    documentElement: Object.assign(new Element(), { clientHeight: 688 }),
    body: new Element(), activeElement: shell,
    querySelector(selector: string) {
      return selector.startsWith("meta") ? { content: revision } : shell;
    },
  };
  const values = {
    document: doc, HTMLElement: Element, innerHeight: 394, innerWidth: 390, scrollY: 294,
    window: {
      visualViewport: { height: 394, width: 390, offsetTop: 294, offsetLeft: 0, pageTop: 294, scale: 1 },
      getComputedStyle: () => ({ top: "294px", height: "394px" }),
    },
  };
  for (const [key, value] of Object.entries(values)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => { if (previous) Object.defineProperty(globalThis, key, previous); else Reflect.deleteProperty(globalThis, key); });
  }
  t.mock.method(performance, "now", () => now);
  t.mock.method(globalThis, "fetch", async (_input: unknown, init: RequestInit) => {
    reports.push(JSON.parse(String(init.body)));
    return new Response("{}", { status: 202 });
  });
  return { reports, doc, advance(ms: number) { now += ms; top++; }, revision(value: string) { revision = value; } };
}

test("long-lived pages retain evidence after the first 64 keyboard observations", t => {
  const f = fixture(t), report = createViewportDiagnostics();
  for (let i = 0; i < 96; i++) { f.advance(1_000); report(); }
  assert.equal(f.reports.length, 96, "Later keyboard cycles must not become permanently invisible");
  const last = f.reports.at(-1)!;
  assert.equal(last.sourceRevision, "a".repeat(40));
  assert.equal(last.cssTop, 294);
  assert.equal(last.clientHeight, 688);
  assert.equal(last.shellTop, 96);
  assert.equal(last.scrollY, 294);
  assert.doesNotMatch(JSON.stringify(last), /text|route|account|userAgent/);
});

test("sustained geometry changes stay rate bounded and observation recovers after idle", t => {
  const f = fixture(t), report = createViewportDiagnostics();
  for (let i = 0; i < 1_000; i++) { f.advance(80); report(); }
  assert.ok(f.reports.length > 64);
  assert.ok(f.reports.length <= 64 + 8 * 80, "At most the burst allowance plus eight reports per second");
  const before = f.reports.length;
  f.advance(10_000); report();
  assert.equal(f.reports.length, before + 1);
  report();
  assert.equal(f.reports.length, before + 1, "Identical observations are not transmitted twice");
});

test("hidden pages and missing client revisions cannot consume later valid observations", t => {
  const f = fixture(t), report = createViewportDiagnostics();
  f.revision("");
  for (let i = 0; i < 80; i++) { f.advance(80); report(); }
  assert.equal(f.reports.length, 0);
  f.revision("a".repeat(40)); f.doc.visibilityState = "hidden"; report();
  assert.equal(f.reports.length, 0);
  f.doc.visibilityState = "visible"; report();
  assert.equal(f.reports.length, 1);
});
