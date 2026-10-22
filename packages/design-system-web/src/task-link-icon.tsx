import React, { type SVGProps } from "react";

export function TaskLinkIcon({ size = 24, strokeWidth = 1.75, ...props }: SVGProps<SVGSVGElement> & { readonly size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" focusable="false" aria-hidden="true" data-action-glyph="task-link" {...props}><path d="M8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4h9A2.5 2.5 0 0 1 18 6.5V9" /><path d="M8 8.5h6M8 12h3" /><path d="m13.5 14 1.5-1.5a3.2 3.2 0 0 1 4.5 4.5L18 18.5M14.5 19 13 20.5a3.2 3.2 0 0 1-4.5-4.5l1.5-1.5M12 17l4-4" /></svg>;
}
