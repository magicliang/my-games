import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const debuggerUrl = process.env.WORKER_BEE_DEBUGGER_URL || "http://127.0.0.1:9223/json/list";
const outputDir = process.env.WORKER_BEE_QA_DIR || "/private/tmp/workerbee-qa";
const tabs = await fetch(debuggerUrl).then((response) => response.json());
const tab = tabs.find((candidate) => candidate.type === "page" && candidate.url.startsWith("http://127.0.0.1:4173"));
assert.ok(tab, "没有找到工蜂浏览器页面");

await mkdir(outputDir, { recursive: true });
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let requestId = 0;
const pending = new Map();
const consoleErrors = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params.exceptionDetails;
    consoleErrors.push(details.exception?.description || details.text);
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    consoleErrors.push(message.params.args.map((arg) => arg.value || arg.description).join(" "));
  }
});

function send(method, params = {}) {
  const id = ++requestId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function key(code, keyValue, duration = 180) {
  const keyCode = keyValue.length === 1 ? keyValue.toUpperCase().charCodeAt(0) : 0;
  await send("Input.dispatchKeyEvent", { type: "keyDown", code, key: keyValue, windowsVirtualKeyCode: keyCode });
  await wait(duration);
  await send("Input.dispatchKeyEvent", { type: "keyUp", code, key: keyValue, windowsVirtualKeyCode: keyCode });
}

async function screenshot(name, fullPage = false) {
  let clip;
  if (fullPage) {
    const metrics = await send("Page.getLayoutMetrics");
    const { width, height } = metrics.cssContentSize;
    clip = { x: 0, y: 0, width, height, scale: 1 };
  }
  const result = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: fullPage,
    fromSurface: true,
    ...(clip ? { clip } : {}),
  });
  const path = `${outputDir}/${name}.png`;
  await writeFile(path, Buffer.from(result.data, "base64"));
  return path;
}

async function viewport(width, height, mobile = false) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height,
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
  await send("Page.reload", { ignoreCache: true });
  await wait(800);
}

await send("Runtime.enable");
await send("Page.enable");
await viewport(1280, 900, false);
consoleErrors.length = 0;

const desktopReady = await evaluate(`({
  title: document.title,
  ready: document.readyState,
  canvas: Boolean(document.querySelector('#game-canvas')),
  worldCanvas: Boolean(document.querySelector('#world-canvas')),
  controls: document.querySelectorAll('button').length,
  debug: typeof workerBeeDebug === 'object',
  renderer: workerBeeDebug.renderInfo?.() ?? null
})`);
assert.equal(desktopReady.title, "工蜂 3D | 五关街机射击");
assert.equal(desktopReady.ready, "complete");
assert.equal(desktopReady.canvas, true);
assert.equal(desktopReady.worldCanvas, true, "缺少独立的 WebGL 世界画布");
assert.equal(desktopReady.controls, 15);
assert.equal(desktopReady.debug, true);
assert.equal(desktopReady.renderer?.kind, "webgl2", "世界渲染器不是 WebGL2");
assert.equal(desktopReady.renderer?.depthTest, true, "WebGL 深度测试未启用");
assert.equal(desktopReady.renderer?.perspective, true, "相机没有使用透视投影");
const liveWebGL = await evaluate(`{
  const gl = document.querySelector('#world-canvas').getContext('webgl2');
  const program = gl.getParameter(gl.CURRENT_PROGRAM);
  const matrix = Array.from(gl.getUniform(program, gl.getUniformLocation(program, 'uViewProjection')));
  ({
    context: gl.constructor.name,
    depthTest: gl.isEnabled(gl.DEPTH_TEST),
    currentProgram: Boolean(program),
    perspectiveDivide: Math.abs(matrix[15] - 1) > 0.01,
    viewport: Array.from(gl.getParameter(gl.VIEWPORT))
  });
}`);
assert.equal(liveWebGL.context, "WebGL2RenderingContext");
assert.equal(liveWebGL.depthTest, true);
assert.equal(liveWebGL.currentProgram, true);
assert.equal(liveWebGL.perspectiveDivide, true, "GPU 当前矩阵仍是正交/单位投影");

const desktopReadyShot = await screenshot("desktop-ready");
await evaluate("document.querySelector('#start-button').click()");
await wait(100);
const desktopStartMid = await screenshot("desktop-start-mid");
await wait(400);
const beforeMove = await evaluate("workerBeeDebug.snapshot()");
await key("ArrowRight", "ArrowRight", 450);
const afterMove = await evaluate("workerBeeDebug.snapshot()");
assert.equal(afterMove.mode, "playing");
assert.ok(afterMove.player.x > beforeMove.player.x, "方向键没有移动机体");

await key("KeyJ", "j", 220);
await wait(120);
const afterFire = await evaluate("workerBeeDebug.snapshot()");
assert.ok(afterFire.playerShots > 0, "射击键没有生成子弹");
await wait(2200);
const activeRenderer = await evaluate("workerBeeDebug.renderInfo()");
assert.ok(activeRenderer.drawCalls >= 30, "WebGL 场景缺少足够的独立 3D 物体");
assert.ok(activeRenderer.triangles >= 2000, "WebGL 场景三角形数量不足，可能退化成平面伪 3D");
const desktopGame = await screenshot("desktop-game");
await evaluate("document.querySelector('#game-canvas').style.visibility = 'hidden'");
const webglWorldOnly = await screenshot("desktop-webgl-world-only");
await evaluate(`{
  document.querySelector('#game-canvas').style.visibility = '';
  workerBeeDebug.start(0);
  document.querySelector('#world-canvas').style.visibility = 'hidden';
}`);
await wait(100);
const hudLayerOnly = await screenshot("desktop-hud-layer-only");
await evaluate("document.querySelector('#world-canvas').style.visibility = ''");

const stageResults = [];
for (let stage = 0; stage < 5; stage += 1) {
  await evaluate(`workerBeeDebug.start(${stage}); workerBeeDebug.spawnBoss()`);
  await wait(120);
  const boss = await evaluate("workerBeeDebug.snapshot().boss");
  assert.ok(boss && boss.hp > 0, `第 ${stage + 1} 关 Boss 未生成`);
  await evaluate("workerBeeDebug.defeatBoss()");
  await wait(150);
  const result = await evaluate(`({
    mode: workerBeeDebug.snapshot().mode,
    title: document.querySelector('#overlay-title').textContent,
    button: document.querySelector('#start-button').textContent
  })`);
  assert.equal(result.mode, "stage-clear");
  stageResults.push(result);
}

await evaluate("document.querySelector('#start-button').click()");
await wait(100);
const victory = await evaluate(`({
  mode: workerBeeDebug.snapshot().mode,
  title: document.querySelector('#overlay-title').textContent,
  visible: document.querySelector('#game-overlay').classList.contains('overlay--visible')
})`);
assert.deepEqual(victory, { mode: "victory", title: "五关完成", visible: true });
const desktopVictory = await screenshot("desktop-victory", true);

await viewport(768, 1024, false);
await evaluate("document.querySelector('#start-button').click()");
await wait(2600);
const tabletGame = await screenshot("tablet-game", true);

await viewport(375, 844, true);
const mobileLayout = await evaluate(`({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  touchVisible: getComputedStyle(document.querySelector('.touch-controls')).display !== 'none',
  canvasWidth: Math.round(document.querySelector('#game-canvas').getBoundingClientRect().width)
})`);
assert.equal(mobileLayout.overflow, false, "手机页面出现横向滚动");
assert.equal(mobileLayout.touchVisible, true, "手机触控按钮不可见");
assert.ok(mobileLayout.canvasWidth <= 375, "画布超出手机宽度");

await evaluate("document.querySelector('#start-button').click()");
await wait(2600);
const mobileBefore = await evaluate("workerBeeDebug.snapshot()");
const fireButton = await evaluate(`{
  const rect = document.querySelector('[data-control="fire"]').getBoundingClientRect();
  ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
}`);
await send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: fireButton.x, y: fireButton.y, id: 7, radiusX: 2, radiusY: 2, force: 1 }],
});
await wait(100);
const mobileFirePressed = await screenshot("mobile-fire-pressed", true);
await wait(200);
await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await wait(120);
const mobileAfter = await evaluate("workerBeeDebug.snapshot()");
const fireButtonState = await evaluate(`{
  const button = document.querySelector('[data-control="fire"]');
  const style = getComputedStyle(button);
  ({ pressed: button.classList.contains('is-pressed'), borderRadius: style.borderRadius, width: style.width });
}`);
assert.ok(mobileAfter.playerShots > mobileBefore.playerShots, "触屏射击按钮没有生成子弹");
assert.equal(fireButtonState.pressed, false, "触屏射击按钮松开后仍保持按下状态");
const mobileGame = await screenshot("mobile-game", true);

assert.deepEqual(consoleErrors, []);
socket.close();

console.log(JSON.stringify({
  desktopReady,
  liveWebGL,
  movement: { before: beforeMove.player, after: afterMove.player },
  firing: afterFire.playerShots,
  activeRenderer,
  stages: stageResults,
  victory,
  mobileLayout,
  fireButtonState,
  screenshots: [desktopReadyShot, desktopStartMid, desktopGame, webglWorldOnly, hudLayerOnly, desktopVictory, tabletGame, mobileFirePressed, mobileGame],
  consoleErrors,
}, null, 2));
