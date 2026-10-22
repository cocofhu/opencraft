import React from "react";
import { BrainArtwork } from "./icon-glyph";
import { DiffFileIcon as FileDiff, SquareIcon as Square } from "./interface-icons";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { readonly size?: number };

/** Process artwork shares one canvas and inherits its enclosing activity rail. */
function ActivityGlyph({ glyph, children, className, size = 20, ...props }: IconProps & { readonly glyph: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" className={["activity-glyph", className].filter(Boolean).join(" ")}
    data-opencraft-activity-icon={glyph} data-activity-glyph={glyph} {...props}>{children}</svg>;
}

export function ChangeResourceIcon(props: IconProps) {
  return <FileDiff size={24} {...props} />;
}

export function StopActivityIcon(props: IconProps) {
  return <Square size={20} fill="currentColor" {...props} />;
}

export function ThinkingActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="thinking" {...props}>
    <BrainArtwork detailClassName="activity-glyph__pulse" />
  </ActivityGlyph>;
}

export function TerminalActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="terminal" {...props}>
    <rect x="4" y="4" width="16" height="16" rx="3"/><path d="m7.5 9.5 2.5 2.5-2.5 2.5"/><path className="activity-glyph__cursor" d="M13.5 14.5H17"/>
  </ActivityGlyph>;
}

export function SearchActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="search" {...props}>
    <circle cx="10.75" cy="10.75" r="6.75"/><path d="m15.5 15.5 5 5"/><path className="activity-glyph__pulse" d="M7 8.5a4.3 4.3 0 0 1 3-1.5"/>
  </ActivityGlyph>;
}

export function ReadActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="read" data-rtl-flip="" {...props}>
    <path d="M12 6c-2.5-1.4-5.5-1.6-8.5-.7V18c3-.9 6-.7 8.5.7m0-12.7c2.5-1.4 5.5-1.6 8.5-.7V18c-3-.9-6-.7-8.5.7V6Z"/><path className="activity-glyph__pulse" d="M6.5 9h2.5m6 0h2.5"/>
  </ActivityGlyph>;
}

export function FilesActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="files" {...props}>
    <path d="M4 7a3 3 0 0 1 3-3h3l2 2.5h5a3 3 0 0 1 3 3V17a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Z"/>
  </ActivityGlyph>;
}

export function PatchActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="patch" {...props}>
    <path d="m5.5 14.5 9.8-9.8a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8l-9.8 9.8L4 20l1.5-5.5ZM14 6l4 4"/><path d="M14 20h6"/>
  </ActivityGlyph>;
}

export function GlobeActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="browser" {...props}>
    <circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c-4.2 4.5-4.2 11.5 0 16m0-16c4.2 4.5 4.2 11.5 0 16"/>
  </ActivityGlyph>;
}

export function AgentActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="agent" {...props}>
    <rect x="4" y="6.5" width="16" height="13" rx="3"/><path d="M12 3.5v3M9.5 15.5h5"/><circle cx="8.5" cy="11.5" r=".75" fill="currentColor" stroke="none"/><circle cx="15.5" cy="11.5" r=".75" fill="currentColor" stroke="none"/>
  </ActivityGlyph>;
}
