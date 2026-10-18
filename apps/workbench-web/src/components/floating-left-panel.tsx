// Structure and motion restored from Codex r1532:
// shared/finalize-floating-panel-size-06083.ts.
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import type { ReactNode } from "react";

import { PANEL_SPRING_TRANSITION } from "./use-panel-animation";
import { SidebarResizeHandle } from "./sidebar-resize-handle";

interface FloatingLeftPanelProps {
  readonly unified?: boolean;
  readonly children: ReactNode;
  readonly header: ReactNode;
  readonly footer?: ReactNode;
  readonly visible: boolean;
  readonly onExitComplete?: () => void;
  readonly width: number;
  readonly widthPx: MotionValue<string>;
  readonly mobileProgress?: MotionValue<number>;
  getCurrentWidth(): number;
  getMaximumWidth?(): number;
  onResize(width: number): void;
  onResizeEnd(width: number | null): void;
  onResizingChange(resizing: boolean): void;
}

export function FloatingLeftPanel({ unified,
  children,
  header,
  footer,
  visible,
  onExitComplete,
  width,
  widthPx,
  mobileProgress,
  getCurrentWidth,
  getMaximumWidth,
  onResize,
  onResizeEnd,
  onResizingChange,
}: FloatingLeftPanelProps) {
  return (
    <AnimatePresence initial={false} onExitComplete={onExitComplete}>
      {visible ? <FloatingLeftPanelContent
        key="floating-sidebar"
        unified={unified}
        children={children}
        header={header}
        footer={footer}
        width={width}
        widthPx={widthPx}
        mobileProgress={mobileProgress}
        getCurrentWidth={getCurrentWidth}
        getMaximumWidth={getMaximumWidth}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
        onResizingChange={onResizingChange}
      /> : null}
    </AnimatePresence>
  );
}

function FloatingLeftPanelContent({ unified,
  children,
  header,
  footer,
  width,
  widthPx,
  mobileProgress,
  getCurrentWidth,
  getMaximumWidth,
  onResize,
  onResizeEnd,
  onResizingChange,
}: Omit<FloatingLeftPanelProps, "visible" | "onExitComplete">) {
  const shouldReduceMotion = useReducedMotion() === true;
  const isPresent = useIsPresent();
  const mobile = mobileProgress !== undefined;
  const restingProgress = useMotionValue(1);
  const progress = mobileProgress ?? restingProgress;
  // The rear layer stays anchored while the foreground uncovers it. Keep
  // depth local to this layer, with no second animation or inherited variable.
  const scale = useTransform(progress, value => shouldReduceMotion ? 1 : 0.9 + 0.1 * Math.max(0, Math.min(1, value)));
  const opacity = useTransform(progress, value => shouldReduceMotion ? 1 : 0.45 + 0.55 * Math.max(0, Math.min(1, value)));
  const washOpacity = useTransform(progress, value => shouldReduceMotion ? 0 : 0.65 * (1 - Math.max(0, Math.min(1, value))));
  const transition = shouldReduceMotion || mobile ? { duration: 0 } : PANEL_SPRING_TRANSITION;

  return (
    <>
    <motion.div
          className="app-shell-floating-left-panel"
          data-pip-obstacle="app-shell-floating-left-panel"
          inert={!isPresent || undefined}
          aria-hidden={!isPresent || undefined}
          initial={shouldReduceMotion || mobile ? false : { opacity: 0, x: -8 }}
          animate={mobile ? undefined : { opacity: 1, x: 0 }}
          exit={mobile ? { opacity: 0 } : { opacity: 0, x: shouldReduceMotion ? 0 : -8 }}
          style={{ width: widthPx, ...(mobile ? { scale, opacity, transformOrigin: "0% 50%" } : {}), pointerEvents: isPresent ? "auto" : "none" }}
          transition={transition}
        >
          <aside
            className="app-shell-floating-left-panel__surface"
            data-testid="app-shell-floating-left-panel"
          >
            <motion.div
              className="app-shell-floating-left-panel__header"
              initial={shouldReduceMotion || mobile ? false : { x: 8 }}
              animate={{ x: 0 }}
              exit={{ x: shouldReduceMotion ? 0 : 8 }}
              transition={transition}
            >
              {header}
            </motion.div>
            <div className="app-shell-floating-left-panel__body">{children}</div>
            {footer ? <div className="app-shell-sidecar__footer">{footer}</div> : null}
          </aside>
          {!mobile ? <SidebarResizeHandle unified={unified}
            collapsible={false}
            getCurrentWidth={getCurrentWidth}
            getMaximumWidth={getMaximumWidth}
            width={width}
            onCollapse={() => undefined}
            onExpand={() => undefined}
            onResize={onResize}
            onResizeEnd={onResizeEnd}
            onResizingChange={onResizingChange}
          /> : null}
    </motion.div>
    {mobile ? <motion.div aria-hidden="true" className="app-shell-mobile-sidebar-wash"
      style={{ opacity: washOpacity }} /> : null}
    </>
  );
}
