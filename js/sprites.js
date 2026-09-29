// Pixel art. Sprites are authored as fill-only rows; build() adds a 1px dark outline.
export const PAL = {
  k: '#2a1f33', w: '#ffffff', W: '#d6dbe8', g: '#9aa3b8', G: '#5d6680',
  s: '#ffdcc4', S: '#efb394', p: '#ff9eaa',
  y: '#ffde5c', Y: '#dca437', h: '#fff4b5',
  b: '#3d7be0', B: '#2a55a3', n: '#2b3a67', N: '#1d2747',
  r: '#e8483f', R: '#a62f3a', m: '#9c2f45', t: '#ff7d98',
  o: '#b85c2a', O: '#86401c', q: '#dd8447',
  c: '#efe7d6', C: '#cbbd9f',
  u: '#8f6040', U: '#65422c', v: '#c29260',
  d: '#4b3526', D: '#2f2119', e: '#76675c', E: '#a39488',
  l: '#a9d0f5', L: '#78a6d9', z: '#3c4d73',
  x: '#7a4e2d', X: '#c98f55',
  a: '#5cd6ff', A: '#d4f6ff',
  f: '#4cb944', F: '#2c7a34', i: '#9fe35f',
  j: '#ffcd3c', J: '#d9921a',
  T: '#e8752a', // calico orange
  K: '#3b3440', // calico dark / tabby
  M: '#f6d383', // Mom's honey blonde
  V: '#d9a94f', // blonde shadow
  Q: '#ff5fa2', // hot pink
  P: '#e9a3c6', // soft pink (plaid stripe)
  I: '#b9a7d8', // lavender plaid
  H: '#3d4270', // navy plaid
  Z: '#e8336f', // glossy lips
};

function build(rows, { outline = true, pal = PAL, name = '?' } = {}) {
  const w = Math.max(...rows.map((r) => r.length));
  if (rows.some((r) => r.length !== w)) console.warn('sprite rows uneven:', name, rows.map((r) => r.length).join(','));
  const pad = outline ? 1 : 0;
  const c = document.createElement('canvas');
  c.width = w + pad * 2; c.height = rows.length + pad * 2;
  const g = c.getContext('2d');
  const solid = (x, y) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== '.' && rows[y][x] !== ' ';
  if (outline) {
    g.fillStyle = PAL.k;
    for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) g.fillRect(x + pad, y + pad, 1, 1);
    }
  }
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || ch === ' ') return;
    g.fillStyle = pal[ch] || '#f0f';
    g.fillRect(x + pad, y + pad, 1, 1);
  }));
  return c;
}

// ---------------- Isaac (composed from head + body + legs), faces right ----------------
const I_HEAD = [
  '...yy.yyy.yy..',
  '..yhyyyhyyyyy.',
  '.yyyyYyyyyhyyy',
  'yyhyyyyyYyyyyy',
  'yyyYyyhyyyyYyy',
  'yYyyyYyyyYyyyy',
  'yyYysssYsssyy.',
  'yYysssskssks..',
  'yyYSssskssks..',
  '.yysspsssspss.',
  '..yssssmmsss..',
  '....ssssssss..',
];
const I_BODY = {
  side: [
    '...bbBssBbb...',
    '..bbbwBBwbbb..',
    '..bbwwwwwwbb..',
    '..swwwwwwwws..',
    '..swwwbbwwws..',
    '...wwwwwwww...',
  ],
  fwd: [
    '...bbBssBbb...',
    '...bbwBBwbbbb.',
    '...bwwwwwwbbss',
    '...wwwwwwww...',
    '...wwwbbwww...',
    '...wwwwwwww...',
  ],
  up: [
    '.s.bbBssBbb.s.',
    '.bbbbwBBwbbbb.',
    '...wwwwwwww...',
    '...wwwwwwww...',
    '...wwwbbwww...',
    '...wwwwwwww...',
  ],
  back: [
    '.ssbbBssBbb...',
    '..bbbwBBwbbb..',
    '...wwwwwwwbb..',
    '...wwwwwwwws..',
    '...wwwbbwww...',
    '...wwwwwwww...',
  ],
};
const I_LEGS = {
  stand: [
    '...nnnnnnnn...',
    '...nnn..nnn...',
    '....ss..ss....',
    '...rrr..rrr...',
  ],
  walkA: [
    '...nnnnnnnn...',
    '..nnn....nnn..',
    '..ss......ss..',
    '.rrr......rrr.',
  ],
  walkB: [
    '...nnnnnnnn...',
    '....nnnnnn....',
    '.....ssss.....',
    '....rrrrrr....',
  ],
  jump: [
    '...nnnnnnnn...',
    '..nnn...nnn...',
    '.ss......ss...',
    'rrr.......rrr.',
  ],
  sit: [
    '...nnnnnnnnn..',
    '...nnnnnnnnnn.',
    '.........ss...',
    '.........rrr..',
  ],
  sitB: [
    '...nnnnnnnnn..',
    '...nnnnnn.....',
    '.....ss.......',
    '....rrr.......',
  ],
  kick: [
    '...nnnnnnnn...',
    '.nnnn...nnn...',
    'ss......ss....',
    'rr.....rrr....',
  ],
  tuck: [
    '...nnnnnnnnss.',
    '...nnnnnnnnrr.',
    '..............',
    '..............',
  ],
};
function isaac(body, legs) { return build([...I_HEAD, ...I_BODY[body], ...I_LEGS[legs]], { name: `isaac-${body}-${legs}` }); }

// ---------------- Mom (Amanda), faces right ----------------
const MOM_HEAD = [
  '...MuuuuuM....',
  '..MuuMuuuuM...',
  '.MMMuMMuMMMM..',
  'uuMMMMMMMMMMM.',
  'MMMhsssssssMM.',
  'MMMsssssssssM.',
  'MMhsskssskssM.',
  'MMMSsksssksM..',
  'MhMsspssspsM..',
  'MMMssmmmmssM..',
  'MMMMssmmssM...',
  'MhMMMsssssM...',
  'MMMM..sss.M...',
];
const MOM_BINOC = { 5: 'MMMsssGGGGGsM.', 6: 'MMhssGkGGkGG..', 7: 'MMMSsGGGGGGs..' };
const MOM_BODY = {
  side: ['MMM.IIJxJIII..', 'MM.IIHIJIHIII.', 'Mh.PIHIIIHIPI.', '.M.sHHHHHHHs..', '...sIIHIIHIIs.', '...IIPIIIPII..'],
  wave: ['MMM.IIJxJII.ss', 'MM.IIHIJIHIIs.', 'Mh.PIHIIIHIP..', '.M.sHHHHHHH...', '...sIIHIIHII..', '...IIPIIIPII..'],
  binoc: ['MMM.IIJxJIIss.', 'MM.IIHIJIHIIs.', 'Mh.PIHIIIHIP..', '.M.IHHHHHHH...', '...IIIHIIHII..', '...IIPIIIPII..'],
};
const MOM = (legs, arms = 'side') => [
  ...MOM_HEAD.map((r, i) => (arms === 'binoc' && MOM_BINOC[i]) || r),
  ...MOM_BODY[arms],
  '...LLLLLLLL...',
  ...(legs === 'a'
    ? ['...LLL..LLL...', '..LLL....LLL..', '..LL......LL..', '.www......www.']
    : ['...LLL..LLL...', '...LLL..LLL...', '...LL....LL...', '...www...www..']),
];

// ---------------- Dad (Blaine), faces right ----------------
const DAD = (legs, arms = 'side') => [
  '....d.dd.d....',
  '..ddddddddd...',
  '.dddDdddddDd..',
  '.dddddddddddd.',
  '.ddsssssssdd..',
  '.dsssssssssd..',
  '.Sssskssskss..',
  '.Sssskssskss..',
  '.ssssssssssss.',
  '.eeseewwwweee.',
  '.eeeewwwwweee.',
  '..eeeeeeeeee..',
  '....ssssss....',
  ...(arms === 'pitch'
    ? ['.ss.llllll....', '..lllllllll...', '..llllllllll..', '..llllllllll..', '...lllllllls..', '...llllllll...']
    : arms === 'up'
      ? ['s..llllllll..s', 'lllllllllllll.', '..llllllllll..', '..llllllllll..', '...llllllll...', '...llllllll...']
      : ['..llllllllll..', '.llllllllllll.', '.lLllllllllLl.', '.lLllllllllLl.', '.sLllllllllLs.', '..llllllllll..']),
  '..zzzzzzzzzz..',
  ...(legs === 'a'
    ? ['..zzzz..zzzz..', '.zzzz....zzzz.', '.zzz......zzz.', 'xxxx......xxxx']
    : ['..zzzz..zzzz..', '..zzzz..zzzz..', '..zzz....zzz..', '..xxxx...xxxx.']),
];

// ---------------- Sunny (red mini poodle), faces right ----------------
// Generated (curly blobs + dither) — see git history for the generator notes.
const SUNNY = {
  stand: [
    '.............oqo.....',
    '............ooooo....',
    '..oo........oqoooo...',
    '.oqo.......oooookoo..',
    '.ooo.......oOOookoo..',
    '..oo.......OOooqooook',
    '...o.ooooooOoOooootto',
    '...ooooqooooOOqooo...',
    '...qooOoooqOOooO.....',
    '...oooqooOoooqoo.....',
    '....oooooqooOo.oq....',
    '....oq.oo...qo.Oo....',
    '....oo.oq...oo.qo....',
    '....qq.qq...qq.qq....',
    '.....................',
  ],
  run1: [
    '............ooqoo....',
    '..oq........oooooq...',
    '.ooo.......oOqookoo..',
    '.oqo.......OoOookoo..',
    '..oo.......oOOooooook',
    '...o.......OOooqootto',
    '...o.ooooooOoOoooo...',
    '...ooooqooooOOqo.....',
    '...qooOoooqooooO.....',
    '...oooqooOoooqoo.....',
    '..qO.ooooqooOoo.qo...',
    '..oo.qO......oo.oo...',
    '.qo...oo......oqo....',
    '.qq...qq......qqq....',
    '.oo...Oq......qOo....',
  ],
  run2: [
    '.............oqo.....',
    '............ooooo....',
    '............oqoooo...',
    '..qo.......oooookoo..',
    '.ooo.......oOOookoo..',
    '.qoo.......OOooqooook',
    '..oo.ooooooOoOooootto',
    '...ooooqooooOOqooo...',
    '...qooOoooqOOooO.....',
    '...oooqooOoooqoo.....',
    '.....ooooqooOoo......',
    '.....qOoo..oqoo......',
    '.....oooq..oooo......',
    '.....qqqq..qqqq......',
    '.....................',
  ],
  sit: [
    '.............oqo.....',
    '............ooooo....',
    '..oo........oqoooo...',
    '.oqo.......oooookoo..',
    '.ooo.......oOOookoo..',
    '..oo...oqo.OOooqooook',
    '...o.ooooooOoOooootto',
    '...ooooqooooOOqooo...',
    '...qooOoooqOOo.......',
    '...oooqooOoooq.......',
    '..qOoooooqooOo.oq....',
    '..oooqOoooooqo.Oo....',
    '...oooooqO..oo.qo....',
    '..qqqoooo...qq.qq....',
    '.....................',
  ],
};

// ---------------- Freida (calico cat), faces right ----------------
const FREIDA = {
  loaf: [
    '.............K...K.',
    '............KKT.TKK',
    '...........KTTTTTKK',
    '..........KKwTTTTKK',
    '...KKTTKKKKiwkTkiwK',
    '..TTKKTTKKKwwwpwwww',
    '.TTKKKTTTKKwwwwwwww',
    'KTTKKKKTTTTKwwwwww.',
    'KTwwwTTKKKTTTwwww..',
    'KwwwwwwwwwwwwwwwK..',
    '.wwwwwwwwwwwwwwww..',
  ],
  walk1: [
    '..............K...K',
    '.............KKT.TK',
    '............KTTTTTK',
    'K...........KwTTTKK',
    '.K..KKTTKKKKiwkTkiw',
    '.TKTTKKTTKKKwwwpwww',
    '..TTKKKTTTKKwwwwwww',
    '..TTKKKKTTTTKwwwww.',
    '..wwwTTKKKTTTwwww..',
    '..ww.ww.....ww.ww..',
    '..ww..ww...ww...ww.',
  ],
  walk2: [
    '..............K...K',
    '.............KKT.TK',
    '............KTTTTTK',
    '..K.........KwTTTKK',
    '..K.KKTTKKKKiwkTkiw',
    '.TKTTKKTTKKKwwwpwww',
    '..TTKKKTTTKKwwwwwww',
    '..TTKKKKTTTTKwwwww.',
    '..wwwTTKKKTTTwwww..',
    '....wwww...wwww....',
    '....ww.ww..ww.ww...',
  ],
};

// ---------------- portraits (26x26 with outline) ----------------
const P_ISAAC = [
  '.....yy.yyy..yyy.......',
  '...yyhyyyyhyyyyhyy.....',
  '..yyyyyYyyyyyyyyyyyy...',
  '.yyhyyyyyyhyyYyyyhyyy..',
  '.yyyyYyyyyyyyyyyyyyyyy.',
  'yyYyyyyyhyyYyyyhyyyYyy.',
  'yyyyhyyYyyyyyyyyyyyyyyy',
  'yyYyyyyyyyyyyyYyyyyyyyy',
  'yyyyyysssYssssssYsssyyy',
  'yyYyssssssssssssssssyyy',
  'yyyssssssssssssssssssyy',
  '.yyssskkssssssskksssyy.',
  '.ySsskwkssssssskwkssSy.',
  '.ySsskkkssssssskkkssSy.',
  '..ssssssssssssssssssss.',
  '..sppsksssssssssksppss.',
  '..sppssmmmmmmmmmsssppss',
  '...ssssmwwmwwwwmsssss..',
  '...sssssmmmmmmmsssss...',
  '....sssssmmmmmsssss....',
  '.....sssssssssssss.....',
  '.......sssssssss.......',
  '....bbbbBsssssBbbbb....',
  '..bbbbbbwBBBBBwbbbbbb..',
  '.bbbbbbwwwwwwwwwbbbbbb.',
];
const P_MOM = [
  '.......UUUUUUUU........',
  '.....UUvvUUUUUUUU......',
  '....uUvuUUuUUvvUuUU....',
  '...uuvuuuuuuuuuvvuuu...',
  '..uuvuuuuuuuuuuuuvuuu..',
  '..uvuuusssssssssuuvuu..',
  '.uuvuusssssssssssuuvuu.',
  '.uvuusssssssssssssuuvu.',
  '.uvuusUUUssssUUUssuuvu.',
  '.uvussskkssssskksssuvu.',
  'uuvussskwsssssskwssuvuu',
  'uuvussssssssssssssssuvu',
  'uuvuspppssssssssppppuvu',
  'uuvusppssssSsssssppsuvu',
  'uuvuusskssssssskssssuvu',
  'uuvuussskwwwwwksssssuvu',
  'uuvuuusssktttkssssuuuvu',
  '.uvuuuussskkksssuuuuvu.',
  '.uuvuuuuusssssssuuuuvu.',
  '.uuvuuuuuuusssuuuuuuvu.',
  '..uuuuuIHIsssssIHuuuuu.',
  '..uuuIIHIIIJxJPHIIIuuu.',
  '...IIIHIIPHIIIHIPIHII..',
  '..IIPHIIIHIPIHIIIHPII..',
];
const P_DAD = [
  '.......d..dd.d.dd......',
  '....dddddddddddddd.....',
  '...ddDdddddDddddddd....',
  '..dddddddddddddddDdd...',
  '..ddDddddddddddddddd...',
  '..dddsssssssssssssddd..',
  '..ddssssssssssssssssd..',
  '.dssDDDDsssssssDDDDsd..',
  '.Sssssssssssssssssssss.',
  '.Ssssskkssssssskksssss.',
  '.Sssskwkssssssskwkssss.',
  '..sssssssssSssssssssss.',
  '..sssssssssSSsssssssss.',
  '..eEeeksssssssssssekEe.',
  '..eeeeemmmmmmmmmmmeeee.',
  '..eeEeemwwwwwwwwwmeeee.',
  '..eeeeeemwwwwwwwmeeEee.',
  '...eeEeeemmmmmmmeeeee..',
  '....eeeeeeeeEeeeeeee...',
  '......eeeeeeeeeeee.....',
  '........ssssssss.......',
  '...llllllssssssllllll..',
  '.lllllllllsjslllllllll.',
  'lllllllllllllllllllllll',
];
const P_SUNNY = [
  '.........oooooo........',
  '.......ooqoooqooo......',
  '.....oooooqooooqooo....',
  '....oqoooooooooooqoo...',
  '...ooooqoooooooqooooo..',
  '..ooqoooooooooooooqooo.',
  '.ooooooookkooookkooooo.',
  'oOooooookwkooookwkooOoo',
  'oOOoooookkkooookkkooOOo',
  'oOOooooooooooooooooOOOo',
  'oOOOooooooookkkoooooOOo',
  'oOOOoooooookkkkkoooOOOo',
  '.OOOooooooookkkooooOOO.',
  '.OOOOoooooooookoooOOOO.',
  '.OOOOoooookooookoooOOO.',
  '..OOOoooooktttkoooOOO..',
  '..OOOOooooottttoooOOO..',
  '...OOOoooooottoooOOO...',
  '....OOoooooooooooOO....',
  '......ooooqoooqooo.....',
  '.....oooqooooooqooo....',
  '....ooooooooooooooooo..',
];
const P_FREIDA = [
  '..K..................K.',
  '..KK................KK.',
  '..KpK..............KpK.',
  '..KppKK..........KKppK.',
  '..KKKKKTTTTTKKKKKKKKKK.',
  '..KKKTTTTTTTKKKKKKKKKK.',
  '.KKKTTTTTTTTTKKKKKKKKKK',
  '.KKTTTTTTTTTTTKKKKKKKKK',
  '.KKTwwwwTTTTTwwwwwKKKKK',
  '.KKKKKKKKTTTKKKKKKKKKKK',
  '.KKiiikkTTTTTkkiiiKKKKK',
  '.KwwwwwwTTTTTwwwwwwKKK.',
  '.KwwwwwwTTTTTwwwwwwwKK.',
  '..wwwwwwwTTTwwwwwwwwK..',
  '..wwwwwwwwppwwwwwwwwK..',
  '..wwwwwwwwwkwwwwwwwwK..',
  '...wwwwwwkwwkwwwwwww...',
  '....wwwwwwwwwwwwwwww...',
  '......wwwwwwwwwwwww....',
  '.......wwwwwwwwwww.....',
  '....TTTwwwwwwwwwwKKK...',
  '..TTTTTwwwwwwwwwKKKKK..',
  '.KKTTTTwwwwwwwwwKKKKKK.',
];

// ---------------- items / props ----------------
const CARD = [
  'jjjjjjj',
  'jaAaaAj',
  'jAaaAaj',
  'jaaAaaj',
  'jwwwwwj',
  'jWWWWWj',
  'jwWWWwj',
  'jjjjjjj',
];
const STAR = [
  '...j...',
  '...j...',
  '..jjj..',
  'jjjhjjj',
  '.jjjjj.',
  '..jjj..',
  '.jj.jj.',
  '.j...j.',
];
const HEART = ['.rr.rr.', 'rrwrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
const BASEBALL = ['.www.', 'wrwrw', 'wwwww', 'wrwrw', '.www.'];
const DIAMOND = ['.aAa.', 'aAaaa', 'aaaAa', '.aaa.', '..a..'];
const CLUE = [
  'CcccccccC',
  'cwwwwwwwc',
  'cwgggggwc',
  'cwwwwwwwc',
  'cwggggwwc',
  'cwwwwwwwc',
  'CcccccccC',
];
const BALLOON8 = [
  '.rrrrr.',
  'rrhrrrr',
  'rhwwwrr',
  'rrwrwrr',
  'rrwwwrr',
  'rrwrwrr',
  '.rwwwr.',
  '..rrr..',
  '...r...',
];
const CUPCAKE = ['...r...', '.ttttt.', 'ttwtttt', 'ttttttt', '.XxXxX.', '.XxXxX.', '..XxX..'];
const CATFISH = [
  '.............GG.',
  '...GGGGGGGG.GGG.',
  '.GGgggggggGGGG..',
  'GgkgggggggggGG..',
  'GgggggggggggGGG.',
  '.WWWWWWWWggGG.GG',
  'g.WWWWWWWG.....G',
  'g...............',
];
const FISH = ['..bb...', '.bbwb.b', 'bkbbbbb', '.bbbb.b', '..bb...'];
const GOLDEYE = [
  '.....WWWWWW......',
  '...WWAAAAAAWW..WW',
  '.WWAjjAAAAAAAWWW.',
  'WWAjkjAAAAAAAAWW.',
  '.WWWjWWWWWWWWWWW.',
  '...WWWWWWWWWWW..W',
  '.....gggg........',
];
const HERON = [
  '..GG....',
  '.GGwj...',
  '..G.....',
  '..G.....',
  '..GG....',
  '...GG...',
  '..gGGGg.',
  '.gGGGGGg',
  '..gGGGG.',
  '....G...',
  '....G...',
  '....G...',
];
const BUNNY = [
  '.w.w..',
  '.wpwp.',
  '.wpwp.',
  '.wwww.',
  'wwwwww',
  'wkwwkw',
  'wwppww',
  '.wwww.',
  'wwwwww',
  'wwwwww',
  '.w..w.',
];
const PRESENT_BOW = ['rr...rr', 'rRr.rRr', '.rrrrr.', '..rrr..'];
const CREEPER = [
  'ffifffff',
  'fkkffkkf',
  'fkkffkkf',
  'iffkkfff',
  'ffkkkkff',
  'ffkffkfi',
  'ffffffff',
  '.ffffff.',
  '.fiffff.',
  '.ffffif.',
  '.ffffff.',
  '.ffffff.',
  '.ff..ff.',
  '.ff..ff.',
];
const GOOSE = [
  '..KK......',
  '.KKwK.....',
  '.KK.......',
  '.KK.......',
  '.KK..eeee.',
  '.KKeeeeeee',
  '..eeEEEEee',
  '...wwwwww.',
  '.....KK...',
];

export const SPR = {};
export const PORTRAIT = {};

export function buildSprites() {
  const I = (b, l) => isaac(b, l);
  Object.assign(SPR, {
    isaac: {
      idle: I('side', 'stand'), walkA: I('side', 'walkA'), walkB: I('side', 'walkB'),
      jump: I('up', 'jump'), cheer: I('up', 'stand'), ride: I('fwd', 'stand'), kick: I('fwd', 'kick'),
      bike: I('fwd', 'sit'), bikeB: I('fwd', 'sitB'), back: I('back', 'stand'), tuck: I('fwd', 'tuck'),
      star: I('up', 'walkA'), hold: I('fwd', 'stand'),
    },
    mom: { idle: build(MOM('b')), walk: build(MOM('a')), wave: build(MOM('b', 'wave')), binoc: build(MOM('b', 'binoc')) },
    dad: { idle: build(DAD('b')), walk: build(DAD('a')), pitch: build(DAD('b', 'pitch')), cheer: build(DAD('b', 'up')) },
    sunny: { stand: build(SUNNY.stand), run1: build(SUNNY.run1), run2: build(SUNNY.run2), sit: build(SUNNY.sit) },
    freida: { loaf: build(FREIDA.loaf), walk1: build(FREIDA.walk1), walk2: build(FREIDA.walk2) },
    card: build(CARD), star: build(STAR), heart: build(HEART), baseball: build(BASEBALL), diamond: build(DIAMOND),
    clue: build(CLUE), balloon: build(BALLOON8), cupcake: build(CUPCAKE), catfish: build(CATFISH), fish: build(FISH), goldeye: build(GOLDEYE), heron: build(HERON),
    bunny: build(BUNNY), bow: build(PRESENT_BOW), creeper: build(CREEPER), goose: build(GOOSE),
  });
  Object.assign(PORTRAIT, {
    isaac: build(P_ISAAC, { name: 'p-isaac' }), mom: build(P_MOM, { name: 'p-mom', pal: { ...PAL, u: '#efcf8a', v: '#fff1c4', U: '#8a6440' } }), dad: build(P_DAD, { name: 'p-dad' }),
    sunny: build(P_SUNNY, { name: 'p-sunny' }), freida: build(P_FREIDA, { name: 'p-freida' }),
  });
}
