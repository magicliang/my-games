const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../game-core.js");

const makeBell = () => ({ kind: "bell", color: "yellow", hits: 0 });

test("FC 战场与单/双人初始化：三机、独立计分、主机引用一致", () => {
  assert.equal(core.WIDTH, 512);
  assert.equal(core.HEIGHT, 480);
  const single = core.createGameState();
  assert.equal(single.players.length, 1);
  assert.equal(single.player, single.players[0]);
  assert.equal(single.player.lives, 3);
  assert.equal(single.player.nextExtraLife, 50000);
  const dual = core.createGameState(0, 2);
  assert.equal(dual.players.length, 2);
  assert.notEqual(dual.players[0].x, dual.players[1].x);
  dual.players[0].arms.left = false;
  assert.equal(dual.players[1].arms.left, true);
});

test("五关 Boss 顺序保留，第五关后进入更高周目的第一关", () => {
  assert.deepEqual(core.LEVELS.map((level) => level.boss), [
    "Onion Head", "Parallel Dish", "Tiger Shark", "Claw Device", "King Spice",
  ]);
  assert.deepEqual(core.nextStage(0, 1), { stageIndex: 1, loop: 1 });
  assert.deepEqual(core.nextStage(4, 1), { stageIndex: 0, loop: 2 });
  assert.deepEqual(core.nextStage(4, 3), { stageIndex: 0, loop: 4 });
});

test("特殊铃只在对应一发出现，再打一发回黄，不永久升色", () => {
  for (const [hits, color] of [[4, "blue"], [9, "white"], [14, "flashing"], [19, "red"]]) {
    assert.equal(core.bellColorForHits(hits - 1), "yellow");
    assert.equal(core.bellColorForHits(hits), color);
    assert.equal(core.bellColorForHits(hits + 1), "yellow");
  }
  assert.equal(core.bellColorForHits(0), "yellow");
  assert.equal(core.BELL_COLORS.includes("green"), false);
});

test("全屏铃共用命中计数，出云的铃不另加追打计数", () => {
  const state = core.createGameState();
  const first = makeBell();
  const second = makeBell();
  for (let i = 0; i < 3; i += 1) core.hitBell(state, first);
  assert.equal(state.bellHits, 3);
  assert.equal(core.hitBell(state, second), "bell");
  assert.equal(second.color, "blue");
  assert.equal(first.color, "yellow");
  core.hitBell(state, second);
  assert.equal(second.color, "yellow");
});

test("过度追打第31发化为蜂敌，铃只转换一次并复位计数", () => {
  const state = core.createGameState();
  const bell = makeBell();
  for (let i = 0; i < 30; i += 1) assert.equal(core.hitBell(state, bell), "bell");
  assert.equal(core.hitBell(state, bell), "bee");
  assert.equal(bell.dead, true);
  assert.equal(state.bellHits, 0);
  assert.equal(core.FC_RULES.scores.bee, 15100);
});

test("黄铃连续500/1000/5000/10000，封顶后保持并复位铃命中计数", () => {
  const state = core.createGameState();
  state.bellHits = 18;
  const rewards = Array.from({ length: 5 }, () => core.collectYellowBell(state));
  assert.deepEqual(rewards, [500, 1000, 5000, 10000, 10000]);
  assert.equal(state.player.score, 26500);
  assert.equal(state.score, 26500);
  assert.equal(state.bellHits, 0);
  assert.equal(state.bellChain, 5);
});

test("漏掉任意颜色的铃均中断连分，并同时复位全屏铃命中计数", () => {
  const state = core.createGameState(0, 2);
  core.collectYellowBell(state, state.players[0]);
  core.collectYellowBell(state, state.players[1]);
  state.bellHits = 14;
  core.missBell(state);
  assert.equal(state.bellHits, 0);
  assert.equal(state.bellChain, 0);
  assert.equal(state.players[1].bellChain, 0);
  assert.equal(core.collectYellowBell(state), 500);
});

test("蓝铃只加移动速度，不修改武器冷却或计分", () => {
  const state = core.createGameState();
  state.player.shotCooldown = 0.1;
  for (let i = 0; i < 20; i += 1) core.applyBell(state.player, "blue");
  assert.equal(state.player.speedLevel, core.FC_RULES.maxSpeedLevel);
  assert.equal(state.player.shotCooldown, 0.1);
  assert.equal(state.score, 0);
});

test("糖果为持久三向弹，与白铃双炮互换，不存在16秒计时", () => {
  const player = core.createPlayer();
  core.applyBell(player, "white");
  assert.equal(player.twinShot, true);
  assert.equal(core.applyCandy(player), true);
  assert.equal(player.threeWay, true);
  assert.equal(player.twinShot, false);
  assert.equal(player.spreadTimer, undefined);
  core.applyBell(player, "white");
  assert.equal(player.twinShot, true);
  assert.equal(player.threeWay, false);
});

test("取得分身清除三向弹，分身仍可使用双炮但不能再取糖果", () => {
  const player = core.createPlayer();
  core.applyCandy(player);
  core.applyBell(player, "flashing");
  assert.equal(player.mirrors, true);
  assert.equal(player.threeWay, false);
  assert.equal(core.applyCandy(player), false);
  core.applyBell(player, "white");
  assert.equal(player.twinShot, true);
  assert.equal(player.mirrors, true);
});

test("护盾和分身先到者优先，后取互斥铃退为黄铃而非覆盖", () => {
  const player = core.createPlayer();
  core.applyBell(player, "flashing");
  assert.equal(core.applyBell(player, "red").kind, "yellow");
  assert.equal(player.mirrors, true);
  assert.equal(player.shield, 0);
  assert.equal(core.bellColorForHits(19, player), "yellow");
  const shieldPlayer = core.createPlayer();
  core.applyBell(shieldPlayer, "red");
  assert.equal(core.applyBell(shieldPlayer, "flashing").kind, "yellow");
  assert.equal(shieldPlayer.mirrors, false);
  assert.equal(shieldPlayer.shield, core.FC_RULES.shieldHits);
  assert.equal(core.bellColorForHits(14, shieldPlayer), "yellow");
});

test("双人模式没有分身和糖果，白铃和红铃仍可用", () => {
  const player = core.createPlayer();
  assert.equal(core.bellColorForHits(14, player, 2), "yellow");
  assert.equal(core.applyBell(player, "flashing", 2).kind, "yellow");
  assert.equal(core.applyCandy(player, 2), false);
  assert.equal(core.applyBell(player, "white", 2).kind, "power");
  assert.equal(core.applyBell(player, "red", 2).kind, "power");
  assert.equal(player.mirrors, false);
});

test("两只分身追随拐弯的历史路径，停止后逐步收拢重合", () => {
  const player = core.createPlayer();
  player.x = 100;
  player.y = 300;
  core.applyBell(player, "flashing");
  for (let i = 0; i < 24; i += 1) {
    player.x += 2;
    core.updateClones(player);
  }
  for (let i = 0; i < 12; i += 1) {
    player.y -= 2;
    core.updateClones(player);
  }
  assert.deepEqual(player.clonePositions.map(({ x, y }) => [x, y]), [[148, 300], [124, 300]]);
  for (let i = 0; i < 60; i += 1) core.updateClones(player);
  assert.deepEqual(player.clonePositions.map(({ x, y }) => [x, y]), [[148, 276], [148, 276]]);
});

test("FC 敌弹首击同时丢双臂，下一击丢命；空敌相撞直接丢命", () => {
  const player = core.createPlayer();
  assert.equal(core.damagePlayer(player), "arms");
  assert.deepEqual(player.arms, { left: false, right: false });
  assert.equal(player.lives, 3);
  assert.equal(core.damagePlayer(player), "ignored");
  player.invulnerable = 0;
  assert.equal(core.damagePlayer(player), "life");
  assert.equal(core.damagePlayer(core.createPlayer(), { collision: true }), "life");
});

test("护盾先吸收伤害，耗尽后才伤及双臂；敌机碰撞消耗双倍", () => {
  const player = core.createPlayer();
  core.applyBell(player, "red");
  for (let i = 0; i < core.FC_RULES.shieldHits / 2; i += 1) {
    player.invulnerable = 0;
    assert.equal(core.damagePlayer(player, { collision: true }), "shield");
  }
  assert.equal(player.shield, 0);
  assert.deepEqual(player.arms, { left: true, right: true });
  player.invulnerable = 0;
  assert.equal(core.damagePlayer(player), "arms");
});

test("原地复活：清装备/分身/救护车机会，保留分数和下次奖命门槛", () => {
  const state = core.createGameState();
  const player = state.player;
  core.addScore(state, player, 50000);
  player.x = 80;
  player.y = 120;
  player.speedLevel = 3;
  player.ambulanceUsed = true;
  core.applyBell(player, "flashing");
  core.applyBell(player, "white");
  const replacement = core.restorePlayerAfterDeath(player);
  assert.equal(replacement, state.player);
  assert.equal(player.x, 80);
  assert.equal(player.y, 120);
  assert.equal(player.score, 50000);
  assert.equal(player.nextExtraLife, 200000);
  assert.equal(player.lives, 3);
  assert.equal(player.speedLevel, 0);
  assert.equal(player.twinShot, false);
  assert.equal(player.mirrors, false);
  assert.deepEqual(player.clonePositions, []);
  assert.deepEqual(player.arms, { left: true, right: true });
  assert.equal(player.ambulanceUsed, false);
  assert.equal(player.invulnerable, 2);
});

test("最后一机死亡标记退出，不产生负残机", () => {
  const player = core.createPlayer();
  player.lives = 1;
  core.restorePlayerAfterDeath(player);
  assert.equal(player.active, false);
  assert.equal(player.lives, 0);
  assert.equal(core.damagePlayer(player), "ignored");
});

test("奖命：50k首次，此后每150k；单次跨多个阈值也不遗漏，百万截止", () => {
  const state = core.createGameState();
  const player = state.player;
  assert.equal(core.addScore(state, player, 49999), 0);
  assert.equal(core.addScore(state, player, 1), 1);
  assert.equal(player.lives, 4);
  assert.equal(player.nextExtraLife, 200000);
  assert.equal(core.addScore(state, player, 149999), 0);
  assert.equal(core.addScore(state, player, 1), 1);
  assert.equal(core.addScore(state, player, 800000), 5);
  assert.equal(player.lives, 10);
  assert.equal(player.nextExtraLife, Infinity);
  assert.equal(core.addScore(state, player, 500000), 0);
});

test("双人独立残机/得分/奖命，全局得分仅为两机之和", () => {
  const state = core.createGameState(0, 2);
  core.addScore(state, state.players[0], 49900);
  core.addScore(state, state.players[1], 50000);
  assert.equal(state.players[0].lives, 3);
  assert.equal(state.players[1].lives, 4);
  assert.equal(state.score, 99900);
  core.addScore(state, state.players[0], 100);
  assert.equal(state.players[0].lives, 4);
});

test("通关不把未生成 Boss 或仍存活的敌机误判完成", () => {
  const state = core.createGameState();
  assert.equal(core.stageIsComplete(state), false);
  state.bossSpawned = true;
  assert.equal(core.stageIsComplete(state), true);
  state.enemies.push({ dead: false });
  assert.equal(core.stageIsComplete(state), false);
  state.enemies[0].dead = true;
  assert.equal(core.stageIsComplete(state), true);
});

test("已经有双炮或三向弹时第9发不再生成白铃，复活清装备后恢复", () => {
  const player = core.createPlayer();
  assert.equal(core.bellColorForHits(9, player), "white");
  core.applyBell(player, "white");
  assert.equal(core.bellColorForHits(9, player), "yellow");
  core.applyCandy(player);
  assert.equal(core.bellColorForHits(9, player), "yellow");
  core.restorePlayerAfterDeath(player);
  assert.equal(core.bellColorForHits(9, player), "white");
});
