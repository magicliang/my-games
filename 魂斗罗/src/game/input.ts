import { classicCodeComplete } from "./rules";

export const Control = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
  jump: "jump",
  fire: "fire",
  pause: "pause",
} as const;

export type ControlCode = (typeof Control)[keyof typeof Control];
export type KeyBindings = Record<ControlCode, readonly string[]>;

export const DEFAULT_BINDINGS: KeyBindings = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  jump: ["KeyK", "Space", "KeyX"],
  fire: ["KeyJ", "KeyZ"],
  pause: ["Escape"],
};

const STORAGE_KEY = "contra-jungle-keybindings-v1";
const CONTROLS = Object.values(Control);
const KEY_CODE =
  /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Enter|Escape|Backspace|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal)$/;

function validBindings(value: unknown): KeyBindings {
  if (typeof value !== "object" || value === null) throw new Error("键位格式无效");
  const used = new Set<string>();
  const result = {} as Record<ControlCode, string[]>;
  for (const action of CONTROLS) {
    const keys = (value as Record<string, unknown>)[action];
    if (!Array.isArray(keys) || keys.length === 0) throw new Error("每项操作至少需要一个按键");
    result[action] = [];
    for (const code of keys) {
      if (typeof code !== "string" || !KEY_CODE.test(code))
        throw new Error("请使用字母、数字、方向键或普通功能键");
      if (used.has(code))
        throw new Error(`${keyLabel(code)} 已被其他操作使用，请先更换该操作的键位`);
      used.add(code);
      result[action].push(code);
    }
  }
  return result;
}

export function keyLabel(code: string): string {
  const labels: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Space: "空格",
    Escape: "Esc",
    Enter: "Enter",
    Backspace: "⌫",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Semicolon: ";",
    Quote: "'",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Minus: "-",
    Equal: "=",
  };
  return labels[code] ?? code.replace(/^(Key|Digit)/, "");
}

function isControl(value: string): value is ControlCode {
  return CONTROLS.some((control) => control === value);
}

function blocksGameplay(target: EventTarget | null): boolean {
  return (
    document.querySelector("dialog[open]") !== null ||
    (target instanceof Element &&
      target.closest(
        "input, select, textarea, button:not([data-hold]), [contenteditable='true']",
      ) !== null)
  );
}

export class Input {
  readonly held = new Set<ControlCode>();
  readonly pressed = new Set<ControlCode>();
  private bindings = validBindings(DEFAULT_BINDINGS);
  private readonly sources = new Map<string, readonly ControlCode[]>();
  private readonly pointers = new Map<number, HTMLElement>();
  private readonly cleanup: (() => void)[] = [];
  private readonly deactivation = new Set<() => void>();
  private readonly classicKeys: string[] = [];
  private classicCodeReady = false;

  constructor() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) this.bindings = validBindings(JSON.parse(stored));
    } catch {
      // Private browsing and older/invalid saved bindings fall back to playable defaults.
    }
    this.listen(window, "keydown", (raw) => {
      const event = raw as KeyboardEvent;
      if (event.defaultPrevented || blocksGameplay(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) {
        this.clear();
        return;
      }
      if (event.repeat) return;
      this.classicKeys.push(event.code);
      if (this.classicKeys.length > 11) this.classicKeys.shift();
      if (classicCodeComplete(this.classicKeys)) this.classicCodeReady = true;
      const control = CONTROLS.find((action) => this.bindings[action].includes(event.code));
      if (control === undefined) return;
      this.activate(`key:${event.code}`, [control]);
      event.preventDefault();
    });
    this.listen(window, "keyup", (raw) => this.release(`key:${(raw as KeyboardEvent).code}`));
    this.listen(window, "blur", () => this.deactivate());
    this.listen(document, "visibilitychange", () => {
      if (document.hidden) this.deactivate();
    });
    const releasePointer = (raw: Event): void =>
      this.releasePointer((raw as PointerEvent).pointerId, raw.type !== "pointerup");
    this.listen(window, "pointerup", releasePointer);
    this.listen(window, "pointercancel", releasePointer);

    for (const element of document.querySelectorAll("[data-hold]")) {
      if (!(element instanceof HTMLElement)) continue;
      const controls = (element.getAttribute("data-hold") ?? "").split(" ").filter(isControl);
      if (controls.length === 0) continue;
      this.listen(element, "pointerdown", (raw) => {
        const event = raw as PointerEvent;
        if (event.button !== 0 || document.querySelector("dialog[open]") !== null) return;
        event.preventDefault();
        this.pointers.set(event.pointerId, element);
        this.activate(`pointer:${event.pointerId}`, controls);
        element.classList.add("is-held");
        element.setPointerCapture(event.pointerId);
      });
      this.listen(element, "pointerup", releasePointer);
      this.listen(element, "pointercancel", releasePointer);
      this.listen(element, "lostpointercapture", releasePointer);
      this.listen(element, "contextmenu", (event) => event.preventDefault());
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

  clear(): void {
    this.sources.clear();
    this.held.clear();
    this.pressed.clear();
    const pointers = [...this.pointers.entries()];
    this.pointers.clear();
    for (const [id, element] of pointers) {
      element.classList.remove("is-held");
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    }
  }

  onDeactivate(handler: () => void): void {
    this.deactivation.add(handler);
  }

  getBindings(): KeyBindings {
    return validBindings(this.bindings);
  }

  setBindings(bindings: Partial<KeyBindings>): void {
    const next = validBindings({ ...this.bindings, ...bindings });
    this.clear();
    this.bindings = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The current session still uses the new bindings when storage is unavailable.
    }
  }

  consumeClassicCode(): boolean {
    const ready = this.classicCodeReady;
    this.classicCodeReady = false;
    this.classicKeys.length = 0;
    return ready;
  }

  destroy(): void {
    this.clear();
    for (const remove of this.cleanup) remove();
    this.cleanup.length = 0;
    this.deactivation.clear();
  }

  private listen(target: EventTarget, name: string, handler: (event: Event) => void): void {
    target.addEventListener(name, handler);
    this.cleanup.push(() => target.removeEventListener(name, handler));
  }

  private deactivate(): void {
    this.clear();
    for (const handler of this.deactivation) handler();
  }

  private activate(source: string, controls: readonly ControlCode[]): void {
    this.sources.set(source, controls);
    for (const control of controls) {
      if (!this.held.has(control)) this.pressed.add(control);
      this.held.add(control);
    }
  }

  private release(source: string): void {
    const controls = this.sources.get(source);
    this.sources.delete(source);
    for (const control of controls ?? []) {
      if (![...this.sources.values()].some((actions) => actions.includes(control)))
        this.held.delete(control);
    }
  }

  private releasePointer(id: number, cancelled: boolean): void {
    const controls = this.sources.get(`pointer:${id}`) ?? [];
    const element = this.pointers.get(id);
    this.pointers.delete(id);
    this.release(`pointer:${id}`);
    if (cancelled) {
      for (const control of controls) {
        if (!this.held.has(control)) this.pressed.delete(control);
      }
    }
    if (element === undefined) return;
    if (![...this.pointers.values()].includes(element)) element.classList.remove("is-held");
    if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
  }
}
