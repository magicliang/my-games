import { RULES, CHARACTERS, CHARACTER_IDS, STAGES, ENEMY_TYPES, BOSS_DEFS, getSection } from './content.js';
export { RULES, CHARACTERS, CHARACTER_IDS, STAGES, ENEMY_TYPES, BOSS_DEFS } from './content.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.5);
const sign = n => n < 0 ? -1 : 1;
const ACTIONS = ['left', 'right', 'up', 'down', 'attack', 'jump', 'special'];
export const createInput = overrides => Object.assign(Object.fromEntries(ACTIONS.map(key => [key, false])), overrides);

/** The ground lane and vertical intervals must BOTH overlap. Screen y-z is never collision geometry. */
export function canHit(attacker, target, attack = {}) {
  if (!target || target.hp <= 0 || target.awaitingRespawn || target.action === 'dead' || target.targetable === false) return false;
  const dx = (target.x - attacker.x) * (attacker.facing || 1);
  const reach = attack.reach ?? 75;
  const radius = target.radius ?? 16;
  if (attack.allAround ? Math.abs(dx) > reach + radius : dx < -(attack.back ?? 10) - radius || dx > reach + radius) return false;
  if (Math.abs(target.y - attacker.y) > (attack.depth ?? 17) + (target.depthRadius ?? 9)) return false;
  const lo = (attacker.z || 0) + (attack.zLow ?? 16);
  const hi = (attacker.z || 0) + (attack.zHigh ?? 56);
  const tlo = target.z || 0;
  return hi >= tlo && lo <= tlo + (target.height ?? 57);
}

export class Game {
  constructor({ mode = 'classic', characters = ['leo'], friendlyFire = false, seed = 1 } = {}) {
    this.rng = seed >>> 0 || 1;
    this.nextId = 1;
    this.previous = [createInput(), createInput()];
    this.state = {
      mode: ['classic', 'high', 'invincible'].includes(mode) ? mode : 'classic',
      friendlyFire: Boolean(friendlyFire), phase: 'playing', paused: false, frame: 0,
      stageIndex: 0, stageFrame: 0, cameraX: 0, waveIndex: -1, waveActive: false,
      lockX: null, continuesLeft: RULES.continues, timeLeft: RULES.stageTime,
      players: [], enemies: [], projectiles: [], items: [], props: [], hazards: [], effects: [],
      message: '', messageTimer: 0, transition: 0,
      stats: { hits: 0, damageTaken: 0, deaths: 0, throws: 0, specials: 0, kills: 0, bosses: 0, stages: 0 }
    };
    const chosen = [...new Set(characters.filter(id => CHARACTERS[id]))].slice(0, 2);
    if (!chosen.length) chosen.push('leo');
    chosen.forEach(id => this.state.players.push(this.makePlayer(id, this.state.players.length)));
    this.loadStage(0);
  }

  random() {
    this.rng ^= this.rng << 13; this.rng ^= this.rng >>> 17; this.rng ^= this.rng << 5;
    return (this.rng >>> 0) / 4294967296;
  }

  makePlayer(character, index) {
    const maxHp = this.state.mode === 'high' ? RULES.highHp : RULES.maxHp;
    return { id: `p${index + 1}`, index, character, name: CHARACTERS[character].name,
      x: 160 + index * 90, y: 375 + index * 55, z: 0, vz: 0, vx: 0, vy: 0,
      facing: 1, hp: maxHp, maxHp, lives: RULES.initialLives, score: 0, nextLifeScore: RULES.extraLifeScore,
      radius: 18, depthRadius: 9, height: 57, action: 'idle', age: 0, invuln: 0,
      stun: 0, awaitingRespawn: false, respawnDelay: 0, attackHits: [], attackSerial: 0,
      attackBuffer: 0, combo: 0, comboTimer: 0, grabbedBy: null, escape: 0, freeze: 0, transformed: 0 };
  }

  loadStage(index) {
    const s = this.state;
    s.stageIndex = index; s.stageFrame = 0; s.timeLeft = RULES.stageTime;
    s.cameraX = 0; s.waveIndex = -1; s.waveActive = false; s.lockX = null;
    s.phase = 'playing'; s.enemies = []; s.projectiles = []; s.items = []; s.effects = [];
    s.props = STAGES[index].props.map(p => ({ ...p, id: `prop${this.nextId++}`, maxHp: p.hp, z: 0, radius: 25, height: 52, depthRadius: 14, action: 'idle' }));
    s.hazards = STAGES[index].hazards.map(h => ({ ...h, id: `hazard${this.nextId++}`, phase: 0, active: false }));
    s.players.forEach((p, i) => {
      Object.assign(p, { x: 155 + i * 90, y: 370 + i * 50, z: 0, vz: 0, vx: 0, vy: 0,
        action: p.awaitingRespawn ? 'down' : 'idle', age: 0, stun: 0, invuln: RULES.respawnInvuln,
        grabbedBy: null, freeze: 0, transformed: 0, height: 57, tossed: null, attackBuffer: 0, attackHits: [] });
    });
    this.message(STAGES[index].intro, 240);
    this.spawnWave(0);
    this.previous = [createInput(), createInput()];
  }

  setPaused(value) {
    this.state.paused = Boolean(value);
    this.previous = [createInput(), createInput()];
    this.state.players.forEach(p => { p.attackBuffer = 0; });
  }

  message(text, duration = 150) { this.state.message = text; this.state.messageTimer = duration; }

  effect(kind, x, y, extra = {}) {
    this.state.effects.push({ id: `fx${this.nextId++}`, kind, x, y, z: 0, life: 24, maxLife: 24, ...extra });
  }

  join(character = 'don') {
    const s = this.state;
    if (s.players.length >= 2 || s.phase !== 'playing') return false;
    const p = s.players[0];
    if (p.lives < 2 || !CHARACTERS[character] || p.character === character) return false;
    p.lives -= 1;
    const other = this.makePlayer(character, 1);
    Object.assign(other, { lives: 1, x: clamp(p.x + 65, s.cameraX + 40, s.cameraX + 920), y: clamp(p.y + 45, 290, 465), invuln: RULES.respawnInvuln });
    s.players.push(other); this.message('2P 加入！从 1P 分配一条生命。'); return true;
  }

  selectCharacter(playerId, character) {
    const p = this.state.players.find(p => p.id === playerId || p.index === playerId);
    if (!p || !p.awaitingRespawn || !CHARACTERS[character]) return false;
    if (this.state.players.some(other => other !== p && other.character === character && other.lives > 0)) return false;
    p.character = character; p.name = CHARACTERS[character].name; return true;
  }

  continueGame() {
    const s = this.state;
    if (s.phase !== 'gameover' || s.continuesLeft <= 0) return false;
    s.continuesLeft--;
    s.players.forEach(p => Object.assign(p, { lives: RULES.initialLives, hp: p.maxHp, awaitingRespawn: false, respawnDelay: 0 }));
    this.loadStage(s.stageIndex); return true;
  }

  spawnEnemy(type, x, y, extra = {}) {
    const boss = BOSS_DEFS[type];
    const def = boss || ENEMY_TYPES[type];
    if (!def) throw new Error(`Unknown enemy: ${type}`);
    const e = { id: `e${this.nextId++}`, type, name: def.name, color: def.color,
      isBoss: Boolean(boss), hp: def.hp, maxHp: def.hp, x, y, z: type === 'flyer' || type === 'kamikaze' ? 68 : 0,
      vz: 0, vx: 0, vy: 0, facing: -1, radius: boss ? 29 : 17, depthRadius: boss ? 14 : 8,
      height: def.height ?? (boss ? 85 : 55), action: 'walk', age: 0, actionAge: 0,
      invuln: 0, stun: 0, cooldown: 35 + Math.floor(this.random() * 35), aiState: 'approach', aiTimer: 35,
      aiAge: 0, pattern: 0, phase: 1, targetX: x, targetY: y, attackHits: [],
      deadTimer: 0, thrownBy: null, heldPlayer: null, score: def.score, ...extra };
    this.state.enemies.push(e);
    return e;
  }

  spawnWave(index) {
    const s = this.state, w = STAGES[s.stageIndex].waves[index];
    if (!w) return;
    s.waveIndex = index; s.waveActive = true; s.lockX = w.at;
    w.types.forEach((type, i) => {
      let x = w.at + 690 + (i % 3) * 86;
      if (w.formation === 'left' || (w.formation === 'pincer' && i % 3 === 2)) x = Math.max(w.at + 40, s.cameraX + 20);
      const y = 320 + ((i * 59 + index * 17) % 134);
      const extra = { entry: w.formation, entryTimer: ['sand', 'ambush', 'manhole', 'drop', 'pole', 'gate', 'train'].includes(w.formation) ? 35 + i * 14 : 0 };
      if (w.formation === 'boss') { x = w.at + 730; extra.aiTimer = 85; extra.cooldown = 85; }
      this.spawnEnemy(type, x, y, extra);
    });
    if (w.boss) this.message(BOSS_DEFS[w.types[0]].name, 160);
  }

  step(inputs = []) {
    const s = this.state;
    if (s.paused || s.phase === 'victory' || s.phase === 'gameover') return s;
    s.frame++; s.stageFrame++;
    if (s.messageTimer > 0 && --s.messageTimer === 0) s.message = '';
    s.effects.forEach(e => e.life--); s.effects = s.effects.filter(e => e.life > 0);
    if (s.phase === 'stageClear') {
      if (--s.transition <= 0) {
        if (s.stageIndex === STAGES.length - 1) { s.phase = 'victory'; this.message('曼哈顿回来了。COWABUNGA！', 999999); }
        else this.loadStage(s.stageIndex + 1);
      }
      return s;
    }
    const normalized = [createInput(inputs[0]), createInput(inputs[1])];
    s.players.forEach((p, i) => this.updatePlayer(p, normalized[i], this.previous[i]));
    this.previous = normalized;
    for (const e of [...s.enemies]) this.updateEnemy(e);
    this.updateProjectiles(); this.updateHazards(); this.updatePickups();
    s.enemies = s.enemies.filter(e => e.hp > 0 || e.deadTimer > 0);
    s.props = s.props.filter(p => p.hp > 0);
    s.players.forEach(p => {
      p.x = clamp(p.x, s.cameraX + 30, Math.min(STAGES[s.stageIndex].length - 30, s.cameraX + 930));
      p.y = clamp(p.y, RULES.groundTop, RULES.groundBottom);
    });
    if (s.stageFrame % 60 === 0 && s.timeLeft > 0) s.timeLeft--;
    if (s.timeLeft <= 0) {
      s.players.forEach(p => { if (p.hp > 0) this.damagePlayer(p, p.maxHp, null, { force: true }); });
      s.timeLeft = RULES.stageTime;
    }
    this.updateProgress();
    return s;
  }

  updatePlayer(p, input, prev) {
    p.age++; if (p.invuln > 0) p.invuln--; if (p.comboTimer > 0) p.comboTimer--; else p.combo = 0;
    const pressed = key => input[key] && !prev[key];
    if (p.awaitingRespawn) {
      if (p.respawnDelay > 0) p.respawnDelay--;
      if (pressed('left') || pressed('right')) {
        const direction = pressed('left') ? -1 : 1;
        const from = CHARACTER_IDS.indexOf(p.character);
        for (let n = 1; n <= 4; n++) if (this.selectCharacter(p.id, CHARACTER_IDS[(from + direction * n + 8) % 4])) break;
      }
      if (pressed('jump') && p.respawnDelay === 0) {
        if (p.lives <= 0) {
          const donor = this.state.players.find(q => q !== p && q.lives > 1);
          if (donor) { donor.lives--; p.lives++; }
        }
        if (p.lives > 0) this.respawn(p);
      }
      return;
    }
    if (p.hp <= 0) return;
    if (p.tossed) {
      const flight = p.tossed; flight.t++;
      const progress = Math.min(1, flight.t / flight.duration);
      p.x = flight.fromX + (flight.toX - flight.fromX) * progress;
      p.y = flight.fromY + (flight.toY - flight.fromY) * progress;
      p.z = Math.sin(progress * Math.PI) * 125; p.action = 'thrown';
      if (progress === 1) {
        p.tossed = null; p.z = 0; p.vz = 0; p.action = 'idle';
        this.effect('hit', p.x, p.y, { color: '#b6edff', text: '电击', life: 40, maxLife: 40 });
        this.damagePlayer(p, 2, null, { force: true });
      }
      return;
    }
    if (p.transformed > 0) {
      p.transformed--; p.action = 'turtle'; this.movePlayer(p, input, 0.45); this.jumpPhysics(p);
      if (p.transformed === 0) { p.height = 57; p.action = p.z > 0 ? 'jump' : 'idle'; p.age = 0; }
      return;
    }
    if (p.grabbedBy) {
      const holder = this.state.enemies.find(e => e.id === p.grabbedBy && e.hp > 0);
      if (!holder) { p.grabbedBy = null; p.action = 'idle'; }
      else {
        p.action = 'grabbed';
        p.escape += ACTIONS.filter(pressed).length;
        if (p.escape >= 6) { holder.stun = 45; holder.heldPlayer = null; p.grabbedBy = null; p.invuln = 45; p.action = 'idle'; this.effect('hit', p.x, p.y, { text: '挣脱' }); }
        else if (p.age % 60 === 0) this.damagePlayer(p, 1, holder, { keepGrab: true });
        return;
      }
    }
    if (p.freeze > 0) {
      p.freeze = Math.max(0, p.freeze - (pressed('attack') || pressed('jump') ? 8 : 1));
      p.action = 'frozen'; this.jumpPhysics(p);
      if (p.freeze === 0) { p.action = p.z > 0 ? 'jump' : 'idle'; p.age = 0; }
      return;
    }
    if (p.stun > 0) {
      p.stun--; p.x += p.vx; p.y += p.vy; p.vx *= .84; p.vy *= .84;
      this.jumpPhysics(p);
      if (!p.stun) { p.action = 'idle'; p.age = 0; }
      return;
    }
    const special = pressed('special') || (input.attack && input.jump && (!prev.attack || !prev.jump));
    if (special && ['idle', 'walk', 'jump'].includes(p.action)) this.startPlayerAttack(p, 'special');
    if (pressed('attack') && !special) {
      if (['idle', 'walk', 'jump'].includes(p.action)) this.startPlayerAttack(p, p.z > 0 ? 'kick' : input.down ? 'toss' : 'attack');
      else if (p.action === 'attack' && p.age >= CHARACTERS[p.character].attackFrames - 6) p.attackBuffer = 7;
    }
    if (pressed('jump') && !special && p.z === 0 && ['idle', 'walk'].includes(p.action)) {
      p.vz = RULES.jumpSpeed; p.z = .1; p.action = 'jump'; p.age = 0;
    }
    if (['attack', 'toss', 'kick', 'special'].includes(p.action)) this.updatePlayerAttack(p, input);
    else this.movePlayer(p, input);
    this.jumpPhysics(p);
    if (p.attackBuffer > 0) p.attackBuffer--;
  }

  movePlayer(p, input, speed = 1) {
    let dx = Number(input.right) - Number(input.left), dy = Number(input.down) - Number(input.up);
    if (dx) p.facing = sign(dx);
    const diagonal = dx && dy ? Math.SQRT1_2 : 1;
    const water = this.state.hazards.some(h => h.type === 'water' && this.inside(p, h) && p.z < 5);
    const scale = speed * (water ? .72 : 1);
    p.x += dx * RULES.moveX * diagonal * scale; p.y += dy * RULES.moveY * diagonal * scale;
    if (!['turtle', 'frozen'].includes(p.action)) p.action = p.z > 0 ? 'jump' : dx || dy ? 'walk' : 'idle';
  }

  jumpPhysics(e) {
    if (e.z > 0 || e.vz > 0) {
      e.z += e.vz; e.vz -= RULES.gravity;
      if (e.z <= 0) { e.z = 0; e.vz = 0; if (e.action === 'jump' || e.action === 'kick') { e.action = 'idle'; e.age = 0; } }
    }
  }

  startPlayerAttack(p, action) {
    if (action === 'special') {
      if (p.hp > RULES.specialCost) p.hp -= RULES.specialCost;
      this.state.stats.specials++; this.effect('special', p.x, p.y, { color: CHARACTERS[p.character].color, life: 32, maxLife: 32 });
    }
    p.action = action; p.age = 0; p.attackHits = []; p.attackSerial++;
    if (action === 'attack') { p.combo = p.comboTimer > 0 ? p.combo + 1 : 1; p.comboTimer = 54; }
  }

  updatePlayerAttack(p, input) {
    const c = CHARACTERS[p.character], a = p.action;
    if (a === 'attack' || a === 'toss') {
      const hitFrame = a === 'attack' ? c.hitFrame : 4;
      if (p.age === hitFrame) this.playerStrike(p, { reach: a === 'attack' ? c.reach : 72, damage: 3, kind: a });
      const duration = a === 'attack' ? c.attackFrames : RULES.tossFrames;
      if (p.age >= duration) {
        p.action = 'idle'; p.age = 0;
        if (p.attackBuffer > 0) { p.attackBuffer = 0; this.startPlayerAttack(p, input.down ? 'toss' : 'attack'); }
      }
    } else if (a === 'kick') {
      this.moveDuringAirAttack(p, input);
      if (p.age >= 3 && p.age < 16) this.playerStrike(p, { reach: 78, depth: 20, zLow: -35, zHigh: 28, damage: 2, kind: 'kick' });
      if (p.age >= 18) { p.action = p.z > 0 ? 'jump' : 'idle'; p.age = 0; }
    } else if (a === 'special') {
      const key = p.character;
      let spec = { reach: 104, allAround: true, depth: 27, zLow: -20, zHigh: 85, damage: c.specialDamage, kind: 'special' };
      if (key === 'raph') { p.x += p.facing * 6.7; p.z = Math.max(p.z, 22); p.vz = 0; spec = { ...spec, allAround: false, reach: 95, depth: 23 }; }
      if (key === 'don') { p.x += p.facing * 2.5; p.z = Math.sin(Math.PI * Math.min(p.age / c.specialFrames, 1)) * 70; p.vz = 0; spec = { ...spec, reach: 102, zLow: -65 }; }
      if (key === 'mike') { p.x += p.facing * (p.age < 17 ? -1.7 : 1.9); p.z = Math.sin(Math.PI * Math.min(p.age / c.specialFrames, 1)) * 75; p.vz = 0; spec = { ...spec, reach: 106, zLow: -65 }; }
      if (p.age >= 6 && p.age < c.specialFrames - 5) {
        if (key === 'leo' && p.age === 23) p.attackHits = [];
        this.playerStrike(p, spec);
      }
      if (p.age >= c.specialFrames) { p.action = 'idle'; p.age = 0; p.z = 0; p.vz = 0; }
    }
  }

  moveDuringAirAttack(p, input) {
    const dx = Number(input.right) - Number(input.left), dy = Number(input.down) - Number(input.up);
    const k = dx && dy ? Math.SQRT1_2 : 1;
    p.x += dx * RULES.moveX * k; p.y += dy * RULES.moveY * k;
  }

  playerStrike(p, attack) {
    for (const e of this.state.enemies) {
      if (p.attackHits.includes(e.id) || e.entryTimer > 0 || !canHit(p, e, attack)) continue;
      if (this.damageEnemy(e, attack.damage, p, attack.kind)) {
        p.attackHits.push(e.id);
        if (attack.kind === 'toss' && !e.isBoss && !e.partOf && e.type !== 'turret' && e.type !== 'stone') {
          e.action = 'thrown'; e.z = 55; e.vz = 5; e.vx = -p.facing * 8; e.vy = 0; e.thrownBy = p.id; e.throwHits = [e.id];
          e.deadTimer = Math.max(e.deadTimer, 45); this.state.stats.throws++;
        }
      }
    }
    for (const prop of this.state.props) if (!p.attackHits.includes(prop.id) && canHit(p, prop, attack)) {
      prop.hp -= attack.damage; p.attackHits.push(prop.id); this.effect('hit', prop.x, prop.y);
      if (prop.hp <= 0) { this.effect('smoke', prop.x, prop.y); if (prop.drop) this.dropItem(prop.drop, prop.x, prop.y); }
    }
    if (this.state.friendlyFire) for (const other of this.state.players) {
      if (other === p || p.attackHits.includes(other.id) || !canHit(p, other, attack)) continue;
      if (this.damagePlayer(other, 1, p)) p.attackHits.push(other.id);
    }
    for (const shot of this.state.projectiles) {
      if (shot.faction === 'enemy' && shot.reflectable && canHit(p, { ...shot, hp: 1, height: 12, radius: shot.radius }, attack)) {
        shot.faction = 'player'; shot.owner = p.id; shot.vx = Math.abs(shot.vx) * p.facing; shot.vy = 0;
        this.effect('hit', shot.x, shot.y, { z: shot.z, color: '#aef2c0' });
      }
    }
  }

  damageEnemy(e, damage, player, kind = 'attack', { partHit = false } = {}) {
    if (e.partOf) {
      const parent = this.state.enemies.find(body => body.id === e.partOf && body.hp > 0 && body.phase === 2);
      if (!parent) return false;
      const hit = this.damageEnemy(parent, damage, player, kind, { partHit: true });
      if (hit) { e.invuln = RULES.bossInvuln; this.effect('hit', e.x, e.y, { z: e.z + 20, text: String(damage) }); }
      return hit;
    }
    if (e.hp <= 0 || e.invuln > 0 || e.entryTimer > 0) return false;
    if (e.type === 'krang' && (e.phase === 2 && !partHit || e.aiState === 'electricBody')) return false;
    if (e.type === 'tokka' && e.aiState === 'guard' && kind === 'kick') { this.effect('hit', e.x, e.y, { z: 50, text: 'BLOCK', color: '#c8eaff' }); return false; }
    if (e.aiState === 'teleport') return false;
    e.hp = Math.max(0, e.hp - damage); e.invuln = e.isBoss ? RULES.bossInvuln : RULES.enemyInvuln;
    e.stun = e.isBoss ? 4 : 17; e.vx = (player?.facing || 1) * (e.isBoss ? 1 : 4.5);
    if (!e.isBoss) { e.action = 'hurt'; e.age = 0; }
    this.state.stats.hits++; this.effect('hit', e.x, e.y, { z: e.z + e.height / 2, text: String(damage) });
    if (e.heldPlayer) { const held = this.state.players.find(p => p.id === e.heldPlayer); if (held) { held.grabbedBy = null; held.invuln = 40; } e.heldPlayer = null; e.throwTarget = null; }
    if (e.hp <= 0) {
      e.action = 'dead'; e.deadTimer = e.isBoss ? 65 : 25; e.stun = 0;
      this.state.stats.kills++; if (e.isBoss) this.state.stats.bosses++;
      if (player) this.addScore(player, e.isBoss ? e.score : kind === 'special' ? 200 : kind === 'attack' ? e.score : 400);
      this.effect('smoke', e.x, e.y, { life: 36, maxLife: 36, color: e.color });
    }
    return true;
  }

  damagePlayer(p, damage, attacker, { force = false, keepGrab = false, freeze = false, transform = false } = {}) {
    if (p.hp <= 0 || p.awaitingRespawn || this.state.mode === 'invincible' || (!force && p.invuln > 0)) return false;
    p.hp = Math.max(0, p.hp - damage); p.invuln = RULES.playerInvuln;
    p.stun = RULES.playerStun; p.vx = attacker ? sign(p.x - attacker.x) * 5.2 : -3; p.vy = 0;
    p.action = 'hurt'; p.age = 0; p.attackBuffer = 0; p.attackHits = [];
    if (!keepGrab) p.grabbedBy = null;
    if (freeze) { p.freeze = 100; p.stun = 0; }
    if (transform) { p.transformed = 120; p.height = 22; p.stun = 0; }
    this.state.stats.damageTaken += damage;
    this.effect('hit', p.x, p.y, { z: p.z + 32, color: '#ff7f6d', text: `−${damage}` });
    if (p.hp <= 0) {
      p.lives--; p.awaitingRespawn = true; p.respawnDelay = 70; p.action = 'down'; p.z = 0;
      p.grabbedBy = null; p.freeze = 0; p.transformed = 0; p.tossed = null; p.height = 57; this.state.stats.deaths++;
      this.message(`${p.index + 1}P 倒下：左右选龟，跳跃键复活${p.lives ? '' : ' / 借命'}`, 240);
    }
    return true;
  }

  respawn(p) {
    if (this.state.players.some(other => other !== p && other.lives > 0 && other.character === p.character)) {
      p.character = CHARACTER_IDS.find(id => !this.state.players.some(other => other !== p && other.lives > 0 && other.character === id));
      p.name = CHARACTERS[p.character].name;
    }
    Object.assign(p, { hp: p.maxHp, awaitingRespawn: false, x: this.state.cameraX + 180 + p.index * 65,
      y: 375 + p.index * 40, z: 0, vz: 0, vx: 0, vy: 0, action: 'idle', age: 0,
      invuln: RULES.respawnInvuln, stun: 0, grabbedBy: null, freeze: 0, transformed: 0, height: 57, tossed: null });
    this.effect('special', p.x, p.y, { color: CHARACTERS[p.character].color });
  }

  addScore(p, amount) {
    p.score += amount;
    while (p.score >= p.nextLifeScore) { p.lives++; p.nextLifeScore += RULES.extraLifeScore; this.effect('text', p.x, p.y, { text: '1UP', life: 80, maxLife: 80, color: '#d1ff77' }); }
  }

  dropItem(type, x, y) { this.state.items.push({ id: `item${this.nextId++}`, type, x, y, z: 0, age: 0 }); }

  updatePickups() {
    for (const item of this.state.items) {
      item.age++;
      const p = this.state.players.find(p => p.hp > 0 && !p.awaitingRespawn && p.z < 12 && Math.abs(p.x - item.x) < 32 && Math.abs(p.y - item.y) < 22);
      if (p) { p.hp = p.maxHp; item.used = true; this.effect('pizza', p.x, p.y, { text: 'PIZZA!', color: '#ffc56e', life: 60, maxLife: 60 }); }
    }
    this.state.items = this.state.items.filter(item => !item.used);
  }

  nearestPlayer(e) {
    return this.state.players.filter(p => p.hp > 0 && !p.awaitingRespawn).sort((a, b) => distance(e, a) - distance(e, b))[0];
  }

  updateEnemy(e) {
    e.age++; if (e.invuln > 0) e.invuln--;
    if (e.partOf) { this.updateKrangPart(e); return; }
    if (e.action === 'thrown') { this.updateThrown(e); return; }
    if (e.hp <= 0) { e.deadTimer--; return; }
    if (e.entryTimer > 0) { e.entryTimer--; e.action = 'enter'; return; }
    if (e.stun > 0) { e.stun--; e.x += e.vx; e.vx *= .78; if (!e.stun) e.action = 'walk'; return; }
    const target = this.nearestPlayer(e); if (!target) return;
    if (e.heldPlayer) {
      const p = this.state.players.find(p => p.id === e.heldPlayer);
      if (!p || p.hp <= 0 || p.grabbedBy !== e.id) { e.heldPlayer = null; e.throwTarget = null; }
      else {
        e.action = 'attack';
        if (e.throwTarget && --e.holdTimer <= 0) {
          const target = e.throwTarget;
          p.grabbedBy = null; p.stun = 0; p.vx = 0; p.vy = 0;
          p.tossed = { fromX: p.x, fromY: p.y, toX: target.x + target.w / 2, toY: target.y + target.h / 2, t: 0, duration: 40 };
          e.heldPlayer = null; e.throwTarget = null;
        }
        return;
      }
    }
    if (e.isBoss) this.updateBoss(e, target); else this.updateMinion(e, target);
    e.x = clamp(e.x, this.state.cameraX + 25, this.state.cameraX + 935);
    e.y = clamp(e.y, RULES.groundTop + 2, RULES.groundBottom - 2);
  }

  updateThrown(e) {
    e.x += e.vx; e.y += e.vy; e.z += e.vz; e.vz -= .55; e.deadTimer--;
    const owner = this.state.players.find(p => p.id === e.thrownBy);
    for (const other of this.state.enemies) if (other !== e && !e.throwHits.includes(other.id) && other.hp > 0 && Math.abs(other.x - e.x) < 45 && Math.abs(other.y - e.y) < 28 && e.z - 28 <= other.z + other.height && e.z + 28 >= other.z) {
      if (this.damageEnemy(other, 3, owner, 'throw')) e.throwHits.push(other.id);
    }
    if (e.z <= 0 || e.x < this.state.cameraX - 70 || e.x > this.state.cameraX + 1030) {
      e.z = 0; e.vz = 0; e.vx = 0;
      if (e.hp <= 0) { e.action = 'dead'; e.deadTimer = 12; }
      else { e.action = 'hurt'; e.stun = 30; e.invuln = 20; }
    }
  }

  pursue(e, p, speed, desired = 44) {
    const dx = p.x - e.x, dy = p.y - e.y;
    e.facing = sign(dx);
    if (Math.abs(dy) > 8) e.y += Math.sign(dy) * speed * .7;
    if (Math.abs(dx) > desired) e.x += Math.sign(dx) * speed;
    e.action = 'walk';
  }

  updateMinion(e, p) {
    const def = ENEMY_TYPES[e.type];
    const dx = Math.abs(p.x - e.x), lane = Math.abs(p.y - e.y);
    if (e.cooldown > 0) e.cooldown--;
    if (e.aiState === 'windup') {
      e.action = 'windup'; e.aiAge++;
      if (e.aiAge >= (def.behavior === 'heavy' ? 32 : 24)) {
        this.minionAttack(e, p); e.aiState = 'recover'; e.aiAge = 0; e.action = 'attack'; e.cooldown = def.behavior === 'turret' ? 95 : 62;
      }
      return;
    }
    if (e.aiState === 'recover') { e.aiAge++; if (e.aiAge > 24) e.aiState = 'approach'; return; }
    if (def.behavior === 'flyer' || def.behavior === 'dive') {
      e.z = 58 + Math.sin(e.age / 23) * 14;
      this.pursue(e, p, def.speed, def.behavior === 'dive' ? 0 : 190);
      if (def.behavior === 'dive' && dx < 70 && lane < 24) { e.z = Math.max(0, e.z - e.age % 35 * 3); if (e.z < 20) { this.enemyMelee(e, 2, { reach: 70, zLow: 0, zHigh: 70 }); e.hp = 0; e.deadTimer = 20; this.effect('smoke', e.x, e.y); } }
    } else if (['ranged', 'knife', 'boomerang', 'carrier', 'sand', 'robot', 'turret'].includes(def.behavior)) {
      e.facing = sign(p.x - e.x);
      if (def.speed) {
        if (lane > 12) e.y += Math.sign(p.y - e.y) * def.speed * .7;
        if (dx > def.reach) e.x += e.facing * def.speed;
        else if (dx < 145 && def.behavior !== 'carrier') e.x -= e.facing * def.speed * .6;
      }
      e.action = 'walk';
    } else {
      this.pursue(e, p, def.speed, def.reach - 10);
      if (def.behavior === 'jumper' && e.cooldown > 30 && e.age % 140 < 45) e.z = Math.sin((e.age % 140) / 45 * Math.PI) * 80; else e.z = 0;
    }
    if (e.cooldown === 0 && dx < def.reach + 20 && lane < 28) { e.aiState = 'windup'; e.aiAge = 0; e.action = 'windup'; e.facing = sign(p.x - e.x); }
    if (def.behavior === 'electric') {
      const mate = this.state.enemies.find(other => other !== e && other.type === 'electric' && other.hp > 0);
      if (mate && Math.abs(mate.x - e.x) < 220) {
        e.linkTo = mate.id;
        for (const player of this.state.players) if (player.z < 45 && player.x > Math.min(e.x, mate.x) && player.x < Math.max(e.x, mate.x) && Math.abs(player.y - (e.y + mate.y) / 2) < 18) this.damagePlayer(player, 1, e);
      } else e.linkTo = null;
    }
  }

  minionAttack(e, p) {
    const def = ENEMY_TYPES[e.type], behavior = def.behavior;
    if (['ranged', 'flyer', 'robot', 'turret', 'sand', 'carrier', 'boomerang', 'knife'].includes(behavior)) {
      const kind = behavior === 'sand' ? 'sand' : behavior === 'carrier' ? 'barrel' : behavior === 'boomerang' ? 'boomerang' : def.projectile || (behavior === 'turret' ? 'flame' : 'laser');
      if (behavior === 'knife') { this.shoot(e, 'knife', { z: 18 }); this.shoot(e, 'knife', { z: 64, vx: 5.6 * e.facing }); }
      else this.shoot(e, kind, { z: behavior === 'sand' || behavior === 'carrier' ? 13 : behavior === 'flyer' ? 75 : 30 });
      if (behavior === 'carrier') { e.type = 'foot'; e.color = ENEMY_TYPES.foot.color; }
    } else if ((behavior === 'mouser' || behavior === 'melee' && e.type === 'foot') && p.z < 10 && canHit(e, p, { reach: 44, depth: 18, zLow: 0, zHigh: 54 }) && this.random() < .35 && !p.invuln) {
      e.heldPlayer = p.id; p.grabbedBy = e.id; p.escape = 0; p.age = 0;
      this.message('被抓住了！连按攻击 / 跳跃挣脱；同伴也能解围。', 100);
    } else this.enemyMelee(e, behavior === 'heavy' ? 2 : 1, { reach: def.reach, zLow: behavior === 'mouser' ? 0 : 14, zHigh: behavior === 'mouser' ? 32 : 62 });
  }

  enemyMelee(e, damage = 1, spec = {}) {
    for (const p of this.state.players) if (canHit(e, p, spec)) this.damagePlayer(p, damage, e, spec);
  }

  shoot(e, kind, extra = {}) {
    const speeds = { bullet: 6.2, rocket: 4.2, laser: 7, knife: 5.3, shuriken: 5, boomerang: 4.8, barrel: 4.3, sand: 3.4, ice: 4.4, flame: 4.2, electric: 5, transform: 4.2, fist: 4.8, homing: 3.2 };
    const shot = { id: `shot${this.nextId++}`, kind, x: e.x + e.facing * 28, y: e.y, z: 30,
      vx: (speeds[kind] || 5) * e.facing, vy: 0, radius: kind === 'barrel' ? 24 : kind === 'rocket' ? 16 : 11,
      life: kind === 'sand' ? 50 : 180, age: 0, faction: 'enemy', owner: e.id,
      damage: ['rocket', 'flame', 'electric', 'fist'].includes(kind) ? 2 : 1,
      reflectable: ['shuriken', 'knife', 'barrel', 'boomerang'].includes(kind), ...extra };
    this.state.projectiles.push(shot); return shot;
  }

  updateProjectiles() {
    for (const shot of this.state.projectiles) {
      shot.age++; shot.life--;
      if (shot.kind === 'boomerang' && shot.age === 38) shot.vx *= -1;
      if (shot.kind === 'homing' && shot.faction === 'enemy' && shot.age < 85) {
        const p = this.nearestPlayer(shot); if (p) { shot.vy += Math.sign(p.y - shot.y) * .04; shot.vy = clamp(shot.vy, -1.5, 1.5); }
      }
      shot.x += shot.vx; shot.y += shot.vy;
      if (shot.faction === 'enemy') {
        for (const p of this.state.players) if (p.hp > 0 && !p.awaitingRespawn && Math.abs(p.x - shot.x) < p.radius + shot.radius && Math.abs(p.y - shot.y) < 18 && shot.z + shot.radius >= p.z && shot.z - shot.radius <= p.z + p.height) {
          if (this.damagePlayer(p, shot.damage, shot, { freeze: shot.kind === 'ice', transform: shot.kind === 'transform' })) { if (shot.kind !== 'boomerang') shot.life = 0; }
        }
      } else {
        const p = this.state.players.find(p => p.id === shot.owner);
        for (const e of this.state.enemies) if (e.hp > 0 && Math.abs(e.x - shot.x) < e.radius + shot.radius && Math.abs(e.y - shot.y) < 22 && shot.z + shot.radius >= e.z && shot.z - shot.radius <= e.z + e.height) {
          if (this.damageEnemy(e, 3, p, 'reflect')) shot.life = 0;
        }
      }
      if (shot.x < this.state.cameraX - 90 || shot.x > this.state.cameraX + 1050) shot.life = 0;
    }
    this.state.projectiles = this.state.projectiles.filter(shot => shot.life > 0);
  }

  beginAI(e, state, duration, p) {
    e.aiState = state; e.aiTimer = duration; e.aiAge = 0; e.attackHits = [];
    e.targetX = p.x; e.targetY = p.y; e.facing = sign(p.x - e.x);
    e.action = /warn|aim/i.test(state) ? 'windup' : state === 'recover' ? 'idle' : state === 'guard' ? 'guard' : state === 'teleport' ? 'burrow' : 'attack';
  }

  chooseBossPattern(e, p) {
    let sequence;
    switch (e.type) {
      case 'rocksteady': sequence = [['gun', 70], ['jumpGun', 60], ['chargeWarn', 30], ['charge', 42], ['recover', 46]]; break;
      case 'groundchuck': sequence = e.hp < 96 ? [['pipe', 64], ['chargeWarn', 25], ['charge', 45], ['recover', 60]] : [['chargeWarn', 25], ['charge', 45], ['recover', 50], ['chargeWarn', 20], ['charge', 45], ['recover', 60]]; break;
      case 'slash': sequence = [['jumpSlash', 62], ['shellSpin', 85], ['recover', 38]]; break;
      case 'bebop': sequence = [['mace', 68], ['kick', 48], ['recover', 35]]; break;
      case 'dirtbag': sequence = [['helmetLaser', 84], ['pickWarn', 32], ['pickaxe', 26], ['recover', 75]]; break;
      case 'mother': case 'redmother': sequence = [['spawn', 100], ['fireballs', 74], ['recover', 26]]; break;
      case 'leatherhead': sequence = e.hp < 64 ? [['shotgun', 70], ['tail', 55], ['rushGrab', 65], ['recover', 32]] : [['shotgun', 75], ['tail', 55], ['recover', 40]]; break;
      case 'rahzar': sequence = [['iceBreath', 70], ['leapClaw', 65], ['claws', 50], ['recover', 35]]; break;
      case 'shredder': sequence = [['sword', 62], ['jumpKick', 60], ['grab', 50], ['recover', 35]]; break;
      case 'tokka': sequence = [['guard', 55], ['rushPunch', 58], ['bite', 42], ['electricSign', 65], ['recover', 40]]; break;
      case 'krang': sequence = e.phase === 2 ? [['splitLaser', 75], ['fist', 65], ['recover', 35]] : e.phase === 3 ? [['electricBody', 80], ['homing', 70], ['recover', 40]] : [['homing', 80], ['fist', 65], ['laser', 70], ['recover', 35]]; break;
      case 'super': sequence = [['teleport', 45], ['transformBeam', 75], ['lightning', 65], ['dashSlash', 60], ['recover', 44]]; break;
      default: sequence = [['claws', 55], ['recover', 40]];
    }
    const [state, duration] = sequence[e.pattern % sequence.length]; e.pattern++;
    this.beginAI(e, state, duration, p);
  }

  updateBoss(e, p) {
    if (e.type === 'krang') {
      const phase = e.hp > 256 ? 1 : e.hp > 96 ? 2 : 3;
      if (phase !== e.phase) {
        e.phase = phase; e.pattern = 0; e.aiTimer = 0;
        e.targetable = phase !== 2; e.hiddenBody = phase === 2;
        if (phase === 2) this.splitKrang(e);
        this.effect('smoke', e.x, e.y, { life: 60, maxLife: 60 });
        this.message(phase === 2 ? 'KRANG：上下体分离，攻击腿部或跳踢上身！' : 'KRANG：电流消失时才能攻击！', 160);
      }
      if (phase === 2) { e.aiState = 'split'; e.action = 'split'; return; }
    }
    if (e.aiTimer <= 0 || e.aiState === 'approach') { if (e.aiTimer > 0) { e.aiTimer--; return; } this.chooseBossPattern(e, p); }
    e.aiTimer--; e.aiAge++;
    const f = e.aiAge, state = e.aiState;
    if (state === 'recover') { e.action = 'idle'; e.z = 0; return; }
    e.weakPoint = e.type === 'krang' && e.phase === 3 && state !== 'electricBody';
    if (state === 'jumpGun') {
      // Reference checkpoint shows Rocksteady airborne with a gun; jump arc, firing and trigger timing below are reconstruction.
      e.z = e.aiTimer === 0 ? 0 : Math.sin(Math.min(f / 60, 1) * Math.PI) * 90;
      e.action = 'jump';
      if ([20, 37, 54].includes(f)) {
        e.action = 'attack';
        this.shoot(e, 'bullet', { z: e.z + 35 });
      }
    } else if (state === 'electricSign') {
      if (f < 45) this.pursue(e, p, 2.1, 40);
      e.action = f < 18 ? 'windup' : 'attack';
      const neon = this.state.hazards.find(h => h.type === 'neon');
      if (neon && f >= 18 && f <= 45) this.bossGrab(e, p, neon);
    } else if (['gun', 'shotgun', 'helmetLaser', 'iceBreath', 'fireballs', 'homing', 'fist', 'laser', 'splitLaser', 'transformBeam', 'lightning'].includes(state)) {
      if (f < 15) { e.facing = sign(p.x - e.x); if (Math.abs(p.y - e.y) > 15) e.y += Math.sign(p.y - e.y) * .8; e.action = 'windup'; }
      else e.action = 'attack';
      if ([20, 37, 54].includes(f)) {
        const kinds = { gun: 'bullet', shotgun: 'bullet', helmetLaser: 'laser', iceBreath: 'ice', fireballs: 'flame', homing: 'homing', fist: 'fist', laser: 'laser', splitLaser: 'laser', transformBeam: 'transform', lightning: 'electric', electricSign: 'electric' };
        const z = state === 'splitLaser' ? (f === 37 ? 74 : 18) : state === 'lightning' ? 18 : 35;
        this.shoot(e, kinds[state], { z, damage: e.type === 'super' ? 3 : ['shotgun', 'fist'].includes(state) ? 2 : 1 });
        if (state === 'gun' || state === 'shotgun') this.shoot(e, 'bullet', { z, vy: (f === 37 ? -1 : 1) * 1.4, damage: state === 'shotgun' ? 2 : 1 });
      }
    } else if (state === 'chargeWarn' || state === 'pickWarn') {
      e.action = 'windup'; e.facing = sign(p.x - e.x); e.targetY = p.y;
    } else if (state === 'charge' || state === 'shellSpin' || state === 'rushPunch' || state === 'dashSlash' || state === 'rushGrab') {
      e.action = 'charge';
      if (state !== 'charge' && f < 15) { e.facing = sign(p.x - e.x); e.y += Math.sign(p.y - e.y) * 1.6; }
      if (f > (state === 'charge' ? 0 : 15)) {
        e.x += e.facing * (state === 'shellSpin' ? 5.6 : state === 'dashSlash' ? 7 : 6.4);
        if (state === 'shellSpin' && (e.x <= this.state.cameraX + 50 || e.x >= this.state.cameraX + 910)) e.facing *= -1;
        if (state === 'rushGrab') this.bossGrab(e, p);
        else this.enemyMelee(e, e.type === 'super' ? 3 : 2, { reach: 62, depth: 20, zLow: 0, zHigh: state === 'shellSpin' ? 38 : 68 });
      }
    } else if (['jumpSlash', 'leapClaw', 'jumpKick'].includes(state)) {
      e.z = Math.sin(Math.min(f / 60, 1) * Math.PI) * 100;
      if (f < 43) { e.x += e.facing * 3.2; e.y += clamp(e.targetY - e.y, -1.2, 1.2); }
      if (f > 12 && f < 52) this.enemyMelee(e, 2, { reach: 70, zLow: -45, zHigh: 35 });
      if (e.aiTimer === 0) e.z = 0;
    } else if (state === 'spawn') {
      e.action = f < 20 ? 'windup' : 'attack';
      if (f === 25) {
        const cap = e.type === 'redmother' ? 4 : 3;
        const count = this.state.enemies.filter(q => q.type === 'mouser' && q.hp > 0).length;
        for (let i = count; i < cap; i++) this.spawnEnemy('mouser', e.x - 60 - (i - count) * 30, clamp(e.y + (i - count - 1) * 40, 298, 455), { cooldown: 50, summoned: true });
      }
    } else if (state === 'teleport') {
      e.action = 'burrow';
      if (f === 25) { e.x = clamp(p.x + (p.x < this.state.cameraX + 480 ? 220 : -220), this.state.cameraX + 75, this.state.cameraX + 885); e.y = clamp(p.y + 45, 310, 450); this.effect('smoke', e.x, e.y); }
    } else if (state === 'guard') {
      e.action = 'guard'; this.pursue(e, p, .55, 130); e.action = 'guard';
    } else if (state === 'electricBody') {
      this.pursue(e, p, 1.5, 0); e.action = 'charge';
      this.enemyMelee(e, 2, { allAround: true, reach: 75, depth: 25, zLow: 0, zHigh: 90 });
    } else {
      const info = {
        pipe: { reach: 155, allAround: true, damage: 2 }, mace: { reach: 205, damage: 2 },
        kick: { reach: 95, damage: 2 }, pickaxe: { reach: 135, damage: 2 },
        tail: { reach: 142, allAround: true, damage: 2 }, claws: { reach: 100, damage: 2 },
        sword: { reach: 113, damage: 2 }, bite: { reach: 92, damage: 2 }, grab: { reach: 65, damage: 2 }
      }[state] || { reach: 90, damage: 1 };
      if (f < 15) { this.pursue(e, p, 1.6, info.reach - 18); e.action = 'windup'; }
      else e.action = 'attack';
      if ([18, 36].includes(f)) {
        if (state === 'grab') this.bossGrab(e, p);
        else this.enemyMelee(e, info.damage, { ...info, depth: 24, zLow: 0, zHigh: 70 });
      }
    }
  }

  splitKrang(parent) {
    for (const partKind of ['upper', 'lower']) {
      this.state.enemies.push({ ...parent, id: `part${this.nextId++}`, type: 'krangpart', name: `KRANG ${partKind.toUpperCase()}`,
        partOf: parent.id, partKind, isBoss: false, targetable: true, hiddenBody: false, score: 0,
        x: parent.x + (partKind === 'upper' ? 35 : -35), y: parent.y,
        z: partKind === 'upper' ? 75 : 0, height: partKind === 'upper' ? 48 : 44,
        hp: parent.hp, maxHp: parent.maxHp, invuln: 0, age: 0, stun: 0, cooldown: partKind === 'upper' ? 25 : 42,
        action: 'walk', aiState: partKind === 'upper' ? 'floatingLaser' : 'walkingKick', attackHits: [], heldPlayer: null });
    }
  }

  updateKrangPart(part) {
    const parent = this.state.enemies.find(e => e.id === part.partOf);
    if (!parent || parent.hp <= 0 || parent.phase !== 2) { part.hp = 0; part.deadTimer = 0; part.action = 'dead'; return; }
    part.hp = parent.hp;
    const p = this.nearestPlayer(part); if (!p) return;
    part.facing = sign(p.x - part.x); part.cooldown--;
    if (part.partKind === 'upper') {
      part.z = 75 + Math.sin(part.age / 24) * 13;
      part.x += Math.sin(part.age / 43) * 1.6;
      part.y += clamp(p.y - part.y, -.75, .75);
      part.action = part.cooldown < 15 ? 'windup' : 'walk';
      if (part.cooldown <= 0) { this.shoot(part, 'laser', { z: 70 }); part.cooldown = 76; part.action = 'attack'; }
    } else {
      this.pursue(part, p, 1.8, 52);
      if (part.cooldown <= 0) { this.enemyMelee(part, 2, { reach: 80, zLow: 0, zHigh: 45 }); part.cooldown = 65; part.action = 'attack'; }
    }
    part.x = clamp(part.x, this.state.cameraX + 40, this.state.cameraX + 920);
    part.y = clamp(part.y, RULES.groundTop + 5, RULES.groundBottom - 5);
  }

  bossGrab(e, p, throwTarget = null) {
    if (p.invuln || p.z > 12 || p.grabbedBy || !canHit(e, p, { reach: 65, depth: 20 })) return;
    this.damagePlayer(p, 2, e); p.stun = 0; p.grabbedBy = e.id; p.escape = 0; p.age = 0; e.heldPlayer = p.id;
    e.throwTarget = throwTarget; e.holdTimer = 16;
    this.message(throwTarget ? '托卡要把你扔向霓虹灯！快速挣脱或让同伴解围！' : '连按攻击 / 跳跃挣脱抓取！', 110);
  }

  inside(p, h) { return p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h; }

  updateHazards() {
    const s = this.state;
    for (const h of s.hazards) {
      h.phase = s.stageFrame % (h.period || 180);
      h.active = ['pit', 'water', 'mine', 'conveyor', 'neon'].includes(h.type) || h.phase > 70 && h.phase < 110;
      if (h.x < s.cameraX - 250 || h.x > s.cameraX + 1050) continue;
      if (['barrel', 'truck', 'manhole'].includes(h.type) && h.phase === 80) {
        this.shoot({ id: h.id, x: h.x + h.w, y: h.y, facing: -1 }, h.type === 'manhole' ? 'shuriken' : h.type === 'truck' ? 'rocket' : 'barrel', { z: 18 });
      }
      for (const p of s.players) {
        if (p.hp <= 0 || p.awaitingRespawn || p.tossed || !this.inside(p, h)) continue;
        if (h.type === 'conveyor' && p.z < 5) p.x += (h.direction || 1) * 1.5;
        else if (h.type === 'pit' && p.z < 9) {
          if (this.damagePlayer(p, 1, null)) { p.x = Math.max(s.cameraX + 40, h.x - 32); p.y = clamp(h.y - 24, 290, 465); this.effect('text', h.x, h.y, { text: '落下', life: 35, maxLife: 35 }); }
        } else if (['mine', 'flame', 'laser', 'sign', 'falling', 'neon'].includes(h.type) && h.active && (h.type === 'falling' || p.z < 42)) this.damagePlayer(p, h.type === 'falling' || h.type === 'neon' ? 2 : 1, h);
      }
      for (const e of s.enemies) if (h.type === 'pit' && e.hp > 0 && !e.isBoss && !e.partOf && e.z < 5 && this.inside(e, h)) {
        e.hp = 0; e.action = 'dead'; e.deadTimer = 12; this.effect('smoke', e.x, e.y);
      }
    }
  }

  updateProgress() {
    const s = this.state, stage = STAGES[s.stageIndex];
    const living = s.players.filter(p => p.hp > 0 && !p.awaitingRespawn);
    if (!living.length && s.players.every(p => p.lives <= 0 && p.respawnDelay === 0)) { s.phase = 'gameover'; this.message('GAME OVER', 99999); return; }
    const present = s.enemies.some(e => e.hp > 0 || e.deadTimer > 0);
    if (s.waveActive && !present) {
      s.waveActive = false; s.lockX = null;
      const w = stage.waves[s.waveIndex];
      if (w.pizza) this.dropItem('pizza', w.at + 620, 395);
      if (s.waveIndex === stage.waves.length - 1) {
        s.phase = 'stageClear'; s.transition = 180; s.stats.stages++;
        s.players.forEach(p => this.addScore(p, Math.floor(s.timeLeft)));
        this.message(`SCENE ${s.stageIndex + 1} CLEAR`, 180); return;
      }
      this.message('GO →', 100);
    }
    if (!living.length) return;
    const travel = getSection(s.stageIndex, s.cameraX + 200).type;
    s.autoScroll = !s.waveActive && (travel === 'surf' || travel === 'lift');
    if (s.autoScroll) {
      const delta = travel === 'surf' ? 2.1 : 1.6;
      s.cameraX = Math.min(stage.length - 960, s.cameraX + delta);
      living.forEach(p => { p.x += delta; });
    }
    const lead = Math.max(...living.map(p => p.x));
    const next = stage.waves[s.waveIndex + 1];
    if (!s.waveActive && next && lead >= next.at + 100) this.spawnWave(s.waveIndex + 1);
    const leftmost = Math.min(...living.map(p => p.x));
    let desired = Math.max(s.cameraX, leftmost - 220);
    if (s.waveActive && s.lockX != null) desired = Math.min(desired, s.lockX);
    desired = clamp(desired, 0, stage.length - 960);
    s.cameraX += Math.min(5, Math.max(0, desired - s.cameraX));
    s.section = getSection(s.stageIndex, s.cameraX + 200);
  }
}
