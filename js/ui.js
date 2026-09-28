// DOM layer: dialog box, clue cards, menus, banners, HUD, touch pad visibility, layout.
import { input, advancePressed } from './input.js';
import { audio } from './audio.js';
import { PORTRAIT, SPR } from './sprites.js';

const $ = (s) => document.querySelector(s);
const el = {
  app: $('#app'), stage: $('#stage'), dialog: $('#dialog'), portrait: $('#portrait'), name: $('#dlg-name'),
  text: $('#dlg-text'), next: $('#dlg-next'), choices: $('#dlg-choices'), overlay: $('#overlay'), banner: $('#banner'),
  toast: $('#toast'), hudL: $('#hud-l'), hudC: $('#hud-c'), hudR: $('#hud-r'), pad: $('#pad'), a: $('#btn-a'),
  b: $('#btn-b'), dpad: $('#dpad'), hint: $('#keyhint'),
};

export const SPEAKERS = {
  isaac: { name: 'Isaac', color: '#3d7be0', f: 720 },
  mom: { name: 'Mom', color: '#c0577a', f: 860 },
  dad: { name: 'Dad', color: '#44699c', f: 400 },
  sunny: { name: 'Sunny', color: '#b85c2a', f: 950 },
  freida: { name: 'Freida', color: '#d9661f', f: 1100 },
  creeper: { name: 'Creeper Crew', color: '#2c7a34', f: 260, sprite: 'creeper' },
  narrator: { name: '', color: '#6b5b7b', f: 560 },
};

// ---------------- layout ----------------
export function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const portrait = vh > vw * 1.1;
  const touch = input.touchMode;
  el.app.classList.toggle('portrait', portrait);
  el.app.classList.toggle('touch', touch);
  let sw, sh, top, left;
  if (portrait) {
    sw = vw; sh = Math.round((vw * 9) / 16);
    top = Math.max(8, Math.min(60, vh * 0.06)); left = 0;
  } else {
    const reserve = touch ? 0 : 36;
    const s = Math.min(vw / 256, (vh - reserve) / 144);
    sw = Math.floor(256 * s); sh = Math.floor(144 * s);
    left = Math.floor((vw - sw) / 2); top = Math.floor((vh - reserve - sh) / 2);
  }
  Object.assign(el.stage.style, { width: sw + 'px', height: sh + 'px', left: left + 'px', top: top + 'px' });
  const u = sw / 256;
  document.documentElement.style.setProperty('--u', u + 'px');
  document.documentElement.style.setProperty('--sw', sw + 'px');
  const d = el.dialog.style;
  if (portrait) {
    Object.assign(d, { left: '10px', right: '10px', width: 'auto', top: top + sh + 12 + 'px', bottom: 'auto' });
  } else {
    const inset = Math.max(6, 6 * u);
    Object.assign(d, { left: left + inset + 'px', width: sw - inset * 2 + 'px', right: 'auto', top: 'auto', bottom: vh - (top + sh) + inset + 'px' });
  }
  el.hint.style.top = top + sh + 6 + 'px';
  document.documentElement.style.setProperty('--stage-bottom', top + sh + 'px');
}
addEventListener('resize', layout);
addEventListener('orientationchange', () => setTimeout(layout, 200));

// ---------------- pad ----------------
export function setPad(mode = 'move', { a = 'JUMP', b = null } = {}) {
  el.pad.dataset.mode = mode;
  el.a.textContent = a;
  el.b.textContent = b || '';
  el.b.hidden = !b;
  el.dpad.hidden = mode === 'action' || mode === 'none';
  el.dpad.querySelector('[data-dir=down]').hidden = mode !== 'trick';
  el.pad.hidden = mode === 'none';
  const keys = { move: '← → move · SPACE ' + a.toLowerCase(), action: 'SPACE = ' + a.toLowerCase(), trick: '← → steer · SPACE ' + a.toLowerCase() + (b ? ' · X ' + b.toLowerCase() : '') + ' · ↓ worm', none: '' };
  el.hint.textContent = keys[mode] || '';
}

// ---------------- HUD / banner / toast ----------------
export function hud(l = '', c = '', r = '') {
  if (el.hudL.innerHTML !== l) el.hudL.innerHTML = l;
  if (el.hudC.innerHTML !== c) el.hudC.innerHTML = c;
  if (el.hudR.innerHTML !== r) el.hudR.innerHTML = r;
}
const iconCache = {};
export function icon(name) {
  if (!iconCache[name]) {
    const img = SPR[name];
    iconCache[name] = img ? img.toDataURL() : '';
  }
  return `<i class="ico" style="background-image:url(${iconCache[name]})"></i>`;
}
let bannerTimer = 0;
export function banner(text, ms = 1600, cls = '') {
  el.banner.className = '';
  void el.banner.offsetWidth;
  el.banner.innerHTML = text;
  el.banner.className = 'show ' + cls;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (el.banner.className = ''), ms);
}
export function tip(text) {
  const t = document.getElementById('tip');
  if (!text) { t.hidden = true; return; }
  if (t.textContent !== text) { t.textContent = text; t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; }
}
let toastTimer = 0;
export function toast(text, ms = 2600) {
  el.toast.textContent = text;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
}

// ---------------- dialog ----------------
let dlg = null; // { full, shown, speed, resolve, done, choices, sel }
export const ui = {
  get busy() { return !!dlg || !!modal; },
};

function drawPortrait(who) {
  const c = el.portrait, g = c.getContext('2d');
  const sp = SPEAKERS[who] || SPEAKERS.narrator;
  const img = PORTRAIT[who] || (sp.sprite && SPR[sp.sprite]);
  el.dialog.classList.toggle('noportrait', !img);
  if (!img) return;
  c.width = 26; c.height = 26;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, 26, 26);
  g.drawImage(img, Math.floor((26 - img.width) / 2), Math.floor((26 - img.height) / 2) + (sp.sprite ? 0 : 1));
}

export function say(who, text, { speed = 48 } = {}) {
  const sp = SPEAKERS[who] || SPEAKERS.narrator;
  drawPortrait(who);
  el.name.textContent = sp.name;
  el.name.style.background = sp.color;
  el.name.hidden = !sp.name;
  el.text.textContent = '';
  el.choices.innerHTML = '';
  el.dialog.hidden = false;
  el.dialog.classList.remove('pop'); void el.dialog.offsetWidth; el.dialog.classList.add('pop');
  el.next.hidden = true;
  if (who === 'sunny') audio.sfx('bark', { n: 2 });
  if (who === 'freida') audio.sfx('meow');
  return new Promise((resolve) => { dlg = { who, sp, full: text, shown: 0, speed, resolve, done: false, age: 0 }; });
}

// Ask a question with big buttons; resolves to the chosen index.
export function choose(who, text, options) {
  return new Promise((resolve) => {
    say(who, text).then(() => {});
    dlg.shown = dlg.full.length; el.text.textContent = dlg.full; dlg.done = true;
    dlg.choices = options; dlg.sel = 0; dlg.resolveChoice = resolve;
    el.choices.innerHTML = '';
    options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'choice'; b.innerHTML = o;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); pickChoice(i); });
      el.choices.appendChild(b);
    });
    markChoice();
  });
}
function markChoice() { [...el.choices.children].forEach((b, i) => b.classList.toggle('sel', i === dlg.sel)); }
function pickChoice(i) {
  if (!dlg || !dlg.choices) return;
  audio.sfx('select');
  const r = dlg.resolveChoice;
  closeDialog();
  r(i);
}
function closeDialog() {
  const d = dlg; dlg = null;
  el.dialog.hidden = true;
  el.choices.innerHTML = '';
  d?.resolve?.();
}
export function hideDialog() { if (dlg) closeDialog(); }

function updateDialog(dt) {
  if (!dlg) return;
  dlg.age += dt;
  if (dlg.choices) {
    const n = dlg.choices.length;
    if (input.leftPressed || input.upPressed) { dlg.sel = (dlg.sel + n - 1) % n; audio.sfx('move'); markChoice(); }
    if (input.rightPressed || input.downPressed) { dlg.sel = (dlg.sel + 1) % n; audio.sfx('move'); markChoice(); }
    if ((input.aPressed || input.startPressed) && dlg.age > 0.25) pickChoice(dlg.sel);
    return;
  }
  if (!dlg.done) {
    const before = Math.floor(dlg.shown);
    dlg.shown += dt * dlg.speed;
    const now = Math.min(dlg.full.length, Math.floor(dlg.shown));
    if (now !== before) {
      el.text.textContent = dlg.full.slice(0, now);
      if (now % 2 === 0 && dlg.full[now - 1] !== ' ') audio.sfx('blip', { f: dlg.sp.f * (0.95 + Math.random() * 0.1) });
    }
    if (now >= dlg.full.length) { dlg.done = true; el.next.hidden = false; }
    if (advancePressed() && dlg.age > 0.12) { dlg.shown = dlg.full.length; el.text.textContent = dlg.full; dlg.done = true; el.next.hidden = false; dlg.age = 0.05; }
    return;
  }
  if (advancePressed() && dlg.age > 0.2) { audio.sfx('move'); closeDialog(); }
}

// ---------------- modal overlay (clue cards, menus, results) ----------------
let modal = null; // { buttons, sel, resolve, minAge, age, tapClose }
export function overlay(html, { buttons = null, tapClose = false, minAge = 0.35, cls = '' } = {}) {
  el.overlay.className = cls;
  el.overlay.innerHTML = html;
  el.overlay.hidden = false;
  const btns = [...el.overlay.querySelectorAll('button[data-v]')];
  return new Promise((resolve) => {
    modal = { btns, sel: 0, resolve, minAge, age: 0, tapClose };
    btns.forEach((b, i) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); if (modal && modal.age > 0.15) closeModal(b.dataset.v); });
      b.addEventListener('pointerenter', () => { if (modal) { modal.sel = i; markModal(); } });
    });
    if (tapClose) el.overlay.addEventListener('pointerdown', onOverlayTap);
    markModal();
  });
}
function onOverlayTap(e) { if (!e.target.closest('button') && modal && modal.age > modal.minAge) closeModal(true); }
function markModal() { modal?.btns.forEach((b, i) => b.classList.toggle('sel', i === modal.sel)); }
function closeModal(v) {
  const m = modal; modal = null;
  el.overlay.removeEventListener('pointerdown', onOverlayTap);
  el.overlay.hidden = true; el.overlay.innerHTML = '';
  audio.sfx('select');
  m?.resolve(v);
}
export function closeOverlay() { if (modal) closeModal(null); else el.overlay.hidden = true; }
function updateModal(dt) {
  if (!modal) return;
  modal.age += dt;
  const n = modal.btns.length;
  if (n) {
    if (input.leftPressed || input.upPressed) { modal.sel = (modal.sel + n - 1) % n; audio.sfx('move'); markModal(); }
    if (input.rightPressed || input.downPressed) { modal.sel = (modal.sel + 1) % n; audio.sfx('move'); markModal(); }
    if ((input.aPressed || input.startPressed) && modal.age > modal.minAge) closeModal(modal.btns[modal.sel].dataset.v);
  } else if (modal.tapClose && advancePressed() && modal.age > modal.minAge) closeModal(true);
}

export function clueCard(n, text) {
  audio.sfx('clue');
  return overlay(`
    <div class="card clue pop">
      <div class="clue-top">CLUE ${n} of 3</div>
      <div class="clue-art">${icon('clue')}</div>
      <div class="clue-text">${text}</div>
      <div class="tapnext">tap / press A</div>
    </div>`, { tapClose: true, minAge: 0.8 });
}

// Pokémon-card-style intro for a "wild ___ appeared!" encounter.
export function foeCard({ who, name, hp, type, moves, flavor, color = '#ffcd3c' }) {
  const img = PORTRAIT[who] || SPR[who];
  const src = img ? img.toDataURL() : '';
  return overlay(`
    <div class="tcg pop" style="--tcg:${color}">
      <div class="tcg-head"><span class="tcg-name">${name}</span><span class="tcg-hp">HP <b>${hp}</b></span></div>
      <div class="tcg-art holo"><img src="${src}" alt=""></div>
      <div class="tcg-type">${type}</div>
      ${moves.map(([m, dmg, d]) => `<div class="tcg-move"><b>${m}</b><span>${dmg}</span><small>${d}</small></div>`).join('')}
      <div class="tcg-flavor">${flavor}</div>
    </div>
    <div class="tapnext light">tap / press A</div>`, { tapClose: true, minAge: 0.9, cls: 'dim' });
}

export function menu({ title = '', sub = '', body = '', buttons = [], cls = '' }) {
  return overlay(`
    <div class="menu pop ${cls}">
      ${title ? `<h1>${title}</h1>` : ''}${sub ? `<p class="sub">${sub}</p>` : ''}${body}
      <div class="menu-btns">${buttons.map((b) => `<button class="big ${b.cls || ''}" data-v="${b.v}">${b.label}</button>`).join('')}</div>
    </div>`, { cls: 'dim' });
}

export function updateUI(dt) {
  el.app.classList.toggle('talking', !!dlg);
  updateDialog(dt);
  updateModal(dt);
}
