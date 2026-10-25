(function bootWorkerBee() {
  "use strict";

  const core = window.WorkerBeeCore;
  if (!core) throw new Error("game-core.js 未加载");

  const {
    WIDTH,
    HEIGHT,
    LEVELS,
    clamp,
    circleHit,
    bellColorForHits,
    createGameState,
    createPlayer,
    applyBell,
    powerLabel,
  } = core;

  const worldCanvas = document.querySelector("#world-canvas");
  const canvas = document.querySelector("#game-canvas");
  const context = canvas.getContext("2d", { alpha: true });
  const worldRenderer = window.WorkerBeeWebGL.createRenderer(worldCanvas, WIDTH, HEIGHT);
  const overlay = document.querySelector("#game-overlay");
  const overlayKicker = document.querySelector("#overlay-kicker");
  const overlayTitle = document.querySelector("#overlay-title");
  const overlayCopy = document.querySelector("#overlay-copy");
  const startButton = document.querySelector("#start-button");
  const stageSelectButton = document.querySelector("#stage-select-button");
  const stagePicker = document.querySelector("#stage-picker");
  const pauseButton = document.querySelector("#pause-button");
  const soundButton = document.querySelector("#sound-button");
  const scoreValue = document.querySelector("#score-value");
  const stageValue = document.querySelector("#stage-value");
  const livesValue = document.querySelector("#lives-value");
  const powerValue = document.querySelector("#power-value");
  const liveStatus = document.querySelector("#live-status");
  const damageVignette = document.querySelector("#damage-vignette");

  const FIXED_STEP = 1 / 60;
  const keys = new Set();
  const touchInput = { up: false, down: false, left: false, right: false, fire: false, bomb: false };
  const pointer = { active: false, x: WIDTH / 2, y: HEIGHT - 112 };
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let state = createGameState(0);
  let overlayAction = () => startGame(0);
  let previousTime = performance.now();
  let accumulator = 0;
  let audioContext = null;
  let musicTimer = null;
  let soundEnabled = true;
  let musicStep = 0;
  let hudClock = 0;

  function prepareRuntime(runtimeState) {
    runtimeState.scroll = 0;
    runtimeState.nextCloud = 3;
    runtimeState.nextGroundTarget = 4;
    runtimeState.bellChain = 0;
    runtimeState.stageBanner = 2.4;
    runtimeState.boss = null;
    runtimeState.hudDirty = true;
    return runtimeState;
  }

  prepareRuntime(state);

  function announce(message) {
    liveStatus.textContent = message;
    state.message = message;
  }

  function setOverlay({ kicker, title, copy, button, action, allowStageSelect = false }) {
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    startButton.textContent = button;
    overlayAction = action;
    stageSelectButton.hidden = !allowStageSelect;
    stagePicker.hidden = true;
    overlay.classList.add("overlay--visible");
  }

  function hideOverlay() {
    overlay.classList.remove("overlay--visible");
  }

  function startGame(stageIndex) {
    stopMusic();
    state = prepareRuntime(createGameState(stageIndex));
    state.mode = "playing";
    pauseButton.disabled = false;
    pauseButton.textContent = "暂停";
    hideOverlay();
    unlockAudio();
    startMusic();
    announce(`第 ${stageIndex + 1} 关 ${LEVELS[stageIndex].name} 开始`);
    updateHud(true);
    canvas.focus({ preventScroll: true });
  }

  function advanceStage() {
    const nextIndex = state.stageIndex + 1;
    if (nextIndex >= LEVELS.length) {
      showVictory();
      return;
    }

    const score = state.score;
    const nextExtraLife = state.nextExtraLife;
    const player = state.player;
    const next = prepareRuntime(createGameState(nextIndex));
    next.score = score;
    next.nextExtraLife = nextExtraLife;
    next.player = player;
    next.player.x = WIDTH / 2;
    next.player.y = HEIGHT - 112;
    next.player.invulnerable = 1.5;
    next.mode = "playing";
    state = next;
    hideOverlay();
    startMusic();
    announce(`第 ${nextIndex + 1} 关 ${LEVELS[nextIndex].name} 开始`);
    updateHud(true);
    canvas.focus({ preventScroll: true });
  }

  function pauseGame(forcePause) {
    if (state.mode !== "playing" && state.mode !== "paused") return;
    const shouldPause = typeof forcePause === "boolean" ? forcePause : state.mode === "playing";
    if (shouldPause) {
      state.mode = "paused";
      pauseButton.textContent = "继续";
      stopMusic();
      setOverlay({
        kicker: "游戏暂停",
        title: "喘口气",
        copy: "进度保留在当前画面。按 P 或点击按钮继续。",
        button: "继续游戏",
        action: () => pauseGame(false),
      });
      announce("游戏已暂停");
    } else {
      state.mode = "playing";
      pauseButton.textContent = "暂停";
      hideOverlay();
      startMusic();
      announce("游戏继续");
      canvas.focus({ preventScroll: true });
    }
  }

  function showGameOver() {
    state.mode = "game-over";
    pauseButton.disabled = true;
    stopMusic();
    saveHighScore();
    sound("lose");
    setOverlay({
      kicker: "机体损毁",
      title: "任务失败",
      copy: `最终得分 ${String(state.score).padStart(6, "0")}。从第一关重新出发。`,
      button: "重新开始",
      action: () => startGame(0),
      allowStageSelect: true,
    });
    announce("游戏结束");
  }

  function showVictory() {
    state.mode = "victory";
    pauseButton.disabled = true;
    stopMusic();
    saveHighScore();
    sound("victory");
    setOverlay({
      kicker: "多布里岛解放",
      title: "五关完成",
      copy: `香料王已被击败，最终得分 ${String(state.score).padStart(6, "0")}。原版会回到第一关继续循环。`,
      button: "再玩一轮",
      action: () => startGame(0),
      allowStageSelect: true,
    });
    announce("五关全部完成");
  }

  function saveHighScore() {
    try {
      const previous = Number(localStorage.getItem("worker-bee-high-score") || 0);
      if (state.score > previous) localStorage.setItem("worker-bee-high-score", String(state.score));
    } catch (_error) {
    }
  }

  function createStagePicker() {
    LEVELS.forEach((level, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(index + 1);
      button.title = `${index + 1}. ${level.name} / ${level.bossName}`;
      button.setAttribute("aria-label", `从第 ${index + 1} 关 ${level.name} 开始`);
      button.addEventListener("click", () => startGame(index));
      stagePicker.append(button);
    });
  }

  function inputPressed(name) {
    switch (name) {
      case "left": return keys.has("ArrowLeft") || keys.has("KeyA") || touchInput.left;
      case "right": return keys.has("ArrowRight") || keys.has("KeyD") || touchInput.right;
      case "up": return keys.has("ArrowUp") || keys.has("KeyW") || touchInput.up;
      case "down": return keys.has("ArrowDown") || keys.has("KeyS") || touchInput.down;
      case "fire": return keys.has("Space") || keys.has("KeyJ") || keys.has("KeyZ") || touchInput.fire;
      case "bomb": return keys.has("KeyK") || keys.has("KeyX") || keys.has("KeyC") || touchInput.bomb;
      default: return false;
    }
  }

  function spawnWave(config, waveIndex) {
    const count = config.count;
    for (let index = 0; index < count; index += 1) {
      const position = formationPosition(config.formation, index, count);
      state.enemies.push({
        type: "enemy",
        kind: config.kind,
        pattern: config.formation,
        x: position.x,
        y: position.y,
        baseX: position.x,
        baseY: position.y,
        radius: enemyRadius(config.kind),
        hp: enemyHealth(config.kind),
        maxHp: enemyHealth(config.kind),
        speed: (config.fast ? 118 : 84) + state.stageIndex * 4,
        shoots: Boolean(config.shoots),
        fireClock: 0.8 + ((index * 7 + waveIndex * 3) % 9) * 0.17,
        t: -index * 0.08,
        phase: (index / Math.max(1, count)) * Math.PI * 2,
        direction: index % 2 === 0 ? 1 : -1,
        score: 180 + state.stageIndex * 30,
      });
    }
  }

  function formationPosition(formation, index, count) {
    const spread = WIDTH - 96;
    const lineX = 48 + (spread * (index + 0.5)) / count;
    const row = Math.floor(index / 6);
    const stagger = index % 6;

    switch (formation) {
      case "vee":
        return { x: WIDTH / 2 + (index - (count - 1) / 2) * 48, y: -36 - Math.abs(index - (count - 1) / 2) * 18 };
      case "column":
        return { x: WIDTH / 2 + (index % 2 ? 38 : -38), y: -34 - index * 34 };
      case "sides":
        return { x: index % 2 ? WIDTH + 24 : -24, y: -30 - Math.floor(index / 2) * 44 };
      case "cross":
        return { x: index % 2 ? WIDTH - 62 : 62, y: -40 - Math.floor(index / 2) * 48 };
      case "dive":
        return { x: lineX, y: -38 - (index % 3) * 34 };
      case "orbit":
        return { x: lineX, y: -40 - row * 42 };
      case "chase":
        return { x: lineX, y: -42 - stagger * 24 };
      default:
        return { x: lineX, y: -38 - row * 42 };
    }
  }

  function enemyRadius(kind) {
    if (kind.includes("dish") || kind.includes("bowl")) return 15;
    if (kind.includes("knife") || kind === "fork") return 11;
    if (kind.includes("elephant")) return 16;
    return 14;
  }

  function enemyHealth(kind) {
    if (kind === "purple-pot" || kind === "grabber" || kind === "neon-dish") return 3;
    if (kind === "blue-fighter" || kind === "white-dish") return 2;
    return 1;
  }

  function spawnCloud() {
    state.clouds.push({
      type: "cloud",
      x: 48 + Math.random() * (WIDTH - 96),
      y: -44,
      radius: 25,
      speed: 45,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  function spawnGroundTarget() {
    state.groundTargets.push({
      type: "ground",
      x: 52 + Math.random() * (WIDTH - 104),
      y: -38,
      radius: 18,
      hp: 1,
      fireClock: 1.6 + Math.random() * 1.8,
      kind: state.stageIndex % 2 ? "turret" : "bush",
    });
  }

  function spawnBoss() {
    const level = LEVELS[state.stageIndex];
    const health = 120 + state.stageIndex * 35;
    const boss = {
      type: "boss",
      kind: level.bossKind,
      x: WIDTH / 2,
      y: -110,
      baseX: WIDTH / 2,
      radius: 52 + state.stageIndex * 2,
      hp: health,
      maxHp: health,
      shield: level.bossKind === "onion-head" ? 18 : 0,
      maxShield: level.bossKind === "onion-head" ? 18 : 0,
      shieldClock: 5,
      fireClock: 1.4,
      summonClock: 3.4,
      t: 0,
      score: 5000 + state.stageIndex * 1500,
      shoots: true,
    };
    state.enemies.push(boss);
    state.boss = boss;
    state.bossSpawned = true;
    sound("boss");
    announce(`Boss ${level.bossName} 出现`);
  }

  function spawnBossMinion(kind, x, y, direction) {
    state.enemies.push({
      type: "enemy",
      kind,
      pattern: "boss-minion",
      x,
      y,
      baseX: x,
      baseY: y,
      radius: enemyRadius(kind),
      hp: kind === "pink-bowl" ? 2 : 1,
      maxHp: kind === "pink-bowl" ? 2 : 1,
      speed: 110,
      shoots: kind !== "blue-elephant",
      fireClock: 1.2,
      t: 0,
      phase: direction > 0 ? 0 : Math.PI,
      direction,
      score: 220,
    });
  }

  function shootPlayerWeapon() {
    const player = state.player;
    const origins = player.twinShot ? [-7, 7] : [0];
    if (player.mirrors) origins.push(-25, 25);
    const spread = player.spreadTimer > 0 ? [-0.2, 0, 0.2] : [0];

    origins.forEach((offsetX) => {
      spread.forEach((angle) => {
        state.playerShots.push({
          type: "player-shot",
          x: player.x + offsetX,
          y: player.y - 22,
          vx: Math.sin(angle) * 430,
          vy: -Math.cos(angle) * 560,
          radius: 4,
          damage: 1,
        });
      });
    });
    player.shotCooldown = player.speedLevel >= 3 ? 0.085 : 0.13;
    sound("shot");
  }

  function throwBomb() {
    const player = state.player;
    if (!player.arms.left && !player.arms.right) {
      announce("没有手臂，无法投弹");
      player.bombCooldown = 0.4;
      return;
    }

    state.bombs.push({
      type: "bomb",
      x: player.x,
      y: player.y - 12,
      startX: player.x,
      startY: player.y - 12,
      targetX: clamp(player.x, 36, WIDTH - 36),
      targetY: clamp(player.y - 176, 70, HEIGHT - 80),
      radius: 8,
      t: 0,
      duration: 0.46,
    });
    player.bombCooldown = 0.62;
    sound("bomb");
  }

  function update(dt) {
    const level = LEVELS[state.stageIndex];
    const player = state.player;
    state.stageTime += dt;
    state.scroll += dt * (54 + state.stageIndex * 4);
    state.stageBanner = Math.max(0, state.stageBanner - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.shotCooldown = Math.max(0, player.shotCooldown - dt);
    player.bombCooldown = Math.max(0, player.bombCooldown - dt);
    player.spreadTimer = Math.max(0, (player.spreadTimer || 0) - dt);

    updatePlayer(dt);
    updateSpawns(level);
    updateEntities(dt);
    resolveCollisions();
    removeExpired();
    updateExtraLives();

    hudClock += dt;
    if (hudClock > 0.1 || state.hudDirty) {
      hudClock = 0;
      updateHud();
      state.hudDirty = false;
    }
  }

  function updatePlayer(dt) {
    const player = state.player;
    let dx = Number(inputPressed("right")) - Number(inputPressed("left"));
    let dy = Number(inputPressed("down")) - Number(inputPressed("up"));

    if (pointer.active) {
      const pointerDx = pointer.x - player.x;
      const pointerDy = pointer.y - player.y;
      dx += clamp(pointerDx / 36, -1, 1);
      dy += clamp(pointerDy / 36, -1, 1);
    }

    if (dx || dy) {
      const length = Math.hypot(dx, dy) || 1;
      const speed = 215 + player.speedLevel * 28;
      player.x = clamp(player.x + (dx / length) * speed * dt, 24, WIDTH - 24);
      player.y = clamp(player.y + (dy / length) * speed * dt, 88, HEIGHT - 42);
    }

    if (inputPressed("fire") && player.shotCooldown <= 0) shootPlayerWeapon();
    if (inputPressed("bomb") && player.bombCooldown <= 0) throwBomb();
  }

  function updateSpawns(level) {
    level.waves.forEach((config, index) => {
      if (!state.spawnedWaves.has(index) && state.stageTime >= config.at) {
        state.spawnedWaves.add(index);
        spawnWave(config, index);
      }
    });

    if (!state.bossSpawned && state.stageTime >= level.duration) spawnBoss();

    if (!state.bossSpawned && state.stageTime >= state.nextCloud) {
      spawnCloud();
      state.nextCloud += 4.4 + Math.random() * 1.4;
    }

    if (!state.bossSpawned && state.stageTime >= state.nextGroundTarget) {
      spawnGroundTarget();
      state.nextGroundTarget += 5.1 + Math.random() * 1.8;
    }
  }

  function updateEntities(dt) {
    state.playerShots.forEach((shot) => {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
    });

    state.enemyShots.forEach((shot) => {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.t = (shot.t || 0) + dt;
      if (shot.curve) shot.vx += Math.sin(shot.t * 5) * shot.curve * dt;
    });

    state.clouds.forEach((cloud) => {
      cloud.y += cloud.speed * dt;
      cloud.wobble += dt;
      cloud.x += Math.sin(cloud.wobble * 1.8) * 8 * dt;
    });

    state.groundTargets.forEach((target) => {
      target.y += (54 + state.stageIndex * 4) * dt;
      target.fireClock -= dt;
      if (target.fireClock <= 0 && target.y > 40 && target.y < HEIGHT - 100) {
        fireAimedShot(target.x, target.y, 142 + state.stageIndex * 12, "ground");
        target.fireClock = 2.1 + Math.random() * 1.8;
      }
    });

    state.bombs.forEach((bomb) => {
      bomb.t += dt;
      const progress = clamp(bomb.t / bomb.duration, 0, 1);
      bomb.x = bomb.startX + (bomb.targetX - bomb.startX) * progress;
      bomb.y = bomb.startY + (bomb.targetY - bomb.startY) * progress;
      bomb.z = Math.sin(progress * Math.PI) * 42;
      if (progress >= 1 && !bomb.exploded) explodeBomb(bomb);
    });

    state.pickups.forEach((pickup) => {
      pickup.t = (pickup.t || 0) + dt;
      if (pickup.kind === "ambulance") {
        pickup.y += 92 * dt;
        pickup.x += Math.sin(pickup.t * 3) * 24 * dt;
      } else {
        pickup.y += (pickup.kind === "bell" ? 58 : 72) * dt;
        pickup.x += Math.sin(pickup.t * 2.7 + pickup.phase) * 24 * dt;
      }
    });

    state.enemies.forEach((enemy) => {
      if (enemy.type === "boss") updateBoss(enemy, dt);
      else updateEnemy(enemy, dt);
    });

    state.particles.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 40 * dt;
    });
  }

  function updateEnemy(enemy, dt) {
    enemy.t += dt;
    const player = state.player;
    const speed = enemy.speed;

    switch (enemy.pattern) {
      case "sine":
        enemy.y += speed * dt;
        enemy.x = enemy.baseX + Math.sin(enemy.t * 3.2 + enemy.phase) * 62;
        break;
      case "sides":
        enemy.y += speed * 0.78 * dt;
        enemy.x += enemy.direction * speed * 0.58 * dt;
        if (enemy.x < 40 || enemy.x > WIDTH - 40) enemy.direction *= -1;
        break;
      case "cross":
        enemy.y += speed * dt;
        enemy.x += (WIDTH / 2 - enemy.x) * dt * 0.9;
        break;
      case "dive":
        enemy.y += speed * 1.12 * dt;
        enemy.x += Math.sin(enemy.t * 4 + enemy.phase) * speed * 0.35 * dt;
        break;
      case "orbit":
        if (enemy.y < 150) enemy.y += speed * dt;
        else {
          enemy.x = enemy.baseX + Math.sin(enemy.t * 2.1 + enemy.phase) * 72;
          enemy.y += speed * 0.22 * dt;
        }
        break;
      case "chase":
        enemy.y += speed * 0.72 * dt;
        enemy.x += clamp(player.x - enemy.x, -90, 90) * dt * 0.7;
        break;
      case "zigzag":
        enemy.y += speed * dt;
        enemy.x += enemy.direction * speed * 0.9 * dt;
        if (enemy.x < 32 || enemy.x > WIDTH - 32) enemy.direction *= -1;
        break;
      case "hang":
        if (enemy.y < 135) enemy.y += speed * dt;
        else enemy.x = enemy.baseX + Math.sin(enemy.t * 1.8 + enemy.phase) * 48;
        break;
      case "boss-minion":
        enemy.y += speed * dt;
        enemy.x += Math.sin(enemy.t * 4 + enemy.phase) * 74 * dt;
        if (enemy.kind === "blue-elephant" && enemy.y > 145) {
          enemy.kind = "pink-bowl";
          enemy.pattern = "chase";
          enemy.shoots = true;
          enemy.hp = 2;
        }
        break;
      default:
        enemy.y += speed * dt;
        enemy.x = enemy.baseX + Math.sin(enemy.t * 2.3 + enemy.phase) * 28;
        break;
    }

    enemy.x = clamp(enemy.x, -30, WIDTH + 30);
    enemy.fireClock -= dt;
    if (enemy.shoots && enemy.fireClock <= 0 && enemy.y > 20 && enemy.y < HEIGHT * 0.72) {
      fireAimedShot(enemy.x, enemy.y, 160 + state.stageIndex * 14, "enemy");
      enemy.fireClock = 1.4 + Math.random() * 1.6 - state.stageIndex * 0.08;
    }
  }

  function updateBoss(boss, dt) {
    boss.t += dt;
    if (boss.y < 116) {
      boss.y += 82 * dt;
      return;
    }

    const amplitude = boss.kind === "claw-device" ? 145 : 118;
    const frequency = boss.kind === "king-spice" ? 0.72 : 0.9;
    boss.x = WIDTH / 2 + Math.sin(boss.t * frequency) * amplitude;
    boss.fireClock -= dt;
    boss.summonClock -= dt;

    if (boss.kind === "onion-head") {
      boss.shieldClock -= dt;
      if (boss.shield <= 0 && boss.shieldClock <= 0) {
        boss.shield = boss.maxShield;
        boss.shieldClock = 6;
      }
    }

    if (boss.fireClock <= 0) {
      switch (boss.kind) {
        case "onion-head":
          fireFan(boss.x, boss.y + 24, 3, Math.PI / 3, 176);
          boss.fireClock = 1.1;
          break;
        case "parallel-dish":
          fireRadial(boss.x, boss.y, 10, 132, boss.t * 0.35);
          boss.fireClock = 1.55;
          break;
        case "tiger-shark":
          fireFan(boss.x, boss.y + 24, 5, Math.PI / 2.5, 192);
          boss.fireClock = 1.2;
          break;
        case "claw-device":
          fireFan(boss.x, boss.y + 30, 7, Math.PI * 0.82, 184, 32);
          boss.fireClock = 1.35;
          break;
        case "king-spice":
          fireRadial(boss.x, boss.y, 12, 152, boss.t * 0.5);
          fireAimedShot(boss.x, boss.y + 24, 228, "boss");
          boss.fireClock = 1.5;
          break;
        default:
          boss.fireClock = 1.5;
      }
    }

    if (boss.summonClock <= 0) {
      if (boss.kind === "tiger-shark") {
        spawnBossMinion("green-ship", boss.x - 54, boss.y + 14, -1);
        spawnBossMinion("green-ship", boss.x + 54, boss.y + 14, 1);
      } else if (boss.kind === "king-spice") {
        spawnBossMinion("blue-elephant", boss.x - 48, boss.y + 22, -1);
        spawnBossMinion("blue-elephant", boss.x + 48, boss.y + 22, 1);
      }
      boss.summonClock = boss.kind === "king-spice" ? 2.5 : 3.4;
    }
  }

  function fireAimedShot(x, y, speed, kind) {
    const dx = state.player.x - x;
    const dy = state.player.y - y;
    const length = Math.hypot(dx, dy) || 1;
    state.enemyShots.push({
      type: "enemy-shot",
      x,
      y,
      vx: (dx / length) * speed,
      vy: (dy / length) * speed,
      radius: kind === "boss" ? 7 : 5,
      kind,
    });
  }

  function fireFan(x, y, count, spread, speed, curve = 0) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI / 2 - spread / 2 + (spread * index) / Math.max(1, count - 1);
      state.enemyShots.push({
        type: "enemy-shot",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 6,
        kind: "boss",
        curve: index % 2 ? curve : -curve,
      });
    }
  }

  function fireRadial(x, y, count, speed, offset) {
    for (let index = 0; index < count; index += 1) {
      const angle = offset + (Math.PI * 2 * index) / count;
      state.enemyShots.push({
        type: "enemy-shot",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 6,
        kind: "boss",
      });
    }
  }

  function explodeBomb(bomb) {
    bomb.exploded = true;
    burst(bomb.x, bomb.y, "#ffd447", 18);
    sound("explode");
    state.groundTargets.forEach((target) => {
      if (!target.dead && circleHit({ ...bomb, radius: 52 }, target)) {
        target.dead = true;
        state.score += 320;
        spawnGroundPickup(target.x, target.y);
      }
    });
  }

  function spawnGroundPickup(x, y) {
    const roll = Math.random();
    const kind = roll < 0.16 ? "star" : roll < 0.36 ? "spread" : "fruit";
    state.pickups.push({ type: "pickup", kind, x, y, radius: 14, phase: Math.random() * 5, t: 0 });
  }

  function resolveCollisions() {
    const consumedShots = new Set();

    state.playerShots.forEach((shot) => {
      if (consumedShots.has(shot)) return;

      const cloud = state.clouds.find((candidate) => !candidate.dead && circleHit(shot, candidate));
      if (cloud) {
        cloud.dead = true;
        consumedShots.add(shot);
        state.pickups.push({
          type: "pickup",
          kind: "bell",
          x: cloud.x,
          y: cloud.y,
          radius: 15,
          hits: 0,
          color: "yellow",
          phase: Math.random() * 5,
          t: 0,
        });
        burst(cloud.x, cloud.y, "#f6fbff", 10);
        return;
      }

      const bell = state.pickups.find((candidate) => candidate.kind === "bell" && !candidate.dead && circleHit(shot, candidate));
      if (bell) {
        bell.hits += 1;
        bell.color = bellColorForHits(bell.hits);
        bell.y -= 26;
        bell.t = 0;
        consumedShots.add(shot);
        sound("bell-hit", bell.hits);
        return;
      }

      const enemy = state.enemies.find((candidate) => !candidate.dead && circleHit(shot, candidate, -2));
      if (enemy) {
        consumedShots.add(shot);
        hitEnemy(enemy, shot.damage);
      }
    });

    state.playerShots.forEach((shot) => {
      if (consumedShots.has(shot)) shot.dead = true;
    });

    state.enemyShots.forEach((shot) => {
      if (!shot.dead && circleHit(shot, state.player, -4)) {
        shot.dead = true;
        hitPlayer(shot.x - state.player.x);
      }
    });

    state.enemies.forEach((enemy) => {
      if (!enemy.dead && circleHit(enemy, state.player, -8)) {
        enemy.dead = enemy.type !== "boss";
        hitPlayer(enemy.x - state.player.x, true);
      }
    });

    state.pickups.forEach((pickup) => {
      if (!pickup.dead && circleHit(pickup, state.player, 2)) collectPickup(pickup);
    });
  }

  function hitEnemy(enemy, damage) {
    if (enemy.type === "boss" && enemy.shield > 0) {
      enemy.shield = Math.max(0, enemy.shield - damage);
      enemy.shieldClock = 5;
      burst(enemy.x, enemy.y, "#d8f7ff", 3);
      sound("shield");
      return;
    }

    enemy.hp -= damage;
    burst(enemy.x, enemy.y, "#ffffff", enemy.type === "boss" ? 2 : 4);
    if (enemy.hp <= 0) {
      enemy.dead = true;
      state.score += enemy.score;
      burst(enemy.x, enemy.y, enemy.type === "boss" ? "#ffd447" : "#ff7b72", enemy.type === "boss" ? 36 : 12);
      sound(enemy.type === "boss" ? "boss-down" : "enemy-down");
      if (enemy.type === "boss") completeStage();
    }
  }

  function completeStage() {
    state.enemyShots.forEach((shot) => { shot.dead = true; });
    state.mode = "stage-clear";
    stopMusic();
    sound("stage-clear");
    const level = LEVELS[state.stageIndex];
    setOverlay({
      kicker: `第 ${state.stageIndex + 1} 关完成`,
      title: `${level.bossName} 击破`,
      copy: state.stageIndex === LEVELS.length - 1 ? "香料王的占领结束了。" : `下一站：${LEVELS[state.stageIndex + 1].name}。装备和生命会保留。`,
      button: state.stageIndex === LEVELS.length - 1 ? "查看结局" : "进入下一关",
      action: advanceStage,
    });
    announce(`第 ${state.stageIndex + 1} 关完成`);
  }

  function hitPlayer(horizontalOffset, collision = false) {
    const player = state.player;
    if (player.invulnerable > 0 || state.mode !== "playing") return;

    if (player.shield > 0) {
      player.shield -= 1;
      player.invulnerable = 0.35;
      burst(player.x, player.y, "#55e3ff", 12);
      sound("shield");
      state.hudDirty = true;
      return;
    }

    const sideHit = !collision && Math.abs(horizontalOffset) > 7;
    if (sideHit && horizontalOffset < 0 && player.arms.left) {
      player.arms.left = false;
      damageArm("左");
      return;
    }
    if (sideHit && horizontalOffset > 0 && player.arms.right) {
      player.arms.right = false;
      damageArm("右");
      return;
    }

    loseLife();
  }

  function damageArm(side) {
    const player = state.player;
    player.invulnerable = 0.75;
    damageVignette.classList.add("is-hit");
    setTimeout(() => damageVignette.classList.remove("is-hit"), 160);
    burst(player.x, player.y, "#ff7b72", 16);
    sound("hurt");
    announce(`${side}手臂受损`);
    state.hudDirty = true;

    if (!player.arms.left && !player.arms.right && !player.ambulanceUsed) {
      player.ambulanceUsed = true;
      state.pickups.push({
        type: "pickup",
        kind: "ambulance",
        x: WIDTH / 2,
        y: -50,
        radius: 22,
        t: 0,
        phase: 0,
      });
      announce("救护机出动，接住它修复手臂");
    }
  }

  function loseLife() {
    const lives = state.player.lives - 1;
    damageVignette.classList.add("is-hit");
    setTimeout(() => damageVignette.classList.remove("is-hit"), 220);
    burst(state.player.x, state.player.y, "#ff7b72", 28);
    sound("life-lost");

    if (lives <= 0) {
      state.player.lives = 0;
      updateHud(true);
      showGameOver();
      return;
    }

    const replacement = createPlayer();
    replacement.lives = lives;
    replacement.invulnerable = 2.4;
    state.player = replacement;
    state.enemyShots.forEach((shot) => { shot.dead = true; });
    announce(`损失一架，剩余 ${lives} 架`);
    state.hudDirty = true;
  }

  function collectPickup(pickup) {
    pickup.dead = true;
    const player = state.player;

    if (pickup.kind === "bell") {
      if (pickup.color === "yellow") {
        const rewards = [500, 1000, 2500, 5000, 10000];
        state.score += rewards[clamp(state.bellChain, 0, rewards.length - 1)];
        state.bellChain += 1;
      } else {
        applyBell(player, pickup.color);
        state.score += 600;
      }
      sound("bell-collect", pickup.hits);
      announce(`获得${bellName(pickup.color)}`);
    } else if (pickup.kind === "ambulance") {
      player.arms.left = true;
      player.arms.right = true;
      state.score += 1000;
      sound("repair");
      announce("手臂已修复");
    } else if (pickup.kind === "spread") {
      player.spreadTimer = 16;
      state.score += 500;
      sound("power");
      announce("三向散射已启动");
    } else if (pickup.kind === "star") {
      state.enemies.forEach((enemy) => {
        if (enemy.type !== "boss") enemy.dead = true;
      });
      state.enemyShots.forEach((shot) => { shot.dead = true; });
      state.score += 800;
      sound("power");
      announce("清屏星发动");
    } else {
      state.score += 200;
      sound("pickup");
      announce("获得水果奖励");
    }
    state.hudDirty = true;
  }

  function bellName(color) {
    return {
      yellow: "黄色铃铛",
      blue: "蓝铃速度强化",
      white: "白铃双炮",
      green: "绿铃分身",
      red: "红铃护盾",
    }[color];
  }

  function updateExtraLives() {
    if (state.score >= state.nextExtraLife) {
      state.player.lives += 1;
      state.nextExtraLife = state.nextExtraLife === 30000 ? 120000 : Number.POSITIVE_INFINITY;
      sound("extra-life");
      announce("奖励一架工蜂");
      state.hudDirty = true;
    }
  }

  function removeExpired() {
    state.playerShots = state.playerShots.filter((shot) => !shot.dead && shot.y > -30 && shot.x > -30 && shot.x < WIDTH + 30);
    state.enemyShots = state.enemyShots.filter((shot) => !shot.dead && shot.y > -40 && shot.y < HEIGHT + 40 && shot.x > -40 && shot.x < WIDTH + 40);
    state.bombs = state.bombs.filter((bomb) => !bomb.exploded);
    state.clouds = state.clouds.filter((cloud) => !cloud.dead && cloud.y < HEIGHT + 50);
    state.groundTargets = state.groundTargets.filter((target) => !target.dead && target.y < HEIGHT + 50);
    state.pickups.forEach((pickup) => {
      if (pickup.y > HEIGHT + 40 && pickup.kind === "bell" && pickup.color === "yellow") state.bellChain = 0;
    });
    state.pickups = state.pickups.filter((pickup) => !pickup.dead && pickup.y < HEIGHT + 60);
    state.enemies = state.enemies.filter((enemy) => !enemy.dead && enemy.y < HEIGHT + 90);
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function burst(x, y, color, count) {
    const actualCount = reducedMotion ? Math.ceil(count / 3) : count;
    for (let index = 0; index < actualCount; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 150;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 4,
        life: 0.25 + Math.random() * 0.55,
        maxLife: 0.8,
        color,
      });
    }
  }

  function updateHud(force = false) {
    if (!force && !state.hudDirty && hudClock < 0.1) return;
    scoreValue.textContent = String(state.score).padStart(6, "0");
    stageValue.textContent = `${state.stageIndex + 1} / ${LEVELS.length}`;
    livesValue.textContent = String(state.player.lives);
    const armText = `${state.player.arms.left ? "左" : "×"}${state.player.arms.right ? "右" : "×"}`;
    powerValue.textContent = `${powerLabel(state.player)} / 手臂 ${armText}`;
  }

  function resizeCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    worldRenderer.resize(ratio);
    canvas.width = WIDTH * ratio;
    canvas.height = HEIGHT * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function draw() {
    const level = LEVELS[state.stageIndex];
    worldRenderer.render(state, level, performance.now() / 1000, reducedMotion);
    context.clearRect(0, 0, WIDTH, HEIGHT);
    drawBossBar();
    drawStageBanner(level);
  }

  function drawBossBar() {
    const boss = state.boss;
    if (!boss || boss.dead || boss.y < -50) return;
    const width = 300;
    const x = (WIDTH - width) / 2;
    context.save();
    context.fillStyle = "rgba(7,11,20,.78)";
    roundedRect(x - 8, 18, width + 16, 34, 10);
    context.fill();
    context.fillStyle = "#f7fbff";
    context.font = "700 11px ui-monospace, monospace";
    context.textAlign = "center";
    context.fillText(LEVELS[state.stageIndex].bossName, WIDTH / 2, 31);
    context.fillStyle = "#46264f";
    roundedRect(x, 37, width, 7, 4);
    context.fill();
    context.fillStyle = "#ff567d";
    roundedRect(x, 37, width * clamp(boss.hp / boss.maxHp, 0, 1), 7, 4);
    context.fill();
    context.restore();
  }

  function drawStageBanner(level) {
    if (state.stageBanner <= 0 || state.mode !== "playing") return;
    const alpha = clamp(state.stageBanner < 0.5 ? state.stageBanner * 2 : (2.4 - state.stageBanner) * 2, 0, 1);
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = "rgba(7,11,20,.76)";
    roundedRect(58, HEIGHT / 2 - 66, WIDTH - 116, 132, 18);
    context.fill();
    context.fillStyle = "#ffd447";
    context.font = "800 14px ui-monospace, monospace";
    context.textAlign = "center";
    context.fillText(`第 ${state.stageIndex + 1} 关`, WIDTH / 2, HEIGHT / 2 - 22);
    context.fillStyle = "#f7fbff";
    context.font = "900 30px ui-monospace, monospace";
    context.fillText(level.name, WIDTH / 2, HEIGHT / 2 + 22);
    context.restore();
  }

  function roundedRect(x, y, width, height, radius) {
    const actual = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + actual, y);
    context.lineTo(x + width - actual, y);
    context.quadraticCurveTo(x + width, y, x + width, y + actual);
    context.lineTo(x + width, y + height - actual);
    context.quadraticCurveTo(x + width, y + height, x + width - actual, y + height);
    context.lineTo(x + actual, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - actual);
    context.lineTo(x, y + actual);
    context.quadraticCurveTo(x, y, x + actual, y);
    context.closePath();
  }

  function unlockAudio() {
    if (!soundEnabled) return;
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
  }

  function beep(frequency, duration, type = "square", volume = 0.035, delay = 0) {
    if (!soundEnabled) return;
    unlockAudio();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function sound(name, value = 0) {
    if (!soundEnabled) return;
    const sounds = {
      shot: () => beep(640, 0.04, "square", 0.018),
      bomb: () => beep(180, 0.12, "triangle", 0.035),
      explode: () => { beep(95, 0.18, "sawtooth", 0.05); beep(64, 0.22, "square", 0.025, 0.03); },
      "enemy-down": () => beep(230, 0.07, "square", 0.022),
      "bell-hit": () => beep(520 + (value % 5) * 70, 0.07, "sine", 0.032),
      "bell-collect": () => { beep(660, 0.09, "square", 0.035); beep(880, 0.12, "square", 0.03, 0.07); },
      shield: () => beep(980, 0.09, "sine", 0.04),
      hurt: () => beep(120, 0.2, "sawtooth", 0.05),
      "life-lost": () => { beep(220, 0.18, "sawtooth", 0.05); beep(110, 0.35, "sawtooth", 0.04, 0.13); },
      repair: () => { beep(440, 0.1, "square", 0.035); beep(660, 0.14, "square", 0.035, 0.1); },
      power: () => { beep(520, 0.08, "square", 0.03); beep(780, 0.14, "square", 0.03, 0.08); },
      pickup: () => beep(740, 0.08, "sine", 0.03),
      "extra-life": () => [0, 1, 2, 3].forEach((index) => beep(440 + index * 110, 0.12, "square", 0.035, index * 0.09)),
      boss: () => { beep(110, 0.45, "sawtooth", 0.04); beep(165, 0.3, "square", 0.03, 0.2); },
      "boss-down": () => [0, 1, 2].forEach((index) => beep(120 - index * 20, 0.35, "sawtooth", 0.05, index * 0.18)),
      "stage-clear": () => [0, 1, 2, 3].forEach((index) => beep([523, 659, 784, 1046][index], 0.18, "square", 0.035, index * 0.12)),
      victory: () => [0, 1, 2, 3, 4, 5].forEach((index) => beep([523, 659, 784, 1046, 784, 1046][index], 0.22, "square", 0.04, index * 0.13)),
      lose: () => { beep(196, 0.25, "triangle", 0.04); beep(130, 0.5, "triangle", 0.04, 0.2); },
    };
    if (sounds[name]) sounds[name]();
  }

  function startMusic() {
    stopMusic();
    if (!soundEnabled || state.mode !== "playing") return;
    const sequences = [
      [262, 330, 392, 523, 392, 330, 294, 392],
      [294, 370, 440, 587, 440, 370, 330, 440],
      [220, 277, 330, 440, 330, 277, 247, 330],
      [247, 311, 370, 494, 370, 311, 277, 370],
      [196, 247, 294, 392, 294, 247, 220, 330],
    ];
    musicStep = 0;
    musicTimer = window.setInterval(() => {
      if (state.mode !== "playing" || !soundEnabled) return;
      const sequence = sequences[state.stageIndex];
      beep(sequence[musicStep % sequence.length], 0.11, "triangle", 0.012);
      if (musicStep % 2 === 0) beep(sequence[(musicStep + 3) % sequence.length] / 2, 0.16, "square", 0.006);
      musicStep += 1;
    }, 240);
  }

  function stopMusic() {
    if (musicTimer !== null) window.clearInterval(musicTimer);
    musicTimer = null;
  }

  function animationFrame(now) {
    const elapsed = Math.min((now - previousTime) / 1000, 0.05);
    previousTime = now;
    if (state.mode === "playing") {
      accumulator += elapsed;
      while (accumulator >= FIXED_STEP) {
        update(FIXED_STEP);
        accumulator -= FIXED_STEP;
      }
    } else {
      accumulator = 0;
    }
    draw();
    requestAnimationFrame(animationFrame);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  window.addEventListener("keydown", (event) => {
    const gameKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyA", "KeyS", "KeyD", "KeyJ", "KeyK", "KeyZ", "KeyX", "KeyC", "KeyP"];
    if (gameKeys.includes(event.code)) event.preventDefault();
    if (event.code === "KeyP" || event.code === "Escape") {
      if (!event.repeat) pauseGame();
      return;
    }
    keys.add(event.code);
  });

  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => {
    keys.clear();
    Object.keys(touchInput).forEach((key) => { touchInput[key] = false; });
    if (state.mode === "playing") pauseGame(true);
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (state.mode !== "playing") return;
    pointer.active = true;
    Object.assign(pointer, pointerPosition(event));
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointer.active) return;
    Object.assign(pointer, pointerPosition(event));
  });

  canvas.addEventListener("pointerup", (event) => {
    pointer.active = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointercancel", () => { pointer.active = false; });

  document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    const press = (event) => {
      event.preventDefault();
      touchInput[control] = true;
      button.classList.add("is-pressed");
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
    };
    const release = (event) => {
      touchInput[control] = false;
      button.classList.remove("is-pressed");
      if (button.hasPointerCapture && button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", (event) => {
      if (event.buttons === 0) release(event);
    });
  });

  startButton.addEventListener("click", () => overlayAction());
  stageSelectButton.addEventListener("click", () => {
    stagePicker.hidden = !stagePicker.hidden;
    if (!stagePicker.hidden) stagePicker.querySelector("button").focus();
  });
  pauseButton.addEventListener("click", () => pauseGame());
  soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    soundButton.textContent = `声音：${soundEnabled ? "开" : "关"}`;
    soundButton.setAttribute("aria-pressed", String(soundEnabled));
    if (soundEnabled) {
      unlockAudio();
      startMusic();
      sound("pickup");
    } else {
      stopMusic();
    }
  });

  window.addEventListener("resize", resizeCanvas);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.mode === "playing") pauseGame(true);
  });

  window.workerBeeDebug = {
    renderInfo: () => worldRenderer.info(),
    start: (stage = 0) => startGame(clamp(stage, 0, LEVELS.length - 1)),
    snapshot: () => ({
      mode: state.mode,
      stageIndex: state.stageIndex,
      score: state.score,
      lives: state.player.lives,
      player: { x: Math.round(state.player.x), y: Math.round(state.player.y) },
      enemies: state.enemies.length,
      playerShots: state.playerShots.length,
      bombs: state.bombs.length,
      boss: state.boss ? { hp: state.boss.hp, maxHp: state.boss.maxHp } : null,
      arms: { ...state.player.arms },
    }),
    spawnBoss: () => {
      if (!state.bossSpawned) spawnBoss();
    },
    defeatBoss: () => {
      if (!state.bossSpawned) spawnBoss();
      if (state.boss) {
        state.boss.shield = 0;
        hitEnemy(state.boss, state.boss.hp);
      }
    },
  };

  createStagePicker();
  resizeCanvas();
  updateHud(true);
  requestAnimationFrame(animationFrame);
})();
