import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

export async function readPrivateJson(path) {
  if (!isAbsolute(path)) throw new Error('DSH Host configuration requires an absolute path');
  const info = await stat(path);
  if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o077) !== 0)
    throw new Error('DSH Host configuration must be an owned private file');
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Attach to the whole Host, including its execution journal and capability bridge.
 * An execution gateway never opens its stores or terminates its process. */
async function readDshHost(path, expectedDataDirectory, expectedMachineId) {
  const descriptor = await readPrivateJson(path);
  const url = new URL(descriptor.websocketUrl);
  if (descriptor.schemaVersion !== 1 || url.protocol !== 'ws:' || url.hostname !== '127.0.0.1'
    || url.pathname !== '/rpc' || url.username || url.password || !url.searchParams.get('token')
    || !isAbsolute(descriptor.dataDirectory) || resolve(descriptor.dataDirectory) !== resolve(expectedDataDirectory)
    || (expectedMachineId !== undefined && descriptor.machineId !== expectedMachineId)
    || !Number.isSafeInteger(descriptor.pid) || descriptor.pid < 1)
    throw new Error('DSH Host descriptor is incompatible with this deployment');
  const response = await fetch(new URL('/health', url.origin.replace('ws:', 'http:')), { signal: AbortSignal.timeout(5000) });
  const health = await response.json();
  if (!response.ok || health.ok !== true || health.engine !== 'dsh' || health.pid !== descriptor.pid
    || !Number.isSafeInteger(health.enginePid) || health.enginePid < 1)
    throw new Error('Independent DSH Host is unavailable');
  return { websocketUrl: descriptor.websocketUrl, storageOutcomes: health.storage,
    identity: { pid: health.pid, enginePid: health.enginePid } };
}

export async function attachDshHost(path, expectedDataDirectory, expectedMachineId) {
  const read = () => readDshHost(path, expectedDataDirectory, expectedMachineId);
  return { ...await read(),
    resolveWebsocketUrl: async () => (await read()).websocketUrl,
    getIdentity: async () => (await read()).identity,
    async close() {} };
}
