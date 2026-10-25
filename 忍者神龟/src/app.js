import { Game } from './core.js';
import { CHARACTERS, CHARACTER_IDS, STAGES, getSection } from './content.js';
import { InputManager, ACTIONS, ACTION_NAMES, DEFAULT_BINDINGS, keyName, validateBindings } from './input.js';
import { render, renderPortrait } from './renderer.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#game');
const ctx = canvas.getContext('2d', { alpha: false });
const preferencesKey = 'half-shell-controls-v1';
const modeNames = { classic: '经典模式 · 无敌关闭', high: '高血量模式 · 无敌关闭', invincible: '无敌练习 · 已开启' };
let selected = ['leo', 'don'];
let selectedPlayer = 0;
let game = new Game({ characters: ['leo'], mode: 'classic' });
let started = false;
let debug = false;
let sound = false;
let audioContext;
let audioBefore = { hp: 8, enemies: 3, action: 'idle' };
let toastTimeout;
let lastOverlay = null;
let lastTime = 0;
let accumulator = 0;
let draftBindings;
let currentMode = 'classic';
let previewFrame = 0;

const input = new InputManager({ onBlur: () => pause(true, '已失焦，输入已清空'), onPause: () => pause(!game.state.paused), onStart: activate });
try {
  const saved = JSON.parse(localStorage.getItem(preferencesKey) || 'null');
  if (saved?.bindings && !validateBindings(saved.bindings)) input.setBindings(saved.bindings);
  if (saved?.touch) { document.body.classList.add('force-touch'); $('#touch-visible').checked = true; }
} catch { /* Private browsing or stale local storage must not prevent play. */ }

function toast(message) {
  clearTimeout(toastTimeout); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 3200);
}
function focusGame() { canvas.focus({ preventScroll: true }); }
function pause(value, reason = '') {
  input.clear(); accumulator = 0;
  if (!started || !['playing', 'stageClear'].includes(game.state.phase)) return;
  game.setPaused(value);
  input.enabled = !value;
  if (reason) $('#game-message').textContent = reason;
  syncOverlay(); syncStatus();
  if (!value) focusGame();
}
function startGame() {
  const playersMode = $('#players-mode').value;
  currentMode = $('#difficulty').value;
  const characters = playersMode === 'solo' ? [selected[0]] : selected;
  game = new Game({ mode: currentMode, characters, friendlyFire: playersMode === 'friendly', seed: 1992 });
  started = true; input.enabled = true; input.clear(); accumulator = 0;
  $('#mode-label').textContent = modeNames[currentMode];
  $('#start-button').innerHTML = '重新开始 <span>↻</span>';
  $('#setup-status').textContent = 'IN GAME';
  $('#setup-note').textContent = '失去生命后可在此换龟。其他设置在重新开始时生效。';
  lastOverlay = null; audioBefore = { hp: game.state.players.reduce((n,p)=>n+p.hp,0), enemies: game.state.enemies.length, action: 'idle' };
  syncOverlay(); syncStatus(); refreshCharacterCards(); focusGame();
  playTone(440, .1, 'triangle');
}
function activate() {
  if ($('#settings-dialog').open) return;
  if (!started || game.state.phase === 'victory') { startGame(); return; }
  if (game.state.phase === 'gameover') {
    if (game.continueGame()) { input.clear(); input.enabled = true; lastOverlay = null; accumulator = 0; focusGame(); syncOverlay(); }
    else startGame();
    return;
  }
  if (game.state.paused) pause(false);
}
function syncOverlay() {
  const s = game.state;
  const kind = !started ? 'intro' : s.paused ? 'paused' : s.phase === 'gameover' ? 'gameover' : s.phase === 'victory' ? 'victory' : '';
  if (kind === lastOverlay) return;
  lastOverlay = kind;
  $('#screen-overlay').classList.toggle('hidden', !kind);
  if (!kind) return;
  const copy = {
    intro: ['纽约需要你', '假期结束。<br>英雄归来。', '选择你的神龟，夺回曼哈顿。', '开始行动', 'ENTER 开始 / 支持双人同屏'],
    paused: ['PAUSED / 已暂停', '休息一下。<br>同伴在等你。', '输入已清空。准备好后继续行动。', '继续行动', 'ESC / ENTER 继续'],
    gameover: ['GAME OVER', '暂时撤退。<br>重新集结。', s.continuesLeft > 0 ? `还可续关 ${s.continuesLeft} 次，从本关开头重新出发。` : '本局续关已用完，可以重新开始。', s.continuesLeft > 0 ? '从本关续关' : '重新开始', 'ENTER 确认'],
    victory: ['MANHATTAN IS HOME', '曼哈顿归来。<br>披萨时间！', '八关完成。四只神龟，又一次救下了纽约。', '再来一局', 'COWABUNGA!'],
  }[kind];
  $('#overlay-kicker').textContent = copy[0]; $('#overlay-title').innerHTML = copy[1];
  $('#overlay-text').textContent = copy[2]; $('#overlay-action').innerHTML = `${copy[3]} <span>↗</span>`;
  $('#overlay-footnote').textContent = copy[4];
}
function refreshCharacterCards() {
  $('#character-grid').innerHTML = '';
  for (const id of CHARACTER_IDS) {
    const char = CHARACTERS[id];
    const button = document.createElement('button'); button.type = 'button';
    button.className = `character-card${selected[selectedPlayer] === id ? ' selected' : ''}`;
    button.dataset.character = id; button.setAttribute('aria-pressed', String(selected[selectedPlayer] === id));
    button.setAttribute('aria-label', `${char.label}，${char.weapon}，${char.description}`);
    const portrait = document.createElement('canvas'); portrait.width = 64; portrait.height = 64; portrait.setAttribute('aria-hidden', 'true');
    button.append(portrait); renderPortrait(portrait.getContext('2d'), id, 64);
    const name = document.createElement('strong'); name.textContent = char.short; button.append(name);
    const label = document.createElement('small'); label.textContent = `${char.label} · ${char.weapon}`; button.append(label);
    const owner = selected.indexOf(id);
    if (owner >= 0) { const badge = document.createElement('span'); badge.className = 'chosen-badge'; badge.textContent = `P${owner + 1}`; button.append(badge); }
    button.addEventListener('click', () => {
      const player = game.state.players[selectedPlayer];
      if (started && player?.awaitingRespawn) {
        if (!game.selectCharacter(player.id, id)) { toast('这只神龟正在由同伴使用'); return; }
        input.clear(); focusGame();
      }
      if (selected[1 - selectedPlayer] === id) selected[1 - selectedPlayer] = selected[selectedPlayer];
      selected[selectedPlayer] = id; refreshCharacterCards();
    });
    $('#character-grid').append(button);
  }
  const char = CHARACTERS[selected[selectedPlayer]];
  $('#character-detail').textContent = `${char.description}。必杀：${char.special}。`;
  document.querySelectorAll('[data-player-tab]').forEach(button => button.classList.toggle('active', Number(button.dataset.playerTab) === selectedPlayer));
}
function refreshKeySummary() {
  $('#key-summary').innerHTML = input.bindings.map((map,index) => `<div class="keys-row"><strong>P${index + 1}</strong><span>${['up','left','down','right'].map(action=>`<kbd>${keyName(map[action])}</kbd>`).join('')} 移动</span><span><kbd>${keyName(map.attack)}</kbd> 攻击</span><span><kbd>${keyName(map.jump)}</kbd> 跳跃</span><span><kbd>${keyName(map.special)}</kbd> 必杀</span></div>`).join('');
}
function drawBindings() {
  $('#binding-grid').innerHTML = '';
  draftBindings.forEach((map, index) => {
    const column = document.createElement('section'); column.className = 'binding-column';
    const heading = document.createElement('h3'); heading.textContent = `玩家 ${index + 1}`; column.append(heading);
    ACTIONS.forEach(action => {
      const row = document.createElement('div'); row.className = 'binding-row';
      const label = document.createElement('span'); label.textContent = ACTION_NAMES[action];
      const button = document.createElement('button'); button.type = 'button'; button.textContent = keyName(map[action]);
      button.setAttribute('aria-label', `玩家 ${index + 1} ${ACTION_NAMES[action]}，${keyName(map[action])}`);
      button.addEventListener('click', () => {
        input.clear(); document.querySelectorAll('.listening').forEach(b=>b.classList.remove('listening'));
        button.classList.add('listening'); button.textContent = '按键…';
        $('#binding-message').textContent = '按下新按键；Esc 取消。'; $('#binding-message').classList.remove('error');
        input.capture = code => {
          if (code === 'Escape') { input.capture = null; drawBindings(); $('#binding-message').textContent = '已取消修改'; return; }
          const candidate = structuredClone(draftBindings); candidate[index][action] = code;
          const error = validateBindings(candidate);
          if (error) { $('#binding-message').textContent = error; $('#binding-message').classList.add('error'); return; }
          draftBindings = candidate; input.capture = null; drawBindings();
          $('#binding-message').textContent = '按键无冲突，点击“完成”保存。'; $('#binding-message').classList.remove('error');
        };
      });
      row.append(label, button); column.append(row);
    });
    $('#binding-grid').append(column);
  });
}
function openSettings() {
  pause(true); input.clear(); draftBindings = structuredClone(input.bindings); drawBindings();
  $('#binding-message').textContent = '普通 Mac 键盘即可，无需小键盘。'; $('#binding-message').classList.remove('error');
  $('#settings-dialog').showModal();
}
function closeSettings(save) {
  input.capture = null; input.clear();
  if (save) {
    const error = input.setBindings(draftBindings);
    if (error) { $('#binding-message').textContent = error; return; }
    const touch = $('#touch-visible').checked;
    document.body.classList.toggle('force-touch', touch);
    debug = $('#hitbox-visible').checked;
    try { localStorage.setItem(preferencesKey, JSON.stringify({ bindings: input.bindings, touch })); }
    catch { toast('当前浏览器无法保存设置，本次游玩仍可使用'); }
    refreshKeySummary();
  }
  $('#settings-dialog').close(); focusGame();
}
function playTone(frequency, duration = .07, type = 'square', volume = .025) {
  if (!sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const now = audioContext.currentTime, osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, now); osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * .4), now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain); gain.connect(audioContext.destination); osc.start(); osc.stop(now + duration);
  } catch { sound = false; $('#sound-button').textContent = '声音 不可用'; }
}
function tickAudio() {
  const state = game.state, hp = state.players.reduce((sum,p)=>sum+p.hp,0), action = state.players[0]?.action;
  if (hp < audioBefore.hp) playTone(130, .13, 'sawtooth', .035);
  else if (state.enemies.length < audioBefore.enemies) playTone(480,.09,'triangle');
  else if (action !== audioBefore.action && ['attack','kick','special','toss'].includes(action)) playTone(action === 'special' ? 700 : 250, .07);
  audioBefore = { hp, enemies: state.enemies.length, action };
}
function syncStatus() {
  const s = game.state, stage = STAGES[s.stageIndex];
  const section = getSection(s.stageIndex, s.cameraX + 420);
  $('#scene-label').textContent = `${String(s.stageIndex + 1).padStart(2,'0')} / ${section.name}`;
  $('#pause-button').innerHTML = s.paused ? '继续 <kbd>ESC</kbd>' : '暂停 <kbd>ESC</kbd>';
  $('#join-button').hidden = s.players.length >= 2;
  $('#touch-player').querySelector('[value="1"]').disabled = s.players.length < 2;
  const waiting = s.players.find(p=>p.awaitingRespawn);
  if (waiting) {
    const index = s.players.indexOf(waiting);
    $('#game-message').textContent = `P${index + 1} 倒下 · ${keyName(input.bindings[index].jump)} 复活 / 右侧可换龟`;
  } else if (!s.paused) $('#game-message').textContent = s.phase === 'stageClear' ? `${stage.name}完成 · 准备前往下一关` : (s.message || (s.enemies.length ? `清除当前敌人 · ${s.enemies.length} 名` : '继续向右前进 →'));
  document.querySelectorAll('.route-stop').forEach((element,index)=>{ element.classList.toggle('current',index===s.stageIndex); element.classList.toggle('complete',index<s.stageIndex); });
  const diagnostics = $('#qa-state');
  if (diagnostics) diagnostics.textContent = JSON.stringify({ frame:s.frame,phase:s.phase,paused:s.paused,stage:s.stageIndex+1,wave:s.waveIndex+1,stats:s.stats,players:s.players.map(p=>({id:p.id,character:p.character,x:Math.round(p.x),y:Math.round(p.y),z:Math.round(p.z),action:p.action,hp:p.hp,lives:p.lives,awaitingRespawn:p.awaitingRespawn})),enemies:s.enemies.filter(e=>e.hp>0).map(e=>({type:e.type,hp:e.hp,x:Math.round(e.x),y:Math.round(e.y),aiState:e.aiState}))});
}

$('#start-button').addEventListener('click', startGame);
$('#overlay-action').addEventListener('click', activate);
$('#pause-button').addEventListener('click', () => pause(!game.state.paused));
$('#settings-button').addEventListener('click', openSettings);
$('#close-settings').addEventListener('click', () => closeSettings(false));
$('#save-settings').addEventListener('click', () => closeSettings(true));
$('#settings-dialog').addEventListener('cancel', event => { event.preventDefault(); if(input.capture) {input.capture=null;drawBindings();} else closeSettings(false); });
$('#reset-bindings').addEventListener('click', () => { input.capture=null; draftBindings=structuredClone(DEFAULT_BINDINGS); drawBindings(); $('#binding-message').textContent='默认按键已恢复，点击“完成”保存。'; $('#binding-message').classList.remove('error'); });
$('#join-button').addEventListener('click', () => {
  if (!started) { $('#players-mode').value='coop'; startGame(); return; }
  const available = selected[1] === game.state.players[0].character ? CHARACTER_IDS.find(id=>id!==selected[1]) : selected[1];
  if (game.join(available)) { selected[1]=available; refreshCharacterCards(); toast('玩家 2 已加入，分享一条备用生命'); input.clear(); focusGame(); }
  else toast('当前无法加入：需要玩家 1 还有备用生命');
});
$('#sound-button').addEventListener('click', () => { sound=!sound; $('#sound-button').textContent=`声音 ${sound?'开':'关'}`; $('#sound-button').setAttribute('aria-pressed',String(sound)); playTone(660); focusGame(); });
$('#fullscreen-button').addEventListener('click', async () => { try { if(document.fullscreenElement) await document.exitFullscreen(); else await $('.arcade').requestFullscreen(); focusGame(); } catch { toast('此浏览器不支持全屏，游戏仍可正常游玩'); } });
document.querySelectorAll('[data-player-tab]').forEach(button=>button.addEventListener('click',()=>{ selectedPlayer=Number(button.dataset.playerTab); refreshCharacterCards(); }));
$('#players-mode').addEventListener('change',()=>{ if(started) toast('出击方式将在重新开始后生效'); });
$('#difficulty').addEventListener('change',()=>{ if(started) toast('模式将在重新开始后生效'); });
$('#route-button').addEventListener('click',()=>{ $('#stage-route').scrollIntoView({behavior:'smooth',block:'nearest'}); $('#stage-route').classList.add('highlight'); setTimeout(()=>$('#stage-route').classList.remove('highlight'),2000); });
$('#stage-route').innerHTML=STAGES.map((stage,index)=>`<div class="route-stop${index===0?' current':''}"><strong>${String(index+1).padStart(2,'0')}</strong><span>${stage.name}</span></div>`).join('');
document.querySelectorAll('[data-touch]').forEach(button=>{
  button.addEventListener('pointerdown',event=>{
    event.preventDefault(); if(!started || game.state.paused) return;
    button.setPointerCapture(event.pointerId);
    input.touch(event.pointerId,Number($('#touch-player').value),button.dataset.touch.split(','));
    focusGame();
  });
  for(const eventName of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(eventName,event=>{ event.preventDefault(); input.release(event.pointerId,eventName!=='pointerup'); });
});
$('#touch-player').addEventListener('change',()=>input.clear());

function frame(now) {
  if (!lastTime) lastTime=now;
  const elapsed=Math.min((now-lastTime)/1000, .1); lastTime=now;
  if (started && !game.state.paused && !$('#settings-dialog').open) {
    accumulator+=elapsed;
    let steps=0;
    while(accumulator>=1/60 && steps<6) { game.step(input.read()); accumulator-=1/60; steps++; }
    tickAudio();
  } else accumulator=0;
  previewFrame++;
  render(ctx, started ? game.state : {...game.state, frame:previewFrame, players:[{...game.state.players[0],x:640,y:407,facing:1}, {...game.state.players[0],id:'preview-don',character:'don',x:736,y:370,facing:1}], enemies:game.state.enemies.map((enemy,index)=>({...enemy,x:850+index*70,y:370+index*35}))}, {debug});
  if(previewFrame%6===0) {syncOverlay();syncStatus();}
  requestAnimationFrame(frame);
}
refreshCharacterCards(); refreshKeySummary(); syncStatus(); requestAnimationFrame(frame);

// This diagnostic interface is opt-in and is never available in ordinary play.
if (new URLSearchParams(location.search).has('qa')) {
  window.__tmnt = { get game(){return game;}, input, start:startGame, pause, snapshot:()=>structuredClone(game.state), step:(count,actions)=>{for(let i=0;i<count;i++)game.step(actions); syncStatus();syncOverlay();} };
  const diagnostics=document.createElement('details'); diagnostics.style.cssText='padding:20px;color:#a1d1b8;font:11px monospace;overflow-wrap:anywhere';
  diagnostics.innerHTML='<summary>QA 状态（仅诊断入口）</summary><output id="qa-state"></output>';
  document.body.append(diagnostics);
}
