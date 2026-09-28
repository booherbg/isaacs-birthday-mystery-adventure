// Boot: sprites, input, layout, top buttons, dev shortcuts, then the title screen.
import { start, setScene, game } from './engine.js';
import { pollInput, bindTouch, onFirstGesture, onPadConnect, input } from './input.js';
import { audio } from './audio.js';
import { buildSprites } from './sprites.js';
import { layout, updateUI, toast, clueBook, ui } from './ui.js';
import { titleScene, pauseMenu } from './title.js';
import { goStage } from './levels.js';
import { trampolineScene } from './tramp.js';
import { battleScene } from './battle.js';
import { battingScene } from './batting.js';
import { save } from './save.js';

buildSprites();
window.__game = game; // debug handle

const $ = (s) => document.querySelector(s);
input.touchMode = matchMedia('(pointer: coarse)').matches;
bindTouch({ dpad: $('#dpad'), a: $('#btn-a'), b: $('#btn-b'), stage: $('#stage') });
onFirstGesture(() => audio.unlock());
// Mobile browsers only allow audio after a real tap/click; keep nudging until it's running.
addEventListener('touchend', () => audio.unlock(), { passive: true });
addEventListener('click', () => audio.unlock());
addEventListener('contextmenu', (e) => e.preventDefault());
// iOS ignores user-scalable=no: block pinch / double-tap zoom ourselves, and undo it if it slips through.
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouchEnd < 320 && !e.target.closest('#overlay')) e.preventDefault(); lastTouchEnd = now; }, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
const vp = document.querySelector('meta[name=viewport]');
window.visualViewport?.addEventListener('resize', () => {
  if (window.visualViewport.scale > 1.01) {
    vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, shrink-to-fit=no');
    setTimeout(() => { vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'); layout(); }, 60);
  }
});
onPadConnect(() => { toast('🎮 Controller connected! Press A to jump.'); layout(); });

const mute = $('#btn-mute');
mute.classList.toggle('off', audio.muted);
mute.addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.setMuted(!audio.muted); mute.classList.toggle('off', audio.muted); });
const full = $('#btn-full');
const fsOK = document.fullscreenEnabled || document.webkitFullscreenEnabled;
if (!fsOK) full.hidden = true;
full.addEventListener('click', (e) => {
  e.stopPropagation();
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
});
$('#btn-pause').addEventListener('click', (e) => { e.stopPropagation(); pauseMenu(); });
const cluesBtn = $('#btn-clues');
cluesBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (game.paused || document.querySelector('#overlay:not([hidden])')) return;
  game.paused = true; await clueBook(); game.paused = false;
});
for (const b of document.querySelectorAll('.topbtns button')) b.addEventListener('pointerdown', (e) => e.stopPropagation());

let lastTouch = null;
layout();
start({
  pre: () => {
    pollInput();
    if (input.touchMode !== lastTouch) { lastTouch = input.touchMode; layout(); }
    if (input.startPressed && game.scene?.name !== 'title') pauseMenu();
    const menuOpen = !document.getElementById('overlay').hidden;
    const playing = game.scene && game.scene.name !== 'title' && !menuOpen;
    const storyScene = playing && game.scene.name !== 'tramp';
    if (cluesBtn.hidden === storyScene) cluesBtn.hidden = !storyScene;
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn.hidden === playing) pauseBtn.hidden = !playing;
  },
  ui: updateUI,
});

// Dev shortcuts: ?stage=room|yard|hood|skate|river|pool|newhouse  ?scene=tramp|batting|freida|catfish|sunny  ?unlock
const q = new URLSearchParams(location.search);
if (q.has('unlock')) save.set({ done: true });
const scene = q.get('scene');
if (q.get('stage')) goStage(q.get('stage'));
else if (scene === 'tramp') setScene(trampolineScene({ timed: true }));
else if (scene === 'story-tramp') setScene(trampolineScene({ story: true }));
else if (scene === 'batting') setScene(battingScene());
else if (['freida', 'catfish', 'sunny'].includes(scene)) setScene(battleScene(scene));
else setScene(titleScene());
