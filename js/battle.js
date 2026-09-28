// "A wild ___ appeared!" — Pokémon-style encounters (Freida, the Red River catfish, Sunny).
import { W, H, G, game, rect, tri, circle, ellipse, spr, sprRot, pixelText, textWidth, wait, until, Particles, rand, pick, offscreen } from './engine.js';
import * as A from './art.js';
import { drawHat } from './tramp.js';
import { save } from './save.js';
import { SPR } from './sprites.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { say, choose, clueCard, foeCard, banner, hud, setPad, toast, wormBanner } from './ui.js';
import { drawWorm } from './world.js';
import { CONFIG } from './config.js';
import { afterBattle } from './levels.js';

const K = CONFIG.kid.toUpperCase();

const FOES = {
  freida: {
    name: 'FREIDA', sprite: () => SPR.freida.loaf, scale: 2.4, theme: ['#dfe9f2', '#c9d6c2', '#9fc48a'],
    card: { who: 'freida', name: 'FREIDA', hp: 90, type: 'Calico · Nap-type', color: '#ffb35c',
      moves: [['Grumpy Stare', 30, 'The target feels deeply judged.'], ['Loaf Mode', '∞', 'Becomes a perfect loaf. Cannot be moved.']],
      flavor: 'Guards clues by sitting on them. Weak to treats.' },
    script: freidaScript,
  },
  mooneye: {
    name: 'MOONEYE', sprite: () => SPR.goldeye, scale: 3, flip: false, theme: ['#bfe3f2', '#7a5446', '#6aa84f'], water: '#7a5446',
    card: { who: 'goldeye', name: 'MOONEYE', hp: 30, type: 'Red River · Water-type', color: '#d4f6ff',
      moves: [['Silver Flash', 10, 'Sparkles in the sun. Very shiny.'], ['Big Golden Eye', 20, 'Stares right back at you.']],
      flavor: 'Goldeye or mooneye? Even the experts squint at these twins.' },
  },
  catfish: {
    name: 'CATFISH', sprite: () => SPR.catfish, scale: 3, flip: false, theme: ['#bfe3f2', '#8a5a44', '#6aa84f'], water: '#8a5a44',
    card: { who: 'catfish', name: 'CHANNEL CATFISH', hp: 120, type: 'Red River · Water-type', color: '#8fd8ff',
      moves: [['Whisker Wiggle', 20, 'Tickles your line. Very sneaky.'], ['Mud Splash', 40, 'Sprays muddy Red River water everywhere.']],
      flavor: 'The biggest fish in the Red River. Rumored to swallow clues.' },
    script: catfishScript,
  },
  sunny: {
    name: 'SUNNY', sprite: () => SPR.sunny.stand, scale: 2.6, theme: ['#d8f3ff', '#35a8e8', '#ece6da'], water: '#35a8e8',
    card: { who: 'sunny', name: 'SUNNY', hp: 70, type: 'Red Mini Poodle · Fluffy-type', color: '#ff9f6b',
      moves: [['Splash', '∞', 'Jumps in the pool. Everyone gets wet.'], ['Zoomies', 80, 'Runs in circles at maximum speed.']],
      flavor: '7 months old. A very good pup. Extremely curly.' },
    script: sunnyScript,
  },
};

export function battleScene(id) {
  const F = FOES[id];
  const S = {
    name: 'battle', id, F, love: 0, loveMax: 2, parts: new Particles(),
    foe: { x: 192, y: 56, shake: 0, hop: 0, hidden: true, slide: 1 }, me: { x: 64, y: 100, pose: 'idle', worm: 0, rod: id === 'catfish' },
    reel: null,
    enter() {
      audio.play('battle');
      setPad('none');
      hud('', '', '');
      F.script(S).catch((e) => console.error(e));
    },
    update(dt) {
      this.parts.update(dt);
      const f = this.foe;
      f.shake = Math.max(0, f.shake - dt);
      f.slide = Math.max(0, f.slide - dt * 1.8);
      if (f.hop > 0) f.hop = Math.max(0, f.hop - dt * 3);
      if (this.me.worm) this.me.worm += dt;
      if (this.bell > 0) this.bell -= dt;
      if (this.reel) this.updateReel(dt);
    },
    render() {
      if (this.id === 'catfish') return renderFishing(this);
      const F = this.F;
      const [skyC, groundC, platC] = F.theme;
      rect(0, 0, W, H, skyC);
      if (F.water) { rect(0, 70, W, H, F.water); for (let i = 0; i < 20; i++) rect((i * 37 + game.t * 12) % W, 74 + (i * 13) % 60, 8, 1, 'rgba(255,255,255,.25)'); }
      else { rect(0, 70, W, H, groundC); }
      ellipse(this.foe.x, this.foe.y + 4, 46, 9, platC); ellipse(this.foe.x, this.foe.y + 3, 42, 7, lighten(platC));
      ellipse(this.me.x, this.me.y + 4, 50, 10, '#e8e2d6'); ellipse(this.me.x, this.me.y + 3, 46, 8, '#f6f1e6');
      // foe
      const f = this.foe;
      if (!f.hidden) {
        const img = F.sprite();
        const sx = Math.round(f.slide * 140 + (f.shake > 0 ? Math.sin(game.t * 60) * 3 : 0));
        const hop = Math.sin(f.hop * Math.PI) * 14;
        const bob = Math.sin(game.t * 2) * 1;
        G.save(); G.translate(Math.round(f.x + sx), Math.round(f.y - hop + bob)); G.scale((F.flip === false ? 1 : -1) * F.scale, F.scale);
        G.drawImage(img, -Math.floor(img.width / 2), -img.height); G.restore();
      }
      // Isaac
      const m = this.me;
      G.save(); G.translate(m.x, m.y); G.scale(2, 2);
      if (m.worm) drawWorm(0, 0, m.worm, false);
      else spr(SPR.isaac[m.pose] || SPR.isaac.idle, -8, -24);
      G.restore();
      if (m.rod) {
        rect(m.x + 14, m.y - 34, 2, 2, '#6b4a2f');
        G.strokeStyle = '#6b4a2f'; G.lineWidth = 1; G.beginPath(); G.moveTo(m.x + 8, m.y - 22); G.lineTo(m.x + 40, m.y - 60); G.stroke();
        G.strokeStyle = 'rgba(255,255,255,.8)'; G.beginPath(); G.moveTo(m.x + 40, m.y - 60);
        const bx = this.reel || !f.hidden ? f.x - 30 + (f.shake > 0 ? Math.sin(game.t * 40) * 2 : 0) : 150, by = this.reel || !f.hidden ? f.y - 10 : 80 + Math.sin(game.t * 3) * 1;
        G.quadraticCurveTo(m.x + 90, m.y - 60, bx, by); G.stroke();
        if (f.hidden) { rect(bx - 1, by - 2, 3, 2, '#e8483f'); rect(bx - 1, by, 3, 1, '#fff'); }
      }
      // info boxes
      if (!f.hidden && f.slide < 0.2) infoBox(8, 8, F.name, this.love, this.loveMax);
      infoBox(W - 108, 80, K, null, null, 'Lv.' + CONFIG.age);
      if (this.reel) this.drawReel();
      this.parts.draw(0, 0);
    },
    // ---- reel-in mini game (catfish) ----
    startReel(need) {
      this.reel = { p: 0.15, need, t: 0, done: false };
      setPad('action', { a: 'REEL!' });
      toast(input.touchMode ? 'Tap REEL! as fast as you can!' : 'Mash SPACE (or A) to reel it in!', 2500);
      return until(() => this.reel.done);
    },
    updateReel(dt) {
      const r = this.reel;
      if (r.done) return;
      r.t += dt;
      if (input.aPressed || input.tapPressed || input.bPressed) { r.p += 1 / r.need; audio.sfx('reel'); this.foe.shake = 0.15; this.bell = 0.3; if (Math.random() < 0.25) audio.sfx('bell'); if (Math.random() < 0.3) this.parts.burst(this.foe.x - 20, this.foe.y, 4, { colors: ['#8fdcff', '#fff'], speed: 50, g: 200, up: 40 }); }
      r.p = Math.max(0.05, r.p - dt * 0.045);
      if (r.t > 9) r.p += dt * 0.5; // Mom helps if it's taking a while
      if (r.p >= 1) { r.done = true; setPad('none'); }
    },
    drawReel() {
      const r = this.reel;
      rect(60, 18, 136, 12, '#2a1f33'); rect(62, 20, 132, 8, '#5d6680');
      rect(62, 20, Math.round(132 * Math.min(1, r.p)), 8, r.p > 0.75 ? '#9fe35f' : '#ffde5c');
      pixelText('REEL IT IN!', 128 - textWidth('REEL IT IN!') / 2, 8, '#fff', 1, '#2a1f33');
    },
  };
  return S;
}

function lighten(c) { return c === '#9fc48a' ? '#b8d9a2' : c === '#6aa84f' ? '#86c26a' : '#f4efe4'; }
function infoBox(x, y, name, love, max, right = '') {
  rect(x, y, 100, love === null ? 16 : 22, '#2a1f33'); rect(x + 1, y + 1, 98, love === null ? 14 : 20, '#fffbea');
  pixelText(name, x + 5, y + 4, '#2a1f33');
  if (right) pixelText(right, x + 95 - textWidth(right), y + 4, '#2a1f33');
  if (love !== null) {
    pixelText('FRIEND', x + 5, y + 12, '#c0577a');
    for (let i = 0; i < max; i++) { const img = SPR.heart; G.globalAlpha = i < love ? 1 : 0.25; spr(img, x + 34 + i * 10, y + 11); G.globalAlpha = 1; }
  }
}

async function appear(S) {
  await wait(0.2);
  S.foe.hidden = false; S.foe.slide = 1;
  await wait(0.7);
  banner(`A wild ${S.F.name}<br>appeared!`, 1700);
  audio.sfx(S.id === 'sunny' ? 'bark' : S.id === 'freida' ? 'meow' : 'splash', { n: 2 });
  await wait(1.2);
  await foeCard(S.F.card);
}
async function caught(S) {
  audio.sfx('crack'); S.foe.hop = 1; S.parts.burst(S.foe.x, S.foe.y - 10, 30, { colors: ['#8fdcff', '#fff'], speed: 100, g: 200, up: 60 });
}
function love(S, n) {
  S.love = Math.min(S.loveMax, S.love + n);
  for (let i = 0; i < 6 * n; i++) S.parts.add({ x: S.foe.x + rand(-20, 20), y: S.foe.y - 20, vx: rand(-10, 10), vy: rand(-40, -20), life: 1.2, color: '#ff7d98', w: 2, h: 2 });
  audio.sfx('perfect', { combo: S.love * 3 });
}

// ---------------- FREIDA ----------------
async function freidaScript(S) {
  await appear(S);
  await say('narrator', 'FREIDA is sitting on something VERY suspicious...');
  while (S.love < S.loveMax) {
    const c = await choose('narrator', `What will ${K} do?`, ['🖐️ PET', '🐟 TREAT', '🏃 RUN']);
    if (c === 0) {
      await say('narrator', `${K} used PET!`);
      S.foe.shake = 0.5; audio.sfx('purr');
      await say('narrator', 'FREIDA used GRUMPY STARE! ...but a tiny purr slipped out.');
      love(S, 1);
    } else if (c === 1) {
      await say('narrator', `${K} used TREAT!`);
      S.foe.hop = 1; audio.sfx('purr');
      await say('narrator', "CHOMP! It's SUPER EFFECTIVE!");
      love(S, 2);
    } else {
      await say('narrator', "Can't escape! FREIDA is sitting on your foot.");
      S.foe.shake = 0.4;
      await say('narrator', 'FREIDA used LOAF MODE! FREIDA is now a perfect loaf.');
      love(S, 1);
    }
  }
  audio.play('win', () => audio.play('title'));
  audio.sfx('meow');
  await say('narrator', 'FREIDA is purring! FREIDA stood up and stretched...');
  S.foe.hop = 1;
  await say('narrator', 'There was a CLUE under FREIDA the whole time!');
  await clueCard(1);
  afterBattle('freida');
}

// ---------------- CATFISH ----------------
async function catfishScript(S) {
  // First bite: a mooneye (or is it a goldeye?)
  S.F = FOES.mooneye; S.foe.hidden = true;
  await say('narrator', `${K} casts the line out by the snag... plip! The catfish bell is clipped on the rod tip.`);
  await wait(1.1);
  S.bell = 1; audio.sfx('bell');
  await say('narrator', 'DING-A-LING! Something is nibbling!');
  S.foe.shake = 0.8; audio.sfx('splash');
  await wait(0.5);
  await appear(S);
  await say('mom', 'A bite! Reel it in, reel it in!');
  await S.startReel(6);
  await caught(S);
  await say('narrator', 'Gotcha! The MOONEYE was caught!');
  await say('mom', "Look at that big golden eye! Goldeye or mooneye? Honestly... they're TWINS.");
  await say('mom', 'Catch and release! ...Cast again. I just saw something HUGE swirl by the snag!');
  S.foe.slide = 0; S.foe.hidden = true; S.reel = null; S.love = 0; audio.sfx('splash');
  await wait(0.9);
  // Second bite: the big one
  S.F = FOES.catfish;
  await say('narrator', `${K} casts again... plip!`);
  await wait(1.2);
  S.bell = 1.5; audio.sfx('bell'); setTimeout(() => audio.sfx('bell'), 350);
  await say('narrator', 'DING-A-LING-A-LING!!! The bell is going CRAZY!');
  S.foe.shake = 0.8; audio.sfx('splash'); game.shake = 3;
  await wait(0.5);
  await appear(S);
  let bonus = 0;
  while (true) {
    const c = await choose('narrator', `A HUGE CATFISH is on the line! What will ${K} do?`, ['🎣 REEL IN', '🪱 WIGGLE WORM', '🏃 RUN']);
    if (c === 0) break;
    if (c === 1) { await say('narrator', `${K} wiggled the worm! The CATFISH is getting hungry...`); bonus += 4; love(S, 1); S.foe.hop = 1; }
    if (c === 2) { await say('narrator', "Can't run! You're holding a fishing rod!"); }
  }
  await S.startReel(Math.max(8, 16 - bonus));
  S.love = S.loveMax;
  await caught(S);
  audio.play('win', () => audio.play('river'));
  await say('narrator', 'Gotcha! The CHANNEL CATFISH was caught!');
  if (!save.data.tramp.hats.includes('fishing')) { save.data.tramp.hats.push('fishing'); save.flush(); toast('🎣 New hat unlocked for Trampoline Time: FISHING HAT!', 3500); }
  await say('mom', "THAT'S THE BIGGEST CATFISH I'VE EVER SEEN IN THE RED RIVER!");
  await say('mom', "Wait... there's a NOTE in its mouth!");
  await say('isaac', `It says... "Clue #3 is at ISLAND PARK POOL!"`);
  await say('mom', "Catch and release! Bye, big guy! ...Go on — I'll meet you there after these pelicans.");
  S.foe.slide = 0; S.foe.hidden = true; audio.sfx('splash');
  await wait(0.5);
  afterBattle('catfish');
}

// ---------------- SUNNY ----------------
const SUNNY_MOVES = [
  ['SUNNY used LICK!', "It's SUPER effective! " + K + ' is giggling!'],
  ['SUNNY used PUPPY EYES!', K + " can't resist!"],
  ['SUNNY used ZOOMIES!', 'SUNNY ran around the pool 8 times!'],
  ['SUNNY used PUP PUP BOOGIE!', K + ' answers with... THE WORM!'],
];
async function sunnyScript(S) {
  await appear(S);
  await say('narrator', 'SUNNY used SPLASH!');
  S.foe.hop = 1; audio.sfx('splash');
  S.parts.burst(S.foe.x, S.foe.y, 40, { colors: ['#8fdcff', '#ffffff', '#35a8e8'], speed: 140, g: 300, up: 80 });
  await say('narrator', `...${K} is SOAKED!`);
  let turn = 0;
  while (S.love < S.loveMax) {
    const c = await choose('narrator', `What will ${K} do?`, ['🖐️ BELLY RUB', '🦴 TREAT', '🎾 FETCH']);
    if (c === 0) { await say('narrator', `${K} used BELLY RUB! SUNNY's back leg is kicking!`); love(S, 1); S.foe.shake = 0.6; }
    if (c === 1) { await say('narrator', `${K} used TREAT! Tail wag at MAXIMUM speed!`); love(S, 1); S.foe.hop = 1; audio.sfx('bark', { n: 1 }); }
    if (c === 2) {
      await say('narrator', `${K} threw the ball!`);
      S.foe.slide = 0; S.foe.hidden = true; audio.sfx('bark', { n: 3 });
      await wait(1.2);
      S.foe.hidden = false; S.foe.hop = 1;
      S.fetched = true;
      await say('narrator', 'SUNNY brought something back... but it is NOT the ball!');
      love(S, 2);
      break;
    }
    if (S.love < S.loveMax) { const [a, b] = SUNNY_MOVES[turn++ % SUNNY_MOVES.length]; S.foe.hop = 1; audio.sfx('bark', { n: 1 }); await say('narrator', a + ' ' + b); }
  }
  audio.play('win', () => audio.play('pool'));
  if (!S.fetched) await say('narrator', 'SUNNY paddled over with something soggy... it\'s CLUE #3!');
  else await say('sunny', 'ARF! (Sunny found Clue #3!)');
  await clueCard(3);
  S.me.worm = 0.01; audio.sfx('worm'); wormBanner();
  await wait(2.4);
  S.me.worm = 0;
  await say('isaac', "It's BIG... it's BOUNCY... and it's in the BACKYARD?!");
  const g = await choose('isaac', 'What could it BE?', ['🦘 A KANGAROO?', '🏀 GIANT BOUNCY BALL?', '🏰 BOUNCY CASTLE?']);
  audio.sfx('bark', { n: 1 });
  await say('sunny', ['ARF! (Nope. Freida would never allow a kangaroo.)', 'ARF! (Nope. Bigger. BOUNCIER.)', 'ARF! (Nope. But you are getting WARMER.)'][g]);
  await say('isaac', "The NEW HOUSE is right around the corner! C'mon, Sunny!");
  afterBattle('sunny');
}

// ---------------- Lions Conservancy Park on the Red River: the fishing vista ----------------
let vista = null;
function cottonwood(x, base, s, autumn) {
  rect(x - 3 * s, base - 46 * s, 6 * s, 46 * s, '#8c8074'); rect(x - 3 * s, base - 46 * s, 2 * s, 46 * s, '#a89c8f');
  rect(x - 12 * s, base - 40 * s, 10 * s, 2, '#8c8074'); rect(x + 3 * s, base - 34 * s, 11 * s, 2, '#8c8074');
  const blobs = [[0, -62, 20], [-16, -52, 15], [16, -54, 16], [-8, -72, 14], [10, -70, 13], [0, -44, 12]];
  for (const [dx, dy, r] of blobs) circle(x + dx * s, base + dy * s + 2, Math.round(r * s), '#3f6e34');
  for (const [dx, dy, r] of blobs) circle(x + dx * s, base + dy * s, Math.round(r * s) - 1, '#5a8f43');
  for (let i = 0; i < 40 * s; i++) { const a = i * 2.4, rr = (i % 7) * 3 * s; rect(x + Math.cos(a) * rr * 1.4, base - 60 * s + Math.sin(a) * rr, 2, 1, i % 5 === 0 && autumn ? '#e8c23a' : i % 3 ? '#79ad55' : '#3f6e34'); }
}
function burOak(x, base, s) {
  rect(x - 3, base - 34 * s, 6, 34 * s, '#4a3526');
  for (const [dx, dy, r] of [[0, -44, 14], [-12, -36, 11], [12, -38, 12]]) circle(x + dx * s, base + dy * s, Math.round(r * s), '#2f5a2a');
  for (let i = 0; i < 16; i++) rect(x - 12 * s + (i * 7) % (24 * s), base - 50 * s + (i * 5) % (18 * s), 2, 1, '#447a3a');
}
function willow(x, base, s) {
  rect(x - 2, base - 26 * s, 4, 26 * s, '#6b5a44');
  circle(x, base - 30 * s, Math.round(12 * s), '#8fb35a');
  for (let k = -14; k <= 14; k += 2) rect(x + k * s, base - 30 * s, 1, Math.round((14 + ((k * 13) & 7)) * s), k % 4 ? '#9fc26a' : '#7fa24e');
}
function buildVista() {
  return offscreen(W, H, (g) => {
    // sky: prairie blue fading to a warm horizon
    const top = A.hexRgb('#79bff0'), bot = A.hexRgb('#ffe2bf');
    for (let y = 0; y < 64; y++) { const t = Math.floor((y / 64) * 12) / 11; g.fillStyle = `rgb(${top.map((v, i) => Math.round(v + (bot[i] - v) * t)).join(',')})`; g.fillRect(0, y, W, 1); }
    // far bank: towering native trees
    A.treeLine(0, 0, 44, '#4f7d40', '#3f6e34');
    cottonwood(26, 60, 0.62, true); burOak(66, 60, 0.62); cottonwood(112, 60, 0.8, true); willow(152, 62, 0.62); cottonwood(202, 60, 0.7, false); burOak(242, 60, 0.55);
    // mud bank + the Red River
    rect(0, 58, W, 4, '#8a6a4f');
    rect(0, 62, W, 40, '#7a5446');
    for (let i = 0; i < 12; i++) rect(i * 23 + 4, 62, 14, 3 + (i % 3), 'rgba(47,90,42,.45)'); // tree reflections
    // the snag (catfish hideout)
    for (let i = 0; i < 44; i++) rect(156 + i, 84 - Math.round(i * 0.3), 2, 3, i % 7 ? '#5a4432' : '#6b5440');
    rect(186, 70, 2, 9, '#5a4432'); rect(194, 74, 7, 2, '#5a4432');
    // near bank: big bluestem going bronze, goldenrod, purple asters, cattails, rocks
    rect(0, 100, W, H - 100, '#6f9a4a');
    rect(0, 99, W, 2, '#8a6a4f');
    for (let x = 0; x < W; x += 2) {
      const h = 4 + ((x * 37) % 7), c = x % 6 === 0 ? '#b0703f' : x % 6 === 2 ? '#8a5a3a' : x % 4 ? '#7fa24e' : '#5d8a3e';
      rect(x, 102 - h + ((x * 7) % 3), 1, h, c);
    }
    for (let i = 0; i < 9; i++) { const x = 12 + i * 29; rect(x, 92, 1, 10, '#5d8a3e'); for (let k = 0; k < 4; k++) rect(x - 2 + (k % 3), 90 + k * 2, 2, 1, '#f2c230'); }
    for (let i = 0; i < 16; i++) { const x = 6 + ((i * 53) % 244), y = 102 + ((i * 17) % 12); rect(x, y, 2, 2, '#9a6ad8'); rect(x, y, 1, 1, '#f2c230'); }
    for (const x of [132, 140, 236]) { rect(x, 84, 1, 18, '#4f7d3a'); rect(x - 1, 82, 3, 6, '#6b4424'); }
    ellipse(100, 112, 7, 3, '#8a8f99'); ellipse(222, 114, 9, 4, '#7d828c'); ellipse(218, 113, 5, 2, '#9aa3b8');
  });
}
function renderFishing(S) {
  vista ||= buildVista();
  G.drawImage(vista, 0, 0);
  // clouds + birds (pelicans in a V, swallows darting)
  A.drawClouds(0, 0, 4, 2);
  const px = ((game.t * 12) % 360) - 80;
  for (let i = 0; i < 7; i++) {
    const k = i - 3, bx = px + Math.abs(k) * -9 + 40, by = 22 + k * 3 * (k < 0 ? -1 : 1) + Math.sin(game.t * 2 + i) * 0.6;
    const flap = Math.floor(game.t * 3 + i) % 2;
    rect(bx, by, 6, 2, '#ffffff'); rect(bx + 5, by - 1, 2, 1, '#ffffff'); rect(bx + 7, by - 1, 2, 1, '#ffb347');
    rect(bx + 1, by - (flap ? 2 : -2), 4, 1, '#ffffff'); rect(bx, by - (flap ? 2 : -2), 1, 1, '#2a1f33'); rect(bx + 5, by - (flap ? 2 : -2), 1, 1, '#2a1f33');
  }
  for (let i = 0; i < 3; i++) { const t = game.t * 1.3 + i * 2; const sx = (t * 60) % 300 - 20, sy = 44 + Math.sin(t * 3) * 8 + i * 6; rect(sx, sy, 2, 1, '#2a2a44'); rect(sx - 2, sy - 1, 2, 1, '#2a2a44'); rect(sx + 2, sy - 1, 2, 1, '#2a2a44'); }
  // current ripples
  for (let i = 0; i < 26; i++) rect(((i * 47 + game.t * 9) % (W + 20)) - 10, 66 + (i * 11) % 32, 5 + (i % 3) * 2, 1, i % 4 ? '#96705e' : '#c4a896');
  const f = S.foe;
  // the fish breaks the surface by the snag
  if (!f.hidden) {
    const img = S.F.sprite(), sx = Math.round(f.slide * 90 + (f.shake > 0 ? Math.sin(game.t * 50) * 2 : 0));
    const hop = Math.sin(f.hop * Math.PI) * 16;
    G.save(); G.translate(198 + sx, 88 - hop + Math.sin(game.t * 3)); G.scale(S.F.scale - 0.6, S.F.scale - 0.6); G.drawImage(img, -Math.floor(img.width / 2), -img.height); G.restore();
    if (game.frame % 6 === 0) S.parts.add({ x: 198 + sx + rand(-14, 14), y: 88, vy: -rand(20, 50), g: 160, life: 0.5, color: '#e6d4c4' });
  }
  // Mom, bird watching with her binoculars
  G.save(); G.translate(26, 116); G.scale(2, 2);
  spr(SPR.mom.wave, -7, -30);
  rect(-2, -26, 3, 2, '#2a1f33'); rect(1, -26, 3, 2, '#2a1f33'); rect(4, -27, 1, 1, '#8fd8ff');
  G.restore();
  // Isaac in his fishing hat + vest, rod out over the water
  const mx = 78, my = 118;
  G.save(); G.translate(mx, my); G.scale(2, 2);
  if (S.me.worm) drawWorm(0, 0, S.me.worm, false);
  else {
    spr(SPR.isaac.hold, -8, -24);
    rect(-5, -12, 3, 6, '#6b7a4a'); rect(3, -12, 3, 6, '#6b7a4a'); rect(-5, -12, 1, 6, '#56633b'); rect(-4, -9, 2, 2, '#56633b'); rect(4, -9, 2, 2, '#56633b');
    G.save(); G.translate(0, -12); drawHat('fishing'); G.restore();
  }
  G.restore();
  if (!S.me.worm) {
    const hx = mx + 12, hy = my - 26, tx = mx + 58, ty = my - 74;
    G.strokeStyle = '#2a1f33'; G.lineWidth = 2; G.beginPath(); G.moveTo(hx, hy); G.lineTo(tx, ty); G.stroke();
    G.strokeStyle = '#4cb944'; G.lineWidth = 1; G.beginPath(); G.moveTo(hx + 6, hy - 7); G.lineTo(tx - 8, ty + 10); G.stroke();
    // line into the water by the snag (tight + twitchy when there's a bite)
    const tug = S.bell > 0 || S.reel ? Math.sin(game.t * 40) * 2 : 0;
    const ex = f.hidden ? 182 : 190, ey = f.hidden ? 80 : 78;
    G.strokeStyle = 'rgba(255,255,255,.85)'; G.lineWidth = 1; G.beginPath(); G.moveTo(tx, ty); G.quadraticCurveTo((tx + ex) / 2, S.reel ? ty + 4 : ty + 26 + tug, ex, ey); G.stroke();
    // the catfish bell on the rod tip
    const bj = S.bell > 0 ? Math.round(Math.sin(game.t * 50) * 2) : 0;
    rect(tx - 2 + bj, ty + 1, 5, 4, '#2a1f33'); rect(tx - 1 + bj, ty + 1, 3, 3, '#ffcd3c'); rect(tx + bj, ty + 5, 1, 1, '#2a1f33');
    if (S.bell > 0 && game.frame % 10 < 5) { pixelText('DING!', tx + 6, ty - 8, '#ffde5c', 1, '#2a1f33'); }
  }
  // info + reel meter
  if (!f.hidden && f.slide < 0.2) infoBox(W - 108, 8, S.F.name, S.love, S.loveMax);
  if (S.reel) S.drawReel();
  S.parts.draw(0, 0);
}
