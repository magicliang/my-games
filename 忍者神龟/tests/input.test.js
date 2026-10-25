import test from 'node:test';
import assert from 'node:assert/strict';
import { InputManager, DEFAULT_BINDINGS, validateBindings } from '../src/input.js';

function harness() {
  const target = new EventTarget();
  let blurred = 0, paused = 0;
  const manager = new InputManager({ target, onBlur: () => blurred++, onPause: () => paused++ });
  manager.enabled = true;
  function key(type, code, options = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { code, ...options }); target.dispatchEvent(event); return event;
  }
  return { manager, key, target, counts: () => ({ blurred, paused }) };
}
test('Mac defaults use no numpad and all fourteen actions are distinct', () => {
  assert.equal(validateBindings(DEFAULT_BINDINGS), null);
  assert.ok(!JSON.stringify(DEFAULT_BINDINGS).includes('Numpad'));
});
test('cross-player conflict and reserved browser keys are rejected transactionally', () => {
  const { manager } = harness();
  const changed = structuredClone(DEFAULT_BINDINGS); changed[1].attack = 'KeyJ';
  assert.match(manager.setBindings(changed), /冲突/);
  assert.equal(manager.bindings[1].attack, 'KeyU');
  changed[1].attack = 'Escape'; assert.ok(manager.setBindings(changed));
});
test('two players and simultaneous jump/attack keep independent held states', () => {
  const { manager, key } = harness();
  key('keydown', 'KeyD'); key('keydown', 'KeyJ'); key('keydown', 'KeyK'); key('keydown', 'ArrowLeft');
  assert.equal(manager.read()[0].right, true); assert.equal(manager.read()[0].attack, true);
  assert.equal(manager.read()[0].jump, true); assert.equal(manager.read()[1].left, true);
  key('keyup', 'KeyD'); assert.equal(manager.read()[0].right, false);
});
test('blur clears keyboard and every captured touch; pause clears both players', () => {
  const { manager, key, target, counts } = harness();
  key('keydown', 'KeyJ'); manager.touch(7, 1, ['right','jump']);
  target.dispatchEvent(new Event('blur'));
  assert.ok(manager.read().every(p => Object.values(p).every(v => !v))); assert.equal(counts().blurred, 1);
  key('keydown', 'KeyD'); key('keydown', 'Escape');
  assert.equal(manager.read()[0].right, false); assert.equal(counts().paused, 1);
});
test('each touch pointer releases only its own actions and supports diagonals', () => {
  const { manager } = harness();
  manager.touch(1,0,['up','right']); manager.touch(2,0,['attack']); manager.touch(3,1,['jump']);
  manager.read();
  manager.release(2);
  assert.equal(manager.read()[0].attack,false); assert.equal(manager.read()[0].up,true);
  assert.equal(manager.read()[1].jump,true);
  manager.enabled=false; assert.ok(manager.read().every(p=>Object.values(p).every(v=>!v)));
});
test('rebinding uses physical key codes and prevents sticky state', () => {
  const { manager, key } = harness();
  key('keydown','KeyJ'); const changed=structuredClone(DEFAULT_BINDINGS); changed[0].attack='KeyF';
  assert.equal(manager.setBindings(changed),null); assert.equal(manager.read()[0].attack,false);
  key('keydown','KeyJ'); assert.equal(manager.read()[0].attack,false);
  key('keydown','KeyF'); assert.equal(manager.read()[0].attack,true);
});
test('a very short key or touch tap survives until exactly one simulation input read',()=>{
  const {manager,key}=harness();
  key('keydown','KeyJ');key('keyup','KeyJ');
  assert.equal(manager.read()[0].attack,true);assert.equal(manager.read()[0].attack,false);
  manager.touch(1,0,['jump']);manager.release(1);
  assert.equal(manager.read()[0].jump,true);assert.equal(manager.read()[0].jump,false);
  manager.touch(2,0,['special']);manager.release(2,true);assert.equal(manager.read()[0].special,false);
});
