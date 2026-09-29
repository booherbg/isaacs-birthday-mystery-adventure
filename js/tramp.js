// TRAMPOLINE TIME — Sky Zone in the new backyard. Time your landings, stack tricks, combo up to x8.
import { W, H, G, game, rect, tri, circle, ellipse, spr, sprRot, pixelText, textWidth, wait, until, Particles, Pops, clamp, lerp, rand, pick, CONFETTI, setScene, fadeTo, offscreen } from './engine.js';
import { SPR } from './sprites.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { say, banner, hud, setPad, toast, menu, icon, tip, overlay } from './ui.js';
import { drawWorm } from './world.js';
import * as A from './art.js';
import { CONFIG } from './config.js';
import { save } from './save.js';

const K = CONFIG.kid.toUpperCase();
const GROUND = 124, MAT = GROUND - 20, CX = 128, HALF = 56;
const GRAV = 520;
const HEIGHTS = [0, 60, 88, 125, 175, 240, 320, 425, 555, 715, 900];
// The 30-second first bounce after the reveal: a shorter POW meter that still tops out in OUTER SPACE.
const STORY_HEIGHTS = [0, 60, 88, 125, 200, 320, 520, 820];
const FLIP_T = 0.52, SPIN_T = 0.42;

export const HATS = [
  { id: 'party', name: 'Party Hat', need: 'Starter hat' },
  { id: 'pika', name: 'Pika Hat', need: "Isaac's own hat!" },
  { id: 'none', name: 'No Hat', need: 'Just curls' },
  { id: 'cap', name: 'Ball Cap', need: '5 PERFECT landings in a row', test: (r) => r.perfStreak >= 5 },
  { id: 'bunny', name: 'Big Bunny Ears', need: 'Bounce up to SKY ZONE', test: (r) => r.height >= 385 },
  { id: 'spidey', name: 'Spidey Mask', need: 'Land a DOUBLE flip', test: (r) => r.flips >= 2 },
  { id: 'pup', name: 'Pup Fire Helmet', need: 'Hit a x5 combo', test: (r) => r.combo >= 5 },
  { id: 'diamond', name: 'Diamond Helmet', need: 'Land a TRIPLE flip or a 720', test: (r) => r.flips >= 3 || r.spins >= 2 },
  { id: 'crown', name: 'Space Crown', need: 'Bounce to SPACE', test: (r) => r.height >= 800 },
  { id: 'collector', name: 'Card Collector Cap', need: 'Fill the Card Binder (story mode)' },
  { id: 'fishing', name: 'Fishing Hat', need: 'Catch the big catfish (river path)' },
  { id: 'goggles', name: 'Swim Goggles', need: 'Score a perfect 30 dive (Cannonball Contest)' },
];

const ITEMS = [
  { k: 'star', pts: 10, min: 0 }, { k: 'baseball', pts: 15, min: 0 }, { k: 'card', pts: 25, min: 60 },
  { k: 'diamond', pts: 25, min: 100 }, { k: 'cupcake', pts: 30, min: 150 }, { k: 'balloon', pts: 50, min: 250 },
];

export function trampolineScene({ story = false, timed = true } = {}) {
  const T = story ? 30 : timed ? 60 : Infinity;
  const HT = story ? STORY_HEIGHTS : HEIGHTS, MAXP = HT.length - 1;
  const S = {
    name: 'tramp', story, timed: T !== Infinity, maxP: MAXP,
    parts: new Particles(), pops: new Pops(),
    p: { x: CX, y: MAT - 1, vx: 0, vy: -Math.sqrt(2 * GRAV * HEIGHTS[3]), rot: 0, flipDir: 1, flips: [], flipT: 0, spinT: 0, spins: 0, worm: false, contact: 0, daze: 0, face: 1, sink: 0, landWorm: 0 },
    power: 3, combo: 0, score: 0, time: T, items: [], camY: 0, lastA: -9, best: '', bestHeight: 0, bestCombo: 0, tricksDone: 0,
    milestones: {}, over: false, fans: 0, plane: -400, ufo: -300, tutorial: story ? 0 : -1, sunny: { x: 60, vx: 0, face: 1, hop: 0, y: GROUND },
    enter() {
      audio.play('bounce');
      setPad('trick', { a: 'FLIP', b: 'SPIN' });
      if (story) this.tutor();
      else { banner(this.timed ? 'GO!' : 'FREE BOUNCE!', 1200); audio.sfx('go'); }
    },
    async tutor() {
      const pad = input.touchMode, gp = input.padConnected && !pad;
      const FLIP = pad ? 'FLIP' : gp ? 'A' : 'SPACE', SPIN = pad ? 'SPIN' : gp ? 'B' : 'X', DOWN = pad ? '▼' : '↓';
      await wait(0.4);
      tip(`Tap ${FLIP} right as you land to bounce HIGHER!`);
      await until(() => this.power >= 5 || this.time < 24);
      tip(`In the air: ${FLIP} = BACKFLIP! Hold ◀ or ▶ + ${FLIP} = front flip!`);
      await until(() => this.tricksDone >= 2 || this.time < 15);
      tip(`${SPIN} = 360 twist! ${DOWN} = THE WORM!`);
      await wait(5);
      tip('Land tricks in a row for a COMBO — up to x8!');
      await wait(5);
      tip('');
    },
    update(dt) {
      const p = this.p;
      this.parts.update(dt); this.pops.update(dt);
      if (this.over) { this.updateCam(dt); return; }
      if (this.timed) {
        const before = Math.ceil(this.time);
        this.time = Math.max(0, this.time - dt);
        if (Math.ceil(this.time) !== before && this.time <= 5 && this.time > 0) audio.sfx('countdown');
      }
      if (input.aPressed || input.tapPressed) this.lastA = game.t;

      if (p.daze > 0) {
        p.daze -= dt;
        if (p.daze <= 0) { p.x = CX - 20; p.y = MAT - 1; p.vy = -Math.sqrt(2 * GRAV * HEIGHTS[3]); p.vx = 30; audio.sfx('jump'); }
        this.updateSunny(dt); this.updateCam(dt); this.updateItems(dt);
        return;
      }

      if (p.contact > 0) {
        // on the mat, compressing
        p.contact -= dt;
        if ((input.aPressed || input.tapPressed) && !p.perfect) p.perfect = true;
        if (p.contact <= 0) this.launch();
      } else {
        // steering + gentle assist toward the middle
        const dir = this.noSteer > 0 ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
        this.noSteer = Math.max(0, (this.noSteer || 0) - dt);
        if (dir) { p.vx = clamp(p.vx + dir * 260 * dt, -70, 70); p.face = dir; }
        else p.vx += clamp((CX - p.x) * 2.2, -90, 90) * dt;
        p.vx *= 1 - 0.6 * dt;
        // tricks (not in the landing window)
        const tLand = this.timeToMat();
        const nearLand = p.vy > 0 && tLand < 0.2;
        if (!nearLand) {
          if ((input.aPressed || input.tapPressed) && p.vy > 0 && tLand < p.flipT + FLIP_T * 0.9) {
            this.lastA = game.t; // too late for another flip: count it as timing the landing
          } else if (input.aPressed || input.tapPressed) {
            this.noSteer = 0.25;
            if (p.flips.length < 6) {
              const front = (input.right && p.face > 0) || (input.left && p.face < 0);
              p.flips.push(front ? 'F' : 'B');
              if (p.flipT <= 0) { p.flipT = FLIP_T; p.flipDir = front ? 1 : -1; }
              else p.flipT += FLIP_T;
              audio.sfx('flip');
            }
          }
          if (input.bPressed) { p.spins++; p.spinT += SPIN_T; audio.sfx('whoosh'); }
          if (input.downPressed && !p.worm) { p.worm = true; audio.sfx('worm'); }
        }
        if (p.flipT > 0) { p.flipT = Math.max(0, p.flipT - dt); p.rot += p.flipDir * (Math.PI * 2 / FLIP_T) * dt * p.face; if (p.flipT === 0) p.rot = 0; }
        if (p.spinT > 0) p.spinT = Math.max(0, p.spinT - dt);
        p.vy += GRAV * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 10) { p.x = 10; p.vx = Math.abs(p.vx) * 0.5; }
        if (p.x > W - 10) { p.x = W - 10; p.vx = -Math.abs(p.vx) * 0.5; }
        const alt = MAT - p.y;
        if (alt > this.bestHeight) this.bestHeight = alt;
        this.checkMilestones(alt);
        if (p.y > MAT - 46 && Math.abs(p.x - CX) > HALF + 2) {
          const side = Math.sign(p.x - CX);
          p.x = CX + side * (HALF + 2); p.vx = -side * Math.max(40, Math.abs(p.vx) * 0.6);
          if (!this.netT || game.t - this.netT > 0.4) { this.netT = game.t; audio.sfx('boing', { p: 1 }); this.pops.add('BOING!', p.x, p.y - 30, '#8fe8ff'); }
        }
        if (p.vy > 0 && p.y >= MAT) {
          if (Math.abs(p.x - CX) <= HALF + 4) this.land();
          else if (p.y >= GROUND) this.oof();
        }
      }
      this.updateItems(dt);
      this.updateSunny(dt);
      this.updateCam(dt);
      if (this.timed && this.time <= 0 && p.contact > 0 && !this.over) this.finish();
      if (this.timed && this.time <= 0 && p.daze > 0 && !this.over) this.finish();
      this.drawHud();
    },
    timeToMat() {
      const p = this.p; const d = MAT - p.y;
      if (p.vy <= 0) return 9;
      return (-p.vy + Math.sqrt(p.vy * p.vy + 2 * GRAV * Math.max(0, d))) / GRAV;
    },
    land() {
      const p = this.p;
      p.y = MAT; p.contact = 0.12; p.perfect = game.t - this.lastA < 0.22;
      p.sink = Math.min(9, 3 + p.vy / 90);
      const rotOff = Math.abs(((p.rot % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const bonk = p.flipT > 0.1 || p.spinT > 0.1 || (p.flipT > 0 && rotOff < 2.3);
      if (bonk && (p.flips.length || p.spins)) {
        audio.sfx('bonk');
        this.pops.add(pick(['BONK!', 'WOBBLE!', 'OOPSIE!']), p.x, p.y - 34, '#ff8a80');
        this.combo = 0; this.power = Math.max(3, this.power - 2); p.bonked = true; game.shake = 2;
      } else if (p.flips.length || p.spins || p.worm) {
        const { name, pts } = trickName(p);
        const repeat = name === this.lastTrick;
        this.lastTrick = name;
        if (!repeat) this.combo = Math.min(8, this.combo + 1);
        this.maxFlips = Math.max(this.maxFlips || 0, p.flips.length);
        this.maxSpins = Math.max(this.maxSpins || 0, p.spins);
        const mult = Math.max(1, this.combo);
        this.score += pts * mult; this.tricksDone++;
        this.pops.add(name, p.x, p.y - 44, '#ffde5c', 1, 1.2);
        this.pops.add(`+${pts * mult}${mult > 1 ? ' (x' + mult + ')' : ''}`, p.x, p.y - 34, '#fff', 1, 1.2);
        this.parts.sparkle(p.x, p.y - 12, 12);
        if (pts * mult > (this.bestPts || 0)) { this.bestPts = pts * mult; this.best = name; }
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        if (this.combo >= 2) { banner('x' + this.combo + ' COMBO!', 900); }
        this.fans = 1;
        if (p.worm) { p.landWorm = 0.5; }
      }
      p.flips = []; p.flipT = 0; p.rot = 0; p.spins = 0; p.spinT = 0; p.worm = false;
      p.vx *= 0.4;
    },
    launch() {
      const p = this.p;
      if (p.perfect && !p.bonked) {
        this.perfStreak = (this.perfStreak || 0) + 1; this.bestPerfStreak = Math.max(this.bestPerfStreak || 0, this.perfStreak);
        this.power = Math.min(MAXP, this.power + 1);
        if (this.power === MAXP && story) this.pops.add('MAX POW!', p.x, p.y - 36, '#ff7d98', 1, 1.2);
        this.score += 10 * Math.max(1, this.combo);
        this.pops.add('PERFECT!', p.x, p.y - 26, '#9fe35f', 1, 1);
        this.parts.burst(p.x, MAT + 2, 14, { colors: ['#9fe35f', '#ffffff', '#ffde5c'], speed: 90, g: 120, life: 0.5 });
        if (this.power >= 7) game.shake = 2;
        audio.sfx('perfect', { combo: this.power });
        this.fans = 1;
      } else if (!p.bonked) { if (!story) this.power = Math.max(3, this.power - 1); this.perfStreak = 0; } // story mode: only bonks/falls cost power
      p.bonked = false; p.perfect = false;
      p.vy = -Math.sqrt(2 * GRAV * HT[this.power]);
      audio.sfx('boing', { p: this.power });
      this.parts.burst(p.x, MAT + 2, 6, { colors: ['#ffffff', '#6aa6ff'], speed: 40, g: 200, life: 0.4 });
      p.sink = 0;
    },
    oof() {
      const p = this.p;
      p.y = GROUND; p.vy = 0; p.vx = 0; p.daze = 1.3; p.flips = []; p.flipT = 0; p.rot = 0; p.spins = 0; p.spinT = 0; p.worm = false;
      this.combo = 0; this.power = 3;
      audio.sfx('oof'); game.shake = 3;
      this.pops.add('OOF!', p.x, p.y - 30, '#ff8a80');
      this.sunny.target = p.x;
      setTimeout(() => audio.sfx('bark', { n: 2 }), 300);
    },
    checkMilestones(alt) {
      const M = [[150, 'TREETOPS!'], [385, 'SKY ZONE!'], [620, 'AIRPLANE ZONE!'], [800, 'OUTER SPACE!!!']];
      for (const [h, name] of M) if (alt >= h && !this.milestones[h]) { this.milestones[h] = 1; banner(name, 1300); audio.sfx('unlock'); if (h === 800) { this.parts.confetti(this.p.x, this.p.y, 30); } }
    },
    updateItems(dt) {
      const p = this.p;
      const reach = HT[Math.min(MAXP, this.power + 2)] + 30;
      while (this.items.length < 6) {
        const opts = ITEMS.filter((i) => i.min <= reach);
        const it = pick(opts);
        const alt = rand(Math.max(24, it.min), Math.max(it.min + 40, reach));
        const star = alt > 520 && Math.random() < 0.25;
        this.items.push({ k: star ? 'star' : it.k, pts: star ? 100 : it.pts, gold: star, x: rand(CX - 90, CX + 90), y: MAT - alt, t: 0, vx: rand(-6, 6) });
      }
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.t += dt; it.x += it.vx * dt;
        if (it.x < 16 || it.x > W - 16) it.vx *= -1;
        const dx = it.x - p.x, dy = it.y - (p.y - 12);
        if (!p.daze && dx * dx + dy * dy < 15 * 15) {
          const pts = it.pts * Math.max(1, Math.ceil(this.combo / 2));
          this.score += pts;
          this.pops.add('+' + pts, it.x, it.y - 6, it.gold ? '#ffde5c' : '#fff');
          this.parts.sparkle(it.x, it.y, 8, it.gold ? '#ffde5c' : '#fff8b0');
          audio.sfx(it.k === 'card' ? 'card' : 'coin');
          this.items.splice(i, 1);
        } else if (it.t > 14 || it.y > MAT - 10) this.items.splice(i, 1);
      }
    },
    updateSunny(dt) {
      const s = this.sunny, p = this.p;
      const tx = s.target ?? (p.x + Math.sin(game.t * 0.7) * 50);
      if (Math.abs(tx - s.x) > 4) { s.vx = clamp((tx - s.x) * 3, -120, 120); s.face = Math.sign(s.vx); } else { s.vx = 0; if (s.target && !p.daze) s.target = null; }
      s.x = clamp(s.x + s.vx * dt, 10, W - 10);
      if (s.hop > 0) s.hop -= dt;
      if (this.fans > 0 && s.hop <= 0) s.hop = 0.4;
      if (!p.daze && s.target && Math.abs(s.x - s.target) < 6) s.target = null;
      this.fans = Math.max(0, this.fans - dt * 2);
    },
    updateCam(dt) {
      const p = this.p, falling = p.vy > 0;
      const target = Math.min(0, p.y - 64 + (falling ? Math.min(50, p.vy * 0.1) : 0));
      this.camY = lerp(this.camY, target, Math.min(1, dt * (falling ? 18 : 6)));
    },
    exit() { tip(''); },
    async finish() {
      this.over = true;
      tip('');
      audio.sfx('whistle');
      banner("TIME'S UP!", 1500);
      await wait(1.6);
      showResults(this);
    },
    drawHud() {
      const t = this.timed ? `⏱ ${Math.ceil(this.time)}` : 'FREE';
      const c = this.combo >= 2 ? `<span style="color:#ffde5c">x${this.combo}</span>` : '';
      hud(`★ ${this.score}`, `${t} ${c}`, `BEST ${Math.max(save.data.tramp.high, this.score)}`);
    },
    render() {
      renderTramp(this);
    },
  };
  return S;
}

function trickName(p) {
  const n = p.flips.length, back = p.flips.filter((f) => f === 'B').length, front = n - back, m = p.spins;
  let name = '', pts = 0;
  if (n) {
    const kind = back && front ? 'FLIP-FLOP' : back ? 'BACKFLIP' : 'FRONT FLIP';
    const mult = ['', '', 'DOUBLE ', 'TRIPLE ', 'QUAD ', 'MEGA ', 'ULTRA '][Math.min(6, n)];
    name = mult + kind;
    pts = n * 100 + (n > 1 ? (n - 1) * 100 : 0);
  }
  if (m) {
    const deg = m * 360;
    if (n) { name = (m > 1 ? deg + ' ' : 'TWISTING ') + name; pts += m * 80 + 50; }
    else { name = deg + '!'; pts += m * 80 + (m > 1 ? 40 : 0); }
  }
  if (p.worm) { name = name ? name + ' + WORM!' : 'THE WORM!'; pts += 60; }
  return { name: name + (name.endsWith('!') ? '' : '!'), pts };
}

// ---------------- rendering ----------------
const SKY = [[0, '#7ec8ff'], [250, '#62aef5'], [500, '#3f78d8'], [700, '#223a8a'], [850, '#0c0f33'], [2000, '#05051a']];
function skyAt(alt) {
  for (let i = 1; i < SKY.length; i++) if (alt <= SKY[i][0]) { const [a0, c0] = SKY[i - 1], [a1, c1] = SKY[i]; return A.mix(c0, c1, Math.floor(((alt - a0) / (a1 - a0)) * 6) / 6); }
  return SKY[SKY.length - 1][1];
}
function renderTramp(S) {
  const cy = Math.round(S.camY), p = S.p;
  for (let y = 0; y < H; y += 4) { G.fillStyle = skyAt(MAT - (y + cy)); G.fillRect(0, y, W, 4); }
  const alt0 = MAT - cy;
  // stars in space
  if (alt0 > 560) { G.globalAlpha = Math.min(1, (alt0 - 560) / 200); for (let i = 0; i < 50; i++) { const x = (i * 97) % W, y = ((i * 57 - cy * 0.3) % 400 + 400) % 400 - 100; if (y > 0 && y < H) rect(x, y, 1, 1, (i + Math.floor(game.t * 3)) % 7 ? '#fff' : '#ffde5c'); } G.globalAlpha = 1; }
  G.save(); G.translate(0, -cy);
  // moon + planet + ufo way up
  circle(200, MAT - 1000, 16, '#f2f0e6'); circle(194, MAT - 1004, 3, '#d6d3c6'); circle(206, MAT - 994, 2, '#d6d3c6');
  circle(50, MAT - 940, 9, '#ff9f6b'); rect(36, MAT - 941, 28, 2, '#ffd9a8');
  S.ufo += 0.6; const ux = ((S.ufo % 500) + 500) % 500 - 100, uy = MAT - 900 + Math.sin(game.t * 2) * 6;
  ellipse(ux, uy, 12, 3, '#9aa3b8'); ellipse(ux, uy - 3, 5, 4, '#8fdcff'); rect(ux - 1, uy - 4, 2, 2, '#62bf4c'); if (Math.floor(game.t * 2) % 2) rect(ux + 2, uy - 6, 1, 2, '#62bf4c');
  // plane with a birthday banner
  S.plane += 0.9; const px = ((S.plane % 700) + 700) % 700 - 150;
  A.planeBanner(px, MAT - 640, 'HAPPY BIRTHDAY ' + K + '!');
  // clouds
  for (let i = 0; i < 8; i++) { const cx = ((i * 83 + game.t * (4 + i)) % 360) - 60, yy = MAT - 330 - (i * 37) % 180; circle(cx, yy, 9, '#ffffff'); circle(cx + 10, yy - 3, 11, '#ffffff'); circle(cx + 22, yy, 8, '#ffffff'); rect(cx - 6, yy, 36, 6, '#ffffff'); }
  // birds
  for (let i = 0; i < 4; i++) { const bx = ((game.t * 25 + i * 60) % 330) - 40, by = MAT - 200 - i * 14; const f = Math.floor(game.t * 5 + i) % 2; rect(bx, by, 2, 1, '#2a1f33'); rect(bx + 2, by + (f ? -1 : 1), 2, 1, '#2a1f33'); rect(bx - 2, by + (f ? -1 : 1), 2, 1, '#2a1f33'); }
  // backyard
  A.treeLine(0, 0, GROUND - 58, '#4f9a4c', '#3f8a3a');
  A.fenceWood(0, W, GROUND - 6, 26, 0);
  A.tree(228, GROUND - 4, 1.3);
  // lawn chairs: Mom & Dad cheering
  const cheer = S.fans > 0.5;
  spr(cheer ? SPR.mom.wave : SPR.mom.idle, 14, GROUND - 32 - (cheer ? 3 : 0));
  spr(cheer ? SPR.dad.cheer : SPR.dad.idle, 32, GROUND - 32 - (cheer ? 3 : 0), false);
  spr(SPR.freida.loaf, 190, GROUND - 6 - 26 - 12);
  spr(SPR.bunny, 52, GROUND - 13);
  rect(0, GROUND, W, H + 300, '#62b34f');
  for (let x = 0; x < W; x += 8) rect(x + 3, GROUND + 2 + (x & 2), 1, 2, '#4ca83c');
  A.trampoline(CX, GROUND, HALF * 2 + 4, p.contact > 0 ? p.sink : 0);
  // items
  for (const it of S.items) {
    const img = SPR[it.k];
    const b = Math.sin(it.t * 3) * 2;
    if (it.gold) { G.globalAlpha = 0.5 + Math.sin(game.t * 8) * 0.3; circle(it.x, it.y + b, 7, '#fff4b5'); G.globalAlpha = 1; }
    spr(img, it.x - img.width / 2, it.y + b - img.height / 2);
  }
  // Sunny
  const s = S.sunny, simg = s.vx ? (Math.floor(game.t * 10) % 2 ? SPR.sunny.run1 : SPR.sunny.run2) : SPR.sunny.stand;
  spr(simg, s.x - simg.width / 2, GROUND - simg.height - (s.hop > 0 ? Math.sin((s.hop / 0.4) * Math.PI) * 8 : 0), s.face < 0);
  drawIsaac(S);
  S.parts.draw(); S.pops.draw();
  G.restore();
  // power meter
  rect(W - 12, 30, 8, 64, '#2a1f33');
  const n = S.maxP, seg = Math.floor(60 / n);
  for (let i = 0; i < n; i++) rect(W - 11, 92 - (i + 1) * seg, 6, seg - 1, i < S.power ? A.mix('#9fe35f', '#ff5d73', i / (n - 1)) : '#4a4058');
  pixelText('POW', W - 16, 96, '#fff', 1, '#2a1f33');
}

function drawIsaac(S) {
  const p = S.p, I = SPR.isaac;
  if (p.daze > 0) {
    sprRot(I.tuck, p.x, GROUND - 8, Math.PI / 2 * p.face);
    for (let i = 0; i < 3; i++) { const a = game.t * 5 + i * 2.1; rect(p.x + Math.cos(a) * 9, GROUND - 22 + Math.sin(a) * 3, 2, 2, '#ffde5c'); }
    return;
  }
  if (p.landWorm > 0) { p.landWorm -= 1 / 60; drawWorm(p.x, MAT + 2, 0.5 - p.landWorm); return; }
  const y = p.contact > 0 ? MAT + p.sink - 2 : p.y;
  const cx = p.x, cyy = y - 12;
  let img = I.jump;
  if (p.contact > 0) img = I.walkB;
  else if (p.flipT > 0) img = I.tuck;
  else if (p.vy > 60 && MAT - p.y > 120) img = I.star;
  const spin = p.spinT > 0 ? Math.cos((p.spinT / SPIN_T) * Math.PI * 2) : 1;
  G.save();
  G.translate(Math.round(cx), Math.round(cyy));
  if (p.worm && p.contact <= 0) G.rotate(Math.PI / 2 * p.face);
  else G.rotate(p.rot);
  G.scale((p.face < 0 ? -1 : 1) * (Math.abs(spin) < 0.15 ? 0.15 * Math.sign(spin || 1) : spin), 1);
  G.drawImage(img, -8, -12);
  drawHat(save.data.tramp.hat);
  G.restore();
}

export function drawHat(id, g = G) {
  const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  if (id === 'party') { r(-1, -19, 3, 2, '#ffde5c'); r(-2, -17, 5, 2, '#e8483f'); r(-3, -15, 7, 2, '#3d7be0'); r(-4, -13, 9, 2, '#e8483f'); r(0, -21, 1, 2, '#fff'); }
  if (id === 'cap') { r(-6, -14, 11, 4, '#3d7be0'); r(-5, -15, 9, 1, '#3d7be0'); r(4, -11, 5, 2, '#2a55a3'); r(-1, -13, 2, 2, '#fff'); }
  if (id === 'spidey') { r(-5, -10, 12, 12, '#e8483f'); for (let i = 0; i < 4; i++) r(-5, -9 + i * 3, 12, 1, '#7a1c24'); r(0, -10, 1, 12, '#7a1c24'); r(-3, -5, 3, 3, '#fff'); r(3, -5, 3, 3, '#fff'); }
  if (id === 'diamond') { r(-7, -14, 14, 7, '#5cd6ff'); r(-7, -14, 14, 1, '#d4f6ff'); r(-7, -7, 2, 5, '#5cd6ff'); r(5, -7, 2, 5, '#5cd6ff'); r(-4, -12, 2, 2, '#d4f6ff'); r(2, -11, 2, 2, '#2aa6d6'); }
  if (id === 'pup') { r(-7, -15, 14, 6, '#e8483f'); r(-8, -10, 16, 2, '#c0302a'); r(-2, -14, 4, 4, '#ffde5c'); r(-1, -13, 2, 2, '#e8483f'); }
  if (id === 'bunny') {
    r(-6, -25, 5, 16, '#2a1f33'); r(1, -26, 5, 17, '#2a1f33');
    r(-5, -24, 3, 15, '#f7f3ea'); r(-4, -22, 1, 10, '#ff9eaa'); r(2, -25, 3, 16, '#f7f3ea'); r(3, -23, 1, 11, '#ff9eaa');
  }
  if (id === 'pika') {
    const Y = '#ffd23f', O = '#2a1f33';
    r(-7, -22, 4, 8, O); r(-6, -21, 2, 6, Y); r(-6, -22, 2, 2, O); r(3, -22, 4, 8, O); r(4, -21, 2, 6, Y); r(4, -22, 2, 2, O);
    r(-9, -16, 18, 7, O); r(-8, -15, 16, 6, Y);
    r(-9, -10, 4, 11, O); r(-8, -10, 2, 10, Y); r(5, -10, 4, 11, O); r(6, -10, 2, 10, Y);
    r(-4, -14, 2, 2, O); r(2, -14, 2, 2, O); r(-1, -12, 2, 1, '#ff7d98'); r(-7, -12, 2, 2, '#e8483f'); r(5, -12, 2, 2, '#e8483f');
    r(-8, 1, 1, 5, Y); r(7, 1, 1, 5, Y); r(-9, 6, 3, 1, '#e8483f'); r(-9, 7, 3, 1, '#ffffff'); r(6, 6, 3, 1, '#e8483f'); r(6, 7, 3, 1, '#ffffff');
  }
  if (id === 'fishing') {
    r(-11, -12, 22, 3, '#2a1f33'); r(-10, -11, 20, 1, '#7a8456'); r(-10, -10, 20, 1, '#4d5636');
    r(-7, -19, 14, 8, '#2a1f33'); r(-6, -18, 12, 7, '#7a8456'); r(-6, -13, 12, 1, '#5e6842'); r(-3, -16, 3, 1, '#c8d94a'); r(0, -16, 1, 1, '#2a4a8a');
    r(-7, -9, 1, 9, '#2a1f33'); r(6, -9, 1, 9, '#2a1f33'); r(-2, 1, 4, 1, '#2a1f33');
  }
  if (id === 'collector') { const c = ['#ff7d98', '#ffde5c', '#8fe8ff', '#9fe35f']; for (let i = 0; i < 11; i++) r(-6 + i, -15 + (i < 1 || i > 9 ? 1 : 0), 1, 5, c[(i + Math.floor(Date.now() / 150)) % 4]); r(4, -11, 5, 2, '#ffcd3c'); r(-1, -14, 2, 2, '#fff'); }
  if (id === 'goggles') {
    r(-7, -5, 7, 2, '#e8483f'); r(-7, -5, 7, 1, '#ff7d98');
    r(-1, -6, 7, 4, '#2a1f33'); r(0, -5, 2, 2, '#5cd6ff'); r(3, -5, 2, 2, '#5cd6ff'); r(0, -5, 1, 1, '#d4f6ff'); r(3, -5, 1, 1, '#d4f6ff');
  }
  if (id === 'crown') { r(-5, -16, 11, 5, '#ffcd3c'); r(-5, -19, 2, 3, '#ffcd3c'); r(0, -20, 2, 4, '#ffcd3c'); r(4, -19, 2, 3, '#ffcd3c'); r(0, -15, 2, 2, '#e8483f'); r(-4, -14, 1, 1, '#5cd6ff'); r(4, -14, 1, 1, '#5cd6ff'); }
}

// ---------------- results / menu ----------------
async function showResults(S) {
  const t = save.data.tramp;
  const run = { score: S.score, height: S.bestHeight, combo: S.bestCombo, perfStreak: S.bestPerfStreak || 0, flips: S.maxFlips || 0, spins: S.maxSpins || 0 };
  const newRec = S.score > t.high;
  t.high = Math.max(t.high, S.score); t.bestHeight = Math.max(t.bestHeight, S.bestHeight); t.bestCombo = Math.max(t.bestCombo, S.bestCombo); t.plays++;
  const unlocked = HATS.filter((h) => h.test && !t.hats.includes(h.id) && h.test(run)).slice(0, 2); // at most 2 per round: always something to chase
  for (const h of unlocked) t.hats.push(h.id);
  save.flush();
  if (newRec) audio.sfx('record'); else if (unlocked.length) audio.sfx('unlock');
  const feet = (h) => Math.round(h / 4) + ' ft';
  const body = `
    ${newRec ? '<div class="newrec">★ NEW HIGH SCORE! ★</div>' : ''}
    <div class="stats">
      <span>Score</span><b>${S.score}</b>
      <span>Best trick</span><b>${S.best || '—'}</b>
      <span>Highest bounce</span><b>${feet(S.bestHeight)}${S.bestHeight >= 800 ? ' (SPACE!)' : ''}</b>
      <span>Best combo</span><b>x${S.bestCombo}</b>
      <span>High score</span><b>${t.high}</b>
    </div>
    ${unlocked.map((h) => `<p class="sub">🎉 NEW HAT: <b>${h.name}</b>!</p>`).join('')}`;
  if (S.story) {
    await menu({ title: 'WHAT A FIRST BOUNCE!', body, buttons: [{ v: 'go', label: 'Keep going ▶', cls: 'go' }] });
    const { birthdayCard } = await import('./title.js');
    await birthdayCard();
    save.set({ done: true });
    const { titleScene } = await import('./title.js');
    fadeTo(() => setScene(titleScene()));
    return;
  }
  const v = await menu({ title: "TIME'S UP!", body, buttons: [{ v: 'again', label: 'BOUNCE AGAIN! ▶', cls: 'go' }, { v: 'hats', label: '🎩 Pick a hat' }, { v: 'menu', label: 'Main menu' }] });
  if (v === 'again') fadeTo(() => setScene(trampolineScene({ timed: true })));
  else if (v === 'hats') { await hatPicker(); fadeTo(() => setScene(trampolineScene({ timed: true }))); }
  else { const { titleScene } = await import('./title.js'); fadeTo(() => setScene(titleScene())); }
}

function hatPreview(id) {
  const c = offscreen(28, 44, (g) => { g.save(); g.translate(14, 30); g.drawImage(SPR.isaac.idle, -8, -12); drawHat(id, g); g.restore(); });
  return c.toDataURL();
}
export async function hatPicker() {
  const t = save.data.tramp;
  const tiles = HATS.map((h) => {
    const ok = t.hats.includes(h.id), on = t.hat === h.id;
    return `<button class="hat-tile ${ok ? '' : 'locked'} ${on ? 'on' : ''}" ${ok ? `data-v="${h.id}"` : `data-lock="${h.need}"`}>
      <img src="${hatPreview(h.id)}" alt=""><b>${h.name}</b><small>${ok ? (on ? 'Wearing ✓' : 'Tap to wear') : '🔒 ' + h.need}</small></button>`;
  }).join('');
  const p = overlay(`<div class="menu pop hatmenu"><h1>PICK A HAT</h1>
      <p class="sub">Unlock hats in Trampoline Time: score big, bounce high, land combos!</p>
      <div class="hatgrid">${tiles}</div>
      <div class="menu-btns"><button class="big" data-v="done">Done</button></div></div>`, { cls: 'dim' });
  document.querySelectorAll('#overlay [data-lock]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
    audio.sfx('bump'); toast('🔒 To unlock: ' + b.dataset.lock, 2200);
  }));
  const v = await p;
  if (v && v !== 'done') { t.hat = v; save.flush(); audio.sfx('select'); toast('Now wearing: ' + HATS.find((h) => h.id === v).name + '!', 1600); }
}
