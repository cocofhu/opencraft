import React from "react";
import { createComposerController } from "@opencraft/composer-core";
import { createConversationScopeRegistry } from "@opencraft/workbench-runtime";
import { AppShell } from "../../apps/workbench-web/src/components/app-shell";
import { AppShellHeader } from "../../apps/workbench-web/src/components/app-shell-header";
import { NewThreadDraftPage } from "../../apps/workbench-web/src/components/new-thread-draft-page";
import { useTimelineViewportHost } from "../../apps/workbench-web/src/timeline-viewport";
import { initializeAppearanceTheme, setThemePreference } from "../../apps/workbench-web/src/appearance-theme";
import { createIntlTestRoot } from "./intl-root";
import "../../apps/workbench-web/src/styles/app.scss";
const params = new URLSearchParams(location.search);
document.documentElement.dataset.codexWindowType = "browser";
initializeAppearanceTheme(); setThemePreference(params.get("theme") === "dark" ? "dark" : "light");
document.documentElement.dataset.uiDensity = params.has("desktop") ? "compact" : "touch";
document.documentElement.dataset.touchNewera = params.has("ordinary") ? "off" : "on";
const draft = createConversationScopeRegistry({ initialDraft: null }).openDraft({ execution: { hostId: "fixture", workspace: { cwd: "/data", runtimeWorkspaceRoots: ["/data"] } }, entrypoint: "home" });
const controller = createComposerController(draft.target, { now: Date.now, createId: () => crypto.randomUUID() });
const chrome = { kind: "browser", platform: "linux", safeArea: { left: 0, right: 0 } } as const;
const noop = () => {};
function App() {
  useTimelineViewportHost(chrome);
  Object.assign(window, { fixture: { controller } });
  return <AppShell layoutScope="home" mainContentLayout="thread-edge-scroll" navigation={{layout:"unified",actions:[],account:null,onOpenSettings:noop}} header={<AppShellHeader
    conversationHeader={!params.has("legacyHeader")} title="Home" project={null} sidebarOpen={false}
    rightPanelOpen={false} rightPanelFullWidth={false} onToggleSidebar={noop} onToggleRightPanel={noop}
    onHome={noop} canGoBack={false} canGoForward={false} onBack={noop} onForward={noop}
    navigationActions={["sidebar-toggle"]} />} windowChrome={chrome}
    sidebarOpen={false} sidebarWidth={275} onSidebarCollapse={noop} onSidebarExpand={noop} onSidebarResizeEnd={noop}
    floatingSidebarHeader={() => null} leftPanel={null} rightPanelOpen={false} rightPanelFullWidth={false}
    onRightPanelOpenChange={noop} rightPanel={null}>
    <NewThreadDraftPage draft={draft} controller={controller} selectionCatalog={{ models: [], permissionProfiles: [] }}
      catalog={{ search: async () => [] }} workspaceOptions={[]} activeHostId="fixture" hostOptions={[]}
      connectionPhase="ready" onSelectHost={noop} onSelectWorkspace={noop} onBrowseWorkspace={noop}
      onSubmit={() => false} heading="要做点什么？" placeholder="聊聊你的想法，或交给我一件事" />
  </AppShell>;
}
createIntlTestRoot(document.getElementById("root")!, undefined, "zh-CN").render(<App />);
