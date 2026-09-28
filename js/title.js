// Title screen, Trampoline Time menu, pause menu, and the birthday card.
import { W, H, G, game, rect, circle, spr, sprRot, setScene, fadeTo, offscreen, Particles, rand } from './engine.js';
import { SPR, PORTRAIT } from './sprites.js';
import { audio } from './audio.js';
import { input } from './input.js';
import { overlay, menu, hud, setPad, toast, closeOverlay, clueBook, btnName } from './ui.js';
import * as A from './art.js';
import { CONFIG } from './config.js';
import { save } from './save.js';
import { goStage, STAGES, STAGE_NAMES } from './levels.js';
import { trampolineScene, hatPicker, drawHat, HATS } from './tramp.js';

export function titleScene() {
  const S = {
    name: 'title', x: 0, parts: new Particles(), bounce: 0,
    enter() {
      hud('', '', '');
      setPad('none');
      audio.play(save.data.done ? 'bounce' : 'title');
      this.menu();
    },
    async menu() {
      const d = save.data;
      const started = d.stage > 0 && !d.done;
      const btns = d.done
        ? [{ v: 'tramp', label: '★ TRAMPOLINE TIME ★', cls: 'go' }, { v: 'story', label: '▶ Play the story again<span class="note">Try the other path!</span>' }, { v: 'card', label: '🎂 Birthday card' }]
        : started
          ? [{ v: 'continue', label: `▶ CONTINUE<span class="note">${STAGE_NAMES[STAGES[d.stage]] || ''}</span>`, cls: 'go' }, { v: 'new', label: '↺ Start over' }]
          : [{ v: 'new', label: '▶ START THE ADVENTURE', cls: 'go' }];
      const portrait = innerHeight > innerWidth;
      const foot = input.touchMode ? (portrait ? 'Tip: turn your phone sideways for a bigger screen ↻' : 'Sound on! ♪') : '🎮 Got a controller? Plug it in and press a button. · Sound on! ♪';
      const v = await overlay(`
        <div class="title-wrap"><div class="logo">ISAAC'S<br class="pb"> <span>BIRTHDAY</span><br>MYSTERY<br class="pb"> ADVENTURE</div>
        <div class="tag">${d.done ? '★ MYSTERY SOLVED ★' : 'A MYSTERY IN 3 CLUES'}</div></div>
        <div class="title-btns">${btns.map((b) => `<button class="big ${b.cls || ''}" data-v="${b.v}">${b.label}</button>`).join('')}</div>
        <div class="title-foot">${foot}</div>`, { cls: 'clear' });
      audio.unlock();
      if (input.touchMode && (v === 'new' || v === 'continue' || v === 'story' || v === 'tramp')) {
        try { const el = document.documentElement; const p = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); p?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch?.(() => {}); } catch {}
      }
      if (v === 'new' && started) {
        const ok = await menu({ title: 'START OVER?', sub: 'This clears your clues and progress (your hats and cards stay).', buttons: [{ v: 'yes', label: '↺ Yes, start over' }, { v: 'no', label: '← Keep my progress', cls: 'go' }] });
        if (ok !== 'yes') return this.menu();
      }
      if (v === 'new') { save.reset(); goStage('room'); }
      else if (v === 'continue') goStage(STAGES[d.stage]);
      else if (v === 'story') { save.set({ stage: 0, path: null }); goStage('room'); }
      else if (v === 'card') { await birthdayCard(); this.menu(); }
      else if (v === 'tramp') this.trampMenu();
      else this.menu();
    },
    async trampMenu() {
      const t = save.data.tramp;
      const v = await menu({
        title: 'TRAMPOLINE TIME',
        sub: `High score: ${t.high} · Hats: ${t.hats.length - 1}/${HATS.length - 1}`,
        body: (() => { const F = input.touchMode ? 'FLIP' : btnName('a'), Sp = input.touchMode ? 'SPIN' : btnName('b'), D = input.touchMode ? '▼' : '↓'; return `<p style="font-size:14px;margin:4px 0"><b>${F}</b> as you land = bounce higher · <b>${F}</b> in the air = backflip · hold ◀▶ + ${F} = front flip · <b>${Sp}</b> = 360 · <b>${D}</b> = the worm</p>`; })(),
        buttons: [{ v: 'timed', label: '⏱ 60-SECOND CHALLENGE', cls: 'go' }, { v: 'free', label: '∞ FREE BOUNCE<span class="note">No timer, just fun</span>' }, { v: 'hat', label: '🎩 Pick a hat' }, { v: 'back', label: '← Back' }],
      });
      if (v === 'timed') fadeTo(() => setScene(trampolineScene({ timed: true })));
      else if (v === 'free') fadeTo(() => setScene(trampolineScene({ timed: false })));
      else if (v === 'hat') { await hatPicker(); this.trampMenu(); }
      else this.menu();
    },
    update(dt) {
      this.x += dt * 70;
      this.parts.update(dt);
      if (Math.random() < 0.03) this.parts.confetti(rand(0, W), -4, 3, 0.4);
    },
    render() {
      if (save.data.done) return renderDoneTitle(this);
      const cx = this.x;
      A.sky('#6ec3ff', '#d4f0ff');
      A.drawClouds(cx);
      A.treeLine(cx, 0.3, 58, '#5aa05a', '#4a8c4c');
      for (let i = 0; i < 40; i++) {
        const img = A.neighborHouse(i % 12), x = Math.round(i * 150 - cx * 0.6);
        if (x > -120 && x < W + 20) G.drawImage(img, x, 110 - img.height + 4);
      }
      rect(0, 108, W, 12, '#7cc865');
      rect(0, 120, W, 8, '#d9d6cf'); for (let x = -(cx % 16); x < W; x += 16) rect(x, 120, 1, 8, '#bdb9b0');
      rect(0, 128, W, 5, '#6aa84f'); rect(0, 133, W, H, '#4a4d57');
      const hop = Math.max(0, Math.sin(game.t * 2.2)) * 14;
      // Isaac on his scooter, Sunny chasing
      const ix = 74, iy = 120 - (hop > 10 ? hop - 10 : 0) * 2;
      rect(ix - 8, iy - 4, 15, 2, '#2a1f33'); rect(ix - 7, iy - 4, 13, 1, '#4cb944'); rect(ix + 6, iy - 18, 2, 15, '#2a1f33'); rect(ix + 3, iy - 19, 7, 2, '#2a1f33');
      rect(ix - 8, iy - 2, 3, 2, '#2a1f33'); rect(ix + 5, iy - 2, 3, 2, '#2a1f33');
      spr(Math.floor(game.t * 3) % 3 === 0 ? SPR.isaac.kick : SPR.isaac.ride, ix - 8, iy - 28);
      spr(Math.floor(game.t * 10) % 2 ? SPR.sunny.run1 : SPR.sunny.run2, 30, 120 - 14 - Math.abs(Math.sin(game.t * 8)) * 3);
      this.parts.draw();
    },
  };
  return S;
}

function renderDoneTitle(S) {
  A.sky('#6ec3ff', '#e0f4ff');
  A.drawClouds(S.x * 0.3);
  A.treeLine(0, 0, 60, '#4f9a4c', '#3f8a3a');
  A.fenceWood(0, W, 118, 26, 0);
  rect(0, 124, W, H, '#62b34f');
  const t = (game.t * 1.3) % 1, alt = Math.sin(t * Math.PI) * 60;
  A.trampoline(128, 124, 84, t < 0.08 || t > 0.92 ? 5 : 0);
  G.save(); G.translate(128, 104 - 12 - alt);
  if (alt > 30) G.rotate(-((t - 0.25) / 0.5) * Math.PI * 2 * (Math.floor(game.t * 1.3) % 2 ? 1 : 0));
  G.drawImage(alt > 8 ? SPR.isaac.jump : SPR.isaac.walkB, -8, -12);
  drawHat(save.data.tramp.hat);
  G.restore();
  spr(SPR.sunny.stand, 40, 124 - 14);
  spr(SPR.freida.loaf, 200, 124 - 12, true);
  S.parts.draw();
}

// ---------------- pause ----------------
export async function pauseMenu() {
  if (game.paused || document.querySelector('#overlay:not([hidden])')) return;
  game.paused = true;
  const inGame = game.scene && game.scene.name !== 'title';
  const v = await menu({
    title: 'PAUSED',
    buttons: [{ v: 'resume', label: '▶ Keep playing', cls: 'go' }, ...(inGame && game.scene.name !== 'tramp' ? [{ v: 'clues', label: '📜 Clue book' }] : []), { v: 'sound', label: audio.muted ? '♪ Sound: OFF' : '♪ Sound: ON' }, ...(inGame ? [{ v: 'title', label: '⌂ Main menu' }] : [])],
  });
  game.paused = false;
  if (v === 'sound') { audio.setMuted(!audio.muted); document.getElementById('btn-mute').classList.toggle('off', audio.muted); return pauseMenu(); }
  if (v === 'title') fadeTo(() => setScene(titleScene()));
  if (v === 'clues') { game.paused = true; await clueBook(); game.paused = false; }
}

// ---------------- birthday card ----------------
export async function birthdayCard() {
  audio.play('birthdaySoft');
  const pic = offscreen(200, 90, (g) => {
    A.sky('#8fd3ff', '#fff4dc'); g.drawImage(g.canvas, 0, 0);
    rect(0, 0, 200, 90, '#bfe6ff'); rect(0, 70, 200, 20, '#62b34f');
    A.fenceWood(0, 200, 72, 20, 0);
    A.trampoline(100, 84, 84, 0);
    g.save(); g.translate(100, 40); g.drawImage(SPR.isaac.cheer, -8, -12); drawHat(save.data.tramp.hat || 'party', g); g.restore();
    spr(SPR.mom.wave, 26, 84 - 32); spr(SPR.dad.cheer, 150, 84 - 32, true);
    spr(SPR.sunny.stand, 52, 84 - 14); spr(SPR.freida.loaf, 124, 84 - 12, true);
    spr(SPR.bunny, 97, 21);
    for (let i = 0; i < 40; i++) rect((i * 37) % 200, (i * 23) % 60, 2, 2, ['#ff5d73', '#ffd23f', '#3ec1ff', '#7cff6b', '#c77dff'][i % 5]);
  });
  const url = pic.toDataURL();
  await menu({
    title: CONFIG.cardTitle, cls: 'bday',
    body: `<div class="bday-grid"><img src="${url}" alt="">
      <div class="bday-text">${CONFIG.cardBody.map((p) => `<p>${p}</p>`).join('')}
      ${(save.data.binder || []).length ? `<p>🃏 You collected <b>${save.data.binder.length} of 12</b> trading cards!</p>` : ''}
      <p class="sign">${CONFIG.cardSign}</p></div></div>`,
    buttons: [{ v: 'ok', label: '🎉 YAY! 🎉', cls: 'go' }],
  });
}
