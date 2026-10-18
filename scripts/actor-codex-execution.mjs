import { randomUUID } from 'node:crypto';
import { APP_HOST_PROTOCOL_VERSION } from '@opencraft/app-host-protocol/version';

/** Narrow internal logical-client lane; no client-supplied RPC method or Host is forwarded. */
function call(appHost, binding, requestId, method, params) {
  const clientId = `actor-service:${randomUUID()}`, leaseId = randomUUID();
  return new Promise((resolve, reject) => {
    let connection, receive, generation, finished = false;
    const finish = (error, result) => {
      if (finished) return; finished = true; clearTimeout(timer);
      try { connection?.close(); } catch { /* Lease cleanup cannot rewrite the engine result. */ }
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('Actor execution outcome unknown')), 35_000); timer.unref();
    const send = (id, operation, arguments_) => receive?.({ type: 'host/send', requestId: `send-${id}`, hostId: binding.hostId, leaseId, generation,
      frame: JSON.stringify({ id, method: operation, params: arguments_ }) });
    try {
      connection = appHost.accept({
        subscribe(listener) { receive = listener; return () => { receive = undefined; }; }, start() {}, close() {},
        postMessage(message) {
          if (finished) return;
          if (message.type === 'ready') receive?.({ type: 'host/connect', requestId: 'connect', hostId: binding.hostId, leaseId });
          else if (message.type === 'response' && message.requestId === 'connect') {
            if (!message.ok || !Number.isSafeInteger(message.result?.generation)) return finish(new Error('Actor Host unavailable'));
            generation = message.result.generation;
            send('init', 'initialize', { clientInfo: { name: 'opencraft-actor-service', version: '1' }, capabilities: { experimentalApi: true } });
          } else if (message.type === 'response' && !message.ok) finish(new Error('Actor Host admission failed'));
          else if (message.type === 'host/frame' && message.hostId === binding.hostId && message.generation === generation) {
            try {
              const frame = JSON.parse(message.frame);
              if (frame.method || !['init', 'operation'].includes(frame.id)) return;
              if (frame.error) return finish(Object.assign(new Error('Actor engine request rejected'), { code: frame.error.code }));
              if (frame.id === 'init') send('operation', method, { ...params, threadId: binding.threadId });
              else finish(null, frame.result);
            } catch (error) { finish(error); }
          } else if (message.type === 'fatal' || message.type === 'host/status' && ['failed', 'closed'].includes(message.status.state)) finish(new Error('Actor Host closed'));
        },
      }, clientId, { sender: null, collaborationRequestId: requestId });
      receive?.({ type: 'hello', protocolVersion: APP_HOST_PROTOCOL_VERSION, rendererId: clientId });
    } catch (error) { finish(error); }
  });
}
export function createActorCodexExecution(getAppHost) {
  const invoke = (binding, id, method, params) => {
    if (binding.hostId !== 'local-codex') throw new Error('Unsupported Actor execution Host');
    const host = getAppHost(); if (!host) throw new Error('Actor Host unavailable');
    return call(host, binding, id, method, params);
  };
  return {
    async validate(binding) {
      const result = await invoke(binding, 'binding-validation', 'thread/read', { includeTurns: false });
      if (result?.thread?.id !== binding.threadId || result.thread.ephemeral === true) throw new Error('Durable Thread required');
    },
    async receipt(binding, id) { return (await invoke(binding, id, 'thread/queue/actorReceipt', {})).receipt; },
    async add(binding, id, input) {
      const result = await invoke(binding, id, 'thread/queue/add', { clientUserMessageId: `actor-input:${id}`, input: [{ type: 'text', text: input }] });
      return { id: result.queuedSubmission.id, state: 'queued', targetTurnId: null };
    },
    async steer(binding, id, queueId, expectedTurnId) { await invoke(binding, id, 'thread/queue/steer', { queuedSubmissionId: queueId, expectedTurnId }); },
    async cancel(binding, id, queueId) { return (await invoke(binding, id, 'thread/queue/delete', { queuedSubmissionId: queueId })).deleted === true; },
  };
}
