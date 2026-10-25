const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../game-core.js");

test("包含原作五关顺序和对应 Boss", () => {
  assert.equal(core.LEVELS.length, 5);
  assert.deepEqual(
    core.LEVELS.map((level) => level.boss),
    ["Onion Head", "Parallel Dish", "Tiger Shark", "Claw Device", "King Spice"],
  );
  assert.ok(core.LEVELS.every((level) => level.waves.length >= 16));
});

test("铃铛按五次命中切换强化颜色", () => {
  assert.equal(core.bellColorForHits(0), "yellow");
  assert.equal(core.bellColorForHits(5), "blue");
  assert.equal(core.bellColorForHits(10), "white");
  assert.equal(core.bellColorForHits(15), "green");
  assert.equal(core.bellColorForHits(20), "red");
  assert.equal(core.bellColorForHits(99), "red");
});

test("分身与护盾互斥，速度有上限", () => {
  const player = core.createPlayer();
  for (let index = 0; index < 10; index += 1) core.applyBell(player, "blue");
  assert.equal(player.speedLevel, 5);

  core.applyBell(player, "green");
  assert.equal(player.mirrors, true);
  assert.equal(player.shield, 0);

  core.applyBell(player, "red");
  assert.equal(player.mirrors, false);
  assert.equal(player.shield, 4);
});

test("只在 Boss 已出现且全部敌人清空时判定通关", () => {
  const state = core.createGameState();
  assert.equal(core.stageIsComplete(state), false);
  state.bossSpawned = true;
  assert.equal(core.stageIsComplete(state), true);
  state.enemies.push({});
  assert.equal(core.stageIsComplete(state), false);
});
