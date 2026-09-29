// The story: level layouts, scenery and cutscene scripts.
import { W, H, G, game, rect, tri, circle, ellipse, spr, sprRot, pixelText, textWidth, wait, until, setScene, fadeTo, clamp, rand, pick, CONFETTI } from './engine.js';
import { World, drawWorm } from './world.js';
import { SPR } from './sprites.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { say, choose, clueCard, banner, toast, hud, icon, setPad, ui, wormBanner, tip } from './ui.js';
import { CONFIG } from './config.js';
import { save } from './save.js';
import * as A from './art.js';
import { battleScene } from './battle.js';
import { battingScene } from './batting.js';
import { trampolineScene } from './tramp.js';
import { titleScene, birthdayCard } from './title.js';

const K = CONFIG.kid.toUpperCase();

// ---------------- stage flow ----------------
export const STAGES = ['room', 'yard', 'hood', 'path', 'pool', 'newhouse'];
export const STAGE_NAMES = { room: "Isaac's Room", yard: 'Home', hood: 'The Neighborhood', path: 'Skate Park or River', skate: 'Dike East Skate Park', river: 'Red River Trail', pool: 'Island Park Pool', newhouse: 'The New House' };

export function goStage(name, arg) {
  const idx = STAGES.indexOf(name === 'skate' || name === 'river' ? 'path' : name);
  if (idx >= 0 && !arg?.replay) save.set({ stage: Math.max(save.data.done ? 0 : save.data.stage, idx) });
  if (name === 'skate' || name === 'river') save.set({ path: name });
  if (name === 'path') name = save.data.path || 'skate';
  fadeTo(() => setScene(levelScene(LEVELS[name]), arg));
}

function levelScene(def) {
  let w;
  return {
    name: def.id,
    enter(arg = {}) {
      w = new World(def);
      w.arg = arg;
      window.__w = w; // debug handle
      def.setup?.(w, arg);
      audio.play(def.music);
      setPad(def.pad || 'move', def.padLabels || {});
      if (!arg.after) banner(def.title + '<small>' + (def.sub || '') + '</small>', 2200, 'long');
      (arg.after ? def.after?.(w, arg) : def.intro?.(w, arg))?.catch?.((e) => console.error(e));
    },
    update(dt) {
      w.update(dt);
      const [l, c, r] = def.hud ? def.hud(w) : defaultHud(w);
      hud(l, c, r);
    },
    render() { w.render(); },
    exit() { tip(''); def.exit?.(w); },
  };
}
function defaultHud(w) {
  return [w.items.length ? `${icon(w.itemKind)} ${w.itemKind === 'card' ? 'CARDS' : 'GEMS'} ${w.got}/${w.items.length}` : '', w.goal || '', ''];
}

// Isaac's victory dance: THE WORM.
function cardTally(w) {
  if (!w.items.length) return;
  const gems = w.itemKind !== 'card';
  toast(`${gems ? '💎' : '🃏'} You found ${w.got}/${w.items.length} ${gems ? 'diamonds' : 'cards'}!${w.got === w.items.length ? ' FULL SET!' : ''}`, 2800);
}
export async function theWorm(w, secs = 2.4) {
  const p = w.p;
  if (!save.data.wormIntro) { save.data.wormIntro = 1; save.flush(); await say('isaac', 'Time for my VICTORY DANCE... THE WORM!!!'); }
  p.pose = 'worm'; p.wormT = 0;
  audio.sfx('worm'); setTimeout(() => audio.sfx('worm'), 700); setTimeout(() => audio.sfx('win'), 1400);
  wormBanner();
  const t0 = game.t;
  await until(() => game.t - t0 > secs);
  p.pose = null;
}

async function clue(w, n) {
  await clueCard(n);
  await theWorm(w);
}

// ---------------- shared ground painters ----------------
function grassGround(cx, w, top = '#5cbf4a', dirt = '#8a5a3a') {
  rect(0, w.ground, W, H - w.ground, dirt);
  rect(0, w.ground, W, 4, top);
  for (let x = -(cx % 8); x < W; x += 8) rect(x + 2, w.ground + 4, 3, 1, '#4ca83c');
}

// =====================================================================================
// 0. ISAAC'S ROOM
// =====================================================================================
const room = {
  id: 'room', title: "BIRTHDAY MORNING!", sub: 'Isaac turns 8 today!', music: 'title',
  width: 256, ground: 124, startX: 120, item: 'card',
  bouncers: [[20, 104, 92, 250, 'bed']],
  inter: [
    { x: 154, y: 96, r: 10, label: 'PLAY ♪', fn: playTonie },
    { x: 177, y: 34, r: 12, label: 'THWIP!', fn: thwip },
    { x: 222, px: 234, y: 84, r: 12, label: 'SWING', fn: batterUp },
  ],
  setup(w) {
    w.bunny = { x: 58, y: 100, got: false };
    w.pack = false;
    w.dog.x = 170; w.dog.pose = 'sit'; w.dog.stay = true;
    w.npc('mom', SPR.mom, 280, { face: -1, hidden: true });
    w.goal = 'Grab Big Bunny!';
    w.triggers.push({ x: 236, fn: () => exitRoom(w) });
  },
  async intro(w) {
    w.locked = true;
    await wait(1.4);
    w.hop(w.p, 190); w.p.vy = -200; audio.sfx('jump');
    await wait(0.5);
    await say('isaac', "It's my BIRTHDAY!!! I'm EIGHT!!!");
    w.dog.pose = null; w.dog.stay = false; audio.sfx('bark', { n: 3 });
    w.locked = false;
    toast(input.touchMode ? 'Use ◀ ▶ to walk and JUMP to jump' : input.padConnected ? 'Controller: d-pad to walk, A to jump' : 'Arrow keys to walk · SPACE to jump', 3500);
    await until(() => w.bunny.got);
    w.goal = '';
    await wait(0.4);
    const mom = w.npcs.mom; mom.hidden = false;
    await w.walkTo(mom, 214, 60);
    w.locked = true;
    w.p.face = 1;
    await say('mom', `HAPPY BIRTHDAY, ${K}!!! 🎂`);
    await say('mom', 'Dad and I hid a SECRET SURPRISE for you... at the NEW HOUSE!');
    await say('mom', "But first you'll have to find 3 CLUES to figure out what it is.");
    await say('isaac', 'A MYSTERY?! Where do I start?!');
    await say('mom', `Hmm... ${CONFIG.cat} has been acting VERY suspicious outside...`);
    await w.walkTo(mom, 290, 70); mom.hidden = true;
    w.locked = false;
    w.goal = 'Go outside →';
    w.bedQuip = true;
  },
  update: null,
  mid(cx, w) {
    // Big Bunny on the bed
    if (!w.bunny.got) {
      spr(SPR.bunny, w.bunny.x - 4, w.bunny.y - 12 + Math.round(Math.sin(game.t * 3)));
      const ay = w.bunny.y - 24 + Math.round(Math.sin(game.t * 5) * 2);
      rect(w.bunny.x - 2, ay, 5, 1, '#ffde5c'); rect(w.bunny.x - 1, ay + 1, 3, 1, '#ffde5c'); rect(w.bunny.x, ay + 2, 1, 1, '#ffde5c');
      const p = w.p;
      if (Math.abs(p.x - w.bunny.x) < 12 && p.y < 112) {
        w.bunny.got = true; w.pack = true; audio.sfx('clue'); w.parts.sparkle(w.bunny.x, w.bunny.y - 6, 12);
        toast(`${CONFIG.bunny} hopped into your backpack!`, 2600);
        w.pops.add('BIG BUNNY!', w.bunny.x, w.bunny.y - 20, '#fff');
      }
    }
    roomToys(w, cx);
    if (w.p.bounced && w.bedQuip) { w.bedQuip = false; say('mom', "I know how much you LOVE to bounce... but let's not jump on the bed, please!"); }
  },
  bg(cx, cy, w) {
    // wall
    rect(0, 0, W, 124, '#bcd7f0');
    for (let x = 0; x < W; x += 12) rect(x, 0, 1, 124, '#b0cde8');
    rect(0, 116, W, 8, '#ffffff');
    // window w/ morning sun
    rect(30, 26, 48, 40, '#fff'); rect(33, 29, 42, 34, '#ffe9a8'); rect(33, 29, 42, 12, '#ffd9f0');
    circle(62, 50, 7, '#fff4b5'); rect(53, 29, 1, 34, '#fff'); rect(33, 45, 42, 1, '#fff');
    rect(24, 24, 8, 46, '#e8483f'); rect(76, 24, 8, 46, '#e8483f');
    // Spidey poster
    rect(164, 34, 26, 32, '#2a1f33'); rect(165, 35, 24, 30, '#e8483f');
    for (let i = 0; i < 5; i++) { rect(165, 38 + i * 6, 24, 1, '#7a1c24'); rect(167 + i * 5, 35, 1, 30, '#7a1c24'); }
    tri(169, 44, 175, 47, 170, 52, '#fff'); tri(185, 44, 179, 47, 184, 52, '#fff');
    // card poster (holo)
    rect(198, 36, 22, 30, '#ffcd3c'); rect(200, 38, 18, 13, '#8fd8ff'); rect(200, 52, 18, 12, '#fff');
    circle(209, 44, 4, '#ffde5c'); rect(201, 55, 14, 1, '#9aa3b8'); rect(201, 58, 10, 1, '#9aa3b8');
    // bat + glove in the corner
    rect(232, 88, 3, 28, '#c98f55'); rect(231, 86, 5, 4, '#c98f55');
    circle(243, 111, 5, '#a0522d'); rect(240, 108, 7, 2, '#7a3d20');
    // door
    rect(222, 58, 30, 66, '#e8ecf2'); rect(225, 61, 24, 63, '#ffffff');
    rect(228, 65, 18, 22, '#eef2f6'); rect(228, 92, 18, 26, '#eef2f6'); rect(229, 66, 16, 1, '#d6dbe8'); rect(229, 93, 16, 1, '#d6dbe8');
    rect(244, 94, 3, 3, '#ffcd3c');
    if (w.goal === 'Go outside →') pixelText('EXIT', 229, 50, '#3d7be0');
    // floor
    rect(0, 124, W, 20, '#b98a5e');
    for (let x = 0; x < W; x += 32) rect(x, 124, 1, 20, '#a07350');
    rect(0, 131, W, 1, '#a07350'); rect(0, 138, W, 1, '#a07350');
    // rug
    ellipse(128, 132, 44, 5, '#7ab7e8'); ellipse(128, 132, 36, 3, '#ffde5c');
    // bed: frame + hex comforter (black/orange/blue like his)
    rect(16, 96, 4, 28, '#5a3a24'); rect(112, 104, 4, 20, '#5a3a24');
    rect(20, 106, 92, 12, '#1c1c24');
    for (let hx = 0; hx < 8; hx++) for (let hy = 0; hy < 2; hy++) {
      const x = 24 + hx * 11 + (hy % 2) * 5, y = 108 + hy * 5;
      rect(x, y, 4, 1, hx % 3 === 0 ? '#3fa0ff' : '#ff8a1c'); rect(x - 1, y + 1, 1, 2, hx % 3 === 0 ? '#3fa0ff' : '#ff8a1c'); rect(x + 4, y + 1, 1, 2, hx % 3 === 0 ? '#3fa0ff' : '#ff8a1c'); rect(x, y + 3, 4, 1, hx % 3 === 0 ? '#3fa0ff' : '#ff8a1c');
    }
    const sq = w.bouncers[0].squish;
    rect(20, 102 + sq * 2, 92, 4, '#e8ecf2'); rect(22, 98 + sq * 2, 18, 6, '#ffffff');
    // nightstand + red music box
    rect(146, 108, 18, 16, '#6b4a2f'); rect(146, 108, 18, 2, '#8a6a4a'); rect(154, 114, 3, 2, '#ffde5c');
    rect(149, 99, 10, 9, '#d62f3a'); rect(149, 99, 10, 2, '#ffffff'); rect(150, 97, 2, 2, '#6b6b73'); rect(156, 97, 2, 2, '#6b6b73');
    for (let i = 0; i < 3; i++) rect(151 + i * 2, 103, 1, 3, '#a81f2a');
    if (Math.abs(w.p.x - 155) < 20 && game.frame % 50 < 25) pixelText('♥', 152, 88, '#ff7d98');
  },
};
// ---- hidden fun in Isaac's room ----
const TONIE = [['tonie1', 'TWINKLE TWINKLE'], ['tonie2', "SUNNY'S BARK SONG"], ['tonie3', 'BALL GAME BOOGIE']];
function playTonie(w, it) {
  const [song, name] = TONIE[(it.uses - 1) % TONIE.length];
  w.tonie = { until: game.t + 7, next: 0 };
  w.pops.add(name, 155, 84, '#ffde5c', 1, 1.6);
  audio.play(song, () => { if (game.scene?.name === 'room') audio.play('title'); w.tonie = null; });
  if (song === 'tonie2') for (let i = 1; i <= 4; i++) setTimeout(() => { if (w.tonie) { audio.sfx('bark', { n: 1 }); w.pops.add('ARF!', w.dog.x, w.dog.y - 18, '#fff'); } }, i * 1714 - 300);
}
function thwip(w) {
  const p = w.p;
  w.web = { x: p.x + 4 * p.face, t: game.t };
  p.vy = -390; p.onGround = false;
  audio.sfx('whoosh'); audio.sfx('flip');
  w.pops.add('THWIP!', p.x, p.y - 30, '#ff5d73');
}
function batterUp(w) {
  const p = w.p;
  p.pose = 'back'; setTimeout(() => (p.pose = null), 250);
  audio.sfx('crack');
  w.pops.add('BATTER UP!', p.x, p.y - 30, '#fff');
  w.toyBall = { x: p.x - 6, y: p.y - 14, vx: -170, vy: -150, bounces: 0, rest: 0 };
}
function roomToys(w, cx) {
  const dt = 1 / 60, d = w.dog;
  if (w.tonie) {
    if (game.t > w.tonie.next) {
      w.tonie.next = game.t + 0.42;
      w.pops.add('♪', 152 + rand(-6, 6), 94, pick(['#ff7d98', '#8fd8ff', '#ffde5c', '#9fe35f']), 1, 1.4);
      if (d.onGround && !d.stay) d.vy = -150;
    }
  }
  if (w.web) {
    const age = game.t - w.web.t;
    if (age > 0.55) w.web = null;
    else { const p = w.p; G.strokeStyle = '#ffffff'; G.lineWidth = 1; G.beginPath(); G.moveTo(p.x - cx + 4 * p.face, p.y - 18); G.lineTo(w.web.x - cx, 0); G.stroke(); }
  }
  const b = w.toyBall;
  if (b) {
    if (!b.rest) {
      b.vy += 600 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < 6 || b.x > 250) { b.vx *= -0.8; b.x = clamp(b.x, 6, 250); audio.sfx('bump'); }
      if (b.y < 4) { b.vy = Math.abs(b.vy); audio.sfx('bump'); }
      if (b.y > 121) { b.y = 121; b.vy *= -0.62; b.vx *= 0.8; b.bounces++; audio.sfx('bump'); if (b.bounces > 5) b.rest = game.t; }
      d.stay = true; d.walkTo = { x: b.x, speed: 130 };
    } else if (game.t - b.rest > 1.2) { w.toyBall = null; d.stay = false; d.walkTo = null; audio.sfx('bark', { n: 2 }); w.pops.add('GOT IT!', d.x, d.y - 18, '#fff'); }
    if (w.toyBall) spr(SPR.baseball, b.x - 2 - cx, b.y - 2);
  }
}

function exitRoom(w) {
  if (!w.bunny.got) { w.triggers.push({ x: 236, fn: () => exitRoom(w) }); w.p.x = 228; toast('Wait! Grab Big Bunny first!'); return; }
  w.locked = true;
  goStage('yard');
}

// =====================================================================================
// 1. HOME — the current house, Freida's ambush
// =====================================================================================
const yard = {
  id: 'yard', title: 'HOME', sub: 'Find Clue #1', music: 'title',
  width: 480, ground: 120, startX: 30,
  inter: [{ x: 115, y: 78, r: 20, label: 'PEEK', fn: async (w) => { w.locked = true; await say('isaac', "The garage is FULL of moving boxes... and Dad's fishing rods. We're really moving!"); w.locked = false; } }],
  setup(w, arg) {
    w.npc('freida', SPR.freida, 262, { face: -1, pose: 'loaf' });
    w.npc('mom', SPR.mom, -20, { face: 1, hidden: true });
    w.scooter = { x: 420, parked: true };
    if (arg.after) { w.p.x = 236; w.dog.x = 205; }
    else w.triggers.push({ x: 226, fn: () => freidaAmbush(w) });
  },
  async intro(w) { w.goal = 'Find Freida!'; },
  async after(w) {
    w.locked = true;
    w.npcs.freida.x = 262;
    await theWorm(w);
    await say('isaac', "BIG?! What's BIG?!");
    const mom = w.npcs.mom; mom.hidden = false; mom.x = -10;
    await w.walkTo(mom, 180, 80);
    await say('mom', 'You got Clue #1! I KNEW that cat was hiding something.');
    await say('mom', "Clue #2 is with Dad at BRUNSDALE FIELDS. Hop on your scooter!");
    w.p.face = 1;
    w.goal = 'Ride your scooter →';
    w.locked = false;
    w.triggers.push({ x: 404, fn: async () => { w.locked = true; await w.playerTo(420, 50); audio.sfx('select'); goStage('hood'); } });
  },
  bg(cx) {
    A.sky('#a9d3f2', '#e3f1fa');
    A.treeLine(cx, 0.3, 36, '#4d8a52', '#3c7442');
    G.drawImage(A.currentHouse(), Math.round(10 - cx), 10);
  },
  drawGround(cx, w) {
    rect(0, w.ground, W, H, '#6aa84f');
    rect(-cx, w.ground, 250, 24, '#d6d3cc'); rect(-cx, w.ground, 250, 1, '#bdb9b0');
    rect(80 - cx, w.ground + 4, 1, 6, '#a8a49b'); rect(81 - cx, w.ground + 9, 1, 7, '#a8a49b'); rect(150 - cx, w.ground + 6, 1, 10, '#a8a49b');
    for (let i = 0; i < 22; i++) circle(262 + ((i * 13) % 80) - cx, w.ground + 3 + ((i * 7) % 5), 2, ['#c9b79c', '#8e8272', '#e0d6c4'][i % 3]);
    rect(250 - cx, w.ground + 16, 230, 8, '#8a8f99');
  },
  drawSolid(s, cx) { /* the wicker chair is part of the house art */ },
  mid(cx, w) {
    A.pine(318 - cx, w.ground, 1.25);
    A.fenceWood(344, 480, w.ground, 30, cx);
    if (w.scooter.parked) {
      const x = w.scooter.x - cx, y = w.ground;
      rect(x - 8, y - 4, 15, 2, '#2a1f33'); rect(x - 7, y - 4, 13, 1, '#4cb944'); rect(x + 6, y - 18, 2, 15, '#2a1f33'); rect(x + 3, y - 19, 7, 2, '#2a1f33');
      rect(x - 8, y - 2, 3, 2, '#2a1f33'); rect(x + 5, y - 2, 3, 2, '#2a1f33');
    }
  },
};
async function freidaAmbush(w) {
  w.locked = true;
  w.p.vx = 0;
  audio.sfx('meow');
  w.pops.add('!', w.npcs.freida.x, w.ground - 20, '#fff');
  await wait(0.7);
  fadeTo(() => setScene(battleScene('freida')), 'flash');
}

// =====================================================================================
// 2. THE NEIGHBORHOOD — scooter ride to Brunsdale Fields
// =====================================================================================
const hood = {
  id: 'hood', title: 'THE NEIGHBORHOOD', sub: 'Scooter to Brunsdale Fields!', music: 'hood', mode: 'scooter',
  width: 1640, ground: 120, startX: 40, item: 'card', padLabels: { a: 'JUMP' },
  props: [[262, 12, 16, 'bin'], [604, 28, 14, 'hedge'], [826, 12, 16, 'bin'], [840, 12, 16, 'bin2']],
  ramps: [[334, 44, 16], [700, 48, 20], [948, 44, 18], [1096, 60, 24]],
  plats: [[530, 104, 28, 'bench'], [1250, 102, 32, 'table']],
  inter: [{ x: 886, y: 92, r: 14, label: 'READ', fn: async (w) => { w.locked = true; await say('isaac', 'A book called "HOW TO TRAIN YOUR POODLE"... Hey Sunny, look!'); audio.sfx('bark', { n: 1 }); await say('sunny', '...ruff? (Sunny looks VERY nervous.)'); w.locked = false; } }],
  items: [[150, 100], [268, 88], [382, 80], [404, 70], [544, 92], [730, 62], [770, 56], [900, 98], [1130, 52], [1170, 46]],
  setup(w) {
    w.npc('dad', SPR.dad, 1520, { face: -1 });
    w.triggers.push({ x: 1420, fn: () => meetDad(w) });
  },
  bg(cx) {
    A.sky('#6ec3ff', '#d4f0ff');
    A.drawClouds(cx);
    A.treeLine(cx, 0.3, 58, '#5aa05a', '#4a8c4c');
    for (let i = 0; i < 12; i++) {
      const img = A.neighborHouse(i), x = Math.round(i * 150 - cx * 0.6);
      if (x > -120 && x < W + 20) { G.drawImage(img, x, 110 - img.height + 4); }
      const tx = Math.round(i * 150 + 110 - cx * 0.6);
      if (tx > -30 && tx < W + 30) A.tree(tx, 110, 0.9);
    }
    rect(0, 108, W, 12, '#7cc865');
  },
  drawGround(cx, w) {
    const g = w.ground;
    rect(0, g, W, 8, '#d9d6cf');
    for (let x = -(cx % 16); x < W; x += 16) rect(x, g, 1, 8, '#bdb9b0');
    rect(0, g + 8, W, 5, '#6aa84f');
    rect(0, g + 13, W, 2, '#b8b4ab');
    rect(0, g + 15, W, H, '#4a4d57');
    for (let x = -(cx % 40); x < W; x += 40) rect(x + 10, g + 20, 16, 1, '#e8e2c8');
    // sidewalk chalk birthday message
    const cxk = 470 - cx;
    if (cxk > -120 && cxk < W) { pixelText('HAPPY', cxk, g + 1, '#ff9ec8'); pixelText('BDAY', cxk + 22, g + 1, '#8fd8ff'); pixelText(K + '!', cxk + 40, g + 1, '#ffe066'); }
  },
  drawSolid(s, cx, w) {
    const x = s.x0 - cx, y = s.top, ww = s.x1 - s.x0, h = w.ground - s.top;
    if (s.style === 'cone') { tri(x, w.ground, x + ww, w.ground, x + ww / 2, y, '#ff7a1c'); rect(x + 1, y + 5, ww - 2, 2, '#fff'); rect(x - 1, w.ground - 1, ww + 2, 1, '#e8601c'); }
    else if (s.style === 'hedge') { A.bush(x + ww / 2, w.ground + 1, ww + 4, '#3f9b3a'); }
    else if (s.style === 'wagon') { rect(x, y, ww, h - 3, '#e8483f'); rect(x, y, ww, 1, '#ff8a80'); circle(x + 4, w.ground - 2, 2, '#2a1f33'); circle(x + ww - 4, w.ground - 2, 2, '#2a1f33'); rect(x + ww, y + 2, 6, 1, '#2a1f33'); }
    else { const c = s.style === 'bin2' ? '#3f9b3a' : '#3d7be0'; rect(x, y + 2, ww, h - 2, c); rect(x - 1, y, ww + 2, 3, '#2a1f33'); rect(x + 2, y + 4, 1, h - 6, 'rgba(255,255,255,.3)'); }
  },
  drawRamp(r, cx, w) {
    // orange race-track ramp
    for (let x = r.x0; x < r.x1; x++) {
      const y = Math.round(w.rampY(r, x + 0.5));
      rect(x - cx, y, 1, 3, '#ff7a1c'); rect(x - cx, y, 1, 1, '#ffb15c');
      if (x % 6 === 0) rect(x - cx, y + 3, 1, w.ground - y - 3, '#8a939c');
    }
    rect(r.x1 - cx - 2, w.ground - r.h, 2, r.h, '#8a939c');
  },
  drawPlat(p, cx, w) {
    const x = p.x0 - cx, ww = p.x1 - p.x0;
    if (p.style === 'bench') { rect(x, p.y, ww, 3, '#b5824f'); rect(x, p.y - 8, ww, 2, '#b5824f'); rect(x + 2, p.y + 3, 2, w.ground - p.y - 3, '#4a4d57'); rect(x + ww - 4, p.y + 3, 2, w.ground - p.y - 3, '#4a4d57'); }
    else { rect(x, p.y, ww, 3, '#c98f55'); rect(x + 4, p.y + 3, 2, w.ground - p.y - 3, '#8a5a3a'); rect(x + ww - 6, p.y + 3, 2, w.ground - p.y - 3, '#8a5a3a'); rect(x - 4, p.y + 8, ww + 8, 2, '#c98f55'); }
  },
  mid(cx, w) {
    // little free library
    const lx = 886 - cx;
    if (lx > -20 && lx < W + 20) {
      rect(lx - 1, w.ground - 16, 3, 16, '#6b4a2f');
      rect(lx - 8, w.ground - 30, 16, 14, '#2a1f33'); rect(lx - 7, w.ground - 29, 14, 12, '#e8483f');
      rect(lx - 5, w.ground - 27, 10, 8, '#bfe4ff'); rect(lx - 4, w.ground - 24, 2, 5, '#ffde5c'); rect(lx - 1, w.ground - 25, 2, 6, '#3d7be0'); rect(lx + 2, w.ground - 23, 2, 4, '#4cb944');
      tri(lx - 10, w.ground - 30, lx + 10, w.ground - 30, lx, w.ground - 38, '#2a1f33'); tri(lx - 8, w.ground - 31, lx + 8, w.ground - 31, lx, w.ground - 37, '#7a3d20');
    }
    // sprinklers
    for (const sx of [650, 1070]) {
      const x = sx - cx; if (x < -40 || x > W + 40) continue;
      rect(x, w.ground + 8, 3, 2, '#5d6680');
      for (let i = 0; i < 12; i++) {
        const t = (game.t * 1.5 + i / 12) % 1, a = Math.sin(game.t * 2) * 0.8;
        const px = x + 1 + Math.sin(a) * t * 40, py = w.ground + 8 - Math.sin(t * Math.PI) * 26;
        rect(px, py, 1, 1, i % 2 ? '#8fd8ff' : '#dff6ff');
      }
    }
    // Brunsdale Fields (the ball fields)
    const sx = 1380 - cx;
    if (sx < W + 10) {
      rect(sx + 30, w.ground - 1, 260, 2, '#c9925a');
      ellipse(sx + 150, w.ground + 4, 26, 3, '#c9925a');
      rect(sx + 204, w.ground - 44, 2, 44, '#8a939c'); rect(sx + 250, w.ground - 44, 2, 44, '#8a939c');
      A.chainFence(1380 + 200, 1380 + 254, w.ground - 44, w.ground, cx);
      A.sign(sx + 34, w.ground, ['BRUNSDALE', 'FIELDS'], { bg: '#3d7be0' });
    }
  },
};
async function meetDad(w) {
  w.locked = true; cardTally(w);
  await w.playerTo(1470, 60);
  w.p.face = 1;
  await say('dad', `There's my birthday boy! Happy birthday, ${K}!`);
  await say('dad', 'Clue #2 is hidden inside this baseball...');
  await say('dad', "But you've gotta hit a HOME RUN to get it! Grab a bat, slugger!");
  fadeTo(() => setScene(battingScene()));
}

// =====================================================================================
// 3a. DIKE EAST SKATE PARK — out-skate the Creeper Crew
// =====================================================================================
const CREW_SCORE = 1000;
const skate = {
  id: 'skate', title: 'DIKE EAST SKATE PARK', sub: 'Out-trick the Creeper Crew!', music: 'skate', mode: 'skate',
  width: 1900, ground: 120, startX: 60, item: 'diamond', pad: 'trick', padLabels: { a: 'JUMP', b: 'SPIN', down: 'grab' },
  ramps: [[230, 40, 16], [470, 50, 22], [760, 44, 18], [1030, 56, 26], [1370, 50, 22], [1640, 72, 34]],
  rails: [[330, 100, 70], [860, 98, 100], [1180, 100, 90]],
  plats: [],
  items: [[262, 74], [520, 58], [620, 92], [800, 70], [900, 86], [1080, 48], [1230, 86], [1410, 62], [1690, 34], [1730, 40]],
  setup(w) {
    w.crew = [0, 1, 2].map((i) => ({ x: 120 + i * 16, y: 0, vy: 0, t: i * 0.6 }));
    w.npc('c1', { idle: SPR.creeper }, 130, { face: -1 });
    w.npc('judge', SPR.mom, 152, { face: -1 });
    w.npc('fcam', { idle: SPR.freida.loaf }, 1516, { face: -1 });
    w.locked = true;
    w.onTrick = (pts) => { if (pts && w.score >= CREW_SCORE && !w.beat) { w.beat = true; banner('NEW HIGH SCORE!<small>You beat the Creeper Crew!</small>', 1800); audio.sfx('record'); } };
    w.triggers.push({ x: 1800, fn: () => skateEnd(w) });
  },
  async intro(w) {
    w.p.vx = 0;
    await wait(0.4);
    await say('mom', "I'm the OFFICIAL JUDGE of today's skate contest! Show me your best tricks, kiddo!");
    await say('creeper', 'Sssssso... you think you can ssskate at DIKE EAST?');
    await say('creeper', `The CREEPER CREW scored ${CREW_SCORE} pointsss. Beat THAT and we'll tell you where to go next.`);
    await say('isaac', "Challenge ACCEPTED!");
    w.npcs.c1.hidden = true; w.npcs.judge.hidden = true;
    w.locked = false;
    skateTips(w);
  },
  hud(w) { return [`${icon('diamond')} ${w.got}/${w.items.length}`, '', `<span style="color:${w.score >= CREW_SCORE ? '#9fe35f' : '#fff'}">TRICKS ${w.score}</span> <small style="opacity:.8">/ ${CREW_SCORE}</small>`]; },
  bg(cx) {
    A.sky('#7ec8ff', '#e0f4ff');
    A.blockyClouds(cx);
    // the dike: a long blocky levee
    const off = cx * 0.25;
    for (let x = 0; x < W; x += 8) {
      const wx = x + off, hh = 26 + Math.round(Math.sin(wx / 90) * 4);
      rect(x, 104 - hh, 8, hh + 20, '#5cae4a'); rect(x, 104 - hh, 8, 3, '#7cd65c');
    }
    // blocky trees
    for (let i = 0; i < 10; i++) {
      const x = Math.round(i * 90 - cx * 0.45) % 900; const tx = x < -40 ? x + 900 : x;
      if (tx > W + 30) continue;
      rect(tx + 12, 80, 6, 30, '#6b4a2f'); rect(tx, 56, 30, 26, '#3f8a3a'); rect(tx + 4, 50, 22, 8, '#4ca83c'); rect(tx + 6, 60, 6, 6, '#62bf4c');
    }
    rect(0, 108, W, 12, '#6aa84f');
    // crew skating in the background
    A.sign(Math.round(40 - cx * 0.9), 108, ['DIKE EAST', 'SKATE PARK'], { bg: '#5d6680' });
  },
  drawGround(cx, w) {
    const g = w.ground;
    for (let x = -(cx % 16); x < W; x += 16) {
      rect(x, g, 16, 16, '#b8bcc4'); rect(x, g, 16, 1, '#dfe2e8'); rect(x, g, 1, 16, '#a0a5ae');
      rect(x, g + 16, 16, H, '#8a5a3a'); rect(x + 3, g + 18, 2, 2, '#6b4424'); rect(x + 10, g + 21, 2, 2, '#6b4424');
    }
  },
  drawRamp(r, cx, w) {
    // blocky quarter-pipe: stair-stepped blocks with a smooth riding edge
    for (let x = r.x0; x < r.x1; x++) {
      const y = Math.round(w.rampY(r, x + 0.5));
      const shade = ((x - r.x0) >> 3) % 2 ? '#a9adb6' : '#b8bcc4';
      rect(x - cx, y, 1, w.ground - y, shade);
      rect(x - cx, y, 1, 1, '#ffffff');
      if (((w.ground - y) & 7) === 0) rect(x - cx, y + 1, 1, 1, '#8a8f99');
    }
    rect(r.x1 - cx - 1, w.ground - r.h, 2, r.h, '#8a8f99');
    rect(r.x1 - cx - 3, w.ground - r.h - 1, 4, 2, '#e6e6e6');
  },
  drawSolid(s, cx, w) {
    const x = s.x0 - cx, h = w.ground - s.top, ww = s.x1 - s.x0;
    for (let bx = 0; bx < ww; bx += 8) for (let by = 0; by < h; by += 7) { rect(x + bx, s.top + by, 8, 7, (bx + by) % 2 ? '#9aa0aa' : '#a9adb6'); rect(x + bx, s.top + by, 8, 1, '#c9ccd3'); }
    rect(x, s.top, ww, 1, '#ffde5c');
  },
  fg(cx, w) {
    const j = w.npcs.judge;
    if (w.scorecard && j && !j.hidden) { const x = j.x - cx + 2, y = j.y - 44 + Math.round(Math.sin(game.t * 6) * 2); rect(x, y + 8, 1, 6, '#6b4a2f'); rect(x - 7, y - 2, 15, 10, '#2a1f33'); rect(x - 6, y - 1, 13, 8, '#ffffff'); pixelText('10', x - 3, y + 1, '#e8483f'); }
  },
  mid(cx, w) {
    // creeper crew in the back, bouncing on boards
    for (const c of w.crew) {
      c.t += 1 / 60;
      const x = Math.round(((c.x + game.t * 60 + c.t * 30) % 2000) - cx * 0.9);
      const hop = Math.abs(Math.sin(game.t * 2 + c.t)) * 14;
      if (x > -20 && x < W + 20 && !w.crewGone) { spr(SPR.creeper, x - 5, 104 - 16 - hop); rect(x - 6, 104 - 2 - hop, 12, 2, '#2a1f33'); }
    }
  },
};
async function skateTips(w) {
  const touch = input.touchMode, gp = input.padConnected && !touch;
  const J = touch ? 'JUMP' : gp ? 'A' : 'SPACE', S = touch ? 'SPIN' : gp ? 'B' : 'X', D = touch ? '▼' : '↓';
  const steps = [
    [`${J} to ollie! Launch off the ramps!`, () => w.p.air > 0.3],
    [`In the air: ${J} = KICKFLIP · ${S} = 360!`, () => (w.trickCount || 0) >= 2],
    [`Hold ◀ + ${J} = HEELFLIP · ▶ + ${J} = TRE FLIP!`, () => (w.trickCount || 0) >= 4],
    [`Hold ${D} in the air to GRAB... keep holding for SUPERMAN!`, () => (w.trickCount || 0) >= 6],
    ['Land on the rails to GRIND! Mix tricks for a SICK COMBO!', null],
  ];
  for (const [text, done] of steps) {
    if (game.scene?.name !== 'skate' || w.locked) break;
    tip(text);
    const t0 = game.t;
    await until(() => (done ? done() : false) || game.t - t0 > 7 || w.locked);
    await wait(0.6);
  }
  tip('');
}
async function skateEnd(w) {
  w.locked = true; cardTally(w);
  tip('');
  await until(() => w.p.onGround);
  await w.playerTo(1840, 40);
  const c = w.npcs.c1; c.x = 1884; c.hidden = false; c.face = -1;
  const j = w.npcs.judge; j.x = 1862; j.hidden = false; j.face = -1; j.pose = 'wave'; w.scorecard = true;
  w.p.face = 1;
  audio.sfx('cheer');
  await say('mom', `The judge has decided... that run gets a TEN! TEN! TEN!!!`);
  if (w.score >= CREW_SCORE) await say('creeper', `SSSSSSICK! ${w.score} pointsss! You out-ssskated the CREEPER CREW! Ssssecret: Clue #3 is at ISLAND PARK POOL...`);
  else await say('creeper', `${w.score} pointsss... ssso close! But it's your BIRTHDAY, ssso you WIN! Ssssecret: Clue #3 is at ISLAND PARK POOL...`);
  await say('creeper', "Now exxxcuse us... we get a little EXCITED at birthdays...");
  audio.sfx('hiss');
  await wait(1);
  audio.sfx('pop'); audio.sfx('horn');
  w.parts.confetti(c.x, w.ground - 16, 60); c.hidden = true; w.crewGone = true; game.shake = 4;
  w.pops.add('POP!', c.x, w.ground - 30, '#ffde5c');
  await wait(1.2);
  await say('isaac', 'They popped into CONFETTI! Best. Birthday. EVER.');
  save.data.paths.skate = true; save.flush();
  goStage('pool');
}

// =====================================================================================
// 3b. RED RIVER TRAIL — bike to Lions Conservancy Park; Mom (bird watching) watches Isaac fish
// =====================================================================================
const river = {
  id: 'river', title: 'RED RIVER TRAIL', sub: 'Bike to Lions Conservancy Park!', music: 'river', mode: 'bike',
  inter: [{ x: 706, y: 96, r: 16, label: 'LOOK', fn: async (w) => {
    w.locked = true; w.heronT = game.t;
    audio.sfx('select');
    await say('isaac', "Whoa, down by the water! A GREAT BLUE HERON! Mom would LOVE this!");
    w.locked = false;
  } }],
  width: 1640, ground: 120, startX: 40, item: 'card',
  props: [[1260, 22, 8, 'log']],
  ramps: [[420, 40, 16], [880, 44, 20], [1120, 40, 16]],
  items: [[180, 100], [311, 88], [450, 74], [470, 66], [640, 98], [781, 86], [910, 62], [940, 60], [1150, 70], [1380, 98]],
  setup(w) {
    w.geese = [640, 1190].map((x) => ({ x, y: w.ground, fly: 0, vx: 0, vy: 0, honked: false }));
    w.fish = [];
    w.npc('mom', SPR.mom, 1566, { face: -1, pose: 'binoc' });
    w.npc('fcam', { idle: SPR.freida.loaf }, 1270, { face: -1, y: w.ground - 8 });
    w.triggers.push({ x: 1500, fn: () => fishing(w) });
    startBrook(w);
  },
  bg(cx, cy, w) {
    A.sky('#8fd3ff', '#fff4dc');
    A.drawClouds(cx, 0.12, 8);
    // pelicans
    for (let i = 0; i < 3; i++) {
      const x = Math.round(((game.t * 18 + i * 110) % 400) - 80), y = 26 + i * 9 + Math.sin(game.t * 3 + i) * 2;
      const flap = Math.floor(game.t * 4 + i) % 2;
      rect(x, y, 8, 3, '#fff'); rect(x + 7, y - 1, 3, 2, '#fff'); rect(x + 9, y, 4, 1, '#ffb347');
      rect(x + 2, y - (flap ? 3 : -2), 5, 1, '#2a1f33');
    }
    // far bank cottonwoods
    A.treeLine(cx, 0.3, 52, '#5f9a52', '#4d8544');
    // the Red River (muddy red-brown, slow current)
    rect(0, 84, W, 24, '#7a5446'); rect(0, 84, W, 2, '#5f4a3a'); rect(0, 86, W, 3, '#8f6a58');
    for (let i = 0; i < 36; i++) {
      const x = Math.round(((i * 53 - cx * 0.7 + game.t * 14) % 300 + 300) % 300 - 20), y = 89 + (i * 7) % 17;
      rect(x, y, 6 + (i % 4) * 3, 1, i % 3 ? '#9c7a66' : '#c4a896');
    }
    for (let i = 0; i < 6; i++) { const x = Math.round(((i * 97 - cx * 0.7) % 400 + 400) % 400 - 40); rect(x, 96 + (i % 3) * 3, 14, 1, 'rgba(190,220,255,.35)'); }
    const rs = Math.round(120 - cx * 0.7); if (rs > -80 && rs < W) A.sign(rs, 106, ['RED RIVER'], { bg: '#a62f3a' });
    // jumping fish
    if (Math.random() < 0.012) { w.fish.push({ x: rand(20, W - 20), t: 0 }); }
    for (let i = w.fish.length - 1; i >= 0; i--) {
      const f = w.fish[i]; f.t += 1 / 60;
      if (f.t > 1) { w.fish.splice(i, 1); continue; }
      const fy = 92 - Math.sin(f.t * Math.PI) * 16, fx = f.x + f.t * 20;
      sprRot(SPR.fish, fx, fy, (f.t - 0.5) * 2.2);
      if (f.t < 0.05 || (f.t > 0.95 && !f.splashed)) { if (f.t > 0.95) { f.splashed = true; audio.sfx('splash'); } }
    }
    // great blue heron fishing in the shallows (a hidden LOOK spot points it out)
    const hx = Math.round(726 - cx * 0.7 - 200);
    if (hx > -20 && hx < W + 20) { spr(SPR.heron, hx, 90 + (w.heronT && game.t - w.heronT < 1 ? -2 : 0)); rect(hx - 2, 103, 12, 1, '#9c7a66'); }
    // near bank: riparian grasses, willows and cattails
    rect(0, 106, W, 14, '#6aa84f');
    const off = Math.round(cx * 0.9);
    for (let x = -(off % 12); x < W; x += 12) { rect(x, 102, 1, 5, '#4ca83c'); rect(x + 5, 103, 1, 4, '#5cbf4a'); rect(x + 8, 104, 1, 3, '#3f8a3a'); }
    for (let i = -1; i < 9; i++) {
      const x = i * 37 - (off % 37) + 10;
      rect(x, 94, 1, 12, '#3f8a3a'); rect(x - 1, 92, 3, 6, '#7a4e2d'); rect(x + 4, 97, 1, 9, '#3f8a3a'); rect(x + 3, 95, 3, 5, '#6b4424');
    }
    for (let i = -1; i < 4; i++) {
      const x = i * 131 - (Math.round(cx * 0.85) % 131) + 60;
      rect(x - 2, 72, 4, 34, '#6b4a2f');
      circle(x, 70, 12, '#6f9a52');
      for (let k = -12; k <= 12; k += 3) rect(x + k, 70, 1, 16 + ((k * 7) & 7), '#7fae5c');
    }
  },
  drawGround(cx, w) {
    const g = w.ground;
    rect(0, g, W, 9, '#55585f');
    for (let x = -(cx % 24); x < W; x += 24) rect(x + 4, g + 4, 10, 1, '#ffde5c');
    rect(0, g + 9, W, H, '#6aa84f');
    for (let x = -(cx % 10); x < W; x += 10) rect(x + 3, g + 12 + (x & 3), 1, 2, '#4ca83c');
  },
  drawSolid(s, cx, w) {
    const x = s.x0 - cx, ww = s.x1 - s.x0, h = w.ground - s.top;
    if (s.style === 'log') { rect(x, s.top + 1, ww, h - 1, '#7a4e2d'); rect(x, s.top, ww, 2, '#9a6a42'); circle(x + ww - 3, s.top + h / 2, Math.floor(h / 2) - 1, '#d9a066'); circle(x + ww - 3, s.top + h / 2, 1, '#7a4e2d'); }
    else { ellipse(x + ww / 2, w.ground - h / 2, ww / 2, h / 2, '#8a8f99'); rect(x + 2, s.top + 1, 3, 1, '#b8bcc4'); }
  },
  drawRamp(r, cx, w) {
    for (let x = r.x0; x < r.x1; x++) { const y = Math.round(w.rampY(r, x + 0.5)); rect(x - cx, y, 1, w.ground - y, '#8a5a3a'); rect(x - cx, y, 1, 1, '#b07a4a'); }
  },
  mid(cx, w) {
    for (const g of w.geese) {
      if (!g.fly && Math.abs(w.p.x - g.x) < 46) { g.fly = 1; g.vx = -40; g.vy = -80; audio.sfx('goose'); w.pops.add('HONK!', g.x, g.y - 20, '#fff'); }
      if (g.fly) { g.x += g.vx / 60; g.y += g.vy / 60; g.vy -= 1; }
      const x = g.x - cx;
      if (x < -20 || x > W + 20 || g.y < -20) continue;
      const img = SPR.goose;
      spr(img, x - 5, g.y - img.height - (g.fly ? 0 : Math.abs(Math.sin(game.t * 5 + g.x)) * 1), true);
      if (g.fly) rect(x - 2, g.y - 9 - (Math.floor(game.t * 10) % 2) * 3, 7, 1, '#2a1f33');
    }
    // Lions Conservancy Park: Mom bird watching, rods and tackle ready for Isaac
    const mx = 1566 - cx;
    if (mx < W + 60) {
      A.sign(mx - 124, w.ground, ['LIONS CONSERVANCY', 'PARK'], { bg: '#2c7a34' });
      rect(mx + 10, w.ground - 6, 8, 6, '#e6e6e6'); rect(mx + 10, w.ground - 6, 8, 1, '#9aa3b8'); // bucket
      rect(mx + 20, w.ground - 5, 10, 5, '#3f9b3a'); rect(mx + 20, w.ground - 5, 10, 1, '#62bf4c'); // tackle box
      rect(mx + 30, w.ground - 30, 1, 30, '#6b4a2f'); rect(mx + 33, w.ground - 28, 1, 28, '#2a1f33'); // two rods
    }
  },
  exit() { stopBrook(); },
};
async function fishing(w) {
  w.locked = true; cardTally(w);
  await w.playerTo(1530, 50);
  w.p.face = 1;
  await say('mom', `${K}! Welcome to LIONS CONSERVANCY PARK! ...Shhh — the AMERICAN WHITE PELICANS are out. I count SEVENTEEN!`);
  await say('mom', "I brought your rod, your vest, AND your lucky FISHING HAT. Bird watching is great... but I REALLY want to watch you catch a big one!");
  await say('isaac', 'YES! Gimme the rod!');
  stopBrook();
  fadeTo(() => setScene(battleScene('catfish')), 'flash');
}
// A babbling-brook bed: random tiny sine blips (idea borrowed from Blaine's RCT clone).
let brookTimer = 0;
function startBrook() {
  stopBrook();
  brookTimer = setInterval(() => { if (game.scene?.name === 'river') for (let i = 0; i < 3; i++) audio.sfx('bubble'); else stopBrook(); }, 120);
}
function stopBrook() { clearInterval(brookTimer); }

// =====================================================================================
// 4. ISLAND PARK POOL — on 7th St
// =====================================================================================
const pool = {
  id: 'pool', title: 'ISLAND PARK POOL', sub: '7th St · Find Clue #3', music: 'pool',
  width: 1320, ground: 120, startX: 40, item: 'card',
  props: [[180, 22, 7, 'lounge'], [206, 22, 7, 'lounge'], [430, 22, 7, 'lounge'], [612, 10, 30, 'guard'], [790, 22, 7, 'lounge'], [816, 22, 7, 'lounge']],
  bouncers: [[292, 86, 34, 330, 'umbrella'], [506, 82, 34, 360, 'umbrella'], [900, 84, 34, 340, 'umbrella'], [1060, 80, 34, 380, 'umbrella']],
  inter: [{ x: 776, y: 108, r: 14, label: 'PET', fn: (w, it) => { audio.sfx(it.uses % 2 ? 'purr' : 'meow'); w.pops.add(it.uses % 2 ? 'PURRR...' : '...MRRP?', it.x, it.y - 6, '#fff'); w.hop(w.npcs.fcam, 90); } }],
  items: [[140, 100], [217, 96], [309, 50], [309, 30], [523, 40], [617, 76], [700, 100], [917, 42], [1077, 26], [1150, 98]],
  setup(w) {
    w.npc('fcam', { idle: SPR.freida.loaf }, 800, { face: 1, y: w.ground - 7 });
    w.parkedRide = save.data.path === 'river' ? 'bike' : 'board';
    w.triggers.push({ x: 1150, fn: () => wildSunny(w) });
    w.goal = '';
  },
  async intro(w) {
    await wait(1.2);
    toast('Bounce on the blue umbrellas!', 2600);
  },
  bg(cx) {
    A.sky('#5cc2ff', '#d8f3ff');
    A.drawClouds(cx, 0.1, 6, 2);
    A.treeLine(cx, 0.25, 40, '#4f9a4c', '#3f8a3a');
    const off = Math.round(cx * 0.5);
    // bathhouse (blue wall, flat roof) at the left, like the photo
    rect(-off - 20, 62, 160, 46, '#c8b89a'); rect(-off - 20, 84, 160, 24, '#2f5fa8'); rect(-off - 20, 60, 160, 3, '#ffffff');
    // slide tower + big green corkscrew + blue slide
    const sx = 380 - off;
    rect(sx, 34, 24, 74, '#e6e6e6'); for (let y = 40; y < 108; y += 8) rect(sx, y, 24, 1, '#b8bcc4');
    rect(sx - 2, 30, 28, 4, '#2f7fd6');
    for (let i = 0; i < 70; i++) {
      const t = i / 70, x = sx + 30 + Math.sin(t * Math.PI * 5) * 26 + t * 60, y = 40 + t * 62;
      circle(x, y, 5, i % 7 === 0 ? '#2e8a2e' : '#48c23a');
    }
    for (let i = 0; i < 50; i++) { const t = i / 50; circle(sx - 4 - t * 90, 44 + t * 60, 3, '#3a7ae0'); }
    // far umbrellas
    for (let i = 0; i < 6; i++) { const ux = Math.round(i * 110 + 200 - cx * 0.55) % 700; const x = ux < -40 ? ux + 700 : ux; rect(x + 8, 96, 1, 12, '#fff'); tri(x, 97, x + 17, 97, x + 8, 90, '#2f6fd6'); }
    A.chainFence(0, W, 92, 108, 0);
    rect(0, 108, W, 12, '#e8e2d6');
    // tall grass by the fence (a wild-encounter nod)
    for (let x = -(Math.round(cx * 0.9) % 10); x < W; x += 10) { tri(x, 110, x + 4, 110, x + 2, 100, '#3fae3a'); tri(x + 4, 110, x + 9, 110, x + 7, 102, '#2c8a2c'); }
  },
  drawGround(cx, w) {
    const g = w.ground;
    rect(0, g, W, 8, '#ece6da');
    for (let x = -(cx % 20); x < W; x += 20) rect(x, g, 1, 8, '#d6cfbf');
    rect(0, g + 8, W, 3, '#ffffff');
    rect(0, g + 11, W, H, '#35a8e8');
    for (let x = -(cx % 36); x < W; x += 36) rect(x, g + 12, 1, H, '#2a8ad0');
    for (let i = 0; i < 3; i++) for (let x = -(Math.round(cx) % 6); x < W; x += 6) rect(x, g + 14 + i * 4, 3, 1, i % 2 ? '#ff6a5a' : '#ffffff');
    for (let i = 0; i < 16; i++) { const x = Math.round((i * 41 + game.t * 8) % W); rect(x, g + 13 + (i % 4) * 3, 4, 1, '#8fdcff'); }
    // his ride, parked at the rack
    const rx = 24 - cx;
    if (rx > -30) {
      for (let i = 0; i < 3; i++) { rect(rx + i * 8, g - 12, 1, 12, '#8a939c'); rect(rx + i * 8, g - 12, 6, 1, '#8a939c'); rect(rx + i * 8 + 5, g - 12, 1, 12, '#8a939c'); }
      if (w.parkedRide === 'bike') { G.strokeStyle = '#2a1f33'; for (const bx of [rx + 2, rx + 16]) { G.beginPath(); G.arc(bx, g - 5, 5, 0, Math.PI * 2); G.stroke(); } rect(rx + 2, g - 10, 14, 2, '#4cb944'); rect(rx + 14, g - 14, 2, 5, '#2a1f33'); }
      else { rect(rx + 3, g - 14, 2, 14, '#2a1f33'); rect(rx + 3, g - 14, 1, 13, '#e8752a'); }
    }
    // street sign
    const x = 60 - cx; if (x > -80 && x < W) A.sign(x, g, ['7TH ST', 'ISLAND PARK POOL'], { bg: '#3d7be0' });
  },
  drawSolid(s, cx, w) {
    const x = s.x0 - cx, ww = s.x1 - s.x0;
    if (s.style === 'guard') {
      rect(x, s.top, ww, 3, '#ffffff'); rect(x, s.top - 10, 2, 10, '#ffffff'); rect(x + ww - 2, s.top - 10, 2, 10, '#ffffff'); rect(x, s.top - 10, ww, 2, '#ff6a5a');
      rect(x + 1, s.top + 3, 2, w.ground - s.top - 3, '#ffffff'); rect(x + ww - 3, s.top + 3, 2, w.ground - s.top - 3, '#ffffff');
      for (let y = s.top + 8; y < w.ground; y += 6) rect(x + 1, y, ww - 2, 1, '#ffffff');
    } else {
      rect(x, s.top, ww, 3, '#ffffff'); rect(x, s.top + 3, ww, 1, '#c8d0dc'); rect(x + ww - 4, s.top - 6, 3, 7, '#ffffff');
      for (let bx = 2; bx < ww - 4; bx += 3) rect(x + bx, s.top, 1, 3, '#dfe6ee');
      rect(x + 1, s.top + 4, 1, 3, '#b8c0cc'); rect(x + ww - 3, s.top + 4, 1, 3, '#b8c0cc');
    }
  },
  drawBouncer(u, cx, w) {
    const x = u.x0 - cx, ww = u.x1 - u.x0, sq = Math.round(u.squish * 3);
    rect(x + ww / 2, u.y, 2, w.ground - u.y, '#ffffff');
    tri(x - 2, u.y + 5 + sq, x + ww + 2, u.y + 5 + sq, x + ww / 2, u.y - 5 + sq * 2, '#2f6fd6');
    rect(x - 2, u.y + 4 + sq, ww + 5, 2, '#2456ad');
    tri(x + ww / 2 - 6, u.y + 4 + sq, x + ww / 2 + 6, u.y + 4 + sq, x + ww / 2, u.y - 4 + sq * 2, '#5a95f0');
    for (let i = 0; i < 5; i++) rect(x - 2 + i * (ww + 4) / 4, u.y + 6 + sq, 2, 1, '#ffffff');
  },
};
async function wildSunny(w) {
  w.locked = true; cardTally(w);
  const d = w.dog;
  d.stay = true;
  await say('isaac', `Hey ${CONFIG.dog}, wait up! Where are you going?!`);
  d.walkTo = { x: 1270, speed: 160 };
  await until(() => !d.walkTo);
  d.vy = -260; d.walkTo = { x: 1290, speed: 60 };
  audio.sfx('bark', { n: 1 });
  await wait(0.45);
  audio.sfx('splash'); game.shake = 3;
  w.parts.burst(1290, w.ground + 12, 30, { colors: ['#8fdcff', '#ffffff', '#35a8e8'], speed: 110, g: 300, up: 90 });
  d.hidden = true;
  await wait(0.9);
  fadeTo(() => setScene(battleScene('sunny')), 'flash');
}

// =====================================================================================
// 5. THE NEW HOUSE — the reveal
// =====================================================================================
const newhouse = {
  id: 'newhouse', title: 'THE NEW HOUSE', sub: 'Big... bouncy... in the backyard?!', music: 'title',
  width: 900, ground: 126, startX: 30,
  inter: [
    { x: 176, y: 100, r: 18, label: 'SNIFF', fn: async (w, it) => {
      w.locked = true;
      if (it.uses === 1) { await say('isaac', 'Mmmm... these flowers smell AMAZING!'); audio.sfx('blip', { f: 1400 }); w.pops.add('PSST!', 176, 96, '#9fe35f'); await say('narrator', '(A flower whispers:) "Psssst... check the BACKYARD!"'); await say('isaac', 'Did that flower just TALK?!'); }
      else { audio.sfx('bark', { n: 1 }); w.pops.add('ACHOO!', w.dog.x, w.dog.y - 18, '#fff'); await say('sunny', 'AH-CHOO! (Sunny is allergic to fancy talking flowers.)'); }
      w.locked = false;
    } },
    { x: 246, y: 82, r: 12, label: 'KNOCK', fn: async (w) => { w.locked = true; audio.sfx('bump'); await wait(0.25); audio.sfx('bump'); await say('isaac', "Knock knock! ...Nobody's answering. Everybody must be out in the BACKYARD!"); w.locked = false; } },
  ],
  setup(w) {
    w.gate = 0;
    w.present = { x: 770, stage: 0, t: 0, open: false };
    w.npc('mom', SPR.mom, 700, { face: 1 });
    w.npc('dad', SPR.dad, 836, { face: -1 });
    w.npc('freida', SPR.freida, 730, { face: -1, pose: 'loaf' });
    w.triggers.push({ x: 150, fn: () => say('isaac', 'Our NEW HOUSE! The surprise is in the BACKYARD... through the gate!') });
    w.triggers.push({ x: 520, fn: () => { w.gateOpening = true; audio.sfx('whoosh'); } });
    w.triggers.push({ x: 640, fn: () => reveal(w) });
  },
  bg(cx, cy, w) {
    A.sky('#6ec3ff', '#e0f4ff');
    A.drawClouds(cx, 0.1, 4, 2);
    A.treeLine(cx, 0.2, 30, '#4f9a4c', '#3f8a3a');
    // backyard back fence (behind everything past the gate)
    A.fenceWood(560, 900, 110, 26, Math.round(cx * 0.85) - Math.round(560 * 0.15));
    G.drawImage(A.newHouse(), Math.round(120 - cx), w.ground - 124);
  },
  drawGround(cx, w) {
    const g = w.ground;
    rect(0, g, W, H, '#62b34f');
    for (let x = -(cx % 8); x < W; x += 8) rect(x + 3, g + 2 + (x & 2), 1, 2, '#4ca83c');
    rect(-cx, g + 8, 560, 7, '#d6d3cc');
    rect(236 - cx, g, 22, 8, '#c9c3b8');
  },
  mid(cx, w) {
    A.hydrangeas(130 - cx, w.ground, 96);
    A.hydrangeas(276 - cx, w.ground, 88);
    // big tree
    const tx = 404 - cx;
    rect(tx - 7, w.ground - 90, 14, 90, '#4a3526'); rect(tx - 4, w.ground - 90, 3, 90, '#5d4433');
    for (const [dx, dy, r] of [[-20, -96, 20], [8, -104, 24], [30, -88, 18], [-4, -80, 16]]) circle(tx + dx, w.ground + dy + 2, r, '#1f5a28');
    for (const [dx, dy, r] of [[-20, -96, 20], [8, -104, 24], [30, -88, 18], [-4, -80, 16]]) circle(tx + dx, w.ground + dy, r - 1, '#2f7a36');
    for (const [dx, dy, r] of [[-26, -104, 7], [2, -114, 9], [26, -96, 6]]) circle(tx + dx, w.ground + dy, r, '#5cb84a');
    // side fence + gate
    A.fenceWood(430, 552, w.ground, 34, cx);
    const gx = 552 - cx, open = w.gate;
    if (w.gateOpening) w.gate = Math.min(1, w.gate + 1 / 30);
    const gw = Math.round(26 * (1 - open * 0.85));
    rect(gx, w.ground - 34, gw, 34, '#a8743f'); rect(gx, w.ground - 34, gw, 2, '#d19b64'); rect(gx, w.ground - 20, gw, 2, '#8f6038');
    rect(gx + 26, w.ground - 36, 3, 36, '#8f6038');
    // present / trampoline
    const pr = w.present;
    if (!pr.open) A.present(pr.x - cx, w.ground, pr.stage, pr.t);
    else A.trampoline(pr.x - cx, w.ground, 84, w.trampSink || 0);
    pr.t += 1 / 60;
    const bh = w.bunnyHop;
    if (bh) {
      bh.vy += 400 / 60; bh.y += bh.vy / 60;
      if (bh.y > w.ground - 34) { bh.y = w.ground - 34; bh.vy = -170; audio.sfx('boing', { p: 4 }); w.trampSink = 3; setTimeout(() => (w.trampSink = 0), 100); }
      sprRot(SPR.bunny, bh.x - cx + 18, bh.y, Math.sin(game.t * 6) * 0.3);
    }
  },
  overlay(cx, w) {
    if (w.fireworks) for (const f of w.fireworks) {
      f.t += 1 / 60;
      if (f.t > 1.4) continue;
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = Math.min(f.t, 0.8) * 40; rect(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r + f.t * f.t * 10, 2, 2, f.c); }
    }
  },
};
async function reveal(w) {
  w.locked = true;
  await w.playerTo(700, 60);
  const mom = w.npcs.mom, dad = w.npcs.dad;
  mom.x = 676; mom.face = 1;
  w.p.face = 1;
  await say('mom', 'SURPRISE!!! You made it!');
  await say('isaac', 'FREIDA?! How did YOU get here first?!');
  audio.sfx('meow'); w.pops.add('...MRRP.', w.npcs.freida.x, w.ground - 20, '#fff', 1, 1.6);
  await say('dad', "You found ALL THREE clues. It's BIG... it's BOUNCY... it's in our new BACKYARD... go on, OPEN IT!");
  audio.stop();
  await w.playerTo(722, 40);
  setPad('action', { a: 'OPEN!' });
  w.goal = 'Tap OPEN to rip the paper!';
  for (let s = 1; s <= 3; s++) {
    await until(() => input.aPressed || input.tapPressed);
    audio.sfx('rip'); audio.sfx('snareroll', { n: s }); game.shake = 2;
    w.parts.burst(w.present.x + rand(-20, 20), w.ground - 30, 24, { colors: ['#e8483f', '#ffde5c', '#ff9a8f'], speed: 120, g: 260, up: 60, w: 2, h: 2 });
    w.present.stage = s; w.present.t = 0;
    w.hop(w.p, 100);
  }
  w.goal = '';
  setPad('none');
  // POOF
  audio.stop(); audio.sfx('pop'); game.shake = 6;
  w.present.open = true;
  w.parts.confetti(w.present.x, w.ground - 30, 140, 1.6);
  audio.play('reveal', () => audio.play('birthday'));
  banner("IT'S A<br>TRAMPOLINE!!!", 3400, 'long');
  w.fireworks = [];
  for (let i = 0; i < 8; i++) setTimeout(() => { w.fireworks.push({ x: rand(30, W - 30), y: rand(14, 50), t: 0, c: pick(CONFETTI) }); audio.sfx('firework'); }, 400 + i * 450);
  const party = setInterval(() => { for (const n of [mom, dad]) if (!n.hop) w.hop(n, 120); if (!w.dog.onGround) return; w.dog.vy = -200; }, 700);
  await wait(3.2);
  await say('isaac', 'A TRAMPOLINE?!?! NO WAY!!! NO WAAAAY!!!');
  await say('mom', `HAPPY 8th BIRTHDAY, ${K}! We love you SO much!`);
  audio.sfx('bark', { n: 3 }); w.pops.add('ARF ARF ARF!', w.dog.x, w.dog.y - 18, '#fff', 1, 1.6);
  await say('dad', CONFIG.moveLine);
  audio.sfx('purr'); w.pops.add('...mrrp. (approved)', w.npcs.freida.x, w.ground - 20, '#fff', 1, 1.8);
  await say('dad', "With great BOUNCE comes great responsibility... now what are you waiting for? JUMP ON IT!");
  clearInterval(party);
  // Big Bunny calls first bounce
  w.bunnyHop = { x: 752, y: w.ground - 40, vy: -120, t: 0 };
  w.pack = false; audio.sfx('boing', { p: 5 });
  banner('BIG BUNNY<br>CALLED FIRST BOUNCE!', 1800);
  await wait(1.8);
  w.bunnyHop = null; w.pack = true;
  // hop on!
  w.p.vy = -300; audio.sfx('jump');
  await w.playerTo(770, 80);
  for (let i = 0; i < 3; i++) {
    await until(() => w.p.onGround);
    audio.sfx('boing', { p: 2 + i * 2 }); w.trampSink = 5;
    setTimeout(() => (w.trampSink = 0), 120);
    w.p.vy = -260 - i * 60; w.p.y -= 2; w.p.onGround = false;
  }
  await wait(0.6);
  save.set({ stage: 5 });
  fadeTo(() => setScene(trampolineScene({ story: true })));
}
// Trampoline mat as a surface for the little hop-on moment.
newhouse.plats = [[734, 104, 72, 'mat']];
newhouse.drawPlat = () => {};

export const LEVELS = { room, yard, hood, skate, river, pool, newhouse };

// Called by battles / batting when they finish.
export function afterBattle(which) {
  if (which === 'freida') fadeTo(() => setScene(levelScene(yard), { after: 'freida' }));
  if (which === 'batting') goStage('path');
  if (which === 'catfish') { save.data.paths.river = true; save.flush(); goStage('pool'); }
  if (which === 'sunny') goStage('newhouse');
}
