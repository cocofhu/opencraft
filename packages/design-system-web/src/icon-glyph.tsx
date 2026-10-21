import React, { type ReactNode, type SVGProps } from "react";

export interface ActionIconProps extends Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> {
  readonly size?: number;
  readonly className?: string;
  readonly "aria-label"?: string;
}

export function ActionGlyph({ size = 20, strokeWidth = 1.5, className, "aria-label": label, kind, children, ...attributes }: ActionIconProps & {
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

/** Static model choices and live reasoning share a silhouette; only the row owns motion. */
export function BrainArtwork({ detailClassName }: { readonly detailClassName?: string }) {
  return <><path d="M12 7a3 3 0 0 0-6-.5 3.7 3.7 0 0 0-1.6 6.8A3.7 3.7 0 0 0 8 19a4 4 0 0 0 4-3 4 4 0 0 0 4 3 3.7 3.7 0 0 0 3.6-5.7A3.7 3.7 0 0 0 18 6.5a3 3 0 0 0-6 .5Zm0 0v9" /><path className={detailClassName} d="M6 6.5c0 1.5 1 2.5 2.5 2.5m9.5-2.5c0 1.5-1 2.5-2.5 2.5" /></>;
}
