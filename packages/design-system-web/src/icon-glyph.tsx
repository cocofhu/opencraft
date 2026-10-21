import React, { type ReactNode, type SVGProps } from "react";

export interface ActionIconProps extends Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> {
  readonly size?: number;
  readonly className?: string;
  readonly "aria-label"?: string;
}

export function ActionGlyph({ size = 20, strokeWidth = 2, className, "aria-label": label, kind, children, ...attributes }: ActionIconProps & {
  readonly kind: string;
  readonly children: ReactNode;
}) {
  return <svg {...attributes} width={size} height={size} viewBox="0 0 24 24" fill={attributes.fill ?? "none"} stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" focusable="false"
    className={["ui-action-glyph", className].filter(Boolean).join(" ")}
    data-action-glyph={kind} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined}>
    {children}
  </svg>;
}

/** One folded-page silhouette for resources and read/edit permissions. */
export function RoundedPage({ children }: { readonly children?: ReactNode }) {
  return <>
    <path d="M13.5 3.5h-6A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V9l-5.5-5.5Z" />
    <path d="M13.5 3.5v4A1.5 1.5 0 0 0 15 9h4" />
    {children}
  </>;
}

/** Static controls and process rows share artwork; the row alone owns motion. */
export function BrainArtwork({ detailClassName }: { readonly detailClassName?: string }) {
  return <>
    <path d="M12 7.25a3.25 3.25 0 0 0-6.5 0v.5a4.75 4.75 0 0 0 0 8.5v.5a3.25 3.25 0 0 0 6.5 0m0-9.5a3.25 3.25 0 0 1 6.5 0v.5a4.75 4.75 0 0 1 0 8.5v.5a3.25 3.25 0 0 1-6.5 0" />
    <path className={detailClassName} d="M12 7.25v9.5" />
  </>;
}

export function TerminalArtwork({ cursorClassName }: { readonly cursorClassName?: string }) {
  return <>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="m8 9 3 3-3 3" />
    <path className={cursorClassName} d="M14 15h2" />
  </>;
}

export function BookArtwork({ detailClassName }: { readonly detailClassName?: string }) {
  return <>
    <path d="M12 6.25C9.8 4.8 6.7 4.4 3.5 5.25v12.5c3.2-.85 6.3-.45 8.5 1 2.2-1.45 5.3-1.85 8.5-1V5.25c-3.2-.85-6.3-.45-8.5 1Z" />
    <path className={detailClassName} d="M12 6.25v12.5" />
  </>;
}

export function PencilArtwork() {
  return <>
    <path d="m6.25 13.75 9-9a2.3 2.3 0 0 1 3.25 0l.75.75a2.3 2.3 0 0 1 0 3.25l-9 9a2 2 0 0 1-.9.52L4 20l1.73-5.35a2 2 0 0 1 .52-.9Z" />
    <path d="m13.75 6.25 4 4" />
  </>;
}
