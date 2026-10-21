import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { createWebTimelineViewportPort } from "../packages/timeline-host-web/src/viewport";

function fixture() {
  const dom = new JSDOM("<input value='preserve draft'>", { pretendToBeVisual: true });
  const win = dom.window;
  const oldHTMLElement = globalThis.HTMLElement;
  globalThis.HTMLElement = win.HTMLElement as unknown as typeof HTMLElement;
  Object.defineProperty(win.navigator, "userAgent", { value: "iPhone" });
  Object.defineProperty(win.document.documentElement, "clientHeight", { value: 688 });
  Object.defineProperty(win.document.documentElement, "clientWidth", { value: 402 });
  Object.defineProperty(win, "innerHeight", { value: 394 });
  Object.defineProperty(win, "innerWidth", { value: 402 });
  const visual = Object.assign(new win.EventTarget(), {
    width: 402, height: 394, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
  });
  Object.defineProperty(win, "visualViewport", { value: visual });
  const native = { top: 0, left: 0 };
  const getRect = win.HTMLElement.prototype.getBoundingClientRect;
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute("data-timeline-fixed-reference")) {
      return { top: native.top, left: native.left, x: native.left, y: native.top,
        width: 0, height: 0, right: native.left, bottom: native.top, toJSON: () => ({}) };
    }
    return getRect.call(this);
  };
  let now = 0, id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  win.performance.now = () => now;
  win.requestAnimationFrame = fn => { frames.set(++id, fn); return id; };
  win.cancelAnimationFrame = key => { frames.delete(key); };
  const port = createWebTimelineViewportPort(win as unknown as Window, win.document, { kind: "browser", platform: "linux" });
  const input = win.document.querySelector("input")!;
  const css = (axis: "top" | "left") => Number.parseFloat(win.document.documentElement.style.getPropertyValue(`--timeline-available-viewport-${axis}`));
  return { win, visual, native, port, input, frames, css,
    frame(at: number) { now = at; const work = [...frames.values()]; frames.clear(); work.forEach(fn => fn(now)); },
    scroll(top: number, left = 0) {
      Object.defineProperty(win, "scrollY", { configurable: true, value: top });
      Object.defineProperty(win, "scrollX", { configurable: true, value: left });
    },
    close() { port.dispose(); dom.window.close();
      if (oldHTMLElement === undefined) Reflect.deleteProperty(globalThis, "HTMLElement"); else globalThis.HTMLElement = oldHTMLElement; },
  };
}

test("fixed frame separates native fixed basis from reported visual offset in either update order", () => {
  const f = fixture();
  try {
    f.input.focus(); f.input.setSelectionRange(2, 2);
    const stages = [
      // Ordinary layout-relative client rectangles.
      { page: 294, scroll: 0, native: 0, offset: 294 },
      // WKWebView tuple seen on device, before and after native plane movement.
      { page: 294, scroll: 294, native: 0, offset: 294 },
      { page: 294, scroll: 294, native: -294, offset: 294 },
      // Native plane recovery may precede the final VisualViewport offset event.
      { page: 0, scroll: 0, native: 0, offset: 294 },
      { page: 0, scroll: 0, native: 0, offset: 0 },
      // The reverse ordering must also keep one coordinate conversion.
      { page: 0, scroll: 0, native: -294, offset: 0 },
      { page: 294, scroll: 294, native: -294, offset: 294 },
    ];
    stages.forEach((stage, i) => {
      Object.assign(f.visual, { pageTop: stage.page, offsetTop: stage.offset });
      f.scroll(stage.scroll); f.native.top = stage.native; f.frame(20 + i * 20);
      const visibleClientOrigin = stage.page - stage.scroll;
      assert.equal(f.css("top") + stage.native - visibleClientOrigin, 0, JSON.stringify(stage));
      assert.equal(f.win.document.documentElement.style.getPropertyValue("--timeline-available-viewport-height"), "394px");
    });
    assert.equal(f.port.getSnapshot().layoutViewport.heightPx, 688, "CSS layout extent is not innerHeight's visual reduction");
    assert.equal(f.port.getSnapshot().visualOffset.topPx, 294, "raw report remains raw");
    assert.equal(f.win.document.activeElement, f.input); assert.equal(f.input.selectionStart, 2);
    assert.equal(f.input.value, "preserve draft");
  } finally { f.close(); }
});

test("late native plane changes publish even when all raw viewport metrics are unchanged", () => {
  const f = fixture();
  try {
    f.frame(20); const before = f.port.getSnapshot();
    f.native.top = -294; f.frame(40);
    assert.equal(f.css("top"), 294);
    assert.equal(f.port.getSnapshot().revision, before.revision + 1);
    assert.deepEqual(f.port.getSnapshot().visualOffset, before.visualOffset);
    f.frame(60); assert.equal(f.port.getSnapshot().revision, before.revision + 1);
    f.native.top = 20; f.native.left = -25; f.scroll(0, 25); f.visual.pageLeft = 25; f.frame(80);
    assert.equal(f.css("top"), -20, "basis changes are signed, not clamped native pan");
    assert.equal(f.css("left"), 25);
    f.frame(1100); assert.equal(f.frames.size, 0, "no perpetual layout polling");
    f.port.dispose(); assert.equal(f.win.document.querySelector("[data-timeline-fixed-reference]"), null);
  } finally { f.close(); }
});

test("pinch magnification retains layout capacity and does not apply fixed-frame compensation", () => {
  const f = fixture();
  try {
    f.visual.scale = 2; f.visual.height = 197; f.native.top = -100; f.frame(20);
    assert.equal(f.css("top"), 0);
    assert.equal(f.win.document.documentElement.style.getPropertyValue("--timeline-available-viewport-height"), "688px");
  } finally { f.close(); }
});

test("a capacity commit measures the fixed basis after layout-induced native focus pan", () => {
  const f = fixture();
  try {
    f.visual.height = 688; f.frame(20);
    f.input.focus(); f.input.setSelectionRange(2, 2);
    const style = f.win.document.documentElement.style;
    const setProperty = style.setProperty.bind(style);
    style.setProperty = (name, value, priority) => {
      setProperty(name, value, priority);
      if (name === "--timeline-available-viewport-height" && value === "394px") {
        // On-device observation: capacity changes first, native focus pan then
        // changes the zero-inset fixed plane before subscribers/browser paint.
        f.native.top = -294; f.scroll(294);
        f.visual.pageTop = 294; f.visual.offsetTop = 294;
      }
    };
    const samples: number[] = [];
    f.port.subscribe(() => samples.push(f.css("top") + f.native.top - (f.visual.pageTop - f.win.scrollY)));
    f.visual.height = 394; f.frame(40);
    assert.deepEqual(samples, [0], "Subscribers must see the committed capacity and its current coordinate basis together");
    assert.equal(f.css("top"), 294);
    assert.equal(f.win.document.activeElement, f.input);
    assert.equal(f.input.selectionStart, 2); assert.equal(f.input.value, "preserve draft");
  } finally { f.close(); }
});

test("mobile viewport events commit before returning even after the current animation frame", () => {
  const f = fixture();
  try {
    f.frame(20);
    f.native.top = -294; f.scroll(294);
    Object.assign(f.visual, { height: 394, pageTop: 294, offsetTop: 294 });
    f.visual.dispatchEvent(new f.win.Event("resize"));
    assert.equal(f.css("top"), 294, "No stale origin while waiting for a later rAF");
    const revision = f.port.getSnapshot().revision;
    f.frame(40);
    assert.equal(f.port.getSnapshot().revision, revision, "Settling does not duplicate a committed observation");
    f.native.top = 0; f.scroll(0);
    Object.assign(f.visual, { height: 688, pageTop: 0, offsetTop: 0 });
    f.win.dispatchEvent(new f.win.Event("scroll"));
    assert.equal(f.css("top"), 0);
  } finally { f.close(); }
});
