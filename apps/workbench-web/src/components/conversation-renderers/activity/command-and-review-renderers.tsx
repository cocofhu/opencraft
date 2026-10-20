import {
  formatAutomaticApprovalReviewSummary,
  formatAutomaticApprovalReviewTitle,
  formatCodexToolDuration,
  formatCommandActivitySummary,
  isAutomaticApprovalReviewWarning,
  presentReasoning,
  skillReadPresentation,
  summarizeAutomaticApprovalReviewAction,
  type AutomaticApprovalReview,
  type ReasoningContentPresentation,
  type TimelineBlock,
} from "@opencraft/chat-core";
import {
  AnsiTerminalText,
  WebChatDocument,
  normalizeTerminalOutput,
  resolveStandardChatResource,
  writeTextToClipboard,
  writeToClipboard,
} from "@opencraft/chat-render-web";
import { useIntl } from "@opencraft/i18n/react";
import { AlertCircle, Brain, Check, ChevronRight, Copy, Shield, Terminal } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ConversationDocumentContext } from "../../conversation/document-context";
import { ThinkingLabel } from "../../thinking-label";
import { useWorkbenchPresentationActive } from "../../workbench-presentation-activity";
import { ConversationDetailContext, useToolActivityPresentation } from "../render-contexts";
import { ActivityDisclosure, CadencedShimmer, useCodexActivityOpen } from "./activity-disclosure";
import { activityIcon } from "./activity-icon";


export function ReasoningBlock({ block, presentation, active = block.streaming, collapsed, onCollapsedChange }: {
  readonly block: Extract<TimelineBlock, { type: "reasoning" }>;
  readonly presentation?: ReasoningContentPresentation;
  readonly active?: boolean;
  readonly collapsed?: boolean;
  readonly onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const document = useContext(ConversationDocumentContext);
  const intl = useIntl();
  const [localCollapsed, setLocalCollapsed] = useState(true);
  const selected = presentation ?? presentReasoning(block, active);
  const open = !(collapsed ?? localCollapsed);
  if (selected === null) return <></>;
  return <div className="thread-reasoning" data-conversation-row="activity" data-reasoning-id={block.id} data-reasoning-active={active}>
    <ActivityDisclosure
      icon={<Brain />}
      summary={active ? <ThinkingLabel /> : intl.formatMessage({ id: "chat.thought", defaultMessage: "Thought" })}
      detail={selected.header}
      running={active}
      open={open}
      onOpenChange={next => (onCollapsedChange ?? setLocalCollapsed)(!next)}
      unmountBodyWhenCollapsed
    >
      <div className="thread-activity-item__prose">
        <WebChatDocument documentId={`reasoning:${block.id}`} source={selected.content} streaming={active}
          conversationId={document.conversationId} hostId={document.hostId} cwd={document.cwd} theme={document.theme}
          onOpenResource={document.onOpenResource} loadMediaSource={document.loadMediaSource}
          onMeasurementRequest={document.onMeasurementRequest} />
      </div>
    </ActivityDisclosure>
  </div>;
}

/** Generic shield and terminal assembled from the project's licensed Lucide primitives. */
export function AutomaticApprovalReviewIcon() {
  return <Shield aria-hidden="true"><Terminal x={6} y={6} width={12} height={12} strokeWidth={2} /></Shield>;
}

function ReviewAssessment({ review }: { readonly review: AutomaticApprovalReview }) {
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();
  const running = review.status === "inProgress";
  return <div className="thread-auto-review" data-status={review.status} data-warning={isAutomaticApprovalReviewWarning(review) || undefined}>
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      <CadencedShimmer active={running}>{formatAutomaticApprovalReviewTitle(review)}</CadencedShimmer>
      <ChevronRight aria-hidden="true" size={12} />
    </button>
    <AnimatePresence initial={false}>
      {expanded ? <motion.p key="assessment" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.15 }}>
        {formatAutomaticApprovalReviewSummary(review)}
      </motion.p> : null}
    </AnimatePresence>
  </div>;
}

export function AutomaticApprovalReviewList({ reviews }: { readonly reviews: readonly AutomaticApprovalReview[] }) {
  return <div className="thread-auto-review-list">{reviews.map(review => <ReviewAssessment key={review.id} review={review} />)}</div>;
}

export function AutomaticApprovalReviewBlock({ block }: { readonly block: Extract<TimelineBlock, { type: "automatic-approval-review" }> }) {
  const review = block.review;
  const running = review.status === "inProgress";
  const [open, setOpen] = useCodexActivityOpen(running);
  return <ActivityDisclosure icon={<AutomaticApprovalReviewIcon />} summary={summarizeAutomaticApprovalReviewAction(review.action)}
    running={running} status={running ? "running" : review.status === "denied" ? "failed" : review.status === "aborted" ? "interrupted" : "completed"}
    open={open} onOpenChange={setOpen}>
    <ReviewAssessment review={review} />
  </ActivityDisclosure>;
}

export function AutoReviewInterruptionWarningBlock({ block }: { readonly block: Extract<TimelineBlock, { type: "auto-review-interruption-warning" }> }) {
  return <div className="thread-event-divider thread-auto-review-interruption"><span>
    <AutomaticApprovalReviewIcon />{block.message}<i aria-label={block.detail} title={block.detail}><AlertCircle aria-hidden="true" size={12} /></i>
  </span></div>;
}

/** Feedback belongs to the mounted action; clipboard policy stays in the shared port. */
function useCopyFeedback() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  useEffect(() => () => {
    generation.current++;
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  const perform = async (write: () => Promise<void>) => {
    const current = ++generation.current;
    try { await write(); } catch { return; }
    if (generation.current !== current) return;
    setCopied(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; setCopied(false); }, 1500);
  };
  return { copied, perform };
}

export function AssistantCopyButton({ value, getHtml, label }: {
  readonly value: string;
  readonly getHtml?: () => string | null;
  readonly label?: string;
}) {
  const intl = useIntl();
  const { copied, perform } = useCopyFeedback();
  const accessibleLabel = copied ? intl.formatMessage({ id: "common.copied", defaultMessage: "Copied" })
    : label ?? intl.formatMessage({ id: "chat.response.copy", defaultMessage: "Copy response" });
  return <button type="button" aria-label={accessibleLabel} title={accessibleLabel} onClick={() => void perform(() => {
    const html = getHtml?.();
    return html ? writeToClipboard({ "text/plain": value, "text/html": html }) : writeTextToClipboard(value);
  })}>{copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}</button>;
}

function TerminalCopyButton({ value, label }: { readonly value: string; readonly label: string }) {
  const { copied, perform } = useCopyFeedback();
  const intl = useIntl();
  const title = copied ? intl.formatMessage({ id: "common.copied", defaultMessage: "Copied" }) : label;
  return <button type="button" className={`thread-shell-output__copy ${copied ? "is-copied" : ""}`} title={title} aria-label={title}
    onClick={() => void perform(() => writeTextToClipboard(value))}>
    {copied ? <Check aria-hidden="true" size={12} /> : <Copy aria-hidden="true" size={12} />}
  </button>;
}

function CommandOutput({ block, running }: { readonly block: Extract<TimelineBlock, { type: "command-execution" }>; readonly running: boolean }) {
  const intl = useIntl();
  const output = normalizeTerminalOutput(block.output ?? "");
  return <div className="thread-shell-output" title={block.cwd === null ? undefined : `cwd\n${block.cwd}`}>
    <div className="thread-shell-output__command"><code><span aria-hidden="true">$ </span><span>{block.command}</span></code>
      <TerminalCopyButton value={block.command} label={intl.formatMessage({ id: "chat.command.copy", defaultMessage: "Copy command" })} />
    </div>
    <div className="thread-shell-output__output"><pre><code>{output ? <AnsiTerminalText>{output}</AnsiTerminalText> : block.resultMissing ? "Execution result unavailable" : "No output"}</code></pre>
      {output ? <TerminalCopyButton value={output} label={intl.formatMessage({ id: "chat.output.copy", defaultMessage: "Copy output" })} /> : null}
    </div>
    {!running ? <div className="thread-shell-output__footer" data-status={block.status}><span>
      {block.resultMissing ? "Result unknown" : block.status === "interrupted" ? "Stopped" : block.exitCode === 0 ? <><Check aria-hidden="true" size={12} /> Success</> : `Exit code ${block.exitCode ?? "unknown"}`}
    </span></div> : null}
  </div>;
}

function useCommandElapsed(block: Extract<TimelineBlock, { type: "command-execution" }>, running: boolean) {
  const active = useWorkbenchPresentationActive();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!running || !active || block.startedAtMs === null) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [active, running, block.startedAtMs]);
  return running && block.startedAtMs !== null ? Math.max(0, now - block.startedAtMs) : block.durationMs;
}

export function CommandBlock({ block }: { block: Extract<TimelineBlock, { type: "command-execution" }> }) {
  const presentation = useToolActivityPresentation(block);
  const detailLevel = useContext(ConversationDetailContext);
  const document = useContext(ConversationDocumentContext);
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const running = presentation.state === "running";
  const elapsed = useCommandElapsed(block, running);
  const skill = skillReadPresentation(block, detailLevel);
  const read = block.actions.length === 1 && block.actions[0]?.type === "read" ? block.actions[0] : null;
  let detail: ReactNode = skill?.detail ?? presentation.detail;
  if (skill === null && read !== null && document.onOpenResource !== undefined) {
    const decision = resolveStandardChatResource(read.path || read.name, { cwd: document.cwd ?? block.cwd, externalResourcePolicy: "allow" });
    if (decision.allowed && decision.target !== null) detail = <button type="button" className="thread-activity-item__file-link"
      onClick={() => document.onOpenResource?.(decision.target!, decision)}>{presentation.detail ?? read.name}</button>;
  }
  const semanticAction = block.actions.length === 1 && block.actions[0]?.type !== "unknown";
  const isTerminal = !semanticAction;
  const label = isTerminal ? formatCommandActivitySummary(block, presentation.state, { expanded: open,
    elapsedLabel: elapsed === null ? null : formatCodexToolDuration(elapsed, intl.locale) }) : skill?.summary ?? presentation.summary;
  if (skill?.visible === false) return <></>;
  return <ActivityDisclosure icon={activityIcon(presentation.icon)} summary={label} detail={detail}
    running={running} status={presentation.state} open={open} onOpenChange={setOpen} unmountBodyWhenCollapsed
    accessory={block.automaticApprovalReviews.length ? <AutomaticApprovalReviewIcon /> : undefined}>
    {isTerminal && presentation.canExpand ? <>
      <CommandOutput block={block} running={running} />
      {block.automaticApprovalReviews.length ? <AutomaticApprovalReviewList reviews={block.automaticApprovalReviews} /> : null}
    </> : null}
  </ActivityDisclosure>;
}
