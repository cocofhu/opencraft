import { SingleContributionRegistry } from "@opencraft/extension-runtime";
import type { ThreadBadgeContribution } from "@opencraft/extension-react";

/** Product validation stays at the adapter; the core owns registration lifetime. */
export class ThreadBadgeContributionRegistry extends SingleContributionRegistry<ThreadBadgeContribution> {
  constructor() {
    super("thread badge", isContribution);
  }
}

function isContribution(value: unknown): value is ThreadBadgeContribution {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ThreadBadgeContribution>;
  return typeof candidate.id === "string" && candidate.id.trim().length > 0
    && typeof candidate.Component === "function"
    && (candidate.placement === undefined || candidate.placement === "trailing" || candidate.placement === "metadata");
}
