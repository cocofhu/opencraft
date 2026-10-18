/** Swipe right to reveal the left sidebar; swipe left to dismiss. */
export const MOBILE_SIDEBAR_REVEAL_DIRECTION = 1;
export const MOBILE_SIDEBAR_EDGE_RESERVE = 24;
// A visible front-page strip remains large enough to dismiss by touch.
export const MOBILE_SIDEBAR_PAGE_PEEK = 64;

/** Fit the normal sidebar width to the screen, retaining a dismissal gutter. */
export function mobileSidebarWidth(viewportWidth: number, savedWidth: number): number {
  return Math.min(Math.max(0, viewportWidth - MOBILE_SIDEBAR_PAGE_PEEK), Math.max(0, savedWidth));
}

export function sidebarGestureAxis(dx: number, dy: number): "pending" | "horizontal" | "vertical" {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return "pending";
  return Math.abs(dx) > Math.abs(dy) * 1.25 ? "horizontal" : "vertical";
}

export function sidebarGestureProgress(start: number, dx: number, width: number): number {
  return Math.max(0, Math.min(1, start + MOBILE_SIDEBAR_REVEAL_DIRECTION * dx / Math.max(1, width)));
}

/** Velocity is measured in reveal-direction px/ms over the last touch samples. */
export function sidebarGestureTarget(progress: number, velocity: number, travel: number, initiallyOpen: boolean): boolean {
  if (Math.abs(travel) >= 24 && Math.abs(velocity) >= 0.45) return velocity > 0;
  return progress >= (initiallyOpen ? 0.58 : 0.42);
}
