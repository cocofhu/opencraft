import type { TrustedExtensionDefinition } from "@opencraft/extension-runtime";
import { PageHarnessSettingsPage } from "./settings";
import { openPageHarness } from "./client";

export const PageHarnessExtension: TrustedExtensionDefinition = {
  manifest: {
    manifestVersion: 1,
    id: "opencraft.page-harness",
    name: "page-harness",
    description: "右栏预览、取点引用和页面意见。",
    version: "0.1.0",
    apiVersion: 1,
    trust: "trusted",
    platforms: ["web", "electron"],
    activationEvents: ["onStartupFinished"],
  },
  activate(api) {
    api.views.register({
      id: "opencraft.page-harness.settings-view",
      viewType: "opencraft.page-harness.settings",
      title: "page-harness",
      platforms: ["web", "electron"],
    });
    api.settings.registerPage({
      id: "opencraft.page-harness.settings",
      title: "page-harness",
      titleMessage: { id: "settings.page-harness", defaultMessage: "page-harness" },
      viewId: "opencraft.page-harness.settings-view",
      order: 80,
      platforms: ["web", "electron"],
    });
    api.commands.register({
      id: "opencraft.page-harness.open",
      title: "开发预览",
    }, () => { openPageHarness("list"); });
    api.navigation.register({
      id: "opencraft.page-harness.navigation",
      title: "开发预览",
      titleMessage: { id: "sidebar.devPreview", defaultMessage: "开发预览" },
      shortTitleMessage: { id: "sidebar.devPreview.short", defaultMessage: "预览" },
      icon: "browser",
      surface: "sidebar-footer",
      target: { kind: "command", commandId: "opencraft.page-harness.open" },
      order: 40,
      platforms: ["web", "electron"],
    });
    api.internal.register("platformViewRenderer", {
      viewType: "opencraft.page-harness.settings",
      Component: PageHarnessSettingsPage,
    });
  },
};
