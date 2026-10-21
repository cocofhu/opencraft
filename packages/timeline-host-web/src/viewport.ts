import {
  calculateSoftwareKeyboardInset,
  projectTimelineViewportLayout,
  resolveTimelineViewportPolicy,
  type TimelineRenderHostKind,
  type TimelineRenderPlatform,
  type TimelineViewportPolicy,
  type TimelineViewportPort,
  type TimelineViewportSnapshot,
} from "@opencraft/timeline-virtualizer";

interface WebTimelineViewportRoot {
  readonly dataset: DOMStringMap;
  readonly style: CSSStyleDeclaration;
}

export interface WebTimelineViewportOptions {
  readonly kind: Exclude<TimelineRenderHostKind, "native">;
  readonly platform: "darwin" | "win32" | "linux";
}

export function resolveWebTimelinePlatform({
  maxTouchPoints,
  navigatorPlatform,
  userAgent,
}: {
  readonly maxTouchPoints: number;
  readonly navigatorPlatform: string;
  readonly userAgent: string;
}): TimelineRenderPlatform {
  if (/Android/i.test(userAgent)) return "android";
  if (/iPad|iPhone|iPod/i.test(userAgent)) return "ios";
  if (/^Mac/i.test(navigatorPlatform) && maxTouchPoints > 1) return "ios";
  if (/Win/i.test(navigatorPlatform)) return "win32";
  if (/Mac/i.test(navigatorPlatform)) return "darwin";
  return "linux";
}

export function isEditableElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  return element.isContentEditable
    || element.closest("input:not([type='button']):not([type='checkbox']):not([type='radio']), textarea, [contenteditable='true']") !== null;
}

export function createWebTimelineViewportSnapshot({
  editableFocused,
  layoutHeightPx,
  layoutWidthPx,
  revision,
  scale = 1,
  visualHeightPx = layoutHeightPx,
  visualOffsetLeftPx = 0,
  visualOffsetTopPx = 0,
  visualWidthPx = layoutWidthPx,
}: {
  readonly editableFocused: boolean;
  readonly layoutHeightPx: number;
  readonly layoutWidthPx: number;
  readonly revision: number;
  readonly scale?: number;
  readonly visualHeightPx?: number;
  readonly visualOffsetLeftPx?: number;
  readonly visualOffsetTopPx?: number;
  readonly visualWidthPx?: number;
}): TimelineViewportSnapshot {
  return {
    revision,
    layoutViewport: {
      widthPx: Math.max(0, layoutWidthPx),
      heightPx: Math.max(0, layoutHeightPx),
    },
    visualViewport: {
      widthPx: Math.max(0, visualWidthPx),
      heightPx: Math.max(0, visualHeightPx),
    },
    visualOffset: {
      leftPx: Math.max(0, visualOffsetLeftPx),
      topPx: Math.max(0, visualOffsetTopPx),
    },
    scale,
    keyboardInsetBottomPx: calculateSoftwareKeyboardInset({
      editableFocused,
      layoutViewportHeightPx: layoutHeightPx,
      scale,
      visualOffsetTopPx,
      visualViewportHeightPx: visualHeightPx,
    }),
    editableFocused,
  };
}

export function applyTimelineViewportDocumentState(
  root: WebTimelineViewportRoot,
  snapshot: TimelineViewportSnapshot,
  policy: TimelineViewportPolicy,
  fixedFrameOffset = snapshot.visualOffset,
): void {
  const layout = projectTimelineViewportLayout(snapshot);
  root.dataset.timelineOverscroll = policy.threadOverscroll;
  root.dataset.timelineElasticEffect = String(policy.localElasticEffect);
  root.dataset.timelineTracksVisualViewport = String(policy.tracksVisualViewport);
  root.dataset.timelineKeyboardOpen = String(snapshot.keyboardInsetBottomPx > 0);
  root.style.setProperty("--timeline-layout-viewport-width", `${snapshot.layoutViewport.widthPx}px`);
  root.style.setProperty("--timeline-layout-viewport-height", `${snapshot.layoutViewport.heightPx}px`);
  root.style.setProperty("--timeline-available-viewport-width", `${layout.availableViewport.widthPx}px`);
  root.style.setProperty("--timeline-available-viewport-height", `${layout.availableViewport.heightPx}px`);
  // Capacity and the browser's fixed-position coordinate basis are independent.
  // The Web port measures that basis outside the positioned application tree.
  const followsVisualOrigin = policy.tracksVisualViewport && Math.abs(snapshot.scale - 1) <= 0.01;
  root.style.setProperty("--timeline-available-viewport-top", `${followsVisualOrigin ? fixedFrameOffset.topPx : 0}px`);
  root.style.setProperty("--timeline-available-viewport-left", `${followsVisualOrigin ? fixedFrameOffset.leftPx : 0}px`);
}

export function createWebTimelineViewportPort(
  windowObject: Window,
  documentObject: Document,
  options: WebTimelineViewportOptions,
): TimelineViewportPort {
  const listeners = new Set<() => void>();
  const root = documentObject.documentElement;
  const navigatorObject = windowObject.navigator;
  const resolvedPlatform = resolveWebTimelinePlatform({
    maxTouchPoints: navigatorObject.maxTouchPoints,
    navigatorPlatform: navigatorObject.platform,
    userAgent: navigatorObject.userAgent,
  });
  const policy = resolveTimelineViewportPolicy({
    kind: options.kind,
    platform: resolvedPlatform === "ios" || resolvedPlatform === "android"
      ? resolvedPlatform
      : options.platform,
  });
  // This zero-inset reference is never positioned by our viewport CSS. Reading
  // Shell's rectangle instead would feed our previous output back into input.
  // WKWebView may move the fixed plane independently of VisualViewport events.
  const fixedReference = policy.tracksVisualViewport ? documentObject.createElement("div") : null;
  if (fixedReference) {
    fixedReference.dataset.timelineFixedReference = "";
    fixedReference.setAttribute("aria-hidden", "true");
    fixedReference.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;margin:0;visibility:hidden;pointer-events:none;contain:strict;";
    documentObject.body.append(fixedReference);
  }
  let revision = 0;
  let frame: number | null = null;
  let disposed = false;
  // Native keyboard/browser chrome transitions can finish after their last
  // viewport event. Reconcile briefly, without a permanent polling owner.
  const settleDurationMs = policy.tracksVisualViewport ? 1_000 : 0;
  let settleUntil = 0;

  const read = (): TimelineViewportSnapshot => {
    const visualViewport = windowObject.visualViewport;
    return createWebTimelineViewportSnapshot({
      editableFocused: isEditableElement(documentObject.activeElement),
      // innerHeight can already describe the keyboard-reduced visual viewport
      // in WKWebView while the CSS layout viewport remains at its old height.
      layoutHeightPx: root.clientHeight || windowObject.innerHeight,
      layoutWidthPx: root.clientWidth || windowObject.innerWidth,
      revision,
      scale: visualViewport?.scale ?? 1,
      visualHeightPx: visualViewport?.height,
      visualOffsetLeftPx: visualViewport?.offsetLeft,
      visualOffsetTopPx: visualViewport?.offsetTop,
      visualWidthPx: visualViewport?.width,
    });
  };
  const readFixedFrameOffset = () => {
    if (!fixedReference) return { topPx: 0, leftPx: 0 };
    const visual = windowObject.visualViewport;
    const reference = fixedReference?.getBoundingClientRect();
    // Both terms are client coordinates. pageTop - scrollY supplies the visible
    // client origin without assuming offsetTop and native document pan update
    // atomically. Subtract the independently observed zero-inset fixed origin.
    return {
      topPx: (visual?.pageTop ?? windowObject.scrollY + (visual?.offsetTop ?? 0))
        - windowObject.scrollY - (reference?.top ?? 0),
      leftPx: (visual?.pageLeft ?? windowObject.scrollX + (visual?.offsetLeft ?? 0))
        - windowObject.scrollX - (reference?.left ?? 0),
    };
  };
  let snapshot = read();
  let fixedFrameOffset = readFixedFrameOffset();
  applyTimelineViewportDocumentState(root, snapshot, policy, fixedFrameOffset);

  const scheduleFrame = () => {
    if (frame === null && !disposed) frame = windowObject.requestAnimationFrame(publish);
  };
  const publish = (now: number) => {
    frame = null;
    if (disposed || documentObject.visibilityState === "hidden") return;
    const next = read();
    const nextFixedFrameOffset = readFixedFrameOffset();
    if (
      next.editableFocused !== snapshot.editableFocused
      || next.scale !== snapshot.scale
      || next.layoutViewport.widthPx !== snapshot.layoutViewport.widthPx
      || next.layoutViewport.heightPx !== snapshot.layoutViewport.heightPx
      || next.visualViewport.widthPx !== snapshot.visualViewport.widthPx
      || next.visualViewport.heightPx !== snapshot.visualViewport.heightPx
      || next.visualOffset.leftPx !== snapshot.visualOffset.leftPx
      || next.visualOffset.topPx !== snapshot.visualOffset.topPx
      || nextFixedFrameOffset.topPx !== fixedFrameOffset.topPx
      || nextFixedFrameOffset.leftPx !== fixedFrameOffset.leftPx
    ) {
      revision += 1;
      snapshot = { ...next, revision };
      fixedFrameOffset = nextFixedFrameOffset;
      applyTimelineViewportDocumentState(root, snapshot, policy, fixedFrameOffset);
      for (const listener of listeners) listener();
    }
    if (now < settleUntil) scheduleFrame();
  };
  const schedule = () => {
    if (disposed) return;
    if (documentObject.visibilityState === "hidden") {
      if (frame !== null) windowObject.cancelAnimationFrame(frame);
      frame = null;
      settleUntil = 0;
      return;
    }
    settleUntil = windowObject.performance.now() + settleDurationMs;
    scheduleFrame();
  };
  const visualViewport = windowObject.visualViewport;
  windowObject.addEventListener("resize", schedule, { passive: true });
  windowObject.addEventListener("scroll", schedule, { passive: true });
  visualViewport?.addEventListener("resize", schedule, { passive: true });
  visualViewport?.addEventListener("scroll", schedule, { passive: true });
  documentObject.addEventListener("focusin", schedule, { passive: true });
  documentObject.addEventListener("focusout", schedule, { passive: true });
  if (policy.tracksVisualViewport) {
    windowObject.addEventListener("pageshow", schedule, { passive: true });
    windowObject.addEventListener("focus", schedule, { passive: true });
    windowObject.addEventListener("orientationchange", schedule, { passive: true });
    documentObject.addEventListener("visibilitychange", schedule, { passive: true });
    // Observation only: a missed terminal event must not survive the next
    // interaction, including descendants that stop bubbling. Input stays native.
    documentObject.addEventListener("touchstart", schedule, { passive: true, capture: true });
    schedule();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame !== null) windowObject.cancelAnimationFrame(frame);
      frame = null;
      windowObject.removeEventListener("resize", schedule);
      windowObject.removeEventListener("scroll", schedule);
      visualViewport?.removeEventListener("resize", schedule);
      visualViewport?.removeEventListener("scroll", schedule);
      documentObject.removeEventListener("focusin", schedule);
      documentObject.removeEventListener("focusout", schedule);
      if (policy.tracksVisualViewport) {
        windowObject.removeEventListener("pageshow", schedule);
        windowObject.removeEventListener("focus", schedule);
        windowObject.removeEventListener("orientationchange", schedule);
        documentObject.removeEventListener("visibilitychange", schedule);
        documentObject.removeEventListener("touchstart", schedule, true);
      }
      listeners.clear();
      fixedReference?.remove();
    },
  };
}
