import {
  calculateSoftwareKeyboardInset,
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
  /** Read the untransformed fixed frame before this port writes its projection. */
  readonly measureFixedFrame?: () => WebFixedViewportFrame | null;
}

export interface WebFixedViewportFrame {
  readonly topPx: number;
  readonly leftPx: number;
  readonly appliedTopPx: number;
  readonly appliedLeftPx: number;
}

/** Browser metrics and CSS fixed coordinates may have different origins. */
export function resolveWebFixedViewportOffset(
  snapshot: TimelineViewportSnapshot,
  frame: WebFixedViewportFrame | null = null,
): { readonly topPx: number; readonly leftPx: number } {
  return {
    topPx: snapshot.visualOffset.topPx - (frame === null ? 0 : frame.topPx - frame.appliedTopPx),
    leftPx: snapshot.visualOffset.leftPx - (frame === null ? 0 : frame.leftPx - frame.appliedLeftPx),
  };
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
  fixedOffset = resolveWebFixedViewportOffset(snapshot),
): void {
  root.dataset.timelineOverscroll = policy.threadOverscroll;
  root.dataset.timelineElasticEffect = String(policy.localElasticEffect);
  root.dataset.timelineTracksVisualViewport = String(policy.tracksVisualViewport);
  root.dataset.timelineKeyboardOpen = String(snapshot.keyboardInsetBottomPx > 0);
  root.style.setProperty("--timeline-layout-viewport-width", `${snapshot.layoutViewport.widthPx}px`);
  root.style.setProperty("--timeline-layout-viewport-height", `${snapshot.layoutViewport.heightPx}px`);
  root.style.setProperty("--timeline-visual-viewport-width", `${snapshot.visualViewport.widthPx}px`);
  root.style.setProperty("--timeline-visual-viewport-height", `${snapshot.visualViewport.heightPx}px`);
  root.style.setProperty("--timeline-visual-viewport-offset-left", `${snapshot.visualOffset.leftPx}px`);
  root.style.setProperty("--timeline-visual-viewport-offset-top", `${snapshot.visualOffset.topPx}px`);
  root.style.setProperty("--timeline-fixed-viewport-left", `${fixedOffset.leftPx}px`);
  root.style.setProperty("--timeline-fixed-viewport-top", `${fixedOffset.topPx}px`);
  root.style.setProperty("--timeline-keyboard-inset-bottom", `${snapshot.keyboardInsetBottomPx}px`);
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
      layoutHeightPx: windowObject.innerHeight,
      layoutWidthPx: windowObject.innerWidth,
      revision,
      scale: visualViewport?.scale ?? 1,
      visualHeightPx: visualViewport?.height,
      visualOffsetLeftPx: visualViewport?.offsetLeft,
      visualOffsetTopPx: visualViewport?.offsetTop,
      visualWidthPx: visualViewport?.width,
    });
  };
  let snapshot = read();
  const measureFixedOffset = (value: TimelineViewportSnapshot) => resolveWebFixedViewportOffset(
    value, policy.tracksVisualViewport ? options.measureFixedFrame?.() ?? null : null,
  );
  const fixedGeometryTolerancePx = 1 / Math.max(1, windowObject.devicePixelRatio || 1);
  let fixedOffset = measureFixedOffset(snapshot);
  applyTimelineViewportDocumentState(root, snapshot, policy, fixedOffset);

  const scheduleFrame = () => {
    if (frame === null && !disposed) frame = windowObject.requestAnimationFrame(publish);
  };
  const publish = (now: number) => {
    frame = null;
    if (disposed || documentObject.visibilityState === "hidden") return;
    const next = read();
    const nextFixedOffset = measureFixedOffset(next);
    if (
      next.editableFocused !== snapshot.editableFocused
      || next.scale !== snapshot.scale
      || next.layoutViewport.widthPx !== snapshot.layoutViewport.widthPx
      || next.layoutViewport.heightPx !== snapshot.layoutViewport.heightPx
      || next.visualViewport.widthPx !== snapshot.visualViewport.widthPx
      || next.visualViewport.heightPx !== snapshot.visualViewport.heightPx
      || next.visualOffset.leftPx !== snapshot.visualOffset.leftPx
      || next.visualOffset.topPx !== snapshot.visualOffset.topPx
      // Client rectangles quantize layout; do not feed subpixel readback noise
      // into another CSS write. The envelope remains within one physical pixel.
      || Math.abs(nextFixedOffset.topPx - fixedOffset.topPx) > fixedGeometryTolerancePx
      || Math.abs(nextFixedOffset.leftPx - fixedOffset.leftPx) > fixedGeometryTolerancePx
    ) {
      revision += 1;
      snapshot = { ...next, revision };
      fixedOffset = nextFixedOffset;
      applyTimelineViewportDocumentState(root, snapshot, policy, fixedOffset);
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
    },
  };
}
