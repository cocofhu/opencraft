import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { bundleDesktopHost, resolveDesktopProductEntries } from "../apps/workbench-electron/build-host.mjs";

test("desktop product entries are an explicit local pair, never silently dropped", async t => {
  const directory = await mkdtemp(join(tmpdir(), "desktop product ")); t.after(() => rm(directory, { recursive: true, force: true }));
  const main = join(directory, "main.ts"), preload = join(directory, "preload.ts");
  await writeFile(main, "export {};\n"); await writeFile(preload, "export {};\n");
  const environment = { OPENCRAFT_DESKTOP_PRODUCT_MAIN_ENTRY: main, OPENCRAFT_DESKTOP_PRODUCT_PRELOAD_ENTRY: preload };
  assert.deepEqual(resolveDesktopProductEntries(environment), [main, preload]);
  assert.throws(() => resolveDesktopProductEntries({ OPENCRAFT_DESKTOP_PRODUCT_MAIN_ENTRY: main }), /both Main and Preload/);
  for (const invalid of ["https://example.invalid/main.ts", "data:text/javascript,", "missing.ts", directory]) {
    assert.throws(() => resolveDesktopProductEntries({ ...environment, OPENCRAFT_DESKTOP_PRODUCT_MAIN_ENTRY: invalid }), /OPENCRAFT_DESKTOP_PRODUCT_MAIN_ENTRY/);
  }
});

test("real desktop bundles exclude private accounts by default and package selected local entries", async t => {
  const directory = await mkdtemp(join(tmpdir(), "desktop composition ")); t.after(() => rm(directory, { recursive: true, force: true }));
  const plain = await bundleDesktopHost({ environment: {}, outdir: join(directory, "plain") });
  for (const result of [plain.main, plain.preload]) {
    assert.equal(Object.keys(result.metafile.inputs).some(file => /lightvela-(login|session-store|account-http)/.test(file)), false);
  }
  const loadPreload = async name => {
    const exports = {};
    const context = vm.createContext({ process: { platform: "linux", versions: { electron: "fixture" } },
      window: { addEventListener() {} },
      require(name) { assert.equal(name, "electron"); return {
        ipcRenderer: { invoke: async () => "fixture-identity" },
        contextBridge: { exposeInMainWorld(name, bridge) { exports[name] = bridge; } },
      }; },
    });
    vm.runInContext(await readFile(join(directory, name, "preload.cjs"), "utf8"), context);
    return exports.opencraftDesktop;
  };
  const publicBridge = await loadPreload("plain");
  assert.equal(publicBridge.kind, "electron"); assert.equal(publicBridge.lightvelaAccount, undefined);
  const main = join(directory, "product-main.ts"), preload = join(directory, "product-preload.ts");
  await writeFile(main, 'export const createDesktopProduct = api => { api.handle("example:identity", () => "fixture-identity"); return {receiveUrl:()=>null,cancelInteractions(){},dispose(){}}; };');
  await writeFile(preload, 'export const createDesktopPreload = port => ({exampleAccount:{read:()=>port.invoke("example:identity")}});');
  const selected = await bundleDesktopHost({ environment: { OPENCRAFT_DESKTOP_PRODUCT_MAIN_ENTRY: main, OPENCRAFT_DESKTOP_PRODUCT_PRELOAD_ENTRY: preload }, outdir: join(directory, "product") });
  assert.ok(Object.keys(selected.main.metafile.inputs).some(file => resolve(file) === main));
  assert.ok(Object.keys(selected.preload.metafile.inputs).some(file => resolve(file) === preload));
  const productBridge = await loadPreload("product");
  assert.equal(productBridge.kind, "electron"); assert.equal(await productBridge.exampleAccount.read(), "fixture-identity");
  assert.equal(productBridge.lightvelaAccount, undefined);
});
