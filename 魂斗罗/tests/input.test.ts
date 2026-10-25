import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Control, Input } from "../src/game/input";

class FakeElement extends EventTarget {
  readonly style = {};
  readonly dataset: Record<string, string> = {};
  readonly classList = { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() };
  readonly capture = new Set<number>();
  blocked = false;
  constructor(private readonly hold: string | null = null) {
    super();
  }
  getAttribute(name: string): string | null {
    return name === "data-hold" ? this.hold : null;
  }
  closest(): FakeElement | null {
    return this.blocked ? this : null;
  }
  setPointerCapture(id: number): void {
    this.capture.add(id);
  }
  hasPointerCapture(id: number): boolean {
    return this.capture.has(id);
  }
  releasePointerCapture(id: number): void {
    this.capture.delete(id);
  }
}

class FakeDocument extends EventTarget {
  hidden = false;
  modal = false;
  readonly buttons = [new FakeElement("fire"), new FakeElement("right"), new FakeElement("jump")];
  querySelectorAll(): FakeElement[] {
    return this.buttons;
  }
  querySelector(): FakeElement | null {
    return this.modal ? (this.buttons[0] ?? null) : null;
  }
}

let host: EventTarget;
let doc: FakeDocument;
let input: Input;

function key(type: string, code: string, target?: FakeElement, repeat = false): void {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { code, repeat, metaKey: false, altKey: false, ctrlKey: false });
  if (target) Object.defineProperty(event, "target", { value: target });
  host.dispatchEvent(event);
}

function pointer(element: EventTarget, type: string, pointerId: number): void {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId, button: 0, pointerType: "touch" });
  element.dispatchEvent(event);
}

beforeEach(() => {
  host = new EventTarget();
  doc = new FakeDocument();
  vi.stubGlobal("window", host);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("Element", FakeElement);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  input = new Input();
});

afterEach(() => {
  input.destroy?.();
  vi.unstubAllGlobals();
});

describe("real DOM input lifecycle", () => {
  it("releases held and pending actions on blur and requests deactivation", () => {
    const deactivate = vi.fn();
    input.onDeactivate(deactivate);
    key("keydown", "KeyJ");
    key("keydown", "Space");
    host.dispatchEvent(new Event("blur"));
    expect(input.held.size).toBe(0);
    expect(input.pressed.size).toBe(0);
    expect(deactivate).toHaveBeenCalledOnce();
  });

  it("releases keys when the document becomes hidden", () => {
    key("keydown", "KeyD");
    doc.hidden = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(input.held.size).toBe(0);
    expect(input.pressed.size).toBe(0);
  });

  it("keeps an action held until all keyboard aliases have been released", () => {
    key("keydown", "KeyJ");
    key("keydown", "KeyZ");
    key("keyup", "KeyJ");
    expect(input.isHeld(Control.fire)).toBe(true);
    key("keyup", "KeyZ");
    expect(input.isHeld(Control.fire)).toBe(false);
  });

  it("keeps a quick keyboard tap pending until the game consumes it", () => {
    key("keydown", "KeyK");
    key("keyup", "KeyK");
    expect(input.isHeld(Control.jump)).toBe(false);
    expect(input.consume(Control.jump)).toBe(true);
    expect(input.consume(Control.jump)).toBe(false);
  });

  it("tracks each touch pointer and captures release outside the button", () => {
    const fire = doc.buttons[0];
    if (!fire) throw new Error("missing fixture");
    pointer(fire, "pointerdown", 11);
    pointer(fire, "pointerdown", 12);
    expect(fire.capture.has(11)).toBe(true);
    pointer(host, "pointerup", 11);
    expect(input.isHeld(Control.fire)).toBe(true);
    pointer(fire, "lostpointercapture", 12);
    expect(input.isHeld(Control.fire)).toBe(false);
  });

  it("supports moving, firing and jumping with separate touch pointers", () => {
    doc.buttons.forEach((button, index) => {
      pointer(button, "pointerdown", index + 1);
    });
    expect(input.isHeld(Control.fire)).toBe(true);
    expect(input.isHeld(Control.right)).toBe(true);
    expect(input.consume(Control.jump)).toBe(true);
    pointer(host, "pointercancel", 1);
    expect(input.isHeld(Control.fire)).toBe(false);
    expect(input.isHeld(Control.right)).toBe(true);
  });

  it("discards a cancelled touch jump before the next game step", () => {
    const jump = doc.buttons[2];
    if (!jump) throw new Error("missing fixture");
    pointer(jump, "pointerdown", 14);
    pointer(host, "pointercancel", 14);
    expect(input.consume(Control.jump)).toBe(false);
  });

  it("does not treat ordinary mouse clicks as fire", () => {
    pointer(host, "pointerdown", 1);
    expect(input.held.size).toBe(0);
  });

  it("does not play from modal dialogs or editable controls", () => {
    doc.modal = true;
    key("keydown", "KeyJ");
    expect(input.held.size).toBe(0);
    doc.modal = false;
    const field = new FakeElement();
    field.blocked = true;
    key("keydown", "Space", field);
    expect(input.held.size).toBe(0);
  });

  it("does not re-latch auto-repeat after clearing or blur", () => {
    key("keydown", "KeyD");
    input.clear();
    key("keydown", "KeyD", undefined, true);
    expect(input.held.size).toBe(0);
  });

  it("rejects conflicting key aliases without changing bindings", () => {
    const original = input.getBindings();
    expect(() => input.setBindings({ fire: ["ArrowRight"] })).toThrow();
    expect(input.getBindings()).toEqual(original);
  });

  it("supports custom keys and releases previous bindings immediately", () => {
    key("keydown", "KeyJ");
    input.setBindings({ fire: ["KeyF"] });
    expect(input.isHeld(Control.fire)).toBe(false);
    key("keydown", "KeyJ");
    expect(input.isHeld(Control.fire)).toBe(false);
    key("keydown", "KeyF");
    expect(input.isHeld(Control.fire)).toBe(true);
  });

  it("works even when local storage is denied", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => input.setBindings({ fire: ["KeyF"] })).not.toThrow();
    expect(() => new Input().destroy()).not.toThrow();
  });

  it("removes listeners when destroyed", () => {
    input.destroy();
    key("keydown", "KeyJ");
    expect(input.held.size).toBe(0);
  });
});
