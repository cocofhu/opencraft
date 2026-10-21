import { createHash } from 'node:crypto';
import { conversationRef, encodeConversationRef, parseConversationRef, type ConversationRef } from '@opencraft/appserver-protocol/collaboration';
import type { ActorContext } from '@opencraft/identity-core/actors';
import { SwitchboardStore } from './store.js';

export interface ImSource {
  readonly chatId: string;
  readonly chatType: 'direct' | 'group';
  readonly senderId: string;
  readonly threadId?: string;
}
export interface ImMessage {
  readonly id: string;
  readonly source: ImSource;
  readonly text: string;
  readonly accepted?: () => Promise<void>;
  /** Adapter closure pins the original callback and transport incarnation. */
  readonly reply: (text: string) => Promise<void>;
}
export interface ImEndpoint {
  readonly id: string;
  readonly ownerId: string;
  /** Immutable operator-verified external identity bindings, never display-name matching. */
  readonly senders: Readonly<Record<string, string>>;
  readonly groupScope: 'chat' | 'sender';
}
export interface ImExecutionPort {
  human(actorId: string): ActorContext;
  authorize(context: ActorContext, ref?: ConversationRef): void;
  create(context: ActorContext, signal: AbortSignal): Promise<ConversationRef>;
  validate(context: ActorContext, ref: ConversationRef, signal: AbortSignal): Promise<void>;
  submit(context: ActorContext, ref: ConversationRef, messageId: string, text: string): Promise<string>;
  result(context: ActorContext, ref: ConversationRef, requestId: string, signal: AbortSignal): Promise<string>;
}
export class ImFault extends Error {
  constructor(readonly code: 'denied' | 'closed' | 'busy' | 'invalid_message' | 'invalid_command') { super(code); }
}
function identity(value: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > 512 || /[\x00-\x1f\x7f]/u.test(value)) throw new ImFault('invalid_message');
  return value;
}
export function imSourceKey(source: ImSource, scope: ImEndpoint['groupScope']): string {
  if (!['direct','group'].includes(source.chatType)) throw new ImFault('invalid_message');
  // Tuples avoid delimiter collisions; endpoint identity provides the platform namespace.
  return JSON.stringify([source.chatType,identity(source.chatId),source.threadId === undefined ? null : identity(source.threadId),
    source.chatType === 'direct' || scope === 'sender' ? identity(source.senderId) : null]);
}

/** Admission serializes binding changes only. Running turns never block /new or /switch. */
export class ImPlugin {
  private readonly endpoints = new Map<string, ImEndpoint>();
  private readonly owners = new Map<string, ActorContext>();
  private readonly lanes = new Map<string, Promise<unknown>>();
  private readonly messages = new Map<string, {fingerprint: string; job: Promise<void>; done: boolean}>();
  private readonly controller = new AbortController();
  private closing: Promise<void> | undefined;
  constructor(readonly store: SwitchboardStore, readonly execution: ImExecutionPort, readonly capacity = 1024) {}
  register(input: ImEndpoint): () => void {
    const endpoint: ImEndpoint = Object.freeze({id:input.id,ownerId:input.ownerId,groupScope:input.groupScope,senders:Object.freeze({...input.senders})});
    identity(endpoint.id); identity(endpoint.ownerId);
    if (this.controller.signal.aborted || this.endpoints.has(endpoint.id) || !['chat','sender'].includes(endpoint.groupScope)) throw new ImFault('denied');
    const owner = this.execution.human(endpoint.ownerId);
    for (const [sender, actor] of Object.entries(endpoint.senders)) { identity(sender); this.execution.human(actor); }
    this.endpoints.set(endpoint.id,endpoint);
    this.owners.set(endpoint.id,Object.freeze({...owner,expiresAt:Number.MAX_SAFE_INTEGER}));
    return () => { if (this.endpoints.get(endpoint.id) === endpoint) { this.endpoints.delete(endpoint.id); this.owners.delete(endpoint.id); } };
  }
  receive(endpointId: string, message: ImMessage): Promise<void> {
    try {
      const endpoint = this.endpoints.get(endpointId);
      if (this.controller.signal.aborted) throw new ImFault('closed');
      if (!endpoint) throw new ImFault('denied');
      identity(message.id); identity(message.source.senderId);
      if (typeof message.text !== 'string' || !message.text.trim() || message.text.length > 16_384 || typeof message.reply !== 'function') throw new ImFault('invalid_message');
      const actorId = Object.hasOwn(endpoint.senders,message.source.senderId) ? endpoint.senders[message.source.senderId] : undefined;
      if (!actorId) throw new ImFault('denied');
      const sourceKey = imSourceKey(message.source,endpoint.groupScope);
      const lane = JSON.stringify([endpointId,sourceKey]);
      const key = createHash('sha256').update(JSON.stringify([endpointId,sourceKey,message.id])).digest('hex');
      const fingerprint = createHash('sha256').update(JSON.stringify([message.source.senderId,message.text])).digest('hex');
      const context = this.execution.human(actorId);
      this.assert(endpoint,context);
      const previous = this.messages.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new ImFault('invalid_message');
        return previous.job;
      }
      if (this.messages.size >= this.capacity) {
        const oldest = [...this.messages].find(([,entry]) => entry.done);
        if (oldest) this.messages.delete(oldest[0]);
        else throw new ImFault('busy');
      }
      // Capture values before any asynchronous work; callers cannot mutate the reply destination.
      const frozen = Object.freeze({text: message.text.trim(), reply: message.reply, accepted:message.accepted, key});
      const admission = (this.lanes.get(lane) ?? Promise.resolve()).catch(() => {}).then(async () => {
        this.assert(endpoint,context);
        const command = frozen.text.split(/\s/u,1)[0];
        let ref = this.store.get(endpointId,sourceKey);
        if (command === '/new' || command === '/switch') {
          if (command === '/new') {
            if (frozen.text !== '/new') throw new ImFault('invalid_command');
            ref = conversationRef(await this.execution.create(context,this.controller.signal));
          } else {
            ref = parseConversationRef(frozen.text.slice('/switch'.length).trim());
            if (!ref) throw new ImFault('invalid_command');
            await this.execution.validate(context,ref,this.controller.signal);
          }
          this.assert(endpoint,context,ref);
          this.store.bind(endpointId,sourceKey,ref);
          return {ref, text: `会话已切换：${encodeConversationRef(ref)}`, requestId: null};
        }
        if (!ref) {
          ref = conversationRef(await this.execution.create(context,this.controller.signal));
          this.assert(endpoint,context,ref);
          this.store.bind(endpointId,sourceKey,ref);
        }
        this.assert(endpoint,context,ref);
        const pinned = Object.freeze({...ref});
        const requestId = await this.execution.submit(context,pinned,key,frozen.text);
        return {ref:pinned,requestId,text:null};
      });
      this.lanes.set(lane,admission);
      void admission.finally(() => { if (this.lanes.get(lane) === admission) this.lanes.delete(lane); }).catch(() => {});
      const entry = {fingerprint,done:false,job:Promise.resolve()};
      entry.job = admission.then(async admitted => {
        if (admitted.requestId) { this.assert(endpoint,context,admitted.ref); await frozen.accepted?.(); }
        let text: string;
        try { text = admitted.requestId ? await this.execution.result(context,admitted.ref,admitted.requestId,this.controller.signal) : admitted.text!; }
        catch (error) {
          this.assert(endpoint,context,admitted.ref);
          await frozen.reply(`暂时无法返回结果，请打开会话查看：${encodeConversationRef(admitted.ref)}`);
          throw error;
        }
        this.assert(endpoint,context,admitted.ref);
        await frozen.reply(text);
      }).finally(() => { entry.done = true; });
      this.messages.set(key,entry);
      return entry.job;
    } catch (error) { return Promise.reject(error); }
  }
  private assert(endpoint: ImEndpoint, context: ActorContext, ref?: ConversationRef) {
    if (this.controller.signal.aborted) throw new ImFault('closed');
    if (this.endpoints.get(endpoint.id) !== endpoint) throw new ImFault('denied');
    this.execution.authorize(this.owners.get(endpoint.id)!);
    this.execution.authorize(context,ref);
  }
  close(): Promise<void> {
    return this.closing ??= this.dispose();
  }
  private async dispose() {
    this.controller.abort(); this.endpoints.clear(); this.owners.clear();
    await Promise.allSettled([...this.messages.values()].map(entry => entry.job));
    this.store.close(); this.messages.clear();
  }
}
