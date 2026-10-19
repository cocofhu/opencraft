import type { Context } from "@deepseek-ai/cordis";
import { PageHarnessPanel } from "./panel";
import { bindPageHarnessPanels, setPageHarnessSession, setPageHarnessView } from "./client";

export function createPageHarnessPanelPlugin() {
  return Object.assign(function PageHarnessPanelPlugin(ctx: Context) {
    bindPageHarnessPanels(ctx.workbenchPanels);
    const remove = [
      ctx.workbenchPanels.register({
        kind: "page-harness",
        createTab: () => ({
          id: "page-harness",
          kind: "page-harness",
          region: "right" as const,
          title: "开发预览",
          icon: "browser",
          showTabIcon: true,
          closable: true,
          preview: false,
          durableRoute: { kind: "page-harness", params: {}, payloadVersion: 1 },
        }),
      }),
      ctx.workbenchPanelRenderers.register({ kind: "page-harness", Component: PageHarnessPanel }),
      ctx.workbenchPanels.registerToolbarAction({
        id: "opencraft.page-harness.open",
        region: "right",
        order: 40,
        label: "开发预览",
        creationLabel: "开发预览",
        icon: "browser",
        run: (context) => {
          setPageHarnessSession({ ownerId: context.ownerId, cwd: context.cwd ?? "" });
          setPageHarnessView("list");
          ctx.workbenchPanels.open(context.ownerId, "page-harness", {}, { activate: true });
        },
      }),
    ];
    ctx.effect(() => () => remove.reverse().forEach((dispose) => dispose()));
  }, { inject: ["workbenchPanels", "workbenchPanelRenderers"] });
}
