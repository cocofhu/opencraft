import assert from "node:assert/strict";
import test from "node:test";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {CodexHostStateDatabase} from "../apps/opencraft-daemon/src/codex-host-state-database.js";
import {CodexTokenUsageLedger} from "../apps/opencraft-daemon/src/token-usage-ledger.js";
import {CodexTokenUsageRuntime} from "../apps/opencraft-daemon/src/token-usage-runtime.js";
const nativeId=(n:number)=>`00000000-03e8-7000-8000-${n.toString().padStart(12,"0")}`;
test("Host recovery reaches an older unfinished turn through bounded native metadata pages and persists progress",async()=>{
 const path=await mkdtemp(join(tmpdir(),"oc-usage-runtime-")),state=new CodexHostStateDatabase(path),file=join(path,"rollout.jsonl");
 const ledger=new CodexTokenUsageLedger(state,"server",()=>1000),key={threadId:"thread",turnId:nativeId(999)};
 await writeFile(file,"");
 ledger.startTurn(key,1000,"human",true);ledger.recordInput(key,{inputId:"start",actorId:"A",actorKind:"human",mode:"start",admission:"confirmed"});
 ledger.recordSource({...key,lineage:"native",sourceId:"native-turn",kind:"turn-snapshot",version:1,provider:null,model:null,counts:{totalTokens:"1000"}});ledger.recordNativeTerminal(key);
 const pages:unknown[]=[];
 const runtime=new CodexTokenUsageRuntime(ledger,{diagnostic:()=>{},request:async(method,params)=>{
  if(method==="thread/read")return {thread:{id:"thread",path:file}};
  assert.equal(method,"thread/turns/list");assert.equal(params.itemsView,"notLoaded");assert.equal(params.limit,100);pages.push(params.cursor??null);
  return params.cursor==="older"?{data:[{id:key.turnId,startedAt:1,status:"completed"}],nextCursor:null}:{data:Array.from({length:100},(_,n)=>({id:nativeId(n+1),startedAt:1,status:"completed"})),nextCursor:"older"};
 }});
 try{
  runtime.initialize({codexHome:path});
  const deadline=Date.now()+5000;
  while(ledger.readTurn(key)?.allocationState!=="settled"&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
  assert.equal(ledger.readTurn(key)?.allocationState,"settled");assert.deepEqual(pages,[null,"older"]);assert.equal(ledger.metadataCursor("thread"),null);
  ledger.advanceMetadataCursor("thread","opaque-progress");
  assert.equal(new CodexTokenUsageLedger(state,"server",()=>1000).metadataCursor("thread"),"opaque-progress");
 }finally{runtime.close();state.close();await rm(path,{recursive:true,force:true});}
});

test("a completed thread retries its acquisition gap after its source returns without a Host restart",async()=>{
 const path=await mkdtemp(join(tmpdir(),"oc-usage-source-return-")),state=new CodexHostStateDatabase(path),file=join(path,"rollout.jsonl");
 const ledger=new CodexTokenUsageLedger(state,"server",()=>1000),key={threadId:"thread",turnId:nativeId(999)};
 ledger.startTurn(key,1000,"human",true);ledger.recordInput(key,{inputId:"start",actorId:"A",actorKind:"human",mode:"start",admission:"confirmed"});
 ledger.recordSource({...key,lineage:"native",sourceId:"native-turn",kind:"turn-snapshot",version:1,provider:null,model:null,counts:{totalTokens:"1000"}});ledger.recordNativeTerminal(key);
 let reads=0;
 const runtime=new CodexTokenUsageRuntime(ledger,{diagnostic:()=>{},request:async(method)=>{
  if(method==="thread/read"){reads++;return {thread:{id:"thread",path:file}};}
  assert.equal(method,"thread/turns/list");return {data:[{id:key.turnId,startedAt:1,status:"completed"}],nextCursor:null};
 }});
 try{
  runtime.initialize({codexHome:path});runtime.notification("turn/completed",{threadId:key.threadId,turn:{id:key.turnId,status:"completed"}});
  const missingDeadline=Date.now()+3000;
  while(!runtime.liveGapCount()&&Date.now()<missingDeadline)await new Promise(r=>setTimeout(r,10));
  assert.equal(runtime.liveGapCount(),1);
  await writeFile(file,"");
  const recoveredDeadline=Date.now()+5000;
  while((runtime.liveGapCount()||ledger.readTurn(key)?.allocationState!=="settled")&&Date.now()<recoveredDeadline)await new Promise(r=>setTimeout(r,10));
  assert.equal(runtime.liveGapCount(),0);assert.equal(ledger.readTurn(key)?.allocationState,"settled");
  assert.ok(reads<=5,"recovery uses bounded retry rather than a hot loop");
 }finally{runtime.close();state.close();await rm(path,{recursive:true,force:true});}
});
