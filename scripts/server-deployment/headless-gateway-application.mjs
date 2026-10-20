import { readFile, stat } from 'node:fs/promises';
import { resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHeadlessServer, parseHeadlessArguments } from '../headless-application.mjs';
import { coreHealth } from './execution.mjs';
import { attachDshHost, readDshHostIdentity } from './dsh-host-client.mjs';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
export async function runHeadlessGateway({ parseArguments = parseHeadlessArguments, startServer = startHeadlessServer } = {}) {
  const releaseRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const manifest = JSON.parse(await readFile(join(releaseRoot, 'package.json'), 'utf8'));
  if (manifest.opencraftExecution?.profile !== 'headless') throw new Error('Headless execution profile required');
  if (process.env.OPENCRAFT_DSH_HOST_DESCRIPTOR && manifest.opencraftExecution.independentDshHost !== 1)
    throw new Error('Release cannot attach an independent DSH Host; crossing this migration boundary requires drained maintenance');
  const configPath = required('OPENCRAFT_HEADLESS_CONFIG');
  if (!isAbsolute(configPath)) throw new Error('Headless configuration path must be absolute');
  const info = await stat(configPath);
  if (!info.isFile() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid()) throw new Error('Headless configuration must be an owned private file');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).some(key => key !== 'argv')
    || !Array.isArray(config.argv) || !config.argv.every(value => typeof value === 'string')) throw new Error('Invalid Headless configuration');
  const options = parseArguments(config.argv);
  if (options.help) throw new Error('Headless configuration cannot request help');
  if (options.port < 1) throw new Error('Managed Headless requires a fixed loopback port');
  const tokenPath = required('OPENCRAFT_DAEMON_TOKEN_FILE');
  const token = (await readFile(tokenPath, 'utf8')).trim();
  const endpoint = required('OPENCRAFT_CODEX_CORE_ENDPOINT');
  const health = () => coreHealth(endpoint, tokenPath).catch(() => ({ state: 'unavailable' }));
  const dshDescriptor = process.env.OPENCRAFT_DSH_HOST_DESCRIPTOR;
  const app = await startServer({ ...options, root: releaseRoot, webRoot: join(releaseRoot, 'web'),
    ...(dshDescriptor ? {
      startAgentHost: async agentOptions => {
        return attachDshHost(dshDescriptor, agentOptions.dataDirectory, agentOptions.machineIdentity.machineId);
      },
    } : {}),
    // Admission continues to consume the configured public host; bind only on loopback.
    listenHost: '127.0.0.1',
    runtimeDirectory: required('OPENCRAFT_RUNTIME_DIRECTORY'),
    dshExecutable: required('OPENCRAFT_DSH_EXECUTABLE'),
    dshCapabilityPlugin: join(releaseRoot, 'execution/dsh-capability-plugin.mjs'),
    codexExecutable: required('OPENCRAFT_CODEX_EXECUTABLE'),
    codexCoreEndpoint: endpoint, codexCoreAuthToken: token, botConversations: true,
    getExecutionHealth: async () => {
      let dsh;
      if (dshDescriptor) {
        dsh = await readDshHostIdentity(dshDescriptor);
      }
      return { ok: true, profile: 'headless', version: manifest.version,
        buildId: manifest.opencraftWeb.buildId, core: await health(), ...(dsh ? { dsh } : {}) };
    },
  });
  console.log(`[opencraft headless] ${app.url}`);
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return; stopping = true;
    try { await app.close(); process.exit(0); }
    catch (error) { console.error(error); process.exit(1); }
  };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);

  return app;
}
