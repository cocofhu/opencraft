import { cp, mkdir, readdir, stat, chmod } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Ship the existing pinned Electron distribution, license notices included. */
export async function packageBrowserRuntime(destination) {
  const require = createRequire(import.meta.url);
  const executable = require('electron');
  await mkdir(destination, { recursive: true });
  await cp(dirname(executable), join(destination, 'electron'), { recursive: true });
  for (const name of ['worker.cjs','encoder-preload.cjs','encoder.html'])
    await cp(join(root, 'scripts/remote-browser', name), join(destination, name));
  await build({ entryPoints: [join(root, 'packages/browser-preview-bridge/src/index.ts')], outfile: join(destination, 'preview-bridge.js'),
    bundle: true, format: 'iife', globalName: 'OpenCraftPreviewBridgeRuntime', platform: 'browser', target: 'chrome120' });
  // Public code/assets must be traversable inside the dynamic-UID mount even
  // when the build/install process uses a private umask. No user data is here.
  async function permissions(path) {
    await chmod(path, 0o755);
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const target = join(path, entry.name);
      if (entry.isDirectory()) await permissions(target);
      else if (entry.isFile()) await chmod(target, (await stat(target)).mode & 0o111 ? 0o755 : 0o644);
    }
  }
  await permissions(destination);
}
