// Keyboard + touch pad + Gamepad API, merged into one per-frame state.
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'a', KeyZ: 'a', KeyJ: 'a', Enter: 'a',
  KeyX: 'b', KeyK: 'b', ShiftLeft: 'b', ShiftRight: 'b',
  Escape: 'start', KeyP: 'start',
};
const BTNS = ['left', 'right', 'up', 'down', 'a', 'b', 'start'];

const key = {}, touch = {}, pad = {};
const prev = {};
let tapQueued = false;
let firstGesture = null;

export const input = {
  touchMode: false, padConnected: false,
  tapPressed: false, anyPressed: false,
};
for (const b of BTNS) { input[b] = false; input[b + 'Pressed'] = false; }

export function onFirstGesture(fn) { firstGesture = fn; }
function gesture() { if (firstGesture) { const f = firstGesture; firstGesture = null; f(); } }

addEventListener('keydown', (e) => {
  const b = KEYMAP[e.code];
  if (b) { key[b] = true; e.preventDefault(); }
  gesture();
});
addEventListener('keyup', (e) => { const b = KEYMAP[e.code]; if (b) key[b] = false; });
addEventListener('blur', () => { for (const b of BTNS) { key[b] = false; touch[b] = false; } });

// ---------- touch pad ----------
export function bindTouch({ dpad, a, b, stage }) {
  const dirs = new Map(); // pointerId -> 'left' | 'down' | 'right'
  const segs = [...dpad.querySelectorAll('[data-dir]')];
  const setDir = () => {
    const v = [...dirs.values()];
    for (const d of ['left', 'down', 'right']) touch[d] = v.includes(d);
    for (const el of segs) el.classList.toggle('on', !!touch[el.dataset.dir]);
  };
  const dirAt = (e) => {
    let best = null, bd = 1e9;
    for (const el of segs) {
      if (el.hidden) continue;
      const r = el.getBoundingClientRect(), d = Math.abs(e.clientX - (r.left + r.width / 2));
      if (d < bd) { bd = d; best = el.dataset.dir; }
    }
    return best;
  };
  dpad.addEventListener('pointerdown', (e) => {
    e.preventDefault(); gesture(); input.touchMode = true;
    dpad.setPointerCapture(e.pointerId); dirs.set(e.pointerId, dirAt(e)); setDir();
  });
  dpad.addEventListener('pointermove', (e) => { if (dirs.has(e.pointerId)) { dirs.set(e.pointerId, dirAt(e)); setDir(); } });
  const dup = (e) => { dirs.delete(e.pointerId); setDir(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => dpad.addEventListener(t, dup));

  for (const [el, name] of [[a, 'a'], [b, 'b']]) {
    if (!el) continue;
    const ids = new Set();
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); gesture(); input.touchMode = true;
      el.setPointerCapture(e.pointerId); ids.add(e.pointerId); touch[name] = true; el.classList.add('on');
      tapQueued = true;
    });
    const up = (e) => { ids.delete(e.pointerId); if (!ids.size) { touch[name] = false; el.classList.remove('on'); } };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => el.addEventListener(t, up));
  }

  // Taps anywhere on the game (not on a button) advance dialogs / cards.
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    gesture();
    if (e.pointerType === 'touch') input.touchMode = true;
    tapQueued = true;
  });
}
export function queueTap() { tapQueued = true; }

// ---------- gamepad ----------
const HAT = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
function pollPads() {
  for (const b of BTNS) pad[b] = false;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let any = false;
  for (const gp of pads) {
    if (!gp || !gp.connected) continue;
    any = true;
    const btn = (i) => !!gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    let l = ax < -0.45, r = ax > 0.45, u = ay < -0.5, d = ay > 0.5;
    if (gp.mapping === 'standard') {
      l ||= btn(14); r ||= btn(15); u ||= btn(12); d ||= btn(13);
      if (btn(0) || btn(3)) pad.a = true;
      if (btn(1) || btn(2)) pad.b = true;
      if (btn(9)) pad.start = true;
    } else {
      // Generic USB pads: face buttons 0-3 (which is "A" varies by brand; any works), start 9, hat on axis 9.
      if (btn(1) || btn(2)) pad.a = true;
      if (btn(0) || btn(3)) pad.b = true;
      if (btn(9) || btn(7)) pad.start = true;
      const hat = gp.axes[9];
      if (hat !== undefined && Math.abs(hat) <= 1.05) {
        const [hx, hy] = HAT[Math.round(((hat + 1) * 7) / 2) & 7];
        l ||= hx < 0; r ||= hx > 0; u ||= hy < 0; d ||= hy > 0;
      }
      // Some pads report the d-pad as buttons 12-15 even without standard mapping.
      l ||= btn(14); r ||= btn(15); u ||= btn(12); d ||= btn(13);
    }
    pad.left ||= l; pad.right ||= r; pad.up ||= u; pad.down ||= d;
  }
  return any;
}

let padToast = null;
export function onPadConnect(fn) { padToast = fn; }
addEventListener('gamepadconnected', () => { input.padConnected = true; padToast?.(); gesture(); });
addEventListener('gamepaddisconnected', () => { input.padConnected = !!pollPads(); });

// ---------- per frame ----------
export function pollInput() {
  pollPads();
  input.anyPressed = false;
  for (const b of BTNS) {
    const now = !!(key[b] || touch[b] || pad[b]);
    input[b + 'Pressed'] = now && !prev[b];
    if (input[b + 'Pressed'] && b !== 'left' && b !== 'right') input.anyPressed = true;
    input[b] = now; prev[b] = now;
  }
  if (input.aPressed || input.bPressed) tapQueued = false; // the A button already counts
  input.tapPressed = tapQueued;
  tapQueued = false;
}

// "Advance" = A, B, start, or a tap. Used by dialogs/cards/menus.
export const advancePressed = () => input.aPressed || input.bPressed || input.startPressed || input.tapPressed;
