// Web Audio chiptune synth: sound effects + a tiny step sequencer for music.
let ac = null, master, musicBus, sfxBus, echo, echoSend, noiseBuf;
const waves = {};
let muted = false;
try { muted = localStorage.getItem('ia-muted') === '1'; } catch {}

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function freq(n) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
  if (!m) return 0;
  return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
}

function pulseWave(duty) {
  const N = 32, re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    re[n] = Math.sin(2 * Math.PI * n * duty) / (Math.PI * n);
    im[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (Math.PI * n);
  }
  return ac.createPeriodicWave(re, im);
}

function init() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  ac = new AC();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
  master.connect(comp); comp.connect(ac.destination);
  musicBus = ac.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
  echo = ac.createDelay(1); echo.delayTime.value = 0.28;
  const fb = ac.createGain(); fb.gain.value = 0.32;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  echoSend = ac.createGain(); echoSend.gain.value = 0;
  echoSend.connect(echo); echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(musicBus);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  waves.p12 = pulseWave(0.125); waves.p25 = pulseWave(0.25); waves.p50 = pulseWave(0.5);
  setInterval(schedule, 25);
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else ac.resume();
  });
}

export const audio = {
  get muted() { return muted; },
  unlock() {
    if (!ac) init();
    if (ac && ac.state !== 'running') ac.resume();
  },
  setMuted(m) {
    muted = m;
    try { localStorage.setItem('ia-muted', m ? '1' : '0'); } catch {}
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.02);
  },
  sfx: (name, opt) => { if (ac && SFX[name]) try { SFX[name](ac.currentTime + 0.005, opt || {}); } catch (e) { console.warn(e); } },
  play: (name, onEnd) => playSong(name, onEnd),
  stop: () => { cur = null; },
  get song() { return cur ? cur.name : null; },
};

// ---------- building blocks ----------
function osc(type, f, t, dur, vol, { to = null, slide = 'exp', attack = 0.005, release = 0.05, dest = sfxBus, vib = 0, vibRate = 6 } = {}) {
  const o = ac.createOscillator(), g = ac.createGain();
  if (waves[type]) o.setPeriodicWave(waves[type]); else o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) {
    if (slide === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    else o.frequency.linearRampToValueAtTime(to, t + dur);
  }
  if (vib) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = vibRate; lg.gain.value = vib;
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + release + 0.05);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  if (dest === musicBus) g.connect(echoSend);
  o.start(t); o.stop(t + dur + 0.02);
  return o;
}
function noise(t, dur, vol, { type = 'bandpass', f = 1000, to = null, q = 1, dest = sfxBus, attack = 0.002, curve = 'exp' } = {}) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  else { g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
  s.connect(fl); fl.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
const arp = (t, notes, step, type = 'p25', vol = 0.18, len = null) =>
  notes.forEach((n, i) => osc(type, typeof n === 'number' ? n : freq(n), t + i * step, len || step * 1.1, vol));

// ---------- sound effects ----------
const SFX = {
  jump: (t) => osc('p25', 260, t, 0.13, 0.16, { to: 620 }),
  land: (t) => noise(t, 0.06, 0.12, { type: 'lowpass', f: 500 }),
  step: (t) => noise(t, 0.03, 0.04, { type: 'lowpass', f: 900 }),
  card: (t) => { arp(t, ['E6', 'B6'], 0.06, 'p25', 0.14); osc('sine', freq('E7'), t + 0.1, 0.25, 0.06); },
  coin: (t) => arp(t, ['B5', 'E6'], 0.06, 'p50', 0.12),
  bump: (t) => osc('p50', 140, t, 0.08, 0.14, { to: 90 }),
  blip: (t, o) => osc('p50', o.f || 600, t, 0.035, 0.05),
  select: (t) => arp(t, ['C6', 'G6'], 0.05, 'p25', 0.12),
  move: (t) => osc('p25', 880, t, 0.04, 0.07),
  bark: (t, o) => {
    const n = o.n || 2;
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.16;
      osc('sawtooth', 780, tt, 0.09, 0.11, { to: 430 });
      osc('p50', 1100, tt, 0.05, 0.05, { to: 600 });
      noise(tt, 0.05, 0.05, { f: 1800, q: 2 });
    }
  },
  meow: (t) => {
    osc('sawtooth', 520, t, 0.45, 0.07, { to: 700, slide: 'lin', vib: 18, vibRate: 7 });
    osc('sine', 700, t + 0.2, 0.3, 0.06, { to: 420 });
  },
  purr: (t) => { for (let i = 0; i < 8; i++) noise(t + i * 0.09, 0.07, 0.06, { type: 'lowpass', f: 300 }); },
  whoosh: (t) => noise(t, 0.2, 0.18, { f: 400, to: 2400, q: 1.2 }),
  crack: (t) => { noise(t, 0.08, 0.4, { type: 'highpass', f: 1500 }); osc('sine', 1200, t, 0.05, 0.2, { to: 600 }); },
  miss: (t) => osc('p50', 300, t, 0.3, 0.1, { to: 120 }),
  cheer: (t) => {
    noise(t, 1.8, 0.16, { f: 1400, q: 0.6, attack: 0.25, curve: 'lin' });
    for (let i = 0; i < 5; i++) osc('sine', 1400 + Math.random() * 800, t + 0.2 + i * 0.25, 0.3, 0.03, { to: 2400, slide: 'lin' });
  },
  clue: (t) => {
    arp(t, ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.06, 'p25', 0.12);
    arp(t + 0.02, ['C4', 'G4', 'C5'], 0.14, 'triangle', 0.2, 0.5);
    for (let i = 0; i < 6; i++) osc('sine', 2000 + i * 300, t + 0.45 + i * 0.05, 0.12, 0.04);
  },
  pop: (t) => { noise(t, 0.12, 0.3, { type: 'lowpass', f: 2500 }); osc('sine', 500, t, 0.08, 0.15, { to: 120 }); },
  horn: (t) => osc('sawtooth', 330, t, 0.45, 0.07, { to: 420, slide: 'lin', vib: 25, vibRate: 11 }),
  hiss: (t) => noise(t, 0.9, 0.1, { type: 'highpass', f: 3500, attack: 0.6, curve: 'lin' }),
  splash: (t) => { noise(t, 0.5, 0.3, { type: 'lowpass', f: 3000, to: 400 }); noise(t + 0.05, 0.3, 0.12, { type: 'highpass', f: 4000 }); },
  honk: (t) => { osc('p50', 330, t, 0.14, 0.12); osc('p50', 415, t, 0.14, 0.1); osc('p50', 330, t + 0.2, 0.14, 0.12); osc('p50', 415, t + 0.2, 0.14, 0.1); },
  goose: (t) => { osc('sawtooth', 520, t, 0.12, 0.08, { to: 380 }); osc('sawtooth', 560, t + 0.16, 0.14, 0.08, { to: 360 }); },
  rip: (t) => { for (let i = 0; i < 6; i++) noise(t + i * 0.035, 0.05, 0.14, { type: 'highpass', f: 2200 + Math.random() * 1500 }); },
  boing: (t, o) => {
    const p = o.p || 1;
    const f0 = 220 + p * 20;
    osc('sine', f0, t, 0.42, 0.3, { to: f0 * 2.6, vib: 18 + p * 2, vibRate: 16 });
    osc('triangle', f0 * 2, t, 0.2, 0.08, { to: f0 * 4 });
  },
  perfect: (t, o) => { const b = 60 + Math.min(12, o.combo || 0); arp(t, [b, b + 4, b + 7, b + 12].map((m) => 440 * Math.pow(2, (m - 57) / 12)), 0.045, 'p25', 0.12); },
  flip: (t) => noise(t, 0.25, 0.12, { f: 600, to: 3000, q: 2 }),
  bonk: (t) => { osc('p50', 200, t, 0.18, 0.18, { to: 70 }); osc('sine', 900, t + 0.12, 0.35, 0.06, { to: 500, vib: 40, vibRate: 12 }); },
  oof: (t) => { osc('p50', 240, t, 0.2, 0.16, { to: 80 }); noise(t, 0.15, 0.15, { type: 'lowpass', f: 600 }); },
  mine: (t) => { noise(t, 0.09, 0.25, { type: 'lowpass', f: 900 }); osc('p50', 110, t, 0.05, 0.1); },
  grind: (t) => noise(t, 0.25, 0.1, { f: 3000, q: 4 }),
  roll: (t) => noise(t, 0.12, 0.04, { type: 'lowpass', f: 400 }),
  reel: (t) => { for (let i = 0; i < 4; i++) osc('p12', 1400 + i * 60, t + i * 0.03, 0.02, 0.06); },
  countdown: (t) => osc('p50', 880, t, 0.12, 0.12),
  go: (t) => osc('p50', 1760, t, 0.35, 0.12),
  whistle: (t) => osc('sine', 2100, t, 0.6, 0.12, { vib: 120, vibRate: 30 }),
  record: (t) => arp(t, ['G5', 'C6', 'E6', 'G6', 'E6', 'G6'], 0.09, 'p25', 0.14),
  firework: (t) => { osc('sine', 300, t, 0.5, 0.05, { to: 1500 }); noise(t + 0.5, 0.6, 0.25, { type: 'lowpass', f: 1800 }); for (let i = 0; i < 6; i++) noise(t + 0.6 + Math.random() * 0.4, 0.04, 0.1, { type: 'highpass', f: 3000 }); },
  // Brook blip: pitch skewed low, short decay, upward sweep (after the RCT clone's water layer).
  bubble: (t) => {
    const u = Math.random(), f = 450 * Math.pow(1600 / 450, u * u), d = 0.011 * Math.pow(450 / f, 0.7) * 3;
    osc('sine', f, t + Math.random() * 0.1, d + 0.02, 0.018, { to: f * (1.3 + Math.random() * 0.6), attack: 0.001, release: d });
  },
  snareroll: (t, o) => { const n = 4 + (o.n || 1) * 3; for (let i = 0; i < n; i++) noise(t + i * 0.045, 0.04, 0.05 + i * 0.012, { type: 'highpass', f: 1500 }); },
  bell: (t) => { for (let i = 0; i < 3; i++) { osc('sine', 2350, t + i * 0.09, 0.22, 0.07); osc('sine', 3120, t + i * 0.09 + 0.01, 0.16, 0.035); } },
  worm: (t) => { for (let i = 0; i < 4; i++) osc('p25', 330 + i * 60, t + i * 0.1, 0.09, 0.1, { to: 250 + i * 60 }); },
  unlock: (t) => arp(t, ['C6', 'E6', 'G6', 'C7'], 0.07, 'p50', 0.12),
};

// ---------- music ----------
// Tracks: "note:len" tokens (len in steps, default 1), "r" = rest, "C4+E4+G4" = chord. Tracks loop independently.
function parse(str) {
  const ev = []; let step = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [n, l] = tok.split(':');
    const len = l ? +l : 1;
    if (n !== 'r') ev.push({ step, len, f: n.split('+').map(freq) });
    step += len;
  }
  return { ev, len: step };
}
const INST = {
  lead: { type: 'p25', vol: 0.16, vib: 4 },
  lead2: { type: 'p50', vol: 0.12, vib: 3 },
  soft: { type: 'p12', vol: 0.12 },
  bass: { type: 'triangle', vol: 0.34 },
  chord: { type: 'p50', vol: 0.05, short: true },
  bell: { type: 'sine', vol: 0.14 },
  arp: { type: 'p12', vol: 0.08, short: true },
};
function playNote(inst, f, t, dur, extra = 1) {
  const I = INST[inst];
  const d = I.short ? Math.min(dur, 0.12) : dur * 0.92;
  const o = osc(I.type, f, t, d, I.vol * extra, { dest: musicBus, attack: 0.008, release: Math.min(0.08, d * 0.3), vib: I.vib ? f * I.vib / 1000 : 0, vibRate: 5.5 });
  return o;
}
function drum(ch, t) {
  if (ch === 'k') { osc('sine', 150, t, 0.12, 0.5, { to: 45, dest: musicBus }); }
  else if (ch === 's') { noise(t, 0.12, 0.22, { type: 'highpass', f: 1200, dest: musicBus }); osc('triangle', 220, t, 0.05, 0.12, { to: 140, dest: musicBus }); }
  else if (ch === 'h') noise(t, 0.035, 0.08, { type: 'highpass', f: 7000, dest: musicBus });
  else if (ch === 'o') noise(t, 0.14, 0.07, { type: 'highpass', f: 6000, dest: musicBus });
}

let cur = null;
function playSong(name, onEnd) {
  if (!ac) return;
  const s = SONGS[name];
  if (!s) { cur = null; return; }
  if (cur && cur.name === name && s.loop !== false) return;
  const tracks = s.tracks.map(([inst, str, extra]) => ({ inst, extra: extra || 1, ...parse(str) }));
  for (const tr of tracks) { tr.byStep = new Map(); for (const e of tr.ev) tr.byStep.set(e.step, e); }
  const len = Math.max(...tracks.map((t) => t.len), s.drums ? s.drums.length : 0);
  cur = { name, s, tracks, len, step: 0, next: ac.currentTime + 0.06, dt: 60 / s.bpm / (s.spb || 2), onEnd };
  echoSend.gain.setTargetAtTime(s.echo || 0, ac.currentTime, 0.05);
}
function schedule() {
  if (!cur || !ac) return;
  const ahead = ac.currentTime + 0.12;
  while (cur && cur.next < ahead) {
    const { s, step } = cur;
    if (s.loop === false && step >= cur.len) {
      const cb = cur.onEnd; cur = null; cb?.(); return;
    }
    for (const tr of cur.tracks) {
      const e = tr.byStep.get(s.loop === false ? step : step % tr.len);
      if (!e) continue;
      for (const f of e.f) playNote(tr.inst, f, cur.next, e.len * cur.dt, tr.extra);
    }
    if (s.drums) { const ch = s.drums[step % s.drums.length]; if (ch !== '.') drum(ch, cur.next); }
    cur.step++; cur.next += cur.dt;
  }
}

// Helpers to write accompaniment compactly.
const rep = (str, n) => Array(n).fill(str).join(' ');
const bounce = (roots, perBar = 8) => roots.map((r) => {
  const lo = r, hi = r.replace(/\d/, (d) => +d + 1);
  return rep(`${lo} ${hi}`, perBar / 2);
}).join(' ');
const CH = {
  C: 'C4+E4+G4', G7: 'B3+D4+F4+G4', G: 'B3+D4+G4', A7: 'C#4+E4+G4+A4', Dm: 'D4+F4+A4', D7: 'D4+F#4+A4+C5',
  Am: 'A3+C4+E4', F: 'F4+A4+C5', C7: 'E4+G4+A#4+C5', E7: 'E4+G#4+B4+D5', Em: 'E4+G4+B4', D: 'D4+F#4+A4', B7: 'D#4+F#4+A4+B4',
  Bb: 'A#3+D4+F4',
};
const waltz = (chords, beat = 1) => chords.map((c) => `r:${beat} ${CH[c]}:${beat} ${CH[c]}:${beat}`).join(' ');

export const SONGS = {
  // Original "adventure" theme — title + walking levels.
  title: {
    bpm: 132, drums: 'khshkksh',
    tracks: [
      ['lead', 'C5:2 E5 G5 C6:2 G5:2 A5:3 G5 E5:2 C5:2 D5:2 F5 A5 D6:2 C6 A5 G5:6 r:2 C5:2 E5 G5 C6:2 E6:2 D6:3 C6 A5:2 F5:2 A5 B5 C6:2 B5 G5 D6:2 C6:6 r:2'],
      ['bass', bounce(['C3', 'A2', 'D3', 'G2', 'C3', 'F2', 'G2', 'C3'])],
    ],
  },
  // Take Me Out to the Ball Game (1908, public domain), 3/4, stadium-organ waltz.
  ballgame: {
    bpm: 168, spb: 1,
    tracks: [
      ['lead', 'C5:2 C6 A5 G5 E5 G5:3 D5:3 C5:2 C6 A5 G5 E5 G5:5 r A5 G#5 A5 E5 F5 G5 A5:2 F5 D5:3 A5:2 A5 A5 B5 C6 D6 B5 A5 G5:3'],
      ['bass', 'C3:3 C3:3 C3:3 G2:3 C3:3 C3:3 C3:3 C3:3 A2:3 A2:3 D3:3 D3:3 D3:3 D3:3 G2:3 G2:3'],
      ['chord', waltz(['C', 'C', 'C', 'G7', 'C', 'C', 'C', 'C', 'A7', 'A7', 'Dm', 'Dm', 'D7', 'D7', 'G7', 'G7'])],
    ],
  },
  // Neighborhood scooter ride — breezy.
  hood: {
    bpm: 150, drums: 'k.hsk.hs',
    tracks: [
      ['lead', 'D5 G5 B5:2 A5 G5 E5:2 D5:2 B4 D5 G5:4 C5 E5 G5:2 F#5 E5 C5:2 D5:6 r:2 B5 C6 D6:2 B5 G5 E5:2 C6:2 A5 F#5 D5:4 E5 F#5 G5 A5 B5:2 A5:2 G5:6 r:2'],
      ['bass', bounce(['G2', 'G2', 'C3', 'D3', 'E3', 'D3', 'D3', 'G2'])],
    ],
  },
  // Blocky skate park — punchy minor groove.
  skate: {
    bpm: 164, drums: 'k.sk.ks.',
    tracks: [
      ['lead', 'E5:2 G5:2 A5 B5:3 D6 B5 A5 G5 E5:4 E5:2 G5:2 A5 B5:3 D6:2 E6:2 D6:4 C6:2 B5:2 A5 G5:3 A5 B5 A5 G5 E5:4 D5:2 E5:2 G5 A5:3 B5:8'],
      ['bass', 'E2 E3 E2 E3 D3 E2 B2 E2 ' + rep('E2 E3 E2 E3 D3 E2 B2 E2', 1) + ' C3 C4 C3 C4 B3 C3 G3 C3 D3 D4 D3 D4 C4 D3 A3 D3 ' + rep('E2 E3 E2 E3 D3 E2 B2 E2', 2) + ' C3 C4 C3 C4 B3 C3 G3 C3 B2 B3 B2 B3 A3 B2 F#3 B2'],
      ['arp', rep('E4 B4 E5 B4', 4) + ' ' + rep('C4 G4 C5 G4', 2) + ' ' + rep('D4 A4 D5 A4', 2) + ' ' + rep('E4 B4 E5 B4', 4) + ' ' + rep('C4 G4 C5 G4', 2) + ' ' + rep('B3 F#4 B4 F#4', 2)],
    ],
  },
  // Red River trail — gentle, open, a little country.
  river: {
    bpm: 120, drums: 'k.h.s.h.', echo: 0.2,
    tracks: [
      ['lead', 'G4 A4 B4:2 D5:2 B4:2 C5 B4 A4:2 G4:4 E4 G4 A4:2 C5:2 A4:2 B4:6 r:2 G4 A4 B4:2 D5:2 G5:2 E5 D5 B4:2 A4:4 C5 B4 A4:2 D5:2 F#4:2 G4:6 r:2'],
      ['bass', 'G2:2 D3:2 G2:2 D3:2 C3:2 G3:2 G2:2 D3:2 C3:2 G3:2 A2:2 E3:2 D3:2 A3:2 D3:2 A3:2 G2:2 D3:2 E3:2 B3:2 C3:2 G3:2 D3:2 A3:2 C3:2 G3:2 D3:2 A3:2 G2:2 D3:2 G2:2 r:2'],
    ],
  },
  // Island Park Pool — sunny "route" tune.
  pool: {
    bpm: 144, drums: 'khshkhsh',
    tracks: [
      ['lead', 'C5 E5 G5:2 A5 G5 E5:2 F5 A5 C6:2 B5 A5 G5:2 E5 G5 C6:2 D6 C6 A5:2 G5:6 r:2 A5 B5 C6:2 G5 E5 C5:2 F5 G5 A5:2 D5 E5 F5:2 E5 F5 G5 A5 B5:2 D6:2 C6:6 r:2'],
      ['bass', bounce(['C3', 'F2', 'A2', 'G2', 'C3', 'F2', 'G2', 'C3'])],
      ['arp', rep('E5 G5 C6 G5', 2) + ' ' + rep('F5 A5 C6 A5', 2) + ' ' + rep('E5 A5 C6 A5', 2) + ' ' + rep('D5 G5 B5 G5', 2) + ' ' + rep('E5 G5 C6 G5', 2) + ' ' + rep('F5 A5 C6 A5', 2) + ' ' + rep('D5 G5 B5 G5', 2) + ' ' + rep('E5 G5 C6 G5', 2), 0.7],
    ],
  },
  // "A wild ___ appeared!" battle loop.
  battle: {
    bpm: 176, drums: 'khskkhsh',
    tracks: [
      ['lead', 'B4:2 E5:2 G5:2 F#5 E5 F#5:2 D5:2 B4:4 C5:2 E5:2 G5:2 A5 G5 F#5:4 D5:2 F#5:2 B5:2 G5:2 E5:2 G5 B5 A5:2 F#5:2 D5:4 C6:2 B5:2 A5:2 G5 F#5 E5:4 F#5:2 D#5:2'],
      ['bass', rep('E2 E3 E2 E3 D3 E2 B2 E2', 2) + ' C2 C3 C2 C3 B2 C2 G2 C2 D2 D3 D2 D3 C3 D2 A2 D2 ' + rep('E2 E3 E2 E3 D3 E2 B2 E2', 1) + ' D2 D3 D2 D3 C3 D2 A2 D2 C2 C3 C2 C3 B2 C2 G2 C2 B1 B2 B1 B2 A2 B1 F#2 B1'],
    ],
  },
  // Happy Birthday (public domain) — festive, with drums, 3/4 in 16th steps.
  birthday: {
    bpm: 112, spb: 4, drums: 's...k...h...',
    tracks: [
      ['lead', 'G4:3 G4 A4:4 G4:4 C5:4 B4:8 G4:3 G4 A4:4 G4:4 D5:4 C5:8 G4:3 G4 G5:4 E5:4 C5:4 B4:4 A4:4 F5:3 F5 E5:4 C5:4 D5:4 C5:8'],
      ['bass', 'r:4 C3:4 r:4 r:4 G2:4 r:4 r:4 G2:4 r:4 r:4 C3:4 r:4 r:4 C3:4 r:4 r:4 F2:4 r:4 r:4 C3:4 r:4 G2:4 C3:4 r:4'],
      ['chord', 'r:4 ' + ['C', 'G7', 'G7', 'C', 'C7', 'F', 'C'].map((c) => `r:4 ${CH[c]}:4 ${CH[c]}:4`).join(' ') + ` r:4 ${CH.C}:4`],
    ],
  },
  // Music-box Happy Birthday for the end card.
  birthdaySoft: {
    bpm: 92, spb: 4, echo: 0.3,
    tracks: [
      ['bell', 'G5:3 G5 A5:4 G5:4 C6:4 B5:8 G5:3 G5 A5:4 G5:4 D6:4 C6:8 G5:3 G5 G6:4 E6:4 C6:4 B5:4 A5:4 F6:3 F6 E6:4 C6:4 D6:4 C6:12 r:8'],
      ['soft', 'r:4 C4:12 G3:12 G3:12 C4:12 C4:12 F3:12 C4:4 G3:8 C4:12 r:8', 0.8],
    ],
  },
  // Trampoline Time — bouncy and bright.
  bounce: {
    bpm: 150, drums: 'khshkhsh',
    tracks: [
      ['lead', 'F5 A5 C6 A5 F5:2 C5:2 D5 F5 A5 F5 D5:2 A4:2 A#4 D5 F5 A#5 A5:2 G5:2 C5 E5 G5 C6 A#5:2 G5:2 F5 A5 C6 A5 F6:2 C6:2 D6 C6 A#5 A5 G5:2 F5:2 E5 F5 G5 A5 A#5 G5 E5 C5 F5:2 A5:2 F5:2 r:2'],
      ['bass', bounce(['F2', 'D2', 'A#1', 'C2', 'F2', 'A#1', 'C2', 'F2'])],
      ['arp', rep('F5 A5 C6 A5', 2) + ' ' + rep('D5 F5 A5 F5', 2) + ' ' + rep('D5 F5 A#5 F5', 2) + ' ' + rep('E5 G5 C6 G5', 2) + ' ' + rep('F5 A5 C6 A5', 2) + ' ' + rep('D5 F5 A#5 F5', 2) + ' ' + rep('E5 G5 C6 G5', 2) + ' ' + rep('F5 A5 C6 A5', 2), 0.6],
    ],
  },
  // Toniebox tunes (music box, no loop). Twinkle Twinkle is public domain; the bark song is original.
  tonie1: { bpm: 150, spb: 1, loop: false, echo: 0.25, tracks: [['bell', 'C5 C5 G5 G5 A5 A5 G5:2 F5 F5 E5 E5 D5 D5 C5:2'], ['soft', 'C4:4 F3:2 C4:2 F3:2 C4:2 G3:2 C4:2', 0.7]] },
  tonie2: { bpm: 140, spb: 1, loop: false, drums: 'k.s.', tracks: [['lead', 'G4 B4 D5 B4 G4:2 r:2 A4 C5 E5 C5 A4:2 r:2 B4 D5 G5 D5 C5 A4 F#4 A4 G4:2 r:2'], ['bass', 'G2:4 G2:4 A2:4 D3:4 G2:4 D3:2 G2:2']] },
  tonie3: { bpm: 160, spb: 1, loop: false, echo: 0.25, tracks: [['bell', 'C5:2 C6 A5 G5 E5 G5:3 D5:3 C5:2 C6 A5 G5 E5 G5:6'], ['soft', 'C4:3 C4:3 C4:3 G3:3 C4:3 C4:3 C4:6', 0.7]] },

  // Short jingles (no loop).
  win: { bpm: 180, loop: false, tracks: [['lead', 'C5 E5 G5 C6:3 G5 C6:4'], ['bass', 'C3:2 G3:2 C4:6']] },
  reveal: {
    bpm: 150, loop: false, drums: 'sssssssk...k...',
    tracks: [['lead', 'G4 C5 E5 G5 C6:2 E6:2 G6:8 r:2'], ['lead2', 'E4 G4 C5 E5 G5:2 C6:2 E6:8 r:2'], ['bass', 'C3:2 C3:2 G2:2 G2:2 C3:8 r:2']],
  },
};
