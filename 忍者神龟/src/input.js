export const ACTIONS = ['up', 'down', 'left', 'right', 'attack', 'jump', 'special'];
export const ACTION_NAMES = { up: '上移', down: '下移 / 投掷', left: '左移', right: '右移', attack: '攻击', jump: '跳跃 / 复活', special: '必杀' };
export const DEFAULT_BINDINGS = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', attack: 'KeyJ', jump: 'KeyK', special: 'KeyL' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', attack: 'KeyU', jump: 'KeyI', special: 'KeyO' },
];
export function keyName(code) {
  return ({ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: '空格', Escape: 'Esc', ShiftLeft: '左 Shift', ShiftRight: '右 Shift' })[code] || code.replace(/^(Key|Digit)/, '');
}
export function validateBindings(bindings) {
  if (!Array.isArray(bindings) || bindings.length !== 2) return '需要两位玩家的完整按键表';
  const used = new Set();
  for (const [index, player] of bindings.entries()) {
    for (const action of ACTIONS) {
      const code = player?.[action];
      if (typeof code !== 'string' || !/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Comma|Period|Slash|Semicolon|Quote|Bracket(Left|Right)|Backslash|Minus|Equal)$/.test(code)) return '请选择字母、数字、方向键、Shift、空格或标点键';
      if (used.has(code)) return `${keyName(code)} 已被占用：玩家 ${index + 1} 的${ACTION_NAMES[action]}与其他操作冲突`;
      used.add(code);
    }
  }
  return null;
}
export class InputManager {
  constructor({ target = window, onBlur = () => {}, onPause = () => {}, onStart = () => {} } = {}) {
    this.target = target;
    this.bindings = structuredClone(DEFAULT_BINDINGS);
    this.keys = new Set();
    this.pointers = new Map();
    this.keyPulses = new Set();
    this.touchPulses = new Map();
    this.enabled = false;
    this.capture = null;
    this.listeners = [];
    const listen = (name, fn) => { target.addEventListener(name, fn); this.listeners.push([name, fn]); };
    listen('keydown', (event) => {
      if (this.capture) { event.preventDefault(); if (!event.repeat) this.capture(event.code); return; }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target?.closest?.('input, select, textarea, button, dialog')) return;
      if (event.code === 'Escape') { event.preventDefault(); if (!event.repeat) { this.clear(); onPause(); } return; }
      if (event.code === 'Enter') { event.preventDefault(); if (!event.repeat) onStart(); return; }
      if (!this.enabled) return;
      if (this.bindings.some(map => Object.values(map).includes(event.code))) {
        event.preventDefault(); this.keys.add(event.code);
        if (!event.repeat) this.keyPulses.add(event.code);
      }
    });
    listen('keyup', (event) => { this.keys.delete(event.code); });
    listen('blur', () => { this.clear(); onBlur(); });
    this.visibility = () => { if (typeof document !== 'undefined' && document.hidden) { this.clear(); onBlur(); } };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibility);
  }
  setBindings(bindings) {
    const error = validateBindings(bindings);
    if (error) return error;
    this.bindings = structuredClone(bindings); this.clear(); return null;
  }
  read() {
    const pointers = [...this.pointers.values(), ...this.touchPulses.values()];
    const result = this.bindings.map((map, player) => Object.fromEntries(ACTIONS.map(action => [action, this.enabled && (this.keys.has(map[action]) || this.keyPulses.has(map[action]) || pointers.some(p => p.player === player && p.actions.includes(action)))])));
    this.keyPulses.clear(); this.touchPulses.clear();
    return result;
  }
  touch(pointerId, player, actions) { const press={player,actions}; this.pointers.set(pointerId,press); this.touchPulses.set(pointerId,press); }
  release(pointerId, cancelled = false) { if(cancelled && this.pointers.has(pointerId)) this.touchPulses.delete(pointerId); this.pointers.delete(pointerId); }
  clear() { this.keys.clear(); this.pointers.clear(); this.keyPulses.clear(); this.touchPulses.clear(); }
  destroy() {
    for (const [name, fn] of this.listeners) this.target.removeEventListener(name, fn);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibility);
    this.clear();
  }
}
