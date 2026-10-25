import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "evidence");
const reportFile = resolve(output, process.env.REPORT_NAME || "browser-report.json");
const modulePath = process.env.PLAYWRIGHT_MODULE;
const playwright = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
const { chromium } = playwright.default ?? playwright;
const base = process.env.BASE_URL || "http://127.0.0.1:5173/?test=1";
const soakSeconds = Math.max(0, Number(process.env.SOAK_SECONDS ?? "30"));
const report = {
  started: new Date().toISOString(),
  base,
  soakSeconds,
  chromiumExecutable: process.env.CHROMIUM_EXECUTABLE ?? "Playwright default",
  checks: [],
  errors: [],
  performance: [],
  limitations: [
    "Chromium desktop and CDP touch emulation; no physical phone or Safari hardware test.",
    "Fixture scenarios are explicitly prepared through dev-only runtime; the full level run uses keyboard only and visibly enabled invincibility.",
    "Frame percentiles use the renderer rolling window of at most 600 samples and exclude intervals >= 200 ms; CPU render submission time is not GPU frame duration or a heap-leak measurement.",
    "Blur is a dispatched DOM event. Headless tab focus and Page.freeze did not produce visibilitychange; real OS background switching is not claimed.",
  ],
};
await mkdir(output, { recursive: true });
let browser;
const snap = (page) => page.evaluate(() => window.__contra.snapshot());
const pause = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
async function check(name, body) {
  const start = Date.now();
  await body();
  report.checks.push({ name, passed: true, durationMs: Date.now() - start });
  console.log(`PASS ${name}`);
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
}
async function down(page, code) {
  await page.keyboard.down(code);
}
async function up(page, code) {
  await page.keyboard.up(code);
}
async function waitState(page, predicate, timeout = 5000) {
  await page.waitForFunction(predicate, undefined, { timeout });
  return snap(page);
}
async function scenario(page, name, fn, arg) {
  report.checks.push({ fixture: name });
  await page.evaluate(fn, arg);
  await page.locator("#viewport").focus();
}
async function restart(page) {
  const state = await snap(page);
  if (state.phase === "playing") await page.keyboard.press("Escape");
  await page.waitForFunction(() =>
    ["paused", "game-over", "victory"].includes(window.__contra.snapshot().phase),
  );
  const phase = (await snap(page)).phase;
  await page.locator(phase === "paused" ? "#pause-restart-button" : "#restart-button").click();
  await waitState(page, () => window.__contra.snapshot().phase === "playing");
}

try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
  });
  report.browser = browser.version();
  if (process.env.PRODUCTION_URL) {
    await check("production does not expose dev test hook, including with test query", async () => {
      const production = await browser.newPage();
      await production.goto(process.env.PRODUCTION_URL, { waitUntil: "networkidle" });
      assert.equal(await production.evaluate(() => typeof window.__contra), "undefined");
      assert.equal(await production.locator("#debug-state").count(), 0);
      assert.equal(await production.locator("canvas").count(), 1);
      report.production = {
        url: process.env.PRODUCTION_URL,
        devHook: false,
        debugState: false,
        canvas: true,
      };
      await production.close();
    });
  }
  if (process.env.CAPTURE_CHARACTERS === "1") {
    const visualContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const visual = await visualContext.newPage();
    await visual.goto(base, { waitUntil: "networkidle" });
    await visual.locator("#invincible-option").check();
    await visual.locator("#start-button").click();
    await scenario(
      visual,
      "pixel character visual fixture: clear enemies, x=6, no spawn flicker, explicit invincibility",
      () => {
        const r = window.__contra.runtime;
        for (const e of r.enemies) {
          e.alive = false;
          e.mesh.visible = false;
        }
        r.player.model.root.position.set(6, 0, 0);
        r.player.invulnerableUntil = 0;
        r.player.velocityX = 0;
        r.player.velocityY = 0;
        r.player.grounded = true;
        r.player.groundId = "bank-west";
      },
    );
    report.characterSnapshots = [];
    const capturePose = async (name) => {
      await visual.screenshot({ path: resolve(output, `browser-character-${name}.png`) });
      report.characterSnapshots.push({ name, state: await snap(visual), fixture: true });
    };
    await pause(100);
    await capturePose("standing");
    await down(visual, "KeyD");
    await pause(120);
    await capturePose("running");
    await up(visual, "KeyD");
    await down(visual, "KeyS");
    await waitState(visual, () => window.__contra.snapshot().player.pose === "prone");
    await capturePose("prone");
    await up(visual, "KeyS");
    await down(visual, "KeyW");
    await down(visual, "KeyD");
    await visual.keyboard.press("KeyJ");
    await pause(80);
    await capturePose("diagonal");
    await up(visual, "KeyW");
    await up(visual, "KeyD");
    await visual.keyboard.press("KeyK");
    await waitState(visual, () => window.__contra.snapshot().player.y > 1.1);
    await capturePose("jumping");
    await visual.setViewportSize({ width: 1920, height: 1080 });
    await visual.evaluate(async () => {
      const THREE = await import("/node_modules/three/build/three.module.js");
      const { createPixelCharacter } = await import("/src/game/pixel-character.ts");
      const board = document.createElement("div");
      board.style.cssText =
        "position:fixed;inset:0;z-index:10000;background:#102128;color:#f2ebd5;font:24px monospace";
      document.body.append(board);
      const renderer = new THREE.WebGLRenderer({ antialias: false });
      renderer.setSize(1920, 1080);
      renderer.setPixelRatio(1);
      board.append(renderer.domElement);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x102128);
      const camera = new THREE.OrthographicCamera(-9.6, 9.6, 5.4, -5.4, 0.1, 100);
      camera.position.z = 10;
      const poses = [
        ["STANDING", "standing", 0, false, 0, false],
        ["RUNNING", "standing", 0.21, true, 0, false],
        ["PRONE", "prone", 0, false, 0, false],
        ["JUMP / ROLL", "jumping", 0.2, false, 0, false],
        ["AIM UP", "standing", 0, false, Math.PI / 2, false],
        ["AIM DIAGONAL", "standing", 0, false, Math.PI / 4, false],
        ["SWIMMING", "swimming", 0, false, 0, false],
        ["DIVING", "diving", 0, false, 0, false],
        ["ENEMY STANDING", "standing", 0, false, 0, true],
        ["ENEMY RUNNING", "standing", 0.21, true, 0, true],
        ["DEAD", "dead", 0, false, 0, false],
        ["AIM DOWN", "jumping", 0, false, -Math.PI / 4, false],
      ];
      poses.forEach(([label, pose, now, moving, angle, enemy], index) => {
        const model = createPixelCharacter(enemy);
        model.setPose(pose, now, moving, angle);
        if (model.body.material.map.magFilter !== THREE.NearestFilter)
          throw new Error("Pixel atlas requires nearest filtering");
        model.root.position.set(-7.2 + (index % 4) * 4.8, 2.4 - Math.floor(index / 4) * 3.25, 0);
        scene.add(model.root);
        const text = document.createElement("span");
        text.textContent = label;
        text.style.cssText = `position:absolute;left:${(index % 4) * 480 + 100}px;top:${Math.floor(index / 4) * 325 + 325}px`;
        board.append(text);
      });
      renderer.render(scene, camera);
    });
    await visual.screenshot({ path: resolve(output, "browser-character-pose-board.png") });
    await visualContext.close();
    console.log("PASS pixel character visual captures and nearest-filter pose board");
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    report.errors.push({ type: "pageerror", message: error.message }),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      report.errors.push({ type: "console", message: message.text() });
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__contra);
  await check("default classic and invincibility off", async () => {
    assert.equal(await page.locator("#game-mode").inputValue(), "classic");
    assert.equal(await page.locator("#invincible-option").isChecked(), false);
    assert.deepEqual((await snap(page)).options, { mode: "classic", invincible: false });
  });
  await check("binding conflict rejection and reload persistence", async () => {
    await page.locator("#manual-button").click();
    await page.locator('[data-bind="fire"]').click();
    await page.keyboard.press("KeyA");
    assert.match(await page.locator("#binding-message").innerText(), /已被其他操作使用/);
    await page.keyboard.press("KeyF");
    assert.equal(await page.locator('[data-bind="fire"] [data-binding="fire"]').innerText(), "F");
    await page.getByRole("button", { name: "关闭操作与设置" }).click();
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#manual-button").click();
    assert.equal(await page.locator('[data-bind="fire"] [data-binding="fire"]').innerText(), "F");
    await page.locator("#reset-bindings").click();
    await page.getByRole("button", { name: "关闭操作与设置" }).click();
  });
  await page.locator("#start-button").click();
  await check("keyboard movement and prone keep z locked", async () => {
    const before = await snap(page);
    await down(page, "KeyD");
    await pause(250);
    await up(page, "KeyD");
    const after = await snap(page);
    assert(after.player.x > before.player.x + 0.5);
    await down(page, "KeyS");
    await waitState(page, () => window.__contra.snapshot().player.pose === "prone");
    assert.equal((await snap(page)).player.z, 0);
    await up(page, "KeyS");
  });
  await check("real jump key crosses then lands on a one-way platform", async () => {
    await scenario(
      page,
      "position below opening ledge; disable enemies for isolated movement",
      () => {
        const r = window.__contra.runtime;
        for (const e of r.enemies) {
          e.alive = false;
          e.mesh.visible = false;
        }
        const p = r.player;
        p.model.root.position.set(13, 0, 0);
        p.grounded = true;
        p.groundId = "bank-west";
        p.velocityX = 0;
        p.velocityY = 0;
      },
    );
    await page.keyboard.press("KeyK");
    await waitState(page, () => window.__contra.snapshot().player.y > 2.5);
    await waitState(
      page,
      () =>
        window.__contra.snapshot().player.groundId === "ledge-one" &&
        window.__contra.snapshot().player.grounded,
    );
    assert(Math.abs((await snap(page)).player.y - 2.5) < 0.001);
    await down(page, "KeyS");
    await page.keyboard.press("KeyK");
    await up(page, "KeyS");
    await waitState(page, () => window.__contra.snapshot().player.groundId === "bank-west");
  });
  await check(
    "keyboard fire launches shots and pause freezes simulation for 2.2 seconds",
    async () => {
      await page.keyboard.press("KeyJ");
      await waitState(page, () => window.__contra.snapshot().shots > 0);
      await scenario(
        page,
        "set a three-second invulnerability deadline for pause observation",
        () => {
          const r = window.__contra.runtime;
          r.player.invulnerableUntil = r.simulationTime + 3;
        },
      );
      await down(page, "KeyD");
      await down(page, "KeyJ");
      await page.keyboard.press("Escape");
      await waitState(page, () => window.__contra.snapshot().phase === "paused");
      const before = await snap(page);
      await pause(2200);
      const after = await snap(page);
      assert.equal(after.time, before.time);
      assert.equal(after.player.invulnerableUntil, before.player.invulnerableUntil);
      assert.deepEqual(after.held, []);
      await up(page, "KeyD");
      await up(page, "KeyJ");
      await page.locator("#resume-button").click();
      await pause(180);
      assert.equal((await snap(page)).player.x, before.player.x);
    },
  );
  await check("blur event releases input and pauses without consuming game time", async () => {
    await down(page, "KeyD");
    await pause(120);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await waitState(page, () => window.__contra.snapshot().phase === "paused");
    const before = await snap(page);
    await pause(2100);
    const after = await snap(page);
    assert.equal(after.time, before.time);
    assert.deepEqual(after.held, []);
    await up(page, "KeyD");
    await page.locator("#resume-button").click();
    const x = (await snap(page)).player.x;
    await pause(160);
    assert.equal((await snap(page)).player.x, x);
  });
  await check("all five weapons hit through actual keyboard and browser simulation", async () => {
    const weaponHits = [];
    for (const weapon of ["rifle", "machine", "fire", "spread", "laser"]) {
      await scenario(
        page,
        `${weapon}: standing target four units ahead, no incoming fire`,
        (kind) => {
          const r = window.__contra.runtime;
          for (const shot of r.playerShots) r.scene.remove(shot.mesh);
          r.playerShots.length = 0;
          for (const e of r.enemies) {
            e.alive = false;
            e.mesh.visible = false;
          }
          const p = r.player;
          p.model.root.position.set(5, 0, 0);
          p.grounded = true;
          p.groundId = "bank-west";
          p.pose = "standing";
          p.weapon = kind;
          p.rapid = false;
          p.nextShotAt = r.simulationTime;
          p.aimX = 1;
          p.aimY = 0;
          p.velocityX = 0;
          p.velocityY = 0;
          r.cameraX = 12;
          const target = r.enemies.find((e) => e.kind === "gunner");
          target.alive = true;
          target.active = true;
          target.hp = 20;
          target.mesh.position.set(9, 0, 0);
          target.nextShotAt = Infinity;
        },
        weapon,
      );
      await page.keyboard.press("KeyJ");
      await page.waitForFunction(
        () => window.__contra.runtime.enemies.find((e) => e.kind === "gunner").hp < 20,
      );
      const hp = await page.evaluate(
        () => window.__contra.runtime.enemies.find((e) => e.kind === "gunner").hp,
      );
      weaponHits.push({ weapon, hp });
    }
    report.weaponHits = weaponHits;
  });
  await check("actual hostile contact kills then respawns in the current screen", async () => {
    await scenario(page, "a live runner at x=8; vulnerable player at x=5 with S+R", () => {
      const r = window.__contra.runtime;
      const p = r.player;
      for (const shots of [r.playerShots, r.enemyShots]) {
        for (const shot of shots) r.scene.remove(shot.mesh);
        shots.length = 0;
      }
      p.model.root.position.set(5, 0, 0);
      p.grounded = true;
      p.groundId = "bank-west";
      p.pose = "standing";
      p.invulnerableUntil = 0;
      p.weapon = "spread";
      p.rapid = true;
      r.cameraX = 12;
      const e = r.enemies.find((enemy) => enemy.kind === "runner");
      e.alive = true;
      e.mesh.visible = true;
      e.mesh.position.set(8, 0, 0);
      e.facing = -1;
      e.velocityY = 0;
    });
    await down(page, "KeyD");
    await waitState(page, () => window.__contra.snapshot().player.pose === "dead");
    await up(page, "KeyD");
    const death = await snap(page);
    assert.equal(death.player.lives, 2);
    assert.equal(death.player.weapon, "rifle");
    assert.equal(death.player.rapid, false);
    await waitState(page, () => window.__contra.snapshot().player.pose !== "dead");
    const respawn = await snap(page);
    assert(respawn.player.x >= death.cameraX - 14);
    assert(respawn.player.invulnerableUntil > respawn.time);
  });
  await check(
    "keyboard shots destroy core with mortars alive, restart resets the stage",
    async () => {
      await scenario(
        page,
        "place shooter in boss arena; one-hit core, living mortar guards",
        () => {
          const r = window.__contra.runtime;
          const p = r.player;
          p.model.root.position.set(140, 0, 0);
          p.grounded = true;
          p.groundId = "bank-east";
          p.pose = "standing";
          p.facing = 1;
          p.aimX = 1;
          p.aimY = 0;
          p.velocityX = 0;
          p.velocityY = 0;
          p.nextShotAt = r.simulationTime;
          p.invulnerableUntil = r.simulationTime + 3;
          r.cameraX = 136;
          const core = r.enemies.find((e) => e.kind === "core");
          core.hp = 1;
          core.alive = true;
          core.mesh.visible = true;
          for (const guard of r.enemies.filter((e) => e.kind === "mortar")) {
            guard.alive = true;
            guard.mesh.visible = true;
          }
        },
      );
      const guardsBefore = await page.evaluate(() =>
        window.__contra.runtime.enemies
          .filter((e) => e.kind === "mortar")
          .map((e) => ({ alive: e.alive, hp: e.hp })),
      );
      assert.equal(guardsBefore.length, 2);
      assert(guardsBefore.every((guard) => guard.alive));
      await page.keyboard.press("KeyJ");
      await waitState(page, () => window.__contra.snapshot().phase === "victory");
      const guardsAfter = await page.evaluate(() =>
        window.__contra.runtime.enemies
          .filter((e) => e.kind === "mortar")
          .map((e) => ({ alive: e.alive, hp: e.hp })),
      );
      assert.deepEqual(
        guardsAfter.map((guard) => guard.hp),
        guardsBefore.map((guard) => guard.hp),
      );
      assert(guardsAfter.every((guard) => !guard.alive));
      await page.screenshot({ path: resolve(output, "browser-victory.png") });
      await page.locator("#restart-button").click();
      const fresh = await snap(page);
      assert.equal(fresh.phase, "playing");
      assert.equal(fresh.player.lives, 3);
      assert.equal(fresh.player.weapon, "rifle");
      assert.equal(fresh.bridgesDestroyed, 0);
      assert.equal(fresh.bossHealth, 100);
    },
  );
  await page.screenshot({ path: resolve(output, "browser-desktop.png") });
  report.performance.push({ label: "desktop-smoke", state: await snap(page) });
  await context.close();
  if (process.env.SMOKE_ONLY !== "1") {
    const mobile = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1,
    });
    const touchPage = await mobile.newPage();
    touchPage.on("pageerror", (error) =>
      report.errors.push({ type: "touch-pageerror", message: error.message }),
    );
    await touchPage.goto(base, { waitUntil: "networkidle" });
    await touchPage.locator("#start-button").tap();
    const cdp = await mobile.newCDPSession(touchPage);
    const touchPoint = async (selector, id) => {
      const box = await touchPage.locator(selector).boundingBox();
      assert(box, `missing visible touch target ${selector}`);
      return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        id,
        radiusX: 6,
        radiusY: 6,
        force: 1,
      };
    };
    await check(
      "CDP multi-touch move + jump + fire, drag-out capture, release and cancel",
      async () => {
        await scenario(
          touchPage,
          "touch input fixture: M weapon with no enemy interference",
          () => {
            const r = window.__contra.runtime;
            for (const e of r.enemies) {
              e.alive = false;
              e.mesh.visible = false;
            }
            r.player.weapon = "machine";
          },
        );
        const points = await Promise.all([
          touchPoint('[data-hold="right"]', 1),
          touchPoint('[data-hold="jump"]', 2),
          touchPoint('[data-hold="fire"]', 3),
        ]);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points });
        await pause(180);
        const active = await snap(touchPage);
        assert(
          active.held.includes("right") &&
            active.held.includes("jump") &&
            active.held.includes("fire"),
        );
        assert(active.player.y > 0 && active.player.x > 1);
        assert(active.shots > 0);
        const moved = points.map((point, index) =>
          index === 0 ? { ...point, x: 400, y: 180 } : point,
        );
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: moved });
        assert((await snap(touchPage)).held.includes("right"));
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await waitState(touchPage, () => window.__contra.snapshot().held.length === 0);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [points[0], points[2]],
        });
        await pause(80);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
        await waitState(touchPage, () => window.__contra.snapshot().held.length === 0);
        await touchPage.screenshot({ path: resolve(output, "browser-touch-landscape.png") });
      },
    );
    await check("portrait touch controls and pause/resume remain reachable", async () => {
      await touchPage.setViewportSize({ width: 390, height: 844 });
      const controls = [
        '[data-hold="right"]',
        '[data-hold="jump"]',
        '[data-hold="fire"]',
        "#pause-button",
      ];
      for (const selector of controls) {
        const box = await touchPage.locator(selector).boundingBox();
        assert(
          box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844,
          `off-screen ${selector}`,
        );
      }
      await touchPage.locator("#pause-button").tap();
      const before = await snap(touchPage);
      await pause(300);
      assert.equal((await snap(touchPage)).time, before.time);
      await touchPage.locator("#resume-button").tap();
      await touchPage.screenshot({ path: resolve(output, "browser-touch-portrait.png") });
    });
    report.performance.push({ label: "touch-emulation", state: await snap(touchPage) });
    await mobile.close();

    const journeyContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const journey = await journeyContext.newPage();
    journey.on("pageerror", (error) =>
      report.errors.push({ type: "journey-pageerror", message: error.message }),
    );
    await journey.goto(base, { waitUntil: "networkidle" });
    await journey.locator("#invincible-option").check();
    await journey.locator("#start-button").click();
    assert.match(await journey.locator("#mode-badge").innerText(), /无敌开启/);
    let jumpedGap = false;
    let clears = 0;
    let lastShot = 0;
    const journeySamples = [];
    async function crossFinalGap() {
      await up(journey, "KeyD");
      await pause(80);
      let stopped = await snap(journey);
      assert(stopped.player.grounded, "driver must stop on solid bank before final gap");
      const approach = [];
      for (
        let pulse = 0;
        pulse < 40 && (stopped.player.x < 120.05 || stopped.player.x > 120.5);
        pulse += 1
      ) {
        const key = stopped.player.x < 120.05 ? "KeyD" : "KeyA";
        await journey.keyboard.down(key);
        await pause(20);
        await journey.keyboard.up(key);
        await pause(45);
        stopped = await snap(journey);
        approach.push({ x: stopped.player.x, y: stopped.player.y, time: stopped.time });
        assert(stopped.player.grounded, "gap approach crossed bank before jump input");
      }
      assert(
        stopped.player.x >= 120.05 && stopped.player.x <= 120.5,
        "driver did not establish safe takeoff",
      );
      const pressedAt = Date.now();
      await down(journey, "KeyD");
      await journey.keyboard.press("KeyK");
      const airborne = await waitState(journey, () => window.__contra.snapshot().player.y > 0.05);
      assert(!airborne.player.grounded);
      journeySamples.push({
        action: "gap-jump",
        approach,
        state: stopped,
        airborne,
        inputToObservationMs: Date.now() - pressedAt,
      });
      jumpedGap = true;
    }
    async function playStep() {
      let state = await snap(journey);
      assert.equal(
        state.player.lastDamage,
        "",
        `unexpected rescue recorded: ${state.player.lastDamage}`,
      );
      if (state.phase === "victory") {
        clears += 1;
        return "victory";
      }
      assert.equal(state.phase, "playing", `unexpected phase ${state.phase}`);
      assert.notEqual(
        state.player.pose,
        "dead",
        `unexpected rescue/death at x=${state.player.x}: ${state.player.lastDamage}`,
      );
      assert.equal(state.player.z, 0);
      if (state.player.x >= 118 && state.player.x < 121 && state.player.grounded && !jumpedGap) {
        await crossFinalGap();
        state = await snap(journey);
      }
      if (state.player.x < 138) await down(journey, "KeyD");
      else await up(journey, "KeyD");
      if (Date.now() - lastShot >= 145) {
        await journey.keyboard.press("KeyJ");
        lastShot = Date.now();
      }
      await pause(90);
      return "playing";
    }
    await check(
      "complete first stage from spawn with keyboard only and explicit invincibility",
      async () => {
        const startedAt = Date.now();
        let complete = false;
        let sampledAt = 0;
        while (Date.now() - startedAt < 90000) {
          if ((await playStep()) === "victory") {
            complete = true;
            break;
          }
          if (Date.now() - sampledAt > 5000) {
            journeySamples.push({ state: await snap(journey) });
            sampledAt = Date.now();
          }
        }
        assert(complete, "keyboard-only full stage did not clear within 90 seconds");
        assert(jumpedGap, "full run did not exercise the final gap jump");
        const state = await snap(journey);
        assert.equal(state.bossHealth, 0);
        assert.equal(state.player.lives, 3);
        assert.equal(state.bridgesDestroyed, 15);
        await journey.screenshot({ path: resolve(output, "browser-full-stage-victory.png") });
        report.journey = {
          clears,
          durationMs: Date.now() - startedAt,
          samples: journeySamples,
          final: state,
          runtimeMutation: false,
          advanceCalls: 0,
          assistance: "invincible selected in title UI",
        };
      },
    );
    await restart(journey);
    jumpedGap = false;
    const warm = await snap(journey);
    report.performance.push({ label: "after-first-complete-run-restart", state: warm });
    if (soakSeconds > 0) {
      await check(
        `${soakSeconds}-second wall-clock keyboard gameplay soak with repeated restart`,
        async () => {
          const start = Date.now();
          let sampled = start;
          let progress = start;
          let restarts = 0;
          const samples = [];
          const restartMemory = [];
          report.soak = {
            requestedSeconds: soakSeconds,
            elapsedSeconds: 0,
            restarts: 0,
            clears,
            samples,
            restartMemory,
            input: "real keyboard only",
            runtimeMutation: false,
            advanceCalls: 0,
          };
          while (Date.now() - start < soakSeconds * 1000) {
            if ((await playStep()) === "victory") {
              await restart(journey);
              jumpedGap = false;
              restarts += 1;
              await pause(100);
              const state = await snap(journey);
              restartMemory.push({
                restart: restarts,
                elapsedSeconds: (Date.now() - start) / 1000,
                performance: state.performance,
              });
            }
            report.soak.elapsedSeconds = (Date.now() - start) / 1000;
            report.soak.restarts = restarts;
            report.soak.clears = clears;
            if (Date.now() - sampled >= 10000) {
              const state = await snap(journey);
              samples.push({ elapsedSeconds: (Date.now() - start) / 1000, state });
              report.performance.push({
                label: `soak-${Math.floor((Date.now() - start) / 1000)}s`,
                state,
              });
              sampled = Date.now();
            }
            if (Date.now() - progress >= 60000) {
              console.log(
                `SOAK progress ${Math.floor((Date.now() - start) / 1000)}/${soakSeconds}s, restarts=${restarts}, frameP95=${(await snap(journey)).performance.frameMsP95.toFixed(2)}ms`,
              );
              progress = Date.now();
              await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
            }
          }
          await up(journey, "KeyD");
          const stable = restartMemory.map((sample) => sample.performance.geometries);
          const geometryUpperBound = warm.performance.geometries + 214;
          assert(
            stable.every((count) => count <= geometryUpperBound),
            `geometry count exceeds finite atlas allowance ${geometryUpperBound}: ${stable.join(",")}`,
          );
          const textureCounts = restartMemory.map((sample) => sample.performance.textures);
          assert(
            textureCounts.every((count) => count <= warm.performance.textures + 1),
            `texture count grows beyond warmed atlas allowance: ${textureCounts.join(",")}`,
          );
          report.soak = {
            requestedSeconds: soakSeconds,
            elapsedSeconds: (Date.now() - start) / 1000,
            restarts,
            clears,
            samples,
            restartMemory,
            final: await snap(journey),
            input: "real keyboard only",
            runtimeMutation: false,
            advanceCalls: 0,
            resourceBounds: {
              warmedGeometries: warm.performance.geometries,
              finitePixelFrames: 214,
              geometryUpperBound,
              textureUpperBound: warm.performance.textures + 1,
              restartGeometries: stable,
              restartTextures: textureCounts,
            },
          };
          const memory = [
            warm.performance,
            ...samples.map((sample) => sample.state.performance),
            report.soak.final.performance,
          ];
          assert(
            memory.every((item) => item.geometries <= geometryUpperBound),
            "sample geometry count exceeds the finite atlas bound",
          );
          assert(
            memory.every((item) => item.textures <= warm.performance.textures + 1),
            "sample texture count exceeds the warmed bound",
          );
          report.soak.memory = {
            first: { geometries: memory[0].geometries, textures: memory[0].textures },
            last: { geometries: memory.at(-1).geometries, textures: memory.at(-1).textures },
            max: {
              geometries: Math.max(...memory.map((item) => item.geometries)),
              textures: Math.max(...memory.map((item) => item.textures)),
            },
          };
          await journey.screenshot({ path: resolve(output, "browser-soak-final.png") });
        },
      );
    }
    await journeyContext.close();
  }
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
  report.finished = new Date().toISOString();
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.finished = new Date().toISOString();
  report.failure = { message: error.message, stack: error.stack };
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  await browser?.close();
  execFileSync(resolve(here, "../node_modules/.bin/biome"), ["format", "--write", reportFile], {
    stdio: "inherit",
  });
}
