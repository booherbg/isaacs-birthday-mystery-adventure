// Progress in localStorage (wrapped: private mode / blocked storage just means no saving).
const KEY = 'isaac-adventure-v1';
const DEFAULT = () => ({
  stage: 0, path: null, done: false, paths: {},
  cards: {},
  tramp: { high: 0, bestHeight: 0, bestCombo: 0, plays: 0, hat: 'party', hats: ['party', 'none', 'pika'] },
});

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && typeof d === 'object') {
      const out = Object.assign(DEFAULT(), d, { tramp: Object.assign(DEFAULT().tramp, d.tramp) });
      if (!out.tramp.hats.includes('pika')) out.tramp.hats.push('pika');
      return out;
    }
  } catch {}
  return DEFAULT();
}

export const save = {
  data: load(),
  set(patch) {
    Object.assign(this.data, patch);
    this.flush();
  },
  flush() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch {} },
  reset() { const t = this.data.tramp, done = this.data.done; this.data = Object.assign(DEFAULT(), { tramp: t, done }); this.flush(); },
};
