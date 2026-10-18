import { statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const appRoot = dirname(fileURLToPath(import.meta.url));
const root = resolve(appRoot, "../..");

export function resolveDesktopProductEntries(environment = process.env) {
  const names = ["OPENCRAFT_DESKTOP_PRODUCT_MAIN_ENTRY", "OPENCRAFT_DESKTOP_PRODUCT_PRELOAD_ENTRY"];
  const selected = names.map(name => environment[name]?.trim());
  if (selected.some(Boolean) && !selected.every(Boolean)) throw new Error("Desktop product requires both Main and Preload entries");
  return selected.map((entry, i) => {
    if (!entry) return resolve(appRoot, i === 0 ? "src/desktop-product-main-entry.ts" : "src/desktop-product-preload-entry.ts");
    if ((!isAbsolute(entry) && /^[a-z][a-z\d+.-]*:/iu.test(entry)) || !/\.[cm]?[jt]s$/u.test(entry)) throw new Error(`${names[i]} requires a local JavaScript or TypeScript file`);
    const file = resolve(root, entry);
    if (!statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`${names[i]} does not name an existing file`);
    return file;
  });
}

/** Pure JS bundling only; native helpers and daemon remain owned by build:host. */
export async function bundleDesktopHost({ environment = process.env, outdir = resolve(appRoot, "dist-host") } = {}) {
  const [mainEntry, preloadEntry] = resolveDesktopProductEntries(environment);
  const shared = { absWorkingDir: root, nodePaths: [resolve(root, "node_modules")], bundle: true,
    platform: "node", format: "cjs", external: ["electron"], metafile: true,
    plugins: [{ name: "desktop-product-composition", setup(builder) {
      builder.onResolve({ filter: /^\.\/desktop-product-(main|preload)-entry\.js$/ }, args => ({
        path: args.path.includes("-main-") ? mainEntry : preloadEntry,
      }));
    } }],
  };
  const main = await build({ ...shared, entryPoints: [resolve(appRoot, "src/main.ts")], outfile: resolve(outdir, "main.cjs"),
    define: { "import.meta.url": "import_meta_url" }, banner: { js: "const import_meta_url = require('node:url').pathToFileURL(__filename).href;" } });
  const preload = await build({ ...shared, entryPoints: [resolve(appRoot, "src/preload.ts")], outfile: resolve(outdir, "preload.cjs") });
  return { main, preload };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await bundleDesktopHost();
