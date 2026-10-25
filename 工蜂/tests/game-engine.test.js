const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../game-engine.js');
const C = require('../game-core.js');

function arena(playerCount = 1, stage = 0) {
  const s = E.start(stage, playerCount);
  s.bossSpawned = true;
  s.spawnedWaves = new Set(C.LEVELS[stage].waves.map((_, i) => i));
  s.players.forEach(p => { p.invulnerable = 0; });
  return s;
}
function frames(s, count, inputs = []) {
  for (let i = 0; i < count; i++) E.step(s, typeof inputs === 'function' ? inputs(i, s) : inputs);
}
function target(x, y) { return { type: 'ground', x, y, radius: 13, hp: 1, kind: 'bush', fireClock: 5 }; }
function bullet(x, y, owner = 0, extra = {}) {
  return { type: 'player-shot', x, y, owner, vx: 0, vy: -360, radius: 3, damage: 1, volley: 1, ...extra };
}
function enemyBullet(x, y, extra = {}) {
  return { type: 'enemy-shot', kind: 'enemy', x, y, vx: 0, vy: 0, radius: 4, t: 0, ...extra };
}
function pickup(kind, x, y, extra = {}) {
  return { type: 'pickup', kind, x, y, radius: 12, phase: 0, t: 0, ...extra };
}
function bellShot(s, bell) {
  bell.hitCooldown = 0;
  s.playerShots = [bullet(bell.x, bell.y)];
  E.collisions(s);
}

test('对空炮穿过地面目标，只命中同位置的空敌；投弹只伤锁定地面目标', () => {
  const s = arena();
  const p = s.player;
  p.x = 200; p.y = 350;
  const ground = target(200, 282);
  s.groundTargets.push(ground);
  const air = E.enemy(s, 'strawberry', 200, 282, 'line', { speed: 0, hp: 2 });
  s.playerShots.push(bullet(200, 282));
  E.collisions(s);
  assert.equal(air.hp, 1);
  assert.equal(ground.dead, undefined);
  E.bomb(s, p);
  assert.equal(s.bombs.length, 1);
  frames(s, 24);
  assert.equal(ground.dead, true);
  assert.equal(air.hp, 1);
  assert.equal(s.score, 500);
  assert.equal(s.pickups[0].kind, 'fruit');
});

test('没有目标/目标超出准星/双臂缺失时不能空投，炸弹跟随移动的锁定目标', () => {
  const s = arena();
  const p = s.player;
  p.x = 200; p.y = 350;
  E.bomb(s, p);
  assert.equal(s.bombs.length, 0);
  const outside = target(260, 282);
  s.groundTargets.push(outside);
  E.bomb(s, p);
  assert.equal(s.bombs.length, 0);
  const locked = target(200, 282);
  s.groundTargets.push(locked);
  p.arms.left = p.arms.right = false;
  E.bomb(s, p);
  assert.equal(s.bombs.length, 0);
  p.arms.left = p.arms.right = true;
  s.bossSpawned = false;
  s.nextCloud = s.nextGround = Infinity;
  E.bomb(s, p);
  const originalY = locked.y;
  frames(s, 24);
  assert.ok(locked.y > originalY);
  assert.equal(locked.dead, true);
  assert.equal(outside.dead, undefined);
});

test('敌弹同时打掉双臂，救护车修复后该条命不再出车，下条命重新获得机会', () => {
  const s = arena();
  const p = s.player;
  s.enemyShots.push(enemyBullet(p.x, p.y));
  E.step(s);
  assert.deepEqual(p.arms, { left: false, right: false });
  assert.equal(p.lives, 3);
  let ambulance = s.pickups.find(i => i.kind === 'ambulance');
  assert.ok(ambulance);
  ambulance.x = p.x; ambulance.y = p.y;
  E.step(s);
  assert.deepEqual(p.arms, { left: true, right: true });
  p.invulnerable = 0;
  s.enemyShots.push(enemyBullet(p.x, p.y));
  E.step(s);
  assert.equal(s.pickups.some(i => i.kind === 'ambulance'), false);
  p.invulnerable = 0;
  s.enemyShots.push(enemyBullet(p.x, p.y));
  E.step(s);
  assert.equal(p.lives, 2);
  assert.equal(p.ambulanceUsed, false);
  p.invulnerable = 0;
  s.enemyShots.push(enemyBullet(p.x, p.y));
  E.step(s);
  assert.equal(s.pickups.filter(i => i.kind === 'ambulance').length, 1);
});

test('未接到的救护车离场后不会重发；双人救护车不能被另一玩家拿走', () => {
  const s = arena(2);
  const [a, b] = s.players;
  E.hurt(s, a);
  const ambulance = s.pickups[0];
  ambulance.x = b.x; ambulance.y = b.y;
  E.collisions(s);
  assert.equal(ambulance.dead, undefined);
  assert.deepEqual(a.arms, { left: false, right: false });
  ambulance.x = 24; ambulance.y = C.HEIGHT + 34;
  E.step(s);
  frames(s, 600);
  assert.equal(s.pickups.some(i => i.kind === 'ambulance'), false);
  assert.equal(a.ambulanceUsed, true);
});

test('Boss战死亡在原位置复活、清强化，Boss血量和当前关卡保持', () => {
  const s = arena();
  s.bossSpawned = false;
  const boss = E.spawnBoss(s);
  boss.hp = 7;
  s.player.x = 110; s.player.y = 340;
  s.player.speedLevel = 3; s.player.twinShot = true;
  const air = E.enemy(s, 'strawberry', 110, 340, 'line', { speed: 0 });
  E.collisions(s);
  assert.equal(s.player.lives, 2);
  assert.deepEqual([s.player.x, s.player.y], [110, 340]);
  assert.equal(s.player.speedLevel, 0);
  assert.equal(s.player.twinShot, false);
  assert.equal(boss.hp, 7);
  assert.equal(s.boss, boss);
  assert.equal(s.enemies.includes(air), true);
  assert.equal(s.stageIndex, 0);
  assert.equal(s.mode, 'playing');
});

test('暂停/游戏结束不推进时间、位置、冷却或关卡，恢复后继续', () => {
  const s = arena();
  s.player.shotCooldown = 0.12;
  for (const mode of ['paused', 'game-over']) {
    s.mode = mode;
    const before = structuredClone(s);
    frames(s, 180, [{ right: true, fire: true, bomb: true }]);
    assert.deepEqual(s, before);
  }
  s.mode = 'playing';
  E.step(s, [{ right: true }]);
  assert.ok(s.player.x > C.WIDTH / 2);
  assert.equal(s.frame, 1);
});

test('实际射击击败五关Boss，自动进入第六关，保留装备残机得分和黄铃连分', () => {
  const s = arena();
  s.player.speedLevel = 2;
  E.collect(s, pickup('bell', 0, 0, { color: 'yellow' }), s.player);
  E.collect(s, pickup('bell', 0, 0, { color: 'yellow' }), s.player);
  for (let stage = 0; stage < 5; stage++) {
    s.bossSpawned = false;
    const boss = E.spawnBoss(s);
    boss.hp = 1;
    boss.y = 88;
    s.player.x = boss.x; s.player.y = 128;
    E.fire(s, s.player);
    for (let i = 0; i < 20 && s.mode === 'playing'; i++) E.step(s);
    assert.equal(s.mode, 'stage-clear', `stage ${stage + 1} should clear through projectile collision`);
    frames(s, 151);
    assert.equal(s.mode, 'playing');
    assert.equal(s.stageNumber, stage + 2);
    assert.equal(s.player.speedLevel, 2);
    assert.equal(s.player.bellChain, 2);
  }
  assert.equal(s.stageIndex, 0);
  assert.equal(s.loop, 2);
  assert.equal(s.score, 51500);
  assert.equal(s.player.lives, 4);
  assert.equal(s.player.nextExtraLife, 200000);
});

test('双人分别接收输入与射击归属，一人耗尽后另一人继续', () => {
  const s = arena(2);
  const [a, b] = s.players;
  const initial = [a.x, b.x];
  frames(s, 12, [{ left: true, fire: true }, { right: true }]);
  assert.ok(a.x < initial[0]);
  assert.ok(b.x > initial[1]);
  assert.ok(s.playerShots.every(shot => shot.owner === 0));
  const targetEnemy = E.enemy(s, 'strawberry', b.x, b.y - 40, 'line', { speed: 0 });
  E.fire(s, b);
  frames(s, 8);
  assert.equal(targetEnemy.dead, true);
  assert.equal(b.score, 100);
  assert.equal(a.score, 0);
  a.lives = 1; a.invulnerable = 0;
  E.hurt(s, a, true);
  assert.equal(a.active, false);
  assert.equal(b.active, true);
  assert.equal(s.mode, 'playing');
  b.lives = 1; b.invulnerable = 0;
  E.hurt(s, b, true);
  assert.equal(s.mode, 'game-over');
});

test('最后一机碰撞死亡后不能同帧拾取道具，仍存活的2P不受影响', () => {
  const s = arena(2);
  const [a, b] = s.players;
  a.lives = 1;
  E.enemy(s, 'strawberry', a.x, a.y, 'line', { speed: 0 });
  const milk = pickup('milk', a.x, a.y);
  s.pickups.push(milk);
  E.collisions(s);
  assert.equal(a.active, false);
  assert.equal(a.lives, 0);
  assert.equal(milk.dead, undefined);
  assert.equal(b.lives, 3);
  assert.equal(s.mode, 'playing');
});

test('横向牵手Fire穿透但对同一敌只计一次伤害，纵向Star向四方发射', () => {
  const s = arena(2);
  const [a, b] = s.players;
  a.x = 200; b.x = 236; a.y = b.y = 350;
  E.step(s, [{ fire: true }, {}]);
  assert.equal(s.formation.kind, 'fire');
  const fire = s.playerShots.find(shot => shot.kind === 'fire');
  assert.ok(fire?.piercing);
  const foe = E.enemy(s, 'purple-pot', fire.x, fire.y, 'line', { speed: 0, hp: 10 });
  E.collisions(s); E.collisions(s);
  assert.equal(foe.hp, 7);
  s.playerShots = []; s.enemies = []; s.formationCooldown = 0;
  a.x = b.x = 200; a.y = 320; b.y = 350;
  E.step(s, [{}, { fire: true }]);
  assert.equal(s.formation.kind, 'star');
  const stars = s.playerShots.filter(shot => shot.kind === 'star');
  assert.equal(stars.length, 4);
  assert.ok(stars.every(shot => shot.owner === 1));
  assert.ok(stars.some(shot => shot.vx < -300));
  assert.ok(stars.some(shot => shot.vx > 300));
  assert.ok(stars.some(shot => shot.vy < -300));
  assert.ok(stars.some(shot => shot.vy > 300));
  a.arms.left = a.arms.right = false;
  E.step(s, [{ fire: true }, { fire: true }]);
  assert.equal(s.formation, null);
});

test('飞碟环弹绿色初态安全，白色阶段只在环边伤人、环内仍安全', () => {
  const s = arena(1, 1);
  const p = s.player;
  const ring = enemyBullet(p.x - 60, p.y, { kind: 'ring', radius: 60, t: 0.7 });
  s.enemyShots.push(ring);
  E.collisions(s);
  assert.deepEqual(p.arms, { left: true, right: true });
  ring.t = 0.8;
  E.collisions(s);
  assert.deepEqual(p.arms, { left: false, right: false });
  p.arms.left = p.arms.right = true; p.invulnerable = 0;
  p.x = ring.x; p.y = ring.y;
  E.collisions(s);
  assert.deepEqual(p.arms, { left: true, right: true });
});

test('射云出铃、追打瞬时变色、31发转蜂、击蜂记15100分；同一云不重复出铃', () => {
  const s = arena();
  const cloud = { x: 200, y: 180, radius: 23, hasBell: true, bellReleased: false, hits: 0, speed: 38 };
  s.clouds.push(cloud);
  s.playerShots.push(bullet(200, 180));
  E.collisions(s);
  const bell = s.pickups[0];
  assert.equal(bell.kind, 'bell');
  assert.equal(bell.color, 'yellow');
  assert.equal(s.bellHits, 0);
  assert.equal(s.clouds.length, 1);
  for (let hit = 1; hit <= 31; hit++) {
    bellShot(s, bell);
    if (hit === 4) assert.equal(bell.color, 'blue');
    if (hit === 5) assert.equal(bell.color, 'yellow');
  }
  assert.equal(bell.dead, true);
  const bee = s.enemies.find(e => e.kind === 'bee');
  assert.ok(bee);
  s.playerShots = [bullet(bee.x, bee.y)];
  E.collisions(s);
  assert.equal(s.score, 15100);
  s.playerShots = [bullet(cloud.x, cloud.y)];
  E.collisions(s);
  assert.equal(s.pickups.filter(i => i.kind === 'bell').length, 1);
});

test('漏掉蓝铃也重置黄铃连分；追打铃不会离开屏幕顶端', () => {
  const s = arena();
  E.collect(s, pickup('bell', 0, 0, { color: 'yellow' }), s.player);
  E.collect(s, pickup('bell', 0, 0, { color: 'yellow' }), s.player);
  const missed = pickup('bell', 40, C.HEIGHT + 21, { color: 'blue', vx: 0, vy: 65 });
  s.pickups.push(missed);
  s.bellHits = 9;
  E.step(s);
  assert.equal(s.player.bellChain, 0);
  assert.equal(s.bellHits, 0);
  const topBell = pickup('bell', 100, 16, { color: 'yellow', vx: 0, vy: -112 });
  s.pickups.push(topBell);
  frames(s, 12);
  assert.ok(topBell.y >= 16);
  assert.ok(s.pickups.includes(topBell));
});

test('分身实际从历史位置开火，停止后射击原点收拢；糖果不计时失效', () => {
  const s = arena();
  const p = s.player;
  E.collect(s, pickup('bell', 0, 0, { color: 'flashing' }), p);
  frames(s, 30, [{ right: true }]);
  const cloneXs = p.clonePositions.map(pos => pos.x);
  assert.ok(cloneXs[0] < p.x && cloneXs[1] < cloneXs[0]);
  E.fire(s, p);
  assert.deepEqual(s.playerShots.filter(shot => shot.clone).map(shot => shot.x), cloneXs);
  frames(s, 30);
  assert.ok(p.clonePositions.every(pos => pos.x === p.x && pos.y === p.y));
  const candyState = arena();
  E.collect(candyState, pickup('candy', 0, 0), candyState.player);
  frames(candyState, 60 * 20);
  E.fire(candyState, candyState.player);
  assert.equal(candyState.player.threeWay, true);
  assert.equal(candyState.playerShots.length, 3);
  assert.ok(candyState.playerShots.some(shot => shot.vx < 0));
  assert.ok(candyState.playerShots.some(shot => shot.vx > 0));
});

test('地面奖励顺序稳定：6糖果、15星、25牛奶，双人/分身不掉糖果', () => {
  const s = arena();
  for (let i = 1; i <= 25; i++) E.groundDrop(s, target(50, 50));
  assert.equal(s.pickups[5].kind, 'candy');
  assert.equal(s.pickups[14].kind, 'star');
  assert.equal(s.pickups[24].kind, 'milk');
  const dual = arena(2);
  dual.groundDestroyed = 5;
  E.groundDrop(dual, target(50, 50));
  assert.equal(dual.pickups[0].kind, 'fruit');
  s.player.mirrors = true; s.groundDestroyed = 5;
  E.groundDrop(s, target(50, 50));
  assert.equal(s.pickups.at(-1).kind, 'fruit');
});

test('星星清空空敌及敌弹、保留Boss和地面目标；牛奶加一机', () => {
  const s = arena();
  s.bossSpawned = false;
  const boss = E.spawnBoss(s);
  const hp = boss.hp;
  E.enemy(s, 'strawberry', 60, 60);
  E.enemy(s, 'onion', 90, 60);
  s.groundTargets.push(target(100, 100));
  s.enemyShots.push(enemyBullet(60, 60));
  E.collect(s, pickup('star', 0, 0), s.player);
  assert.equal(s.enemies.filter(e => !e.dead).length, 1);
  assert.equal(boss.hp, hp);
  assert.equal(s.groundTargets[0].dead, undefined);
  assert.equal(s.enemyShots.length, 0);
  assert.equal(s.score, 200);
  E.collect(s, pickup('milk', 0, 0), s.player);
  assert.equal(s.player.lives, 4);
});

function soak() {
  const s = E.start();
  // Invulnerability is a fixture so a complete twenty-minute stress run cannot end early.
  s.player.invulnerable = 1000000;
  const keys = ['enemies', 'playerShots', 'enemyShots', 'bombs', 'groundTargets', 'clouds', 'pickups', 'particles', 'events'];
  const peak = Object.fromEntries(keys.map(key => [key, 0]));
  for (let i = 0; i < 60 * 1200; i++) {
    const p = s.player;
    const x = s.boss && !s.boss.dead ? s.boss.x : 40 + (i / 2 % (C.WIDTH - 80));
    E.step(s, [{ pointer: { x, y: C.HEIGHT - 64 }, fire: true, bomb: true }]);
    for (const key of keys) peak[key] = Math.max(peak[key], s[key].length);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(p.x >= 20 && p.x <= C.WIDTH - 20);
    assert.ok(p.history.length <= 25);
  }
  return { stageNumber: s.stageNumber, loop: s.loop, mode: s.mode, score: s.score,
    seed: s.seed, serial: s.serial, frame: s.frame, peak,
    player: { x: s.player.x, y: s.player.y, arms: s.player.arms, lives: s.player.lives },
    enemies: s.enemies.map(e => ({ kind: e.kind, x: e.x, y: e.y, hp: e.hp })) };
}

test('固定输入20分钟实际模拟可复现，进入第二周目，所有实体数组保持有界', t => {
  const first = soak();
  const second = soak();
  assert.deepEqual(second, first);
  assert.equal(first.mode, 'playing');
  assert.ok(first.stageNumber >= 6, 'real fire should clear all five bosses and enter the second loop');
  const limits = { enemies: 100, playerShots: 50, enemyShots: 150, bombs: 4,
    groundTargets: 25, clouds: 8, pickups: 30, particles: 400, events: 80 };
  for (const [key, limit] of Object.entries(limits)) assert.ok(first.peak[key] <= limit, `${key}: ${first.peak[key]} > ${limit}`);
  t.diagnostic(JSON.stringify(first));
});

test('护盾边缘撞普通敌会消灭敌人计分，撞Boss只消耗护盾而不秒杀Boss', () => {
  const s = arena();
  const p = s.player;
  E.collect(s, pickup('bell', 0, 0, { color: 'red' }), p);
  const foe = E.enemy(s, 'onion', p.x + 32, p.y, 'line', { speed: 0 });
  E.collisions(s);
  assert.equal(foe.dead, true);
  assert.equal(s.score, 100);
  assert.equal(p.shield, C.FC_RULES.shieldHits - 2);
  assert.equal(p.lives, 3);
  s.bossSpawned = false;
  const boss = E.spawnBoss(s);
  const hp = boss.hp;
  boss.x = p.x; boss.y = p.y;
  p.invulnerable = 0;
  E.collisions(s);
  assert.equal(boss.hp, hp);
  assert.equal(boss.dead, undefined);
  assert.equal(p.shield, C.FC_RULES.shieldHits - 4);
});

test('每位玩家最多一颗在途炸弹，落地后才能投下一颗，双人互不抢名额', () => {
  const s = arena(2);
  const [a, b] = s.players;
  s.groundTargets.push(target(a.x, a.y - 68), target(b.x, b.y - 68));
  E.bomb(s, a); E.bomb(s, a); E.bomb(s, b); E.bomb(s, b);
  assert.equal(s.bombs.length, 2);
  assert.equal(s.bombs.filter(item => item.owner === 0).length, 1);
  assert.equal(s.bombs.filter(item => item.owner === 1).length, 1);
  frames(s, 24);
  assert.equal(s.bombs.length, 0);
  s.groundTargets.push(target(a.x, a.y - 68));
  E.bomb(s, a);
  assert.equal(s.bombs.length, 1);
});

test('地面奖励按完整25次循环，12和30次不按6倍数误出糖果', () => {
  const s = arena();
  for (let i = 0; i < 50; i++) E.groundDrop(s, target(50, 50));
  assert.deepEqual(s.pickups.flatMap((item, i) => item.kind === 'candy' ? [i + 1] : []), [6, 31]);
  assert.deepEqual(s.pickups.flatMap((item, i) => item.kind === 'star' ? [i + 1] : []), [15, 40]);
  assert.deepEqual(s.pickups.flatMap((item, i) => item.kind === 'milk' ? [i + 1] : []), [25, 50]);
  assert.equal(s.pickups[11].kind, 'fruit');
  assert.equal(s.pickups[29].kind, 'fruit');
});

test('按住Select取得糖果后实际发出左/前/右三向弹，普通糖果仍斜向散射', () => {
  const s = arena();
  s.pickups.push(pickup('candy', s.player.x, s.player.y));
  E.step(s, [{ select: true }]);
  assert.equal(s.player.wideThreeWay, true);
  E.step(s, [{ fire: true }]);
  assert.equal(s.playerShots.length, 3);
  assert.ok(s.playerShots.some(shot => shot.vx <= -359 && Math.abs(shot.vy) < 0.001));
  assert.ok(s.playerShots.some(shot => shot.vx >= 359 && Math.abs(shot.vy) < 0.001));
  assert.ok(s.playerShots.some(shot => Math.abs(shot.vx) < 0.001 && shot.vy <= -359));
  const normal = arena();
  normal.pickups.push(pickup('candy', normal.player.x, normal.player.y));
  E.step(normal);
  E.step(normal, [{ fire: true }]);
  assert.equal(normal.player.wideThreeWay, false);
  assert.ok(normal.playerShots.every(shot => shot.vy < -300));
});

test('五种Boss真实更新产生各自攻击：卫星/环弹/青蛙/公转弹/开花俯冲', () => {
  const signatures = [];
  for (let stage = 0; stage < 5; stage++) {
    const s = arena(1, stage);
    s.player.invulnerable = 1000;
    s.bossSpawned = false;
    const boss = E.spawnBoss(s);
    boss.entered = true; boss.y = 90; boss.fireClock = 0; boss.summonClock = 0;
    E.step(s);
    if (stage === 0) {
      assert.equal(boss.parts.length, 4);
      assert.equal(s.enemyShots.length, 5);
      const [first] = boss.parts;
      const position = [first.x, first.y];
      frames(s, 10);
      assert.notDeepEqual([first.x, first.y], position);
      signatures.push('satellites');
    } else if (stage === 1) {
      assert.equal(s.enemyShots[0].kind, 'ring');
      frames(s, 55);
      assert.ok(s.enemyShots.some(shot => shot.kind === 'ring' && shot.t >= 0.8 && shot.radius > 50));
      signatures.push('rings');
    } else if (stage === 2) {
      assert.equal(s.enemies.filter(e => e.kind === 'frogger').length, 2);
      assert.equal(s.enemyShots.length, 1);
      signatures.push('froggers');
    } else if (stage === 3) {
      const orbiters = s.enemies.filter(e => e.kind === 'orbiter');
      assert.equal(orbiters.length, 2);
      assert.ok(orbiters.every(e => e.pattern === 'escort'));
      frames(s, 125);
      assert.ok(orbiters.every(e => e.pattern === 'dive'));
      signatures.push('orbiters');
    } else {
      const flowers = s.enemies.filter(e => e.kind === 'sunflower');
      assert.equal(flowers.length, 2);
      frames(s, 65);
      assert.ok(flowers.every(e => e.open));
      signatures.push('sunflowers');
    }
  }
  assert.equal(new Set(signatures).size, 5);
});

test('10点装甲：子弹扣1、碰撞扣2，血量归零才失命并原地恢复满甲', () => {
  const s = E.start(0, 1, { mode: 'armor', health: 10 });
  s.bossSpawned = true;
  s.spawnedWaves = new Set(C.LEVELS[0].waves.map((_, i) => i));
  const p = s.player;
  p.invulnerable = 0; p.x = 180; p.y = 340;
  assert.equal(p.maxHealth, 10);
  assert.equal(p.health, 10);
  s.enemyShots.push(enemyBullet(p.x, p.y));
  E.step(s);
  assert.equal(p.health, 9);
  assert.equal(p.lives, 3);
  assert.deepEqual(p.arms, { left: true, right: true });
  const foe = E.enemy(s, 'onion', p.x, p.y, 'line', { speed: 0 });
  p.invulnerable = 0;
  E.collisions(s);
  assert.equal(p.health, 7);
  assert.equal(p.lives, 3);
  foe.dead = true;
  for (let i = 0; i < 7; i++) {
    p.invulnerable = 0;
    s.enemyShots.push(enemyBullet(p.x, p.y));
    E.step(s);
  }
  assert.equal(p.lives, 2);
  assert.equal(p.health, 10);
  assert.equal(p.maxHealth, 10);
  assert.deepEqual([p.x, p.y], [180, 340]);
  assert.deepEqual(p.arms, { left: true, right: true });
  assert.equal(s.pickups.some(item => item.kind === 'ambulance'), false);
});

test('装甲受伤的短暂无敌阻止同帧多弹重复扣血，护盾仍优先承伤', () => {
  const s = E.start(0, 1, { mode: 'armor', health: 20 });
  const p = s.player;
  p.invulnerable = 0;
  s.enemyShots.push(enemyBullet(p.x, p.y), enemyBullet(p.x, p.y));
  E.collisions(s);
  assert.equal(p.health, 19);
  E.collect(s, pickup('bell', 0, 0, { color: 'red' }), p);
  p.invulnerable = 0;
  s.enemyShots.push(enemyBullet(p.x, p.y));
  E.collisions(s);
  assert.equal(p.health, 19);
  assert.equal(p.shield, C.FC_RULES.shieldHits - 1);
});

test('无敌模式连续敌弹、普通敌和Boss碰撞都不掉臂、不耗盾、不减生命', () => {
  const s = E.start(0, 1, { mode: 'invincible' });
  const p = s.player;
  p.invulnerable = 0;
  E.collect(s, pickup('bell', 0, 0, { color: 'red' }), p);
  const shield = p.shield;
  E.enemy(s, 'onion', p.x, p.y, 'line', { speed: 0 });
  const boss = E.spawnBoss(s);
  boss.x = p.x; boss.y = p.y;
  for (let i = 0; i < 20; i++) {
    s.enemyShots.push(enemyBullet(p.x, p.y));
    E.collisions(s);
  }
  assert.equal(p.lives, 3);
  assert.equal(p.shield, shield);
  assert.equal(p.health, p.maxHealth);
  assert.deepEqual(p.arms, { left: true, right: true });
  assert.equal(s.pickups.some(item => item.kind === 'ambulance'), false);
  assert.equal(s.mode, 'playing');
  p.shield = 0;
  assert.equal(E.hurt(s, p, true), 'ignored');
  assert.equal(E.hurt(s, p), 'ignored');
  assert.equal(p.lives, 3);
});

test('经典默认模式保持双臂先损、再失一命，装甲设置不改变经典判定', () => {
  const s = E.start(0, 1, { mode: 'classic', health: 99 });
  const p = s.player;
  assert.equal(p.health, 2);
  p.invulnerable = 0;
  s.enemyShots.push(enemyBullet(p.x, p.y));
  E.collisions(s);
  assert.equal(p.health, 1);
  assert.deepEqual(p.arms, { left: false, right: false });
  assert.equal(p.lives, 3);
  p.invulnerable = 0;
  s.enemyShots.push(enemyBullet(p.x, p.y));
  E.collisions(s);
  assert.equal(p.lives, 2);
  assert.equal(p.health, 2);
  assert.deepEqual(p.arms, { left: true, right: true });
});

test('configureAssist可途中切换并限制2..99，不支持的模式回经典，暂停不会被切换解除', () => {
  const s = arena();
  const p = s.player;
  E.hurt(s, p);
  s.mode = 'paused';
  E.configureAssist(s, { mode: 'armor', health: 40 });
  assert.equal(s.mode, 'paused');
  assert.equal(p.health, 40);
  assert.equal(p.maxHealth, 40);
  assert.deepEqual(p.arms, { left: true, right: true });
  for (const [value, expected] of [[-8, 2], [1, 2], [2, 2], [10.9, 10], [99, 99], [1000, 99], ['36', 36], ['invalid', 10]]) {
    E.configureAssist(s, { mode: 'armor', health: value });
    assert.equal(s.assist.health, expected);
    assert.equal(p.maxHealth, expected);
    assert.equal(p.health, expected);
  }
  E.configureAssist(s, { mode: 'not-a-mode', health: 50 });
  assert.equal(s.assist.mode, 'classic');
  assert.equal(p.maxHealth, 2);
  E.configureAssist(s, { mode: 'invincible' });
  assert.equal(s.assist.mode, 'invincible');
  s.mode = 'playing'; p.invulnerable = 0;
  assert.equal(E.hurt(s, p, true), 'ignored');
  E.configureAssist(s, { mode: 'classic' });
  assert.equal(E.hurt(s, p), 'arms');
});

test('双人装甲独立扣血；耗尽残机后切装甲/无敌不能复活已退出玩家', () => {
  const s = E.start(0, 2, { mode: 'armor', health: 10 });
  const [a, b] = s.players;
  a.invulnerable = b.invulnerable = 0;
  E.hurt(s, a);
  assert.equal(a.health, 9);
  assert.equal(b.health, 10);
  E.hurt(s, b, true);
  assert.equal(a.health, 9);
  assert.equal(b.health, 8);
  a.lives = 1; a.health = 1; a.invulnerable = 0;
  E.hurt(s, a);
  assert.equal(a.active, false);
  assert.equal(a.health, 0);
  assert.equal(a.lives, 0);
  for (const mode of ['invincible', 'armor', 'classic']) {
    E.configureAssist(s, { mode, health: 99 });
    assert.equal(a.active, false);
    assert.equal(a.health, 0);
    assert.equal(a.lives, 0);
    assert.equal(b.active, true);
    assert.equal(s.mode, 'playing');
  }
});

test('高装甲与无敌设置跨自动关卡切换保留，剩余血量不会无故回满', () => {
  for (const mode of ['armor', 'invincible']) {
    const s = E.start(4, 2, { mode, health: 80 });
    const [a, b] = s.players;
    if (mode === 'armor') { a.health = 61; b.health = 72; }
    const expectedHealth = s.players.map(p => p.health);
    s.mode = 'stage-clear'; s.clearTimer = E.STEP;
    E.step(s);
    assert.equal(s.stageIndex, 0);
    assert.equal(s.loop, 2);
    assert.equal(s.mode, 'playing');
    assert.deepEqual(s.assist, { mode, health: 80 });
    assert.deepEqual(s.players.map(p => p.health), expectedHealth);
    if (mode === 'invincible') {
      a.invulnerable = 0;
      assert.equal(E.hurt(s, a, true), 'ignored');
    } else assert.equal(a.maxHealth, 80);
  }
});
