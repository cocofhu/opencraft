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

test("foreground hints can advance a long backoff once per burst without resetting escalation", async () => {
 const f=fixture();
 for(let i=0;i<7;i++){f.owner.schedule(false);await f.advance(60_000);}
 f.owner.schedule(false);
 assert.equal(f.events.filter(e=>e.stage==='backoff').at(-1)?.delayMs,60_000);
 assert.equal(f.owner.admitRecoveryHint(),true);
 f.owner.cancelConnection();
 assert.equal(f.owner.waiting,false);
 assert.equal(f.owner.admitRecoveryHint(),false);
 f.owner.schedule(false);
 assert.equal(f.events.filter(e=>e.stage==='backoff').at(-1)?.delayMs,60_000);
 await f.advance(5_000);assert.equal(f.owner.admitRecoveryHint(),true);
 f.owner.dispose();assert.equal(f.owner.admitRecoveryHint(),false);
});

test("explicit retry wakes delayed history, applies the new policy and shares the active read", async () => {
 const f=fixture(),key={};let reads=0,retried=0,release!:()=>void;
 const first=f.owner.recover({key,demand:()=>"visible",retryable:()=>true,
   run:async()=>{reads++;throw Error('timeout');}});
 await tick();assert.equal(reads,1);assert.equal(f.timers.size,1);
 const retry={key,demand:()=>"visible" as const,retryable:()=>false,
   run:()=>new Promise<void>(resolve=>{retried++;release=resolve;})};
 assert.equal(f.owner.recover(retry,true),first);
 await tick();assert.equal(retried,1);assert.equal(f.timers.size,0);
 assert.equal(f.owner.recover(retry,true),first);await tick();assert.equal(retried,1);
 release();await first;await f.advance(60_000);assert.equal(reads,1);assert.equal(retried,1);
 f.owner.dispose();
});

test("transient history retries are bounded and explicit callers receive the final failure", async () => {
 const f=fixture();let reads=0;
 const done=assert.rejects(f.owner.recover({key:{},demand:()=>"visible",retryable:()=>true,propagateFailure:true,
   run:async()=>{reads++;throw Error('still unavailable');}}),/still unavailable/);
 await tick();
 for(const delay of [500,1000,2000])await f.advance(delay);
 await done;assert.equal(reads,4);assert.equal(f.timers.size,0);
 await f.advance(60_000);assert.equal(reads,4);f.owner.dispose();
});

test("a cancelled history timer cannot consume the replacement retry delay", async () => {
 const f=fixture(),key={};let reads=0;
 const task={key,demand:()=>"visible" as const,retryable:()=>true,run:async()=>{reads++;throw Error('timeout');}};
 const first=f.owner.recover(task);await tick();
 const stale=[...f.timers.values()][0]!.run;
 assert.equal(f.owner.recover(task,true),first);await tick();
 assert.equal(reads,2);assert.equal(f.timers.size,1);
 stale();await tick();assert.equal(reads,2);assert.equal(f.timers.size,1);
 f.owner.invalidate();await first;f.owner.dispose();
});
