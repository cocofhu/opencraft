import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import { createServer } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { ObserveStore, observationSchemaV1 } from '../apps/observability-service/store.ts';
import { mkdtemp, rm, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizeEvent, windowFor } from '../packages/observability-contract/index.mjs';
import { createEventQueue } from '../packages/observability-contract/queue.mjs';
import { compare } from '../packages/observability-query/index.mjs';
import { startObserve } from '../apps/observability-service/service.mjs';
import { socketRequest } from '../packages/observability-contract/node.mjs';
import { run } from '../apps/observability-cli/main.mjs';
const now=Date.now();
const event=(fields={})=>({schemaVersion:1,kind:'operation',component:'web',eventId:crypto.randomUUID(),producerId:'test',at:now,operationType:'thread_open',outcome:'ok',durationMs:10,...fields});
test('closed schema never exports payloads and rejects malformed known fields',()=>{
  const value=sanitizeEvent(event({params:{secret:'canary'},error:'canary',path:'/secret',scope:'admin',actorId:'forged'}),now);
  assert(!JSON.stringify(value).includes('canary'));assert(!('actorId' in value));assert.equal(sanitizeEvent(event({operationType:'user-content'}),now),null);
  assert.equal(sanitizeEvent(event({durationMs:-1}),now),null);assert.throws(()=>windowFor({from:'2020-01-01',to:'2026-01-01'},now));
});
test('queue drops without blocking, retains bounds and accepts valid event after invalid',()=>{
  const queue=createEventQueue({maxEvents:2,maxBytes:4096,now:()=>now});
  assert.equal(queue.emit(event({kind:'garbage'})),false);assert(queue.emit(event()));assert(queue.emit(event()));assert.equal(queue.emit(event()),false);
  assert.equal(queue.stats().pending,2);assert.equal(queue.stats().dropped,1);assert.equal(queue.take().length,2);assert(queue.emit(event()));
});
test('comparison rejects missing/mixed workload and detects paired improvement and regression',()=>{
  const snapshot=(duration)=>({deploymentId:'test',queryDefinitionRevision:'v1',metricSchemaVersion:1,coverage:'complete',loss:{dropped:0},events:Array.from({length:20},(_,i)=>event({pairId:String(i),originClass:'probe',cache:'cold',engine:'codex',measurementScope:'in_page',workloadDigest:'fixture-v1',durationMs:duration+i}))});
  assert.equal(compare(snapshot(100),snapshot(10)).status,'improved');assert.equal(compare(snapshot(10),snapshot(100)).status,'regressed');
  const missing=snapshot(10);missing.events.pop();assert.equal(compare(snapshot(100),missing).status,'inconclusive');
  const mixed=snapshot(10);mixed.events[0].cache='warm';assert.equal(compare(snapshot(100),mixed).status,'inconclusive');
});
test('real socket, domain dedup, immutable CLI output, unknown query and unavailable backend',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'opencraft-observe-'));
  const service=await startObserve({directory,deploymentId:'test',metricsPort:0,prometheus:'http://127.0.0.1:1'});
  try{
    const events=[event({kind:'execution',component:'core',engine:'codex',executionId:'one',outcome:'started'}),event({kind:'execution',component:'core',engine:'codex',executionId:'one',outcome:'ok'}),event({kind:'execution',component:'core',engine:'codex',executionId:'one',outcome:'started'})];
    const receipt=await socketRequest(service.socketPath,'/events',{events:[events[0],{bad:'record'},events[1],events[2]]});
    assert.equal(receipt.accepted,3);assert.equal(receipt.rejected,1);
    assert.equal((await socketRequest(service.socketPath,'/events',{events})).duplicates,3);
    assert.deepEqual(service.store.executions(now-1000,now+1000).map(row=>({...row})),[{outcome:'ok',count:1}]);
    const result=await socketRequest(service.socketPath,'/query',{name:'execution.progress'});assert.equal(result.availability,'backend_unreachable');
    await assert.rejects(()=>socketRequest(service.socketPath,'/query',{name:'arbitrary.sql'}),e=>e.code==='unknown_query');
    await assert.rejects(()=>socketRequest(service.socketPath,'/query',{name:'platform.status',scope:'forged'}),e=>e.code==='unknown_argument');
    const target=`unix://${service.socketPath}`,out=join(directory,'before.json');
    const value=await run(['snapshot','--target',target,'--out',out,'--json']);assert.equal(value.schemaVersion,1);assert.equal(value.coverage,'partial');
    const original=await readFile(out,'utf8');await assert.rejects(()=>run(['snapshot','--target',target,'--out',out]),e=>e.code==='EEXIST');assert.equal(await readFile(out,'utf8'),original);
  }finally{await service.close();await rm(directory,{recursive:true,force:true});}
});

test('unknown component identity clears prior identity; unresponsive snapshot shares one deadline',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'opencraft-observe-deadline-'));
  const stalled=createServer((_req,_res)=>{});await new Promise(resolve=>stalled.listen(0,'127.0.0.1',resolve));
  const service=await startObserve({directory,deploymentId:'deadline-test',metricsPort:0,prometheus:`http://127.0.0.1:${stalled.address().port}`});
  try{
    service.store.ingest([event({kind:'producer',component:'core',producerId:'independent',sourceRevision:'old-core',buildId:'old-build'})]);
    service.store.ingest([event({kind:'producer',component:'core',producerId:'independent',sourceRevision:null,buildId:null,observedBy:'gateway'})]);
    const identity=service.store.producers().find(row=>row.producer==='independent').identity;
    assert.equal(identity.sourceRevision,undefined);assert.equal(identity.buildId,undefined);assert.equal(identity.observedBy,'gateway');
    const started=performance.now();const snapshot=await service.snapshot();
    assert(performance.now()-started<4500);assert.equal(snapshot.coverage,'partial');
    assert(Object.values(snapshot.measurements).every(value=>value.availability==='backend_unreachable'));
  }finally{stalled.closeAllConnections();await new Promise(resolve=>stalled.close(resolve));await service.close();await rm(directory,{recursive:true,force:true});}
});

test('v1 evidence upgrades without rewriting migration history and rejects checksum tampering',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'opencraft-observe-upgrade-')),path=join(directory,'observe.sqlite');
  try{
    const db=new DatabaseSync(path);
    db.exec(observationSchemaV1+"CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,checksum TEXT NOT NULL,applied_at INTEGER NOT NULL) STRICT");
    db.prepare('INSERT INTO schema_migrations VALUES(1,?,?,?)').run('bounded-derived-observations',createHash('sha256').update(observationSchemaV1).digest('hex'),now);
    const original=event({actorKind:'human',originClass:'interactive',recoveryId:'existing',kind:'recovery'});
    db.prepare('INSERT INTO events(event_id,at,received,kind,component,actor,body) VALUES(?,?,?,?,?,?,?)').run(original.eventId,now,now,'recovery','web','verified',JSON.stringify(original));db.close();
    const store=new ObserveStore(path);assert.equal(store.outcome.status,'migrated');assert.equal(store.outcome.appliedVersion,4);
    assert.equal(store.events(now-1000,now+1000,Date.now()).find(row=>row.eventId===original.eventId).recoveryId,'existing');
    assert.equal(store.activity(now-1000,now+1000).humans,1);assert.equal(store.recoveries(now-1000,now+1000).value,1);
    store.db.prepare("UPDATE schema_migrations SET checksum='tampered' WHERE version=1").run();store.close();
    assert.throws(()=>new ObserveStore(path));
    const inspect=new DatabaseSync(path,{readOnly:true});assert.equal(inspect.prepare('SELECT count(*) AS n FROM events').get().n,1);inspect.close();
  }finally{await rm(directory,{recursive:true,force:true});}
});


test('queue owner snapshots do not add execution rounds; late progress cannot revive a terminal domain',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'opencraft-observe-domain-'));
  let clock=now;const store=new ObserveStore(join(directory,'observe.sqlite'),()=>clock);
  try{
    store.ingest([event({kind:'queue',component:'gateway',engine:'codex',executionId:'queue-one',count:3})]);
    assert.equal(store.queues()[0].count,3);assert.equal(store.executions(now-1000,now+1000).length,0);
    store.ingest([event({kind:'queue',engine:'codex',executionId:'queue-one',count:7,at:now-500})]);
    assert.equal(store.queues()[0].count,3);
    store.ingest([event({kind:'execution',engine:'codex',executionId:'round-one',outcome:'started',stage:'running'}),event({kind:'execution',engine:'codex',executionId:'round-one',outcome:'progress',stage:'tool',at:now+100})]);
    assert.equal(store.progress()[0].stage,'tool');
    store.ingest([event({kind:'execution',engine:'codex',executionId:'round-one',outcome:'ok',stage:'completed',at:now+200}),event({kind:'execution',engine:'codex',executionId:'round-one',outcome:'progress',stage:'model',at:now-200})]);
    assert.equal(store.progress().length,0);assert.equal(store.executions(now-1000,now+1000)[0].count,1);
    clock=now+91000;assert.equal(store.queues().length,0);
    clock=now+604800001;store.prune();assert.equal(store.db.prepare('SELECT count(*) AS n FROM queue_samples').get().n,0);
  }finally{store.close();await rm(directory,{recursive:true,force:true});}
});


test('installed CLI executes through a symlink and retains structured failures',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'opencraft-observe-cli-link-'));
  try{
    const entry=join(directory,'opencraft-observe.mjs');await symlink(fileURLToPath(new URL('../apps/observability-cli/main.mjs',import.meta.url)),entry);
    const result=await new Promise(resolve=>execFile(process.execPath,[entry,'capabilities','--target',`unix://${directory}/missing.sock`,'--json'],{timeout:10000},(error,stdout)=>resolve({code:error?.code,stdout})));
    assert.equal(result.code,5);assert.equal(JSON.parse(result.stdout).error.code,'backend_unreachable');
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('latest component response stays bounded across 10000 clients; probe/cache/visibility cannot mix latency histograms',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'opencraft-observe-cardinality-'));
  const service=await startObserve({directory,deploymentId:'cardinality-fixture',metricsPort:0,prometheus:'http://127.0.0.1:1'});
  try{
    for(let offset=0;offset<10000;offset+=32)service.store.ingest(Array.from({length:Math.min(32,10000-offset)},(_,i)=>event({kind:'client_signal',producerId:`client-${offset+i}`,incidentRef:`incident-${offset+i}`,executionId:`domain-${offset+i}`,actorKind:'human',originClass:'probe'})),'a'.repeat(64));
    const status=await service.query('platform.status');assert(status.components.length<=11);assert(JSON.stringify(status).length<65536);
    assert.equal(service.store.activity(now-1000,now+1000).humans,0);
    const valid={actorKind:'human',visibility:'visible',originClass:'interactive',measurementScope:'in_page',engine:'codex'};
    service.store.ingest([event({...valid,cache:'cold'}),event({...valid,cache:'warm'}),event({...valid,cache:'cold',originClass:'probe'}),event({...valid,cache:'cold',visibility:'hidden'}),event({...valid,cache:'cold',measurementScope:'rpc'})],'a'.repeat(64));
    const counters=service.store.db.prepare("SELECT dimension,value FROM metrics WHERE name='foreground_operation_count' ORDER BY dimension").all();
    assert.equal(counters.length,2);assert.deepEqual(counters.map(r=>r.value),[1,1]);assert.equal(service.store.activity(now-1000,now+1000).humans,1);
    service.store.ingest([event({...valid,actorKind:'human',cache:'cold'})],'b'.repeat(64));
    assert.equal(service.store.activity(now-1000,now+1000).humans,2);
    assert(service.store.db.prepare('SELECT count(*) AS n FROM metrics').get().n<10000);
  }finally{await service.close();await rm(directory,{recursive:true,force:true});}
});
