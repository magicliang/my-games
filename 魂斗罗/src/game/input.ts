import { classicCodeComplete } from "./rules";

const Control = {
  forward: "KeyW",
  left: "KeyA",
  backward: "KeyS",
  right: "KeyD",
  jump: "Space",
  fire: "KeyJ",
  pause: "Escape",
  mouseFire: "Mouse0",
} as const;

type ControlCode = (typeof Control)[keyof typeof Control];

function parseControl(code: string): ControlCode | null {
  switch (code) {
    case Control.forward:
    case Control.left:
    case Control.backward:
    case Control.right:
    case Control.jump:
    case Control.fire:
    case Control.pause:
    case Control.mouseFire:
      return code;
    default:
      return null;
  }
}

export class Input {
  readonly held = new Set<ControlCode>();
  readonly pressed = new Set<ControlCode>();
  aimX = 0;
  aimY = 0;
  private readonly classicKeys: string[] = [];
  private classicCodeReady = false;

  constructor(crosshair: HTMLElement) {
    window.addEventListener("keydown", (event) => {
      this.classicKeys.push(event.code);
      if (this.classicKeys.length > 11) this.classicKeys.shift();
      this.classicCodeReady = classicCodeComplete(this.classicKeys);
      if (this.classicCodeReady) event.preventDefault();
      const control = parseControl(event.code);
      if (control === null) return;
      if (!this.held.has(control)) this.pressed.add(control);
      this.held.add(control);
      event.preventDefault();
    });
    window.addEventListener("keyup", (event) => {
      const control = parseControl(event.code);
      if (control !== null) this.held.delete(control);
    });
    window.addEventListener("pointermove", (event) => {
      this.aimX = (event.clientX / window.innerWidth) * 2 - 1;
      this.aimY = (event.clientY / window.innerHeight) * 2 - 1;
      crosshair.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    });
    window.addEventListener("pointerdown", (event) => {
      if (event.button === 0) this.held.add(Control.mouseFire);
    });
    window.addEventListener("pointerup", () => this.held.delete(Control.mouseFire));

    for (const element of document.querySelectorAll("[data-hold]")) {
      if (!(element instanceof HTMLElement)) continue;
      const control = parseControl(element.getAttribute("data-hold") ?? "");
      if (control === null) continue;
      element.addEventListener("pointerdown", () => {
        this.pressed.add(control);
        this.held.add(control);
      });
      const release = (): void => {
        this.held.delete(control);
      };
      element.addEventListener("pointerup", release);
      element.addEventListener("pointercancel", release);
    }
  }

  isHeld(control: ControlCode): boolean {
    return this.held.has(control);
  }

  consume(control: ControlCode): boolean {
    const wasPressed = this.pressed.has(control);
    this.pressed.delete(control);
    return wasPressed;
  }

  consumeClassicCode(): boolean {
    const ready = this.classicCodeReady;
    this.classicCodeReady = false;
    return ready;
  }
}

export { Control };
