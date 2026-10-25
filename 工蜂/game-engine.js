(function exposeEngine(root, factory) {
  const core = typeof module === 'object' && module.exports ? require('./game-core.js') : root.WorkerBeeCore;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WorkerBeeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildEngine(C) {
  'use strict';
  const { WIDTH: W, HEIGHT: H, LEVELS, clamp, circleHit } = C;
  const STEP = 1 / 60;
  // Timing and movement are explicit reconstruction parameters; see MECHANICS.md.
  const PACE = 1;
  const STAGE_DURATIONS = [129, 160, 160, 160, 288];
  const SCROLL = 38;
  const BOSS_HP = [15, 20, 20, 23, 26];
  const BELL_NAMES = { yellow: '黄铃', blue: '蓝铃 · 加速', white: '白铃 · 双炮', flashing: '闪铃 · 分身', red: '红铃 · 屏障' };

  function start(stageIndex = 0, playerCount = 1, assist = {}) {
    const s = C.createGameState(stageIndex, playerCount);
    Object.assign(s, { mode: 'playing', scroll: 0, loop: 1, stageNumber: stageIndex + 1,
      frame: 0, serial: 0, nextCloud: 1, nextGround: 2.5, cloudIndex: 0, groundIndex: 0,
      groundDestroyed: 0, stageBanner: 2, boss: null, clearTimer: 0, events: [], seed: 0x19860104,
      formation: null, formationCooldown: 0 });
    s.players.forEach((p, i) => { p.x = playerCount === 2 ? W * (i === 0 ? .35 : .65) : W / 2; p.y = H - 64; p.invulnerable = 2; });
    configureAssist(s, assist);
    return s;
  }
  function playerArmor(s, p) {
    p.maxHealth = s.assist.mode === 'armor' ? s.assist.health : 2;
    p.health = p.active ? p.maxHealth : 0;
  }
  function configureAssist(s, { mode = 'classic', health = 10 } = {}) {
    const modes = ['classic', 'armor', 'invincible'];
    s.assist = { mode: modes.includes(mode) ? mode : 'classic', health: clamp(Math.trunc(Number(health)) || 10, 2, 99) };
    for (const p of s.players) {
      playerArmor(s, p);
      if (s.assist.mode !== 'classic' && p.active) p.arms.left = p.arms.right = true;
      if (s.assist.mode === 'classic' && !p.arms.left && p.active) p.health = 1;
    }
    return s.assist;
  }
  function random(s) {
    s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
    return s.seed / 4294967296;
  }
  function emit(s, type, text = '', value = 0) {
    s.events.push({ type, text, value });
    // The browser drains once per frame; headless simulation remains bounded too.
    if (s.events.length > 80) s.events.shift();
  }
  function score(s, p, amount) {
    const lives = p.lives;
    C.addScore(s, p, amount);
    if (p.lives > lives) emit(s, 'extra-life', `${p.id + 1}P 奖励一架`);
  }
  function particles(s, x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = random(s) * Math.PI * 2, speed = 25 + random(s) * 100;
      s.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        radius: 2 + random(s) * 2, life: .35, maxLife: .35, color });
    }
  }
  function activePlayers(s) { return s.players.filter(p => p.active && p.lives > 0); }
  function aimPlayer(s, x, y) {
    return activePlayers(s).reduce((best, p) => !best || Math.hypot(p.x - x, p.y - y) < Math.hypot(best.x - x, best.y - y) ? p : best, null) || s.player;
  }
  function enemy(s, kind, x, y, pattern = 'line', extra = {}) {
    const e = { type: 'enemy', kind, x, y, baseX: x, baseY: y, radius: 12, hp: 1, maxHp: 1,
      pattern, speed: 75 + (s.loop - 1) * 12, t: 0, phase: 0, direction: 1,
      fireClock: 1.4, shoots: false, score: kind === 'bee' ? 15100 : 100, ...extra };
    s.enemies.push(e); return e;
  }
  function spawnWave(s, config, waveIndex) {
    for (let i = 0; i < config.count; i++) {
      const x = 44 + (W - 88) * (i + .5) / config.count;
      const side = i % 2 === 0 ? 1 : -1;
      let pos = { x, y: -24 - i * 18 };
      if (config.formation === 'vee') pos = { x: W / 2 + (i - (config.count - 1) / 2) * 42, y: -24 - Math.abs(i - (config.count - 1) / 2) * 26 };
      if (config.formation === 'column') pos = { x: 130 + waveIndex % 3 * 96, y: -24 - i * 38 };
      if (['sides', 'cross'].includes(config.formation)) pos = { x: side > 0 ? 20 : W - 20, y: -24 - Math.floor(i / 2) * 42 };
      enemy(s, config.kind, pos.x, pos.y, config.formation, { direction: side, phase: i * .7,
        speed: (config.fast ? 110 : 75) + s.stageIndex * 3 + (s.loop - 1) * 12,
        shoots: Boolean(config.shoots) || s.loop > 1, fireClock: 1 + i * .21 });
    }
  }
  function spawnCloud(s) {
    const index = s.cloudIndex++;
    const xs = [W / 2, 112, 380, 184, 330, 72, 420];
    s.clouds.push({ type: 'cloud', x: xs[index % xs.length], y: -28, radius: 23,
      speed: SCROLL, hasBell: index % 4 !== 3, bellReleased: false, hits: 0 });
  }
  function spawnGround(s) {
    const index = s.groundIndex++;
    s.groundTargets.push({ type: 'ground', x: [96, 230, 386, 164, 326, 444][(index + s.stageIndex) % 6],
      y: -18, radius: 13, hp: 1, kind: index % 3 === 2 ? 'turret' : 'bush', fireClock: 1.8 + index % 3 * .4 });
  }
  function spawnBoss(s) {
    if (s.bossSpawned) return s.boss;
    const kind = LEVELS[s.stageIndex].bossKind;
    const hp = BOSS_HP[s.stageIndex] + (s.loop - 1) * 4;
    const boss = enemy(s, kind, W / 2, -64, 'boss', { type: 'boss', radius: 28, hp, maxHp: hp,
      score: 10000, fireClock: 1.1, summonClock: 2.5, shieldClock: 0, activeTime: 0, entered: false, parts: [] });
    s.boss = boss; s.bossSpawned = true;
    emit(s, 'boss', `${LEVELS[s.stageIndex].bossName} 出现`);
    return boss;
  }
  function fireEnemy(s, x, y, angle, speed, extra = {}) {
    s.enemyShots.push({ type: 'enemy-shot', x, y, vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed, radius: 4, t: 0, kind: 'enemy', ...extra });
  }
  function aimed(s, x, y, speed = 130) {
    const p = aimPlayer(s, x, y);
    fireEnemy(s, x, y, Math.atan2(p.y - y, p.x - x), speed);
  }
  function fan(s, x, y, count, spread, speed = 120) {
    for (let i = 0; i < count; i++) fireEnemy(s, x, y, Math.PI / 2 - spread / 2 + spread * i / Math.max(1, count - 1), speed);
  }
  function updateBoss(s, b, dt) {
    b.t += dt;
    if (!b.entered) {
      b.y += 65 * dt;
      if (b.y >= 90) { b.y = 90; b.entered = true; b.t = 0; }
      return;
    }
    b.activeTime += dt; b.fireClock -= dt; b.summonClock -= dt; b.shieldClock -= dt;
    const t = b.activeTime;
    switch (b.kind) {
      case 'onion-head':
        b.x = W / 2 + Math.sin(t * 1.2) * 145;
        b.y = 85;
        if (b.shieldClock <= 0 && !b.parts.some(p => !p.dead)) {
          b.parts = Array.from({ length: 4 }, (_, i) => ({ kind: 'satellite', radius: 9, hp: 2, angle: i * Math.PI / 2, x: b.x, y: b.y }));
          b.shieldClock = 5;
        }
        if (b.fireClock <= 0) { fan(s, b.x, b.y + 28, 5, 1.3); b.fireClock = 1.6; }
        break;
      case 'parallel-dish':
        b.x = W / 2 + Math.sin(t * .9) * 150;
        b.y = 88 + Math.sin(t * 1.7) * 36;
        if (b.fireClock <= 0) {
          s.enemyShots.push({ type: 'enemy-shot', kind: 'ring', x: b.x, y: b.y, vx: 0, vy: 28, radius: 4, t: 0 });
          b.fireClock = 2;
        }
        break;
      case 'tiger-shark': {
        const phase = (t * 92) % (2 * (W - 96));
        b.x = 48 + (phase < W - 96 ? phase : 2 * (W - 96) - phase);
        b.y = 90 + (Math.sin(t * .55) + 1) * 65;
        if (b.summonClock <= 0) {
          [-1, 1].forEach(side => enemy(s, 'frogger', b.x + side * 35, b.y + 10, 'dive', { shoots: true, direction: side, speed: 100 }));
          b.summonClock = 2.5;
        }
        if (b.fireClock <= 0) { aimed(s, b.x, b.y + 20, 145); b.fireClock = 1.8; }
        break;
      }
      case 'claw-device':
        b.x = ((t * 95 + W / 2 + 50) % (W + 100)) - 50;
        b.y = 80 + Math.sin(t) * 22;
        if (b.summonClock <= 0) {
          [-1, 1].forEach(side => enemy(s, 'orbiter', b.x, b.y, 'escort', { orbitBoss: b, direction: side, radius: 10, shoots: true }));
          b.summonClock = 3.2;
        }
        break;
      case 'king-spice': {
        const width = W - 112, height = H - 220, perimeter = 2 * (width + height);
        const d = (t * 80 + width / 2) % perimeter;
        if (d < width) { b.x = 56 + d; b.y = 65; }
        else if (d < width + height) { b.x = W - 56; b.y = 65 + d - width; }
        else if (d < 2 * width + height) { b.x = W - 56 - (d - width - height); b.y = 65 + height; }
        else { b.x = 56; b.y = 65 + height - (d - 2 * width - height); }
        if (b.summonClock <= 0) {
          [-1, 1].forEach(side => enemy(s, 'sunflower', b.x + side * 32, b.y, 'bloom', { direction: side, shoots: false, speed: 110 }));
          b.summonClock = 2.5;
        }
        break;
      }
    }
    for (const part of b.parts) {
      part.angle += dt * 2.5;
      part.x = b.x + Math.cos(part.angle) * 43;
      part.y = b.y + Math.sin(part.angle) * 43;
    }
  }
  function updateEnemy(s, e, dt) {
    e.t += dt;
    const speed = e.speed;
    switch (e.pattern) {
      case 'sine': e.y += speed * dt; e.x = e.baseX + Math.sin(e.t * 2.8 + e.phase) * 46; break;
      case 'sides': e.y += speed * .65 * dt; e.x += e.direction * speed * dt; if (e.x < 20 || e.x > W - 20) e.direction *= -1; break;
      case 'cross': e.y += speed * dt; e.x += e.direction * speed * .65 * dt; break;
      case 'dive': e.y += speed * 1.2 * dt; e.x += Math.sin(e.t * 3 + e.phase) * speed * .5 * dt; break;
      case 'arc': e.y += speed * .8 * dt; e.x = e.baseX + Math.sin(e.t * 1.6 + e.phase) * 65; break;
      case 'orbit': e.x = e.baseX + Math.sin(e.t * 2.3 + e.phase) * 50; e.y += speed * (e.t < 2 ? 1 : .5) * dt; break;
      case 'chase': {
        // Aim once before the dive; foes do not magnetically follow every movement.
        if (!e.aim && e.y >= 80) { const p = aimPlayer(s, e.x, e.y); const a = Math.atan2(p.y - e.y, p.x - e.x); e.aim = { x: Math.cos(a), y: Math.sin(a) }; }
        e.x += (e.aim?.x || 0) * speed * dt; e.y += (e.aim?.y ?? 1) * speed * dt; break;
      }
      case 'zigzag': e.y += speed * dt; e.x += e.direction * speed * dt; if (e.x < 28 || e.x > W - 28) e.direction *= -1; break;
      case 'hang': e.y += speed * (e.t > 3.5 ? 1.8 : .4) * dt; e.x = e.baseX + Math.sin(e.t * 2 + e.phase) * 28; break;
      case 'escort':
        if (e.t < 2 && !e.orbitBoss.dead) { e.x = e.orbitBoss.x + Math.cos(e.t * 4 + e.direction) * 55; e.y = e.orbitBoss.y + Math.sin(e.t * 4 + e.direction) * 55; }
        else { e.pattern = 'dive'; e.direction *= -1; }
        break;
      case 'bloom':
        if (e.t < 1) { e.x += e.direction * 36 * dt; e.y += 20 * dt; }
        else { e.open = true; e.y += speed * 1.7 * dt; }
        break;
      case 'bee': e.y += speed * dt; e.x = e.baseX + Math.sin(e.t * 5) * 38; break;
      default: e.y += speed * dt;
    }
    e.fireClock -= dt;
    if (e.shoots && e.fireClock <= 0 && e.y > 18 && e.y < H - 70) {
      aimed(s, e.x, e.y, 115 + s.stageIndex * 8 + (s.loop - 1) * 10);
      e.fireClock = 1.8 + (e.phase % .6);
    }
  }
  function shot(s, p, x, y, angle, extra = {}) {
    s.playerShots.push({ type: 'player-shot', owner: p.id, x, y, vx: Math.sin(angle) * 360,
      vy: -Math.cos(angle) * 360, radius: 3, damage: 1, ...extra });
  }
  function fire(s, p) {
    const volleys = new Set(s.playerShots.filter(b => !b.dead && b.owner === p.id && !b.clone).map(b => b.volley));
    if (volleys.size >= 3) return;
    const volley = ++s.serial;
    const origins = p.twinShot ? [-6, 6] : [0];
    const angles = p.threeWay ? (p.wideThreeWay ? [-Math.PI / 2, 0, Math.PI / 2] : [-.42, 0, .42]) : [0];
    for (const x of origins) for (const a of angles) shot(s, p, p.x + x, p.y - 17, a, { volley });
    if (p.mirrors) for (const pos of p.clonePositions) for (const x of origins) shot(s, p, pos.x + x, pos.y - 17, 0, { volley, clone: true });
    p.shotCooldown = .16;
    emit(s, 'shot');
  }
  function targetFor(s, p) {
    if (!p.arms.left && !p.arms.right) return null;
    return s.groundTargets.filter(t => !t.dead && Math.abs(t.x - p.x) <= 30 && t.y < p.y - 12 && t.y > p.y - 120)
      .sort((a, b) => Math.abs(a.y - (p.y - 68)) - Math.abs(b.y - (p.y - 68)))[0] || null;
  }
  function bomb(s, p) {
    const target = targetFor(s, p);
    if (!target || s.bombs.filter(b => !b.exploded && b.owner === p.id).length >= 1) return;
    p.bombSide = -(p.bombSide || 1);
    s.bombs.push({ type: 'bomb', owner: p.id, x: p.x, y: p.y, startX: p.x + p.bombSide * 15,
      startY: p.y, targetX: target.x, targetY: target.y, target, t: 0, duration: .36, radius: 4 });
    p.bombCooldown = .23;
    emit(s, 'bomb');
  }
  function groundDrop(s, target) {
    const count = (++s.groundDestroyed - 1) % 25 + 1;
    const p = s.player;
    let kind = count === 25 ? 'milk' : count === 15 ? 'star' : count === 6 && s.playerCount === 1 && !p.mirrors ? 'candy' : 'fruit';
    s.pickups.push({ type: 'pickup', kind, x: target.x, y: target.y, radius: 12, t: 0,
      phase: 0, value: count % 2 === 0 ? 500 : 100 });
  }
  function explodeBomb(s, b) {
    b.exploded = true;
    particles(s, b.x, b.y, '#ffd447'); emit(s, 'explode');
    // Bombs hit only their locked ground target; they never damage airborne enemies.
    if (b.target && !b.target.dead && circleHit({ ...b, radius: 17 }, b.target)) {
      b.target.dead = true; score(s, s.players[b.owner], 500); groundDrop(s, b.target);
    }
  }
  function hitEnemy(s, e, damage, p) {
    if (e.dead) return;
    e.hp -= damage;
    particles(s, e.x, e.y, '#fff7bc', 3);
    if (e.hp > 0) return;
    e.dead = true; score(s, p, e.score);
    particles(s, e.x, e.y, '#ff9944', e.type === 'boss' ? 32 : 9);
    emit(s, e.type === 'boss' ? 'boss-down' : 'enemy-down');
    if (e.type === 'boss') {
      s.mode = 'stage-clear'; s.clearTimer = 2.5;
      s.enemies.forEach(other => { other.dead = true; }); s.enemyShots = [];
      emit(s, 'stage-clear', `第 ${s.stageNumber} 关完成`);
    }
  }
  function hurt(s, p, collision = false) {
    if (!p.active || p.invulnerable > 0 || s.assist.mode === 'invincible') return 'ignored';
    let result;
    if (s.assist.mode === 'armor' && p.shield <= 0) {
      p.health = Math.max(0, p.health - (collision ? 2 : 1));
      if (p.health > 0) {
        p.invulnerable = .4; particles(s, p.x, p.y, '#8ad8ff');
        emit(s, 'hurt', `${p.id + 1}P 装甲 ${p.health}/${p.maxHealth}`);
        return 'armor';
      }
      result = 'life';
    } else result = C.damagePlayer(p, { collision });
    if (result === 'ignored') return result;
    if (result === 'shield') { particles(s, p.x, p.y, '#ffaaaa'); emit(s, 'shield'); return result; }
    if (result === 'arms') {
      p.health = 1;
      emit(s, 'hurt', `${p.id + 1}P 双臂受损 · 接住救护车`);
      if (!p.ambulanceUsed) {
        p.ambulanceUsed = true;
        s.pickups.push({ type: 'pickup', kind: 'ambulance', owner: p.id, x: clamp(p.x, 32, W - 32), y: -26, radius: 18, t: 0, phase: 0 });
      }
      return result;
    }
    particles(s, p.x, p.y, '#ff6666', 20);
    C.restorePlayerAfterDeath(p);
    playerArmor(s, p);
    C.missBell(s);
    s.pickups = s.pickups.filter(item => item.kind !== 'ambulance' || item.owner !== p.id);
    // FC respawns in place: keep the boss's remaining HP and the current wave.
    s.enemyShots = s.enemyShots.filter(b => Math.hypot(b.x - p.x, b.y - p.y) > 80);
    emit(s, 'life-lost', `${p.id + 1}P 剩余 ${p.lives} 架`);
    if (!activePlayers(s).length) { s.mode = 'game-over'; emit(s, 'lose', '游戏结束'); }
    return result;
  }
  function collect(s, pickup, p) {
    if (!p.active || pickup.dead) return;
    if (pickup.kind === 'ambulance' && pickup.owner !== p.id) return;
    pickup.dead = true;
    if (pickup.kind === 'bell') {
      const effect = C.applyBell(p, pickup.color, s.playerCount);
      if (effect.kind === 'yellow') {
        const lives = p.lives; C.collectYellowBell(s, p);
        if (p.lives > lives) emit(s, 'extra-life', `${p.id + 1}P 奖励一架`);
      } else if (pickup.color === 'red') s.bellHits = 0;
      emit(s, 'bell-collect', `${p.id + 1}P ${BELL_NAMES[effect.kind === 'yellow' ? 'yellow' : pickup.color]}`, pickup.hits || 0);
    } else if (pickup.kind === 'ambulance') {
      p.arms.left = p.arms.right = true; p.health = p.maxHealth; p.invulnerable = Math.max(p.invulnerable, 1);
      emit(s, 'repair', `${p.id + 1}P 双臂修复`);
    } else if (pickup.kind === 'candy') {
      if (C.applyCandy(p, s.playerCount)) { p.wideThreeWay = Boolean(p.selectPressed); emit(s, 'power', '糖果 · 三向弹'); }
    } else if (pickup.kind === 'star') {
      for (const e of s.enemies) if (!e.dead && e.type !== 'boss') hitEnemy(s, e, e.hp, p);
      s.enemyShots = []; emit(s, 'power', '星星 · 清屏');
    } else if (pickup.kind === 'milk') {
      p.lives++; emit(s, 'extra-life', '牛奶 · 奖励一架');
    } else { score(s, p, pickup.value || 100); emit(s, 'pickup', `水果 +${pickup.value || 100}`); }
  }
  function combination(s, inputs, dt) {
    s.formation = null; s.formationCooldown = Math.max(0, s.formationCooldown - dt);
    const [a, b] = s.players;
    if (!b || !a.active || !b.active || !a.arms.left || !a.arms.right || !b.arms.left || !b.arms.right) return;
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    if (dx <= 14 && dy >= 16 && dy <= 40) s.formation = { kind: 'star', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    else if (dy <= 12 && dx >= 24 && dx <= 48) s.formation = { kind: 'fire', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (!s.formation || s.formationCooldown > 0 || !inputs.some(i => i?.fire)) return;
    const f = s.formation, owner = inputs[0]?.fire ? a : b, volley = ++s.serial;
    if (f.kind === 'star') for (const angle of [-Math.PI / 2, 0, Math.PI / 2, Math.PI]) shot(s, owner, f.x, f.y, angle, { kind: 'star', radius: 6, damage: 2, volley });
    else shot(s, owner, f.x, Math.min(a.y, b.y) - 18, 0, { kind: 'fire', radius: 10, damage: 3, piercing: true, volley });
    s.formationCooldown = .32; emit(s, 'shot');
  }
  function collisions(s) {
    for (const b of s.playerShots) {
      if (b.dead) continue;
      const p = s.players[b.owner];
      const bell = s.pickups.find(item => !item.dead && item.kind === 'bell' && circleHit(b, item));
      if (bell) {
        b.dead = true;
        if ((bell.hitCooldown || 0) <= 0) {
          const result = C.hitBell(s, bell, p);
          bell.vy = -112; bell.vx = clamp((bell.x - b.x) * 5, -55, 55); bell.hitCooldown = .055;
          if (result === 'bee') { bell.dead = true; enemy(s, 'bee', bell.x, bell.y, 'bee', { speed: 95, hp: 1 }); }
          emit(s, 'bell-hit', '', bell.hits);
        }
        continue;
      }
      const cloud = s.clouds.find(item => !item.bellReleased && item.hasBell && circleHit(b, item));
      if (cloud) {
        b.dead = true; cloud.hits++;
        if (cloud.hits >= 1) {
          cloud.bellReleased = true;
          s.pickups.push({ type: 'pickup', kind: 'bell', x: cloud.x, y: cloud.y, radius: 12,
            hits: 0, color: 'yellow', t: 0, phase: 0, vx: 0, vy: -70, hitCooldown: .06 });
        }
        continue;
      }
      for (const e of s.enemies) {
        if (e.dead) continue;
        const part = e.parts?.find(part => !part.dead && circleHit(b, part));
        if (part) { part.hp -= b.damage; part.dead = part.hp <= 0; b.dead = true; particles(s, part.x, part.y, '#ffffff', 4); break; }
        if (!circleHit(b, e)) continue;
        // A piercing Fire bolt scores one hit per enemy, even across simulation frames.
        if (b.hitEnemies?.has(e)) continue;
        if (b.piercing) { b.hitEnemies ||= new Set(); b.hitEnemies.add(e); } else b.dead = true;
        hitEnemy(s, e, b.damage, p);
        if (b.dead || s.mode !== 'playing') break;
      }
      if (s.mode !== 'playing') return;
    }
    for (const p of activePlayers(s)) {
      const collider = p.shield > 0 ? { x: p.x, y: p.y, radius: 30 } : p;
      for (const b of s.enemyShots) {
        if (b.dead) continue;
        const contact = b.kind === 'ring' ? b.t >= .8 && Math.abs(Math.hypot(p.x - b.x, p.y - b.y) - b.radius) < collider.radius + 3 : circleHit(b, collider);
        if (contact) { if (b.kind !== 'ring') b.dead = true; hurt(s, p); }
      }
      if (!p.active) continue;
      for (const e of s.enemies) {
        if (!p.active) break;
        if (e.dead) continue;
        if (circleHit(e, collider) || e.parts?.some(part => !part.dead && circleHit(part, collider))) {
          const result = hurt(s, p, true);
          if (result === 'shield' && e.type !== 'boss') hitEnemy(s, e, e.hp, p);
        }
      }
      if (!p.active) continue;
      for (const item of s.pickups) if (!item.dead && circleHit(item, p, 2)) collect(s, item, p);
    }
  }
  function advanceStage(s) {
    const next = C.nextStage(s.stageIndex, s.loop);
    s.stageIndex = next.stageIndex; s.loop = next.loop; s.stageNumber++;
    s.stageTime = 0; s.scroll = 0; s.stageBanner = 2; s.spawnedWaves.clear();
    s.bossSpawned = false; s.boss = null; s.clearTimer = 0; s.mode = 'playing';
    s.nextCloud = 1; s.nextGround = 2.5; s.cloudIndex = 0; s.groundIndex = 0;
    for (const key of ['enemies', 'playerShots', 'enemyShots', 'bombs', 'groundTargets', 'clouds', 'pickups', 'particles']) s[key] = [];
    for (const p of s.players) { p.invulnerable = Math.max(p.invulnerable, 1.5); p.shotCooldown = p.bombCooldown = 0; }
    emit(s, 'next-stage', `第 ${s.stageNumber} 关 · 第 ${s.loop} 周目`);
    return s;
  }
  function step(s, inputs = [], dt = STEP) {
    if (s.mode === 'stage-clear') { s.clearTimer -= dt; if (s.clearTimer <= 0) advanceStage(s); return; }
    if (s.mode !== 'playing') return;
    s.frame++; s.stageTime += dt; s.stageBanner = Math.max(0, s.stageBanner - dt);
    if (!s.bossSpawned) s.scroll += SCROLL * dt;
    for (let i = 0; i < s.players.length; i++) {
      const p = s.players[i], input = inputs[i] || {};
      if (!p.active) continue;
      for (const key of ['invulnerable', 'shotCooldown', 'bombCooldown']) p[key] = Math.max(0, p[key] - dt);
      let dx = Number(!!input.right) - Number(!!input.left), dy = Number(!!input.down) - Number(!!input.up);
      if (input.pointer) { dx += clamp((input.pointer.x - p.x) / 20, -1, 1); dy += clamp((input.pointer.y - p.y) / 20, -1, 1); }
      const length = Math.max(1, Math.hypot(dx, dy)), speed = 150 + p.speedLevel * 24;
      p.x = clamp(p.x + dx / length * speed * dt, 20, W - 20); p.y = clamp(p.y + dy / length * speed * dt, 28, H - 22);
      p.selectPressed = Boolean(input.select);
      C.updateClones(p);
      p.target = targetFor(s, p);
    }
    combination(s, inputs, dt);
    for (let i = 0; i < s.players.length; i++) {
      const p = s.players[i], input = inputs[i] || {};
      if (!p.active) continue;
      if (input.fire && p.shotCooldown <= 0 && !s.formation) fire(s, p);
      if (input.bomb && p.bombCooldown <= 0) bomb(s, p);
    }
    const level = LEVELS[s.stageIndex];
    const stageDuration = STAGE_DURATIONS[s.stageIndex];
    // Preserve the authored enemy order through a longer FC-length stage. The
    // precise original spawn frames remain a documented calibration boundary.
    const waveCycle = level.duration;
    for (let cycle = 0; cycle * waveCycle < stageDuration - 4; cycle++) {
      level.waves.forEach((config, index) => {
        const at = cycle * waveCycle + config.at;
        const key = cycle * level.waves.length + index;
        if (at < stageDuration - 4 && !s.spawnedWaves.has(key) && s.stageTime >= at) {
          s.spawnedWaves.add(key); spawnWave(s, config, key);
        }
      });
    }
    if (!s.bossSpawned && s.stageTime >= stageDuration) spawnBoss(s);
    if (!s.bossSpawned && s.stageTime >= s.nextCloud) { spawnCloud(s); s.nextCloud += 4.8; }
    if (!s.bossSpawned && s.stageTime >= s.nextGround) { spawnGround(s); s.nextGround += 2.6; }
    for (const b of s.playerShots) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const b of s.enemyShots) { b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt; if (b.kind === 'ring') b.radius = 4 + b.t * 62; }
    for (const c of s.clouds) c.y += c.speed * dt;
    for (const t of s.groundTargets) {
      t.y += (s.bossSpawned ? 0 : SCROLL) * dt; t.fireClock -= dt;
      if (t.kind === 'turret' && t.fireClock <= 0 && t.y > 16 && t.y < H - 30) { aimed(s, t.x, t.y, 110); t.fireClock = 2.5; }
    }
    for (const b of s.bombs) {
      b.t += dt; const f = clamp(b.t / b.duration, 0, 1);
      if (b.target && !b.target.dead) { b.targetX = b.target.x; b.targetY = b.target.y; }
      b.x = b.startX + (b.targetX - b.startX) * f; b.y = b.startY + (b.targetY - b.startY) * f; b.z = Math.sin(f * Math.PI) * 20;
      if (f >= 1 && !b.exploded) explodeBomb(s, b);
    }
    for (const item of s.pickups) {
      item.t += dt;
      if (item.kind === 'bell') {
        item.hitCooldown = Math.max(0, (item.hitCooldown || 0) - dt);
        item.vy = Math.min(65, (item.vy || 0) + 140 * dt);
        item.y += item.vy * dt; item.x += (item.vx || 0) * dt; item.vx *= .97;
        if (item.y < 16) { item.y = 16; item.vy = Math.max(0, item.vy); }
        if (item.x < 14 || item.x > W - 14) { item.x = clamp(item.x, 14, W - 14); item.vx *= -1; }
      } else item.y += (item.kind === 'ambulance' ? 90 : s.bossSpawned ? 0 : SCROLL) * dt;
    }
    for (const e of s.enemies) if (!e.dead) { if (e.type === 'boss') updateBoss(s, e, dt); else updateEnemy(s, e, dt); }
    collisions(s);
    for (const p of s.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (const item of s.pickups) if (!item.dead && item.kind === 'bell' && item.y > H + 20) { item.dead = true; C.missBell(s); }
    s.playerShots = s.playerShots.filter(b => !b.dead && b.y > -30 && b.y < H + 30 && b.x > -30 && b.x < W + 30);
    s.enemyShots = s.enemyShots.filter(b => !b.dead && (b.kind === 'ring' ? b.t < 9 : b.y > -30 && b.y < H + 30 && b.x > -30 && b.x < W + 30));
    s.clouds = s.clouds.filter(c => c.y < H + 40);
    s.groundTargets = s.groundTargets.filter(t => !t.dead && t.y < H + 30);
    s.pickups = s.pickups.filter(item => !item.dead && item.y < H + 35);
    s.bombs = s.bombs.filter(b => !b.exploded);
    s.enemies = s.enemies.filter(e => !e.dead && (e.type === 'boss' || e.y < H + 45 && e.y > -400 && e.x > -100 && e.x < W + 100));
    s.particles = s.particles.filter(p => p.life > 0);
  }
  return { STEP, PACE, STAGE_DURATIONS, configureAssist, start, step, advanceStage, spawnBoss, spawnWave, enemy, fire, bomb, targetFor,
    hitEnemy, hurt, collect, collisions, groundDrop };
});
