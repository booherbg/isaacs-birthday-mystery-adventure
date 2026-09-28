// Core loop, scenes, timers, particles and pixel drawing helpers.
export const W = 256, H = 144;
export const canvas = document.getElementById('screen');
export const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

export const game = { scene: null, t: 0, frame: 0, shake: 0 };

const timers = [];
let hooks = {};

// Game-time waits. Cleared on scene change, which cancels stale cutscene scripts.
export const wait = (s) => new Promise((r) => timers.push({ at: game.t + s, r }));
export const until = (fn) => new Promise((r) => timers.push({ fn, r }));

export function setScene(scene, arg) {
  game.scene?.exit?.();
  timers.length = 0;
  game.shake = 0;
  game.scene = scene;
  scene.enter?.(arg);
}

// Screen transitions: fade (or a Pokémon-style flash) out, swap scene, fade back in.
let fade = null;
export function fadeTo(fn, style = 'fade') {
  if (fade && fade.dir > 0) return;
  fade = { a: 0, dir: 1, fn, style, t: 0 };
}
function drawFade(dt) {
  if (!fade) return;
  fade.t += dt;
  const speed = fade.style === 'flash' ? 1.6 : 3.2;
  fade.a += fade.dir * dt * speed;
  if (fade.dir > 0 && fade.a >= 1) { fade.a = 1; const f = fade.fn; fade.dir = -1; f?.(); }
  if (fade && fade.dir < 0 && fade.a <= 0) { fade = null; return; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (fade.style === 'flash' && fade.dir > 0) {
    // battle intro: white flashes then closing stripes
    if (fade.a < 0.45) { if (Math.floor(fade.t * 12) % 2) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); } return; }
    const k = (fade.a - 0.45) / 0.55;
    ctx.fillStyle = '#1b1234';
    for (let y = 0; y < H; y += 8) { const w = W * k; ctx.fillRect((y / 8) % 2 ? W - w : 0, y, w, 8); }
    return;
  }
  ctx.globalAlpha = Math.max(0, Math.min(1, fade.a));
  ctx.fillStyle = '#1b1234';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

export function start(h) {
  hooks = h;
  requestAnimationFrame(loop);
}

let last = 0;
function loop(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  hooks.pre?.(dt);
  hooks.ui?.(dt);
  if (!game.paused) {
    game.t += dt;
    game.frame++;
    for (let i = 0; i < timers.length; i++) {
      const tm = timers[i];
      if (tm.fn ? tm.fn() : game.t >= tm.at) { timers.splice(i--, 1); tm.r(); }
    }
    game.scene?.update?.(dt);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt * 18);
    ctx.translate(Math.round((Math.random() - 0.5) * game.shake), Math.round((Math.random() - 0.5) * game.shake));
  }
  game.scene?.render?.(ctx);
  drawFade(dt);
  hooks.post?.(dt);
  requestAnimationFrame(loop);
}

// ---------- math ----------
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const ease = (t) => t * t * (3 - 2 * t);

// ---------- drawing ----------
// All helpers draw to G, which is the screen unless an offscreen canvas is targeted.
export let G = ctx;
export function target(g) { G = g || ctx; G.imageSmoothingEnabled = false; }
export function offscreen(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const prev = G; target(c.getContext('2d')); fn(G); target(prev); return c;
}

export function rect(x, y, w, h, c) {
  G.fillStyle = c;
  G.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function spr(img, x, y, flip = false) {
  x = Math.round(x); y = Math.round(y);
  if (!flip) { G.drawImage(img, x, y); return; }
  G.save();
  G.translate(x + img.width, y);
  G.scale(-1, 1);
  G.drawImage(img, 0, 0);
  G.restore();
}

// Draw centred on (cx, cy), rotated/scaled. Used for flips, tools, spinning items.
export function sprRot(img, cx, cy, angle = 0, flip = false, scale = 1) {
  G.save();
  G.translate(Math.round(cx), Math.round(cy));
  G.rotate(angle);
  G.scale(flip ? -scale : scale, scale);
  G.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2));
  G.restore();
}

// Scanline triangle / polygon-ish helpers for crisp roofs.
export function tri(x1, y1, x2, y2, x3, y3, c) {
  G.fillStyle = c;
  const minY = Math.round(Math.min(y1, y2, y3)), maxY = Math.round(Math.max(y1, y2, y3));
  const edges = [[x1, y1, x2, y2], [x2, y2, x3, y3], [x3, y3, x1, y1]];
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (const [ax, ay, bx, by] of edges) {
      if ((y >= ay && y < by) || (y >= by && y < ay)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
    if (xs.length >= 2) {
      const a = Math.round(Math.min(...xs)), b = Math.round(Math.max(...xs));
      G.fillRect(a, y, b - a + 1, 1);
    }
  }
}

export function circle(cx, cy, r, c) {
  G.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    G.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

export function ellipse(cx, cy, rx, ry, c) {
  G.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    G.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

// ---------- tiny 3x5 pixel font for in-world signs ----------
const GLYPHS = {
  A: '.#.#.#####.##.#', B: '##.#.###.#.###.', C: '.###..#..#...##', D: '##.#.##.##.###.', E: '####..##.#..###',
  F: '####..##.#..#..', G: '.###..#.##.#.##', H: '#.##.#####.##.#', I: '###.#..#..#.###', J: '..#..#..##.#.#.',
  K: '#.##.###.#.##.#', L: '#..#..#..#..###', M: '#.#####.##.##.#', N: '####.##.##.##.#', O: '.#.#.##.##.#.#.',
  P: '##.#.###.#..#..', Q: '.#.#.##.###..##', R: '##.#.###.#.##.#', S: '.###...#...###.', T: '###.#..#..#..#.',
  U: '#.##.##.##.####', V: '#.##.##.##.#.#.', W: '#.##.##.#####.#', X: '#.##.#.#.#.##.#', Y: '#.##.#.#..#..#.',
  Z: '###..#.#.#..###', 0: '####.##.##.####', 1: '.#.##..#..#.###', 2: '##...#.#.#..###', 3: '##...#.#...###.',
  4: '#.##.####..#..#', 5: '####..##...###.', 6: '.###..####.####', 7: '###..#.#..#..#.', 8: '####.#####.####',
  9: '####.####..###.', '!': '.#..#..#.....#.', '?': '##...#.#.....#.', '.': '.............#.', '-': '......###......',
  "'": '.#..#..........', ':': '....#.....#....', '/': '..#..#.#.#..#..', '+': '....#.###.#....', ' ': '...............',
  '♥': '#.######.#..#..', ',': '..........#.#..',
};

export function textWidth(str, s = 1) { return (str.length * 4 - 1) * s; }
export function pixelText(str, x, y, color = '#fff', s = 1, shadow = null) {
  str = String(str).toUpperCase();
  if (shadow) pixelText(str, x + s, y + s, shadow, s);
  G.fillStyle = color;
  let cx = Math.round(x);
  for (const ch of str) {
    const g = GLYPHS[ch] || GLYPHS['?'];
    for (let i = 0; i < 15; i++) if (g[i] === '#') G.fillRect(cx + (i % 3) * s, Math.round(y) + ((i / 3) | 0) * s, s, s);
    cx += 4 * s;
  }
}

// ---------- particles ----------
export const CONFETTI = ['#ff5d73', '#ffd23f', '#3ec1ff', '#7cff6b', '#c77dff', '#ff9f1c', '#ffffff'];

export class Particles {
  constructor() { this.a = []; }
  add(p) {
    this.a.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: 0, life: 1, t: 0, w: 1, h: 1, color: '#fff', flutter: false }, p));
  }
  burst(x, y, n, { colors = ['#fff'], speed = 60, g = 120, life = 0.6, up = 0, w = 1, h = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, g, life: life * (0.6 + Math.random() * 0.6), color: pick(colors), w, h });
    }
  }
  confetti(x, y, n, spread = 1) {
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + rand(-4, 4) * spread, y, vx: rand(-90, 90) * spread, vy: rand(-190, -60) * spread, g: 140, drag: 1.6,
        life: rand(1.4, 2.6), color: pick(CONFETTI), w: 2, h: 2, flutter: true,
      });
    }
  }
  sparkle(x, y, n = 6, color = '#fff8b0') {
    this.burst(x, y, n, { colors: [color, '#ffffff'], speed: 40, g: 0, life: 0.45 });
  }
  update(dt) {
    for (let i = this.a.length - 1; i >= 0; i--) {
      const p = this.a[i];
      p.t += dt;
      if (p.t >= p.life) { this.a.splice(i, 1); continue; }
      p.vy += p.g * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; if (p.vy > 30) p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  draw(cx = 0, cy = 0) {
    for (const p of this.a) {
      const fade = p.life - p.t < 0.25 && Math.floor(p.t * 20) % 2;
      if (fade) continue;
      G.fillStyle = p.color;
      const w = p.flutter ? (Math.sin(p.t * 14 + p.x) > 0 ? p.w : 1) : p.w;
      G.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), w, p.h);
    }
  }
}

// Floating score / word pops drawn with the pixel font.
export class Pops {
  constructor() { this.a = []; }
  add(text, x, y, color = '#fff', s = 1, life = 0.9) { this.a.push({ text, x, y, color, s, t: 0, life }); }
  update(dt) {
    for (let i = this.a.length - 1; i >= 0; i--) { const p = this.a[i]; p.t += dt; p.y -= 22 * dt; if (p.t > p.life) this.a.splice(i, 1); }
  }
  draw(cx = 0, cy = 0) {
    for (const p of this.a) {
      pixelText(p.text, p.x - cx - textWidth(p.text, p.s) / 2, p.y - cy, p.color, p.s, '#2a1f33');
    }
  }
}
