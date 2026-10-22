import { ChevronRightIcon as ChevronRight } from "@opencraft/design-system-web/action-icons";
import { ActivityRowContent } from "./activity-row-content";
export { CadencedShimmer } from "./cadenced-shimmer";

import { motion, useReducedMotion } from "motion/react";
import { OverlayDisclosureTrigger } from "../../overlay-disclosure-trigger";
import { useDisclosureReflow } from "../../use-disclosure-reflow";
import { useDisclosureHeight } from "../../use-disclosure-height";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export function useActivityOpen(
  running: boolean,
  defaultExpanded = false,
): readonly [boolean, (next: boolean) => void] {
  const [runningCollapsed, setRunningCollapsed] = useState(false);
  const [settledExpanded, setSettledExpanded] = useState(defaultExpanded);
  const open = running ? !runningCollapsed : settledExpanded;
  const setOpen = useCallback((next: boolean) => {
    if (running) setRunningCollapsed(!next);
    else setSettledExpanded(next);
  }, [running]);
  return [open, setOpen];
}

export interface ActivityDisclosureProps {
  readonly accessory?: ReactNode;
  readonly bodyVariant?: "default" | "group" | "grouped" | "unindented";
  readonly children?: ReactNode;
  readonly detail?: ReactNode;
  readonly icon: ReactNode;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly running: boolean;
  readonly status?: "running" | "completed" | "failed" | "interrupted";
  readonly summary: ReactNode;
  readonly trailing?: ReactNode;
  readonly unmountBodyWhenCollapsed?: boolean;
}

export function ActivityDisclosure({
  accessory,
  bodyVariant = "default",
  children,
  detail,
  icon,
  onOpenChange,
  open,
  running,
  status = running ? "running" : "completed",
  summary,
  trailing,
  unmountBodyWhenCollapsed = false,
}: ActivityDisclosureProps) {
  const prefersReducedMotion = useReducedMotion();
  const reflow = useDisclosureReflow();
  const summaryId = useId();
  const hasBody = children !== null && children !== undefined;
  useLayoutEffect(() => {
    if (!hasBody) reflow.cancel();
  }, [hasBody, reflow.cancel]);
  const [bodyMounted, setBodyMounted] = useState(!unmountBodyWhenCollapsed || open);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyHeightPx, setBodyHeightPx] = useState(0);
  const animatedHeight = useDisclosureHeight(0);
  useLayoutEffect(() => {
    if (open && !bodyMounted) setBodyMounted(true);
  }, [bodyMounted, open]);
  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (element === null || !bodyMounted) return;
    const measure = () => setBodyHeightPx((current) => {
      const next = element.scrollHeight;
      return current === next ? current : next;
    });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [bodyMounted]);
  return (
    <div className="thread-activity-item" data-conversation-row="activity" data-body-variant={bodyVariant} data-open={open || undefined} data-status={status}>
      <OverlayDisclosureTrigger
        buttonClassName="thread-activity-item__hit-target"
        className="thread-activity-item__header"
        contentClassName="thread-activity-item__header-content"
        interactive={hasBody}
        labelId={summaryId}
        reflowOwned
        onToggle={(anchor) => {
          reflow.begin(anchor);
          if (!open && unmountBodyWhenCollapsed) setBodyMounted(true);
          onOpenChange(!open);
        }}
        open={open}
      >
          <ActivityRowContent icon={icon} summary={summary} running={running} summaryId={summaryId} />
          {detail ? <span className="thread-activity-item__detail">{detail}</span> : null}
          {trailing ? <span className="thread-activity-item__trailing">{trailing}</span> : null}
          {accessory ? <span className="thread-activity-item__accessory">{accessory}</span> : null}
          {hasBody ? <ChevronRight aria-hidden="true" className="thread-activity-item__chevron" size={13} /> : null}
      </OverlayDisclosureTrigger>
      {hasBody ? (
        <motion.div
          animate={{ height: open ? bodyHeightPx : 0, opacity: open ? 1 : 0 }}
          aria-hidden={!open}
          className="thread-activity-item__body-clip"
          initial={false}
          inert={!open}
          onAnimationComplete={(definition) => {
            if (typeof definition !== "object" || Array.isArray(definition)
              || definition.height !== (open ? bodyHeightPx : 0)) return;
            reflow.complete();
            if (!open && unmountBodyWhenCollapsed) setBodyMounted(false);
          }}
          style={{ height: animatedHeight, overflow: open ? "visible" : "hidden", pointerEvents: open ? "auto" : "none" }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.19, 1, 0.22, 1] }}
        >
          <div className="thread-activity-item__body" ref={bodyRef}>{bodyMounted ? children : null}</div>
        </motion.div>
      ) : null}
    </div>
  );
}
