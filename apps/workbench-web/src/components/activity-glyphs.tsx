import { FileDiff, Square } from "lucide-react";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Process artwork shares one canvas and inherits its enclosing activity rail. */
function ActivityGlyph({ glyph, children, className, ...props }: IconProps & { readonly glyph: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24"
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
    <path d="M11.9 6.7C11.9 3.1 6.7 2.5 6.1 6.2C2.5 6.7 2.3 11.1 4.9 12.5C3.7 15.7 6 18.3 9 17.6M12.1 6.7C12.1 3.1 17.3 2.5 17.9 6.2C21.5 6.7 21.7 11.1 19.1 12.5C20.3 15.7 18 18.3 15 17.6M12 6.7v12.6"/><path className="activity-glyph__pulse" d="M6.1 6.2c0 1.6 1 2.5 2.4 2.5m9.4-2.5c0 1.6-1 2.5-2.4 2.5"/>
  </ActivityGlyph>;
}

export function TerminalActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="terminal" {...props}>
    <path d="M16 4H7.2A3.2 3.2 0 0 0 4 7.2v9.6A3.2 3.2 0 0 0 7.2 20h9.6a3.2 3.2 0 0 0 3.2-3.2V9"/><path d="m7.5 9 3 3-3 3"/><path className="activity-glyph__cursor" d="M13.5 15H17"/>
  </ActivityGlyph>;
}

export function SearchActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="search" {...props}>
    <path d="M15.6 13.9A6.7 6.7 0 1 0 13.9 15.6M16.4 16.4 21 21"/><path className="activity-glyph__pulse" d="M6.8 8.2c.6-1 1.6-1.6 2.8-1.6"/>
  </ActivityGlyph>;
}

export function ReadActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="read" data-rtl-flip="" {...props}>
    <path d="M12 6.1C9.4 4.8 6.5 4.6 3.5 5.3v13c3-.7 5.9-.5 8.5.8m0-13c2.6-1.3 5.5-1.5 8.5-.8v13c-3-.7-5.9-.5-8.5.8V6.1"/><path className="activity-glyph__pulse" d="M6.5 9h2.5m6 0h2.5"/>
  </ActivityGlyph>;
}

export function FilesActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="files" {...props}>
    <path d="M4 9V6.8A2.8 2.8 0 0 1 6.8 4H10l2.2 2.5h5A2.8 2.8 0 0 1 20 9.3v8a2.7 2.7 0 0 1-2.7 2.7H6.7A2.7 2.7 0 0 1 4 17.3v-5.8h10.5"/>
  </ActivityGlyph>;
}

export function PatchActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="patch" {...props}>
    <path d="m5 14.5 9.9-9.9a2.1 2.1 0 0 1 3 0l1.5 1.5a2.1 2.1 0 0 1 0 3l-9.9 9.9L4 20l1-5.5Zm8.4-8.4 4.5 4.5"/><path d="M14 20h6"/>
  </ActivityGlyph>;
}

export function GlobeActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="browser" {...props}>
    <circle cx="12" cy="12" r="8"/><path d="M4.5 12h15M12 4c-4.5 4.6-4.5 11.4 0 16m0-16c4.5 4.6 4.5 11.4 0 16"/>
  </ActivityGlyph>;
}

export function AgentActivityIcon(props: IconProps) {
  return <ActivityGlyph glyph="agent" {...props}>
    <rect x="4" y="6.5" width="16" height="13" rx="4"/><path d="M12 3v3.5M8.5 15.5h7"/><circle cx="8.5" cy="11.5" r=".85" fill="currentColor" stroke="none"/><circle cx="15.5" cy="11.5" r=".85" fill="currentColor" stroke="none"/>
  </ActivityGlyph>;
}
