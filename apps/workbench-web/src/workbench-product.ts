import { workbenchIconMetrics } from "@opencraft/design-system/tokens";
import { createContext, useContext } from "react";
interface WorkbenchBuildEnvironment {
  readonly VITE_OPENCRAFT_PRODUCT_ID?: string;
}

export function resolveWorkbenchProductId(
  environment: WorkbenchBuildEnvironment | undefined,
): string {
  return environment?.VITE_OPENCRAFT_PRODUCT_ID?.trim() || "opencraft";
}

/** Build identity is resolved once and consumed by every product-owned policy. */
export const workbenchProductId = resolveWorkbenchProductId(
  import.meta.env as WorkbenchBuildEnvironment | undefined,
);

/** Product identity, independent of the user's color-theme selection. */
export const WorkbenchProductContext = createContext(workbenchProductId);
export const useWorkbenchProductId = () => useContext(WorkbenchProductContext);
export const usesVelaIcons = (productId: string) => productId === "lightvela-web";

/** Root-local scale; Shadow hosts and full-page roots use the same tokens. */
export function applyWorkbenchProductPresentation(root: HTMLElement, productId: string): void {
  root.dataset.workbenchProduct = productId;
  const vela = usesVelaIcons(productId);
  root.style.setProperty("--stroke-icon", String((vela ? workbenchIconMetrics.vela : workbenchIconMetrics.core).stroke));
  root.style.setProperty("--stroke-icon-navigation", String(workbenchIconMetrics.coreNavigation.stroke));
  root.style.setProperty("--size-icon-navigation", vela ? "auto" : `${workbenchIconMetrics.core.navigation}px`);
  // Shell density is a fallback; legacy product consumers retain their own SVG dimensions.
  if (vela) root.style.setProperty("--size-product-navigation-icon", "auto");
  else root.style.removeProperty("--size-product-navigation-icon");
  root.style.setProperty("--space-settings-navigation-inline", vela ? "12px" : "0px");
  root.style.setProperty("--space-icon-leading-inset", vela ? "0px" : "calc((var(--size-navigation-leading-slot) - var(--size-icon-navigation)) / 2)");
}
