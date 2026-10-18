import { cp, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
/** Worker loads the pinned WASM runtime lazily. Keep its real dependency closure
 * outside the server bundle; do not silently depend on workstation node_modules. */
export async function copyMcpAppRuntime(destination) {
  const copied = new Set();
  const versions = {};
  async function copy(name, from = createRequire(import.meta.url)) {
    if (copied.has(name)) return;
    copied.add(name);
    let root = dirname(from.resolve(name)),
      manifest;
    for (;;) {
      try {
        manifest = JSON.parse(
          await readFile(join(root, "package.json"), "utf8"),
        );
        if (manifest.name === name) break;
      } catch {}
      const parent = dirname(root);
      if (parent === root)
        throw new Error(`Cannot locate runtime package ${name}`);
      root = parent;
    }
    versions[name] = manifest.version;
    await mkdir(dirname(join(destination, name)), { recursive: true });
    await cp(root, join(destination, name), { recursive: true });
    const resolver = createRequire(join(root, "package.json"));
    for (const dependency of Object.keys(manifest.dependencies || {}))
      await copy(dependency, resolver);
  }
  await copy("quickjs-emscripten-core");
  await copy("@jitl/quickjs-wasmfile-release-sync");
  return Object.fromEntries(
    ["quickjs-emscripten-core", "@jitl/quickjs-wasmfile-release-sync"].map(
      (name) => [name, versions[name]],
    ),
  );
}
