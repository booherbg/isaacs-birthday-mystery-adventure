// The collectible trading cards: silly family/world cards that fill Isaac's Card Binder.
import { SPR, PORTRAIT } from './sprites.js';
import { save } from './save.js';

export const CARDS = [
  { id: 'sunny', name: 'SUNNY', hp: 70, img: () => PORTRAIT.sunny, move: 'Zoomies' },
  { id: 'freida', name: 'FREIDA', hp: 90, img: () => PORTRAIT.freida, move: 'Grumpy Stare' },
  { id: 'dad', name: 'DAD', hp: 200, img: () => PORTRAIT.dad, move: 'Dad Joke' },
  { id: 'mom', name: 'MOM', hp: 999, img: () => PORTRAIT.mom, move: 'Bird Call' },
  { id: 'bunny', name: 'BIG BUNNY', hp: 100, img: () => SPR.bunny, move: 'Snuggle' },
  { id: 'isaac', name: 'ISAAC', hp: 8, img: () => PORTRAIT.isaac, move: 'The Worm' },
  { id: 'creeper', name: 'CREEPER', hp: 50, img: () => SPR.creeper, move: 'Party Pop' },
  { id: 'catfish', name: 'CATFISH', hp: 120, img: () => SPR.catfish, move: 'Mud Splash' },
  { id: 'goose', name: 'GOOSE', hp: 60, img: () => SPR.goose, move: 'HONK' },
  { id: 'baseball', name: 'HOME RUN', hp: 40, img: () => SPR.baseball, move: 'Moon Shot' },
  { id: 'diamond', name: 'DIAMOND', hp: 64, img: () => SPR.diamond, move: 'Shine' },
  { id: 'cupcake', name: 'CUPCAKE', hp: 8, img: () => SPR.cupcake, move: 'Sugar Rush' },
  { id: 'splash', name: 'CANNONBALL', hp: 88, img: () => SPR.swim.tuck, move: 'Mega Splash', special: true }, // won at the Cannonball Contest
];

export function binder() {
  if (!Array.isArray(save.data.binder)) save.data.binder = [];
  return save.data.binder;
}
// The next card found: new ones first (in order), then random repeats.
export function drawCard() {
  const b = binder();
  const fresh = CARDS.find((c) => !b.includes(c.id) && !c.special);
  const pool = CARDS.filter((c) => !c.special);
  const card = fresh || pool[(Math.random() * pool.length) | 0];
  let complete = false;
  if (fresh) {
    b.push(fresh.id);
    complete = checkComplete();
    save.flush();
  }
  return { card, isNew: !!fresh, complete };
}
// A full binder unlocks the Card Collector Cap.
function checkComplete() {
  const b = binder();
  if (CARDS.every((c) => b.includes(c.id)) && !save.data.tramp.hats.includes('collector')) { save.data.tramp.hats.push('collector'); return true; }
  return false;
}
// Give a specific card (the contest prize). Returns { card, isNew, complete }.
export function giveCard(id) {
  const b = binder(), card = CARDS.find((c) => c.id === id);
  if (!card || b.includes(id)) return { card, isNew: false, complete: false };
  b.push(id);
  const complete = checkComplete();
  save.flush();
  return { card, isNew: true, complete };
}

const urlCache = {};
function url(c) { return (urlCache[c.id] ||= c.img()?.toDataURL() || ''); }
export function binderHTML() {
  const b = binder();
  return `<div class="binder-title">🃏 CARD BINDER <span>${b.length}/${CARDS.length}</span></div>
    <div class="binder">${CARDS.map((c) => b.includes(c.id)
      ? `<div class="bcard got"><div class="bname">${c.name}<em>HP ${c.hp}</em></div><div class="bart holo"><img src="${url(c)}" alt=""></div><div class="bmove">${c.move}</div></div>`
      : `<div class="bcard"><div class="bq">?</div></div>`).join('')}</div>`;
}
