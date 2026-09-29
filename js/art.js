// Procedural scenery: skies, trees, houses (incl. the two real houses), props, trampoline.
import { W, H, G, rect, tri, circle, ellipse, offscreen, pixelText, textWidth, game, spr } from './engine.js';
import { SPR } from './sprites.js';

// deterministic noise so textures don't shimmer
export function hash(x, y = 0) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ---------------- sky ----------------
const skyCache = {};
export function sky(top, bottom, bands = 10) {
  const k = top + bottom + bands;
  if (!skyCache[k]) {
    skyCache[k] = offscreen(1, H, (g) => {
      const a = hexRgb(top), b = hexRgb(bottom);
      for (let y = 0; y < H; y++) {
        const t = Math.floor((y / H) * bands) / (bands - 1);
        g.fillStyle = `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
        g.fillRect(0, y, 1, 1);
      }
    });
  }
  G.drawImage(skyCache[k], 0, 0, W, H);
}
export function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }

// ---------------- clouds ----------------
const clouds = [];
function makeClouds() {
  for (let i = 0; i < 4; i++) {
    const w = 30 + i * 10;
    clouds.push(offscreen(w + 4, 22, () => {
      const blobs = [[w * 0.3, 13, 8], [w * 0.5, 10, 10], [w * 0.72, 13, 7], [w * 0.15, 15, 5], [w * 0.88, 15, 5]];
      for (const [x, y, r] of blobs) circle(x + 2, y + 1, r, '#c9dff2');
      for (const [x, y, r] of blobs) circle(x + 2, y - 1, r, '#ffffff');
      rect(2, 15, w, 5, '#ffffff');
      rect(2, 19, w, 1, '#c9dff2');
    }));
  }
}
export function drawClouds(cx, par = 0.15, y0 = 12, drift = 3) {
  if (!clouds.length) makeClouds();
  for (let i = 0; i < 7; i++) {
    const c = clouds[i % 4];
    const span = 420;
    let x = ((i * 137 - cx * par - game.t * drift) % span + span) % span - 60;
    G.drawImage(c, Math.round(x), y0 + ((i * 29) % 34));
  }
}
export function blockyClouds(cx) {
  for (let i = 0; i < 6; i++) {
    const span = 400;
    const x = Math.round((((i * 151 - cx * 0.15 - game.t * 2) % span) + span) % span - 60);
    const y = 10 + ((i * 23) % 30);
    rect(x, y, 40, 8, '#ffffff'); rect(x + 8, y - 6, 20, 6, '#ffffff'); rect(x, y + 8, 40, 2, '#dfe9f5');
  }
}

// ---------------- trees ----------------
export function tree(x, base, s = 1, leaf = '#3f9b3a', dark = '#2c7a34', light = '#62bf4c') {
  const tw = Math.round(5 * s), th = Math.round(26 * s);
  rect(x - tw / 2, base - th, tw, th, '#6b4a2f');
  rect(x - tw / 2, base - th, 1, th, '#8a6a4a');
  const r = 13 * s;
  const blobs = [[0, -th - r * 0.3, r], [-r * 0.8, -th + r * 0.2, r * 0.75], [r * 0.8, -th + r * 0.2, r * 0.75], [0, -th + r * 0.3, r * 0.8]];
  for (const [dx, dy, rr] of blobs) circle(x + dx, base + dy + 2, Math.round(rr), dark);
  for (const [dx, dy, rr] of blobs) circle(x + dx, base + dy, Math.round(rr), leaf);
  circle(x - r * 0.3, base - th - r * 0.6, Math.round(r * 0.35), light);
}
export function pine(x, base, s = 1) {
  rect(x - 2, base - 12 * s, 4, 12 * s, '#5a3a24');
  for (let i = 0; i < 5; i++) {
    const w = (22 - i * 4) * s, y = base - 10 * s - i * 11 * s;
    tri(x - w, y, x + w, y, x, y - 16 * s, i % 2 ? '#2f6b3a' : '#377a42');
    rect(x - w + 2, y - 1, w * 2 - 4, 1, '#24562e');
  }
}
export function bush(x, base, w = 22, c = '#3f9b3a', flowers = null) {
  ellipse(x, base - 6, w / 2, 7, '#2c7a34');
  ellipse(x, base - 8, w / 2 - 1, 6, c);
  if (flowers) for (let i = 0; i < w / 3; i++) circle(x - w / 2 + 3 + ((i * 7) % (w - 4)), base - 12 + ((i * 5) % 8), 1 + (i % 2), flowers);
}
export function treeLine(cx, par, y, c1, c2) {
  const off = -cx * par;
  for (let i = -1; i < 14; i++) {
    const x = Math.round(((i * 26 + off) % 364 + 364) % 364 - 40);
    circle(x, y + ((i * 7) % 6), 16 + ((i * 3) % 6), c1);
  }
  rect(0, y + 6, W, H, c1);
  for (let i = -1; i < 14; i++) {
    const x = Math.round(((i * 26 + 13 + off) % 364 + 364) % 364 - 40);
    circle(x, y + 8 + ((i * 5) % 5), 10 + ((i * 7) % 5), c2);
  }
}

// ---------------- neighborhood houses ----------------
const HOUSE_COLORS = [['#f2d7a0', '#8a4a3a'], ['#b8d8e8', '#4a5568'], ['#f4b8b8', '#6b4a3a'], ['#c8e6b0', '#5a4a6a'], ['#fff3c4', '#7a3a3a'], ['#d8c8f0', '#4a4a5a'], ['#f0c890', '#3a4a6a']];
const houseCache = [];
export function neighborHouse(i) {
  if (!houseCache[i]) {
    const [wall, roof] = HOUSE_COLORS[i % HOUSE_COLORS.length];
    const w = 70 + (i * 13) % 30, h = 34 + (i * 7) % 12, rh = 22 + (i % 3) * 4;
    houseCache[i] = offscreen(w + 12, h + rh + 4, () => {
      const x0 = 6, y0 = rh + 2;
      rect(x0, y0, w, h, wall);
      for (let y = y0 + 3; y < y0 + h; y += 4) rect(x0, y, w, 1, 'rgba(0,0,0,.06)');
      tri(x0 - 5, y0 + 1, x0 + w + 5, y0 + 1, x0 + w / 2, 2, roof);
      rect(x0 - 5, y0, w + 10, 2, '#2a1f33');
      const dx = x0 + (i % 2 ? 12 : w - 24);
      rect(dx, y0 + h - 20, 12, 20, ['#3d7be0', '#e8483f', '#4cb944', '#2a1f33'][i % 4]); rect(dx + 9, y0 + h - 11, 1, 2, '#ffde5c');
      const wx = i % 2 ? x0 + w - 36 : x0 + 8;
      for (let k = 0; k < 2; k++) { rect(wx + k * 16, y0 + 8, 12, 12, '#fff'); rect(wx + k * 16 + 1, y0 + 9, 10, 10, '#6fb6e8'); rect(wx + k * 16 + 6, y0 + 9, 1, 10, '#fff'); rect(wx + k * 16 + 1, y0 + 9, 3, 3, '#bfe4ff'); }
      if (i % 3 === 0) { rect(x0 + w / 2 - 5, 10, 10, 9, '#fff'); rect(x0 + w / 2 - 4, 11, 8, 7, '#6fb6e8'); }
    });
  }
  return houseCache[i];
}

// ---------------- the current house (from Blaine's photo; no house number) ----------------
let curHouse = null;
export function currentHouse() {
  if (curHouse) return curHouse;
  curHouse = offscreen(270, 110, () => {
    const siding = '#c3cbd6', line = '#a9b3c1', maroon = '#7d2635', trim = '#ffffff';
    // upper floor (set back) + lower floor
    rect(20, 8, 210, 46, siding);
    for (let x = 22; x < 230; x += 4) rect(x, 8, 1, 46, line);
    rect(18, 6, 214, 3, maroon);
    rect(120, 8, 4, 46, '#b3bcc8');
    // upper windows
    for (const wx of [44, 150]) {
      rect(wx, 16, 38, 28, trim); rect(wx + 3, 19, 32, 22, '#3b4a5c');
      rect(wx + 18, 19, 2, 22, trim); rect(wx + 4, 20, 6, 8, '#6d8299'); rect(wx + 21, 20, 5, 6, '#6d8299');
    }
    // shingle band
    rect(4, 54, 250, 11, '#4b505e');
    for (let y = 56; y < 65; y += 3) for (let x = 4 + ((y / 3) % 2) * 3; x < 254; x += 6) rect(x, y, 4, 1, '#5d6372');
    rect(2, 64, 254, 3, maroon);
    // lower floor
    rect(10, 67, 240, 43, siding);
    for (let x = 12; x < 250; x += 4) rect(x, 67, 1, 43, line);
    rect(30, 67, 150, 4, '#d6dce4');
    for (let x = 30; x < 180; x += 7) rect(x, 67, 1, 4, line);
    // garage door
    rect(34, 72, 142, 38, '#2a1f33'); rect(36, 74, 138, 36, maroon);
    for (let y = 82; y < 110; y += 9) rect(36, y, 138, 1, '#5e1b28');
    rect(104, 94, 4, 1, '#c9a0a8');
    // lamp + chair + mums
    rect(196, 80, 4, 6, '#2a1f33'); rect(197, 81, 2, 4, '#ffe9a8'); circle(198, 83, 5, 'rgba(255,233,168,.25)');
    rect(206, 94, 14, 8, '#4a4a52'); rect(206, 88, 3, 14, '#4a4a52'); rect(217, 92, 3, 18, '#4a4a52'); rect(207, 102, 2, 8, '#4a4a52');
    rect(226, 98, 8, 12, '#9aa3b8'); circle(230, 95, 5, '#c0392b'); circle(228, 93, 2, '#e8752a'); circle(232, 96, 2, '#e8752a');
  });
  return curHouse;
}

// ---------------- the NEW house (from Blaine's photo) ----------------
let newHouseImg = null;
export function newHouse() {
  if (newHouseImg) return newHouseImg;
  newHouseImg = offscreen(250, 124, () => {
    const siding = '#c9d3c8', sline = '#b2bdb1', roof = '#aeb3ba', roofD = '#969ca4', white = '#fbfbf7';
    // big roof (hip) with dormer
    tri(22, 70, 228, 70, 125, 4, roof);
    rect(22, 44, 206, 26, roof);
    tri(22, 44, 22, 70, 2, 70, roof); tri(228, 44, 228, 70, 248, 70, roof);
    tri(22, 44, 125, 4, 22, 70, roof);
    G.globalCompositeOperation = 'source-atop';
    for (let y = 10; y < 70; y += 4) for (let x = 0; x < 250; x += 7) if (hash(x, y) > 0.55) rect(x + ((y / 4) % 2) * 3, y, 4, 1, roofD);
    G.globalCompositeOperation = 'source-over';
    // chimney
    rect(84, 0, 12, 24, '#e6e6e6'); rect(84, 0, 12, 3, '#9aa3b8'); for (let y = 5; y < 24; y += 4) rect(84, y, 12, 1, '#c9c9c9');
    // dormer gable
    tri(92, 50, 158, 50, 125, 22, white);
    tri(96, 49, 154, 49, 125, 25, '#5d6470');
    rect(114, 34, 22, 14, white); rect(116, 36, 18, 10, '#3b4a5c'); rect(116, 40, 18, 1, white); rect(124, 36, 2, 10, white);
    rect(92, 49, 66, 2, white);
    // fascia
    rect(4, 69, 242, 3, white);
    // walls
    rect(12, 72, 226, 44, siding);
    for (let y = 75; y < 116; y += 3) rect(12, y, 226, 1, sline);
    // porch roof band
    rect(8, 72, 234, 8, roof); rect(8, 79, 234, 2, white);
    // left window bank (4 windows)
    rect(30, 86, 76, 24, white);
    for (let k = 0; k < 4; k++) { rect(32 + k * 19, 88, 16, 20, '#e9e4d6'); rect(32 + k * 19, 88, 16, 3, '#4a5566'); rect(38 + k * 19, 91, 1, 17, '#d6cfbd'); }
    // door + storm door
    rect(114, 84, 22, 32, white); rect(116, 86, 18, 30, '#1f1f24'); rect(118, 88, 14, 18, '#3b4a5c'); rect(130, 100, 2, 2, '#ffde5c');
    rect(138, 90, 3, 5, '#e6e6e6');
    // right window with blinds
    rect(154, 86, 50, 24, white);
    rect(156, 88, 14, 20, '#dfe4ea'); rect(172, 88, 30, 20, '#dfe4ea');
    for (let y = 89; y < 108; y += 2) { rect(156, y, 14, 1, '#b9c1cc'); rect(172, y, 30, 1, '#b9c1cc'); }
    // steps + railings
    for (let i = 0; i < 4; i++) rect(108 - i * 2, 112 + i * 3, 34 + i * 4, 3, i % 2 ? '#9a5a4a' : '#a86a58');
    rect(104, 104, 1, 20, white); rect(146, 104, 1, 20, white); rect(104, 104, 6, 1, white); rect(141, 104, 6, 1, white);
  });
  return newHouseImg;
}
export function hydrangeas(x, base, w) {
  for (let i = 0; i < w / 8; i++) {
    const hx = x + i * 8 + (i % 2) * 3, hy = base - 8 - (i % 3) * 3;
    circle(hx, hy + 2, 6, '#3f8a3a');
  }
  for (let i = 0; i < w / 7; i++) {
    const hx = x + 3 + i * 7, hy = base - 11 - ((i * 5) % 7);
    circle(hx, hy, 3, '#f4f7ec'); rect(hx - 1, hy - 1, 1, 1, '#ffffff'); rect(hx + 1, hy + 1, 1, 1, '#d9e4c8');
  }
}

// ---------------- props ----------------
export function fenceWood(x0, x1, base, h = 34, cx = 0) {
  for (let x = x0; x < x1; x += 7) {
    rect(x - cx, base - h, 6, h, '#b5824f'); rect(x - cx, base - h, 6, 1, '#d19b64'); rect(x - cx + 5, base - h, 1, h, '#8f6038');
    tri(x - cx, base - h, x - cx + 5, base - h, x - cx + 2.5, base - h - 3, '#b5824f');
  }
  rect(x0 - cx, base - h + 6, x1 - x0, 2, '#8f6038'); rect(x0 - cx, base - 8, x1 - x0, 2, '#8f6038');
}
export function chainFence(x0, x1, top, base, cx = 0) {
  G.fillStyle = 'rgba(170,180,190,.7)';
  for (let y = top; y < base; y += 3) for (let x = x0 + ((y / 3) % 2) * 1.5; x < x1; x += 3) G.fillRect(Math.round(x - cx), y, 1, 1);
  for (let x = x0; x <= x1; x += 40) rect(x - cx, top - 2, 2, base - top + 2, '#8a939c');
  rect(x0 - cx, top - 2, x1 - x0, 1, '#8a939c');
}
export function sign(x, base, lines, { bg = '#2c7a34', fg = '#fff', post = '#6b4a2f' } = {}) {
  const w = Math.max(...lines.map((l) => textWidth(l))) + 8, h = lines.length * 7 + 5;
  rect(x + w / 2 - 1, base - 14, 3, 14, post);
  rect(x, base - 14 - h, w, h, '#2a1f33'); rect(x + 1, base - 13 - h, w - 2, h - 2, bg);
  lines.forEach((l, i) => pixelText(l, x + (w - textWidth(l)) / 2, base - 10 - h + i * 7 + 1, fg));
}

// Island Park Pool's slide tower with the big green corkscrew and the Big Blue Slide.
export function poolSlides(sx) {
  rect(sx, 34, 24, 74, '#e6e6e6'); for (let y = 40; y < 108; y += 8) rect(sx, y, 24, 1, '#b8bcc4');
  rect(sx - 2, 30, 28, 4, '#2f7fd6');
  for (let i = 0; i < 70; i++) {
    const t = i / 70, x = sx + 30 + Math.sin(t * Math.PI * 5) * 26 + t * 60, y = 40 + t * 62;
    circle(x, y, 5, i % 7 === 0 ? '#2e8a2e' : '#48c23a');
  }
  for (let i = 0; i < 50; i++) { const t = i / 50; circle(sx - 4 - t * 90, 44 + t * 60, 3, '#3a7ae0'); }
}

// ---------------- trampoline (only drawn after the reveal!) ----------------
export function trampoline(cx, groundY, w = 84, sink = 0) {
  const top = groundY - 22, rx = w / 2;
  // legs: U-shaped frame pieces
  for (const lx of [-rx + 5, -rx / 3, rx / 3, rx - 7]) {
    rect(cx + lx, top + 4, 2, 18, '#34343f');
    rect(cx + lx - 3, groundY - 2, 8, 2, '#34343f');
  }
  rect(cx - rx + 5, groundY - 8, w - 10, 1, '#4a4a55');
  // pad ring + mat (seen slightly from above)
  ellipse(cx, top + 3, rx + 1, 7, '#2456ad');
  ellipse(cx, top + 2, rx, 6, '#2f6fd6');
  ellipse(cx, top + 2 + Math.round(sink * 0.5), rx - 6, 4, '#15151c');
  if (sink > 1) ellipse(cx, top + 3 + Math.round(sink * 0.8), rx - 14, 2, '#0b0b10');
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; rect(cx + Math.cos(a) * (rx - 3), top + 2 + Math.sin(a) * 4, 1, 1, '#9aa3b8'); }
  rect(cx - rx + 4, top - 1, w - 8, 1, '#6aa6ff');
  // front edge of the pad and the skirt
  rect(cx - rx, top + 5, w, 3, '#2f6fd6'); rect(cx - rx, top + 8, w, 1, '#2456ad');
}
export function trampolineTopY(groundY) { return groundY - 20; }

export function present(cx, base, stage = 0, t = 0) {
  const w = 76, h = 48, x = cx - w / 2, y = base - h;
  const wob = stage ? Math.round(Math.sin(t * 40) * (stage > 0 && t < 0.25 ? 2 : 0)) : 0;
  rect(x + wob, y, w, h, '#2a1f33');
  rect(x + 1 + wob, y + 1, w - 2, h - 2, '#e8483f');
  for (let i = 0; i < 20; i++) circle(x + 6 + ((i * 17) % (w - 10)) + wob, y + 6 + ((i * 11) % (h - 10)), 1, '#ff9a8f');
  rect(cx - 4 + wob, y + 1, 8, h - 2, '#ffde5c'); rect(x + 1 + wob, y + h / 2 - 4, w - 2, 8, '#ffde5c');
  // rips reveal blue pad behind
  if (stage >= 1) { tri(x + 8, y + 10, x + 26, y + 6, x + 14, y + 26, '#2f6fd6'); tri(x + 14, y + 26, x + 26, y + 6, x + 22, y + 22, '#1b1b22'); }
  if (stage >= 2) { tri(x + w - 10, y + 30, x + w - 30, y + 20, x + w - 18, y + 44, '#2f6fd6'); rect(x + w - 26, y + 34, 8, 6, '#1b1b22'); }
  const bow = SPR.bow;
  G.save(); G.translate(Math.round(cx + wob), y - 6); G.scale(2, 2); G.drawImage(bow, -Math.floor(bow.width / 2), -Math.floor(bow.height / 2)); G.restore();
}

// ---------------- birthday banner in the sky ----------------
export function planeBanner(x, y, text) {
  rect(x, y, 20, 5, '#e6e6e6'); rect(x + 16, y - 3, 3, 3, '#e8483f'); rect(x + 6, y + 5, 8, 1, '#9aa3b8'); rect(x + 2, y + 1, 2, 2, '#6fb6e8');
  const tw = textWidth(text) + 6;
  rect(x - 8, y + 2, 8, 1, '#666');
  rect(x - 8 - tw, y - 1, tw, 8, '#fff'); rect(x - 8 - tw, y - 1, tw, 1, '#e8483f');
  pixelText(text, x - 5 - tw, y + 1, '#e8483f');
}
