import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.TWINBEE_PLAYWRIGHT_PATH || 'playwright');
const url = process.env.TWINBEE_URL || 'http://127.0.0.1:4173';
const out = process.env.TWINBEE_QA_DIR || '/private/tmp/twinbee-fc-qa';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.TWINBEE_BROWSER_CHANNEL ? { channel: process.env.TWINBEE_BROWSER_CHANNEL } : {}) });
const results = [], errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await page.waitForLoadState('networkidle');
  assert.equal(await page.title(), '兵蜂 FC | 经典纵向射击');
  assert.equal(await page.evaluate(() => workerBeeDebug.renderInfo().kind), 'canvas2d');
  assert.equal(await page.evaluate(() => typeof workerBeeDebug.state), 'undefined', '正常页面不能有修改状态的调试接口');
  await page.locator('#sound-button').click();
  await page.locator('#start-button').click();
  const snapshot = () => page.evaluate(() => workerBeeDebug.snapshot());
  const first = await snapshot();
  await page.keyboard.down('KeyA'); await page.waitForTimeout(200); await page.keyboard.up('KeyA');
  const left = await snapshot();
  assert.ok(left.player.x < first.player.x); assert.equal(left.bombs, 0); assert.equal(left.playerShots, 0);
  await page.keyboard.down('Space'); await page.waitForFunction(() => workerBeeDebug.snapshot().playerShots > 0); await page.keyboard.up('Space');
  assert.ok((await snapshot()).playerShots > 0, JSON.stringify({ first, left, after: await snapshot(), focused: await page.evaluate(() => document.activeElement?.id) }));
  await page.keyboard.press('KeyP');
  const paused = await snapshot(); await page.waitForTimeout(150);
  assert.equal((await snapshot()).stageTime, paused.stageTime);
  results.push('真实键盘：A只左移，空格射击，P暂停停止模拟');

  await page.locator('#assist-mode').selectOption('armor'); await page.locator('#armor-health').fill('25'); await page.locator('#assist-apply').click();
  assert.deepEqual((await snapshot()).assist, { mode:'armor', health:25 });
  assert.equal((await snapshot()).players[0].health, 25);
  await page.locator('#assist-mode').selectOption('invincible'); await page.locator('#assist-apply').click();
  assert.equal((await snapshot()).assist.mode, 'invincible');
  assert.match(await page.locator('#assist-status').textContent(), /无敌/);
  await page.locator('#fire-binding').click(); await page.keyboard.press('KeyA');
  assert.equal((await snapshot()).bindings.fire, 'Space', '不能把移动键设成射击');
  await page.keyboard.press('KeyL');
  assert.equal((await snapshot()).bindings.fire, 'KeyL');
  await page.locator('#bomb-binding').click(); await page.keyboard.press('KeyL');
  assert.equal((await snapshot()).bindings.bomb, 'KeyF', '两个动作不能占同一键');
  await page.keyboard.press('Escape');
  await page.reload(); await page.waitForLoadState('networkidle');
  assert.equal((await snapshot()).bindings.fire, 'KeyL');
  await page.locator('#reset-bindings').click();
  assert.deepEqual((await snapshot()).bindings, {fire:'Space',bomb:'KeyF'});
  results.push('设置UI：25血、切无敌、移动键/重复键冲突、Esc取消、刷新保留改键、恢复默认');

  await page.locator('#two-player-button').click();
  const dualStart = await snapshot();
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(150); await page.keyboard.up('ArrowLeft');
  const dualMoved = await snapshot();
  assert.equal(dualMoved.players[0].x, dualStart.players[0].x); assert.ok(dualMoved.players[1].x < dualStart.players[1].x);
  await page.keyboard.down('Comma'); await page.waitForFunction(() => workerBeeDebug.snapshot().playerShots > 0); await page.keyboard.up('Comma');
  assert.ok((await snapshot()).playerShots > 0);
  await page.screenshot({path:path.join(out,'dual-game.png'),fullPage:true});
  results.push('真实双人键盘：箭头只控制2P，逗号开火');

  // Deterministic fixtures use the same engine as normal play, behind ?debug only.
  await page.goto(url + '/?debug=1'); await page.waitForLoadState('networkidle');
  await page.locator('#assist-mode').selectOption('invincible'); await page.locator('#assist-apply').click();
  await page.locator('#start-button').click();
  await page.evaluate(() => workerBeeDebug.manual(true));
  await page.evaluate(() => {
    const s = workerBeeDebug.state(); s.player.invulnerable = 0;
    for(let i=0;i<100;i++) { WorkerBeeEngine.hurt(s,s.player); WorkerBeeEngine.hurt(s,s.player,true); }
  });
  assert.equal((await snapshot()).lives, 3); assert.deepEqual((await snapshot()).arms,{left:true,right:true});
  await page.locator('#assist-mode').selectOption('armor'); await page.locator('#armor-health').fill('12'); await page.locator('#assist-apply').click();
  await page.evaluate(() => { const s=workerBeeDebug.state(); s.player.invulnerable=0; WorkerBeeEngine.hurt(s,s.player); });
  assert.equal((await snapshot()).players[0].health, 11);
  await page.locator('#assist-mode').selectOption('invincible'); await page.locator('#assist-apply').click();
  await page.evaluate(() => {
    const s=workerBeeDebug.state(); s.groundTargets=[{x:s.player.x,y:s.player.y-70,radius:13,kind:'bush',fireClock:9,hp:1}];
    workerBeeDebug.manual(false);
  });
  await page.keyboard.down('KeyF');
  await page.waitForFunction(() => workerBeeDebug.snapshot().bombs > 0, {timeout:2000});
  await page.keyboard.up('KeyF');
  await page.waitForFunction(() => workerBeeDebug.snapshot().players[0].score >= 500, {timeout:2000});
  await page.evaluate(() => workerBeeDebug.manual(true));
  results.push('同引擎fixture：200次伤害无敌不掉臂/残机；12血中弹到11；真实F键锁定炸毁地物');

  for (let stage=0;stage<5;stage++) {
    await page.evaluate(stage => { workerBeeDebug.start(stage,1); workerBeeDebug.manual(true); workerBeeDebug.spawnBoss(); workerBeeDebug.step(160); },stage);
    assert.equal((await snapshot()).boss.kind, ['onion-head','parallel-dish','tiger-shark','claw-device','king-spice'][stage]);
    await page.screenshot({path:path.join(out,`boss-${stage+1}.png`)});
    await page.evaluate(() => { workerBeeDebug.defeatBoss(); workerBeeDebug.step(151); });
    assert.equal((await snapshot()).stageNumber,stage+2);
    if(stage===4) { assert.equal((await snapshot()).stageIndex,0); assert.equal((await snapshot()).loop,2); }
  }
  results.push('调试fixture：五种Boss均可绘制/过关；第5关后自动Stage6/第2周目，无结局重置');

  await page.evaluate(() => { workerBeeDebug.start(0,1); workerBeeDebug.manual(true); workerBeeDebug.step(420,[{fire:true}]); });
  await page.screenshot({path:path.join(out,'desktop-game.png'),fullPage:true});
  const mobile = await browser.newPage({ viewport:{width:375,height:844}, isMobile:true, hasTouch:true });
  mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.goto(url); await mobile.waitForLoadState('networkidle');
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await mobile.locator('#assist-mode').selectOption('invincible'); await mobile.locator('#assist-apply').click();
  await mobile.locator('#start-button').click();
  await mobile.locator('[data-control="fire"]').scrollIntoViewIfNeeded();
  const fireButton = await mobile.locator('[data-control="fire"]').boundingBox();
  const cdp=await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fireButton.x+fireButton.width/2,y:fireButton.y+fireButton.height/2}]});
  await mobile.waitForFunction(() => workerBeeDebug.snapshot().playerShots > 0);
  assert.ok(await mobile.evaluate(()=>workerBeeDebug.snapshot().playerShots>0));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await mobile.locator('[data-control="fire"]').evaluate(el=>el.classList.contains('is-pressed')),false);
  await mobile.locator('#pause-button').click();
  const mobilePaused=await mobile.evaluate(()=>workerBeeDebug.snapshot().stageTime);
  await mobile.waitForTimeout(120);
  assert.equal(await mobile.evaluate(()=>workerBeeDebug.snapshot().stageTime),mobilePaused);
  await mobile.screenshot({path:path.join(out,'mobile-settings.png'),fullPage:true});
  results.push('真实移动触摸：375px无横向滚动，触屏开火/松手/暂停，设置可用');

  const offline=await browser.newPage();
  offline.on('pageerror',error=>errors.push(error.message));
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  await offline.goto(pathToFileURL(path.join(root,'index.html')).href);
  await offline.locator('#start-button').click();
  assert.equal(await offline.evaluate(()=>workerBeeDebug.snapshot().mode),'playing');
  results.push('file://直接打开并开局通过，无运行依赖/联网需求');
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));
  console.log(JSON.stringify({results,errors,out},null,2));
} finally { await browser.close(); }
