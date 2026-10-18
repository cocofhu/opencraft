import assert from 'node:assert/strict';
import { createServer as httpServer } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { WebSocketServer } from 'ws';
import { SshManagement } from '../apps/opencraft-daemon/src/ssh-management.js';
// Entirely isolated state and TLS fixture, with no live SSH/model execution.
const directory = await mkdtemp(join(tmpdir(), 'opencraft-origin-smoke-'));
const management = new SshManagement({ directory: join(directory, 'ssh'), publicAccess: true, resetConnection: async () => {}, connectConnection: async () => {} });
let originFreeStatus = 0, grants = 0, accepted = 0, rejected = 0;
const bundled = await build({ stdin: { contents: 'export { SshConnectionsController } from "./plugins/builtin-agents/src/ssh-connections/controller.ts";', resolveDir: resolve('.') }, bundle: true, format: 'esm', platform: 'browser', write: false });
const handler = async (req: any, res: any) => {
  if (req.url === '/controller.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundled.outputFiles[0]!.text); return; }
  if (req.url === '/__opencraft_ssh/session') {
    if (req.method === 'GET' && !req.headers.origin && !req.headers.referer) originFreeStatus++;
    if (req.method === 'POST') grants++;
  }
  if (await management.handle(req, res)) return;
  res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta name="referrer" content="no-referrer"><title>SSH origin smoke</title>');
};
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=localhost', '-days', '1', '-keyout', join(directory, 'key'), '-out', join(directory, 'cert')], { stdio: 'ignore' });
const plain = httpServer(handler), secure = httpsServer({ key: await readFile(join(directory, 'key')), cert: await readFile(join(directory, 'cert')) }, handler);
const sockets = new WebSocketServer({ noServer: true });
secure.on('upgrade', (req, socket, head) => {
  if (!management.sameOrigin(req, true) || !management.authorized(req)) { rejected++; socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n'); return; }
  accepted++; sockets.handleUpgrade(req, socket, head, ws => ws.send('admitted'));
});
plain.listen(0, '127.0.0.1'); secure.listen(0, '127.0.0.1');
await Promise.all([once(plain, 'listening'), once(secure, 'listening')]);
const plainOrigin = `http://localhost:${(plain.address() as any).port}`, secureOrigin = `https://localhost:${(secure.address() as any).port}`;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true }); // ephemeral fixture certificate only
  const page = await context.newPage();
  await page.goto(plainOrigin);
  assert.equal(await page.evaluate(async () => (await fetch('/__opencraft_ssh/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status), 200);
  const httpGrant = (await context.cookies()).find(cookie => cookie.name === 'opencraft_ssh_session_http')!;
  await context.addCookies([{ ...httpGrant, name: 'opencraft_ssh_session' }]);
  await page.goto(secureOrigin);
  const before = await page.evaluate(async () => (await fetch('/__opencraft_ssh/session')).json());
  assert.equal(before.authenticatedOrigin, plainOrigin);
  const socketResult = () => page.evaluate(() => new Promise<string>(resolve => {
    const ws = new WebSocket(`${location.origin.replace('https:', 'wss:')}/ssh-apphost`);
    ws.onmessage = () => { resolve('admitted'); ws.close(); }; ws.onerror = () => resolve('rejected');
  }));
  assert.equal(await socketResult(), 'rejected');
  const result = await page.evaluate(async () => {
    const { SshConnectionsController } = await import(/* @vite-ignore */ `${location.origin}/controller.js`);
    const controller = new SshConnectionsController(undefined, location.origin);
    await controller.refresh(); const snapshot = controller.getSnapshot(), epoch = controller.getAuthorizationEpoch();
    await controller.refresh(); const stable = epoch === controller.getAuthorizationEpoch();
    controller.dispose(); return { authenticated: snapshot.authenticated, error: snapshot.error, stable };
  });
  assert.deepEqual(result, { authenticated: true, error: null, stable: true });
  assert.equal(await socketResult(), 'admitted');
  assert.equal(grants, 2); assert.ok(originFreeStatus >= 3); assert.equal(rejected, 1); assert.equal(accepted, 1);
  console.log(JSON.stringify({ browser: 'Chromium', referrerPolicy: 'no-referrer', originalGrantRejected: true, currentOriginRenewed: true, webSocketAdmitted: true, leaseEpochStable: true, legacyCookiePreserved: true, grants, originFreeStatus }));
  await context.close();
} finally {
  await browser.close(); sockets.close(); plain.closeAllConnections(); secure.closeAllConnections();
  await Promise.all([new Promise<void>(r => plain.close(() => r())), new Promise<void>(r => secure.close(() => r()))]);
  management.close(); await rm(directory, { recursive: true, force: true });
}
