import { ChevronRightIcon as ChevronRight } from "@opencraft/design-system-web/action-icons";
import React, { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { motion, useReducedMotion } from "motion/react";
import { ActivityIcon } from "./conversation-renderers/activity/activity-icon";
import { OverlayDisclosureTrigger } from "./overlay-disclosure-trigger";
import { useDisclosureHeight } from "./use-disclosure-height";
import { useDisclosureReflow } from "./use-disclosure-reflow";

export type AgentActivityDisclosurePhase = "collapsed" | "opening" | "expanded" | "closing";
export type AgentActivityDisclosureEvent = "toggle" | "animation-frame" | "animation-complete" | "disable";
export type AgentActivitySummaryTransition = "static" | "immediate" | "deferred";


export function reduceAgentActivityDisclosurePhase(
  phase: AgentActivityDisclosurePhase,
  event: AgentActivityDisclosureEvent,
): AgentActivityDisclosurePhase {
  if (event === "disable") return "collapsed";
  if (event === "toggle") {
    const toggled: Record<AgentActivityDisclosurePhase, AgentActivityDisclosurePhase> = {
      collapsed: "opening", opening: "closing", expanded: "closing", closing: "expanded",
    };
    return toggled[phase];
  }
  if (phase === "opening" && event === "animation-frame") return "expanded";
  if (phase === "closing" && event === "animation-complete") return "collapsed";
  return phase;
}

export function AgentActivityGroupDisclosure({
  canExpand = true, children, defaultExpanded = false, collapsed, icon,
  onExpand, onCollapsedChange, shouldAnimateInitialCollapse = false,
  summary, summaryKey, summaryTransition = "static",
}: {
  canExpand?: boolean;
  children: ReactNode | (() => ReactNode);
  defaultExpanded?: boolean;
  collapsed?: boolean;
  icon?: ReactNode;
  onExpand?: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  shouldAnimateInitialCollapse?: boolean;
  summary: ReactNode;
  summaryKey: string;
  summaryTransition?: AgentActivitySummaryTransition;
}) {
  const reduced = useReducedMotion();
  const labelId = useId();
  const [phase, setPhase] = useState<AgentActivityDisclosurePhase>(() => {
    if (!canExpand) return "collapsed";
    if (collapsed === false || (collapsed === undefined && defaultExpanded)) return "expanded";
    return shouldAnimateInitialCollapse ? "expanded" : "collapsed";
  });
  const previousCollapsed = useRef(collapsed);
  const previousCanExpand = useRef(canExpand);
  const initialCollapse = useRef(shouldAnimateInitialCollapse && (collapsed === true || (collapsed === undefined && !defaultExpanded)));
  const reflow = useDisclosureReflow();
  const height = useDisclosureHeight(phase === "expanded" || phase === "closing" ? "auto" : 0);
  const open = phase === "opening" || phase === "expanded";

  useEffect(() => {
    if (!canExpand) { reflow.cancel(); setPhase("collapsed"); }
    else if (initialCollapse.current) {
      setPhase(reduced ? "collapsed" : "closing");
    } else if ((previousCollapsed.current !== collapsed || previousCanExpand.current !== canExpand) && collapsed !== undefined) {
      setPhase(current => collapsed ? current === "collapsed" ? current : "closing" : "expanded");
    }
    previousCollapsed.current = collapsed;
    previousCanExpand.current = canExpand;
    initialCollapse.current = false;
  }, [canExpand, collapsed, reflow.cancel]);

  useEffect(() => {
    if (phase !== "opening") return;
    const frame = requestAnimationFrame(() => setPhase(current => reduceAgentActivityDisclosurePhase(current, "animation-frame")));
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  // Live text for this key need not replace its committed snapshot while a
  // later key waits for the next summary slot.
  const [label, setLabel] = useState({ key: summaryKey, content: summary });
  const lastLabelCommit = useRef(Date.now());
  useEffect(() => {
    if (label.key === summaryKey) return;
    const remaining = 1000 - (Date.now() - lastLabelCommit.current);
    if (summaryTransition !== "deferred" || remaining <= 0) {
      lastLabelCommit.current = Date.now();
      setLabel({ key: summaryKey, content: summary });
      return;
    }
    const timer = setTimeout(() => {
      lastLabelCommit.current = Date.now();
      setLabel({ key: summaryKey, content: summary });
    }, remaining);
    return () => clearTimeout(timer);
  }, [summary, summaryKey, summaryTransition, reduced, label.key]);

  const toggle = (anchor: HTMLButtonElement) => {
    reflow.begin(anchor);
    const next = reduceAgentActivityDisclosurePhase(phase, "toggle");
    const nextOpen = next === "opening" || next === "expanded";
    setPhase(next);
    if (nextOpen) onExpand?.();
    onCollapsedChange?.(!nextOpen);
  };
  return (
    <div className="thread-activity-item thread-agent-activity__group-disclosure"
      data-conversation-row="activity" data-body-variant="group"
      data-disclosure-phase={phase} data-open={open || undefined}>
      <OverlayDisclosureTrigger
        className="thread-activity-item__header" contentClassName="thread-activity-item__header-content"
        buttonClassName="thread-activity-item__hit-target" interactive={canExpand}
        labelId={labelId} open={open} onToggle={toggle} reflowOwned>
        {icon != null ? <ActivityIcon>{icon}</ActivityIcon> : null}
        <span className="thread-activity-item__summary" id={labelId}>
          {summaryTransition === "static" ? summary : <span className="thread-agent-activity__deferred-summary">{label.key === summaryKey || summaryTransition === "immediate" ? summary : label.content}</span>}
        </span>
        {canExpand ? <ChevronRight size={13} className="thread-activity-item__chevron" aria-hidden="true" /> : null}
      </OverlayDisclosureTrigger>
      {phase !== "collapsed" ? (
        <motion.div className="thread-activity-item__body-clip" data-disclosure-phase={phase}
          aria-hidden={!open} initial={false}
          style={{ height, overflow: "hidden", pointerEvents: open ? "auto" : "none" }}
          animate={{ height: phase === "expanded" ? "auto" : 0, opacity: phase === "expanded" ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.15, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={() => {
            setPhase(current => reduceAgentActivityDisclosurePhase(current, "animation-complete"));
            reflow.complete();
          }}>
          <div className="thread-activity-item__body">{typeof children === "function" ? children() : children}</div>
        </motion.div>
      ) : null}
    </div>
  );
}
