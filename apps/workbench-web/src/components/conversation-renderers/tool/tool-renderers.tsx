import {
  codexAppThreadNavigationTarget, createdThreadToolResult,
  deriveSubagentActivityGroupPresentation, deriveSubagentActivityPresentation,
  extractToolCallContentParts, formatThreadHandoffStepLabel, isCodexAppThreadTool,
  threadHandoffToolResult, visibleThreadHandoffSteps,
  type SubagentActivityRenderUnit, type TimelineBlock, type ToolCallContentPart,
  type WebMcpToolSurfaceCall,
} from "@opencraft/chat-core";
import { LazyHighlightedCodeSurface, resolveStandardChatResource } from "@opencraft/chat-render-web";
import { Bot, Check, ChevronRight, Circle, Code2, Globe2, ImageIcon, LoaderCircle, MessageSquare, X } from "lucide-react";
import { lazy, Suspense, useCallback, useContext, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useDisclosureReflow } from "../../use-disclosure-reflow";
import { useDisclosureHeight } from "../../use-disclosure-height";
import { ConversationDocumentContext, browserReadableImageSource } from "../../conversation/document-context";
import { useConversationMediaSource } from "../../conversation/conversation-media-source";
import { ModalSurface } from "../../modal";
import { ActivityIcon, activityIcon } from "../activity/activity-icon";
import { AutomaticApprovalReviewIcon, AutomaticApprovalReviewList } from "../activity/command-and-review-renderers";
import { ActivityDisclosure, CadencedShimmer, useActivityOpen } from "../activity/activity-disclosure";
import {
  SubagentNavigationContext, ToolCallContentRendererContext, ToolCallIconRendererContext,
  useToolActivityPresentation,
} from "../render-contexts";

type Tool = Extract<TimelineBlock, { type: "tool-call" }>;
type Image = Extract<TimelineBlock, { type: "image" }>;
type AgentBlock = Extract<TimelineBlock, { type: "subagent" }>;
const AppSurface = lazy(() => import("../../../mcp-apps/app-surface"));

function json(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "";
}

export function JsonPreview({ value }: { value: unknown }) {
  return value == null ? <></> : <pre>{json(value)}</pre>;
}

function JsonSurface({ value, documentId }: { value: unknown; documentId: string }) {
  const { theme } = useContext(ConversationDocumentContext);
  return <LazyHighlightedCodeSurface code={json(value)} language="json" title="JSON"
    documentId={documentId} theme={theme} showActions={false} />;
}

function ResourceLink({ target, children }: { target: string; children: import("react").ReactNode }) {
  const context = useContext(ConversationDocumentContext);
  const decision = resolveStandardChatResource(target, { cwd: context.cwd, externalResourcePolicy: "allow" });
  return <a href={decision.allowed ? decision.target ?? undefined : undefined}
    onClick={event => {
      event.preventDefault();
      if (decision.allowed && decision.target !== null) context.onOpenResource?.(decision.target, decision);
    }}>{children}</a>;
}

function ToolImage({ source, alt, id }: { source: string; alt: string; id: string }) {
  const context = useContext(ConversationDocumentContext);
  const media = useConversationMediaSource(source, id, context.resolveImageSource);
  return media.source === null ? <span>{media.status === "loading" ? "Loading image…" : "Image unavailable"}</span>
    : <img src={media.source} alt={alt} onLoad={() => media.requestMeasurement("image-load")} />;
}

function ContentPart({ part, id }: { part: ToolCallContentPart; id: string }) {
  let body;
  switch (part.kind) {
    case "text":
      body = part.role === "error" ? <pre className="thread-tool-details__error">{part.text}</pre>
        : <div className="thread-tool-details__plaintext"><header>plaintext</header><pre>{part.text}</pre></div>;
      break;
    case "json": body = <JsonSurface value={part.value} documentId={id} />; break;
    case "unknown": body = <div className="thread-tool-details__unknown"><JsonPreview value={part.value} /></div>; break;
    case "image": body = <div className="thread-tool-details__image"><ToolImage source={part.source} alt={part.alt ?? "Tool image"} id={id} /></div>; break;
    case "audio": body = <audio className="thread-tool-details__audio" controls src={browserReadableImageSource(part.source, undefined) ?? undefined} />; break;
    case "resource-link": body = <div className="thread-tool-details__resource-link"><ResourceLink target={part.uri}>Read {part.name}</ResourceLink></div>; break;
    case "embedded-resource": body = <div className="thread-tool-details__embedded-resource">
      <div><b>URI</b><ResourceLink target={part.uri}>{part.uri}</ResourceLink></div>
      {part.mimeType ? <div><b>MIME type</b><span>{part.mimeType}</span></div> : null}
      {part.content !== null ? <div><b>Content</b><pre className="thread-tool-details__embedded-content">{part.content}</pre></div> : null}
    </div>; break;
  }
  return <section data-role={part.role}>{body}{part.annotations ? <div className="thread-tool-details__annotations">
    {part.annotations.audience.length > 0 ? <span>Audience: {part.annotations.audience.join(", ")}</span> : null}
    {part.annotations.priority !== null ? <span>Priority: {part.annotations.priority}</span> : null}
    {part.annotations.lastModified !== null ? <span>Last modified: {part.annotations.lastModified}</span> : null}
  </div> : null}</section>;
}

function WebToolCall({ call }: { call: WebMcpToolSurfaceCall }) {
  const [open, setOpen] = useState(false);
  return <ActivityDisclosure icon={<Globe2 />} summary={call.title ?? call.name} open={open}
    onOpenChange={setOpen} running={false} bodyVariant="grouped" unmountBodyWhenCollapsed>
    <div className="thread-tool-details">
      {call.description ? <p>{call.description}</p> : null}
      {call.sourceHostname ? <p>{call.sourceHostname}</p> : null}
      {call.readOnlyHint !== null ? <p>{call.readOnlyHint ? "Read only" : "May modify data"}</p> : null}
      {call.inputJson !== null ? <section data-role="input"><pre>{call.inputJson}</pre>{call.inputTruncated ? <small>Input truncated</small> : null}</section> : null}
      {call.outputJson !== null ? <section data-role="output"><pre>{call.outputJson}</pre>{call.outputTruncated ? <small>Output truncated</small> : null}</section> : null}
    </div>
  </ActivityDisclosure>;
}

function object(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function RawToolOutput({ block }: { block: Tool }) {
  const [open, setOpen] = useState(false);
  const title = "Raw " + [block.server ?? block.namespace, block.name].filter(Boolean).join(".") + " tool call output";
  const output = object(block.output);
  const value = {
    callId: block.callId,
    invocation: { server: block.server, tool: block.name, arguments: block.input },
    durationMs: block.durationMs,
    result: {
      type: block.errorMessage !== null || output?.isError === true ? "error" : "success",
      content: output?.content ?? [],
      structuredContent: output?.structuredContent ?? null,
      raw: block.output,
    },
  };
  return <><button type="button" className="thread-tool-details__raw" title="Show raw tool call output"
    aria-label="Show raw tool call output" onClick={() => setOpen(true)}><Code2 size={12} /></button>
    {open ? <ModalSurface label={title} size="wide" layer="nested" onDismiss={() => setOpen(false)}>
      <h2>{title}</h2><JsonSurface value={value} documentId={block.id + ":raw"} />
    </ModalSurface> : null}</>;
}

function ThreadTool({ block }: { block: Tool }) {
  const presentation = useToolActivityPresentation(block);
  const navigation = useContext(SubagentNavigationContext);
  const [open, setOpen] = useActivityOpen(presentation.state === "running");
  const created = createdThreadToolResult(block);
  const target = codexAppThreadNavigationTarget(block);
  const handoff = threadHandoffToolResult(block);
  if (created !== null) return <button type="button" className="thread-created-thread-card" aria-label="Open chat"
    disabled={navigation.open === null} onClick={() => navigation.open?.(created.threadId, created.title)}>
    <span className="thread-created-thread-card__icon"><MessageSquare size={14} /></span>
    <span className="thread-created-thread-card__copy"><strong>{created.title}</strong></span>
    <span className="thread-created-thread-card__action">Open chat <ChevronRight size={13} /></span>
  </button>;
  if (handoff !== null) {
    return <ActivityDisclosure icon={activityIcon(presentation.icon)} summary={presentation.summary} open={open} onOpenChange={setOpen}
      running={presentation.state === "running"} status={presentation.state} bodyVariant="unindented">
      <div className="thread-handoff-steps">{visibleThreadHandoffSteps(handoff).map((step, index) =>
        <div key={step.id + ":" + index} className="thread-handoff-step" data-status={step.status}>
          <span className="thread-handoff-step__icon" aria-label={({
            done: "Completed:", running: "Running:", failed: "Failed:", pending: "Pending:",
          } as const)[step.status]}>{step.status === "done" ? <Check size={14} />
            : step.status === "running" ? <LoaderCircle size={14} /> : step.status === "failed" ? <X size={14} /> : <Circle size={14} />}</span>
          <span>{formatThreadHandoffStepLabel(step.id, handoff)}</span>
        </div>)}
      </div>
    </ActivityDisclosure>;
  }
  const summary = <><ActivityIcon>{activityIcon(presentation.icon)}</ActivityIcon>
    <CadencedShimmer className="thread-activity-item__summary" active={presentation.state === "running"}>{presentation.summary}</CadencedShimmer></>;
  return target !== null ? <button type="button" className="thread-codex-app-tool-row thread-activity-item__header is-interactive" aria-label="Open chat"
    disabled={navigation.open === null} onClick={() => navigation.open?.(target.threadId, target.displayName)}>{summary}</button>
    : <div className="thread-codex-app-tool-row thread-activity-item__header">{summary}</div>;
}

export function ToolCallBlock({ block }: { block: Tool }) {
  const presentation = useToolActivityPresentation(block);
  const customContent = useContext(ToolCallContentRendererContext);
  const customIcon = useContext(ToolCallIconRendererContext);
  const content = customContent?.(block, presentation);
  const hasCustomBody = content !== undefined && content !== null && content !== false;
  const [mcpOpen, setMcpOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useActivityOpen(presentation.state === "running" && (presentation.canExpand || hasCustomBody));
  const [open, setOpen] = block.kind === "mcp" ? [mcpOpen, setMcpOpen] : [activityOpen, setActivityOpen];
  const icon = customIcon?.(block, presentation);
  if (block.kind === "image-view") return <ImageViewToolBlock block={block} />;
  if (isCodexAppThreadTool(block)) return <ThreadTool block={block} />;
  const parts = extractToolCallContentParts(block).filter(part => part.role !== "input");
  const hasCoreBody = presentation.canExpand;
  const coreBody = hasCoreBody ? <div className="thread-tool-details" data-kind={block.kind}>
    {parts.length > 0 ? parts.map((part, index) => <ContentPart key={index} part={part} id={block.id + ":" + index} />)
      : <p className="thread-tool-details__empty">Tool returned no content</p>}
    {block.appResourceUri !== null ? <Suspense fallback={null}><AppSurface block={block} /></Suspense> : null}
    <RawToolOutput block={block} />
  </div> : undefined;
  const body = content === undefined ? coreBody : content;
  return <><ActivityDisclosure icon={icon === undefined ? activityIcon(presentation.icon) : icon}
    summary={presentation.summary} detail={presentation.detail} open={open} onOpenChange={setOpen}
    running={presentation.state === "running"} status={presentation.state}
    bodyVariant={hasCoreBody || content !== undefined ? "grouped" : "default"}
    accessory={block.automaticApprovalReviews.length > 0 ? <AutomaticApprovalReviewIcon /> : undefined}
    unmountBodyWhenCollapsed>
    {hasCoreBody || content !== undefined ? <>{body}<AutomaticApprovalReviewList reviews={block.automaticApprovalReviews} /></> : undefined}
  </ActivityDisclosure>
    {block.webMcpCalls?.map((call, index) => <WebToolCall key={call.name + ":" + index} call={call} />)}
  </>;
}

function InspectedImage({ path, index, id }: { path: string; index: number; id: string }) {
  const context = useContext(ConversationDocumentContext);
  const media = useConversationMediaSource(path, id, context.resolveImageSource);
  const decision = resolveStandardChatResource(path, { cwd: context.cwd, externalResourcePolicy: "allow" });
  return <button type="button" className="thread-image-view__preview" title={path}
    aria-label={"Open inspected image " + (index + 1)} disabled={!decision.allowed || context.onOpenResource === undefined}
    onClick={() => {
      if (decision.allowed && decision.target !== null) context.onOpenResource?.(decision.target, decision);
    }}>{media.source !== null ? <img src={media.source} alt={path} onLoad={() => media.requestMeasurement("image-load")} />
      : <span>{media.status === "loading" ? "Loading image…" : "Image unavailable"}</span>}</button>;
}

export function ImageViewToolBlock({ block }: { readonly block: Tool }) {
  const [open, setOpen] = useState(false);
  const running = block.status === "pending" || block.status === "running";
  const paths = block.imagePaths ?? [];
  const summary = (running ? "Viewing " : "Viewed ") + (paths.length > 1 ? paths.length + " images" : "an image");
  return <ActivityDisclosure icon={<ImageIcon />} summary={summary} open={open} onOpenChange={setOpen}
    running={false} status={running ? "running" : block.status === "failed" ? "failed" : block.status === "interrupted" ? "interrupted" : "completed"} bodyVariant="grouped">
    {paths.length > 0 ? <div className="thread-image-view"><div className="thread-image-view__strip">{paths.map((path, index) =>
      <InspectedImage key={path + ":" + index} path={path} index={index} id={block.id + ":" + index} />)}</div></div> : undefined}
  </ActivityDisclosure>;
}

export function GeneratedImageBlock({ block }: { readonly block: Image }) {
  const context = useContext(ConversationDocumentContext);
  const source = context.resolveGeneratedImageSource?.(block) ?? block.uri ?? block.savedPath;
  const identity = JSON.stringify([context.hostId, context.conversationId, context.cwd, block.id, source]);
  return source === null ? <></> : <GeneratedImage key={identity} block={block} source={source} />;
}

function GeneratedImage({ block, source }: { block: Image; source: string }) {
  const context = useContext(ConversationDocumentContext);
  const [open, setOpen] = useState(false);
  const resolveDirect = useCallback((path: string) =>
    context.resolveGeneratedImageSource?.(block) ?? browserReadableImageSource(path, context.resolveImageSource),
  [block, context.resolveGeneratedImageSource, context.resolveImageSource]);
  const media = useConversationMediaSource(source, block.id, resolveDirect);
  if (media.source === null) return <></>;
  const alt = "Generated image 1";
  return <div className="thread-generated-image-gallery" data-testid="generated-image-gallery">
    <div className="thread-generated-image-preview-wrap">
      <button type="button" className="thread-generated-image-preview" data-testid="generated-image-preview"
        aria-label={alt} onClick={() => context.onOpenGeneratedImage ? context.onOpenGeneratedImage(block) : setOpen(true)}>
        <img src={media.source} alt={alt} draggable onLoad={() => media.requestMeasurement("image-load")} />
      </button>
      {context.onEditGeneratedImage ? <button type="button" className="thread-generated-image-edit"
        aria-label="Edit generated image 1" onClick={() => context.onEditGeneratedImage?.(block)}>Edit</button> : null}
    </div>
    {open ? <ModalSurface label={alt} className="thread-generated-image-lightbox__dialog" layer="nested"
      presentation="fullscreen" showCloseButton={false} onDismiss={() => setOpen(false)}>
      <img src={media.source} alt={alt} />
      <div className="thread-generated-image-lightbox__toolbar">
        <a href={media.source} download={block.savedPath?.split(/[\\/]/u).at(-1) ?? "generated-image.png"}>Save</a>
        <button type="button" aria-label="Close generated image 1" onClick={() => setOpen(false)}><X size={18} /></button>
      </div>
    </ModalSurface> : null}
  </div>;
}

type Agent = ReturnType<typeof deriveSubagentActivityPresentation>["agents"][number];
function Avatar({ agent }: { agent: Agent }) {
  // Stable presentation only; thread identity and status remain owned by core.
  let color = 0;
  for (const character of agent.threadId) color = (color * 31 + character.codePointAt(0)!) % 360;
  return <span className="thread-subagent-avatar" aria-hidden data-status={agent.status}
    style={{ "--agent-hue": color + "deg" } as CSSProperties}>{agent.displayName.slice(0, 1).toLocaleUpperCase()}</span>;
}

type AgentToggle = {
  readonly label: string; readonly open: boolean; readonly disabled: boolean;
  readonly onClick: (event: import("react").MouseEvent<HTMLButtonElement>) => void;
};

function Agents({ blocks, grouped, renderToggle }: {
  blocks: readonly AgentBlock[]; grouped: boolean;
  renderToggle: (props: AgentToggle) => import("react").ReactNode;
}) {
  const navigation = useContext(SubagentNavigationContext);
  const presentation = grouped ? deriveSubagentActivityGroupPresentation(blocks)
    : deriveSubagentActivityPresentation(blocks[0]!);
  const running = blocks.some(block => block.status === "running" || block.status === "pending");
  const [open, setOpen] = useActivityOpen(running);
  const reflow = useDisclosureReflow();
  const height = useDisclosureHeight("auto");
  return <section className="thread-subagent-activity" data-status={blocks.at(-1)?.status} data-open={open || undefined}>
    <div className="thread-subagent-activity__header">
      {renderToggle({ label: presentation.actionLabel, open, disabled: !presentation.expandable, onClick: event => {
          reflow.begin(event.currentTarget); setOpen(!open);
        } })}
      <div className="thread-subagent-chips">{presentation.agents.map(agent =>
        <button key={agent.threadId} type="button" className="thread-subagent-chip" data-status={agent.status}
          title={agent.model ?? undefined} aria-label={"Open " + agent.displayName + " subagent"}
          disabled={navigation.open === null} onClick={() => navigation.open?.(agent.threadId, agent.displayName)}>
          <Avatar agent={agent} /><span>{agent.displayName}</span>{agent.role ? <small>{agent.role}</small> : null}
        </button>)}</div>
      <span className="thread-subagent-activity__status">{presentation.groupStatusLabel}</span>
      {presentation.expandable ? <ChevronRight size={12} className="thread-subagent-activity__chevron" /> : null}
    </div>
    <AnimatePresence initial={false}>{open && presentation.expandable ? <motion.div className="thread-subagent-details"
      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      style={{ height }} transition={{ duration: 0.3 }} onAnimationComplete={reflow.complete}>
      <div className="thread-subagent-details__inner">
      {(grouped ? [blocks.at(-1)!] : blocks).map(block => {
        const detail = grouped ? presentation : deriveSubagentActivityPresentation(block);
        return <div key={block.id}>{detail.agents.map(agent => <div key={agent.threadId} className="thread-subagent-details__row" data-status={agent.status}>
          <Avatar agent={agent} /><div><p><span>{detail.actionLabel} </span><strong>{agent.displayName}</strong>
            {!grouped && block.prompt ? <> with the instructions: <span>{block.prompt}</span></> : !grouped && block.action ? <> · {block.action}</> : null}
            <small> · {agent.statusLabel}</small></p>
            {agent.statusMessage ? <p className="thread-subagent-details__message">{agent.statusMessage}</p> : null}
          </div></div>)}
          {!grouped && (block.reasoningEffort || block.agentPath) ? <p className="thread-subagent-details__meta">{[
            block.reasoningEffort ? "Reasoning: " + block.reasoningEffort : null, block.agentPath,
          ].filter(Boolean).join(" · ")}</p> : null}
        </div>;
      })}
    </div></motion.div> : null}</AnimatePresence>
  </section>;
}

export function SubagentBlock({ block }: { block: AgentBlock }) {
  return <Agents blocks={[block]} grouped={false} renderToggle={props =>
    <button type="button" className="thread-subagent-activity__toggle thread-activity-item__header"
      aria-expanded={props.open} disabled={props.disabled} onClick={props.onClick}>
      <ActivityIcon><Bot /></ActivityIcon><span className="thread-activity-item__summary">{props.label}</span>
    </button>} />;
}

export function SubagentActivityGroup({ unit }: { readonly unit: SubagentActivityRenderUnit }) {
  return unit.blocks.length > 0 ? <Agents blocks={unit.blocks} grouped renderToggle={props =>
    <button type="button" className="thread-subagent-activity__toggle thread-activity-item__header"
      aria-expanded={props.open} disabled={props.disabled} onClick={props.onClick}>
      <ActivityIcon><Bot /></ActivityIcon><span className="thread-activity-item__summary">{props.label}</span>
    </button>} /> : <></>;
}
