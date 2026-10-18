import assert from "node:assert/strict";
import test from "node:test";
import { requiredStartupModule, startupResourceBudget, startupJavaScriptChunkBudget, startupResourceViolations } from "../apps/workbench-web/startup-resource-policy.vite";
const report = (module: string, critical = true) => ({ critical: critical ? ["main.js"] : [], chunks: [{ file: "main.js", modules: [module] }], totals: { javascript: 1, css: 1, gzip: 1 } });
test("startup gates reject on-demand modules even when byte budgets are met", () => {
  for (const module of ["opencraft/apps/workbench-web/src/components/modal/adaptive-sheet-handle.tsx", "opencraft/packages/chat-render-web/src/extensions/katex/katex-math.tsx", "opencraft/plugins/lightvela-hermes/src/connectors/catalog-snapshot.ts", "opencraft/plugins/lightvela-hermes/src/upstream/mono2/i18n/generated/en-US.json", "opencraft/node_modules/parse5/dist/index.js", "opencraft/node_modules/acorn/dist/acorn.mjs", "opencraft/plugins/cloud-desktop/src/panel.tsx", "opencraft/plugins/lightvela-hermes/src/settings/hermes-memory-management-view.tsx"]) {
    assert.equal(startupResourceViolations(report(module)).length, 1, module);
    assert.deepEqual(startupResourceViolations(report(module, false)), [], module);
  }
});
test("splitting cannot bypass the request fanout budget", () => {
  const files = Array.from({ length: startupJavaScriptChunkBudget + 1 }, (_, index) => `${index}.js`);
  assert.match(startupResourceViolations({ critical: files, chunks: files.map(file => ({ file, modules: [] })), totals: { javascript: 1, css: 1, gzip: 1 } }).join("\n"), /JS chunks/);
});
test("budgets are independent: compression cannot hide parse cost or CSS growth", () => {
  for (const key of Object.keys(startupResourceBudget) as (keyof typeof startupResourceBudget)[]) {
    const candidate = report("opencraft/apps/workbench-web/src/main.tsx"); candidate.totals[key] = startupResourceBudget[key] + 1;
    assert.match(startupResourceViolations(candidate).join("\n"), new RegExp(key));
  }
});

test("HTML bootstrap dynamic main remains a required startup root", () => {
  assert.equal(requiredStartupModule.test("/repo/opencraft/apps/workbench-web/src/main.tsx"), true);
  assert.equal(requiredStartupModule.test("/repo/opencraft/apps/workbench-web/src/workbench-entry.tsx"), true);
  assert.equal(requiredStartupModule.test("/repo/opencraft/plugins/optional/src/main.ts"), false);
});
