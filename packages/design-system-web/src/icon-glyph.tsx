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
