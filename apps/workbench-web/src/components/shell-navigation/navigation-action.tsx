import { workbenchIconMetrics } from "@opencraft/design-system/tokens";
import { useWorkbenchProductId, usesVelaIcons } from "../../workbench-product";
import { createElement } from "react";
import { resolveWorkbenchIcon } from "../ui/workbench-icon";
export interface NavigationAction {
  readonly id: string;
  readonly title: string;
  /** Compact visible copy; title remains the complete accessible name. */
  readonly shortTitle?: string;
  /** Resolved contribution copy; the Shell owns badge layout and visibility. */
  readonly badge?: string;
  readonly icon?: string;
  readonly active?: boolean;
  readonly onInvoke: () => void;
}

/** Semantic glyph mapping is platform-owned; CSS tokens own the physical scale. */
export function NavigationIcon({ name, size, selected = false }: {
  name?: string;
  size?: number;
  selected?: boolean;
}) {
  // Only closed silhouettes can be filled. A server's lights, a Bot's face or
  // a gear's hub must not disappear under a generic `svg { fill }` rule.
  const silhouette = ["home", "chat", "message-circle", "cloud", "folder", "applications", "grid"].includes(name ?? "");
  const vela = usesVelaIcons(useWorkbenchProductId());
  const icon = resolveWorkbenchIcon(name, vela, "navigation");
  const props = {
    size: size ?? (vela ? workbenchIconMetrics.vela.navigation : workbenchIconMetrics.core.navigation),
    "aria-hidden": true,
    focusable: false,
    "data-navigation-glyph-variant": selected ? "selected" : "outline",
    fill: vela && selected && silhouette ? "currentColor" : "none",
    strokeWidth: vela
      ? selected && !silhouette ? workbenchIconMetrics.navigation.selectedStroke : workbenchIconMetrics.navigation.stroke
      : workbenchIconMetrics.coreNavigation.stroke,
  };
  return createElement(icon, props);
}
