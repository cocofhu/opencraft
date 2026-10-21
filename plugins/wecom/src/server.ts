import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { ImMessage } from '@opencraft/plugin-im/server';

export type WeComState = 'connecting' | 'authenticating' | 'ready' | 'disconnected' | 'closed';
export interface WeComOptions {
  readonly botId: string;
  readonly secret: string;
  readonly receive: (message: ImMessage) => Promise<void>;
  readonly onState?: (state: WeComState) => void;
  /** Safe error category only: frames and credential-bearing errors never cross this boundary. */
  readonly onError?: (code: 'protocol' | 'message' | 'connection') => void;
}
type Frame = {cmd?: string; headers?: {req_id?: string}; body?: Record<string, unknown>; errcode?: number};
const GATEWAY = 'wss://openws.work.weixin.qq.com';
const ackTimeout = 10_000;
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
function content(body: Record<string, unknown>): string | null {
  if (body.msgtype === 'text') return typeof object(body.text)?.content === 'string' ? String(object(body.text)!.content) : null;
  if (body.msgtype === 'voice') return typeof object(body.voice)?.content === 'string' ? String(object(body.voice)!.content) : null;
  if (body.msgtype === 'mixed') {
    const items = object(body.mixed)?.msg_item;
    if (!Array.isArray(items)) return null;
    return items.filter(item => object(item)?.msgtype === 'text').map(item => object(object(item)?.text)?.content).filter(text => typeof text === 'string').join('\n');
  }
  return null;
}

/** One managed outbound connection. Reply closures are fenced to their source connection. */
export class WeComPlugin {
  private socket: WebSocket | null = null;
  private reconnect: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private readonly pending = new Map<string, {socket: WebSocket; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>}>();
  private readonly jobs = new Set<Promise<void>>();
  private stopped = false;
  private started = false;
  private attempts = 0;
  private phase: WeComState = 'disconnected';
  constructor(readonly options: WeComOptions, private readonly connect: () => WebSocket = () => new WebSocket(GATEWAY,{maxPayload:1_048_576,handshakeTimeout:10_000,perMessageDeflate:false})) {
    if (!options.botId?.trim() || options.botId.length > 512 || !options.secret?.trim() || options.secret.length > 4096) throw new Error('Invalid WeCom credentials');
  }
  get state() { return this.phase; }
  private stateChanged(state: WeComState) { this.phase = state; this.options.onState?.(state); }
  start() { if (!this.started && !this.stopped) { this.started = true; this.open(); } }
  private open() {
    if (this.stopped) return;
    this.stateChanged('connecting');
    let socket: WebSocket;
    try { socket = this.connect(); } catch { this.options.onError?.('connection'); this.retry(); return; }
    this.socket = socket;
    socket.on('error', () => { this.options.onError?.('connection'); socket.terminate(); });
    socket.on('close', () => {
      for (const [id,entry] of this.pending) if (entry.socket === socket) { clearTimeout(entry.timer); this.pending.delete(id); entry.reject(new Error('WeCom callback connection closed')); }
      if (this.socket !== socket) return;
      this.socket = null; clearInterval(this.heartbeat); this.heartbeat = undefined;
      if (!this.stopped) { this.stateChanged('disconnected'); this.retry(); }
    });
    socket.on('open', () => {
      if (this.stopped || this.socket !== socket) return socket.terminate();
      this.stateChanged('authenticating');
      const subscribe = this.send(socket,{cmd:'aibot_subscribe',body:{bot_id:this.options.botId,secret:this.options.secret}}).then(() => {
        if (this.stopped || this.socket !== socket) return;
        this.attempts = 0; this.stateChanged('ready');
        this.heartbeat = setInterval(() => {
          if (this.socket !== socket || this.phase !== 'ready') return;
          void this.send(socket,{cmd:'ping'}).catch(() => { this.options.onError?.('connection'); socket.terminate(); });
        },30_000); this.heartbeat.unref();
      }).catch(() => { this.options.onError?.('connection'); socket.terminate(); });
      this.track(subscribe);
    });
    socket.on('message', bytes => {
      if (this.stopped || this.socket !== socket) return;
      let frame: Frame;
      try { const decoded: unknown = JSON.parse(bytes.toString()); if (!object(decoded)) throw new Error(); frame = decoded as Frame; }
      catch { this.options.onError?.('protocol'); return; }
      const reqId = object(frame.headers)?.req_id;
      if (typeof reqId !== 'string' || !reqId || reqId.length > 512) return;
      if (typeof frame.errcode === 'number') {
        const entry = this.pending.get(reqId);
        if (!entry || entry.socket !== socket) return;
        this.pending.delete(reqId); clearTimeout(entry.timer);
        frame.errcode === 0 ? entry.resolve() : entry.reject(new Error('WeCom request rejected'));
        return;
      }
      if (frame.cmd !== 'aibot_msg_callback' || this.phase !== 'ready') return;
      const body = object(frame.body), sender = object(body?.from)?.userid;
      if (!body || body.aibotid !== this.options.botId || body.compat_info !== undefined || typeof body.msgid !== 'string' || typeof sender !== 'string') return;
      const chatType = body.chattype === 'single' ? 'direct' : body.chattype === 'group' ? 'group' : null;
      const chatId = chatType === 'direct' ? sender : body.chatid;
      const text = content(body);
      if (!chatType || typeof chatId !== 'string' || !text?.trim()) return;
      const streamId = randomUUID();
      let replied = false;
      const message: ImMessage = Object.freeze({id:body.msgid,source:Object.freeze({chatId,chatType,senderId:sender}),text,
        accepted: async () => {
          if (this.stopped || this.socket !== socket || this.phase !== 'ready') throw new Error('WeCom callback unavailable');
          await this.send(socket,{cmd:'aibot_respond_msg',headers:{req_id:reqId},body:{msgtype:'stream',stream:{id:streamId,finish:false,content:'正在处理…'}}});
        },
        reply: async (answer: string) => {
          if (replied || this.stopped || this.socket !== socket || this.phase !== 'ready') throw new Error('WeCom callback unavailable');
          if (typeof answer !== 'string' || !answer.trim() || Buffer.byteLength(answer,'utf8') > 20_000) throw new Error('WeCom reply exceeds stream limit');
          replied = true;
          await this.send(socket,{cmd:'aibot_respond_msg',headers:{req_id:reqId},body:{msgtype:'stream',stream:{id:streamId,finish:true,content:answer}}});
        }});
      this.track(Promise.resolve().then(() => this.options.receive(message)).catch(() => { this.options.onError?.('message'); }));
    });
  }
  private track(job: Promise<void>) { this.jobs.add(job); void job.finally(() => this.jobs.delete(job)).catch(() => {}); }
  private send(socket: WebSocket, frame: Frame): Promise<void> {
    if (this.stopped || this.socket !== socket || socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('WeCom disconnected'));
    const reqId = frame.headers?.req_id ?? randomUUID();
    if (this.pending.has(reqId) || this.pending.size >= 128) return Promise.reject(new Error('WeCom request busy'));
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => { this.pending.delete(reqId); reject(new Error('WeCom acknowledgement unknown')); },ackTimeout); timer.unref();
      this.pending.set(reqId,{socket,resolve,reject,timer});
      try { socket.send(JSON.stringify({...frame,headers:{req_id:reqId}}),error => {
        if (error && this.pending.get(reqId)?.timer === timer) { clearTimeout(timer); this.pending.delete(reqId); reject(new Error('WeCom send failed')); }
      }); } catch { clearTimeout(timer); this.pending.delete(reqId); reject(new Error('WeCom send failed')); }
    });
  }
  private retry() {
    if (this.stopped) return;
    this.reconnect = setTimeout(() => { this.reconnect = undefined; this.open(); },Math.min(30_000,1000 * 2 ** Math.min(this.attempts++,5)));
    this.reconnect.unref();
  }
  close() {
    if (this.stopped) return;
    this.stopped = true; clearTimeout(this.reconnect); clearInterval(this.heartbeat);
    this.stateChanged('closed');
    this.socket?.terminate(); this.socket = null;
    for (const entry of this.pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('WeCom closed')); }
    this.pending.clear();
  }
}
