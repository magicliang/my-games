import { type ControlCode, DEFAULT_BINDINGS, type Input, keyLabel } from "./input";
import type { GamePhase, HudState, WeaponKind } from "./types";

export type GameUi = ReturnType<typeof createUi>;

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new TypeError(`Missing #${id}`);
  return element;
}

function requiredDialog(id: string): HTMLDialogElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLDialogElement)) throw new TypeError(`Missing dialog #${id}`);
  return element;
}

function weaponLabel(weapon: WeaponKind): string {
  const labels: Record<WeaponKind, string> = {
    rifle: "普通枪",
    machine: "M · 连射",
    fire: "F · 火球",
    spread: "S · 散弹",
    laser: "L · 激光",
  };
  return labels[weapon];
}

export function createUi() {
  const briefing = requiredElement("briefing");
  const pausePanel = requiredElement("pause-panel");
  const resultPanel = requiredElement("result-panel");
  const bossHud = requiredElement("boss-hud");
  const manual = requiredDialog("manual-dialog");
  const toast = requiredElement("toast");
  const touchControls = requiredElement("touch-controls");
  const pauseButton = requiredElement("pause-button");
  const viewport = requiredElement("viewport");
  const modeBadge = requiredElement("mode-badge");
  const damageReport = requiredElement("damage-report");
  const bindingMessage = requiredElement("binding-message");
  const cancelBinding = requiredElement("cancel-binding");
  const hud = {
    lives: requiredElement("lives"),
    health: requiredElement("health"),
    score: requiredElement("score"),
    weapon: requiredElement("weapon"),
    progress: requiredElement("progress-text"),
    progressBar: requiredElement("progress-bar"),
    bossHealth: requiredElement("boss-health"),
  };
  let toastTimer = 0;
  let input: Input | null = null;
  let capturing: ControlCode | null = null;

  const refreshBindings = (): void => {
    const bindings = input?.getBindings() ?? DEFAULT_BINDINGS;
    for (const element of document.querySelectorAll<HTMLElement>("[data-binding]")) {
      const action = element.getAttribute("data-binding") as ControlCode;
      element.textContent = bindings[action].map(keyLabel).join(" / ");
    }
  };
  const finishCapture = (): void => {
    capturing = null;
    cancelBinding.hidden = true;
    for (const button of document.querySelectorAll("[data-bind]"))
      button.classList.remove("is-capturing");
  };
  const openSettings = (): void => {
    input?.clear();
    finishCapture();
    manual.showModal();
  };
  requiredElement("manual-button").addEventListener("click", openSettings);
  requiredElement("pause-settings-button").addEventListener("click", openSettings);
  manual.addEventListener("close", () => {
    finishCapture();
    input?.clear();
    viewport.focus({ preventScroll: true });
  });
  cancelBinding.addEventListener("click", () => {
    finishCapture();
    bindingMessage.textContent = "已取消改键。";
  });
  requiredElement("reset-bindings").addEventListener("click", () => {
    input?.setBindings(DEFAULT_BINDINGS);
    finishCapture();
    refreshBindings();
    bindingMessage.textContent = "已恢复默认键位。";
  });
  requiredElement("touch-option").addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement) {
      document.documentElement.classList.toggle("touch-forced", event.target.checked);
    }
  });
  for (const button of document.querySelectorAll<HTMLElement>("[data-bind]")) {
    button.addEventListener("click", () => {
      finishCapture();
      capturing = button.getAttribute("data-bind") as ControlCode;
      button.classList.add("is-capturing");
      cancelBinding.hidden = false;
      bindingMessage.textContent = "现在按新键。按键冲突时不会更改；也可点击“取消改键”。";
      input?.clear();
    });
  }
  window.addEventListener(
    "keydown",
    (event) => {
      if (capturing === null || !manual.open) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      try {
        input?.setBindings({ [capturing]: [event.code] });
        refreshBindings();
        bindingMessage.textContent = `已改为 ${keyLabel(event.code)}。`;
        finishCapture();
      } catch (error) {
        bindingMessage.textContent = error instanceof Error ? error.message : "无法设置该按键。";
      }
    },
    true,
  );

  const listenAction = (id: string, handler: () => void): void => {
    requiredElement(id).addEventListener("click", () => {
      input?.clear();
      handler();
      viewport.focus({ preventScroll: true });
    });
  };

  return {
    bindInput(value: Input): void {
      input = value;
      refreshBindings();
    },
    readOptions(): { mode: "classic" | "high-health"; invincible: boolean } {
      const mode = requiredElement("game-mode");
      const invincible = requiredElement("invincible-option");
      return {
        mode:
          mode instanceof HTMLSelectElement && mode.value === "high-health"
            ? "high-health"
            : "classic",
        invincible: invincible instanceof HTMLInputElement && invincible.checked,
      };
    },
    onStart(handler: () => void): void {
      listenAction("start-button", handler);
    },
    onRestart(handler: () => void): void {
      listenAction("restart-button", handler);
      listenAction("pause-restart-button", handler);
    },
    onPause(handler: () => void): void {
      listenAction("pause-button", handler);
    },
    onResume(handler: () => void): void {
      listenAction("resume-button", handler);
    },
    setPhase(phase: GamePhase): void {
      briefing.hidden = phase !== "briefing";
      briefing.classList.toggle("overlay--visible", phase === "briefing");
      pausePanel.hidden = phase !== "paused";
      resultPanel.hidden = phase !== "game-over" && phase !== "victory";
      touchControls.hidden = phase !== "playing";
      pauseButton.hidden = phase !== "playing";
      requiredElement("game-shell").setAttribute("data-phase", phase);
      if (phase !== "playing") input?.clear();
    },
    updateHud(state: HudState): void {
      hud.lives.textContent = `× ${state.lives}`;
      hud.health.textContent = state.maxHp > 1 ? `体力 ${state.hp}/${state.maxHp}` : "";
      hud.score.textContent = state.score.toString().padStart(6, "0");
      hud.weapon.textContent = `${weaponLabel(state.weapon)}${state.rapid && state.weapon !== "laser" ? " +R" : ""}`;
      hud.progress.textContent = `${state.progress}%`;
      hud.progressBar.style.width = `${state.progress}%`;
      bossHud.hidden = !state.bossActive;
      hud.bossHealth.style.width = `${state.bossHealth}%`;
      damageReport.hidden = state.lastDamage.length === 0;
      const damageText = state.lastDamage ? `最近受击：${state.lastDamage}` : "";
      if (damageReport.textContent !== damageText) damageReport.textContent = damageText;
      const assistance = state.mode === "high-health" || state.invincible || state.bonusLives;
      modeBadge.classList.toggle("mode-badge--assist", assistance);
      const modeText = `${assistance ? "辅助 · " : ""}${state.mode === "high-health" ? "高血量" : "经典"}${state.bonusLives ? " · 30命" : ""} · ${state.invincible ? "无敌开启" : "无敌关闭"}`;
      if (modeBadge.textContent !== modeText) modeBadge.textContent = modeText;
    },
    toast(message: string): void {
      window.clearTimeout(toastTimer);
      toast.textContent = message;
      toast.classList.add("toast--visible");
      toastTimer = window.setTimeout(() => toast.classList.remove("toast--visible"), 2600);
    },
    showResult(victory: boolean, score: number): void {
      requiredElement("result-kicker").textContent = victory
        ? "MISSION COMPLETE"
        : "MISSION FAILED";
      requiredElement("result-title").textContent = victory ? "堡垒已摧毁" : "战士倒下";
      requiredElement("result-copy").textContent = victory
        ? `第一关完成。最终得分 ${score.toString().padStart(6, "0")}。`
        : `最终得分 ${score.toString().padStart(6, "0")}。重新出击可从丛林起点再战。`;
    },
  };
}
