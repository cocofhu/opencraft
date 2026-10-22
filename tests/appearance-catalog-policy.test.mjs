import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

test("theme choices start with the visible product default independently of the saved selection", async () => {
  const cases = [
    [{}, ["Neutral", "Canvas", "Frost", "Lavender", "ZenCode", "Mist"]],
    [{ defaultThemeId: "opencraft.core.canvas", hiddenBuiltinThemeIds: ["opencraft.core.mist"] }, ["Canvas", "Neutral", "Frost", "Lavender", "ZenCode"]],
    [{ defaultThemeId: "vela.core.web", hiddenBuiltinThemeIds: ["vela.core.mist"] }, ["Canvas", "Neutral", "Frost", "Lavender", "ZenCode"]],
    [{ defaultThemeId: "opencraft.core.frost", hiddenBuiltinThemeIds: ["opencraft.core.neutral"] }, ["Frost", "Canvas", "Lavender", "ZenCode", "Mist"]],
    [{ defaultThemeId: "extension.paper" }, ["Neutral", "Canvas", "Frost", "Lavender", "ZenCode", "Mist"]],
    [{ hiddenBuiltinThemeIds: ["neutral", "canvas", "frost", "lavender", "zencode", "mist"].map(id => `opencraft.core.${id}`) }, ["Neutral"]],
  ];
  for (const [policy, expected] of cases) {
    const { outputFiles } = await build({
      entryPoints: ["apps/workbench-web/src/appearance-theme.ts"], bundle: true,
      format: "iife", globalName: "appearance", platform: "browser", write: false,
      define: { "import.meta.env": JSON.stringify({ VITE_OPENCRAFT_PRESENTATION: JSON.stringify(policy) }), "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    for (const saved of [null, "opencraft.core.frost", "extension.missing"]) {
      const context = vm.createContext({ window: {
        matchMedia: () => ({ matches: false }),
        localStorage: { getItem: key => key === "opencraft.appearance-theme-id" ? saved : null },
      } });
      vm.runInContext(outputFiles[0].text, context);
      const snapshot = context.appearance.getAppearanceThemeSnapshot();
      assert.deepEqual(Array.from(snapshot.availableThemes, theme => theme.label), expected);
      if (saved) assert.equal(snapshot.requestedThemeId, saved);
    }
  }
});
