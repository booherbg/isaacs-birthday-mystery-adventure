// The Cannonball Contest at Island Park Pool. Bounce the springboard (tap as you land), then in the air
// FLIP, tuck into a CANNONBALL, or do THE WORM (a belly flop). Biggest splash wins; Mom, Dad and the
// lifeguard hold up scores, and a big enough splash soaks whoever is sitting on the far deck.
import { W, H, G, game, rect, circle, ellipse, spr, pixelText, textWidth, wait, until, setScene, fadeTo, Particles, Pops, clamp, rand } from './engine.js';
import { SPR } from './sprites.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { say, banner, hud, setPad, padLabel, toast, btnName } from './ui.js';
import * as A from './art.js';
import { save } from './save.js';
import { drawHat } from './tramp.js';
import { giveCard } from './cards.js';
import { afterBattle } from './levels.js';
import { titleScene } from './title.js';

const BOARD_Y = 96, STAND_X = 70, WATER_Y = 112, DECK_X = 56, GRAV = 1000, CONTACT = 0.13;
const FLIP_T = 0.34, TUCK_FLIP_T = 0.26;
const DECK = 108; // far-deck footing (the judges are across the pool, so they're drawn 1x)
const JUDGES = [{ id: 'mom', x: 176 }, { id: 'dad', x: 200 }, { id: 'guard', x: 234 }];
const FREIDA_X = 150, SUNNY_X = 126;
const CHAIR_Y = 86; // the lifeguard stands up on his chair

export function diveScene({ replay = false, fromMenu = false } = {}) {
  const touch = input.touchMode;
  const aName = touch ? 'BOUNCE' : btnName('a'), flipName = touch ? 'FLIP' : btnName('a');
  const downName = touch ? '▼' : input.padConnected ? 'DOWN' : '↓', wormName = touch ? 'WORM' : btnName('b');
  const S = {
    name: 'dive', dlgTop: true, parts: new Particles(), pops: new Pops(),
    p: null, flex: 0, flexV: 0, camY: 0, dive: 0, total: 0, scores: [], cards: [null, null, null],
    splash: null, ripples: [], soaked: {}, soakAt: 0, tried: {}, sunnyHop: 0, perfect: false,
    enter() {
      audio.play('pool');
      setPad('none');
      hud('', '', '');
      this.reset();
      this.run().catch((e) => console.error(e));
    },
    reset() {
      this.p = { x: STAND_X, cy: BOARD_Y - 24, vx: 0, vy: 0, rot: 0, state: 'wait', contacts: 0, power: 0, flips: 0, flipT: -1, queue: 0, tuck: false, worm: false, lastA: -9, wt: 0 };
      this.flex = 0; this.flexV = 0;
    },
    updHud() { hud(`DIVE ${this.dive}/3`, `SCORE ${this.total}`, ''); },

    async run() {
      await wait(0.6);
      if (!save.data.dive?.plays) {
        await say('dad', 'Welcome to the CANNONBALL CONTEST! Mom, me and the lifeguard are judging. Biggest SPLASH wins!');
        await say('mom', `Tap ${aName} right as you LAND on the board... 3 bounces. Then in the air: hold ${downName} for a CANNONBALL, or tap ${flipName} to flip!`);
      }
      for (let d = 1; d <= 3; d++) {
        this.dive = d; this.updHud();
        banner(d === 3 ? 'LAST DIVE!' : `DIVE ${d}`, 1100);
        if (d === 2 && !this.tried.flip) toast(`Tap ${flipName} in the air to FLIP for bonus points!`, 3200);
        if (d === 3 && !this.tried.worm) toast(`Psst... ${wormName} in the air = THE WORM. Just saying.`, 3400);
        await wait(0.8);
        setPad('trick', { a: 'BOUNCE!', b: 'WORM', down: 'cannonball' });
        this.p.state = 'ready';
        await until(() => this.p.state === 'surfaced');
        setPad('none');
        // paddle out of the judges' way while the paddles go up
        await wait(0.3);
        Object.assign(this.p, { state: 'swim', swimTo: 108 });
        await this.scoreDive();
        if (d < 3) {
          this.p.swimTo = DECK_X + 10;
          await until(() => this.p.x <= DECK_X + 10);
          fadeTo(() => { this.reset(); this.camY = 0; });
          await wait(0.45);
        }
      }
      await this.finale();
    },

    update(dt) {
      const p = this.p, aP = input.aPressed || input.tapPressed;
      this.parts.update(dt); this.pops.update(dt);
      // the springboard: a damped spring whenever Isaac isn't pressing it down
      if (p.state !== 'contact') { this.flexV += (-this.flex * 300 - this.flexV * 10) * dt; this.flex += this.flexV * dt; }
      if (p.state === 'ready' || p.state === 'wait') {
        p.cy = BOARD_Y + this.flex - 24;
        if (p.state === 'ready' && aP) { p.state = 'bounce'; p.vy = -280; this.flexV = -40; audio.sfx('jump'); }
      } else if (p.state === 'bounce') {
        if (aP) p.lastA = game.t;
        p.vy += GRAV * dt; p.cy += p.vy * dt;
        if (p.vy > 0 && p.cy >= BOARD_Y - 24) { p.cy = BOARD_Y - 24; p.state = 'contact'; p.ct = game.t; p.contacts++; audio.sfx('boing', { p: 1 + p.power }); }
      } else if (p.state === 'contact') {
        if (aP) p.lastA = game.t;
        const k = Math.min(1, (game.t - p.ct) / CONTACT);
        this.flex = Math.sin(k * Math.PI) * (5 + p.power);
        p.cy = BOARD_Y + this.flex - 24;
        if (k >= 1) this.leaveBoard();
      } else if (p.state === 'fly') this.fly(dt, aP);
      else if (p.state === 'water' || p.state === 'surfaced' || p.state === 'swim') this.swim(dt);
      // camera follows him up into the sky (leading a little on the way up; the party hat counts too)
      const target = Math.min(0, p.cy - 50 + Math.min(0, p.vy * 0.12));
      this.camY += (target - this.camY) * Math.min(1, dt * 7);
      if (this.splash) this.splash.t += dt;
      for (const r of this.ripples) r.t += dt;
      this.ripples = this.ripples.filter((r) => r.t < 1.8);
      if (this.soakAt && game.t >= this.soakAt) { this.soakAt = 0; this.soak(); }
      for (const id in this.soaked) if (Math.random() < dt * 7) this.parts.add({ x: this.spot(id).x + rand(-4, 4), y: this.spot(id).y + rand(2, 10), vy: 10, g: 260, life: 0.45, color: '#8fdcff' });
      for (const c of this.cards) if (c) c.t += dt;
      if (this.sunnyHop > 0) this.sunnyHop -= dt;
    },

    leaveBoard() {
      const p = this.p, d = p.lastA - p.ct;
      // a press just before touchdown or during the squish counts; dead-on is PERFECT
      const q = d > -0.16 && d <= CONTACT ? (Math.abs(d - 0.02) < 0.075 ? 2 : 1) : 0;
      p.power += q; p.lastA = -9;
      this.pops.add(q === 2 ? 'PERFECT!' : q ? 'GOOD!' : 'BOING!', p.x, p.cy - 30, q === 2 ? '#ffde5c' : q ? '#ffffff' : '#8fdcff');
      if (q === 2) audio.sfx('perfect', { combo: p.power });
      this.flexV = -(80 + p.power * 20);
      if (p.contacts < 3) { p.state = 'bounce'; p.vy = -(300 + 45 * p.power); return; }
      p.state = 'fly'; p.vy = -(330 + 40 * p.power); p.vx = 90;
      audio.sfx('whoosh');
      padLabel('FLIP');
      if (p.power >= 6) this.pops.add('MAX POWER!', p.x, p.cy - 46, '#ff7d98');
    },

    fly(dt, aP) {
      const p = this.p;
      if (input.left) p.vx = Math.max(40, p.vx - 170 * dt);
      if (input.right) p.vx = Math.min(140, p.vx + 170 * dt);
      if (!p.worm) {
        if (aP) { this.tried.flip = true; if (p.flipT < 0) { p.flipT = 0; audio.sfx('flip'); } else if (p.queue < 2) p.queue++; }
        if ((input.downPressed || input.down) && !p.tuck) { p.tuck = true; audio.sfx('blip', { f: 520 }); this.pops.add('TUCK!', p.x + 24, p.cy - 20, '#ffde5c'); }
        if (input.bPressed) { p.worm = true; p.tuck = false; p.flipT = -1; p.queue = 0; this.tried.worm = true; audio.sfx('worm'); this.pops.add('THE WORM?!', p.x, p.cy - 30, '#9fe35f'); }
      }
      const FT = p.tuck ? TUCK_FLIP_T : FLIP_T;
      if (p.flipT >= 0) {
        p.flipT += dt;
        if (p.flipT >= FT) {
          p.flips++;
          if (p.queue > 0) { p.queue--; p.flipT = 0; audio.sfx('flip'); } else p.flipT = -1;
        }
      }
      p.rot = (p.flips + (p.flipT >= 0 ? p.flipT / FT : 0)) * Math.PI * 2;
      p.vy += GRAV * dt; p.cy += p.vy * dt; p.x = Math.min(236, p.x + p.vx * dt);
      if (p.cy >= WATER_Y - 10) this.entry(FT);
    },

    entry(FT) {
      const p = this.p, part = p.flipT >= 0 ? p.flipT / FT : 0;
      if (p.tuck && part > 0.55) p.flips++; // a ball is a ball: round up an almost-done tucked flip
      const flips = Math.min(3, p.flips);
      const type = p.worm ? 'flop' : p.tuck ? 'ball' : part > 0.22 && part < 0.78 ? 'splat' : 'pencil';
      const splash = type === 'ball' ? 4 + 0.8 * p.power + 0.6 * flips : type === 'flop' ? 7 : type === 'splat' ? 4 : 1.5 + 0.3 * flips;
      Object.assign(p, { state: 'water', wt: 0, flipT: -1, type, splash, flipsDone: flips });
      if (type === 'flop') p.rot = Math.PI / 2;
      this.splash = { x: p.x, t: 0, size: splash, flat: type === 'flop' };
      this.ripples.push({ x: p.x, t: 0, size: splash });
      if (type === 'flop') { audio.sfx('smack'); this.pops.add('SMACK!', p.x, WATER_Y - 22, '#ff8a80', 2, 1.2); }
      audio.sfx('sploosh', { size: splash / 10 });
      game.shake = Math.min(6, splash * 0.6);
      this.parts.burst(p.x, WATER_Y, Math.round(10 + splash * 6), { colors: ['#ffffff', '#8fdcff', '#d4f6ff'], speed: 50 + splash * 16, g: 420, up: 30 + splash * 14, life: 0.9, w: 2, h: 2 });
      const names = {
        ball: ['CANNONBALL!', 'FLIP-A-BALL!', 'DOUBLE FLIP<br>CANNONBALL!', 'TRIPLE FLIP<br>CANNONBALL!!'][flips],
        pencil: ['PENCIL DIVE!', 'FRONT FLIP!', 'DOUBLE FLIP!', 'TRIPLE FLIP!!'][flips],
        splat: 'SPLAT!', flop: 'BELLY FLOP!!',
      };
      banner(names[type], 1500);
      if (splash >= 7) this.soakAt = game.t + 0.45;
    },

    // Who's on the far deck, and where their heads are (for drips + pop-ups).
    spot(id) {
      if (id === 'freida') return { x: FREIDA_X, y: DECK - 12 };
      if (id === 'sunny') return { x: SUNNY_X, y: DECK - 16 };
      const j = JUDGES.find((q) => q.id === id);
      return { x: j.x, y: (id === 'guard' ? CHAIR_Y : DECK) - 26 };
    },
    soak() {
      const p = this.p, all = p.splash >= 9.5;
      for (const id of ['sunny', 'freida', 'mom', 'dad', 'guard']) {
        const s = this.spot(id);
        if (!all && Math.abs(s.x - p.x) > 55) continue;
        this.parts.burst(s.x, s.y, 12, { colors: ['#8fdcff', '#ffffff'], speed: 50, g: 300, life: 0.6 });
        const first = !this.soaked[id];
        this.soaked[id] = true;
        const line = { sunny: 'ARF ARF!', freida: 'HISSSS!', mom: first ? 'EEK!' : 'AGAIN?!', dad: first ? 'SOAKED!' : 'WORTH IT!', guard: 'HEY!' }[id];
        this.pops.add(line, clamp(s.x, 20, W - 24), s.y - 8, id === 'freida' ? '#ff8a80' : '#ffffff', 1, 1.4);
        if (id === 'freida') audio.sfx('meow');
      }
      this.sunnyHop = 0.5; audio.sfx('bark', { n: 2 }); // Sunny LOVES this
    },

    swim(dt) {
      const p = this.p;
      p.wt += dt;
      if (p.state === 'water') {
        // plunge, then pop back up to the surface
        const t = p.wt;
        p.cy = t < 0.35 ? WATER_Y - 10 + 44 * Math.sin((t / 0.35) * Math.PI / 2) : WATER_Y + 34 - Math.min(1, (t - 0.35) / 0.45) * 36;
        if (Math.random() < dt * 30) this.parts.add({ x: p.x + rand(-6, 6), y: p.cy - 10, vy: -40, life: 0.5, color: '#d4f6ff' });
        if (t > 0.85) {
          p.state = 'surfaced'; p.rot = 0;
          this.pops.add(p.type === 'flop' ? 'OWWWIE!' : p.type === 'splat' ? 'OOF!' : 'WOOHOO!', p.x, WATER_Y - 36, '#ffffff');
        }
      } else {
        p.cy = WATER_Y - 2 + Math.sin(game.t * 3) * 1.5; // head + shoulders out
        if (p.state === 'swim' && p.x > p.swimTo) { p.x = Math.max(p.swimTo, p.x - 80 * dt); if (Math.random() < dt * 10) this.ripples.push({ x: p.x + 8, t: 0.9, size: 1 }); }
      }
    },

    async scoreDive() {
      const p = this.p, t = p.type, h = p.power / 6, f = p.flipsDone, sp = p.splash;
      let v, labels = [], lines;
      if (t === 'flop') {
        v = [4, 10, 1]; labels = [null, null, 'OUCH'];
        lines = ['OUCH, BUDDY!', 'I FELT THAT!', 'TWEEEET!'];
      } else {
        const base = t === 'ball' ? 3 + 4 * h + 1.2 * f + (sp >= 8 ? 1 : 0) : t === 'pencil' ? 4 + 2.5 * h + 1.5 * f : 2 + 0.5 * f;
        v = [base + (f ? 1 : 0) + 0.5, base + (sp >= 7 ? 1 : 0) + (this.soaked.dad ? 1 : 0), base - 1 + (t === 'pencil' ? 1.5 : 0)].map((x) => clamp(Math.round(x), 1, 10));
        lines = [v[0] >= 9 ? 'GORGEOUS!' : v[0] >= 6 ? 'NICE ONE!' : 'GOOD TRY!', this.soaked.dad ? 'WORTH IT!' : v[1] >= 9 ? 'HUGE!!!' : 'NOT BAD!', v[2] >= 9 ? 'RESPECT.' : v[2] >= 6 ? 'SOLID.' : 'NO RUNNING!'];
      }
      await wait(0.5);
      audio.sfx('snareroll', { n: 2 });
      await wait(0.55);
      for (let j = 0; j < 3; j++) {
        this.cards[j] = { v: v[j], label: labels[j], t: 0 };
        audio.sfx(t === 'flop' && j === 2 ? 'whistle' : 'blip', { f: 600 + v[j] * 70 });
        await wait(0.34);
      }
      const sum = v.reduce((a, b) => a + b, 0);
      this.total += sum; this.scores.push(sum); this.updHud();
      this.pops.add('+' + sum, clamp(p.x, 30, 140), WATER_Y - 44, '#ffde5c', 2, 1.4);
      if (sum === 30) { this.perfect = true; audio.sfx('record'); audio.sfx('cheer'); banner('PERFECT 30!!!', 1800); }
      else audio.sfx(sum >= 24 ? 'record' : 'coin');
      await wait(0.4);
      JUDGES.forEach((j, i) => this.pops.add(lines[i], clamp(j.x - (i === 2 ? 8 : 0), 22, W - 26), this.spot(j.id).y - (i === 1 ? 50 : 40), '#ffffff', 1, 1.5));
      await wait(1.5);
      this.cards = [null, null, null];
    },

    async finale() {
      const T = this.total;
      const rank = T >= 80 ? 'POOL LEGEND' : T >= 65 ? 'CANNONBALL CHAMP' : T >= 45 ? 'SPLASH MASTER' : 'SPLISH SPLASH STAR';
      audio.play('win', () => audio.play('pool'));
      banner(`${T} POINTS!<small>${rank}</small>`, 2800, 'long');
      this.parts.confetti(W / 2, 20, 80);
      const d = save.data.dive || (save.data.dive = { best: 0, plays: 0 });
      const newBest = d.plays > 0 && T > d.best;
      d.best = Math.max(d.best, T); d.plays++; save.flush();
      await wait(2.8);
      const got = giveCard('splash');
      if (got.isNew) { audio.sfx('card'); toast(`🃏 New card for your binder: CANNONBALL!${got.complete ? ' Binder complete!' : ''}`, 2400); await wait(2.6); }
      if (this.perfect && !save.data.tramp.hats.includes('goggles')) { save.data.tramp.hats.push('goggles'); save.flush(); audio.sfx('unlock'); toast('🥽 New hat: SWIM GOGGLES! Wear them in Trampoline Time.', 2800); await wait(3); }
      if (newBest) { toast(`New best score: ${T}!`, 2000); await wait(2.2); }
      await say('dad', T >= 65 ? `${T} POINTS?! I'm soaked AND impressed. ${rank}!` : `${T} points! That's ${rank} stuff, buddy!`);
      hud('', '', '');
      if (fromMenu) fadeTo(() => setScene(titleScene()));
      else afterBattle('dive', { replay });
    },

    render() {
      const p = this.p;
      A.sky('#5cc2ff', '#d8f3ff');
      G.save(); G.translate(0, -Math.round(this.camY));
      A.drawClouds(0, 0.1, 6, 2);
      A.treeLine(0, 0, 40, '#4f9a4c', '#3f8a3a');
      // bathhouse behind the far deck, the slides off to the left
      rect(146, 60, 120, 38, '#c8b89a'); rect(146, 80, 120, 18, '#2f5fa8'); rect(146, 58, 120, 3, '#ffffff');
      A.poolSlides(26);
      A.chainFence(0, W, 84, 98, 0);
      rect(0, 98, W, 14, '#e8e2d6'); for (let x = 6; x < W; x += 20) rect(x, 98, 1, 12, '#d6cfbf');
      this.drawFarDeck();
      // the pool (a side cut-away), then the near deck + springboard
      rect(DECK_X, WATER_Y, W - DECK_X, H - WATER_Y + 80, '#35a8e8');
      for (let x = DECK_X + 18; x < W; x += 36) rect(x, WATER_Y + 4, 1, 80, '#2a8ad0');
      rect(DECK_X, H - 6, W - DECK_X, 86, '#2a8ad0');
      for (let i = 0; i < 18; i++) { const x = DECK_X + Math.round((i * 43 + game.t * 10) % (W - DECK_X)); rect(x, WATER_Y + 3 + (i % 5) * 5, 5, 1, '#8fdcff'); }
      for (const r of this.ripples) {
        const k = r.t / 1.8, rw = 6 + k * (20 + r.size * 5);
        G.globalAlpha = 1 - k; rect(r.x - rw, WATER_Y - 1, rw * 2, 1, '#ffffff'); rect(r.x - rw * 0.6, WATER_Y + 1, rw * 1.2, 1, '#d4f6ff'); G.globalAlpha = 1;
      }
      this.drawNearDeck();
      this.drawIsaac();
      // everything below the surface gets a watery tint (so Isaac looks submerged)
      G.globalAlpha = 0.5; rect(DECK_X, WATER_Y + 1, W - DECK_X, H - WATER_Y + 80, '#35a8e8'); G.globalAlpha = 1;
      rect(DECK_X, WATER_Y, W - DECK_X, 1, '#d4f6ff');
      this.drawSplash();
      this.drawRing();
      this.parts.draw(); this.pops.draw();
      G.restore();
    },

    drawFarDeck() {
      // Freida, loafing somewhere she's about to regret; Sunny, hoping to get splashed
      spr(SPR.freida.loaf, FREIDA_X - 9, DECK - 12);
      const hop = this.sunnyHop > 0 ? Math.round(Math.sin((this.sunnyHop / 0.5) * Math.PI) * 6) : 0;
      spr(SPR.sunny.sit, SUNNY_X - 10, DECK - 16 - hop);
      // the lifeguard's tall chair
      const gx = 234;
      rect(gx - 9, CHAIR_Y, 18, 2, '#ffffff'); rect(gx - 9, CHAIR_Y + 2, 2, DECK - CHAIR_Y - 2, '#ffffff'); rect(gx + 7, CHAIR_Y + 2, 2, DECK - CHAIR_Y - 2, '#ffffff');
      for (let y = CHAIR_Y + 6; y < DECK; y += 5) rect(gx - 9, y, 18, 1, '#ffffff');
      rect(gx - 9, CHAIR_Y - 10, 2, 10, '#ffffff'); rect(gx + 7, CHAIR_Y - 10, 2, 10, '#ffffff'); rect(gx - 9, CHAIR_Y - 10, 18, 2, '#ff6a5a');
      JUDGES.forEach((j, i) => {
        const c = this.cards[i], hype = c && c.v >= 8;
        const img = j.id === 'mom' ? (hype ? SPR.mom.wave : SPR.mom.idle) : j.id === 'dad' ? (hype ? SPR.dad.cheer : SPR.dad.idle) : SPR.guard;
        const foot = j.id === 'guard' ? CHAIR_Y : DECK;
        spr(img, Math.round(j.x - img.width / 2), foot - img.height, true);
        if (c) this.drawCard(j.x, foot - img.height - 3, c);
      });
    },
    drawCard(x, top, c) {
      const rise = Math.min(1, c.t / 0.15), y = Math.round(top - 16 * rise);
      rect(x, y + 12, 1, 18 - 12 * rise, '#8a5a3a');
      const s = String(c.label || c.v), hw = Math.max(10, textWidth(s, 2) / 2 + 3);
      rect(x - hw, y - 1, hw * 2, 14, '#2a1f33'); rect(x - hw + 1, y, hw * 2 - 2, 12, '#ffffff');
      pixelText(s, x - textWidth(s, 2) / 2 + 1, y + 1, c.v >= 9 ? '#e8483f' : '#2a1f33', 2);
    },
    drawNearDeck() {
      rect(0, WATER_Y - 2, DECK_X, H - WATER_Y + 82, '#ece6da'); rect(0, WATER_Y - 2, DECK_X + 2, 3, '#ffffff');
      for (let x = 8; x < DECK_X; x += 16) rect(x, WATER_Y + 1, 1, 60, '#d6cfbf');
      // springboard: ladder, anchor, blue fulcrum, and a board that bends more toward the tip
      rect(2, BOARD_Y + 2, 2, WATER_Y - BOARD_Y - 4, '#8a939c'); rect(12, BOARD_Y + 2, 2, WATER_Y - BOARD_Y - 4, '#8a939c');
      for (let y = BOARD_Y + 6; y < WATER_Y - 2; y += 4) rect(2, y, 12, 1, '#8a939c');
      rect(24, BOARD_Y + 3, 10, WATER_Y - BOARD_Y - 5, '#2a1f33'); rect(25, BOARD_Y + 4, 8, WATER_Y - BOARD_Y - 6, '#3d7be0'); rect(25, BOARD_Y + 4, 2, WATER_Y - BOARD_Y - 6, '#5a95f0');
      const L = 86;
      for (let i = 0; i <= L; i++) {
        const k = i / L, y = Math.round(BOARD_Y + this.flex * k * k);
        rect(2 + i, y - 1, 1, 6, '#2a1f33'); rect(2 + i, y, 1, 1, '#3d7be0'); rect(2 + i, y + 1, 1, 2, '#f1e3b5'); rect(2 + i, y + 3, 1, 1, '#c9b27a');
      }
    },
    drawIsaac() {
      const p = this.p, S = SPR.swim;
      const inWater = p.state === 'water' || p.state === 'surfaced' || p.state === 'swim';
      let img = S.idle, rot = p.rot;
      if (p.state === 'fly') img = p.worm ? S.cheer : p.tuck ? S.tuck : S.jump;
      else if (p.state === 'bounce') img = S.jump;
      else if (inWater) img = p.state === 'water' ? S.jump : p.state === 'swim' && p.x > p.swimTo ? S.walkA : p.type === 'flop' ? S.idle : S.cheer;
      if (p.state === 'fly' && p.worm) rot = Math.PI / 2 + Math.sin(game.t * 16) * 0.15;
      else if (p.state === 'fly' && p.tuck) rot -= 0.35; // the classic lean-back cannonball
      if (inWater && p.state !== 'water') rot = 0;
      G.save();
      G.translate(Math.round(p.x), Math.round(p.cy));
      if (p.state === 'swim' && p.x > p.swimTo) G.scale(-1, 1);
      G.scale(2, 2); G.rotate(rot);
      G.drawImage(img, -8, -12);
      drawHat(save.data.tramp.hat);
      G.restore();
    },
    drawSplash() {
      const s = this.splash;
      if (!s || s.t > 1.4) return;
      const up = s.t < 0.35 ? s.t / 0.35 : Math.max(0, 1 - (s.t - 0.35) / 0.9);
      const hgt = (s.flat ? 3 : 7) * s.size * up, wid = (s.flat ? 5 : 2.2) * s.size;
      for (let y = 0; y < hgt; y += 3) {
        const k = y / Math.max(1, hgt), rw = wid * (1 - k * 0.55) + Math.sin(game.t * 30 + y) * 1.5;
        ellipse(s.x, WATER_Y - y, Math.max(2, rw), 3, k > 0.7 ? '#ffffff' : '#d4f6ff');
      }
      if (hgt > 6) for (let i = -1; i <= 1; i += 2) circle(s.x + i * wid * 0.9, WATER_Y - hgt * 0.35, Math.max(2, s.size * 0.6), '#ffffff');
    },
    // Rhythm ring on the board: it closes as Isaac comes down — tap when it closes.
    drawRing() {
      const p = this.p;
      if (p.state !== 'bounce' || p.vy <= 0) return;
      const dist = BOARD_Y - 24 - p.cy, r = Math.round(clamp(dist / 3, 3, 26));
      const cx = p.x, cy = BOARD_Y + 1;
      G.strokeStyle = r <= 5 ? '#ffffff' : '#ffde5c'; G.lineWidth = 2;
      G.beginPath(); G.ellipse(cx, cy, r + 4, (r + 4) * 0.4, 0, 0, Math.PI * 2); G.stroke();
      G.lineWidth = 1;
    },
  };
  return S;
}
