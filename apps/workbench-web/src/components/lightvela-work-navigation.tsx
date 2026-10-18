import { WorkbenchIcon } from "./ui/workbench-icon";
import { useMemo, useSyncExternalStore } from "react";

import type { ExtensionContributionStore } from "@opencraft/extension-runtime";

import { useInternalDeveloperMode } from "../internal-developer-mode";
import { SidebarNavigationItem } from "./sidebar-navigation-item";

const LIGHTVELA_WORK_PAGE_IDS = new Set([
  "lightvela.hermes.skills",
  "lightvela.hermes.storage",
]);


export function useLightVelaWorkNavigationActions({
  section,
  extensionContributions,
  onSectionChange,
}: {
  readonly section: string | null;
  readonly extensionContributions: ExtensionContributionStore;
  readonly onSectionChange: (section: string) => void;
}) {
  const internalDeveloperMode = useInternalDeveloperMode();
  const contributionSnapshot = useSyncExternalStore(
    extensionContributions.subscribe,
    extensionContributions.getSnapshot,
    extensionContributions.getSnapshot,
  );
  const platform: "web" | "electron" = (globalThis as typeof globalThis & {
    opencraftDesktop?: { readonly kind?: string };
  }).opencraftDesktop?.kind === "electron" ? "electron" : "web";
  const pages = useMemo(
    () => contributionSnapshot.settingsPages
      .map(({ contribution }) => contribution)
      .filter((page) => LIGHTVELA_WORK_PAGE_IDS.has(page.id))
      .filter((page) => page.platforms?.includes(platform) ?? true)
      .filter((page) => page.audience !== "internal" || internalDeveloperMode)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
    [contributionSnapshot, internalDeveloperMode, platform],
  );

  return pages.map(page => ({ id: page.id, icon: page.icon, title: page.title,
    active: section === page.id, onInvoke: () => onSectionChange(page.id) }));
}

export function LightVelaWorkNavigation(props: Parameters<typeof useLightVelaWorkNavigationActions>[0]) {
  const actions = useLightVelaWorkNavigationActions(props);
  if (actions.length === 0) return null;
  return <nav className="lightvela-work-navigation" aria-label="LightVela work tools">
    <div className="lightvela-work-navigation__items">{actions.map(action => <SidebarNavigationItem
      key={action.id} active={action.active} icon={<WorkbenchIcon name={action.icon} purpose="work" />}
      title={action.title} onInvoke={action.onInvoke} />)}</div>
  </nav>;
}
