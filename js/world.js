// Side-scrolling level runtime: player physics (walk / scooter / skate / bike), Sunny, NPCs,
// solids, one-way platforms, kicker ramps, bouncers, collectibles, triggers and camera.
import { W, H, G, game, rect, spr, sprRot, clamp, lerp, rand, pick, Particles, Pops, pixelText, textWidth, wait, until } from './engine.js';
import { SPR } from './sprites.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { ui, padLabel, toast } from './ui.js';
import { drawCard } from './cards.js';

const MODES = {
  walk: { acc: 700, max: 82, fric: 1000, air: 500, jump: 292, grav: 830 },
  scooter: { acc: 320, max: 128, fric: 160, air: 260, jump: 300, grav: 830 },
  skate: { acc: 260, max: 140, fric: 60, air: 200, jump: 305, grav: 820, auto: 108 },
  bike: { acc: 300, max: 132, fric: 140, air: 240, jump: 295, grav: 830 },
};

export class World {
  constructor(L) {
    this.L = L;
    this.width = L.width;
    this.ground = L.ground ?? 120;
    this.solids = (L.solids || []).map(([x, w, h, style]) => ({ x0: x, x1: x + w, top: this.ground - h, style }));
    this.props = (L.props || []).map(([x, w, h, style]) => ({ x0: x, x1: x + w, top: this.ground - h, style })); // scenery only, never blocks
    this.plats = (L.plats || []).map(([x, y, w, style]) => ({ x0: x, x1: x + w, y, style }));
    this.ramps = (L.ramps || []).map(([x, w, h, style, dir = 1]) => ({ x0: x, x1: x + w, h, style, dir }));
    this.bouncers = (L.bouncers || []).map(([x, y, w, power, style]) => ({ x0: x, x1: x + w, y, power, style, squish: 0 }));
    this.rails = (L.rails || []).map(([x, y, w]) => ({ x0: x, x1: x + w, y }));
    this.items = (L.items || []).map(([x, y]) => ({ x, y, got: false, t: Math.random() * 6 }));
    this.itemKind = L.item || 'card';
    this.got = 0;
    this.triggers = (L.triggers || []).map((t) => ({ ...t, fired: false }));
    this.npcs = {};
    this.parts = new Particles();
    this.pops = new Pops();
    this.cam = { x: 0, y: 0 };
    this.mode = L.mode || 'walk';
    this.p = { x: L.startX ?? 40, y: this.ground, vx: 0, vy: 0, face: 1, onGround: true, coyote: 0, jumpBuf: 0, anim: 0, air: 0,
      flip: 0, flipT: 0, spin: 0, spinT: 0, tricks: [], bail: 0, grind: null, hidden: false, pose: null };
    this.dog = L.noDog ? null : { x: this.p.x - 24, y: this.ground, vx: 0, vy: 0, face: 1, onGround: true, anim: 0, hidden: false, pose: null, lead: false };
    this.locked = false;
    this.auto = null; // scripted movement target for player
    this.score = 0; // skate trick score
    this.onTrick = null;
    this.inter = (L.inter || []).map((o) => ({ r: 16, ...o, uses: 0 }));
    this.near = null;
    this.baseLabel = (L.padLabels && L.padLabels.a) || 'JUMP';
  }

  // ---------------- scripting helpers ----------------
  npc(id, sprites, x, opts = {}) {
    const n = { id, s: sprites, x, y: opts.y ?? this.ground, face: opts.face ?? -1, pose: opts.pose || 'idle', hidden: !!opts.hidden, anim: 0, vx: 0, vy: 0, hop: 0, walkTo: null };
    this.npcs[id] = n;
    return n;
  }
  walkTo(ent, x, speed = 70) {
    ent.walkTo = { x, speed };
    return until(() => !ent.walkTo);
  }
  playerTo(x, speed = 70) {
    this.auto = { x, speed };
    return until(() => !this.auto);
  }
  hop(ent, v = 150) { ent.vy = -v; ent.hop = 1; }

  // ---------------- collision ----------------
  rampY(r, x) { const t = (x - r.x0) / (r.x1 - r.x0); return this.ground - r.h * (r.dir > 0 ? t : 1 - t); }
  floorAt(x, feet, falling) {
    // Highest surface under x that the feet are at/over (for landing).
    let best = this.ground;
    for (const r of this.ramps) if (x >= r.x0 && x <= r.x1) { const y = this.rampY(r, x); if (feet <= y + 5) best = Math.min(best, y); }
    return best;
  }
  moveBody(b, dt, hw, hh, opts = {}) {
    const prevFeet = b.y;
    // horizontal
    b.x += b.vx * dt;
    b.x = clamp(b.x, 8, this.width - 8);
    for (const s of this.solids) {
      if (b.x + hw > s.x0 && b.x - hw < s.x1 && b.y > s.top + 1 && b.y - hh < this.ground) {
        if (b.vx > 0 || (b.vx === 0 && b.x < (s.x0 + s.x1) / 2)) b.x = s.x0 - hw; else b.x = s.x1 + hw;
        b.vx = 0; b.blocked = true;
      }
    }
    for (const r of this.ramps) {
      // tall end of a ramp acts like a wall from below
      if (b.x > r.x0 && b.x < r.x1 && b.y > this.rampY(r, b.x) + 6) {
        if (r.dir > 0) b.x = Math.max(b.x, r.x1 + hw); else b.x = Math.min(b.x, r.x0 - hw);
        b.vx = 0;
      }
    }
    // vertical
    b.vy += (opts.grav ?? 830) * dt;
    b.vy = Math.min(b.vy, 520);
    b.y += b.vy * dt;
    const was = b.onGround;
    b.onGround = false; b.onRamp = null; b.onRail = null;
    if (b.vy >= 0) {
      let land = this.ground;
      for (const s of this.solids) if (b.x + hw - 2 > s.x0 && b.x - hw + 2 < s.x1 && prevFeet <= s.top + 1 && b.y >= s.top) land = Math.min(land, s.top);
      for (const p of this.plats) if (b.x > p.x0 - 2 && b.x < p.x1 + 2 && prevFeet <= p.y + 1 && b.y >= p.y) land = Math.min(land, p.y);
      if (opts.rails) for (const r of this.rails) if (b.x > r.x0 && b.x < r.x1 && prevFeet <= r.y + 2 && b.y >= r.y) { land = Math.min(land, r.y); b.onRail = r; }
      for (const r of this.ramps) if (b.x >= r.x0 && b.x <= r.x1) {
        const y = this.rampY(r, b.x);
        const snap = was ? 6 : 1;
        if (prevFeet <= y + snap && b.y >= y - (was ? 4 : 0)) { if (y < land || land === this.ground) { land = Math.min(land, y); b.onRamp = r; } }
      }
      if (opts.bouncers) for (const u of this.bouncers) if (b.x > u.x0 && b.x < u.x1 && prevFeet <= u.y + 1 && b.y >= u.y) { b.y = u.y; b.vy = -u.power; u.squish = 1; b.bounced = u; return; }
      if (b.y >= land) {
        if (b.onRail && land !== b.onRail.y) b.onRail = null;
        b.y = land; b.vy = 0; b.onGround = true;
      }
    } else {
      // bonk head on solids
      for (const s of this.solids) if (b.x + hw > s.x0 && b.x - hw < s.x1 && b.y - hh < this.ground && b.y - hh > s.top && prevFeet - hh >= this.ground) b.vy = 0;
    }
    b.justLanded = b.onGround && !was;
  }

  // ---------------- update ----------------
  update(dt) {
    const p = this.p, m = MODES[this.mode];
    const control = !this.locked && !ui.busy && !this.auto && !p.bail;
    let dir = 0;
    if (this.auto) {
      const dx = this.auto.x - p.x;
      if (Math.abs(dx) < 2) { p.vx = 0; this.auto = null; } else { dir = Math.sign(dx); p.vx = dir * Math.min(this.auto.speed, Math.abs(dx) * 8); p.face = dir; }
    } else if (control) {
      dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    }

    if (!this.auto) {
      if (m.auto && !this.locked && !ui.busy) {
        // Skate: roll forward on its own; left/right just slow down / speed up.
        const target = m.auto * (dir > 0 ? 1.3 : dir < 0 ? 0.55 : 1);
        p.vx = lerp(p.vx, target, Math.min(1, dt * (p.onGround ? 2.2 : 0.6)));
        p.face = 1;
      } else if (dir) {
        const a = p.onGround ? m.acc : m.air;
        p.vx = clamp(p.vx + dir * a * dt * (Math.sign(p.vx) !== dir ? 2 : 1), -m.max, m.max);
        p.face = dir;
      } else {
        const f = (p.onGround ? m.fric : m.fric * 0.3) * dt;
        p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
      }
    }
    if (p.bail) { p.bail -= dt; p.vx *= 0.9; if (p.bail <= 0) p.bail = 0; }

    // hidden interactions: stand next to something fun and press A
    this.near = null;
    if (!this.locked) for (const it of this.inter) if (!it.hidden && Math.abs(p.x - it.x) < it.r && p.onGround && Math.abs(p.y - (it.floor ?? this.ground)) < 6) this.near = it;
    const wantLabel = this.near && !ui.busy ? this.near.label : this.baseLabel;
    if (wantLabel !== this.lastLabel) { this.lastLabel = wantLabel; padLabel(wantLabel); }
    let used = false;
    if (control && this.near && input.aPressed && Math.abs(p.vx) < 40) {
      used = true; this.near.uses++; p.vx = 0;
      this.near.fn(this, this.near);
    }
    // jump (buffered + coyote time: forgiving for small hands)
    p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    if (control && !used && (input.aPressed || (this.mode === 'walk' && input.upPressed))) p.jumpBuf = 0.13;
    p.coyote = p.onGround ? 0.1 : Math.max(0, p.coyote - dt);
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = -m.jump; p.onGround = false; p.coyote = 0; p.jumpBuf = 0; p.grind = null;
      audio.sfx('jump');
    } else if (control && !p.onGround && this.mode === 'skate' && p.air > 0.06) {
      // Board tricks: JUMP = kickflip, ◀+JUMP = heelflip, ▶+JUMP = tre flip; SPIN = 360 (x2 = 720); hold ▼ = grab → superman
      if (input.aPressed && p.flipT <= 0 && !p.grabT) {
        const kind = input.left ? 'HEELFLIP' : input.right ? 'TRE FLIP' : 'KICKFLIP';
        p.flipKind = kind; p.flipDur = kind === 'TRE FLIP' ? 0.5 : 0.42; p.flipT = p.flipDur;
        p.tricks.push(kind); audio.sfx('flip');
      }
      if (input.bPressed && p.spinT <= 0) { p.spinT = 0.5; p.tricks.push('360'); audio.sfx('whoosh'); }
      if (input.down && p.flipT <= 0) {
        p.grabT = (p.grabT || 0) + dt;
        if (p.grabT >= 0.12 && !p.tricks.includes('INDY GRAB') && !p.tricks.includes('SUPERMAN')) { p.tricks.push('INDY GRAB'); audio.sfx('select'); }
        if (p.grabT >= 0.55 && p.tricks.includes('INDY GRAB')) { p.tricks[p.tricks.indexOf('INDY GRAB')] = 'SUPERMAN'; audio.sfx('unlock'); }
      } else p.grabT = 0;
    }
    if (!input.a && p.vy < -120 && this.mode === 'walk') p.vy += 1400 * dt; // short hop on release

    const wasAir = !p.onGround;
    const vxBefore = p.vx;
    const onRampBefore = p.onRamp;
    p.bounced = null;
    this.moveBody(p, dt, 5, 22, { grav: m.grav, bouncers: true, rails: this.mode === 'skate' });
    if (p.bounced) { audio.sfx('boing', { p: 3 }); this.parts.sparkle(p.x, p.y, 5); }

    // launch off the top of a kicker ramp when riding
    if (this.mode !== 'walk' && onRampBefore && !p.onRamp && p.onGround === false && p.vy >= 0) {
      const r = onRampBefore;
      const leaving = r.dir > 0 ? p.x >= r.x1 - 1 && vxBefore > 30 : p.x <= r.x0 + 1 && vxBefore < -30;
      if (leaving) { p.vy = -Math.min(330, 120 + Math.abs(vxBefore) * 1.25 + r.h * 1.5); audio.sfx('whoosh'); this.parts.burst(p.x, p.y, 4, { colors: ['#fff', '#ddd'], speed: 30 }); }
    }
    if (this.mode !== 'walk' && p.onRamp && p.onRamp.dir > 0 && vxBefore > 0) {
      // keep momentum going up ramps
      p.vx = Math.max(p.vx, vxBefore * 0.995);
    }

    // tricks resolve on landing
    if (p.flipT > 0) p.flipT -= dt;
    if (p.spinT > 0) p.spinT -= dt;
    if (!p.onGround) p.air += dt; else p.air = 0;
    if (p.onGround && wasAir) {
      audio.sfx('land');
      if (p.tricks.length) {
        if (p.flipT > 0.08 || p.spinT > 0.1) {
          p.bail = 0.6; p.tricks = []; p.grabT = 0; audio.sfx('bonk'); this.pops.add('BAIL!', p.x, p.y - 34, '#ff8a80');
          this.onTrick?.(null);
        } else {
          const spins = p.tricks.filter((t) => t === '360').length;
          const list = p.tricks.filter((t) => t !== '360');
          if (spins) list.push(spins > 1 ? spins * 360 + '' : '360');
          const VAL = { KICKFLIP: 100, HEELFLIP: 120, 'TRE FLIP': 200, 'INDY GRAB': 100, SUPERMAN: 250, 360: 150, 720: 350, 1080: 600 };
          const n = list.length;
          const pts = list.reduce((s, t) => s + (VAL[t] || 150), 0) * n;
          const name = n > 2 ? 'SICK COMBO x' + n + '!' : list.join(' + ');
          this.score += pts; this.trickCount = (this.trickCount || 0) + 1;
          this.pops.add(name, p.x, p.y - 38, '#ffde5c');
          this.pops.add('+' + pts, p.x, p.y - 30, '#fff');
          if (pts >= 250) { this.pops.add(pick(['SSSSICK!', 'SSSUPER!', 'SSSWEET!']), p.x + 26, p.y - 50, '#9fe35f'); audio.sfx('hiss'); }
          audio.sfx('perfect', { combo: n * 2 });
          this.parts.sparkle(p.x, p.y - 10, 10);
          this.onTrick?.(pts, name);
        }
        p.tricks = []; p.flipT = 0; p.spinT = 0; p.grabT = 0;
      }
    }
    // grinding rails
    if (p.onRail && this.mode === 'skate') {
      if (!p.grind) { p.grind = p.onRail; audio.sfx('grind'); }
      p.grindT = (p.grindT || 0) + dt;
      if (game.frame % 3 === 0) this.parts.burst(p.x - 4, p.y, 2, { colors: ['#ffd23f', '#fff'], speed: 40, life: 0.3 });
      if (game.frame % 12 === 0) { this.score += 10; audio.sfx('grind'); }
    } else if (p.grind) {
      const pts = Math.round((p.grindT || 0) * 60) + 50;
      this.score += pts; this.pops.add('GRIND +' + pts, p.x, p.y - 34, '#9fe35f'); this.onTrick?.(pts, 'GRIND');
      p.grind = null; p.grindT = 0;
    }

    p.anim += dt * (Math.abs(p.vx) > 5 ? Math.abs(p.vx) / 12 : 2);
    if (p.onGround && Math.abs(p.vx) > 20 && this.mode !== 'walk' && game.frame % 20 === 0) audio.sfx('roll');

    // collectibles
    for (const it of this.items) {
      it.t += dt;
      if (it.got) continue;
      const dx = it.x - p.x, dy = it.y - (p.y - 12);
      if (dx * dx + dy * dy < 13 * 13) {
        it.got = true; this.got++;
        audio.sfx(this.itemKind === 'card' ? 'card' : 'coin');
        this.parts.sparkle(it.x, it.y, 8);
        if (this.itemKind === 'card') {
          const { card, isNew, complete } = drawCard();
          if (complete) setTimeout(() => toast('🏆 BINDER COMPLETE! You unlocked the CARD COLLECTOR CAP for Trampoline Time!', 4500), 1900);
          this.pops.add(card.name + ' CARD!', it.x, it.y - 14, isNew ? '#ffde5c' : '#fff');
          if (isNew && card.id === 'sunny') toast('🃏 A TRADING CARD! Collect them all for your Card Binder (📜 button)', 4200);
          else if (isNew) toast(`🃏 New card for your binder: ${card.name}!`, 1800);
        } else if (this.itemKind === 'diamond' && this.mode === 'skate') {
          this.score += 50; this.pops.add('+50', it.x, it.y - 14, '#8fe8ff');
        }
        this.pops.add(this.got + '/' + this.items.length, it.x, it.y - 6, '#fff');
        if (this.got === this.items.length) { audio.sfx('record'); this.pops.add('FULL SET!', p.x, p.y - 44, '#ffde5c', 1, 1.6); this.parts.confetti(p.x, p.y - 20, 30); }
      }
    }
    // triggers
    for (const t of this.triggers) if (!t.fired && p.x >= t.x) { t.fired = true; t.fn?.(this); }

    this.updateDog(dt);
    for (const n of Object.values(this.npcs)) this.updateNpc(n, dt);
    for (const u of this.bouncers) u.squish = Math.max(0, u.squish - dt * 4);
    this.parts.update(dt); this.pops.update(dt);

    // camera
    const look = this.mode === 'walk' ? 18 : 40;
    const tx = clamp(p.x - W * 0.42 + p.face * look, 0, this.width - W);
    this.cam.x = lerp(this.cam.x, tx, Math.min(1, dt * 5));
    this.cam.x = clamp(this.cam.x, 0, this.width - W);
    const ty = Math.min(0, p.y - 60);
    this.cam.y = lerp(this.cam.y, ty, Math.min(1, dt * 4));
  }

  updateDog(dt) {
    const d = this.dog, p = this.p;
    if (!d || d.hidden) return;
    if (d.walkTo) {
      const dx = d.walkTo.x - d.x;
      if (Math.abs(dx) < 2) { d.walkTo = null; d.vx = 0; } else { d.vx = Math.sign(dx) * d.walkTo.speed; d.face = Math.sign(dx); }
    } else if (d.lead && !d.stay) {
      // Scout mode: trot a little ahead of Isaac toward d.lead.x, and when he dawdles, do the classic
      // dog "come ON, this way!" — hop, bark at the goal, look back at him.
      const goal = Math.min(d.lead.x, p.x + 84), dx = goal - d.x;
      if (Math.abs(dx) > 6) { d.vx = clamp(dx * 3, -150, 150); d.face = Math.sign(dx); d.nag = 0; }
      else {
        d.vx *= 0.8;
        d.nag = (d.nag || 0) + dt;
        if (d.onGround) d.face = d.nag < 0.8 ? 1 : p.x < d.x ? -1 : 1;
        if (d.nag > 1.9 && d.onGround && !this.locked && !ui.busy && p.vx < 10) {
          d.nag = 0; d.vy = -170; d.onGround = false; d.face = 1;
          audio.sfx('bark', { n: 1 }); this.pops.add(d.lead.say || 'ARF!', d.x + 6, d.y - 20, '#fff');
        }
      }
    } else if (!d.stay) {
      const tx = p.x - 22 * p.face;
      const dx = tx - d.x;
      const sp = Math.max(90, Math.abs(p.vx) + 30);
      if (Math.abs(dx) > 6) { d.vx = clamp(dx * 4, -sp, sp); d.face = Math.sign(d.vx) || d.face; } else { d.vx *= 0.8; d.face = p.x > d.x ? 1 : -1; }
      if (Math.abs(p.x - d.x) > 170) { d.x = p.x - 150 * p.face; d.y = this.ground; d.vy = 0; }
      // hop over things / up to Isaac
      if (d.onGround) {
        const ahead = d.x + d.face * 12;
        const blocked = this.solids.some((s) => ahead > s.x0 && ahead < s.x1 && s.top < d.y - 2) || d.blocked;
        if (blocked || (p.y < d.y - 18 && Math.abs(p.x - d.x) < 50)) { d.vy = -290; d.onGround = false; }
      }
    }
    d.blocked = false;
    this.moveBody(d, dt, 7, 12, { grav: 830, bouncers: true });
    d.anim += dt * (Math.abs(d.vx) > 5 ? 12 : 0);
  }

  updateNpc(n, dt) {
    if (n.walkTo) {
      const dx = n.walkTo.x - n.x;
      if (Math.abs(dx) < 2) { n.walkTo = null; n.vx = 0; } else { n.vx = Math.sign(dx) * n.walkTo.speed; n.face = Math.sign(dx); }
      n.x += n.vx * dt; n.anim += dt * 8;
    }
    if (n.hop || n.vy) {
      n.vy += 830 * dt; n.y += n.vy * dt;
      if (n.y >= (n.baseY ?? this.ground)) { n.y = n.baseY ?? this.ground; n.vy = 0; n.hop = 0; }
    }
  }

  // ---------------- drawing ----------------
  render() {
    const L = this.L, cx = Math.round(this.cam.x), cy = Math.round(this.cam.y);
    L.bg?.(cx, cy, this);
    G.save(); G.translate(0, -cy);
    L.drawGround?.(cx, this);
    for (const r of this.ramps) L.drawRamp ? L.drawRamp(r, cx, this) : this.drawRamp(r, cx);
    for (const s of this.props) L.drawSolid?.(s, cx, this);
    for (const s of this.solids) L.drawSolid ? L.drawSolid(s, cx, this) : rect(s.x0 - cx, s.top, s.x1 - s.x0, this.ground - s.top, '#8a6a4a');
    for (const p of this.plats) L.drawPlat ? L.drawPlat(p, cx, this) : rect(p.x0 - cx, p.y, p.x1 - p.x0, 3, '#c98f55');
    for (const r of this.rails) { rect(r.x0 - cx, r.y, r.x1 - r.x0, 2, '#d6dbe8'); for (let x = r.x0 + 4; x < r.x1; x += 24) rect(x - cx, r.y + 2, 2, this.ground - r.y - 2, '#9aa3b8'); }
    for (const u of this.bouncers) L.drawBouncer?.(u, cx, this);
    L.mid?.(cx, this);
    // items
    const img = SPR[this.itemKind];
    for (const it of this.items) {
      if (it.got) continue;
      const bob = Math.sin(it.t * 3) * 2;
      if (this.itemKind === 'card') {
        const sq = Math.abs(Math.cos(it.t * 2));
        sprRot(img, it.x - cx, it.y + bob, 0, false, 1);
        if (sq < 0.25) rect(it.x - cx - 1, it.y + bob - 4, 1, 8, '#fff');
      } else spr(img, it.x - cx - img.width / 2, it.y + bob - img.height / 2);
    }
    for (const it of this.inter) {
      if (it.hidden) continue;
      const near = this.near === it, d = Math.abs(this.p.x - it.x);
      const bx = Math.round((it.px ?? it.x) - cx), by = Math.round(it.y - 6 + Math.sin(game.t * 4) * 1.5);
      if (near) {
        const tw = textWidth(it.label) + 6;
        rect(bx - tw / 2 - 1, by - 11, tw + 2, 10, '#2a1f33'); rect(bx - tw / 2, by - 10, tw, 8, '#fffbea');
        pixelText(it.label, bx - tw / 2 + 3, by - 8, '#2a1f33');
        rect(bx - 1, by - 1, 3, 1, '#2a1f33'); rect(bx, by, 1, 1, '#2a1f33');
      } else if (d < 70 && !it.uses) {
        rect(bx - 1, by - 8, 3, 7, '#2a1f33'); rect(bx, by - 7, 1, 4, '#ffde5c'); rect(bx, by - 2, 1, 1, '#ffde5c');
      }
    }
    for (const n of Object.values(this.npcs)) if (!n.hidden) this.drawNpc(n, cx);
    if (this.dog && !this.dog.hidden) this.drawDog(this.dog, cx);
    if (!this.p.hidden) this.drawPlayer(cx);
    L.fg?.(cx, this);
    this.parts.draw(cx, 0);
    this.pops.draw(cx, 0);
    G.restore();
    L.overlay?.(cx, this);
  }

  drawRamp(r, cx) {
    for (let x = r.x0; x < r.x1; x++) {
      const y = Math.round(this.rampY(r, x + 0.5));
      rect(x - cx, y, 1, this.ground - y, '#e8752a');
      rect(x - cx, y, 1, 2, '#ffb15c');
    }
  }

  drawNpc(n, cx) {
    let img = n.s[n.pose] || n.s.idle;
    if (n.walkTo && n.s.walk) img = Math.floor(n.anim) % 2 ? n.s.walk : n.s.idle;
    const bob = n.walkTo ? 0 : Math.round(Math.sin(game.t * 2 + n.x) * 0.6);
    spr(img, n.x - cx - img.width / 2, n.y - img.height + bob, n.face < 0);
  }

  drawDog(d, cx) {
    const S = SPR.sunny;
    let img = S.stand;
    if (d.pose) img = S[d.pose];
    else if (!d.onGround) img = S.run1;
    else if (Math.abs(d.vx) > 8) img = Math.floor(d.anim) % 2 ? S.run1 : S.run2;
    spr(img, d.x - cx - img.width / 2, d.y - img.height, d.face < 0);
  }

  drawPlayer(cx) {
    const p = this.p, S = SPR.isaac;
    const x = Math.round(p.x - cx), y = Math.round(p.y);
    const f = p.face < 0;
    if (p.pose === 'worm') { p.wormT = (p.wormT || 0) + 1 / 60; drawWorm(x, y, p.wormT, f); return; }
    if (p.pose && S[p.pose]) { spr(S[p.pose], x - 8, y - 24, f); return; }
    const moving = Math.abs(p.vx) > 8;
    if (this.mode === 'walk') {
      let img = S.idle;
      if (!p.onGround) img = S.jump;
      else if (moving) img = [S.walkA, S.idle, S.walkB, S.idle][Math.floor(p.anim / 1.6) % 4];
      if (this.pack !== false) drawPack(x, y, f, p.anim, p);
      spr(img, x - 8, y - 24, f);
      return;
    }
    if (p.bail > 0) {
      sprRot(S.tuck, x, y - 8, (0.6 - p.bail) * 14 * p.face, f);
      return;
    }
    const lift = this.mode === 'bike' ? 0 : 4;
    const spin = p.spinT > 0 ? (1 - p.spinT / 0.5) * Math.PI * 2 : 0;
    const flipping = p.flipT > 0;
    // vehicle
    const vx = x, vy = y;
    const tilt = p.onRamp ? -Math.atan2(p.onRamp.h, p.onRamp.x1 - p.onRamp.x0) * p.onRamp.dir : !p.onGround ? clamp(-p.vy / 900, -0.3, 0.3) * p.face : 0;
    G.save();
    G.translate(vx, vy);
    G.rotate(tilt);
    if (spin) G.scale(Math.cos(spin) || 0.01, 1);
    if (this.mode === 'scooter') drawScooter(0, 0, f, p.anim);
    else if (this.mode === 'skate') drawBoard(0, p.grabT > 0.12 ? -6 : 0, flipping ? p.flipT / (p.flipDur || 0.42) : 0, f, p.flipKind);
    else drawBike(0, 0, f, p.anim);
    const seatY = this.mode === 'bike' ? -11 : -lift; // Isaac's "feet line" relative to the ground
    if (this.pack !== false) drawPack(0, seatY, f, p.anim, p);
    let img = S.ride;
    if (this.mode === 'scooter' && p.onGround && Math.abs(p.vx) > 5 && Math.floor(p.anim / 3) % 3 === 0) img = S.kick;
    if (this.mode === 'bike') img = Math.floor(p.anim / 2) % 2 ? S.bike : S.bikeB;
    if (this.mode === 'skate') img = p.onGround ? S.ride : S.jump;
    if (this.mode === 'skate' && p.grabT > 0.12) {
      if (p.grabT >= 0.55) { G.save(); G.translate(0, -18); G.rotate((Math.PI / 2) * (f ? -1 : 1)); G.drawImage(S.star, -8, -12); G.restore(); }
      else spr(S.tuck, -8, -26, f);
    } else spr(img, -8, -24 + seatY, f);
    G.restore();
  }
}

// ---------------- vehicles ----------------
function drawScooter(x, y, flip, a) {
  const s = flip ? -1 : 1;
  const px = (dx, dy, w, h, c) => rect(x + (s > 0 ? dx : -dx - w), y + dy, w, h, c);
  px(-8, -4, 15, 2, '#2a1f33');   // deck
  px(-7, -4, 13, 1, '#4cb944');
  px(6, -18, 2, 15, '#2a1f33');   // stem
  px(3, -19, 7, 2, '#2a1f33');    // bars
  px(3, -19, 2, 2, '#4cb944'); px(8, -19, 2, 2, '#4cb944');
  wheel(x - 7 * s, y - 1, a); wheel(x + 7 * s, y - 1, a);
}
function drawBoard(x, y, flipT, flip, kind = 'KICKFLIP') {
  if (flipT) {
    const a = flipT * Math.PI * 2 * (kind === 'HEELFLIP' ? -1 : 1);
    const h = Math.round(Math.cos(a) * 2);
    const w = kind === 'TRE FLIP' ? Math.max(2, Math.round(Math.abs(Math.cos(flipT * Math.PI * 2)) * 16)) : 16;
    rect(x - w / 2, y - 4 - Math.abs(h), w, Math.max(1, Math.abs(h)), h > 0 ? '#2a1f33' : kind === 'HEELFLIP' ? '#3d7be0' : '#e8483f');
    return;
  }
  rect(x - 8, y - 4, 16, 2, '#2a1f33'); rect(x - 7, y - 4, 14, 1, '#e8752a');
  wheel(x - 5, y - 1, 0); wheel(x + 5, y - 1, 0);
}
// Isaac's black/green Trek Precaliber single-speed. Local coords: (x, y) = ground under the bottom bracket.
export function drawBike(x, y, flip, a = 0) {
  const s = flip ? -1 : 1;
  const P = (dx, dy) => [x + dx * s, y + dy];
  const line = (a1, b1, a2, b2, c, w = 2) => {
    const [x1, y1] = P(a1, b1), [x2, y2] = P(a2, b2);
    const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) | 0;
    G.fillStyle = c;
    for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; G.fillRect(Math.round(x1 + (x2 - x1) * t - (w > 1 ? 0.5 : 0)), Math.round(y1 + (y2 - y1) * t - (w > 1 ? 0.5 : 0)), w, w); }
  };
  const wheelAt = (dx) => {
    const [cx, cy] = P(dx, -6);
    for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) {
      const d = Math.hypot(xx, yy);
      if (d <= 6.6 && d > 4.9) { G.fillStyle = (Math.atan2(yy, xx) * 4 + a * 0.6 | 0) % 2 ? '#1c1c22' : '#2e2e36'; G.fillRect(Math.round(cx + xx), Math.round(cy + yy), 1, 1); }
      else if (d <= 4.9 && d > 4.0) { G.fillStyle = '#9aa3b8'; G.fillRect(Math.round(cx + xx), Math.round(cy + yy), 1, 1); }
    }
    for (let k = 0; k < 3; k++) { const ang = a * 0.35 + (k * Math.PI) / 3; G.fillStyle = 'rgba(214,219,232,.8)'; for (let r = 1; r < 4; r++) { G.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), 1, 1); G.fillRect(Math.round(cx - Math.cos(ang) * r), Math.round(cy - Math.sin(ang) * r), 1, 1); } }
    G.fillStyle = '#d6dbe8'; G.fillRect(Math.round(cx), Math.round(cy), 1, 1);
  };
  wheelAt(-10); wheelAt(10);
  const K = '#26262e', GR = '#4cb944';
  line(-10, -6, 0, -6, K, 1);          // chain stay
  line(-10, -6, -3, -14, K, 1);        // seat stay
  line(-3, -15, 0, -6, K);             // seat tube
  line(0, -6, 7, -13, K);              // down tube
  line(-3, -14, 7, -15, K);            // top tube
  line(1, -8, 6, -12, GR, 1);          // green decal (down tube)
  line(-1, -15, 5, -16, GR, 1);        // green decal (top tube)
  line(7, -16, 10, -6, K);             // fork
  line(6, -19, 8, -15, K, 1);          // stem
  line(5, -19, 9, -19, K);             // bars
  line(-6, -17, -1, -17, '#1c1c22');   // saddle
  // crank + pedals
  const ca = a * 0.5;
  const [bx, by] = P(0, -6);
  const px1 = Math.round(bx + Math.cos(ca) * 3), py1 = Math.round(by + Math.sin(ca) * 3);
  const px2 = Math.round(bx - Math.cos(ca) * 3), py2 = Math.round(by - Math.sin(ca) * 3);
  rect(px1 - 1, py1, 3, 1, '#9aa3b8'); rect(px2 - 1, py2, 3, 1, '#5d6680');
  rect(bx - 1, by - 1, 3, 3, '#5d6680');
}
function wheel(x, y, a) { rect(x - 1, y - 1, 3, 3, '#2a1f33'); rect(x, y, 1, 1, '#d6dbe8'); }
function bigWheel(x, y) {
  G.fillStyle = '#2a1f33';
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; G.fillRect(Math.round(x + Math.cos(a) * 5), Math.round(y + Math.sin(a) * 5), 1, 1); }
  rect(x, y, 1, 1, '#9aa3b8');
}

// THE WORM: Isaac lying face-down, a wave rolling from toes to head.
let wormImg = null;
export function drawWorm(x, y, t, flip = false) {
  if (!wormImg) {
    const src = SPR.isaac.idle;
    wormImg = document.createElement('canvas'); wormImg.width = src.height; wormImg.height = src.width;
    const g = wormImg.getContext('2d');
    g.translate(src.height, 0); g.rotate(Math.PI / 2); g.drawImage(src, 0, 0);
  }
  const w = wormImg.width, h = wormImg.height;
  for (let c = 0; c < w; c++) {
    const col = flip ? w - 1 - c : c;
    const off = Math.max(0, Math.sin(t * 11 - c * 0.35)) * 5;
    const dx = flip ? x + w / 2 - c - 1 : x - w / 2 + c;
    G.drawImage(wormImg, col, 0, 1, h, Math.round(dx), Math.round(y - h - off), 1, h);
  }
}

// Green backpack with Big Bunny peeking out (drawn behind Isaac).
// Design E from the bunny board (report/bunny-board.html): he ducks + pops back up when Isaac
  // turns around, blinks, bobs with steps, and his ears flop with running, stopping and jumping.
// `st` is the player (per-rider state lives on it); physics steps at the game's 60fps like drawWorm.
export function drawPack(x, y, flip, anim = 0, st = {}) {
  const dt = 1 / 60, face = flip ? -1 : 1;
  if (st.packFace !== undefined && st.packFace !== face) { st.packTurn = 0.42; st.earV = (st.earV || 0) + 9; }
  st.packFace = face;
  st.packTurn = Math.max(0, (st.packTurn || 0) - dt);
  const speed = Math.abs(st.vx || 0), air = st.onGround === false;
  const target = 0.25 + Math.min(1, speed / 90) * 0.7 + (air ? (st.vy < 0 ? 0.8 : -0.3) : 0);
  st.ear ??= 0.4; st.earV ??= 0;
  st.earV += ((target - st.ear) * 90 - st.earV * 7) * dt; st.ear += st.earV * dt;
  if (speed < 5 && st.packMoving) st.earV -= 7; // stopping: ears swing forward
  st.packMoving = speed >= 5;
  let dy = st.packMoving && !air ? Math.round(Math.abs(Math.sin(anim * 0.8))) : 0;
  if (st.packTurn > 0) { const k = 1 - st.packTurn / 0.42; dy = -Math.round((k < 0.45 ? Math.sin((k / 0.45) * Math.PI / 2) : Math.cos(((k - 0.45) / 0.55) * Math.PI / 2)) * 5); }
  const B = SPR.bunnyPack, top = -18, px = -12, hx = px - 1, hy = top - B.face.height + 2 - dy;
  G.save(); G.translate(Math.round(x), Math.round(y)); G.scale(face, 1);
  G.drawImage(B.pack, px, top);
  G.save(); G.beginPath(); G.rect(-24, -44, 24, 44 + top + 1); G.clip(); // tucked below the rim while ducking
  for (const [ex, tilt] of [[hx + 1, -0.05], [hx + 5, 0.12]]) bunnyEar(ex, hy + 1, st.ear + tilt);
  G.drawImage((game.t % 3.1) < 0.13 ? B.blink : B.face, hx, hy);
  G.restore();
  G.drawImage(B.pack, px, top);
  G.restore();
}
function bunnyEar(x, y, ang, L = 5) {
  const sx = Math.sin(ang), sy = -Math.cos(ang);
  for (let i = 0; i <= L; i++) rect(x + sx * i - 1, y + sy * i - 1, 3, 3, '#2a1f33');
  for (let i = 0; i <= L; i++) rect(x + sx * i, y + sy * i, 1, 1, i && i < L && i % 2 ? '#ff9eaa' : '#ffffff');
}

// Mom's movie-star twinkle: a little sparkle pops near her hair every couple of seconds.
export function glam(x, top, seed = 0) {
  const t = (game.t + seed * 0.013) % 2.2;
  if (t > 0.5) return;
  const k = t < 0.15 || t > 0.35 ? 1 : 2, sx = Math.round(x + (Math.floor(game.t / 2.2 + seed) % 2 ? -8 : 7)), sy = Math.round(top + 3);
  rect(sx - k, sy, k * 2 + 1, 1, '#ffffff'); rect(sx, sy - k, 1, k * 2 + 1, '#ffffff'); rect(sx, sy, 1, 1, '#ff9ec8');
}
