// Boot: sprites, input, layout, top buttons, dev shortcuts, then the title screen.
import { start, setScene, game } from './engine.js';
import { pollInput, bindTouch, onFirstGesture, onPadConnect, input } from './input.js';
import { audio } from './audio.js';
import { buildSprites } from './sprites.js';
import { layout, updateUI, toast } from './ui.js';
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
for (const b of document.querySelectorAll('.topbtns button')) b.addEventListener('pointerdown', (e) => e.stopPropagation());

let lastTouch = null;
layout();
start({
  pre: () => {
    pollInput();
    if (input.touchMode !== lastTouch) { lastTouch = input.touchMode; layout(); }
    if (input.startPressed && game.scene?.name !== 'title') pauseMenu();
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
