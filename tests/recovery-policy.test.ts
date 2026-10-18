import assert from "node:assert/strict";
import test from "node:test";
import { ConversationRecoveryOwner, type RecoveryDemand } from "../packages/workbench-runtime/src/recovery-policy";
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function fixture() {
 let now = 0, seq = 0, connects = 0;
 const timers = new Map<number, { at: number; run(): void }>();
 const events: Record<string, string | number>[] = [];
 const owner = new ConversationRecoveryOwner({hostId:"test", clock: {
  now: () => now,
  setTimeout(run, delay) { const id = ++seq; timers.set(id, {at:now+delay,run}); return id; },
  clearTimeout(id) { timers.delete(id as number); },
 }, reconnect:async()=>{connects++;}, log:event=>events.push({...event})});
 const advance = async (ms: number) => { now+=ms; for(const [id,t] of [...timers]) if(t.at<=now){timers.delete(id);t.run();} await tick(); };
 return {owner,events,advance,timers,get connects(){return connects;}};
}
test("one outage keeps correlation/backoff through retries and manual failure cancels pending work", async () => {
 const f=fixture();
 f.owner.begin("transport-unavailable"); f.owner.schedule(false); f.owner.schedule(false);
 assert.equal(f.timers.size,1); await f.advance(500); assert.equal(f.connects,1);
 f.owner.schedule(false); assert.equal(f.events.filter(e=>e.stage==='backoff').at(-1)?.delayMs,1000);
 f.owner.schedule(true); await f.advance(1000); assert.equal(f.connects,1);
 assert.equal(new Set(f.events.map(e=>e.recoveryId)).size,1);
 f.owner.ready(()=>true); await f.advance(60_000); assert.equal(f.owner.reconnectAttempt,0);
 f.owner.dispose();
});
test("visible recovers first, background is bounded, caches stay lazy and promotions start without waiting", async () => {
 const f=fixture(), started:string[]=[], releases=new Map<string,()=>void>();
 const work=(name:string,demand:RecoveryDemand)=>({key:{},demand:()=>demand,retryable:()=>false,
  run:()=>new Promise<void>(resolve=>{started.push(name);releases.set(name,resolve);})});
 const visible=work('visible','visible'), hidden=work('hidden','open'), hidden2=work('hidden2','open'), cached=work('cached','cache');
 const v=f.owner.recover(visible), h=f.owner.recover(hidden), h2=f.owner.recover(hidden2);
 await f.owner.recover(cached); await tick(); assert.deepEqual(started,['visible']);
 releases.get('visible')!(); await v; await tick(); assert.deepEqual(started,['visible','hidden']);
 const promoted=f.owner.recover(work('promoted','visible')); await tick();
 assert.deepEqual(started,['visible','hidden','promoted']);
 releases.get('promoted')!(); await promoted; releases.get('hidden')!(); await h; await tick();
 assert.equal(started.at(-1),'hidden2'); releases.get('hidden2')!(); await h2;
 f.owner.dispose();
});
test("failed visible recovery settles and permits hidden recovery; duplicate triggers coalesce", async () => {
 const f=fixture(); let runs=0;
 const task={key:{},demand:()=>"visible" as const,retryable:()=>false,run:async()=>{runs++;throw Error('semantic');}};
 const first=f.owner.recover(task); assert.equal(f.owner.recover(task),first); await first;
 let hidden=false; await f.owner.recover({key:{},demand:()=>"open",retryable:()=>false,run:async()=>{hidden=true;}});
 assert.equal(runs,1);assert.equal(hidden,true);f.owner.dispose();
});
