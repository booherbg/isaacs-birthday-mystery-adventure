// Batting with Dad at Brunsdale Fields (Wii Sports vibes). No way to fail: pitches get slower and easier.
import { W, H, G, game, rect, circle, ellipse, spr, sprRot, pixelText, textWidth, wait, until, Particles, Pops, rand, pick, CONFETTI } from './engine.js';
import { SPR } from './sprites.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { say, choose, clueCard, banner, hud, setPad, toast, wormBanner } from './ui.js';
import { drawWorm } from './world.js';
import * as A from './art.js';
import { CONFIG } from './config.js';
import { save } from './save.js';
import { goStage } from './levels.js';

const K = CONFIG.kid.toUpperCase();
const GROUND = 118, CONTACT_X = 84, CONTACT_Y = 94;

export function battingScene() {
  const S = {
    name: 'batting', dlgTop: true, parts: new Particles(), pops: new Pops(),
    ball: null, swing: 0, misses: 0, state: 'intro', dadPose: 'idle', worm: 0, hr: null, fireworks: [],
    enter() {
      audio.play('ballgame');
      setPad('none');
      hud('', '', '');
      this.run().catch((e) => console.error(e));
    },
    async run() {
      await wait(0.4);
      toast(input.touchMode ? 'Tap SWING when the ball reaches the glowing spot!' : 'Press SPACE (or A) to swing when the ball hits the glowing spot!', 3200);
      setPad('action', { a: 'SWING!' });
      await wait(1.8);
      while (!this.hr) {
        this.state = 'wait';
        await wait(0.7);
        this.dadPose = 'pitch'; this.state = 'windup';
        await wait(0.55);
        this.dadPose = 'idle';
        const slow = this.misses >= 2, auto = this.misses >= 4;
        if (this.misses === 2 && !this.saidSlow) { this.saidSlow = true; this.pops.add('SLOW PITCH!', 200, 50, '#fff'); }
        if (auto && !this.saidAuto) { this.saidAuto = true; this.pops.add('MEATBALL!', 200, 50, '#ffde5c'); }
        const vx = auto ? -70 : slow ? -95 : -125;
        this.ball = { x: 198, y: 76, vx, vy: -30, spin: 0, auto, win: auto ? 40 : slow ? 16 : 12 };
        audio.sfx('whoosh');
        this.state = 'pitch';
        await until(() => !this.ball || this.ball.done);
        if (!this.hr) await wait(0.5);
      }
      setPad('none');
      await this.homeRun();
    },
    update(dt) {
      this.parts.update(dt); this.pops.update(dt);
      if (this.swing > 0) this.swing = Math.max(0, this.swing - dt);
      if (this.worm) this.worm += dt;
      const b = this.ball;
      if (b && !b.done && !b.hit) {
        b.x += b.vx * dt; b.vy += 90 * dt; b.y += b.vy * dt; b.spin += dt * 20;
        if (b.y > CONTACT_Y + 2) b.y = CONTACT_Y + 2;
        if (b.x < 30) { b.done = true; this.strike('STRIKE!'); }
      }
      this.cool = Math.max(0, (this.cool || 0) - dt);
      if (this.state === 'pitch' && this.swing === 0 && this.cool <= 0 && (input.aPressed || input.tapPressed || input.bPressed) && b && !b.hit) {
        this.swing = 0.28; audio.sfx('whoosh');
        const dx = b.x - CONTACT_X;
        if (b.auto && b.x < 185) this.hit('hr'); // Dad's meatball: any swing connects
        else if (Math.abs(dx) <= b.win) this.hit('hr');
        else if (Math.abs(dx) <= b.win * 2.2) this.hit('foul', dx);
        else { this.pops.add(dx > 0 ? 'TOO EARLY!' : 'TOO LATE!', 70, 52, '#fff'); this.cool = 0.5; }
      }
      if (b && b.hit) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.vy += (b.hit === 'hr' ? 40 : 300) * dt; b.spin += dt * 30;
        if (b.hit === 'hr' && game.frame % 2 === 0) this.parts.add({ x: b.x, y: b.y, life: 0.4, color: pick(['#fff', '#ffde5c']), w: 2, h: 2 });
        if (b.y < -40 || b.x > W + 40 || b.y > GROUND + 10 || b.x < -20) b.done = true;
      }
      if (this.hr) for (const f of this.fireworks) f.t += dt;
    },
    hit(kind, dx = 0) {
      const b = this.ball;
      b.hit = kind;
      audio.sfx('crack'); game.shake = kind === 'hr' ? 5 : 2;
      this.parts.burst(CONTACT_X, CONTACT_Y, 12, { colors: ['#fff', '#ffde5c'], speed: 80, g: 0, life: 0.3 });
      if (kind === 'hr') { b.vx = 260; b.vy = -260; this.hr = true; }
      else {
        b.vx = dx > 0 ? -60 : 40; b.vy = -200;
        this.misses++;
        this.pops.add('FOUL BALL!', 90, 50, '#ffde5c');
      }
    },
    strike(msg) {
      this.misses++;
      this.pops.add(msg, 70, 50, '#ff8a80');
      audio.sfx('miss');
    },
    async homeRun() {
      banner('HOME RUN!!!', 2400, 'long');
      audio.sfx('cheer');
      this.dadPose = 'cheer';
      for (let i = 0; i < 6; i++) setTimeout(() => { this.fireworks.push({ x: rand(40, 220), y: rand(14, 44), t: 0, c: pick(CONFETTI) }); audio.sfx('firework'); }, 300 + i * 380);
      await wait(2.6);
      // the ball comes back down... with a clue inside
      this.ball = { x: 150, y: -10, vx: -30, vy: 40, spin: 0, hit: 'drop' };
      await until(() => this.ball.y > 90);
      this.ball = null;
      audio.sfx('pop'); this.parts.confetti(130, 96, 50);
      await say('dad', 'WHAT A HIT!!! That ball went all the way to the MOON and back!');
      await say('dad', "Look — it split open! There's something inside...");
      await clueCard(2);
      this.worm = 0.01; audio.sfx('worm'); wormBanner();
      await wait(2.4); this.worm = 0;
      await say('isaac', "Big AND bouncy?! What could it BE?!");
      const done = save.data.paths || {};
      const c = await choose('dad', 'Two ways to the new house from here. Which way, buddy?', [
        `🛹 DIKE EAST SKATE PARK${done.skate ? ' ✓' : ''}`,
        `🚲 RED RIVER TRAIL${done.river ? ' ✓' : ''}`,
      ]);
      await say('dad', c === 0 ? "The skate park! I brought your SKATEBOARD. Mom's judging the Creeper contest — go show 'em!" : "The river trail! Take your BIKE — Mom's bird watching at LIONS CONSERVANCY PARK, and she brought your fishing rod!");
      goStage(c === 0 ? 'skate' : 'river');
    },
    render() {
      A.sky('#6ec3ff', '#d4f0ff');
      A.drawClouds(0, 0, 6, 3);
      A.treeLine(0, 0, 50, '#5aa05a', '#4a8c4c');
      // outfield fence + neighbors' houses peeking
      rect(0, 78, W, 16, '#2c7a34'); rect(0, 78, W, 2, '#ffde5c');
      const msg = 'HAPPY BIRTHDAY ' + K + '!'; pixelText(msg, 142 - textWidth(msg) / 2, 81, '#ffde5c');
      rect(0, 94, W, 24, '#6fc25a');
      for (let x = 0; x < W; x += 16) rect(x, 94, 8, 24, '#65b651');
      rect(0, GROUND, W, H, '#c9925a');
      ellipse(212, GROUND + 1, 26, 4, '#b8804a');
      rect(70, GROUND, 12, 2, '#fff');
      // Sunny + Freida spectating
      G.save(); G.translate(174, GROUND); G.scale(2, 2); spr(SPR.sunny.sit, -10, -16, true); G.restore();
      // his skateboard + bike leaning on the fence, ready for the next leg
      rect(236, 70, 3, 22, '#2a1f33'); rect(236, 71, 2, 20, '#e8752a');
      G.strokeStyle = '#2a1f33'; G.lineWidth = 1; for (const bx of [6, 24]) { G.beginPath(); G.arc(bx, 86, 7, 0, Math.PI * 2); G.stroke(); } rect(6, 79, 18, 2, '#4cb944'); rect(20, 74, 2, 6, '#2a1f33');
      spr(SPR.freida.loaf, 150, 80 - 12);
      // sweet spot
      if (this.state === 'pitch' && this.ball && !this.ball.hit) {
        const pulse = 0.5 + Math.sin(game.t * 10) * 0.5;
        G.globalAlpha = 0.35 + pulse * 0.3; circle(CONTACT_X, CONTACT_Y, 6 + (this.ball.win > 14 ? 3 : 0), '#ffde5c'); G.globalAlpha = 1;
      }
      // Dad
      G.save(); G.translate(212, GROUND); G.scale(2, 2);
      spr(SPR.dad[this.dadPose] || SPR.dad.idle, -8, -30, true);
      G.restore();
      // Isaac + bat
      G.save(); G.translate(62, GROUND); G.scale(2, 2);
      if (this.worm) drawWorm(0, 0, this.worm, false);
      else {
        const t = this.swing > 0 ? 1 - this.swing / 0.28 : 0;
        const ang = -2.0 + Math.min(1, t * 1.6) * 2.9;
        const drawBat = () => { G.save(); G.translate(-1, -13); G.rotate(ang); rect(0, -1, 14, 2, '#c98f55'); rect(10, -2, 6, 4, '#c98f55'); rect(10, -2, 6, 1, '#e6b37a'); rect(0, -1, 3, 2, '#2a1f33'); G.restore(); };
        if (t < 0.45) drawBat();
        spr(SPR.isaac.hold, -8, -24);
        if (t >= 0.45) drawBat();
      }
      G.restore();
      // ball
      const b = this.ball;
      if (b && !b.done) sprRot(SPR.baseball, b.x, b.y, b.spin, false, b.hit === 'hr' ? Math.max(0.4, 1 - (b.x - 90) / 400) : 1);
      for (const f of this.fireworks) {
        if (f.t > 1.4) continue;
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = Math.min(f.t, 0.8) * 40; rect(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r + f.t * f.t * 10, 2, 2, f.c); }
      }
      this.parts.draw(); this.pops.draw();
      if (this.misses && !this.hr) pixelText('STRIKES ' + this.misses, 8, 8, '#fff', 1, '#2a1f33');
    },
  };
  return S;
}
