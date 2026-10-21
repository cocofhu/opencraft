import { createServer } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { ObserveStore, observationSchemaV1 } from '../apps/observability-service/store.ts';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
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
  const service=await startObserve({directory,deploymentId:'test',metricsPort:0});
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
    const store=new ObserveStore(path);assert.equal(store.outcome.status,'migrated');assert.equal(store.outcome.appliedVersion,2);
    assert.equal(store.events(now-1000,now+1000,Date.now()).find(row=>row.eventId===original.eventId).recoveryId,'existing');
    assert.equal(store.activity(now-1000,now+1000).humans,1);assert.equal(store.recoveries(now-1000,now+1000).value,1);
    store.db.prepare("UPDATE schema_migrations SET checksum='tampered' WHERE version=1").run();store.close();
    assert.throws(()=>new ObserveStore(path));
    const inspect=new DatabaseSync(path,{readOnly:true});assert.equal(inspect.prepare('SELECT count(*) AS n FROM events').get().n,1);inspect.close();
  }finally{await rm(directory,{recursive:true,force:true});}
});
