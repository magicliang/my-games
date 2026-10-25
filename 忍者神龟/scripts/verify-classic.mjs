/**
 * Deterministic, state-observing bot verification, not a recording of human play.
 * It supplies ordinary held buttons to Game.step and invokes the public Continue
 * action only after game-over. It never edits simulation state, HP or position,
 * calls damage/spawn/loadStage, deletes enemies, or changes difficulty.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Game, CHARACTERS, STAGES } from '../src/core.js';

const MAX_FRAMES = 180000;
const sourceHash = name => createHash('sha256').update(readFileSync(new URL(name, import.meta.url))).digest('hex');
const distance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 2);
const directionTo = (p, x, y, tolerance = 5) => ({ right: x - p.x > tolerance, left: x - p.x < -tolerance, down: y - p.y > tolerance, up: y - p.y < -tolerance });

function targets(state, player) {
  const visible = state.enemies.filter(e => e.hp > 0 && e.targetable !== false);
  const lowerPresent = visible.some(e => e.partKind === 'lower');
  return visible.filter(e => !(lowerPresent && e.partKind === 'upper')).sort((a, b) => Number(b.isBoss) - Number(a.isBoss) || distance(a, player) - distance(b, player));
}

function baseline(state, frame) {
  const p = state.players[0];
  if (p.awaitingRespawn) return { jump: frame % 2 === 0 };
  if (p.grabbedBy || p.freeze > 0) return { attack: frame % 2 === 0, jump: frame % 2 !== 0 };
  const e = targets(state, p)[0];
  if (!e) return { right: true };
  const dx = e.x - p.x, dy = e.y - p.y;
  const input = { right: dx > 60, left: dx < -60, down: dy > 5, up: dy < -5 };
  if (Math.abs(dx) < 100 && Math.abs(dy) < 30) {
    input.attack = frame % 24 === 0;
    input.special = p.hp === 1 && frame % 45 === 0;
  }
  return input;
}

function cautious(state, frame, memory) {
  const p = state.players[0];
  if (p.awaitingRespawn) return { jump: frame % 2 === 0 };
  if (p.grabbedBy || p.freeze > 0) return { attack: frame % 2 === 0, jump: frame % 2 !== 0 };
  const pizza = state.items.filter(item => item.type === 'pizza' && item.x >= state.cameraX + 30 && item.x <= state.cameraX + 930)
    .sort((a, b) => distance(a, p) - distance(b, p))[0];
  if (pizza && p.hp < p.maxHp) return directionTo(p, pizza.x, pizza.y);
  let e = targets(state, p)[0];
  if (e?.isBoss) {
    const nearby = state.enemies.filter(q => !q.isBoss && !q.partOf && q.hp > 0 && q.targetable !== false && distance(q, p) < 85)
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (nearby && distance(e, p) > 145) e = nearby;
  }
  if (p.hp <= p.maxHp / 2) {
    const prop = state.props.find(prop => prop.drop === 'pizza' && prop.hp > 0 && distance(prop, p) < 220);
    if (prop) e = prop;
  }
  if (!e) return { right: true };
  const dx = e.x - p.x, dy = e.y - p.y, side = dx >= 0 ? -1 : 1;
  const reach = CHARACTERS[p.character].reach + (e.radius ?? 16) - 9;
  let targetY = e.y, targetX = e.x + side * reach;
  let unsafe = false;
  const shot = state.projectiles.find(shot => shot.faction === 'enemy' && Math.abs(shot.x - p.x) < 150 && Math.abs(shot.y - p.y) < 26 && shot.z - shot.radius <= p.z + p.height && shot.z + shot.radius >= p.z && (shot.x - p.x) * shot.vx < 0);
  const bossState = e.aiState, age = e.aiAge ?? 0;
  const ranged = ['gun', 'shotgun', 'helmetLaser', 'iceBreath', 'fireballs', 'homing', 'fist', 'laser', 'transformBeam', 'lightning'];
  const moving = ['chargeWarn', 'charge', 'shellSpin', 'rushPunch', 'dashSlash', 'rushGrab', 'jumpSlash', 'leapClaw', 'jumpKick', 'electricSign', 'teleport'];
  const melee = ['pipe', 'mace', 'kick', 'pickWarn', 'pickaxe', 'tail', 'claws', 'sword', 'bite', 'grab'];
  if (shot || e.isBoss && (ranged.includes(bossState) && age >= 8 && age <= 55 || moving.includes(bossState) || melee.includes(bossState) && age >= 8 && age <= 36)) {
    unsafe = true;
    targetY = e.y > 375 ? Math.max(295, e.y - 65) : Math.min(460, e.y + 65);
  }
  if (e.isBoss && bossState === 'electricBody') {
    unsafe = true; targetX = e.x + side * 180;
    targetY = e.y > 375 ? 295 : 460;
  }
  targetX = Math.max(state.cameraX + 35, Math.min(state.cameraX + 925, targetX));
  const input = directionTo(p, targetX, targetY, 4);
  if (Math.abs(dx) < reach + 3 && Math.abs(dy) < 26 && !unsafe) {
    const ready = ['idle', 'walk', 'jump'].includes(p.action);
    const specialSafe = e.isBoss && (bossState === 'recover' || p.invuln >= 35) || p.hp === 1;
    if (ready && p.z === 0 && specialSafe && frame - (memory.lastSpecial ?? -999) >= 42) {
      input.special = true; memory.lastSpecial = frame;
    } else if (ready && frame - (memory.lastAttack ?? -999) >= 24) {
      input.attack = true; memory.lastAttack = frame;
    }
  }
  const pitAhead = state.hazards.some(h => h.type === 'pit' && p.x >= h.x - 45 && p.x <= h.x + h.w + 35 && p.y >= h.y - 8 && p.y <= h.y + h.h + 8);
  const airborneTarget = e.z > 58 && Math.abs(dx) < 130 && Math.abs(dy) < 26;
  if (p.z === 0 && ['idle', 'walk'].includes(p.action) && (pitAhead || airborneTarget) && frame - (memory.lastJump ?? -999) > 40) {
    input.jump = true; input.attack = false; input.special = false; memory.lastJump = frame;
  }
  return input;
}

const strategies = {
  baseline: { character: 'don', input: baseline },
  cautious: { character: 'leo', input: cautious }
};

function run(name, config) {
  const game = new Game({ mode: 'classic', characters: [config.character], seed: 1 });
  const rows = [];
  const emit = (event, extra = {}) => {
    const s = game.state, p = s.players[0];
    rows.push({ strategy: name, event, frame: s.frame, simulatedSeconds: Number((s.frame / 60).toFixed(2)),
      stage: s.stageIndex + 1, stageName: STAGES[s.stageIndex].originalName, wave: s.waveIndex + 1,
      phase: s.phase, hp: p.hp, lives: p.lives, score: p.score, continuesLeft: s.continuesLeft,
      deaths: s.stats.deaths, bossesDefeated: s.stats.bosses, ...extra });
  };
  emit('start', { mode: game.state.mode, character: config.character, seed: 1, source: { core: sourceHash('../src/core.js'), content: sourceHash('../src/content.js') }, limits: { frames: MAX_FRAMES, continues: 3 } });
  let previousWave = '', previousDeaths = 0, previousBosses = 0;
  const memory = {};
  for (let frame = 0; frame < MAX_FRAMES; frame++) {
    const s = game.state;
    if (s.phase === 'victory') break;
    if (s.phase === 'gameover') {
      emit('gameover', { enemies: s.enemies.filter(e => e.hp > 0).map(e => ({ type: e.type, hp: e.hp, aiState: e.aiState })) });
      if (!game.continueGame()) break;
      emit('continue'); previousWave = '';
    }
    game.step([config.input(game.state, frame, memory)]);
    const key = `${s.stageIndex}:${s.waveIndex}`;
    if (key !== previousWave) { emit('encounter', { enemies: s.enemies.filter(e => e.hp > 0).map(e => e.type) }); previousWave = key; }
    if (s.stats.deaths !== previousDeaths) { emit('death', { enemies: s.enemies.filter(e => e.hp > 0).map(e => ({ type: e.type, hp: e.hp, aiState: e.aiState })) }); previousDeaths = s.stats.deaths; }
    if (s.stats.bosses !== previousBosses) { emit('boss-defeated'); previousBosses = s.stats.bosses; }
  }
  const s = game.state;
  emit('summary', { result: s.phase === 'victory' ? 'victory' : s.phase === 'gameover' ? 'continues-exhausted' : 'frame-limit',
    stats: { ...s.stats }, enemies: s.enemies.filter(e => e.hp > 0).map(e => ({ type: e.type, hp: e.hp, aiState: e.aiState })),
    evidenceScope: 'Pure simulation with normal inputs and allowed Continue; not browser/human play, original fidelity, or a general difficulty claim.' });
  return rows;
}

const requested = process.argv.find(arg => arg.startsWith('--strategy='))?.split('=')[1];
if (requested && !strategies[requested]) throw new Error(`Unknown strategy: ${requested}`);
const rows = Object.entries(strategies).filter(([name]) => !requested || name === requested).flatMap(([name, config]) => run(name, config));
const output = new URL('../evidence/classic-campaign.jsonl', import.meta.url);
writeFileSync(output, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`);
for (const row of rows.filter(row => row.event === 'summary')) console.log(JSON.stringify(row));
