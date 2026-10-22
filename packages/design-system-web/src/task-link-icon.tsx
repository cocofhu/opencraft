import React, { type SVGProps } from "react";

export function TaskLinkIcon({ size = 24, strokeWidth = 1.75, ...props }: SVGProps<SVGSVGElement> & { readonly size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" focusable="false" aria-hidden="true" data-action-glyph="task-link" {...props}><rect x="3" y="5" width="7" height="7" rx="2" /><rect x="14" y="12" width="7" height="7" rx="2" /><path d="M10 8.5h4a3.5 3.5 0 0 1 3.5 3.5M14 15.5h-4A3.5 3.5 0 0 1 6.5 12" /></svg>;
}
