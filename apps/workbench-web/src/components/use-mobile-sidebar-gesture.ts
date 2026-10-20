import { animate, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { PANEL_SPRING_TRANSITION } from "./use-panel-animation";
import { MOBILE_SIDEBAR_EDGE_RESERVE, MOBILE_SIDEBAR_REVEAL_DIRECTION, sidebarGestureAxis, sidebarGestureProgress, sidebarGestureTarget } from "./mobile-sidebar-gesture";

interface Gesture {
  id: number; x: number; y: number; width: number; start: number; initiallyOpen: boolean;
  dragging: boolean; samples: { x: number; time: number }[];
}

function ownsHorizontalInput(target: Element, boundary: HTMLElement): boolean {
  for (let node: Element | null = target; node && node !== boundary; node = node.parentElement) {
    if (node.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="slider"],iframe,canvas,video,audio,.xterm,[data-sidebar-gesture="ignore"],[role="dialog"],[role="menu"],[role="listbox"]')) return true;
    if (node instanceof HTMLElement && node.scrollWidth > node.clientWidth + 1
      && /auto|scroll/.test(getComputedStyle(node).overflowX)) return true;
  }
  return false;
}

/** One visibility writer above the shared portal. Vertical/native input stays owned by its view. */
export function useMobileSidebarGesture({ enabled, open, width, root, overlay, onOpenChange }: {
  enabled: boolean; open: boolean; width: MotionValue<number>;
  root: RefObject<HTMLElement | null>; overlay: RefObject<HTMLElement | null>;
  onOpenChange(open: boolean): void;
}) {
  const reducedMotion = useReducedMotion() === true;
  const progress = useMotionValue(enabled && open ? 1 : 0);
  const [present, setPresent] = useState(enabled && open);
  const [dragging, setDragging] = useState(false);
  const latest = useRef({ open, onOpenChange, reducedMotion });
  latest.current = { open, onOpenChange, reducedMotion };
  const gesture = useRef<Gesture | null>(null);
  const generation = useRef(0);
  const target = useRef<boolean | null>(null);
  const suppressClick = useRef(0);
  const settle = (next: boolean) => {
    const receipt = ++generation.current;
    progress.stop();
    target.current = next;
    if (next) setPresent(true);
    const finish = () => { if (generation.current === receipt && !next) setPresent(false); };
    if (latest.current.reducedMotion) { progress.set(next ? 1 : 0); finish(); }
    else animate(progress, next ? 1 : 0, { ...PANEL_SPRING_TRANSITION, bounce: 0, onComplete: finish });
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;

  useLayoutEffect(() => {
    gesture.current = null;
    setDragging(false);
    if (!enabled) { ++generation.current; progress.stop(); progress.set(0); setPresent(false); target.current = null; }
    else if (target.current !== open || reducedMotion) settleRef.current(open);
  }, [enabled, open, reducedMotion, progress]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const cancel = () => {
      if (!gesture.current) return;
      const previous = gesture.current.initiallyOpen;
      if (gesture.current.dragging) suppressClick.current = performance.now() + 500;
      gesture.current = null; setDragging(false); settleRef.current(previous);
    };
    const start = (event: TouchEvent) => {
      // A fresh deliberate tap must remain usable immediately after a swipe.
      suppressClick.current = 0;
      if (event.touches.length !== 1) { cancel(); return; }
      const shell = root.current, surface = overlay.current;
      const node = event.target;
      if (!shell || !(node instanceof Element)) return;
      const boundary = surface?.contains(node) ? surface : shell.contains(node) ? shell : null;
      if (!boundary || document.querySelector('[role="dialog"],[role="menu"],[role="listbox"]') || window.getSelection()?.toString()) return;
      if (ownsHorizontalInput(node, boundary)) return;
      // Clickable content (reasoning disclosures, image previews, links) can
      // also start a swipe. Axis locking preserves taps/vertical scrolling;
      // the recognized drag suppresses its click in end/cancel below.
      const touch = event.touches[0]!;
      const viewport = shell.getBoundingClientRect();
      // Leave both screen edges to browser/OS navigation gestures.
      if (touch.clientX < viewport.left + MOBILE_SIDEBAR_EDGE_RESERVE || touch.clientX > viewport.right - MOBILE_SIDEBAR_EDGE_RESERVE) return;
      gesture.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY, width: width.get(), start: progress.get(), initiallyOpen: latest.current.open, dragging: false, samples: [{ x: touch.clientX, time: event.timeStamp }] };
    };
    const move = (event: TouchEvent) => {
      const transaction = gesture.current;
      if (!transaction) return;
      if (event.touches.length !== 1) { cancel(); return; }
      const touch = Array.from(event.touches).find(t => t.identifier === transaction.id);
      if (!touch) { cancel(); return; }
      const dx = touch.clientX - transaction.x, dy = touch.clientY - transaction.y;
      if (!transaction.dragging) {
        const axis = sidebarGestureAxis(dx, dy);
        if (axis === "pending") return;
        if (axis === "vertical" || (!transaction.initiallyOpen && dx * MOBILE_SIDEBAR_REVEAL_DIRECTION <= 0)) { gesture.current = null; return; }
        // During native scroll inertia a fresh horizontal sequence can already
        // be non-cancelable. It still owns drawer movement; only prevent the
        // browser default when supported, after the vertical/input exclusions.
        // Stop the old animation before reading its current position.
        progress.stop(); ++generation.current; target.current = null;
        transaction.start = progress.get(); transaction.dragging = true;
        setPresent(true); setDragging(true);
      }
      if (event.cancelable) event.preventDefault();
      progress.set(sidebarGestureProgress(transaction.start, dx, transaction.width));
      transaction.samples.push({ x: touch.clientX, time: event.timeStamp });
      transaction.samples = transaction.samples.filter(sample => sample.time >= event.timeStamp - 100);
    };
    const end = (event: TouchEvent) => {
      const transaction = gesture.current;
      if (!transaction || !Array.from(event.changedTouches).some(t => t.identifier === transaction.id)) return;
      gesture.current = null; setDragging(false);
      if (!transaction.dragging) return;
      if (event.cancelable) event.preventDefault();
      suppressClick.current = performance.now() + 500;
      const touch = Array.from(event.changedTouches).find(t => t.identifier === transaction.id)!;
      const first = transaction.samples[0]!;
      const velocity = event.timeStamp - first.time > 0 ? (touch.clientX - first.x) * MOBILE_SIDEBAR_REVEAL_DIRECTION / (event.timeStamp - first.time) : 0;
      const next = sidebarGestureTarget(progress.get(), velocity, touch.clientX - transaction.x, transaction.initiallyOpen);
      settleRef.current(next);
      if (next !== latest.current.open) latest.current.onOpenChange(next);
    };
    const click = (event: MouseEvent) => {
      if (performance.now() >= suppressClick.current) return;
      suppressClick.current = 0; event.preventDefault(); event.stopImmediatePropagation();
    };
    document.addEventListener("touchstart", start, { passive: true, capture: true });
    document.addEventListener("touchmove", move, { passive: false, capture: true });
    document.addEventListener("touchend", end, { passive: false, capture: true });
    document.addEventListener("touchcancel", cancel, true);
    document.addEventListener("click", click, true);
    window.addEventListener("resize", cancel);
    return () => {
      document.removeEventListener("touchstart", start, true); document.removeEventListener("touchmove", move, true);
      document.removeEventListener("touchend", end, true); document.removeEventListener("touchcancel", cancel, true);
      document.removeEventListener("click", click, true); window.removeEventListener("resize", cancel);
      gesture.current = null;
    };
  }, [enabled, overlay, root, progress, width]);
  useLayoutEffect(() => () => { ++generation.current; progress.stop(); }, [progress]);
  return { progress, present, dragging };
}
