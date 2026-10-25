(function bootTwinBee() {
  'use strict';
  const C = window.WorkerBeeCore, E = window.WorkerBeeEngine;
  const { WIDTH, HEIGHT, LEVELS, clamp, powerLabel } = C;
  const $ = selector => document.querySelector(selector);
  const canvas = $('#game-canvas'), context = canvas.getContext('2d');
  const worldRenderer = window.WorkerBeeFC.createRenderer($('#world-canvas'), WIDTH, HEIGHT);
  const overlay = $('#game-overlay'), startButton = $('#start-button');
  const twoPlayerButton = $('#two-player-button'), stagePicker = $('#stage-picker');
  const stageSelectButton = $('#stage-select-button'), pauseButton = $('#pause-button'), soundButton = $('#sound-button');
  const keys = new Set(), touches = new Map();
  const pointer = { active: false, x: WIDTH / 2, y: HEIGHT - 64 };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let assistSettings = { mode: 'classic', health: 10 };
  let bindings = { fire: 'Space', bomb: 'KeyF' };
  let capturing = null;
  const reservedKeys = new Set(['KeyW','KeyA','KeyS','KeyD','KeyP','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Comma','Period','Enter']);
  function allowedBinding(code) { return /^(Key[A-Z]|Digit[0-9]|Space)$/.test(code) && !reservedKeys.has(code); }
  try {
    const saved = JSON.parse(localStorage.getItem('twinbee-fc-bindings') || 'null');
    if (saved && allowedBinding(saved.fire) && allowedBinding(saved.bomb) && saved.fire !== saved.bomb) bindings = saved;
  } catch (_) {}
  let state = E.start(0, 1, assistSettings); state.mode = 'ready';
  let overlayAction = () => startGame(0, 1), previousMode = 'ready', pausedMode = 'playing';
  let previousTime = performance.now(), accumulator = 0, hudClock = 0;
  let audioContext = null, musicTimer = null, soundEnabled = true, musicStep = 0;
  const testMode = new URLSearchParams(location.search).has('debug');
  let manualClock = false;

  function announce(message) { if (message) { $('#live-status').textContent = message; state.message = message; } }
  function clearInput() {
    keys.clear(); touches.clear(); pointer.active = false;
    document.querySelectorAll('[data-control]').forEach(button => button.classList.remove('is-pressed'));
  }
  function setOverlay(title, copy, label, action, allowStart = false) {
    $('#overlay-title').textContent = title; $('#overlay-copy').textContent = copy;
    $('#overlay-kicker').textContent = state.mode === 'paused' ? 'PAUSE' : 'TWINBEE · FC';
    startButton.textContent = label; overlayAction = action;
    twoPlayerButton.hidden = !allowStart; stageSelectButton.hidden = !allowStart; stagePicker.hidden = true;
    overlay.classList.add('overlay--visible');
  }
  function hideOverlay() { overlay.classList.remove('overlay--visible'); }
  function startGame(stage = 0, players = 1) {
    clearInput(); state = E.start(stage, players, assistSettings); previousMode = state.mode;
    accumulator = 0; previousTime = performance.now(); pauseButton.disabled = false; pauseButton.textContent = '暂停';
    hideOverlay(); unlockAudio(); startMusic(); updateHud();
    announce(`${players === 2 ? '双人' : '单人'} · 第 ${state.stageNumber} 关开始`);
    canvas.focus({ preventScroll: true });
  }
  function pauseGame(forcePause) {
    if (!['playing', 'stage-clear', 'paused'].includes(state.mode)) return;
    const pause = typeof forcePause === 'boolean' ? forcePause : state.mode !== 'paused';
    clearInput(); accumulator = 0;
    if (pause) {
      if (state.mode !== 'paused') pausedMode = state.mode;
      state.mode = 'paused'; pauseButton.textContent = '继续'; stopMusic();
      setOverlay('暂停', '按 P / Esc 或点击继续。当前关卡、装备和分数保留。', '继续游戏', () => pauseGame(false));
      announce('游戏已暂停');
    } else {
      state.mode = pausedMode; pauseButton.textContent = '暂停'; hideOverlay(); startMusic();
      previousTime = performance.now(); announce('游戏继续'); canvas.focus({ preventScroll: true });
    }
    previousMode = state.mode;
  }
  function saveHighScore() {
    try {
      const high = Math.max(...state.players.map(p => p.score), Number(localStorage.getItem(`twinbee-fc-high-score-${state.assist.mode}`)) || 0);
      localStorage.setItem(`twinbee-fc-high-score-${state.assist.mode}`, String(high));
    } catch (_) { /* Storage is optional for local-file play. */ }
  }
  function reactToState() {
    for (const event of state.events.splice(0)) {
      sound(event.type, event.value); if (event.text) announce(event.text);
      if (event.type === 'next-stage') startMusic();
      if (event.type === 'life-lost' && !reducedMotion) {
        $('#damage-vignette').classList.add('is-hit');
        setTimeout(() => $('#damage-vignette').classList.remove('is-hit'), 180);
      }
    }
    if (state.mode !== previousMode) {
      if (state.mode === 'game-over') {
        stopMusic(); saveHighScore(); pauseButton.disabled = true;
        const scores = state.players.map(p => `${p.id + 1}P ${p.score.toLocaleString()} 分`).join(' · ');
        setOverlay('游戏结束', scores, '重新开始', () => startGame(0, state.playerCount), true);
      } else if (state.mode === 'stage-clear') {
        stopMusic(); announce(`第 ${state.stageNumber} 关完成，自动进入下一关`);
      }
      previousMode = state.mode;
      updateHud();
    }
  }
  function pressed(control) { return [...touches.values()].includes(control); }
  function input(index) {
    const is = (...codes) => codes.some(code => keys.has(code));
    if (index === 1) return {
      left: is('ArrowLeft'), right: is('ArrowRight'), up: is('ArrowUp'), down: is('ArrowDown'),
      fire: is('Numpad1', 'Comma'), bomb: is('Numpad2', 'Period'),
    };
    const solo = state.playerCount === 1;
    return {
      left: is('KeyA') || solo && is('ArrowLeft') || pressed('left'),
      right: is('KeyD') || solo && is('ArrowRight') || pressed('right'),
      up: is('KeyW') || solo && is('ArrowUp') || pressed('up'),
      down: is('KeyS') || solo && is('ArrowDown') || pressed('down'),
      fire: is(bindings.fire) || pressed('fire'),
      bomb: is(bindings.bomb) || pressed('bomb'),
      select: is('ShiftLeft', 'ShiftRight'),
      pointer: pointer.active ? pointer : null,
    };
  }
  function updateHud() {
    $('#score-value').textContent = state.players.map(p => `${state.playerCount === 2 ? `${p.id + 1}P ` : ''}${String(p.score).padStart(6, '0')}`).join(' / ');
    $('#stage-value').textContent = `${state.stageNumber} · ${state.loop}周目`;
    $('#lives-value').textContent = state.players.map(p => `${state.playerCount === 2 ? `${p.id + 1}P ` : ''}${p.lives}`).join(' / ');
    $('#power-value').textContent = state.players.map(p => `${state.playerCount === 2 ? `${p.id + 1}P ` : ''}${!p.active ? '出局' : `${powerLabel(p)} · ${p.arms.left ? '双臂' : '无臂'}`}`).join(' | ');
    $('#assist-status').textContent = state.assist.mode === 'invincible' ? '无敌 · 不掉血、不掉臂' : state.assist.mode === 'armor' ? state.players.map(p => `${p.id + 1}P 装甲 ${p.health}/${p.maxHealth}`).join(' · ') : '经典 · 中弹丢双臂，再中弹损失一架';
    for (const id of ['score-value', 'power-value']) $('#' + id).title = $('#' + id).textContent;
  }
  function draw() {
    worldRenderer.render(state, LEVELS[state.stageIndex], state.frame / 60, reducedMotion);
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.font = 'bold 12px ui-monospace, monospace'; context.textAlign = 'left';
    context.fillStyle = '#14263b'; context.fillRect(0, 0, WIDTH, 23);
    context.fillStyle = '#fff2b8';
    context.fillText(`STAGE ${String(state.stageNumber).padStart(2, '0')}  ${state.playerCount}P`, 10, 16);
    if (state.assist.mode !== 'classic') {
      context.textAlign = 'center'; context.fillStyle = '#9fffe6';
      context.fillText(state.assist.mode === 'invincible' ? '无敌' : state.players.map(p => `${p.id + 1}P ${p.health}/${p.maxHealth}`).join('  '), WIDTH / 2, 16);
    }
    context.textAlign = 'right';
    const chain = state.player.bellChain;
    context.fillText(`BELL ${C.FC_RULES.yellowBellScores[Math.min(chain, 3)]}`, WIDTH - 10, 16);
    if (state.formation) {
      context.fillStyle = '#fffc84'; context.textAlign = 'center'; context.fillText(state.formation.kind.toUpperCase(), WIDTH / 2, 38);
    }
    if (state.mode === 'stage-clear' || state.stageBanner > 0 && state.mode === 'playing') {
      context.fillStyle = 'rgba(12,20,36,.86)'; context.fillRect(80, HEIGHT / 2 - 36, WIDTH - 160, 72);
      context.textAlign = 'center'; context.fillStyle = '#fff2aa'; context.font = 'bold 21px ui-monospace, monospace';
      context.fillText(state.mode === 'stage-clear' ? 'STAGE CLEAR' : `STAGE ${state.stageNumber}`, WIDTH / 2, HEIGHT / 2 - 5);
      context.font = 'bold 13px system-ui'; context.fillStyle = '#ffffff';
      context.fillText(state.mode === 'stage-clear' ? '装备与分数保留 · 继续前进' : LEVELS[state.stageIndex].name, WIDTH / 2, HEIGHT / 2 + 21);
    }
  }
  function resizeCanvas() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    worldRenderer.resize(ratio); canvas.width = WIDTH * ratio; canvas.height = HEIGHT * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.imageSmoothingEnabled = false;
    draw();
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
    const elapsed = Math.min((now - previousTime) / 1000, .1); previousTime = now;
    if (!manualClock && ['playing', 'stage-clear'].includes(state.mode)) {
      accumulator += elapsed;
      while (accumulator >= E.STEP) { E.step(state, state.players.map((_, i) => input(i))); accumulator -= E.STEP; }
    } else accumulator = 0;
    reactToState(); hudClock += elapsed;
    if (hudClock >= .1) { updateHud(); hudClock = 0; }
    draw(); requestAnimationFrame(animationFrame);
  }
  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * WIDTH, y: (event.clientY - rect.top) / rect.height * HEIGHT };
  }
  const gameKeys = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','KeyJ','KeyK','KeyZ','KeyX','KeyC','KeyP','Comma','Period','Numpad1','Numpad2','ShiftLeft','ShiftRight']);
  window.addEventListener('keydown', event => {
    if (capturing) {
      event.preventDefault(); event.stopPropagation();
      if (event.code === 'Escape') { capturing = null; renderBindings(); announce('已取消改键'); return; }
      const other = capturing === 'fire' ? 'bomb' : 'fire';
      if (!allowedBinding(event.code) || event.code === bindings[other]) { announce('这个键已被移动、暂停或另一动作占用，请换一个字母、数字或空格'); return; }
      bindings[capturing] = event.code; capturing = null; clearInput();
      try { localStorage.setItem('twinbee-fc-bindings', JSON.stringify(bindings)); } catch (_) {}
      renderBindings(); announce('新按键已保存'); return;
    }
    if (event.target.closest?.('input, select')) return;
    if (event.target.closest?.('button, summary, input, select') && ['Space', 'Enter'].includes(event.code)) return;
    if (gameKeys.has(event.code) || Object.values(bindings).includes(event.code)) event.preventDefault();
    if (event.code === 'KeyP' || event.code === 'Escape') { if (!event.repeat) pauseGame(); return; }
    if (event.code === 'Enter' && state.mode === 'ready') { startGame(); return; }
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { clearInput(); if (['playing','stage-clear'].includes(state.mode)) pauseGame(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (['playing','stage-clear'].includes(state.mode)) pauseGame(true); } });
  canvas.addEventListener('pointerdown', event => {
    if (state.mode !== 'playing' || pointer.active) return;
    pointer.active = true; pointer.id = event.pointerId; Object.assign(pointer, pointerPosition(event)); canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => { if (pointer.active && pointer.id === event.pointerId) Object.assign(pointer, pointerPosition(event)); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => { if (pointer.id === event.pointerId) pointer.active = false; });
  document.querySelectorAll('[data-control]').forEach(button => {
    button.addEventListener('pointerdown', event => { event.preventDefault(); touches.set(event.pointerId, button.dataset.control); button.classList.add('is-pressed'); button.setPointerCapture(event.pointerId); });
    const release = event => { touches.delete(event.pointerId); if (!pressed(button.dataset.control)) button.classList.remove('is-pressed'); };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, release);
  });
  startButton.addEventListener('click', () => overlayAction());
  twoPlayerButton.addEventListener('click', () => startGame(0, 2));
  stageSelectButton.addEventListener('click', () => { stagePicker.hidden = !stagePicker.hidden; if (!stagePicker.hidden) stagePicker.querySelector('button').focus(); });
  LEVELS.forEach((level, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = String(index + 1);
    button.title = `练习：${level.name}`; button.setAttribute('aria-label', `练习第 ${index + 1} 关 ${level.name}`);
    button.addEventListener('click', () => startGame(index, 1)); stagePicker.append(button);
  });
  pauseButton.addEventListener('click', () => pauseGame());
  soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled; soundButton.textContent = `声音：${soundEnabled ? '开' : '关'}`; soundButton.setAttribute('aria-pressed', String(soundEnabled));
    if (soundEnabled) { unlockAudio(); startMusic(); } else stopMusic();
    if (state.mode === 'playing') canvas.focus({ preventScroll: true });
  });
  function keyLabel(code) { return code === 'Space' ? '空格' : code.replace(/^Key|^Digit/, ''); }
  function renderBindings() {
    $('#fire-binding').textContent = capturing === 'fire' ? '请按射击键…' : `射击：${keyLabel(bindings.fire)}`;
    $('#bomb-binding').textContent = capturing === 'bomb' ? '请按投弹键…' : `投弹：${keyLabel(bindings.bomb)}`;
    $('#fire-key-label').textContent = keyLabel(bindings.fire); $('#bomb-key-label').textContent = keyLabel(bindings.bomb);
    canvas.setAttribute('aria-label', `兵蜂 FC 游戏。WASD或方向键移动，${keyLabel(bindings.fire)}射击，${keyLabel(bindings.bomb)}投弹，P暂停。`);
  }
  for (const action of ['fire', 'bomb']) $('#' + action + '-binding').addEventListener('click', () => {
    if (['playing', 'stage-clear'].includes(state.mode)) pauseGame(true);
    clearInput(); capturing = action; renderBindings(); announce('按下新键；Esc取消');
  });
  $('#reset-bindings').addEventListener('click', () => {
    capturing = null; bindings = { fire: 'Space', bomb: 'KeyF' }; clearInput(); renderBindings();
    try { localStorage.removeItem('twinbee-fc-bindings'); } catch (_) {}
    announce('已恢复空格射击、F投弹');
    if (state.mode === 'playing') canvas.focus({ preventScroll: true });
  });
  $('#assist-mode').addEventListener('change', () => { $('#armor-health').disabled = $('#assist-mode').value !== 'armor'; });
  $('#assist-apply').addEventListener('click', () => {
    if (!$('#armor-health').checkValidity() && $('#assist-mode').value === 'armor') { $('#armor-health').reportValidity(); return; }
    assistSettings = E.configureAssist(state, { mode: $('#assist-mode').value, health: Number($('#armor-health').value) });
    $('#armor-health').value = assistSettings.health; clearInput(); updateHud();
    if (state.mode === 'playing') canvas.focus({ preventScroll: true });
    announce(assistSettings.mode === 'invincible' ? '无敌已开启' : assistSettings.mode === 'armor' ? `每架 ${assistSettings.health} 血，装甲已补满` : '已恢复经典受伤规则');
  });
  $('#armor-health').disabled = true; renderBindings();
  function snapshot() {
    return { assist: { ...state.assist }, bindings: { ...bindings }, mode: state.mode, stageIndex: state.stageIndex, stageNumber: state.stageNumber, loop: state.loop,
      stageTime: state.stageTime, score: state.score, lives: state.player.lives, playerCount: state.playerCount,
      player: { x: state.player.x, y: state.player.y }, arms: { ...state.player.arms },
      players: state.players.map(p => ({ health:p.health, maxHealth:p.maxHealth, id:p.id, x:p.x, y:p.y, active:p.active, lives:p.lives, score:p.score, arms:{...p.arms},
        speedLevel:p.speedLevel, twinShot:p.twinShot, threeWay:p.threeWay, mirrors:p.mirrors, shield:p.shield, bellChain:p.bellChain,
        ambulanceUsed:p.ambulanceUsed, clonePositions:p.clonePositions.map(q=>({...q})) })),
      enemies: state.enemies.length, playerShots: state.playerShots.length, bombs: state.bombs.length,
      pickups: state.pickups.map(p => ({ kind:p.kind, color:p.color, x:p.x, y:p.y, hits:p.hits })),
      formation: state.formation, boss: state.boss ? { kind:state.boss.kind, hp:state.boss.hp, maxHp:state.boss.maxHp } : null };
  }
  window.workerBeeDebug = { snapshot, renderInfo: () => worldRenderer.info() };
  if (testMode) Object.assign(window.workerBeeDebug, {
    start: startGame,
    manual: enabled => { manualClock = enabled; },
    step: (frames = 1, inputs = []) => { for (let i = 0; i < frames; i++) E.step(state, inputs); reactToState(); updateHud(); draw(); },
    state: () => state,
    spawnBoss: () => E.spawnBoss(state),
    defeatBoss: () => { const boss = state.boss || E.spawnBoss(state); E.hitEnemy(state, boss, boss.hp, state.player); reactToState(); },
  });
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas(); updateHud(); requestAnimationFrame(animationFrame);
})();
