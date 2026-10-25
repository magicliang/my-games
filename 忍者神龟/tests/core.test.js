import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, canHit, createInput, CHARACTERS, STAGES, RULES, BOSS_DEFS } from '../src/core.js';

const step = (g, frames, inputs = []) => { for (let i = 0; i < frames; i++) g.step(inputs); };
function arena(options = {}) {
  const g = new Game(options);
  g.state.enemies = []; g.state.hazards = []; g.state.props = [];
  g.state.players.forEach((p, i) => Object.assign(p, { x: 200 + i * 65, y: 380, invuln: 0 }));
  return g;
}
function dummy(g, x = 260, y = 380, type = 'foot') {
  return g.spawnEnemy(type, x, y, { hp: 200, maxHp: 200, cooldown: 100000, aiTimer: 100000, entryTimer: 0 });
}
const attack = (g, input = { attack: true }) => { g.step([input]); step(g, 8); };

test('fixed dimensions, source-attributed character data and full stage/Boss order', () => {
  assert.equal(RULES.fps, 60);
  assert.deepEqual(Object.values(CHARACTERS).map(c => c.reach), [84, 72, 72, 96]);
  assert.deepEqual(Object.values(CHARACTERS).map(c => c.attackFrames), [19, 16, 21, 20]);
  assert.equal(STAGES.length, 8);
  assert.deepEqual(STAGES.flatMap(s => s.waves.filter(w => w.boss).map(w => w.types[0])), ['rocksteady', 'groundchuck', 'slash', 'bebop', 'dirtbag', 'mother', 'leatherhead', 'rahzar', 'shredder', 'tokka', 'redmother', 'krang', 'super']);
  assert.equal(BOSS_DEFS.super.hp, 448);
});

test('ground lane and height are separate; overlapping pixels do not cause a hit', () => {
  const a = { x: 100, y: 380, z: 0, facing: 1 };
  const b = { x: 160, y: 380, z: 0, hp: 6, height: 55, radius: 16, depthRadius: 8 };
  assert.equal(canHit(a, b), true);
  assert.equal(canHit(a, { ...b, y: 440, z: 60 }), false, 'same rendered y, separate ground lanes');
  assert.equal(canHit(a, { ...b, z: 100 }), false, 'above the weapon');
  assert.equal(canHit({ ...a, facing: -1 }, b), false, 'wrong facing');
  assert.equal(canHit(a, { ...b, x: 350 }), false, 'beyond range');
});

test('normal attack causes damage at its active frame; holding does not invent auto-combos', () => {
  const g = arena(), e = dummy(g), p = g.state.players[0];
  g.step([{ attack: true }]);
  assert.equal(e.hp, 200);
  step(g, CHARACTERS.leo.hitFrame, [{ attack: true }]);
  assert.equal(e.hp, 197);
  step(g, 65, [{ attack: true }]);
  assert.equal(e.hp, 197);
  g.step([{}]); attack(g);
  assert.equal(e.hp, 194);
  assert.equal(p.character, 'leo');
});

test('Don reaches a target that Raph cannot; movement does not silently change weapon range', () => {
  const don = arena({ characters: ['don'] }), raph = arena({ characters: ['raph'] });
  const a = dummy(don, 300), b = dummy(raph, 300);
  attack(don); attack(raph);
  assert.equal(a.hp, 197); assert.equal(b.hp, 200);
});

test('airborne kick uses ground lane plus vertical hit interval', () => {
  const g = arena(), p = g.state.players[0], e = dummy(g);
  g.step([{ jump: true }]); step(g, 5);
  assert.ok(p.z > 0);
  g.step([{ attack: true }]); step(g, 4);
  assert.equal(e.hp, 198);
  const wrongLane = dummy(g, p.x + 55, p.y + 90);
  step(g, 5); assert.equal(wrongLane.hp, 200);
});

test('four special attacks have distinct motion and damage, cost one unit but cannot self-kill', () => {
  const results = {};
  for (const id of ['leo', 'raph', 'mike', 'don']) {
    const g = arena({ characters: [id] }), p = g.state.players[0], e = dummy(g, 250);
    const startX = p.x;
    g.step([{ special: true }]);
    assert.equal(p.hp, RULES.maxHp - 1);
    step(g, CHARACTERS[id].specialFrames + 1);
    results[id] = { moved: p.x - startX, damage: 200 - e.hp };
    p.hp = 1; p.action = 'idle'; g.step([{}]); g.step([{ special: true }]);
    assert.equal(p.hp, 1); assert.equal(p.lives, 4);
  }
  assert.equal(results.leo.moved, 0);
  assert.ok(results.raph.moved > results.don.moved);
  assert.ok(results.mike.moved < results.don.moved);
  assert.ok(results.mike.damage >= 11);
});

test('simultaneous attack+jump activates special, without also jumping or normal attacking', () => {
  const g = arena(), p = g.state.players[0];
  g.step([{ attack: true, jump: true }]);
  assert.equal(p.action, 'special'); assert.equal(p.hp, RULES.maxHp - 1);
  assert.equal(g.state.stats.specials, 1);
});

test('down+attack tosses a regular enemy backwards and the thrown body can hit another enemy', () => {
  const g = arena(), p = g.state.players[0];
  const thrown = g.spawnEnemy('foot', 252, 380, { cooldown: 10000 });
  const behind = g.spawnEnemy('foot', 130, 380, { cooldown: 10000 });
  attack(g, { down: true, attack: true });
  assert.equal(thrown.action, 'thrown'); assert.ok(thrown.vx < 0);
  step(g, 18);
  assert.ok(behind.hp < behind.maxHp);
  assert.equal(g.state.stats.throws, 1);
  assert.equal(p.y, 380, 'toss input does not also move down during the attack');
});

test('damage applies stun/knockback/iframes; repeated contact cannot drain every frame', () => {
  const g = arena(), p = g.state.players[0], e = dummy(g, 240);
  assert.equal(g.damagePlayer(p, 1, e), true);
  assert.equal(p.hp, RULES.maxHp - 1); assert.ok(p.stun > 0); assert.ok(p.invuln > 0);
  assert.equal(g.damagePlayer(p, 1, e), false);
  const x = p.x; g.step(); assert.ok(p.x < x);
  step(g, RULES.playerInvuln);
  assert.equal(g.damagePlayer(p, 1, e), true);
});

test('freeze expires naturally and permits attacking and jumping again', () => {
  const g = arena(), p = g.state.players[0];
  g.damagePlayer(p, 1, null, { freeze: true });
  step(g, 100);
  assert.equal(p.freeze, 0); assert.equal(p.action, 'idle');
  const serial = p.attackSerial; attack(g);
  assert.equal(p.attackSerial, serial + 1);
  step(g, 25); g.step([{ jump: true }]); assert.ok(p.z > 0);
});

test('alternating buttons accelerate thaw without leaving a frozen action behind', () => {
  const g = arena(), p = g.state.players[0];
  g.damagePlayer(p, 1, null, { freeze: true });
  let elapsed = 0;
  while (p.freeze > 0 && elapsed < 100) { g.step([{ attack: elapsed % 2 === 0, jump: elapsed % 2 !== 0 }]); elapsed++; }
  assert.ok(elapsed < 20); assert.equal(p.freeze, 0); assert.equal(p.action, 'idle');
  g.step([{}]); g.step([{ special: true }]); assert.equal(p.action, 'special');
});

test('temporary turtle transformation expires, lands airborne bodies and restores attacks', () => {
  const g = arena(), p = g.state.players[0];
  p.z = 80; p.vz = 0; g.damagePlayer(p, 1, null, { transform: true });
  step(g, 120);
  assert.equal(p.transformed, 0); assert.equal(p.action, 'idle'); assert.equal(p.z, 0);
  g.step([{ attack: true }]); assert.equal(p.action, 'attack'); assert.equal(p.attackSerial, 1);
  step(g, 25); g.step([{ jump: true }]); assert.ok(p.z > 0);
});

test('death consumes one life, permits a different turtle and respawns with invulnerability', () => {
  const g = arena(), p = g.state.players[0];
  g.damagePlayer(p, p.hp, null);
  assert.equal(p.lives, 3); assert.equal(p.awaitingRespawn, true);
  assert.equal(g.selectCharacter(p.id, 'don'), true);
  step(g, 70); g.step([{ jump: true }]);
  assert.equal(p.awaitingRespawn, false); assert.equal(p.character, 'don'); assert.equal(p.hp, p.maxHp);
  assert.ok(p.invuln > 0);
});

test('two players cannot share a turtle; friendly fire follows selected A/B behavior', () => {
  const safe = arena({ characters: ['leo', 'don'], friendlyFire: false });
  attack(safe); assert.equal(safe.state.players[1].hp, RULES.maxHp);
  const dangerous = arena({ characters: ['leo', 'don'], friendlyFire: true });
  attack(dangerous); assert.equal(dangerous.state.players[1].hp, RULES.maxHp - 1);
  dangerous.state.players[0].awaitingRespawn = true;
  assert.equal(dangerous.selectCharacter('p1', 'don'), false);
  assert.equal(dangerous.selectCharacter('p1', 'raph'), true);
  assert.equal(new Game({ characters: ['leo', 'leo'] }).state.players.length, 1);
});

test('midgame join and borrowing a spare life preserve total lives', () => {
  const g = arena();
  assert.equal(g.join('don'), true); assert.equal(g.state.players[0].lives, 3); assert.equal(g.state.players[1].lives, 1);
  const p2 = g.state.players[1]; p2.invuln = 0; g.damagePlayer(p2, p2.maxHp, null);
  step(g, 70); g.step([{}, { jump: true }]);
  assert.equal(p2.hp, p2.maxHp); assert.equal(p2.lives, 1); assert.equal(g.state.players[0].lives, 2);
  assert.equal(g.join('mike'), false);
});

test('borrowing a life revalidates turtle uniqueness after the partner changed characters', () => {
  const g = arena({ characters: ['leo', 'don'] }), [p1, p2] = g.state.players;
  p1.lives = 1; g.damagePlayer(p1, p1.maxHp, null); g.damagePlayer(p2, p2.maxHp, null);
  assert.equal(g.selectCharacter('p2', 'leo'), true);
  step(g, 70); g.step([{}, { jump: true }]);
  assert.equal(p2.character, 'leo'); assert.equal(p2.awaitingRespawn, false);
  g.step([{ jump: true }, {}]);
  assert.equal(p1.awaitingRespawn, false); assert.notEqual(p1.character, p2.character);
  assert.equal(p1.lives, 1); assert.equal(p2.lives, 2);
});

test('partner attacks break a grab; button mashing is also a working escape', () => {
  const g = arena({ characters: ['leo', 'don'] }), [p1, p2] = g.state.players;
  const e = dummy(g, 320); p1.grabbedBy = e.id; e.heldPlayer = p1.id;
  p2.x = 260; g.step([{}, { attack: true }]); step(g, 5);
  assert.equal(p1.grabbedBy, null);
  p1.grabbedBy = e.id; e.heldPlayer = p1.id; p1.escape = 0;
  for (let i = 0; i < 8; i++) g.step([{ attack: i % 2 === 0, jump: i % 2 !== 0 }, {}]);
  assert.equal(p1.grabbedBy, null);
});

test('pizza heals, props can break, score rewards are not dependent on render frames', () => {
  const g = arena(), p = g.state.players[0];
  p.hp = 2; g.dropItem('pizza', p.x, p.y); g.step();
  assert.equal(p.hp, p.maxHp); assert.equal(g.state.items.length, 0);
  g.state.props.push({ id: 'crate-fixture', type: 'crate', hp: 3, maxHp: 3, x: 255, y: 380, z: 0, height: 50, drop: 'pizza' });
  attack(g); assert.equal(g.state.props.length, 0); assert.equal(g.state.items.length, 1);
  g.addScore(p, 25000); assert.equal(p.lives, 5);
});

test('pause freezes all simulation state and clears an attack buffer', () => {
  const g = new Game(); g.state.players[0].attackBuffer = 5;
  g.setPaused(true); const frozen = JSON.stringify(g.state);
  step(g, 100, [{ right: true, attack: true }]);
  assert.equal(JSON.stringify(g.state), frozen); assert.equal(g.state.players[0].attackBuffer, 0);
  g.setPaused(false); const x = g.state.players[0].x; g.step([{}]); assert.equal(g.state.players[0].x, x);
});

test('classic is default; high health and invincibility must be explicit', () => {
  const classic = arena(), high = arena({ mode: 'high' }), invincible = arena({ mode: 'invincible' });
  assert.equal(classic.state.mode, 'classic'); assert.equal(classic.state.players[0].maxHp, RULES.maxHp);
  assert.equal(high.state.players[0].maxHp, RULES.highHp);
  assert.equal(invincible.damagePlayer(invincible.state.players[0], 999, null), false);
  assert.equal(classic.damagePlayer(classic.state.players[0], 1, null), true);
});

test('pit respects jump height; laser hazards have a readable inactive interval', () => {
  const g = arena(), p = g.state.players[0];
  g.state.hazards = [{ type: 'pit', x: 190, y: 360, w: 90, h: 80 }];
  p.z = 80; g.step(); assert.equal(p.hp, p.maxHp);
  p.z = 0; p.vz = 0; g.step(); assert.equal(p.hp, p.maxHp - 1); assert.ok(p.x < 190);
  g.state.hazards = [{ type: 'laser', x: 100, y: 360, w: 400, h: 80, period: 180 }];
  g.state.stageFrame = 0; p.invuln = 0; p.stun = 0; g.step(); assert.equal(g.state.hazards[0].active, false);
});

test('continue restarts the current stage, preserves score and is limited to three', () => {
  const g = arena(); g.loadStage(3); const p = g.state.players[0]; p.score = 4200;
  for (let i = 0; i < 3; i++) { g.state.phase = 'gameover'; assert.equal(g.continueGame(), true); assert.equal(g.state.stageIndex, 3); assert.equal(p.score, 4200); assert.equal(p.lives, 4); }
  g.state.phase = 'gameover'; assert.equal(g.continueGame(), false);
});

test('stage-clear bonus equals the remaining displayed time, without an invented multiplier', () => {
  const g = arena(), p = g.state.players[0];
  g.state.waveIndex = STAGES[0].waves.length - 1; g.state.waveActive = true; g.state.timeLeft = 123;
  g.step();
  assert.equal(g.state.phase, 'stageClear'); assert.equal(p.score, 123);
});

test('all Bosses run distinct patterns; progression thresholds and summons are live rules', () => {
  const observed = {};
  for (const type of Object.keys(BOSS_DEFS)) {
    const g = arena({ mode: 'invincible' }), e = g.spawnEnemy(type, 650, 380);
    e.aiTimer = 0;
    const patterns = new Set();
    for (let i = 0; i < 500; i++) { g.step(); patterns.add(e.aiState); }
    observed[type] = patterns;
    assert.ok(patterns.size >= 3, `${type}: needs a cycle, got ${[...patterns]}`);
    if (type === 'mother' || type === 'redmother') assert.ok(g.state.enemies.some(q => q.type === 'mouser'));
  }
  assert.ok(observed.rocksteady.has('gun')); assert.ok(observed.rocksteady.has('jumpGun')); assert.ok(observed.dirtbag.has('pickaxe'));
  assert.ok(observed.rahzar.has('iceBreath')); assert.ok(observed.super.has('teleport'));
  const g = arena(), krang = g.spawnEnemy('krang', 650, 380);
  krang.hp = 256; g.step(); assert.equal(krang.phase, 2);
  krang.hp = 96; g.step(); assert.equal(krang.phase, 3);
  const chuck = g.spawnEnemy('groundchuck', 650, 400); chuck.hp = 95; chuck.aiTimer = 0; g.step(); assert.equal(chuck.aiState, 'pipe');
});

test('Rocksteady jump-fire keeps its ground position, fires from its current height and lands', () => {
  const g = arena({ mode: 'invincible' }), p = g.state.players[0], e = g.spawnEnemy('rocksteady', 650, 380);
  g.beginAI(e, 'jumpGun', 60, p);
  const ground = [e.x, e.y], observedShots = [];
  for (let frame = 0; frame < 60; frame++) {
    g.step();
    assert.deepEqual([e.x, e.y], ground, 'jump height must not change the ground plane');
    const born = g.state.projectiles.filter(shot => shot.owner === e.id && shot.age === 1);
    for (const shot of born) { assert.equal(shot.z, e.z + 35); observedShots.push(shot.z); }
  }
  assert.equal(observedShots.length, 3);
  assert.ok(new Set(observedShots).size > 1, 'projectile height follows the moving gun');
  assert.ok(observedShots.every(z => z > 35)); assert.equal(e.z, 0);
});

test('Rocksteady can be jump-kicked during jump-fire and attacked normally while descending', () => {
  const g = arena({ mode: 'invincible' }), p = g.state.players[0], e = g.spawnEnemy('rocksteady', 265, 380);
  g.beginAI(e, 'jumpGun', 60, p);
  step(g, 10); g.step([{ jump: true }]); step(g, 5); attack(g);
  assert.equal(e.hp, BOSS_DEFS.rocksteady.hp - RULES.kickDamage);
  while (e.aiAge < 56) g.step();
  p.z = 0; p.vz = 0; p.action = 'idle'; e.invuln = 0;
  const hp = e.hp; attack(g);
  assert.equal(e.hp, hp - RULES.attackDamage);
  assert.equal(e.z, 0);
});

test('Tokka blocks a jump kick while guarding but can take a grounded attack', () => {
  const g = arena(), p = g.state.players[0], e = g.spawnEnemy('tokka', 265, 380);
  e.aiState = 'guard'; e.aiTimer = 50;
  assert.equal(g.damageEnemy(e, 2, p, 'kick'), false);
  assert.equal(g.damageEnemy(e, 3, p, 'attack'), true);
});

test('Krang splits into independently moving and hittable parts with shared HP and a single reward', () => {
  const g = arena({ mode: 'invincible' }), p = g.state.players[0], e = g.spawnEnemy('krang', 600, 380);
  e.hp = 256; e.aiTimer = 0; g.step();
  const parts = g.state.enemies.filter(part => part.partOf === e.id);
  assert.equal(parts.length, 2); assert.equal(e.targetable, false); assert.equal(e.hiddenBody, true);
  const upper = parts.find(part => part.partKind === 'upper'), lower = parts.find(part => part.partKind === 'lower');
  const before = [upper.x, upper.y, lower.x, lower.y]; step(g, 30);
  assert.notDeepEqual([upper.x, upper.y, lower.x, lower.y], before); assert.notEqual(upper.x, lower.x); assert.ok(upper.z > lower.z);
  e.invuln = 0; assert.equal(g.damageEnemy(upper, 3, p), true); assert.equal(e.hp, 253);
  assert.equal(g.damageEnemy(lower, 3, p), false, 'shared iframe prevents double damage in one tick');
  e.invuln = 0; assert.equal(g.damageEnemy(lower, 3, p), true); assert.equal(e.hp, 250);
  assert.equal(g.damageEnemy(e, 3, p), false, 'hidden torso is not an extra hit target');
  e.hp = 96; e.invuln = 0; step(g, 5);
  assert.equal(e.phase, 3); assert.equal(e.hiddenBody, false); assert.equal(g.state.enemies.filter(part => part.partOf === e.id).length, 0);
  e.aiState = 'electricBody'; assert.equal(g.damageEnemy(e, 3, p), false);
  e.aiState = 'recover'; e.hp = 3; assert.equal(g.damageEnemy(e, 3, p), true);
  assert.equal(g.state.stats.bosses, 1); assert.equal(p.score, BOSS_DEFS.krang.score);
});

test('Krang parts share Boss throw/pit immunity, rather than becoming throwable minions', () => {
  const g = arena(), p = g.state.players[0], e = g.spawnEnemy('krang', 300, 380);
  e.hp = 256; e.aiTimer = 0; g.step();
  const lower = g.state.enemies.find(part => part.partKind === 'lower');
  p.x = lower.x - 60; p.y = lower.y; p.facing = 1;
  attack(g, { down: true, attack: true });
  assert.equal(lower.z, 0); assert.notEqual(lower.action, 'thrown'); assert.equal(g.state.stats.throws, 0);
  g.state.hazards = [{ type: 'pit', x: lower.x - 100, y: 290, w: 200, h: 175 }];
  g.step(); assert.ok(lower.hp > 0);
});

test('Tokka grabs and throws the player into a fixed neon sign; landing causes electric damage', () => {
  const g = arena(), p = g.state.players[0];
  g.state.hazards = [{ type: 'neon', x: 700, y: 320, w: 62, h: 105 }];
  const e = g.spawnEnemy('tokka', 250, 380); e.facing = -1;
  g.bossGrab(e, p, g.state.hazards[0]);
  assert.equal(p.hp, p.maxHp - 2); assert.equal(p.grabbedBy, e.id);
  step(g, 16); assert.ok(p.tossed); assert.equal(p.tossed.toX, 731);
  step(g, 20); assert.ok(p.z > 80); assert.equal(p.action, 'thrown');
  step(g, 20); assert.equal(p.tossed, null); assert.equal(p.z, 0); assert.equal(p.hp, p.maxHp - 4);
  assert.ok(Math.abs(p.x - 731) < 1);
});

test('surf and lift progress automatically between waves while retaining screen-relative movement', () => {
  for (const index of [1, 6]) {
    const g = new Game({ mode: 'invincible' }); g.loadStage(index);
    g.state.enemies = []; g.state.waveActive = false;
    const p = g.state.players[0], before = p.x - g.state.cameraX;
    step(g, 70);
    assert.equal(g.state.autoScroll, true); assert.ok(g.state.cameraX > 80);
    assert.ok(Math.abs(p.x - g.state.cameraX - before) < .01);
    const after = p.x - g.state.cameraX; g.step([{ left: true }]);
    assert.ok(p.x - g.state.cameraX < after);
  }
});

test('seed and identical input produce the same simulation without a renderer', () => {
  const a = new Game({ seed: 765 }), b = new Game({ seed: 765 });
  for (let f = 0; f < 700; f++) {
    const input = [{ right: f < 140, down: f % 160 > 80, attack: f % 25 === 0, special: f % 90 === 0 }];
    a.step(input); b.step(input);
  }
  assert.deepEqual(a.state, b.state);
});

test('all four turtles clear the first stage in classic mode through real damage, death and respawn inputs', () => {
  for (const character of ['leo', 'don', 'mike', 'raph']) {
    const g = new Game({ characters: [character] });
    for (let f = 0; f < 15000 && g.state.stageIndex === 0 && g.state.phase !== 'gameover'; f++) {
      const s = g.state, p = s.players[0]; let input = { right: true };
      if (p.awaitingRespawn) input = { jump: f % 2 === 0 };
      else {
        const e = s.enemies.filter(e => e.hp > 0).sort((a, b) => Number(b.isBoss) - Number(a.isBoss) || Math.hypot(a.x - p.x, (a.y - p.y) * 2) - Math.hypot(b.x - p.x, (b.y - p.y) * 2))[0];
        if (e) {
          const dx = e.x - p.x, dy = e.y - p.y;
          input = { right: dx > 60, left: dx < -60, down: dy > 5, up: dy < -5 };
          if (Math.abs(dx) < 100 && Math.abs(dy) < 30) { input.attack = f % 24 === 0; input.special = p.hp === 1 && f % 45 === 0; }
          if (p.grabbedBy) { input.attack = f % 2 === 0; input.jump = f % 2 !== 0; }
        }
      }
      g.step([input]);
    }
    assert.equal(g.state.stageIndex, 1, character); assert.equal(g.state.stats.bosses, 1);
    assert.ok(g.state.stats.damageTaken > 0); assert.ok(g.state.stats.deaths > 0); assert.equal(g.state.continuesLeft, 3);
  }
});

/** No HP edits, enemy deletion, teleportation, stage skips or direct damage calls in this traversal. */
test('actual input-driven combat traverses all eight stages and defeats all thirteen Boss encounters', () => {
  const g = new Game({ mode: 'invincible', characters: ['leo'], seed: 1 });
  const visited = new Set(), fought = new Set();
  for (let frame = 0; frame < 80000 && g.state.phase !== 'victory'; frame++) {
    const s = g.state, p = s.players[0]; visited.add(s.stageIndex);
    const enemies = s.enemies.filter(e => e.hp > 0 && e.targetable !== false).sort((a, b) => Number(b.isBoss) - Number(a.isBoss) || Math.hypot(a.x - p.x, (a.y - p.y) * 2) - Math.hypot(b.x - p.x, (b.y - p.y) * 2));
    const e = enemies[0]; let input = { right: true };
    if (e) {
      if (e.isBoss) fought.add(e.type);
      const dx = e.x - p.x, dy = e.y - p.y;
      input = { right: dx > 55, left: dx < -55, down: dy > 5, up: dy < -5 };
      if (Math.abs(dx) < 130 && Math.abs(dy) < 40) { input.special = frame % 45 === 0; input.attack = frame % 12 === 0; }
      if (p.grabbedBy) { input.attack = frame % 2 === 0; input.jump = frame % 2 !== 0; }
    }
    g.step([input]);
  }
  assert.equal(g.state.phase, 'victory'); assert.equal(visited.size, 8); assert.equal(fought.size, 13);
  assert.equal(g.state.stats.bosses, 13); assert.equal(g.state.stats.stages, 8);
  assert.ok(g.state.stats.hits > 500);
  // This proves reachability and combat integration, not original-game fidelity or classic difficulty.
});
