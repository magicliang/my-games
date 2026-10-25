import { Game } from '../src/core.js';
import { STAGES, BOSS_DEFS } from '../src/content.js';
import { render } from '../src/renderer.js';

const iframe = document.querySelector('#app');
const requestedWidth=Number(new URLSearchParams(location.search).get('width'));
if ([390,768,1280].includes(requestedWidth)) { iframe.style.width=`${requestedWidth}px`; iframe.style.height='844px'; }
const output = document.querySelector('#results');
const results = [];
let failures = 0;
const assert = (condition, text) => { if (!condition) throw Error(text); };
const check = async (name, fn) => {
  try { await fn(); results.push(`PASS ${name}`); }
  catch (error) { failures++; results.push(`FAIL ${name}: ${error.message}`); }
  output.textContent = results.join('\n');
};
if (!iframe.contentWindow.__tmnt) await new Promise(resolve => iframe.addEventListener('load',resolve,{once:true}));
const win=iframe.contentWindow, doc=iframe.contentDocument, qa=win.__tmnt;
if (!qa) throw new Error('QA interface failed to load');
const q=selector=>doc.querySelector(selector);
const fire=(type,code)=>q('#game').dispatchEvent(new win.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));
const step=(n=1)=>qa.step(n,qa.input.read());
const tap=(code,n=1)=>{ fire('keydown',code);step(n);fire('keyup',code);step(); };
const restart=(mode='classic',players='solo')=>{q('#difficulty').value=mode;q('#players-mode').value=players;q('#start-button').click();};
const fixture=()=>{
  const s=qa.game.state,p=s.players[0];
  s.enemies=[];s.props=[];s.hazards=[];s.projectiles=[];s.items=[];
  p.x=300;p.y=370;p.z=0;p.vz=0;p.action='idle';p.age=0;p.stun=0;p.invuln=0;p.facing=1;
  qa.input.clear();qa.game.previous=[{},{}];
  return {s,p};
};
await check('默认经典且无敌关闭，四角色卡均已绘制',()=>{
  assert(q('#difficulty').value==='classic','default mode changed');
  assert(q('#character-grid').children.length===4,'missing character cards');
  assert(q('#mode-label').textContent.includes('无敌关闭'),'missing default status');
});
await check('单人可直接选择 Don；另一个待选角色自动避让',()=>{
  q('[data-character="don"]').click();assert(q('[data-character="don"]').getAttribute('aria-pressed')==='true','Don unavailable');
  q('[data-character="leo"]').click();
});
await check('实际 DOM 开始按钮与键盘输入驱动移动；单次普通攻击命中',()=>{
  restart(); assert(q('#screen-overlay').classList.contains('hidden'),'intro still covers the game after starting');
  const {p}=fixture(); const x=p.x;fire('keydown','KeyD');step(10);fire('keyup','KeyD');assert(p.x>x+20,'movement failed');
  const enemy=qa.game.spawnEnemy('foot',p.x+65,p.y,{cooldown:999,aiTimer:999});
  const hp=enemy.hp;tap('KeyJ',6);assert(enemy.hp<hp,'attack did not hit');assert(qa.game.state.stats.hits>0,'hit not counted');
});
await check('空中攻击经相同输入路径命中；地面纵深不同不误伤',()=>{
  restart();let {p}=fixture();let enemy=qa.game.spawnEnemy('foot',p.x+55,p.y,{cooldown:999});
  tap('KeyK',3);tap('KeyJ',7);assert(enemy.hp<enemy.maxHp,'jump kick missed aligned target');
  restart();({p}=fixture());enemy=qa.game.spawnEnemy('foot',p.x+55,p.y+85,{cooldown:999});tap('KeyJ',6);assert(enemy.hp===enemy.maxHp,'cross-lane false positive');
});
await check('普通受击、死亡、等待和跳跃键复活实际生效',()=>{
  restart();const {p}=fixture(); const enemy=qa.game.spawnEnemy('foot',p.x+30,p.y,{cooldown:0});const hp=p.hp;
  step(130);assert(p.hp<hp,'enemy did no damage');
  qa.game.damagePlayer(p,99,enemy,{force:true});assert(p.awaitingRespawn&&p.lives===3,'death/life count wrong');
  step(75);tap('KeyK');assert(!p.awaitingRespawn&&p.hp===p.maxHp&&p.invuln>0,'respawn failed');
});
await check('双人移动独立；双人 B 不互伤，A 可互伤',()=>{
  restart('classic','coop'); let [p1,p2]=qa.game.state.players;assert(p2,'P2 missing');
  qa.game.state.enemies=[];p1.x=300;p1.y=370;p2.x=355;p2.y=370;p1.invuln=0;p2.invuln=0;
  tap('KeyJ',6);assert(p2.hp===p2.maxHp,'coop friendly fire');const x=p2.x;tap('ArrowRight',8);assert(p2.x>x,'P2 input failed');
  restart('classic','friendly');[p1,p2]=qa.game.state.players;qa.game.state.enemies=[];p1.x=300;p1.y=370;p2.x=355;p2.y=370;p1.invuln=0;p2.invuln=0;
  tap('KeyJ',6);assert(p2.hp<p2.maxHp,'A mode missing friendly fire');
});
await check('暂停冻结模拟，失焦清空双人键盘与触屏状态',()=>{
  restart();fire('keydown','KeyD');qa.input.touch(12,1,['jump']);
  win.dispatchEvent(new win.Event('blur'));
  assert(qa.game.state.paused,'blur did not pause');assert(qa.input.read().every(p=>Object.values(p).every(v=>!v)),'sticky input');
  const frame=qa.game.state.frame;step(100);assert(qa.game.state.frame===frame,'pause advanced simulation');
  qa.pause(false);assert(!qa.game.state.paused,'resume failed');assert(q('#screen-overlay').classList.contains('hidden'),'pause overlay remains after resume');
});
await check('改键冲突拒绝，合法新键保存后驱动攻击',()=>{
  restart();q('#settings-button').click();
  const binding=q('#binding-grid .binding-column .binding-row:nth-child(6) button');
  binding.click();fire('keydown','ArrowUp');assert(q('#binding-message').classList.contains('error'),'conflict not shown');
  fire('keydown','KeyF');q('#save-settings').click();assert(qa.input.bindings[0].attack==='KeyF','binding not saved');qa.pause(false);
  const {p}=fixture();const enemy=qa.game.spawnEnemy('foot',p.x+60,p.y,{cooldown:999});tap('KeyF',6);assert(enemy.hp<enemy.maxHp,'rebound attack failed');
  q('#settings-button').click();q('#reset-bindings').click();q('#save-settings').click();qa.pause(false);
});
await check('必杀消耗能量，最后 1 单位保留；高血量/无敌明确可选',()=>{
  restart();let {p}=fixture();tap('KeyL',8);assert(p.hp===p.maxHp-1,'special cost absent');step(50);p.hp=1;tap('KeyL',8);assert(p.hp===1,'last hp special killed player');
  restart('high');p=qa.game.state.players[0];assert(p.maxHp===32,'high hp not applied');
  restart('invincible');p=qa.game.state.players[0];qa.game.damagePlayer(p,99,null,{force:true});assert(p.hp===p.maxHp,'invincible damage');
});
await check('Boss 行为、关卡切换、续关和结局在浏览器运行',()=>{
  restart('invincible'); const g=qa.game,s=g.state;
  s.enemies=[];g.spawnEnemy('rocksteady',600,370,{aiTimer:1});qa.step(250,[{},{}]);assert(s.projectiles.length||s.enemies[0].pattern>0,'boss inert');
  g.loadStage(2);s.phase='gameover';const score=s.players[0].score=1234;qa.step(0,[]);
  assert(!q('#screen-overlay').classList.contains('hidden'),'gameover overlay absent');q('#overlay-action').click();
  assert(s.phase==='playing'&&q('#screen-overlay').classList.contains('hidden'),'continue did not hide overlay');assert(s.stageIndex===2&&s.players[0].score===score&&s.continuesLeft===2,'continue wrong');
  s.phase='stageClear';s.transition=1;qa.step(1,[]);assert(s.stageIndex===3,'stage transition broken');
  g.loadStage(7);s.phase='stageClear';s.transition=1;qa.step(1,[]);assert(s.phase==='victory','ending unavailable');
});
await check('八关所有场景、全部 Boss 与四龟动画 Canvas 无异常',()=>{
  for (const stage of STAGES) {
    const sample=document.createElement('section'), title=document.createElement('h3'), canvas=document.createElement('canvas');
    title.textContent=`${stage.index+1}. ${stage.name}`;canvas.width=960;canvas.height=540;
    const g=new Game({characters:['leo','don']});g.loadStage(stage.index);
    for(const section of stage.sections){g.state.cameraX=section.at;render(canvas.getContext('2d'),g.state,{debug:true});}
    g.state.cameraX=0;g.state.enemies=[];
    const lastBoss=stage.waves.at(-1).types[0];g.spawnEnemy(lastBoss,700,380,{aiState:'windup'});
    const before=JSON.stringify(g.state);render(canvas.getContext('2d'),g.state);
    assert(JSON.stringify(g.state)===before,'rendering changed simulation state');
    sample.append(title,canvas);document.querySelector('#gallery').append(sample);
  }
  const c=document.createElement('canvas');c.width=960;c.height=540;
  for(const character of ['leo','raph','mike','don'])for(const action of ['idle','walk','jump','attack','kick','toss','special','hurt','grabbed','frozen','turtle','down']){
    const g=new Game({characters:[character]});g.state.players[0].action=action;g.state.players[0].age=12;render(c.getContext('2d'),g.state,{debug:true});
  }
  for(const type of Object.keys(BOSS_DEFS)){const g=new Game();g.state.enemies=[];g.spawnEnemy(type,600,370);render(c.getContext('2d'),g.state);}
});
await check('页面当前宽度无水平溢出，移动触屏按钮达到可见状态',()=>{
  assert(doc.documentElement.scrollWidth<=win.innerWidth+1,`horizontal overflow: ${doc.documentElement.scrollWidth}/${win.innerWidth}`);
  if(win.innerWidth<=850)assert(win.getComputedStyle(q('#touch-controls')).display==='grid','mobile controls hidden');
});
restart('classic','coop');qa.pause(true);
output.textContent=`${failures?'FAIL':'PASS'} · ${results.length-failures}/${results.length} 项通过 · 被测视口 ${win.innerWidth} × ${win.innerHeight}\n${results.join('\n')}\n\n边界：Boss/转场测试使用指定状态夹具；全八关真实攻击推进由 Node 流程测试另行验证。`;
document.title=`${failures?'FAIL':'PASS'} ${results.length-failures}/${results.length} · 浏览器验证`;
window.browserVerification={failures,results};
