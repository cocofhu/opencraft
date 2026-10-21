import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const { installIme } = createRequire(import.meta.url)('../scripts/remote-browser/ime.cjs');
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
function fixture() {
  const wc = new EventEmitter(), calls = [], events = [];
  let result, observed = { active: true, type: 1, caretBounds: {x:10,y:20,width:0,height:18}, value: 'must-not-leave-worker' };
  const frame = { async getNativeImeContextForTesting() { return { available: true, token: 'first', compositionId: '' }; },
    async applyNativeImeForTesting(input) { calls.push(input); return result ?? { status: 'processed', context: { available: true, token: 'next', compositionId: input.type === 'compose' ? 'owned' : '' } }; } };
  wc.focusedFrame = wc.mainFrame = frame; wc.getNativeTextInputState = () => observed;
  const p = { window: {webContents:wc}, visible: true, closed: false, document:'doc', id:'page' };
  const port = installIme(p, event => events.push(event));
  return {wc,p,frame,port,calls,events,result(value) {result=value},state(value){observed=value}};
}
test('composition stays on captured native frame and consumes each returned context', async () => {
  const f=fixture();try {
    assert.equal(await f.port.apply({id,type:'begin'}),undefined);
    await f.port.apply({id,type:'compose',text:'ni'});
    await f.port.apply({id,type:'commit',text:'你'});
    assert.equal(f.calls[0].token,'first');assert.equal(f.calls[1].token,'next');assert.equal(f.calls[1].compositionId,'owned');
    await assert.rejects(f.port.apply({id,type:'commit',text:'重复'}),/target changed/);
  }finally{f.port.dispose()}
});
test('new begin cancels owned composition; delayed old cancellation cannot cancel the new one', async () => {
  const f=fixture();try {
    await f.port.apply({id,type:'begin'});await f.port.apply({id,type:'compose',text:'ni'});
    await f.port.apply({id:other,type:'begin'});assert.equal(f.calls.at(-1).type,'cancel');
    const before=f.calls.length;await f.port.apply({id,type:'cancel'});assert.equal(f.calls.length,before);
    await f.port.apply({id:other,type:'commit',text:'好'});assert.equal(f.calls.at(-1).text,'好');
  }finally{f.port.dispose()}
});
test('hidden and replaced documents cannot write or reacquire a new target', async () => {
  for(const mutate of [f=>f.p.visible=false,f=>f.p.document='replacement']) {
    const f=fixture();try {await f.port.apply({id,type:'begin'});mutate(f);await assert.rejects(f.port.apply({id,type:'commit',text:'错误'}));assert.equal(f.calls.length,0);}finally{f.port.dispose()}
  }
});
test('native rejection ends the transaction instead of retrying another editor', async () => {
  const f=fixture();try {await f.port.apply({id,type:'begin'});f.result({status:'target-changed-during-operation'});
    await assert.rejects(f.port.apply({id,type:'commit',text:'拒绝'}),/target changed|rejected/);
    await assert.rejects(f.port.apply({id,type:'commit',text:'不重试'}));assert.equal(f.calls.length,1);
  }finally{f.port.dispose()}
});
test('observations expose bounded geometry and editability, never text or native capabilities', () => {
  const f=fixture();try {f.port.observe();assert.deepEqual(f.events.at(-1),{type:'ime-state',page:'page',editable:true,caret:{x:10,y:20,width:0,height:18}});
    f.state({active:true,type:2,password:true});f.port.observe();assert.equal(f.events.at(-1).editable,false);
  }finally{f.port.dispose()}
});
test('invalid commands and oversized text never dispatch native edits', async () => {
  const f=fixture();try {await assert.rejects(f.port.apply({id:'bad',type:'begin'}));await f.port.apply({id,type:'begin'});
    await assert.rejects(f.port.apply({id,type:'commit',text:'x'.repeat(16385)}));assert.equal(f.calls.length,0);
  }finally{f.port.dispose()}
});
