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
  get now() { return ac ? ac.currentTime : 0; },
  // Soundtrack Explorer visualizer: called as (instrument, [freqs], startTime, duration) or ('drum', char, startTime).
  onNote: null,
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
  // Tennis-ball bounce (fetch): the membrane "bonk" of Restitution's balls, sliding down an F chord as it loses speed.
  tennis: (t, { v = 1 }) => {
    const f = freq(['F5', 'A5', 'C6', 'F6', 'A6'][Math.round(4 * Math.min(1, Math.max(0, v)))]), a = 0.06 + 0.22 * v;
    osc('sine', f, t, 0.2, a, { release: 0.17 }); osc('sine', f * 1.594, t, 0.11, a * 0.3, { release: 0.09 }); osc('sine', f * 2.136, t, 0.08, a * 0.18, { release: 0.07 });
  },
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
  // Cannonball Contest: the big one, and the belly flop.
  sploosh: (t, o) => {
    const s = o.size || 1;
    noise(t, 0.5 + s * 0.5, 0.2 + s * 0.2, { type: 'lowpass', f: 2800, to: 300 });
    noise(t + 0.06, 0.4 + s * 0.3, 0.1 + s * 0.08, { type: 'highpass', f: 3500 });
    osc('sine', 120, t, 0.25, 0.1 + s * 0.2, { to: 38 });
  },
  smack: (t) => { noise(t, 0.09, 0.5, { type: 'highpass', f: 1600 }); osc('sine', 170, t, 0.14, 0.3, { to: 55 }); noise(t + 0.05, 0.5, 0.14, { type: 'lowpass', f: 2200, to: 400 }); },
};

// ---------- music ----------
// Tracks: "note:len" tokens (len in steps, default 1), "r" = rest, "C4+E4+G4" = chord. Tracks loop independently.
// An optional third field is loudness: "C4:2:0.5" plays at half volume.
function parse(str) {
  const ev = []; let step = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [n, l, v] = tok.split(':');
    const len = l ? +l : 1;
    if (n !== 'r') ev.push({ step, len, f: n.split('+').map(freq), v: v ? +v : 1 });
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
  // Richer voices (title theme): Commodore-style chord arps + filter-swept bass, Final Fantasy-style harp + countermelody.
  hero: { type: 'p25', vol: 0.12, vib: 5, vibDelay: 0.16, dbl: ['p12', 0.05, 9] },
  harm: { type: 'p50', vol: 0.05, vib: 4, vibDelay: 0.2, attack: 0.05 },
  sid: { type: 'p25', vol: 0.045, arp: 1 / 36, decay: 0.25, sus: 0.5 },
  harp: { type: 'p12', vol: 0.065, pluck: 0.45 },
  sbass: { type: 'triangle', vol: 0.3, buzz: 0.07 },
  steel: { type: 'sine', vol: 0.2, pluck: 0.5, dbl: ['sine', 0.07, 1200] }, // steel drum: a plucked sine + its octave
  // Music boxes + toys (birthday card, Toniebox): one or two voices each, but rich overtones.
  // partials: [cents above the note, volume, decay (× pluck), wave]
  tine: { type: 'sine', vol: 0.55, pluck: 1.3, partials: [[1757, 0.19, 0.25], [2920, 0.085, 0.08]], click: 0.1 }, // music-box comb: inharmonic 2.76× + 5.4× ring
  kalimba: { type: 'sine', vol: 0.66, pluck: 0.9, attack: 0.006, partials: [[1902, 0.13, 0.2], [3078, 0.055, 0.06]] }, // thumb piano: buzzy 3×, glassy 5.9× ping
  toypiano: { type: 'p25', vol: 0.4, pluck: 0.5, partials: [[12, 0.21, 1, 'p12'], [1200, 0.17, 0.5]] },
  honky: { type: 'p50', vol: 0.28, pluck: 0.7, partials: [[16, 0.25, 1, 'p50'], [-1200, 0.19, 0.8, 'triangle']] }, // two detuned voices beat against each other
  // Struck membranes (Restitution): overtones at a drumhead's Bessel ratios (1.59×, 2.14×, 2.30×, 2.65×), so a ball
  // or the trampoline bed rings with a membrane's inharmonic "bonk" instead of a string's clean octaves.
  ball: { type: 'sine', vol: 0.95, pluck: 0.3, partials: [[807, 0.3, 0.6], [1316, 0.17, 0.4], [1440, 0.12, 0.35], [1689, 0.07, 0.3]], click: 0.05 },
  bed: { type: 'sine', vol: 0.75, pluck: 0.5, attack: 0.004, partials: [[807, 0.32, 0.45], [1316, 0.18, 0.3], [1200, 0.14, 0.25, 'triangle']] },
};
function playNote(inst, fs, t, dur, extra = 1) {
  const I = INST[inst];
  const d = I.short ? Math.min(dur, 0.12) : dur * 0.92;
  const vol = I.vol * extra;
  // SID trick: one voice flicks through the chord's notes fast enough to sound like a shimmering chord.
  if (I.arp) return voice(I.type, fs[0], t, d, vol, { steps: fs, stepT: I.arp, decay: I.decay, sus: I.sus });
  for (const f of fs) {
    const vib = I.vib ? f * I.vib / 1000 : 0;
    if (I.pluck) {
      voice(I.type, f, t, d, vol, { pluck: I.pluck, attack: I.attack || 0.003 });
      if (I.dbl) voice(I.dbl[0], f, t, d, I.dbl[1] * extra, { pluck: I.pluck * 0.6, attack: 0.003, cents: I.dbl[2] });
      for (const [cents, pv, dm, type] of I.partials || []) voice(type || 'sine', f, t, d, pv * extra, { pluck: I.pluck * dm, attack: 0.002, cents });
      if (I.click) noise(t, 0.015, I.click * extra, { type: 'highpass', f: 5000, dest: musicBus });
    }
    else if (I.buzz) { voice(I.type, f, t, d, vol); voice('p50', f, t, d, I.buzz * extra, { sweep: 1800, decay: 0.15, sus: 0.35 }); }
    else if (I.vibDelay) {
      voice(I.type, f, t, d, vol, { vib, vibDelay: I.vibDelay, attack: I.attack });
      if (I.dbl) voice(I.dbl[0], f, t, d, I.dbl[1] * extra, { vib, vibDelay: I.vibDelay, cents: I.dbl[2], attack: I.attack });
    } else osc(I.type, f, t, d, vol, { dest: musicBus, attack: 0.008, release: Math.min(0.08, d * 0.3), vib, vibRate: 5.5 });
  }
}
// One music voice with the extras the plain osc() lacks: delayed vibrato, detune, a sweeping low-pass,
// decay-to-sustain, plucks that ring past the step, and fast note-stepping for chord arps.
function voice(type, f, t, dur, vol, { attack = 0.008, release = 0.06, decay = 0, sus = 1, pluck = 0, vib = 0, vibDelay = 0, cents = 0, sweep = 0, steps = null, stepT = 0 } = {}) {
  const o = ac.createOscillator(), g = ac.createGain();
  if (waves[type]) o.setPeriodicWave(waves[type]); else o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (cents) o.detune.setValueAtTime(cents, t);
  const end = pluck ? t + attack + pluck : t + dur;
  if (steps) for (let k = 1, tt = t + stepT; tt < end; k++, tt += stepT) o.frequency.setValueAtTime(steps[k % steps.length], tt);
  if (vib) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = 5.5;
    lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + vibDelay); lg.gain.linearRampToValueAtTime(vib, t + vibDelay + 0.15);
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(end + release);
  }
  let src = o;
  if (sweep) {
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 7;
    fl.frequency.setValueAtTime(sweep, t); fl.frequency.exponentialRampToValueAtTime(Math.max(150, f * 2), t + Math.min(0.2, dur));
    o.connect(fl); src = fl;
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  if (pluck) g.gain.exponentialRampToValueAtTime(0.0001, end);
  else {
    if (decay) g.gain.setTargetAtTime(vol * sus, t + attack, decay / 3);
    g.gain.setTargetAtTime(0, Math.max(t + attack, end - release), release / 3);
  }
  src.connect(g); g.connect(musicBus); g.connect(echoSend);
  o.start(t); o.stop(end + (pluck ? 0.02 : release));
}
function drum(ch, t, g = 1) { // g: the song's drum level (drumVol)
  if (ch === 'k') { osc('sine', 150, t, 0.12, 0.5 * g, { to: 45, dest: musicBus }); }
  else if (ch === 's') { noise(t, 0.12, 0.22 * g, { type: 'highpass', f: 1200, dest: musicBus }); osc('triangle', 220, t, 0.05, 0.12 * g, { to: 140, dest: musicBus }); }
  else if (ch === 'h') noise(t, 0.035, 0.08 * g, { type: 'highpass', f: 7000, dest: musicBus });
  else if (ch === 'o') noise(t, 0.14, 0.07 * g, { type: 'highpass', f: 6000, dest: musicBus });
  else if (ch === 't') { osc('triangle', 210, t, 0.16, 0.36 * g, { to: 95, dest: musicBus }); noise(t, 0.05, 0.06 * g, { type: 'lowpass', f: 1200, dest: musicBus }); }
  else if (ch === 'c') { drum('k', t, g); noise(t, 0.9, 0.11 * g, { type: 'highpass', f: 4500, dest: musicBus }); }
  else if (ch === 'w') { osc('sawtooth', 760, t, 0.08, 0.07 * g, { to: 430, dest: musicBus }); osc('p50', 1050, t, 0.05, 0.035 * g, { to: 600, dest: musicBus }); } // a tiny "woof"
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
      playNote(tr.inst, e.f, cur.next, e.len * cur.dt, tr.extra * e.v);
      audio.onNote?.(tr.inst, e.f, cur.next, e.len * cur.dt);
    }
    if (s.drums) { const ch = s.drums[step % s.drums.length]; if (ch !== '.') { drum(ch, cur.next, s.drumVol || 1); audio.onNote?.('drum', ch, cur.next, cur.dt); } }
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
  Bb: 'A#3+D4+F4', Bm: 'B3+D4+F#4', Gm: 'G3+A#3+D4',
};
const waltz = (chords, beat = 1) => chords.map((c) => `r:${beat} ${CH[c]}:${beat} ${CH[c]}:${beat}`).join(' ');

export const SONGS = {
  // Original "adventure" theme — title, Isaac's room, home, the new house.
  // A: the hero tune over Commodore-style chord arps + a buzzy filtered bass.
  // B: a Final Fantasy-ish bridge — half-time drums, harp arpeggios, a countermelody, walking bass.
  title: {
    bpm: 132, echo: 0.14,
    drums: 'khshkksh'.repeat(7) + 'khshksss' + 'k.h.s.h.'.repeat(7) + 'k.s.ssss',
    tracks: [
      ['hero', 'C5:2 E5 G5 C6:2 G5:2 A5:3 G5 E5:2 C5:2 D5:2 F5 A5 D6:2 C6 A5 G5:6 r:2 C5:2 E5 G5 C6:2 E6:2 D6:3 C6 A5:2 F5:2 A5 B5 C6:2 B5 G5 D6:2 C6:6 r:2 ' +
        'F5:2 A5 C6:3 A5 C6 D6:2 B5 G5:3 A5 B5 C6:2 B5 G5:2 E5:2 G5 A5:6 r:2 F5:2 A5 D6:3 C6 A5 B5:2 G5 D6:3 C6 B5 C6:2 E6 D6 C6:2 A5 G5 G5:3 F5 E5 D5 B4 G4'],
      ['sid', ['C', 'Am', 'Dm', 'G', 'C', 'F', 'G', 'C'].map((c) => `${CH[c]}:3 ${CH[c]}:3 ${CH[c]}:2`).join(' ') + ' r:64'],
      ['harm', 'r:64 A4:4 C5:4 B4:4 D5:4 E5:4 B4:4 C5:4 E5:4 D5:4 F5:4 D5:4 B4:4 E5:4 C5:4 B4:4 D5:2 F5:2'],
      ['harp', 'r:64 F4 A4 C5 F5 A5 F5 C5 A4 G4 B4 D5 G5 B5 G5 D5 B4 E4 G4 B4 E5 G5 E5 B4 G4 A4 C5 E5 A5 C6 A5 E5 C5 ' +
        'D4 F4 A4 D5 F5 D5 A4 F4 G4 B4 D5 G5 B5 G5 D5 B4 C5 E5 G5 C6 A4 C5 E5 A5 G4 B4 D5 F5 G5 F5 D5 B4'],
      ['sbass', bounce(['C3', 'A2', 'D3', 'G2', 'C3', 'F2', 'G2', 'C3']) + ' ' +
        'F2:2 C3:2 F3:2 C3:2 G2:2 D3:2 G3:2 D3:2 E2:2 B2:2 E3:2 B2:2 A2:2 E3:2 A3:2 E3:2 D2:2 A2:2 D3:2 A2:2 G2:2 D3:2 G3:2 D3:2 C3:2 G2:2 A2:2 E2:2 G2:2 B2:2 D3:2 F3:2'],
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
  // Island Park Pool — sunny "route" tune; the bridge turns into a steel-drum calypso (it's the pool!).
  pool: {
    bpm: 144, echo: 0.1,
    drums: 'chshkhsh' + 'khshkhsh'.repeat(6) + 'khshkstt' + 'k.hks.h.'.repeat(7) + 'k.hkssss',
    tracks: [
      ['hero', 'C5 E5 G5:2 A5 G5 E5:2 F5 A5 C6:2 B5 A5 G5:2 E5 G5 C6:2 D6 C6 A5:2 G5:6 r:2 A5 B5 C6:2 G5 E5 C5:2 F5 G5 A5:2 D5 E5 F5:2 E5 F5 G5 A5 B5:2 D6:2 C6:6 r:2 r:64'],
      ['steel', 'r:64 A5:3 C6:3 A5:2 B5:3 D6:3 B5:2 G5 E5 G5 B5 E6:2 D6:2 C6:3 A5:3 E5:2 F5:3 A5:3 D6:2 B5 A5 G5 A5 B5:2 D6:2 E6:3 C6:3 G5:2 F5 G5 A5 B5 D6:2 B5:2'],
      ['sbass', bounce(['C3', 'F2', 'A2', 'G2', 'C3', 'F2', 'G2', 'C3']) + ' ' + bounce(['F2', 'G2', 'E2', 'A2', 'D2', 'G2', 'C3', 'G2'])],
      ['arp', rep('E5 G5 C6 G5', 2) + ' ' + rep('F5 A5 C6 A5', 2) + ' ' + rep('E5 A5 C6 A5', 2) + ' ' + rep('D5 G5 B5 G5', 2) + ' ' + rep('E5 G5 C6 G5', 2) + ' ' + rep('F5 A5 C6 A5', 2) + ' ' + rep('D5 G5 B5 G5', 2) + ' ' + rep('E5 G5 C6 G5', 2) + ' ' +
        rep('F4 A4 C5 A4', 2) + ' ' + rep('G4 B4 D5 B4', 2) + ' ' + rep('E4 G4 B4 G4', 2) + ' ' + rep('E4 A4 C5 A4', 2) + ' ' + rep('D4 F4 A4 F4', 2) + ' ' + rep('G4 B4 D5 B4', 2) + ' ' + rep('E4 G4 C5 G4', 2) + ' ' + rep('F4 G4 B4 G4', 2), 0.7],
    ],
  },
  // "A wild ___ appeared!" — fast E minor, same drums, now with Commodore chord arps and a buzzy filter bass.
  // B: a driving 3-3-2 bridge with a countermelody, then a tom fill back to the top.
  battle: {
    bpm: 176, echo: 0.1,
    drums: 'chskkhsh' + 'khskkhsh'.repeat(6) + 'khskk.tt' + 'chskkhsh' + 'khskkhsh'.repeat(5) + 'kh.kkh.k' + 'kttkttss',
    tracks: [
      ['hero', 'B4:2 E5:2 G5:2 F#5 E5 F#5:2 D5:2 B4:4 C5:2 E5:2 G5:2 A5 G5 F#5:4 D5:2 F#5:2 B5:2 G5:2 E5:2 G5 B5 A5:2 F#5:2 D5:4 C6:2 B5:2 A5:2 G5 F#5 E5:4 F#5:2 D#5:2 ' +
        'A5:3 C6:3 E6:2 D#6:3 B5:3 F#5:2 G5:2 B5:2 E6:4 D6 E6 D6 B5 A5:2 G5:2 E5:3 G5:3 C6:2 D6:3 A5:3 F#5:2 D#5 F#5 A5 B5 D#6:2 C6:2 B5:4 A5 G5 F#5 D#5'],
      ['sid', ['Em', 'Bm', 'C', 'D', 'Em', 'D', 'C', 'B7', 'Am', 'B7', 'Em', 'Em', 'C', 'D', 'B7', 'B7'].map((c) => `${CH[c]}:3 ${CH[c]}:3 ${CH[c]}:2`).join(' ')],
      ['harm', 'r:64 C5:8 D#5:8 E5:8 D5:8 E5:8 F#5:8 D#5:8 F#5:8'],
      ['sbass', rep('E2 E3 E2 E3 D3 E2 B2 E2', 2) + ' C2 C3 C2 C3 B2 C2 G2 C2 D2 D3 D2 D3 C3 D2 A2 D2 ' + rep('E2 E3 E2 E3 D3 E2 B2 E2', 1) + ' D2 D3 D2 D3 C3 D2 A2 D2 C2 C3 C2 C3 B2 C2 G2 C2 B1 B2 B1 B2 A2 B1 F#2 B1 ' +
        bounce(['A2', 'B2', 'E2', 'D2', 'C2', 'D2', 'B1', 'B1'])],
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
      ['tine', 'G5:3 G5 A5:4 G5:4 C6:4 B5:8 G5:3 G5 A5:4 G5:4 D6:4 C6:8 G5:3 G5 G6:4 E6:4 C6:4 B5:4 A5:4 F6:3 F6 E6:4 C6:4 D6:4 C6:12 r:8'],
      ['tine', 'r:4 C4:12 G3:12 G3:12 C4:12 C4:12 F3:12 C4:4 G3:8 C4:12 r:8', 0.75],
    ],
  },
  // Trampoline Time — bouncy and bright; the bridge climbs toward Sky Zone (big leap in bar 14).
  bounce: {
    bpm: 150, echo: 0.08,
    drums: 'chshkhsh' + 'khshkhsh'.repeat(6) + 'khshkstt' + 'k.hsk.hs'.repeat(3) + 'k.hskkss' + 'khshkhsh'.repeat(3) + 'ksktsstt',
    tracks: [
      ['hero', 'F5 A5 C6 A5 F5:2 C5:2 D5 F5 A5 F5 D5:2 A4:2 A#4 D5 F5 A#5 A5:2 G5:2 C5 E5 G5 C6 A#5:2 G5:2 F5 A5 C6 A5 F6:2 C6:2 D6 C6 A#5 A5 G5:2 F5:2 E5 F5 G5 A5 A#5 G5 E5 C5 F5:2 A5:2 F5:2 r:2 ' +
        'D6:3 C6 A#5:2 F5:2 E6:3 D6 C6:2 G5:2 C6:2 A5:2 E5:2 A5 C6 D6:6 r:2 A#5:3 A5 G5:2 D5:2 E5 G5 C6 E6 G6:4 F6:2 E6 D6 C6:2 A5:2 G5:2 A#5:2 E5:2 C5:2'],
      ['harm', 'r:64 F5:8 G5:8 E5:8 F5:8 D5:8 E5:8 C5:8 E5:4 G5:4'],
      ['sbass', bounce(['F2', 'D2', 'A#1', 'C2', 'F2', 'A#1', 'C2', 'F2']) + ' ' + bounce(['A#1', 'C2', 'A1', 'D2', 'G1', 'C2', 'F2', 'C2'])],
      ['arp', rep('F5 A5 C6 A5', 2) + ' ' + rep('D5 F5 A5 F5', 2) + ' ' + rep('D5 F5 A#5 F5', 2) + ' ' + rep('E5 G5 C6 G5', 2) + ' ' + rep('F5 A5 C6 A5', 2) + ' ' + rep('D5 F5 A#5 F5', 2) + ' ' + rep('E5 G5 C6 G5', 2) + ' ' + rep('F5 A5 C6 A5', 2) + ' ' +
        rep('D5 F5 A#5 F5', 2) + ' ' + rep('E5 G5 C6 G5', 2) + ' ' + rep('E5 A5 C6 A5', 2) + ' ' + rep('D5 F5 A5 F5', 2) + ' ' + rep('D5 G5 A#5 G5', 2) + ' ' + rep('E5 G5 C6 G5', 2) + ' ' + rep('F5 A5 C6 A5', 2) + ' ' + rep('E5 G5 A#5 G5', 2), 0.6],
    ],
  },
  // Toniebox tunes (music box, no loop). Twinkle Twinkle is public domain; the bark song is original.
  // Each has its own little identity: a kalimba lullaby, a toy-piano march with barks on the beat, a honky-tonk waltz.
  tonie1: { bpm: 150, spb: 1, loop: false, echo: 0.25, tracks: [['kalimba', 'C5 C5 G5 G5 A5 A5 G5:2 F5 F5 E5 E5 D5 D5 C5:2'], ['kalimba', 'C4:4 F3:2 C4:2 F3:2 C4:2 G3:2 C4:2', 0.7]] },
  tonie2: { bpm: 140, spb: 1, loop: false, echo: 0.08, drums: 'k.w.', tracks: [['toypiano', 'G4 B4 D5 B4 G4:2 r:2 A4 C5 E5 C5 A4:2 r:2 B4 D5 G5 D5 C5 A4 F#4 A4 G4:2 r:2'], ['toypiano', 'G3:4 G3:4 A3:4 D3:4 G3:4 D3:2 G3:2', 0.8]] },
  tonie3: { bpm: 160, spb: 1, loop: false, echo: 0.1, tracks: [['honky', 'C5:2 C6 A5 G5 E5 G5:3 D5:3 C5:2 C6 A5 G5 E5 G5:6'], ['honky', 'C3:3 C3:3 C3:3 G2:3 C3:3 C3:3 C3:6', 0.8], ['honky', waltz(['C', 'C', 'C', 'G7', 'C', 'C', 'C', 'C']), 0.45]] },

  // Short jingles (no loop).
  win: { bpm: 180, loop: false, tracks: [['lead', 'C5 E5 G5 C6:3 G5 C6:4'], ['bass', 'C3:2 G3:2 C4:6']] },
  reveal: {
    bpm: 150, loop: false, drums: 'sssssssk...k...',
    tracks: [['lead', 'G4 C5 E5 G5 C6:2 E6:2 G6:8 r:2'], ['lead2', 'E4 G4 C5 E5 G5:2 C6:2 E6:8 r:2'], ['bass', 'C3:2 C3:2 G2:2 G2:2 C3:8 r:2']],
  },
  restitution: restitution(),
};

// "Restitution" — a bonus track by Claude, written in seconds instead of steps (a 10 ms grid) so physics sets the rhythm.
// One idea all the way through: a bounce keeps only part of its speed (e, the coefficient of restitution), so a dropped
// ball's rhythm speeds up and settles. A trampoline gives that energy back.
// I.   Settling: balls dropped over F–Dm–Bb–C, each hit sliding down the chord as it loses height. The first ball's first
//      flight is 0.8 s, and that becomes the tempo of everything after.
// II.  Restitution: the first ball played backwards (tiny hops growing into full bounces), with the trampoline under it.
// III. The theme rides the bounce. A kick on every landing, a snare trick at the top of every jump (which puts it on the
//      backbeat), and hats clustered round the landings like springs. Each phrase pumps up and settles, and the balls keep
//      falling underneath. The float bars bounce once a bar (twice the air time is four times the height), so they're
//      half-time. The last big jump's melody is its own flight path, so the hang at the top comes out of the math; the
//      drums go silent up there, then roll faster and faster as he falls, the way a falling thing covers ground.
// IV.  The tune again, compacted to the top of each jump while the bed settles. Then one last jump, higher than any
//      before, that never comes down.
function restitution() {
  const DT = 0.01, E8 = 0.2, BOUNCE = 0.8, BAR = 1.6;
  const T = {}, D = [];
  const put = (inst, t, n, d, v = 1) => (T[inst] ||= []).push({ t, n, d, v });
  const line = (inst, str, t0, v = 1) => { // "note:eighths" tokens from t0
    let t = t0;
    for (const tok of str.trim().split(/\s+/)) { const [n, l] = tok.split(':'), d = (l ? +l : 1) * E8; if (n !== 'r') put(inst, t, n, d, v); t += d; }
  };
  const drop = (t0, ladder, e, fall, v = 1, hits = []) => { // first impact after `fall` s; each flight is e× the last
    let t = t0 + fall, flight = 2 * fall * e, speed = 1;
    while (flight > 0.02) {
      const n = ladder[Math.round((ladder.length - 1) * speed)], vv = v * (0.2 + 0.8 * speed);
      put('ball', t, n, flight, vv); hits.push({ t, n, v: vv, speed });
      t += flight; flight *= e; speed *= e;
    }
    return t;
  };

  // I. Settling: a ping-pong ball, then a tennis ball, then a basketball join in.
  const first = [];
  let t = 0.3, end;
  end = drop(t, ['F5', 'A5', 'C6', 'F6', 'A6', 'C7'], 0.8, BOUNCE / 2 / 0.8, 1, first); // first flight = one bounce
  put('harm', t + 0.5, 'F3+C4', end - t, 0.35);
  t = end + 0.4;
  end = Math.max(drop(t, ['D4', 'F4', 'A4', 'D5', 'F5', 'A5'], 0.7, 0.45), drop(t + 0.6, ['D5', 'F5', 'A5', 'D6', 'F6', 'A6'], 0.8, 0.4, 0.8));
  put('harm', t + 0.45, 'D3+A3', end - t - 0.45, 0.35);
  t = end + 0.4;
  end = Math.max(drop(t, ['Bb2', 'D3', 'F3', 'Bb3', 'D4'], 0.65, 0.6), drop(t + 0.3, ['Bb3', 'D4', 'F4', 'Bb4', 'D5', 'F5'], 0.7, 0.45, 0.85),
    drop(t + 0.55, ['D5', 'F5', 'Bb5', 'D6', 'F6', 'Bb6'], 0.8, 0.38, 0.7));
  put('harm', t + 0.6, 'Bb2+F3', end - t - 0.6, 0.35);
  t = end + 0.35;
  end = Math.max(drop(t, ['C3', 'E3', 'G3', 'C4', 'E4'], 0.65, 0.6), drop(t + 0.2, ['E4', 'G4', 'Bb4', 'C5', 'E5', 'G5'], 0.7, 0.45, 0.85),
    drop(t + 0.4, ['G5', 'Bb5', 'C6', 'E6', 'G6', 'C7'], 0.8, 0.38, 0.7));
  put('harm', t + 0.6, 'C3+G3+Bb3', end - t - 0.6, 0.35);

  // II. Restitution: the first ball backwards. The bed joins once the hops are real jumps; its last hit is the downbeat.
  const T2 = end + 0.8, last = first[first.length - 1].t;
  const TL = Math.round((T2 + last - first[0].t) / DT) * DT;
  for (const h of first) {
    const tr = T2 + last - h.t;
    put('ball', tr, h.n, 0.1, h.v);
    if (h.speed > 0.3 && h !== first[0]) put('bed', tr, 'F2', 0.3, 0.25 + 0.6 * h.speed);
  }

  // III. The theme: [chord, melody in eighths, landings (eighths into the bar)]. The top of a jump is halfway between landings.
  // The big jump (bars 14–15): each eighth's note is his height on the way up and down, launch to landing.
  const PENT = ['C5', 'D5', 'F5', 'G5', 'A5', 'C6', 'D6', 'F6'];
  const JUMP = Array.from({ length: 16 }, (_, k) => PENT[Math.round(7 * (1 - ((k - 8) / 8) ** 2))])
    .reduce((a, n) => (a.length && a[a.length - 1][0] === n ? a[a.length - 1][1]++ : a.push([n, 1]), a), [])
    .map(([n, l]) => `${n}:${l}`).join(' ');
  const THEME = [
    ['F', 'F4 A4 C5:2 C5 D5 F5:2', [0, 4]], ['Dm', 'D5 F5 A5:2 F5 A5 D6:2', [0, 4]], // pump…
    ['Bb', 'D5 F5 Bb5:2 C5 F5 A5:2', [0, 4]], ['C', 'E5 G5:3 C5 E5:3', [0, 4]], //       …and settle
    ['F', 'F4 A4 C5:2 C5 D5 F5:2', [0, 4]], ['Am', 'E5 A5 C6:2 A5 C6 E6:2', [0, 4]], // pump higher…
    ['Bb', 'F5 Bb5 D6:2 D5 F5 Bb5:2', [0, 4]], ['C7', 'E5 G5 Bb5:2 C5 E5:3', [0, 4]], // …and settle
    ['Dm', 'D5 A5 D6:4 C6 A5', [0]], ['Bb', 'D5 F5 Bb5:4 A5 F5', [0]], // float: one bounce a bar
    ['F', 'C5 F5 A5:4 G5 F5', [0]], ['C', 'E5 G5 C6:4 Bb5 G5', [0]],
    ['Gm', 'Bb4 D5 G5:2 D5 G5 Bb5:2', [0, 4]], ['C', JUMP, [0]], ['F', '', []], // wind up, launch, (in the air)
  ];
  const BASS = { F: ['F2', 'C3', 'F3'], Dm: ['D2', 'A2', 'D3'], Bb: ['Bb1', 'F2', 'Bb2'], C: ['C2', 'G2', 'C3'], Am: ['A1', 'E2', 'A2'], C7: ['C2', 'G2', 'Bb2'], Gm: ['G1', 'D2', 'G2'] };
  const BALLS = { F: ['A3', 'C4', 'F4', 'A4', 'C5'], Dm: ['A3', 'D4', 'F4', 'A4', 'D5'], Bb: ['Bb3', 'D4', 'F4', 'Bb4', 'D5'], C: ['G3', 'C4', 'E4', 'G4', 'C5'],
    Am: ['A3', 'C4', 'E4', 'A4', 'C5'], C7: ['G3', 'C4', 'E4', 'G4', 'Bb4'], Gm: ['G3', 'Bb3', 'D4', 'G4', 'Bb4'] }; // under the tune, where chords sit
  const at = (x) => TL + x * E8, chordAt = (x) => THEME[Math.min(14, Math.floor(x / 8))][0];
  const mel = [], lands = [];
  THEME.forEach(([c, m, ls], i) => {
    let x = i * 8;
    if (m) for (const tok of m.split(' ')) { const [n, l] = tok.split(':'); mel.push([x, n]); x += l ? +l : 1; }
    if (m) line('hero', m, at(i * 8));
    for (const e of ls) lands.push(i * 8 + e);
    if (i < 14) drop(at(i * 8), BALLS[c], 0.7, 0.27, 0.6); // the balls keep falling (not at the top of the big jump)
  });
  lands.push(120); // the big jump comes down on bar 16
  line('harm', 'A4:8 E5:8 D5:8 E5:4 Bb4:4 F5:8 D5:8 C5:8 E5:8 D5:8 E5:8 A5:8', at(32), 0.9);
  const sounding = (x) => mel.filter(([s]) => s <= x).pop()[1];
  const tops = [];
  for (let k = 0; k + 1 < lands.length; k++) {
    const a = lands[k], b = lands[k + 1], top = (a + b) / 2, c = chordAt(a);
    put('bed', at(a), BASS[c][0], (b - a) * E8, a % 8 ? 0.75 : 0.9);
    put('sbass', at(a), BASS[c][0], (top - a) * E8); put('sbass', at(top), BASS[chordAt(top)][2], (b - top) * E8); // root down, octave up
    tops.push({ n: sounding(top), c });
  }
  // Drums, in 16ths: kick on the landing, snare trick at the top, hats on the springs either side (a breath around the snare).
  const hit = (x, ch) => D.push([TL + x * E8 / 2, ch]);
  THEME.forEach((_, i) => {
    const b = i * 16;
    if (i < 8) for (const o of [0, 8]) { hit(b + o, 'k'); hit(b + o + 4, 's'); for (const h of [1, 2, 6, 7]) hit(b + o + h, 'h'); }
    else if (i < 12) { hit(b, i === 8 ? 'c' : 'k'); hit(b + 8, 's'); for (const h of [2, 4, 6, 10, 12, 14]) hit(b + h, 'h'); } // half-time float
    else if (i === 12) { hit(b, 'k'); hit(b + 4, 's'); hit(b + 1, 'h'); hit(b + 2, 'h'); for (let h = 8; h < 16; h++) hit(b + h, h === 8 ? 'k' : 's'); } // wind up
    else if (i === 13) { hit(b, 'c'); hit(b + 1, 'h'); } // launch… then nothing at the top
    if (i < 8 && i % 2) hit(b + 15, 'o'); // lift into the next phrase bar
  });
  for (const k of [12, 13, 14]) hit(7 * 16 + k, 't'); // tom fill into the float
  for (let k = 1; k < 8; k++) D.push([at(112) + BAR * Math.sqrt(k / 8), 's']); // the fall: same drop between hits, so they crowd in
  hit(240, 'c'); // the biggest landing

  // IV. Compacted: just the top of each jump, in order, while the bed settles (each bounce 0.87× the last).
  t = at(120);
  let Q = BOUNCE;
  for (const p of tops) {
    put('bed', t, BASS[p.c][0], Q, 0.35 + 0.5 * Q / BOUNCE);
    put('tine', t + Q / 2, p.n, Q, 0.55 + 0.45 * Q / BOUNCE);
    t += Q; Q *= 0.87;
  }
  for (; Q > 0.02; Q *= 0.87) { put('bed', t, 'F2', Q, 0.35 + 0.5 * Q / BOUNCE); t += Q; }

  // …and one last jump. Its top is 2 s up (the big jump's was 1.6), a step past the tune's highest note, and it never lands.
  t += 1.2;
  put('bed', t, 'F2', BOUNCE, 0.7); put('tine', t, 'F4+A4+C5', BOUNCE, 0.5); put('harm', t, 'F3+C4', 5, 0.35);
  put('tine', t + 2, 'G6', 3, 1);
  const steps = Math.round((t + 5.2) / DT);

  // Seconds → tokens on the 10 ms grid (simultaneous notes merge into a chord).
  const tracks = Object.entries(T).map(([inst, evs]) => {
    evs.sort((a, b) => a.t - b.t);
    const out = []; let step = 0;
    for (let i = 0; i < evs.length; i++) {
      const s = Math.round(evs[i].t / DT), notes = [evs[i].n];
      if (s < step) continue;
      while (i + 1 < evs.length && Math.round(evs[i + 1].t / DT) === s) notes.push(evs[++i].n);
      if (s > step) out.push(`r:${s - step}`);
      const next = i + 1 < evs.length ? Math.round(evs[i + 1].t / DT) : Infinity;
      const len = Math.max(1, Math.min(Math.round(evs[i].d / DT), next - s));
      out.push(`${notes.join('+')}:${len}:${evs[i].v.toFixed(2)}`);
      step = s + len;
    }
    return [inst, out.join(' ')];
  });
  const drums = Array(steps).fill('.');
  for (const [dt, ch] of D) drums[Math.round(dt / DT)] = ch;
  return { bpm: 150, spb: 40, loop: false, echo: 0.2, drumVol: 1.5, drums: drums.join(''), tracks };
}
