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
  switch (weapon) {
    case "rifle":
      return "RIFLE";
    case "rapid":
      return "RAPID";
    case "spread":
      return "SPREAD";
    case "laser":
      return "LASER";
  }
}

export function createUi() {
  const briefing = requiredElement("briefing");
  const pausePanel = requiredElement("pause-panel");
  const resultPanel = requiredElement("result-panel");
  const bossHud = requiredElement("boss-hud");
  const manual = requiredDialog("manual-dialog");
  const toast = requiredElement("toast");
  let toastTimer = 0;

  requiredElement("manual-button").addEventListener("click", () => manual.showModal());
  requiredElement("restart-button").addEventListener("click", () => window.location.reload());

  return {
    crosshair: requiredElement("crosshair"),
    onStart(handler: () => void): void {
      requiredElement("start-button").addEventListener("click", handler);
    },
    setPhase(phase: GamePhase): void {
      briefing.hidden = phase !== "briefing";
      briefing.classList.toggle("overlay--visible", phase === "briefing");
      pausePanel.hidden = phase !== "paused";
      resultPanel.hidden = phase !== "game-over" && phase !== "victory";
    },
    updateHud(state: HudState): void {
      requiredElement("lives").textContent = `× ${state.lives}`;
      requiredElement("score").textContent = state.score.toString().padStart(6, "0");
      requiredElement("weapon").textContent = weaponLabel(state.weapon);
      requiredElement("progress-text").textContent = `${state.progress}%`;
      requiredElement("progress-bar").style.width = `${state.progress}%`;
      bossHud.hidden = !state.bossActive;
      requiredElement("boss-health").style.width = `${state.bossHealth}%`;
    },
    toast(message: string): void {
      window.clearTimeout(toastTimer);
      toast.textContent = message;
      toast.classList.add("toast--visible");
      toastTimer = window.setTimeout(() => toast.classList.remove("toast--visible"), 2200);
    },
    showResult(victory: boolean, score: number): void {
      requiredElement("result-kicker").textContent = victory
        ? "MISSION COMPLETE"
        : "MISSION FAILED";
      requiredElement("result-title").textContent = victory ? "堡垒已摧毁" : "战士倒下";
      requiredElement("result-copy").textContent = victory
        ? `红隼防线崩溃。最终得分 ${score.toString().padStart(6, "0")}。`
        : `最终得分 ${score.toString().padStart(6, "0")}。重整装备，再次出击。`;
    },
  };
}
