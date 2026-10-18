import type { ComponentType } from "react";

export const THREAD_BADGE_CHANNEL = "threadBadge";
/** Shell owns an intrinsic-width, right-aligned slot and popover exclusivity; products own content and data. */
export interface ThreadBadgeProps {
  readonly hostId: string;
  readonly threadId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCloseAutoFocus?: (event: Event) => void;
  readonly portalContainer: HTMLElement | null;
}
export interface ThreadBadgeContribution {
  readonly id: string;
  readonly placement?: "trailing" | "metadata";
  readonly Component: ComponentType<ThreadBadgeProps>;
}
