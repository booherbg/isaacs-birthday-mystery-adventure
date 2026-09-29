// Soundtrack Explorer: every song in the game, where it plays, what inspired it, and a live piano roll of its voices.
// Unlocked after the mystery is solved (the track list gives the ending away).
import { audio, SONGS } from './audio.js';
import { overlay } from './ui.js';

export const TRACKS = [
  { id: 'title', name: 'Adventure Theme', where: "Title screen, Isaac's room, home, the new house",
    about: "The main theme. NES/SNES overworld energy (Dragon Quest, Super Mario World), plus a Commodore 64 trick: one voice flicks through a chord's notes about 36 times a second, so it shimmers like a whole chord. The second half drops the drums to half-time for a Final Fantasy-style harp arpeggio and a countermelody. That's the \"tempo change\" you hear: same speed, but the beat feels half as fast." },
  { id: 'ballgame', name: 'Take Me Out to the Ball Game', where: 'Batting with Dad at Brunsdale Fields',
    about: 'The 1908 song (public domain), played like a ballpark organ: a waltz with the chord on beats two and three.' },
  { id: 'hood', name: 'Scooter Ride', where: 'The neighborhood',
    about: 'A breezy G-major town tune over a bouncing octave bass, in the spirit of Game Boy walking music.' },
  { id: 'skate', name: 'Creeper Crew', where: 'Dike East Skate Park',
    about: 'A punchy E-minor groove with a fast thin-pulse arpeggio underneath. Mega Man stage energy.' },
  { id: 'river', name: 'Red River Trail', where: 'Biking to Lions Conservancy Park',
    about: 'Gentle, open, a little country, with slow echo. In the level, a babbling-brook layer of tiny random blips plays underneath (an idea borrowed from the RollerCoaster Tycoon clone).' },
  { id: 'pool', name: 'Island Park Pool', where: 'Island Park Pool and the Cannonball Contest',
    about: 'A sunny route tune (Pokémon routes were the model). The bridge turns into a steel-drum calypso: a plucked sine wave plus its octave, over a kick on one and the "and" of two.' },
  { id: 'battle', name: 'A Wild ___ Appeared!', where: 'Freida, the catfish, and Sunny',
    about: 'Pokémon Red/Blue wild-battle energy: fast E minor, octave-bouncing bass, busy chiptune drums. Now with C64 chord arps and a filter-swept bass, plus a bridge in a 3-3-2 rhythm with a countermelody and a tom fill back to the top.' },
  { id: 'reveal', name: "It's a...!", where: 'The big reveal', about: 'A snare roll into a two-voice fanfare.' },
  { id: 'birthday', name: 'Happy Birthday (party)', where: 'Right after the reveal', about: 'The public-domain song in 3/4, with a bouncy bass and chord stabs.' },
  { id: 'bounce', name: 'Trampoline Time', where: 'Trampoline Time (and the title screen, once the mystery is solved)',
    about: 'Bright F major over an octave-bouncing bass. The bridge climbs toward Sky Zone and ends on a big leap up to a high G.' },
  { id: 'birthdaySoft', name: 'Happy Birthday (music box)', where: 'The birthday card',
    about: "A real music-box sound. Each note is a steel tine whose overtones aren't whole multiples of the pitch (that's what makes music boxes sparkle), with a tiny click of the pin and a long echo." },
  { id: 'tonie1', name: 'Twinkle Twinkle', where: "Isaac's Toniebox (tap it once)",
    about: 'A kalimba lullaby (public domain): soft thumb-plucked notes with a buzzy overtone and a glassy ping on top.' },
  { id: 'tonie2', name: "Sunny's Bark Song", where: "Isaac's Toniebox (tap it twice)",
    about: 'An original little march on a toy piano, with tiny barks keeping the beat.' },
  { id: 'tonie3', name: 'Ball Game Boogie', where: "Isaac's Toniebox (tap it three times)",
    about: 'The ballpark song on a honky-tonk piano: two voices slightly out of tune with each other, so every note shimmers, over an oom-pah bass.' },
  { id: 'win', name: 'Victory!', where: 'After a battle or the Cannonball Contest', about: 'A quick RPG-style victory fanfare.' },
  { id: 'restitution', name: 'Restitution', where: 'Nowhere in the game. A bonus track Claude wrote in its free time',
    about: "Rhythm from physics, not a metronome. Every bounce keeps only part of its speed (the \"coefficient of restitution\"), so a dropped ball speeds up and settles: pok… pok.. pokpokbrrr. The first ball's first bounce lasts 0.8 seconds, and that's the song's tempo. Played backwards, the same ball is a kid pumping on a trampoline. In the tune, the kick lands with every bounce, the snare is a trick at the top, and the big jump's melody is its own flight path. Then it all comes back compacted, and one last jump never comes down." },
];

// Voice names + colors (shared by the legend and the piano roll).
const VOICES = {
  hero: ['Lead (pulse, detuned double)', '#ffde5c'], lead: ['Lead (pulse)', '#ffde5c'], lead2: ['Second lead', '#ffb15c'],
  harm: ['Countermelody', '#c9b6ff'], sid: ['C64 chord arp', '#ff7d98'], arp: ['Arpeggio', '#ff7d98'], chord: ['Organ chords', '#ff7d98'],
  harp: ['Harp', '#8fdcff'], bell: ['Music box', '#8fdcff'], soft: ['Soft pulse', '#8fdcff'], steel: ['Steel drum', '#8fdcff'],
  bass: ['Triangle bass', '#9fe35f'], sbass: ['Filter bass', '#9fe35f'], drum: ['Drums', '#ffffff'],
  ball: ['Bouncing balls', '#ff9f43'], bed: ['Trampoline bed', '#4fd6b0'],
  tine: ['Music-box tine', '#8fdcff'], kalimba: ['Kalimba', '#8fdcff'], toypiano: ['Toy piano', '#ffde5c'], honky: ['Honky-tonk piano', '#ffde5c'],
};
const DRUM_COLOR = { k: '#ff6a5a', s: '#ffffff', h: '#b8b0cc', o: '#d6d0e6', t: '#ffb15c', c: '#ffde5c', w: '#e0843f' };

// The now-playing details for one track (swapped in place when you pick another, so the panel never re-pops).
function details(cur, playing) {
  const t = TRACKS.find((x) => x.id === cur) || TRACKS[0], s = SONGS[t.id];
  const voices = [...new Set(s.tracks.map((tr) => tr[0]))].concat(s.drums ? ['drum'] : []);
  const secs = Math.round(Math.max(...s.tracks.map(([, str]) => str.trim().split(/\s+/).reduce((n, tok) => n + (+tok.split(':')[1] || 1), 0))) * 60 / s.bpm / (s.spb || 2));
  return {
    head: `<div class="jb-title">${playing === t.id ? '▶ ' : ''}${t.name}</div>
      <div class="jb-where">${t.where} · ${s.bpm} bpm · ${s.loop === false ? 'plays once' : `${secs}s loop`}</div>`,
    voices: voices.map((v) => `<span><i style="background:${(VOICES[v] || ['', '#fff'])[1]}"></i>${(VOICES[v] || [v])[0]}</span>`).join(''),
    about: t.about,
  };
}
function panel(cur, playing) {
  const d = details(cur, playing);
  return `<div class="menu jukebox pop">
    <h1>♪ SOUNDTRACK EXPLORER</h1>
    <div class="jb">
      <div class="jb-list">${TRACKS.map((x, i) => `<button class="jb-track${x.id === playing ? ' on' : ''}" data-v="${x.id}"><span>${String(i + 1).padStart(2, '0')}</span>${x.name}</button>`).join('')}</div>
      <div class="jb-now">
        <div class="jb-head">${d.head}</div>
        <canvas class="jb-viz" width="192" height="84" aria-label="Piano roll of the notes playing"></canvas>
        <div class="jb-voices">${d.voices}</div>
        <p class="jb-about">${d.about}</p>
      </div>
    </div>
    <div class="menu-btns jb-btns"><button class="big" data-v="stop">■ Stop</button><button class="big go" data-v="back">← Back</button></div>
  </div>`;
}

// Piano roll: notes scroll left from the "now" line; drums tick along the bottom.
function drawRoll(events) {
  const c = document.querySelector('.jb-viz');
  if (!c) return;
  const g = c.getContext('2d'), W = c.width, H = c.height, now = audio.now, NOW = W - 22, PPS = 44;
  g.fillStyle = '#1b1234'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2a1f4a'; for (let m = 36; m <= 96; m += 12) g.fillRect(0, y(m), W, 1);
  for (const e of events) {
    const x = NOW + (e.t - now) * PPS;
    if (x > W || x + e.d * PPS < 0) continue;
    const lit = e.t <= now && now < e.t + e.d;
    if (e.drum) { g.fillStyle = DRUM_COLOR[e.drum] || '#fff'; g.fillRect(Math.round(x), H - (e.drum === 'k' || e.drum === 'c' ? 5 : 3), 2, e.drum === 'k' || e.drum === 'c' ? 4 : 2); continue; }
    g.globalAlpha = lit ? 1 : 0.55;
    g.fillStyle = (VOICES[e.inst] || ['', '#fff'])[1];
    for (const f of e.f) g.fillRect(Math.round(x), y(69 + 12 * Math.log2(f / 440)), Math.max(1, Math.round(e.d * PPS) - 1), 2);
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(NOW, 0, 1, H - 7);
  function y(m) { return Math.round(H - 10 - ((m - 30) / 68) * (H - 16)); }
}

export async function soundtrackExplorer() {
  let playing = audio.song, cur = TRACKS.some((t) => t.id === playing) ? playing : 'title', raf = 0;
  const events = [];
  audio.onNote = (inst, f, t, d) => {
    events.push(inst === 'drum' ? { drum: f, t, d: 0.05 } : { inst, f, t, d });
    while (events.length && events[0].t < audio.now - 6) events.shift();
  };
  const tick = () => { drawRoll(events); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  const refresh = () => {
    const d = details(cur, playing), $ = (s) => document.querySelector(s);
    if (!$('.jb-head')) return;
    $('.jb-head').innerHTML = d.head; $('.jb-voices').innerHTML = d.voices; $('.jb-about').textContent = d.about;
    document.querySelectorAll('.jb-track').forEach((b) => b.classList.toggle('on', b.dataset.v === playing));
  };
  // Picking a song (or Stop) is handled in place; only Back closes the panel.
  const keep = (v) => {
    if (v === 'stop') { audio.stop(); playing = null; refresh(); return true; }
    if (!TRACKS.some((t) => t.id === v)) return false;
    cur = playing = v; events.length = 0;
    audio.stop();
    audio.play(v, () => { if (playing === v) { playing = null; refresh(); } });
    refresh();
    return true;
  };
  await overlay(panel(cur, playing), { cls: 'dim', keep });
  cancelAnimationFrame(raf);
  audio.onNote = null;
}
