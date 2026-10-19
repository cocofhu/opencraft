import { randomUUID, createHash } from 'node:crypto';
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
export function createConversationExecution(getAppHost, {serverId, hostId = "local-codex"}) {
  const invoke = (binding, id, method, params) => {
    if (binding.hostId !== hostId) throw new Error('Unsupported Actor execution Host');
    const host = getAppHost(); if (!host) throw new Error('Actor Host unavailable');
    return call(host, binding, id, method, params);
  };
  const binding = threadId => ({hostId, threadId});
  return {
    serverId, hostId,
    async discover(search, cursor) {
      const result = await invoke(binding(''), 'catalog', 'thread/list', {limit:30, searchTerm:search.trim() || null, archived:false, cursor});
      return {conversations:result.data.map(t=>({ref:{serverId,threadId:t.id},title:t.name || t.preview || t.id})),nextCursor:result.nextCursor ?? null};
    },
    async read(ref, cursor) {
      if(ref.serverId !== serverId) throw new Error('Unknown conversation server');
      const result = await invoke(binding(ref.threadId), 'history', 'thread/read', {includeTurns:true});
      const thread = result.thread;
      if(thread?.id !== ref.threadId) throw new Error('Conversation is unavailable');
      const entries=[];
      for(const turn of thread.turns ?? []) for(const item of turn.items ?? []) {
        if(!['userMessage','agentMessage'].includes(item.type)) continue;
        const content=item.type==='agentMessage' ? item.text : (item.content ?? []).filter(p=>p.type==='text').map(p=>p.text).join('\n');
        if(typeof content !== 'string') continue;
        // A bounded page also handles one very long native message without losing its tail.
        const chunks=Array.from(content); for(let offset=0;offset<chunks.length;offset+=2000)
          entries.push({turnId:turn.id,itemId:item.id,role:item.type==='userMessage'?'user':'assistant',offset,text:chunks.slice(offset,offset+2000).join('')});
      }
      const watermark=createHash('sha256').update(JSON.stringify(entries)).digest('hex');
      let offset=0;
      if(cursor) {const c=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8')); if(c.watermark!==watermark || !Number.isSafeInteger(c.offset) || c.offset<0 || c.offset>entries.length) throw new Error('History changed; read again without cursor');offset=c.offset;}
      const page=[]; let bytes=0;
      while(offset<entries.length && page.length<30) {const entry=entries[offset], size=Buffer.byteLength(JSON.stringify(entry));if(bytes+size>24000 && page.length) break;page.push(entry);bytes+=size;offset++;}
      return {entries:page,watermark,latestTurnId:thread.turns?.at(-1)?.id ?? null,truncated:offset<entries.length,nextCursor:offset<entries.length?Buffer.from(JSON.stringify({watermark,offset})).toString('base64url'):null};
    },
    async validate(binding) {
      const result = await invoke(binding, 'binding-validation', 'thread/read', { includeTurns: false });
      if (result?.thread?.id !== binding.threadId || result.thread.ephemeral === true) throw new Error('Durable Thread required');
    },
    async receipt(binding, id) { return (await invoke(binding, id, 'thread/queue/collaborationReceipt', {})).receipt; },
    async add(binding, id, input) {
      const result = await invoke(binding, id, 'thread/queue/add', { clientUserMessageId: `actor-input:${id}`, input: [{ type: 'text', text: input }] });
      return { id: result.queuedSubmission.id, state: 'queued', targetTurnId: null };
    },
    async steer(binding, id, queueId, expectedTurnId) { await invoke(binding, id, 'thread/queue/steer', { queuedSubmissionId: queueId, expectedTurnId }); },
    async cancel(binding, id, queueId) { return (await invoke(binding, id, 'thread/queue/delete', { queuedSubmissionId: queueId })).deleted === true; },
  };
}
