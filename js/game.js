'use strict';
/* ============ Poké Realm — núcleo do jogo ============ */
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const d = s => 1 + Math.floor(Math.random() * s);
const roll = (n, s) => { let t = 0; for (let i = 0; i < n; i++) t += d(s); return t; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

const SAVE_KEY = 'pkr_save_v2', HALL_KEY = 'pkr_hall_v1', CACHE_KEY = 'pkr_poke_v3';

/* ---------- Pokédex (PokeAPI) ---------- */
const POKE = {};
const coreIds = () => [...new Set([...Object.values(ZONE_POOLS).flat(), ...BOSSES, ...RARE_POOL, ...STORY_IDS, ...Object.values(WATER_POOLS).flat()])];

async function fetchPoke(id, cache) {
  // o cache guarda só os dados; imagens são recriadas a cada sessão
  const clean = o => { const c = { ...o }; for (const k of ['img', 'imgW', 'imgA', 'imgG', 'url']) delete c[k]; return c; };
  if (cache[id]) return clean(cache[id]);
  const r = await fetch(API + id);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const st = {};
  j.stats.forEach(s => { st[s.stat.name] = s.base_stat; });
  const v = j.sprites.versions || {};
  const icon = v['generation-vii'] && v['generation-vii'].icons && v['generation-vii'].icons.front_default;
  const p = {
    id, name: j.name === 'ho-oh' ? 'Ho-Oh' : cap(j.name.split('-')[0]),
    types: j.types.sort((a, b) => a.slot - b.slot).map(t => t.type.name),
    stats: st, exp: j.base_experience || 100, height: j.height || 10,
    icon: icon || null, front: j.sprites.front_default,
    hm: [...new Set(j.moves.map(m => HM_MOVES[m.move.name]).filter(Boolean))], // MOs que aprenderia nos jogos
  };
  cache[id] = clean(p);
  return p;
}

function trimImage(im) {
  const c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  const x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  try {
    const px = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) {
      if (px[(y * c.width + i) * 4 + 3] > 10) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return c;
    const t = document.createElement('canvas');
    t.width = x1 - x0 + 1; t.height = y1 - y0 + 1;
    t.getContext('2d').drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
    return t;
  } catch (e) { return im; }
}

function loadImg(p) {
  return new Promise(res => {
    const urls = [p.icon, ICON_URL(p.id), p.front].filter(Boolean);
    const next = () => {
      if (!urls.length) return res();
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => { p.img = trimImage(im); res(); };
      im.onerror = next;
      im.src = urls.shift();
    };
    next();
  });
}

let pokeCache = null;
async function loadPokedex(ids, onProg) {
  if (!pokeCache) { try { pokeCache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { pokeCache = {}; } }
  if (typeof POKEDEX_PRELOAD !== 'undefined') for (const k in POKEDEX_PRELOAD) if (!pokeCache[k]) pokeCache[k] = POKEDEX_PRELOAD[k];
  const q = ids.filter(id => !POKE[id]);
  const total = q.length;
  let done = 0;
  async function worker() {
    while (q.length) {
      const id = q.shift();
      let p;
      try { p = await fetchPoke(id, pokeCache); }
      catch (e) { p = { id, name: '#' + id, types: ['normal'], stats: {}, exp: 100, height: 10, icon: ICON_URL(id), front: null, hm: [] }; }
      await loadImg(p);
      POKE[id] = p;
      if (onProg) onProg(++done, total);
    }
  }
  await Promise.all([0, 1, 2, 3, 4, 5, 6, 7].map(worker));
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(pokeCache)); } catch (e) { /* cheio */ }
}

// Variações de sprite: branco (dano) e dourado (Alfa)
function variantImg(p, key, fn) {
  if (!p.img) return null;
  if (!p[key]) {
    const c = document.createElement('canvas');
    c.width = p.img.width; c.height = p.img.height;
    fn(c.getContext('2d'), p.img, c);
    p[key] = c;
  }
  return p[key];
}
const whiteImg = p => variantImg(p, 'imgW', (x, im, c) => {
  x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
});
const alfaImg = p => variantImg(p, 'imgA', (x, im, c) => {
  x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.45; x.fillStyle = '#facc15'; x.fillRect(0, 0, c.width, c.height);
});

/* ---------- Mundo procedural ---------- */
function hash(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), e = hash(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
}
/* ---------- Sprites dos jogadores ---------- */
const CLS_SPR = {};
function buildClassSprites() {
  for (const k in CLASSES) {
    const sp = CLASSES[k].spr;
    const col = { h: sp.h, b: sp.b, d: sp.d, s: '#f1c27d', e: '#1f2937', l: '#3a2d22' };
    CLS_SPR[k] = PLEGS.map(legs => {
      const c = document.createElement('canvas');
      c.width = 12; c.height = 12;
      const x = c.getContext('2d');
      PSPR.concat(legs).forEach((row, y) => {
        for (let i = 0; i < 12; i++) { const ch = row[i]; if (col[ch]) { x.fillStyle = col[ch]; x.fillRect(i, y, 1, 1); } }
      });
      return c;
    });
  }
}

/* ---------- Estado ---------- */
const cv = $('c'), ctx = cv.getContext('2d');
let W = 800, H = 600;
let G = null, state = 'menu'; // menu | play | lost
const K = {};
const mouse = { x: 0, y: 0, down: false };
let autofire = false, showMap = true, soundOn = true;

function newWorld() {
  G = {
    P: null, enemies: [], emap: new Map(), eb: [], pb: [], cb: [], bags: [], parts: [], texts: [], fx: [], toasts: [], chat: [],
    remotes: new Map(), dungeons: new Map(), portals: [], dgNext: 0, poNext: 0, dgT: 0, allies: [], meteors: [],
    event: null, evInfo: null, evT: 70, npcOpen: null, nearNPC: null, evo: null, bountyCd: {}, dropN: 0, recall: null, storyCd: {}, relT: 0, relIdx: -1, cuts: [], usedDive: new Set(), nearHM: null,
    time: 0, nextId: 0, spawnT: 0, bossT: 75, shake: 0, area: null, banner: 0, dirty: true,
    saveT: 0, panelT: 0, cam: { x: 0, y: 0 }, fullWarn: 0, nearPortal: null,
  };
}

/* ---------- Regras (D&D simplificado) ---------- */
const hasT = (P, id) => P.talents.includes(id);
const hasS = (P, id) => P.subclass === id;
const race = P => RACES[P.race] || RACES.humano;
const pType = P => (P.tempTypeT > 0 ? P.tempType : P.ptype);
const A = (P, k) => P.attrs[k] + (P.equip.anel && P.equip.anel.attr === k ? P.equip.anel.bonus : 0);
const maxHP = P => {
  const c = CLASSES[P.cls];
  let h = 15 + (c.hd / 2 + A(P, 'VIG')) * P.lvl + (P.race === 'anao' ? P.lvl : 0) + (hasT(P, 'robusto') ? 2 * P.lvl : 0);
  if (hasS(P, 'barbaro')) h *= 1.25;
  return Math.round(h * (1 + M(P, 'hp')));
};
const AC = P => CLASSES[P.cls].ac + Math.floor(A(P, 'AGI') / 2) + (P.equip.armadura ? P.equip.armadura.ac : 0)
  + (P.race === 'halfling' || P.race === 'draconato' ? 1 : 0) + (hasT(P, 'defensor') ? 2 : 0) + (hasS(P, 'paladino') || hasS(P, 'guerra') ? 2 : 0) + M(P, 'ac');
const toHit = P => 2 + Math.floor(P.lvl / 3) + Math.floor(A(P, 'POD') / 2) + P.equip.arma.bonus + M(P, 'hit');
const critMin = P => Math.max(15, CLASSES[P.cls].crit - (hasT(P, 'critico') ? 1 : 0) - (hasS(P, 'assassino') ? 1 : 0) - M(P, 'crit'));
const moveSpeed = P => (160 + A(P, 'AGI') * 8) * (P.invis > 0 ? 1.3 : 1) * (hasT(P, 'mobilidade') ? 1.2 : 1) * (P.furia > 0 ? 1.25 : 1) * (P.hasteT > 0 ? 1.3 : 1) * (1 + M(P, 'speed'));
const fireRate = P => CLASSES[P.cls].wpn.rate * (1 + 0.05 * A(P, 'AGI')) * (P.furia > 0 ? 1.5 : 1) * (hasT(P, 'maos') ? 1.2 : 1) * (P.elixT > 0 ? 1.2 : 1) * (1 + M(P, 'rate'));
const abilCd = P => CLASSES[P.cls].abil.cd * (hasT(P, 'foco') ? 0.7 : 1) * Math.max(0.5, 1 - M(P, 'cd'));
const rangeMul = P => (P.race === 'elfo' ? 1.15 : 1) * (hasT(P, 'olho') ? 1.25 : 1) * (1 + M(P, 'range'));
const xpNeed = l => Math.round(180 * Math.pow(l, 2.2));

// raça, classe e tipo são sorteados
function rollHero() {
  const cls = pick(Object.keys(CLASSES)), rc = pick(Object.keys(RACES)), type = pick(TYPES);
  const attrs = { ...CLASSES[cls].attrs };
  for (const k in RACES[rc].bonus) attrs[k] += RACES[rc].bonus[k];
  attrs[pick(ATTRS)]++;
  return { cls, race: rc, type, attrs, points: RACES[rc].points };
}

function startWeapon(cls) {
  const c = CLASSES[cls];
  return { slot: 'arma', tier: 0, cls, name: c.weapons[0], dice: [WDICE[0][0], WDICE[0][1] + c.dieAdj], bonus: 0, mods: {} };
}

function createPlayer(name, h) {
  const P = {
    name, cls: h.cls, race: h.race, ptype: h.type, subclass: null, lvl: 1, xp: 0, fame: 0, kills: 0, gold: 20,
    attrs: { ...h.attrs }, points: h.points || 0, talents: [], talentOffer: null, talentPending: 0, killsPot: 0,
    equip: { arma: startWeapon(h.cls), armadura: { slot: 'armadura', tier: 0, name: 'Roupas de Viagem', ac: 0, mods: {} }, anel: null, amuleto: null },
    inv: Array(8).fill(null), pots: { hp: 3 }, balls: 3, bag: { grande: 0, ultra: 0, doce: 0, elixir: 1 }, ballSel: 'poke', story: { ch: 0, done: false },
    pets: [], petIdx: -1, quest: null, questOffer: null, elixT: 0, hasteT: 0, slowCd: 0, hms: [], fly: ['vila'], chests: [], flyCd: 0,
    x: rand(-40, 40), y: rand(10, 50), hp: 1, shootCd: 0, abilCd: 0, breathCd: 0, furia: 0, invis: 0, nextCrit: false,
    recallCd: 0, sinceHit: 10, face: 1, walk: 0, moving: false, aim: 0, tempType: null, tempTypeT: 0, alt: 0.14, auraT: 0, giftT: 0,
  };
  P.hp = maxHP(P);
  return P;
}

const SAVE_FIELDS = ['name', 'cls', 'race', 'ptype', 'subclass', 'lvl', 'xp', 'fame', 'kills', 'gold', 'attrs', 'points', 'talents', 'talentOffer',
  'talentPending', 'killsPot', 'equip', 'inv', 'pots', 'balls', 'bag', 'ballSel', 'story', 'hms', 'fly', 'chests', 'recentQ', 'pets', 'petIdx', 'quest', 'questOffer', 'hp'];
function saveGame() {
  if (!G || !G.P) return;
  const o = {};
  SAVE_FIELDS.forEach(k => { o[k] = G.P[k]; });
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) { /* ignora */ }
}
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; }
}

/* ---------- Talentos e subclasses ---------- */
function ensureTalentOffer(P) {
  if (P.talentOffer || P.talentPending <= 0) return;
  const pool = Object.keys(TALENTS).filter(k => !P.talents.includes(k)).sort(() => Math.random() - 0.5);
  if (!pool.length) { P.talentPending = 0; return; }
  P.talentOffer = pool.slice(0, 3);
  G.toasts.push({ text: '✨ Talento disponível! Escolha no painel ao lado.', color: '#c4b5fd', t: 4 });
  G.dirty = true;
}
function chooseTalent(id) {
  const P = G.P;
  if (!P.talentOffer || !P.talentOffer.includes(id)) return;
  const oldMax = maxHP(P);
  P.talents.push(id);
  P.talentOffer = null;
  P.talentPending--;
  P.hp += Math.max(0, maxHP(P) - oldMax);
  G.toasts.push({ text: `${TALENTS[id].icon} Talento aprendido: ${TALENTS[id].nome}`, color: '#c4b5fd', t: 3 });
  ensureTalentOffer(P);
  saveGame();
}
function chooseSubclass(id) {
  const P = G.P;
  if (P.subclass || P.lvl < 10 || !SUBCLASSES[P.cls].some(s => s.id === id)) return;
  const oldMax = maxHP(P);
  P.subclass = id;
  P.hp += Math.max(0, maxHP(P) - oldMax);
  const s = subInfo(id);
  G.toasts.push({ text: `${s.icon} Você agora é ${s.nome}!`, color: '#fde047', t: 3.5, big: 1 });
  G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 0, R: 140, life: 0.9, max: 0.9, color: '#fde047' });
  sfx('lvl');
  saveGame();
}

/* ---------- Itens (o resto está em items.js) ---------- */
function useStone(i) {
  const P = G.P, it = P.inv[i];
  P.inv[i] = null;
  P.tempType = it.type;
  P.tempTypeT = hasT(P, 'afinidade') ? 180 : 90;
  burst(P.x, P.y, TYPE_COLORS[it.type], 30);
  G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 0, R: 90, life: 0.6, max: 0.6, color: TYPE_COLORS[it.type] });
  G.toasts.push({ text: `💎 Você agora é do tipo ${TYPE_PT[it.type]}!`, color: TYPE_COLORS[it.type], t: 3 });
  sfx('lvl');
}

/* ---------- Inimigos ---------- */
// kind: 0 normal, 1 Alfa, 2 lendário, 3 chefe de masmorra, 4 raro (evento)
function enemyStats(pid, zone, kind) {
  const p = POKE[pid], st = p.stats;
  const atk = Math.max(st.attack || 55, st['special-attack'] || 55);
  const legend = kind === 2, dboss = kind === 3, alfa = kind === 1, rare = kind === 4;
  let type = p.types[0];
  if (type === 'normal' && p.types[1]) type = p.types[1];
  if (!PAT[type]) type = 'normal';
  const zf = 1 + (zone - 1) * 0.9;
  return {
    p, pid, zone, kind, boss: kind === 2 || kind === 3, legend, alfa, rare, type, color: TYPE_COLORS[type] || '#fff',
    name: (alfa ? 'Alfa ' : '') + p.name + (rare ? ' ✨' : ''),
    maxHp: Math.round(((st.hp || 50) * 0.35 + 8) * (1 + (zone - 1) * 1.1) * (legend ? 14 : dboss ? 8 : alfa ? 3 : rare ? 2.5 : 1)),
    ac: 9 + Math.floor((st.defense || 50) / 30) + zone + (legend ? 3 : dboss ? 2 : alfa ? 1 : 0),
    atk: 2 + Math.floor(atk / 35) + zone * 2 + (legend ? 3 : dboss ? 2 : alfa ? 1 : 0),
    dice: [legend ? 5 : dboss ? zone + 2 : zone + (alfa ? 1 : 0), 4 + 2 * Math.min(3, Math.floor(atk / 40)), Math.floor(zone * 1.5) + (legend ? 4 : dboss ? 2 : 0)],
    speed: (35 + (st.speed || 50) * 0.55) * (legend || dboss ? 0.6 : rare ? 1.5 : 1),
    scale: legend ? 4.2 : dboss ? 3.3 : clamp(1.7 + (p.height || 10) / 35, 1.7, 2.8) * (alfa || rare ? 1.3 : 1),
    xp: Math.round((p.exp || 100) * (0.4 + zone * 0.35) * (legend ? 12 : dboss ? 8 : alfa ? 3 : rare ? 4 : 1)),
    cdMul: 1 / (1 + (zone - 1) * 0.2),
  };
}

function makeEnemy(id, pid, zone, kind, x, y) {
  const s = enemyStats(pid, zone, kind);
  const iw = s.p.img ? s.p.img.width : 30, ih = s.p.img ? s.p.img.height : 30;
  const e = Object.assign(s, {
    id, x, y, tx: x, ty: y, hp: s.maxHp, cd: rand(0.6, 1.6), spin: Math.random() * 6.28, t: Math.random() * 10,
    wanderA: Math.random() * 6.28, wanderT: 0, idle: false, orbit: Math.random() < 0.5 ? 1 : -1, pref: rand(140, 260),
    flash: 0, phase: 0, phaseT: 0, face: -1, moving: false, w: iw * s.scale, h: ih * s.scale, dg: 0,
  });
  e.r = Math.max(12, Math.min(e.w, e.h) * 0.42);
  e.fly = s.p.types.includes('flying') && !s.p.types.includes('water');
  return e;
}

function hostSpawn(pid, zone, kind, x, y) {
  const e = makeEnemy(++G.nextId, pid, zone, kind, x, y);
  e.hx = x; e.hy = y; // "casa": para onde volta quando perde o interesse
  G.enemies.push(e); G.emap.set(e.id, e);
  return e;
}

// Tiros inimigos
function eShot(e, a, spd, o = {}) {
  const b = [e.id, Math.round(e.x), Math.round(e.y), +a.toFixed(3), Math.round(spd), o.r || (e.boss ? 7 : 5), o.life || (e.boss ? 5 : 2.6), o.wave || 0, o.home || 0];
  spawnEB(e, b);
  if (NET.mode === 'host' && NET.conns.size) NET.outB.push(b);
}
function spawnEB(e, b) {
  G.eb.push({
    x: b[1], y: b[2], a0: b[3], a: b[3], spd: b[4], r: b[5], life: b[6], wave: b[7], home: b[8], t: 0,
    color: e ? e.color : '#fff', atk: e ? e.atk : 5, dice: e ? e.dice : [1, 6, 0], src: e ? e.name : 'um Pokémon', type: e ? e.type : 'normal',
  });
}

const PAT = {
  normal: { cd: 1.2, f: (e, a) => eShot(e, a, 220) },
  fire: { cd: 1.5, f: (e, a) => { for (const k of [-1, 0, 1]) eShot(e, a + k * 0.25, 230); } },
  water: { cd: 2, f: e => { for (let i = 0; i < 8; i++) eShot(e, e.spin + i * Math.PI / 4, 150); e.spin += 0.2; } },
  grass: { cd: 0.45, f: e => { for (let i = 0; i < 3; i++) eShot(e, e.spin + i * 2.094, 140); e.spin += 0.35; } },
  electric: { cd: 1.4, f: (e, a) => { eShot(e, a, 430, { r: 4 }); eShot(e, a, 360, { r: 4 }); } },
  ice: { cd: 1.9, f: (e, a) => { for (let i = 0; i < 6; i++) eShot(e, e.spin + i * 1.047, 115, { r: 7 }); e.spin += 0.5; eShot(e, a, 230); } },
  fighting: { cd: 0.9, f: (e, a) => { eShot(e, a - 0.08, 330, { life: 0.9 }); eShot(e, a + 0.08, 330, { life: 0.9 }); } },
  poison: { cd: 1.8, f: (e, a) => { for (let i = 0; i < 5; i++) eShot(e, a + rand(-0.6, 0.6), rand(80, 150), { r: 8, life: 3.5 }); } },
  ground: { cd: 1.6, f: (e, a) => eShot(e, a, 150, { r: 12 }) },
  flying: { cd: 1.5, f: (e, a) => { for (const s of [270, 235, 200]) eShot(e, a, s); } },
  psychic: { cd: 1.7, f: (e, a) => eShot(e, a, 180, { home: 1.6, life: 3.2 }) },
  bug: { cd: 0.9, f: (e, a) => { for (let i = 0; i < 3; i++) eShot(e, a + rand(-0.4, 0.4), rand(180, 230)); } },
  rock: { cd: 1.9, f: (e, a) => { for (const k of [-1, 0, 1]) eShot(e, a + k * 0.3, 140, { r: 11 }); } },
  ghost: { cd: 1.4, f: (e, a) => { eShot(e, a, 190, { wave: 0.7 }); eShot(e, a, 190, { wave: -0.7 }); } },
  dragon: { cd: 2.2, f: (e, a) => { for (let k = -2; k <= 2; k++) eShot(e, a + k * 0.18, 250); for (let i = 0; i < 8; i++) eShot(e, e.spin + i * 0.785, 110); e.spin += 0.3; } },
  dark: { cd: 1.5, f: (e, a) => { for (const k of [-1, 0, 1]) eShot(e, a + k * 0.2, 210, { wave: 0.4 }); } },
  steel: { cd: 2.4, f: e => { for (let i = 0; i < 12; i++) eShot(e, e.spin + i * 0.5236, 130); e.spin += 0.26; } },
  fairy: { cd: 0.5, f: e => { for (let i = 0; i < 2; i++) eShot(e, e.spin + i * Math.PI, 150); e.spin += 0.4; } },
};
const BOSS_PH = [
  { cd: 0.9, dur: 5, f: e => { for (let i = 0; i < 20; i++) eShot(e, e.spin + i * 0.314, 150); e.spin += 0.15; } },
  { cd: 0.11, dur: 4, f: e => { for (let i = 0; i < 4; i++) eShot(e, e.spin + i * 1.5708, 180); e.spin += 0.22; } },
  { cd: 0.7, dur: 5, f: (e, a) => { for (let k = -3; k <= 3; k++) eShot(e, a + k * 0.14, 260); } },
  { cd: 0.5, dur: 5, f: (e, a) => PAT[e.type].f(e, a) },
];

function allPlayers() {
  const arr = [];
  const P = G.P;
  if (P) arr.push({ x: P.x, y: P.y, invis: P.invis > 0 });
  for (const r of G.remotes.values()) if (!r.dead && r.name) arr.push({ x: r.tx, y: r.ty, invis: r.invis });
  return arr;
}

function updateEnemiesHost(dt) {
  const T = allPlayers().filter(t => !t.invis && zoneAt(t.x, t.y) !== 0);
  for (const e of G.enemies) {
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    if (e.stT > 0) {
      e.stT -= dt;
      if (e.st === 3 || e.st === 4) { e.dotT -= dt; if (e.dotT <= 0) { e.dotT = 1; applyHit(e, (e.st === 3 ? d(4) : d(3)) + e.zone); if (e.dead) continue; } }
      if (e.stT <= 0) e.st = 0;
      else if (e.st === 1 || e.st === 5) { e.moving = false; continue; } // dormindo/congelado: não age
    }
    let tgt = null, best = 1e9;
    const aware = e.boss ? 750 : 560;
    for (const t of T) { const dd = Math.hypot(t.x - e.x, t.y - e.y); if (dd < best && dd < aware) { best = dd; tgt = t; } }
    let vx = 0, vy = 0;
    if (e.mig) {
      // revoada: atravessa o mapa em linha reta
      vx = e.mig.vx; vy = e.mig.vy;
      e.cd -= dt;
      if (tgt && e.cd <= 0 && best < 400) { PAT[e.type].f(e, Math.atan2(tgt.y - e.y, tgt.x - e.x)); e.cd = 1.6; }
    } else if (e.rare) {
      // raro: foge do jogador mais próximo e não ataca
      if (tgt && best < 450) { vx = -(tgt.x - e.x) / best * e.speed; vy = -(tgt.y - e.y) / best * e.speed; }
      else {
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderA = Math.random() * 6.28; e.wanderT = rand(1, 2.5); }
        vx = Math.cos(e.wanderA) * e.speed * 0.3; vy = Math.sin(e.wanderA) * e.speed * 0.3;
      }
    } else if (tgt) {
      e.calmT = 0;
      const dx = tgt.x - e.x, dy = tgt.y - e.y, dd = best || 1, ux = dx / dd, uy = dy / dd;
      const pref = e.boss ? 260 : e.pref;
      const f = dd > pref + 30 ? 1 : dd < pref - 30 ? -0.8 : 0;
      vx = (ux * f - uy * e.orbit * 0.6) * e.speed;
      vy = (uy * f + ux * e.orbit * 0.6) * e.speed;
      if (Math.random() < dt * 0.3) e.orbit *= -1;
      e.cd -= dt;
      const ang = e.st === 6 ? Math.random() * 6.28 : Math.atan2(dy, dx);
      if (e.boss) {
        e.phaseT += dt;
        if (e.phaseT > BOSS_PH[e.phase].dur) { e.phase = (e.phase + 1) % BOSS_PH.length; e.phaseT = 0; }
        if (e.cd <= 0) { BOSS_PH[e.phase].f(e, ang); e.cd = BOSS_PH[e.phase].cd * (e.kind === 3 ? 1.3 : e.cdBoss || 1); }
      } else if (e.cd <= 0 && dd < 460) {
        const pt = PAT[e.type];
        if (!(e.st === 2 && Math.random() < 0.4)) pt.f(e, ang);
        e.cd = pt.cd * e.cdMul * rand(0.85, 1.2);
      }
    } else {
      // sem ninguém para atacar: perde o interesse, volta para casa (longe da vila) e passeia por lá
      e.calmT = (e.calmT || 0) + dt;
      let hx = e.hx === undefined ? e.x : e.hx, hy = e.hy === undefined ? e.y : e.hy;
      if (!e.dg && Math.hypot(hx, hy) < VILA_R + 260) { const k = (VILA_R + 420) / (Math.hypot(hx, hy) || 1); hx *= k; hy *= k; e.hx = hx; e.hy = hy; }
      const dh = Math.hypot(hx - e.x, hy - e.y);
      if (!e.dg && e.calmT > 0.8 && dh > 220) {
        vx = (hx - e.x) / dh * e.speed * 0.7; vy = (hy - e.y) / dh * e.speed * 0.7;
      } else {
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderA = Math.random() * 6.28; e.wanderT = rand(1.5, 3.5); e.idle = Math.random() < 0.35; }
        if (!e.idle) { vx = Math.cos(e.wanderA) * e.speed * 0.35; vy = Math.sin(e.wanderA) * e.speed * 0.35; }
      }
      // fora de combate recupera vida
      if (G.time - (e.hitT || -99) > 4 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * (e.boss ? 0.02 : 0.08) * dt);
    }
    if (e.slowT > 0) { e.slowT -= dt; vx *= 0.4; vy *= 0.4; }
    if (e.st === 2) { vx *= 0.5; vy *= 0.5; }
    if (e.st === 6) { vx = Math.cos(e.t * 3) * e.speed * 0.5; vy = Math.sin(e.t * 2.3) * e.speed * 0.5; }
    const nx = e.x + vx * dt, ny = e.y + vy * dt;
    if (e.dg) {
      const rr = Math.min(e.r, 18);
      if (walkableR(nx, e.y, rr)) e.x = nx; else { vx = 0; e.wanderA = Math.PI - e.wanderA; e.orbit *= -1; }
      if (walkableR(e.x, ny, rr)) e.y = ny; else { vy = 0; e.wanderA = -e.wanderA; }
    } else {
      // cada Pokémon fica na própria zona (não invade áreas mais fáceis)
      // aquáticos só nadam; voadores passam por cima da água
      const zn = zoneAt(nx, ny);
      const ok = e.mig || e.boss || (e.aqua ? isWater(nx, ny) && (zn < 1 || zn >= e.zone) : (zn >= e.zone || (e.fly && zn < 0)) && !solidAt(nx, ny, e.fly ? 1 : 0));
      if (ok) { e.x = nx; e.y = ny; } else { vx = vy = 0; e.wanderA += Math.PI; e.orbit *= -1; }
      pushOutTown(e);
      clampWorld(e);
    }
    e.moving = Math.abs(vx) + Math.abs(vy) > 1;
    if (Math.abs(vx) > 5) e.face = vx > 0 ? 1 : -1;
  }
}

function updateEnemiesClient(dt) {
  for (const e of G.enemies) {
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    const dx = e.tx - e.x, dy = e.ty - e.y;
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) { e.x = e.tx; e.y = e.ty; }
    else { const k = Math.min(1, dt * 10); e.x += dx * k; e.y += dy * k; }
    e.moving = Math.abs(dx) + Math.abs(dy) > 2;
    if (Math.abs(dx) > 1) e.face = dx > 0 ? 1 : -1;
  }
}

function hostSpawning(dt) {
  G.spawnT -= dt;
  if (G.spawnT > 0) return;
  G.spawnT = 0.35;
  const pls = allPlayers().filter(p => !inDungeonArea(p.x));
  if (!pls.length) return;
  G.enemies = G.enemies.filter(e => {
    if (e.boss || e.dg || e.ev) return true;
    const near = pls.some(p => Math.hypot(e.x - p.x, e.y - p.y) < 1600);
    if (!near) G.emap.delete(e.id);
    return near;
  });
  const pl = pick(pls);
  let near = 0;
  for (const e of G.enemies) if (!e.boss && !e.dg && !e.ev && Math.hypot(e.x - pl.x, e.y - pl.y) < 1100) near++;
  const zp = Math.max(1, zoneAt(pl.x, pl.y));
  if (near >= 14 + zp * 4 + (pls.length > 1 ? 5 : 0)) return;
  let x = 0, y = 0, water = false;
  for (let k = 0; k < 4; k++) {
    const a = Math.random() * 6.28, dist = rand(600, 950);
    x = pl.x + Math.cos(a) * dist; y = pl.y + Math.sin(a) * dist;
    if (isWater(x, y)) { if (Math.random() < 0.6) { water = true; break; } continue; }
    if (!solidAt(x, y) && tileKind(x, y) === TK.TALL) break;
  }
  if (!water && (solidAt(x, y) || isWater(x, y))) return;
  let z = zoneAt(x, y);
  if (water && z < 1) z = zp;
  if (z < 1 || z > zp + 1) return;
  const night = !water && isNight() && Math.random() < 0.5 ? NIGHT_POOL.filter(id => POKE[id]) : [];
  const pid = water ? pick(WATER_POOLS[z]) : night.length ? pick(night) : pick(ZONE_POOLS[z]);
  if (!POKE[pid]) return;
  const n = randi(z >= 2 ? 2 : 1, z >= 3 ? 4 : 3);
  for (let i = 0; i < n; i++) {
    const ex = x + rand(-50, 50), ey = y + rand(-50, 50);
    if (water && !isWater(ex, ey)) continue;
    const e = hostSpawn(pid, z, Math.random() < 0.04 ? 1 : 0, ex, ey);
    if (water && !e.fly) e.aqua = true;
  }
}

function hostBoss(dt) {
  G.bossT -= dt;
  if (G.bossT > 0) return;
  G.bossT = 150;
  if (G.enemies.some(e => e.legend) || !allPlayers().some(p => !inDungeonArea(p.x))) return;
  const pid = pick(BOSSES);
  if (!POKE[pid]) return;
  const [bx, by] = randomZonePoint(4);
  hostSpawn(pid, 4, 2, bx, by);
  emitEvent({ t: 'toast', text: `⚠ ${POKE[pid].name} lendário surgiu nas Terras Sombrias!`, color: '#f87171', big: 1 });
}

function applyHit(e, dmg) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = 0.1; e.hitT = G.time;
  if (e.hp <= 0) {
    e.dead = true;
    emitEvent({ t: 'k', id: e.id, pid: e.pid, x: Math.round(e.x), y: Math.round(e.y), xp: e.xp, zone: e.zone, kind: e.kind, name: e.name, type: e.type, st: e.story || (e.bountyT !== undefined ? 10 + e.bountyT : 0) });
    if (e.bkey) G.bountyCd[e.bkey] = G.time + 20;
    if (e.story) G.storyCd[e.story] = G.time + 30;
    hostOnKill(e);
    if (e.kind === 4) hostEventTargetGone(e);
  }
}

function onKill(m) {
  const e = G.emap.get(m.id);
  const mine = e && G.time - (e.mineT || -9) < 1.5;
  if (e) {
    burst(e.x, e.y, e.color, e.boss ? 60 : 16);
    G.emap.delete(m.id);
    G.enemies = G.enemies.filter(x => x.id !== m.id);
  }
  if (m.kind === 2) G.toasts.push({ text: `🏆 ${m.name} foi derrotado!`, color: '#facc15', t: 4, big: 1 });
  const P = G.P;
  if (!P || Math.hypot(P.x - m.x, P.y - m.y) > 900) return;
  P.kills++;
  P.killsPot = (P.killsPot || 0) + 1;
  if (hasT(P, 'alquimista') && P.killsPot % 10 === 0) { P.pots.hp++; text(P.x, P.y - 60, '+1 Poção (Alquimista)', '#fca5a5', 12); }
  if (hasT(P, 'domador') && P.killsPot % 15 === 0) { P.balls++; text(P.x, P.y - 70, '+1 Pokébola (Domador)', '#e5e7eb', 12); }
  const gold = Math.round(m.zone * randi(1, 3) * ([1, 4, 25, 12, 6][m.kind] || 1) * (hasT(P, 'tesouro') ? 1.5 : 1) * (1 + M(P, 'gold')));
  P.gold += gold;
  text(m.x + 12, m.y - 10, `+${gold}🪙`, '#fde047', 11);
  if (mine && hasS(P, 'necromante') && Math.random() < 0.3 && !m.kind) addSpirit(m.pid);
  const p = POKE[m.pid];
  questProgress('tipo', { types: p ? p.types : [m.type] });
  questProgress('coleta', { types: p ? p.types : [m.type] });
  if (m.st >= 10) questProgress('caca', { pid: m.pid });
  questProgress('especie', { pid: m.pid });
  if (!inDungeonArea(m.x)) questProgress('zona', { zone: m.zone });
  if (m.kind === 1) questProgress('alfa');
  if (m.kind === 3) questProgress('masmorra');
  const xp = Math.round(m.xp * (1 + M(P, 'xp')));
  gainXP(xp);
  petGainXP(xp * (isNight() ? 1.5 : 1));
  storyKill(m);
  rollLoot(m);
  G.dirty = true;
}

/* ---------- Jogador ---------- */
function gainXP(n, raw) {
  const P = G.P;
  if (!raw && isNight()) n = Math.round(n * 1.25);
  P.fame += n;
  if (P.lvl >= 20) return;
  P.xp += n;
  text(P.x, P.y - 46, `+${n} XP`, '#a7f3d0', 12);
  while (P.lvl < 20 && P.xp >= xpNeed(P.lvl)) {
    P.xp -= xpNeed(P.lvl);
    P.lvl++;
    if (P.lvl % 2 === 0) P.points++;
    if (P.lvl % 4 === 0) P.talentPending++;
    P.hp = maxHP(P);
    G.toasts.push({ text: `⭐ Nível ${P.lvl}!${P.lvl % 2 === 0 ? ' +1 ponto de atributo' : ''}`, color: '#fde047', t: 3 });
    if (P.lvl === 10) G.toasts.push({ text: '🏅 Nível 10: escolha sua subclasse no painel!', color: '#fde047', t: 5, big: 1 });
    G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 0, R: 120, life: 0.8, max: 0.8, color: '#fde047' });
    sfx('lvl');
    G.dirty = true;
    ensureTalentOffer(P);
    saveGame();
  }
  if (P.lvl >= 20) P.xp = 0;
}

function mouseWorld() { return { x: mouse.x - W / 2 + G.cam.x, y: mouse.y - H / 2 + G.cam.y }; }

// projétil aliado (do jogador ou de um companheiro); é replicado como cosmético para os outros
function spawnPB(o) {
  const b = {
    ox: o.x, oy: o.y, x: o.x, y: o.y, dx: Math.cos(o.a), dy: Math.sin(o.a), a: o.a, spd: o.spd, t: 0, life: o.life,
    amp: o.amp || 0, ph: o.ph || 0, r: o.r, color: o.color, shape: o.shape, pierce: !!o.pierce, hit: o.pierce ? new Set() : null, ally: o.ally || null, sp: o.sp || 0, spell: o.spell || 0,
  };
  G.pb.push(b);
  if (netActive()) NET.outS.push([Math.round(b.ox), Math.round(b.oy), +o.a.toFixed(3), b.spd, +b.life.toFixed(2), b.amp, +b.ph.toFixed(2), b.r, b.shape, b.color]);
  return b;
}
function shootBullet(a, o = {}) {
  const P = G.P, w = CLASSES[P.cls].wpn;
  spawnPB({
    a, spd: o.spd || w.speed, life: (o.life || w.life) * rangeMul(P), amp: w.wave ? 14 : 0, ph: o.ph || 0,
    r: o.r || w.size, color: o.color || (P.tempTypeT > 0 ? TYPE_COLORS[P.tempType] : w.color), shape: o.shape || w.shape, pierce: o.pierce || w.pierce || M(P, 'pierce') > 0, spell: o.spell, x: o.x !== undefined ? o.x : P.x, y: o.y !== undefined ? o.y : P.y,
  });
}
function addCosmetic(s) {
  const [ox, oy, a, spd, life, amp, ph, r, shape, color] = s;
  G.cb.push({ ox, oy, x: ox, y: oy, dx: Math.cos(a), dy: Math.sin(a), a, spd, t: 0, life, amp, ph, r, shape, color });
}

function playerShoot() {
  const P = G.P, w = CLASSES[P.cls].wpn;
  for (let i = 0; i < w.shots; i++) shootBullet(P.aim, { ph: i * Math.PI });
  if (hasT(P, 'atirador')) { P.alt = -P.alt; shootBullet(P.aim + P.alt); }
  if (Math.random() < 0.5) sfx('shoot');
}

// aplica a tabela de tipos a um ataque aliado
function typed(P, e, dmg, atkType) {
  let eff = typeEff(atkType, e.p.types);
  if (eff > 1 && hasT(P, 'adepto')) eff *= 1.5;
  return { dmg: Math.max(1, Math.round(dmg * eff)), eff };
}
function hitText(e, dmg, eff, crit, hit, extra = '') {
  const col = crit ? '#facc15' : eff > 1 ? '#fb923c' : eff < 1 ? '#8aa0b8' : hit ? '#ffffff' : '#9ca3af';
  text(e.x + rand(-8, 8), e.y - e.h / 2, `${dmg}${crit ? '!' : ''}${extra}`, col, crit ? 18 : eff > 1 ? 16 : hit ? 14 : 11);
  if (eff !== 1 && G.time - (e.effT || -9) > 1.5) {
    e.effT = G.time;
    text(e.x, e.y - e.h / 2 - 18, eff > 1 ? 'Super efetivo!' : 'Pouco efetivo...', eff > 1 ? '#fb923c' : '#8aa0b8', 12);
  }
}

function useAbility() {
  const P = G.P;
  if (P.abilCd > 0) return;
  if ((P.cls === 'mago' || P.cls === 'patrulheiro') && !inDungeonArea(P.x) && inTown(P.x, P.y)) { text(P.x, P.y - 40, '🕊️ Não dá para atacar de dentro da vila', '#fef3c7', 12); return; }
  P.abilCd = abilCd(P);
  const mw = mouseWorld(), tp = pType(P);
  if (P.cls === 'guerreiro') {
    // Elmo: Berserk para você e quem estiver perto
    emitEvent({ t: 'buff', k: 'furia', x: Math.round(P.x), y: Math.round(P.y), dur: hasS(P, 'barbaro') ? 7 : 5, name: P.name });
    emitEvent({ t: 'fx', x: P.x, y: P.y, r: 160, color: '#ef4444' });
    if (hasS(P, 'paladino')) emitEvent({ t: 'heal', x: Math.round(P.x), y: Math.round(P.y), amt: roll(2, 8) + P.lvl, name: P.name });
    sfx('boom');
  } else if (P.cls === 'mago') {
    // Feitiço: bomba de projéteis no cursor
    let dx = mw.x - P.x, dy = mw.y - P.y;
    const dd = Math.hypot(dx, dy);
    if (dd > 380) { dx *= 380 / dd; dy *= 380 / dd; }
    const tx = P.x + dx, ty = P.y + dy, n = hasS(P, 'evocador') ? 28 : 20;
    for (let i = 0; i < n; i++) shootBullet(i * Math.PI * 2 / n, { x: tx, y: ty, spd: 330, life: 0.55, r: 6, color: TYPE_COLORS[tp], shape: 'orb', spell: 1 });
    emitEvent({ t: 'fx', x: tx, y: ty, r: 50, color: TYPE_COLORS[tp] });
    sfx('boom');
  } else if (P.cls === 'ladino') {
    // Manto: invisibilidade
    if (hasS(P, 'trapaceiro')) {
      let dx = mw.x - P.x, dy = mw.y - P.y;
      const dd = Math.hypot(dx, dy);
      if (dd > 250) { dx *= 250 / dd; dy *= 250 / dd; }
      burst(P.x, P.y, '#6b7280', 16);
      if (walkableR(P.x + dx, P.y + dy, 10) && !solidR(P.x + dx, P.y + dy, 10)) { P.x += dx; P.y += dy; }
    }
    P.invis = hasS(P, 'trapaceiro') ? 5 : 3; P.nextCrit = true;
    burst(P.x, P.y, '#6b7280', 20);
  } else if (P.cls === 'clerigo') {
    // Tomo: cura em área
    const amt = Math.round((roll(2 + Math.floor(P.lvl / 3), 8) + A(P, 'VIG')) * (hasS(P, 'vida') ? 1.5 : 1));
    emitEvent({ t: 'heal', x: Math.round(P.x), y: Math.round(P.y), amt: Math.max(1, amt), name: P.name });
    if (hasS(P, 'guerra')) emitEvent({ t: 'buff', k: 'pressa', x: Math.round(P.x), y: Math.round(P.y), dur: 4, name: P.name });
  } else if (P.cls === 'patrulheiro') {
    // Aljava: flechada pesada que perfura e deixa lento
    shootBullet(P.aim, { spd: 600, life: 0.9, r: 12, color: '#fde047', shape: 'arrow', pierce: true, spell: 2 });
    sfx('crit');
  }
}

function dealDamage(e, dmg, slow) {
  e.flash = 0.1;
  e.mineT = G.time;
  if (isHost()) { if (slow) e.slowT = slow; applyHit(e, dmg); }
  else { e.hp -= dmg; e.localHitT = G.time; if (NET.host && NET.host.open) NET.host.send(slow ? { t: 'h', id: e.id, dmg, slow } : { t: 'h', id: e.id, dmg }); }
}

function playerHit(e, b) {
  if (b && b.ally) return allyHit(e, b.ally, b.sp);
  const P = G.P, c = CLASSES[P.cls], w = P.equip.arma;
  let r = d(20);
  if (hasT(P, 'sortudo')) r = Math.max(r, d(20));
  if (r === 1 && P.race === 'halfling') r = d(20);
  const crit = r >= critMin(P) || P.nextCrit;
  P.nextCrit = false;
  const hit = crit || (r !== 1 && r + toHit(P) >= e.ac);
  const sp = b ? b.spell : 0;
  let dmg = sp === 1 ? roll((1 + Math.floor(P.lvl / 6)) * (crit ? 2 : 1), 6) + Math.floor(A(P, 'POD') / 2) + (hasS(P, 'evocador') ? d(8) : 0)
    : sp === 2 ? roll((3 + Math.floor(P.lvl / 3)) * (crit ? 2 : 1), 8) + A(P, 'POD')
      : roll(w.dice[0] * (crit ? 2 : 1), w.dice[1]) + A(P, 'POD') + w.bonus + M(P, 'dmg');
  if (P.furia > 0) dmg += d(6);
  if (P.elixT > 0) dmg += 2;
  if (P.tempTypeT > 0) dmg += d(4);
  if (hasS(P, 'guerra')) dmg += d(6);
  if (crit && P.cls === 'ladino') dmg += roll(Math.ceil(P.lvl / 2), 6);
  if (crit && hasS(P, 'assassino')) dmg = Math.round(dmg * 1.5);
  dmg = Math.max(1, dmg);
  if (!hit) dmg = Math.max(1, Math.floor(dmg / 2));
  const res = typed(P, e, dmg, pType(P));
  dealDamage(e, res.dmg, sp === 2 ? 3 : 0);
  hitText(e, res.dmg, res.eff, crit, hit);
  // dano elemental extra das armas encantadas
  for (const et of MA(P, 'etype')) {
    const x = typed(P, e, d(6), et);
    dealDamage(e, x.dmg);
    if (Math.random() < 0.3) text(e.x + rand(-14, 14), e.y - e.h / 2 + 12, `+${x.dmg}`, TYPE_COLORS[et], 11);
  }
  const steal = M(P, 'steal');
  if (steal) P.hp = Math.min(maxHP(P), P.hp + res.dmg * steal);
  if (hasS(P, 'arcano')) {
    for (const o of G.enemies) {
      if (o === e || o.hp <= 0 || Math.hypot(o.x - e.x, o.y - e.y) > 70 + o.r) continue;
      const s = typed(P, o, Math.max(1, Math.floor(dmg / 2)), pType(P));
      dealDamage(o, s.dmg); hitText(o, s.dmg, s.eff, false, true);
    }
    G.fx.push({ k: 'ring', x: e.x, y: e.y, r: 0, R: 70, life: 0.25, max: 0.25, color: '#fbbf24' });
  }
  if (crit) {
    sfx('crit');
    if (hasT(P, 'vampirico')) P.hp = Math.min(maxHP(P), P.hp + Math.ceil(res.dmg * 0.3));
  }
}

function enemyAttack(b) {
  const P = G.P;
  const r = d(20), crit = r === 20;
  if (r === 1 || Math.random() < M(P, 'dodge')) { text(P.x, P.y - 34, 'Esquiva!', '#93c5fd', 12); return; }
  const graze = !crit && r + b.atk < AC(P);
  let eff = typeEff(b.type, [pType(P)]);
  if (race(P).resist.includes(b.type) || MA(P, 'resist').includes(b.type)) eff *= 0.5;
  if (graze) eff *= 0.34;
  if (P.furia > 0 && hasS(P, 'barbaro')) eff *= 0.5;
  const dmg = Math.max(1, Math.round((roll(b.dice[0] * (crit ? 2 : 1), b.dice[1]) + b.dice[2]) * eff));
  P.hp -= dmg; P.sinceHit = 0;
  G.shake = Math.min(8, G.shake + 2 + dmg * 0.3);
  const tag = graze ? ' (bloqueado)' : crit ? ' CRÍTICO' : eff > 1 ? ' super efetivo' : eff < 1 ? ' resistido' : '';
  text(P.x, P.y - 34, `-${dmg}${tag}`, graze ? '#cbd5e1' : eff > 1 ? '#ff5e5e' : eff < 1 ? '#fda4af' : '#f87171', graze ? 11 : crit || eff > 1 ? 16 : 14);
  sfx('hurt');
  if (P.hp <= 0) playerDie(b.src);
}

function usePotion() {
  const P = G.P;
  if (!P || P.pots.hp <= 0 || P.hp >= maxHP(P)) return;
  const h = Math.round(Math.max(roll(2, 4) + 2, maxHP(P) * 0.3) * (hasT(P, 'alquimista') ? 1.5 : 1));
  P.hp = Math.min(maxHP(P), P.hp + h);
  text(P.x, P.y - 34, `+${h}`, '#86efac', 15);
  P.pots.hp--;
  sfx('pot');
  G.dirty = true;
}

function heroLabel(P) {
  const s = P.subclass ? subInfo(P.subclass) : null;
  return `${race(P).nome} ${s ? s.nome : CLASSES[P.cls].nome}`;
}

function playerDie(src) {
  const P = G.P;
  burst(P.x, P.y, '#ef4444', 40);
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignora */ }
  let hall = [];
  try { hall = JSON.parse(localStorage.getItem(HALL_KEY) || '[]'); } catch (e) { /* ignora */ }
  hall.push({ name: P.name, cls: heroLabel(P), lvl: P.lvl, fame: P.fame, kills: P.kills, src, date: new Date().toLocaleDateString('pt-BR') });
  hall.sort((a, b) => b.fame - a.fame);
  try { localStorage.setItem(HALL_KEY, JSON.stringify(hall.slice(0, 10))); } catch (e) { /* ignora */ }
  emitEvent({ t: 'chat', sys: 1, text: `☠ ${P.name} (${heroLabel(P)} Nv ${P.lvl}) foi derrotado por ${src}.` });
  $('death-info').innerHTML = `<p><b>${esc(P.name)}</b>, ${heroLabel(P)} de nível ${P.lvl}, foi derrotado por <b>${esc(src)}</b>.</p>
    <div class="dstats"><div><span>Fama</span><b>${P.fame}</b></div><div><span>Pokémon derrotados</span><b>${P.kills}</b></div><div><span>Companheiros</span><b>${P.pets.length}</b></div></div>`;
  G.P = null;
  G.allies = [];
  if (G.npcOpen) closeNPC();
  setTimeout(() => $('death').classList.remove('hidden'), 900);
}

function areaName(x, y) {
  if (inDungeonArea(x)) { const dg = dungeonAt(x); return dg ? THEMES[dg.theme].nome : ''; }
  const z = zoneAt(x, y);
  return z >= 0 ? ZONES[z].nome : '';
}

function updatePlayer(dt) {
  const P = G.P;
  const mx = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
  const my = (K.KeyS || K.ArrowDown ? 1 : 0) - (K.KeyW || K.ArrowUp ? 1 : 0);
  const inDg = inDungeonArea(P.x);
  if (inDg && !dungeonAt(P.x)) {
    P.x = rand(-50, 50); P.y = rand(-50, 50);
    G.toasts.push({ text: 'A masmorra desmoronou! Você foi levado de volta à vila.', color: '#fca5a5', t: 3 });
    return;
  }
  P.moving = !!(mx || my);
  if (P.moving) {
    const mp = activePet(P), fl = P.riding && mp && rideFlies(mp.pid);
    const l = Math.hypot(mx, my), sp = moveSpeed(P) * (P.riding ? (fl ? 1.6 : 1.45) : P.wading ? 0.65 : 1);
    const nx = P.x + mx / l * sp * dt, ny = P.y + my / l * sp * dt;
    if (inDg) { if (walkableR(nx, P.y, 10)) P.x = nx; if (walkableR(P.x, ny, 10)) P.y = ny; }
    else {
      const sw = swimFlags(P), stuck = solidR(P.x, P.y, 9, sw);
      let blocked = false;
      if (stuck || !solidR(nx, P.y, 9, sw)) P.x = nx; else blocked = true;
      if (stuck || !solidR(P.x, ny, 9, sw)) P.y = ny; else blocked = true;
      if (blocked && !(sw & 1) && isDeep(P.x + mx * 16, P.y + my * 16) && G.time - (G.deepWarn || -9) > 5) {
        G.deepWarn = G.time;
        G.toasts.push({ text: '🌊 A água é funda demais. Um companheiro com Surfar (MO03) leva você.', color: '#93c5fd', t: 3 });
      }
      clampWorld(P);
    }
    P.walk += dt;
  }
  if (G.recall) {
    G.recall.t -= dt;
    if (P.moving || P.sinceHit < 0.05) { G.recall = null; text(P.x, P.y - 40, 'Retorno cancelado', '#fca5a5', 12); }
    else if (G.recall.t <= 0) { G.recall = null; burst(P.x, P.y, '#fde68a', 20); P.x = rand(-50, 50); P.y = rand(10, 50); P.recallCd = 45; burst(P.x, P.y, '#fde68a', 20); sfx('pot'); }
  }
  const wasSurf = P.surfing;
  if (P.riding && (inDg || !activePet(P) || !G.allies.some(a => a.pet) || !canRide(activePet(P).pid) || G.evo)) P.riding = false;
  P.surfing = !inDg && !P.riding && isDeep(P.x, P.y) && petKnows(P, 'surf');
  P.wading = !inDg && !P.surfing && !P.riding && isWater(P.x, P.y);
  if (P.surfing && !wasSurf) text(P.x, P.y - 44, `🌊 ${activePet(P).name} usou Surfar!`, '#93c5fd', 13);
  const mw = mouseWorld();
  P.aim = Math.atan2(mw.y - P.y, mw.x - P.x);
  P.face = Math.cos(P.aim) >= 0 ? 1 : -1;

  P.abilCd = Math.max(0, P.abilCd - dt);
  P.breathCd = Math.max(0, P.breathCd - dt);
  P.furia = Math.max(0, P.furia - dt);
  P.elixT = Math.max(0, (P.elixT || 0) - dt);
  P.hasteT = Math.max(0, (P.hasteT || 0) - dt);
  P.invis = Math.max(0, P.invis - dt);
  P.recallCd = Math.max(0, P.recallCd - dt);
  if (P.tempTypeT > 0) {
    P.tempTypeT -= dt;
    if (P.tempTypeT <= 0) { P.tempType = null; G.toasts.push({ text: `O cristal se apagou. Você voltou a ser tipo ${TYPE_PT[P.ptype]}.`, color: '#cbd5e1', t: 3 }); }
  }
  if (hasS(P, 'vida')) {
    P.auraT -= dt;
    if (P.auraT <= 0) { P.auraT = 4; emitEvent({ t: 'heal', x: Math.round(P.x), y: Math.round(P.y), amt: 2 + Math.floor(P.lvl / 2), name: P.name, quiet: 1 }); }
  }
  P.sinceHit += dt;

  const inV = !inDg && inTown(P.x, P.y);
  const regenK = (hasT(P, 'regeneracao') ? 2.5 : 1) * (1 + M(P, 'regen'));
  if (P.sinceHit > 5 || inV) P.hp = Math.min(maxHP(P), P.hp + (0.3 + A(P, 'VIG') * 0.2 + P.lvl * 0.05) * (inV ? 12 : 1) * regenK * dt);

  P.shootCd -= dt;
  // a vila é zona de paz: ninguém ataca de dentro dela
  const safe = !inDg && inTown(P.x, P.y);
  if ((mouse.down || autofire) && state === 'play' && !G.npcOpen && !safe) {
    while (P.shootCd <= 0) { playerShoot(); P.shootCd += 1 / fireRate(P); }
  } else {
    if (P.shootCd < 0) P.shootCd = 0;
    if (safe && mouse.down && !G.npcOpen && G.time - (G.peaceWarn || -9) > 4) { G.peaceWarn = G.time; text(P.x, P.y - 40, '🕊️ Não dá para atacar de dentro da vila', '#fef3c7', 12); }
  }

  const area = inDg ? 'dg' + dungeonAt(P.x).id : 'z' + zoneAt(P.x, P.y);
  if (area !== G.area) { G.area = area; G.banner = 2.5; }
  G.nearPortal = nearPortal(P);

  // saques
  for (const bag of G.bags) {
    const d2 = (bag.x - P.x) ** 2 + (bag.y - P.y) ** 2;
    // quem soltou o item só pega de volta depois de se afastar
    if (bag.wait) { if (d2 > 50 * 50) bag.wait = false; continue; }
    if (d2 > 30 * 30) continue;
    const left = [];
    for (let it of bag.items) {
      if (it.slot === 'pot') { P.pots.hp++; text(P.x, P.y - 50, '+1 Poção de Cura', '#fca5a5', 12); continue; }
      if (it.slot === 'ball') { P.balls++; text(P.x, P.y - 50, '+1 Pokébola', '#e5e7eb', 12); continue; }
      if (it.slot === 'cons' && CONS[it.k].stat) { drinkStat(P, CONS[it.k].stat); continue; }
      if (it.slot === 'cons') { P.bag[it.k] = (P.bag[it.k] || 0) + 1; text(P.x, P.y - 50, `+1 ${CONS[it.k].nome}`, '#f9a8d4', 12); continue; }
      const i = P.inv.indexOf(null);
      if (i < 0) { left.push(it); continue; }
      it = adaptWeapon(it, P);
      P.inv[i] = it;
      text(P.x, P.y - 50, it.name, itemColor(it), 13);
    }
    if (left.length && G.time - G.fullWarn > 3) { G.fullWarn = G.time; G.toasts.push({ text: 'Mochila cheia! (venda na loja ou solte no chão com botão direito)', color: '#fca5a5', t: 2.5 }); }
    if (left.length !== bag.items.length) {
      G.dirty = true; sfx('pick');
      if (bag.id) emitEvent({ t: 'bag', id: bag.id, items: left });
    }
    bag.items = left;
  }
}

function useElixir() {
  const P = G.P;
  if (!P || !P.bag.elixir) return;
  P.bag.elixir--; P.elixT = 30;
  text(P.x, P.y - 40, '🧪 Elixir de Poder!', '#f0abfc', 14);
  sfx('pot');
  G.dirty = true;
}
// solta itens no chão; todo mundo na sala vê e pode pegar por 3 minutos
function dropItems(items) {
  const P = G.P;
  emitEvent({ t: 'drop', id: NET.myId + '-' + (++G.dropN), x: Math.round(P.x), y: Math.round(P.y + 16), items, name: P.name });
  sfx('pick');
}
function exportSave() {
  saveGame();
  const s = loadSave();
  if (!s) return;
  const blob = new Blob([JSON.stringify({ game: 'pokerealm', v: 2, date: new Date().toISOString(), save: s }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pokerealm-${s.name.replace(/[^\w-]+/g, '_')}-nv${s.lvl}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  if (G) G.toasts.push({ text: '💾 Arquivo de save baixado!', color: '#86efac', t: 2.5 });
}

/* ---------- Efeitos ---------- */
function text(x, y, s, color, size = 14) { G.texts.push({ x, y, s, color, size, t: 0, life: 1 }); }
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = rand(40, 220);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.8), color, size: rand(2, 5) });
  }
}

function handleEvent(m, local) {
  switch (m.t) {
    case 'chat': {
      G.chat.push({ name: m.name, text: m.text, sys: m.sys, t: G.time });
      if (G.chat.length > 7) G.chat.shift();
      if (!m.sys) {
        const who = local ? G.P : G.remotes.get(m.from);
        if (who) who.bubble = { text: m.text, t: 5 };
      }
      break;
    }
    case 'toast':
      G.toasts.push({ text: m.text, color: m.color, t: 5, big: m.big });
      if (m.big) sfx('boss');
      break;
    case 'heal': {
      const P = G.P;
      if (P && Math.hypot(P.x - m.x, P.y - m.y) < 220) {
        const before = P.hp;
        P.hp = Math.min(maxHP(P), P.hp + m.amt);
        const h = Math.round(P.hp - before);
        if (h > 0 && !(m.quiet && local)) text(P.x, P.y - 34, local ? `+${h}` : `+${h} (${m.name})`, '#86efac', m.quiet ? 11 : 15);
      }
      if (!m.quiet) G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 0, R: 220, life: 0.6, max: 0.6, color: '#fde68a' });
      break;
    }
    case 'fx':
      G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 0, R: m.r, life: 0.5, max: 0.5, color: m.color, fill: true });
      break;
    case 'k': onKill(m); break;
    case 'drop':
      if (!G.bags.some(b => b.id === m.id)) G.bags.push({ id: m.id, x: m.x, y: m.y, items: m.items, life: 180, shared: 1, wait: m.from === NET.myId, who: m.name });
      break;
    case 'bag': { const b = G.bags.find(x => x.id === m.id); if (b) b.items = m.items; break; }
    case 'cut': cutTile(m.i); break;
    case 'buff': {
      const P = G.P;
      if (P && Math.hypot(P.x - m.x, P.y - m.y) < 240) {
        if (m.k === 'furia') P.furia = Math.max(P.furia, m.dur); else P.hasteT = Math.max(P.hasteT || 0, m.dur);
        if (!local) text(P.x, P.y - 44, m.k === 'furia' ? `Berserk! (${m.name})` : `Pressa! (${m.name})`, '#fca5a5', 12);
      }
      break;
    }
    case 'met': G.meteors.push({ x: m.x, y: m.y, r: m.r, t: m.delay, max: m.delay, zone: m.zone || 1 }); break;
    case 'evdone': onEventDone(m); break;
  }
}

/* ---------- Som ---------- */
let AC_ = null;
function sfx(k) {
  if (!soundOn) return;
  try {
    if (!AC_) AC_ = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC_.createOscillator(), g = AC_.createGain(), t = AC_.currentTime;
    const S = {
      shoot: [520, 300, 0.05, 'square', 0.015], hurt: [180, 80, 0.15, 'sawtooth', 0.06], crit: [880, 1320, 0.08, 'triangle', 0.05],
      lvl: [440, 990, 0.4, 'triangle', 0.08], boom: [120, 40, 0.35, 'sawtooth', 0.08], pot: [600, 900, 0.12, 'sine', 0.06],
      pick: [700, 1000, 0.08, 'sine', 0.05], boss: [90, 60, 0.9, 'sawtooth', 0.08],
    }[k];
    if (!S) return;
    o.type = S[3];
    o.frequency.setValueAtTime(S[0], t);
    o.frequency.exponentialRampToValueAtTime(S[1], t + S[2]);
    g.gain.setValueAtTime(S[4], t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + S[2]);
    o.connect(g); g.connect(AC_.destination);
    o.start(t); o.stop(t + S[2] + 0.02);
  } catch (e) { /* sem áudio */ }
}

/* ---------- Atualização ---------- */
function moveShot(b, dt) {
  b.t += dt;
  const along = b.spd * b.t, off = b.amp ? Math.sin(b.t * 16 + b.ph) * b.amp : 0;
  b.x = b.ox + b.dx * along - b.dy * off;
  b.y = b.oy + b.dy * along + b.dx * off;
  return b.t <= b.life && walkable(b.x, b.y);
}

function update(dt) {
  G.time += dt;
  const P = G.P;
  if (P) updatePlayer(dt);
  updateAllies(dt);
  updateWorld(dt);
  updateHM(dt);
  if (P) { storyTick(dt); questTick(dt); }

  if (isHost()) { updateEnemiesHost(dt); hostSpawning(dt); hostBoss(dt); hostDungeons(dt); hostEvents(dt); }
  else { updateEnemiesClient(dt); for (const p of G.portals) p.ttl -= dt; }

  for (const r of G.remotes.values()) {
    if (r.tx === undefined) continue;
    const k = Math.min(1, dt * 12);
    if (Math.abs(r.tx - r.x) > 2000) { r.x = r.tx; r.y = r.ty; }
    r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k;
    if (r.moving) r.walk = (r.walk || 0) + dt;
    if (r.bubble && (r.bubble.t -= dt) <= 0) r.bubble = null;
  }
  if (P && P.bubble && (P.bubble.t -= dt) <= 0) P.bubble = null;

  // tiros inimigos
  for (const b of G.eb) {
    b.t += dt;
    if (b.home && P && b.t < 1.3) {
      let df = Math.atan2(P.y - b.y, P.x - b.x) - b.a0;
      df = Math.atan2(Math.sin(df), Math.cos(df));
      b.a0 += clamp(df, -b.home * dt, b.home * dt);
    }
    b.a = b.wave ? b.a0 + Math.sin(b.t * 6) * b.wave : b.a0;
    b.x += Math.cos(b.a) * b.spd * dt; b.y += Math.sin(b.a) * b.spd * dt;
    if (b.t > b.life || inTown(b.x, b.y) || !walkable(b.x, b.y)) { b.dead = true; continue; }
    if (P && (b.x - P.x) ** 2 + (b.y - P.y) ** 2 < (b.r + 10) ** 2) { b.dead = true; enemyAttack(b); }
  }
  G.eb = G.eb.filter(b => !b.dead);

  // tiros aliados
  for (const b of G.pb) {
    if (!moveShot(b, dt) || (b.x < DG_BASE - 5000 && inTown(b.x, b.y))) { b.dead = true; continue; }
    for (const e of G.enemies) {
      if (e.hp <= 0 || e.dead) continue;
      const rr = e.r + b.r;
      if (Math.abs(e.x - b.x) > rr || Math.abs(e.y - b.y) > rr || (e.x - b.x) ** 2 + (e.y - b.y) ** 2 > rr * rr) continue;
      if (b.hit) { if (b.hit.has(e.id)) continue; b.hit.add(e.id); }
      if (G.P) playerHit(e, b);
      if (!b.pierce) { b.dead = true; break; }
    }
  }
  G.pb = G.pb.filter(b => !b.dead);
  G.cb = G.cb.filter(b => moveShot(b, dt) && !(b.x < DG_BASE - 5000 && inTown(b.x, b.y)));

  for (const b of G.bags) b.life -= dt;
  G.bags = G.bags.filter(b => b.life > 0 && b.items.length);
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const t of G.texts) { t.t += dt; t.y -= 40 * dt; }
  G.texts = G.texts.filter(t => t.t < t.life);
  for (const f of G.fx) { f.life -= dt; f.r = f.R * (1 - f.life / f.max); }
  G.fx = G.fx.filter(f => f.life > 0);
  for (const t of G.toasts) t.t -= dt;
  G.toasts = G.toasts.filter(t => t.t > 0);
  G.banner = Math.max(0, G.banner - dt);
  G.shake = Math.max(0, G.shake - dt * 20);
  if (P) { G.cam.x = P.x; G.cam.y = P.y; }

  netTick(dt);
  G.panelT -= dt;
  if (G.panelT <= 0) {
    G.panelT = 0.12;
    updatePanel();
    if (G.npcOpen && G.P && G.npcRefresh !== G.P.gold) { G.npcRefresh = G.P.gold; renderNPC(); }
  }
  G.saveT -= dt;
  if (G.saveT <= 0) { G.saveT = 5; saveGame(); }
}

/* ---------- Renderização ---------- */
function drawPlayerSprite(cls, x, y, face, frame, alpha, aim, ptype) {
  if (ptype) {
    ctx.strokeStyle = TYPE_COLORS[ptype]; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + Math.sin(G.time * 6) * 0.2;
    ctx.beginPath(); ctx.ellipse(x, y + 16, 18, 6, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(x, y + 17, 12, 4, 0, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  if (face < 0) ctx.scale(-1, 1);
  ctx.drawImage(CLS_SPR[cls][frame], -18, -18, 36, 36);
  ctx.restore();
  ctx.strokeStyle = ptype ? TYPE_COLORS[ptype] : CLASSES[cls].wpn.color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + Math.cos(aim) * 10, y + 4 + Math.sin(aim) * 10); ctx.lineTo(x + Math.cos(aim) * 24, y + 4 + Math.sin(aim) * 24); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBubble(x, y, s) {
  ctx.font = '12px system-ui, sans-serif';
  const w = Math.min(220, ctx.measureText(s).width + 14);
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  roundRect(x - w / 2, y - 22, w, 20, 6); ctx.fill();
  ctx.fillStyle = '#111'; ctx.textAlign = 'center';
  ctx.fillText(s.length > 34 ? s.slice(0, 33) + '…' : s, x, y - 8);
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function bar(x, y, w, h, frac, col) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}
function outlined(s, x, y) { ctx.strokeText(s, x, y); ctx.fillText(s, x, y); }

function drawShot(b, ox, oy) {
  const x = b.x + ox, y = b.y + oy;
  if (b.shape === 'blade' || b.shape === 'dagger' || b.shape === 'arrow') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(b.a);
    ctx.fillStyle = b.color;
    if (b.shape === 'blade') ctx.fillRect(-10, -3, 20, 6);
    else if (b.shape === 'dagger') ctx.fillRect(-7, -2, 14, 4);
    else { ctx.fillRect(-12, -1.5, 22, 3); ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(8, -5); ctx.lineTo(8, 5); ctx.fill(); }
    ctx.restore();
  } else {
    ctx.fillStyle = b.color; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(x, y, b.r * 1.8, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.fill();
  }
}

function render() {
  ctx.imageSmoothingEnabled = false;
  const cam = G.cam;
  const sx = G.shake ? rand(-G.shake, G.shake) : 0, sy = G.shake ? rand(-G.shake, G.shake) : 0;
  const ox = Math.round(W / 2 - cam.x + sx), oy = Math.round(H / 2 - cam.y + sy);
  const inDg = inDungeonArea(cam.x);

  if (inDg) {
    const dg = dungeonAt(cam.x);
    if (dg) renderDungeonFloor(dg, ox, oy); else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  } else renderOverworld(ox, oy);

  drawMeteors(ox, oy);
  for (const b of G.bags) {
    const top = Math.max(...b.items.map(i => i.tier));
    const col = b.items.every(isPocket) ? '#8b5a2b' : top < 2 ? '#a0522d' : top < 4 ? '#ec4899' : top < 6 ? '#7c3aed' : '#ffffff';
    const x = b.x + ox, y = b.y + oy + Math.sin(G.time * 3 + b.x) * 2;
    if (x < -50 || y < -50 || x > W + 50 || y > H + 50) continue;
    if (b.life < 10 && Math.floor(G.time * 6) % 2) continue;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 10, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = col; roundRect(x - 9, y - 8, 18, 17, 5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 5, y - 11, 10, 4);
    const P = G.P;
    if (b.shared || (P && Math.hypot(P.x - b.x, P.y - b.y) < 90)) {
      ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
      if (P && Math.hypot(P.x - b.x, P.y - b.y) < 90) b.items.slice(0, 3).forEach((it, i) => { ctx.fillStyle = itemColor(it); outlined(it.name, x, y - 16 - i * 12); });
      if (b.shared) { ctx.fillStyle = '#e5e7eb'; outlined(`${Math.ceil(b.life)}s`, x, y + 22); }
    }
  }
  drawPortals(ox, oy);

  // entidades ordenadas por Y
  const ents = [];
  const vis = (x, y) => x + ox > -200 && x + ox < W + 200 && y + oy > -200 && y + oy < H + 200;
  for (const e of G.enemies) if (vis(e.x, e.y)) ents.push({ y: e.y, e });
  for (const r of G.remotes.values()) {
    if (r.dead || !r.cls || r.tx === undefined) continue;
    ents.push({ y: r.y, r });
    for (const a of r.allies || []) if (vis(a[1], a[2])) ents.push({ y: a[2], ra: a });
  }
  for (const a of G.allies) ents.push({ y: a.y, a });
  if (!inDg && Math.abs(cam.x) < W + 300 && Math.abs(cam.y) < H + 300) { for (const n of NPCS) ents.push({ y: n.y, n }); for (const b of BUILDINGS) ents.push({ y: b.y + b.h / 2, bld: b }); }
  if (G.P) ents.push({ y: G.P.y, me: G.P });
  ents.sort((a, b) => a.y - b.y);
  ctx.textAlign = 'center';
  for (const it of ents) {
    if (it.e) { drawEnemy(it.e, ox, oy); if (!it.e.dg && !it.e.fly) grassOver(it.e.x, it.e.y + it.e.h * 0.35, it.e.x + ox, it.e.y + oy + it.e.h * 0.42, it.e.w * 0.6); }
    else if (it.bld) drawBuilding(it.bld, ox, oy);
    else if (it.n) drawNPC(it.n, ox, oy);
    else if (it.a) {
      const a = it.a;
      if (a.pet && mountPid(G.P)) continue; // virou montaria (desenhada embaixo do jogador)
      drawAlly(a.look || a.pid, a.x, a.y, ox, oy, a.ghost, a.t, a.face, a.moving, a.pet && G.evo && G.P && G.evo.pt === G.P.pets[a.slot], a.pet ? a.lvl : 0);
      grassOver(a.x, a.y + 10, a.x + ox, a.y + oy + 14, 26);
    } else if (it.ra) drawAlly(it.ra[0], it.ra[1], it.ra[2], ox, oy, it.ra[3], G.time, 1, false);
    else if (it.r) {
      const r = it.r, x = r.x + ox, y = r.y + oy;
      let lift = 0;
      if (r.mount) lift = drawMount(r.mount, r.x, r.y, x, y, r.face || 1, r.moving, G.time); else waterOver(r.x, r.y + 16, x, y + 16, 30);
      drawPlayerSprite(r.cls, x, y - lift, r.face || 1, r.mount ? 0 : r.moving ? Math.floor(r.walk * 8) % 2 : 0, r.invis ? 0.4 : 1, r.aim || 0, r.ptype);
      ctx.font = 'bold 11px system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.textAlign = 'center';
      outlined(`${r.name} · Nv ${r.lvl}`, x, y - 26);
      grassOver(r.x, r.y + 14, x, y + 18, 28);
      bar(x - 16, y + 22, 32, 4, r.hp / r.maxHp, '#22c55e');
      if (r.bubble) drawBubble(x, y - 32, r.bubble.text);
    } else {
      const P = it.me, x = P.x + ox, y = P.y + oy;
      if (P.furia > 0) { ctx.fillStyle = 'rgba(239,68,68,.25)'; ctx.beginPath(); ctx.arc(x, y, 24 + Math.sin(G.time * 15) * 3, 0, 7); ctx.fill(); }
      const mpid = mountPid(P);
      let lift = 0;
      if (mpid) {
        lift = drawMount(mpid, P.x, P.y, x, y, P.face > 0 ? 1 : -1, P.moving, G.time);
        if (P.surfing && P.moving && Math.random() < 0.5) G.parts.push({ x: P.x - Math.cos(P.aim) * 10 + rand(-8, 8), y: P.y + 22, vx: rand(-20, 20), vy: rand(-10, 10), life: 0.6, color: '#e0f2fe', size: 3 });
      } else waterOver(P.x, P.y + 16, x, y + 16, 30);
      drawPlayerSprite(P.cls, x, y - lift, P.face, mpid ? 0 : P.moving ? Math.floor(P.walk * 8) % 2 : 0, P.invis > 0 ? 0.4 : 1, P.aim, pType(P));
      if (!mpid) grassOver(P.x, P.y + 14, x, y + 18, 28);
      if (G.recall) { ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - G.recall.t / 1.5)); ctx.stroke(); }
      bar(x - 16, y + 22, 32, 4, P.hp / maxHP(P), '#22c55e');
      bar(x - 16, y + 28, 32, 3, 1 - P.abilCd / abilCd(P), '#60a5fa');
      if (P.bubble) drawBubble(x, y - 26, P.bubble.text);
    }
  }

  for (const b of G.cb) drawShot(b, ox, oy);
  for (const b of G.pb) drawShot(b, ox, oy);
  for (const b of G.eb) {
    const x = b.x + ox, y = b.y + oy;
    if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(x, y, b.r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x, y, b.r * 0.45, 0, 7); ctx.fill();
  }

  for (const p of G.parts) { ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x + ox - p.size / 2, p.y + oy - p.size / 2, p.size, p.size); }
  ctx.globalAlpha = 1;
  for (const f of G.fx) {
    const a = f.life / f.max;
    ctx.strokeStyle = f.color; ctx.lineWidth = 4; ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(f.x + ox, f.y + oy, f.r, 0, 7); ctx.stroke();
    if (f.fill) { ctx.globalAlpha = a * 0.3; ctx.fillStyle = f.color; ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // escuridão: noite, névoa das Terras Sombrias (Dissipar Névoa) e masmorras escuras (Lampejo)
  const flash = G.P && petKnows(G.P, 'flash');
  if (inDg) {
    const dg = dungeonAt(cam.x);
    if (dg && DARK_THEMES.includes(dg.theme)) drawNight(ox, oy, flash ? 460 : 175, 'rgba(0,0,0,0.88)');
  } else {
    const fog = zoneAt(cam.x, cam.y) === 4 && !flash;
    if (isNight()) drawNight(ox, oy, flash ? 420 : 230, 'rgba(8,6,30,0.62)');
    else if (fog) drawNight(ox, oy, flash ? 380 : 270, 'rgba(70,60,90,0.6)');
  }
  drawPetHover(ox, oy);
  for (const t of G.texts) {
    ctx.globalAlpha = 1 - t.t / t.life;
    ctx.font = `bold ${t.size}px system-ui, sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = t.color; ctx.textAlign = 'center';
    outlined(t.s, t.x + ox, t.y + oy);
  }
  ctx.globalAlpha = 1;

  drawHUD(ox, oy);
}

function drawEnemy(e, ox, oy) {
  const x = e.x + ox, y = e.y + oy;
  if (e.alfa || e.boss || e.rare) {
    ctx.fillStyle = e.legend ? 'rgba(239,68,68,.18)' : e.boss ? 'rgba(168,85,247,.2)' : e.rare ? 'rgba(103,232,249,.25)' : 'rgba(250,204,21,.22)';
    ctx.beginPath(); ctx.arc(x, y, e.r * 1.4 + Math.sin(e.t * 4) * 3, 0, 7); ctx.fill();
  }
  if (e.rare && Math.random() < 0.3) G.parts.push({ x: e.x + rand(-e.r, e.r), y: e.y + rand(-e.r, e.r), vx: 0, vy: -30, life: 0.6, color: '#a5f3fc', size: 3 });
  const img = e.flash > 0 ? whiteImg(e.p) : e.alfa ? alfaImg(e.p) : e.p.img;
  const asleep = e.st === 1 || e.st === 5;
  if (img) drawMon(img, e.p, x + (e.st === 2 ? rand(-1, 1) : 0), y, e.w, e.h, e.face, asleep ? 0 : e.t, e.moving && !asleep, e.dg ? DG_BASE : e.x, e.y, e.fly, e.hp <= 0 ? 0.4 : 1);
  else { ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(x, y, e.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  drawStatus(e, x, y);
  if (!e.boss && (e.hp < e.maxHp || e.alfa || e.rare)) {
    bar(x - 20, y - e.h / 2 - 12, 40, 4, e.hp / e.maxHp, e.rare ? '#67e8f9' : e.alfa ? '#facc15' : '#ef4444');
    if (e.alfa || e.rare) { ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = e.rare ? '#a5f3fc' : '#fde047'; ctx.fillText(e.name, x, y - e.h / 2 - 16); }
  }
}

function drawHUD(ox, oy) {
  const P = G.P;
  const cx = P ? P.x : G.cam.x, cy = P ? P.y : G.cam.y;
  const dg = inDungeonArea(cx) ? dungeonAt(cx) : null;
  const name = areaName(cx, cy);
  ctx.textAlign = 'left'; ctx.font = 'bold 14px system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  let hy = 22;
  if (dg) outlined(`${name} · Masmorra  Perigo ${dg.zone}/4`, 12, hy);
  else {
    const z = zoneAt(cx, cy);
    if (z >= 0) outlined(`${name}  ${z ? `Perigo ${z}/4 · Nv ${ZONES[z].lvl}+` : '(área segura)'}`, 12, hy);
  }
  ctx.font = '12px system-ui';
  if (NET.mode !== 'solo') { hy += 18; outlined(`Sala ${NET.room} · ${G.remotes.size + 1} jogador(es)${NET.mode === 'host' ? ' · você é o host' : ''}`, 12, hy); }
  const ev = evView();
  if (ev) {
    hy += 20; ctx.font = 'bold 13px system-ui'; ctx.fillStyle = '#fdba74';
    const extra = ev.total ? ` — ${ev.left}/${ev.total} restantes` : '';
    const dist = P && ev.kind !== 'noite' && ev.kind !== 'meteoros' ? ` · ${Math.round(Math.hypot(ev.x - P.x, ev.y - P.y) / 32)}m` : '';
    outlined(`${EVENT_ICONS[ev.kind]} ${ev.label}${extra} · ${ev.ttl}s${dist}`, 12, hy);
  }
  if (P) hy = drawStoryHUD(hy, ox, oy);
  if (P) hy = drawQuestHUD(hy, ox, oy);
  if (P && P.elixT > 0) { hy += 20; ctx.font = 'bold 13px system-ui'; ctx.fillStyle = '#f0abfc'; outlined(`🧪 Elixir: ${Math.ceil(P.elixT)}s`, 12, hy); }
  if (P && P.tempTypeT > 0) {
    hy += 20; ctx.font = 'bold 13px system-ui'; ctx.fillStyle = TYPE_COLORS[P.tempType];
    outlined(`💎 Tipo ${TYPE_PT[P.tempType]}: ${Math.ceil(P.tempTypeT)}s`, 12, hy);
  }
  if (autofire) { hy += 18; ctx.font = 'bold 12px system-ui'; ctx.fillStyle = '#fde047'; outlined('TIRO AUTOMÁTICO (T)', 12, hy); }

  if (G.banner > 0 && name) {
    ctx.globalAlpha = Math.min(1, G.banner);
    ctx.textAlign = 'center'; ctx.font = 'bold 34px Georgia, serif'; ctx.lineWidth = 5; ctx.fillStyle = dg ? THEMES[dg.theme].accent : '#fef3c7';
    outlined(name, W / 2, H * 0.28);
    const z = dg ? dg.zone : zoneAt(cx, cy);
    if (z > 0 && P) {
      const rec = ZONES[z].lvl, low = P.lvl < rec - 1;
      ctx.font = 'bold 16px system-ui'; ctx.lineWidth = 4; ctx.fillStyle = low ? '#fca5a5' : '#e5e7eb';
      outlined(low ? `⚠ Perigoso para o seu nível (recomendado ${rec}+)` : `Nível recomendado ${rec}+`, W / 2, H * 0.28 + 26);
    }
    ctx.globalAlpha = 1;
  }

  if (P && !G.npcOpen) {
    let hint = null, col = '#fef3c7';
    if (G.nearPortal) { const p = G.nearPortal; hint = p.exit ? '[E] Sair da masmorra' : `[E] Entrar: ${THEMES[p.theme].nome}`; col = p.exit ? '#facc15' : THEMES[p.theme].accent; }
    else if (G.nearNPC) hint = `[E] Falar com ${G.nearNPC.nome}`;
    else if (G.nearHM) { hint = hmHint(P, G.nearHM); col = G.nearHM.k === 'chest' || petKnows(P, G.nearHM.k) ? '#86efac' : '#cbd5e1'; }
    if (hint) { ctx.textAlign = 'center'; ctx.font = 'bold 16px system-ui'; ctx.lineWidth = 4; ctx.fillStyle = col; outlined(hint, W / 2, H / 2 + 70); }
  }

  ctx.textAlign = 'center';
  G.toasts.slice(-4).forEach((t, i) => {
    ctx.globalAlpha = Math.min(1, t.t);
    ctx.font = `bold ${t.big ? 20 : 15}px system-ui`; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = t.color;
    outlined(t.text, W / 2, 80 + i * 28);
  });
  ctx.globalAlpha = 1;

  let boss = null, bd = 1000;
  for (const e of G.enemies) if (e.boss && P) { const dd = Math.hypot(e.x - P.x, e.y - P.y); if (dd < bd) { bd = dd; boss = e; } }
  if (boss) {
    const w = Math.min(420, W - 260);
    bar(W / 2 - w / 2, H - 34, w, 12, boss.hp / boss.maxHp, boss.legend ? '#dc2626' : '#a855f7');
    ctx.font = 'bold 13px system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    outlined(`${boss.name} — ${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp}`, W / 2, H - 40);
  }
  const legend = G.enemies.find(e => e.legend);
  if (legend && !dg) {
    const bx = legend.x + ox, by = legend.y + oy;
    if (bx < 0 || by < 0 || bx > W || by > H) {
      const a = Math.atan2(by - H / 2, bx - W / 2);
      const ex = clamp(W / 2 + Math.cos(a) * (W / 2 - 30), 30, W - 30), ey = clamp(H / 2 + Math.sin(a) * (H / 2 - 30), 30, H - 30);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.font = 'bold 11px system-ui'; ctx.fillStyle = '#fca5a5'; ctx.strokeStyle = '#000';
      outlined(`${legend.name} ${P ? Math.round(Math.hypot(legend.x - P.x, legend.y - P.y) / 32) + 'm' : ''}`, ex, ey + 24);
    }
  }

  // minimapa
  if (showMap) {
    const mx = W - 172, my = 12;
    let toM, mh = 160;
    if (dg) {
      const mm = dungeonMinimap(dg);
      mh = mm.height;
      ctx.globalAlpha = 0.9; ctx.drawImage(mm, mx, my); ctx.globalAlpha = 1;
      toM = (x, y) => [mx + (x - dg.ox) / TILE * 0.8, my + (y - dg.oy) / TILE * 0.8];
    } else if (MINIMAP) {
      mh = MINIMAP.height;
      ctx.globalAlpha = 0.9; ctx.drawImage(MINIMAP, mx, my); ctx.globalAlpha = 1;
      toM = (x, y) => [mx + (x - WX0) / (WX1 - WX0) * 160, my + (y - WY0) / (WY1 - WY0) * mh];
    }
    if (toM) {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, 160, mh);
      const same = x => (dg ? dungeonAt(x) === dg : !inDungeonArea(x));
      if (P && P.race === 'elfo') {
        for (const e of G.enemies) if (same(e.x) && Math.hypot(e.x - P.x, e.y - P.y) < 1000) { const [a, b] = toM(e.x, e.y); ctx.fillStyle = '#f87171'; ctx.fillRect(a - 1, b - 1, 3, 3); }
      }
      if (ev && ev.kind !== 'noite' && same(ev.x)) {
        const [a, b] = toM(ev.x, ev.y);
        ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fdba74'; ctx.strokeStyle = '#000';
        outlined(EVENT_ICONS[ev.kind], a, b + 5);
      }
      const qt = !dg && questTarget(P);
      if (qt) { const [a, b] = toM(qt.x, qt.y); ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; outlined('🎯', a, b + 4); }
      const stt = !dg && storyTarget(P);
      if (stt) { const [a, b] = toM(stt.x, stt.y); ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fde047'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; outlined('★', a, b + 5); }
      for (const p of G.portals) if (same(p.x)) { const [a, b] = toM(p.x, p.y); ctx.fillStyle = p.exit ? '#facc15' : THEMES[p.theme].accent; ctx.beginPath(); ctx.arc(a, b, 4, 0, 7); ctx.fill(); }
      for (const r of G.remotes.values()) if (!r.dead && r.tx !== undefined && same(r.x)) { const [a, b] = toM(r.x, r.y); ctx.fillStyle = '#38bdf8'; ctx.fillRect(a - 2, b - 2, 5, 5); }
      for (const e of G.enemies) if (e.boss && same(e.x)) { const [a, b] = toM(e.x, e.y); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(a, b, 5, 0, 7); ctx.fill(); }
      if (P) { const [a, b] = toM(P.x, P.y); ctx.fillStyle = '#fff'; ctx.fillRect(a - 2.5, b - 2.5, 6, 6); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(a - 2.5, b - 2.5, 6, 6); }
    }
  }

  ctx.textAlign = 'left'; ctx.font = '13px system-ui';
  G.chat.forEach((c, i) => {
    const age = G.time - c.t;
    ctx.globalAlpha = age > 20 ? Math.max(0.25, 1 - (age - 20) / 5) : 1;
    const y = H - 20 - (G.chat.length - 1 - i) * 18;
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = c.sys ? '#fcd34d' : '#e5e7eb';
    outlined(c.sys ? c.text : `${c.name}: ${c.text}`, 12, y);
  });
  ctx.globalAlpha = 1;
}

/* ---------- Painel lateral ---------- */
const typeBadge = t => `<span class="tbadge" style="background:${TYPE_COLORS[t]}">${TYPE_PT[t]}</span>`;
function updatePanel() {
  const P = G.P;
  if (!P) return;
  const c = CLASSES[P.cls];
  const mh = maxHP(P), need = xpNeed(P.lvl);
  $('b-hp').style.width = (P.hp / mh * 100) + '%'; $('t-hp').textContent = `PV ${Math.ceil(P.hp)} / ${mh}`;
  $('b-xp').style.width = (P.lvl >= 20 ? 100 : P.xp / need * 100) + '%'; $('t-xp').textContent = P.lvl >= 20 ? 'NÍVEL MÁXIMO' : `XP ${P.xp} / ${need}`;
  $('p-derived').innerHTML = `<span title="Classe de Armadura: o d20 inimigo + bônus precisa igualar ou superar">🛡️ CA <b>${AC(P)}</b></span>
    <span title="Bônus de acerto (d20 + isto contra a CA do inimigo)">🎯 <b>+${toHit(P)}</b></span>
    <span title="Ouro">🪙 <b>${P.gold}</b></span><span title="Fama acumulada">🏆 <b>${P.fame}</b></span>
    <div class="ptype" title="Seu tipo define o que é super efetivo nos seus ataques e quais ataques te acertam forte">Tipo: ${typeBadge(pType(P))}${P.tempTypeT > 0 ? ` <span class="small">cristal ${Math.ceil(P.tempTypeT)}s (natural: ${TYPE_PT[P.ptype]})</span>` : ''}</div>`;
  const ab = c.abil, cd = abilCd(P);
  $('p-abil').innerHTML = `<div class="abil ${P.abilCd > 0 ? 'off' : ''}"><b>[Espaço] ${ab.nome}</b> <span>${P.abilCd > 0 ? P.abilCd.toFixed(1) + 's' : `pronto · ${cd.toFixed(1)}s`}</span><div class="small">${ab.desc}</div></div>
    <div class="small">[R] Voltar à vila (fique parado 1,5s): ${P.recallCd > 0 ? Math.ceil(P.recallCd) + 's' : 'pronto'}</div>
    ${ridingFlyer(P) ? `<div class="small">[V] Voar: ${P.flyCd > 0 ? Math.ceil(P.flyCd) + 's' : 'pronto'} · ${P.fly.length} destino(s)</div>` : ''}`;
  if (!G.dirty) return;
  G.dirty = false;
  const rc = race(P), sub = P.subclass ? subInfo(P.subclass) : null;
  $('p-head').innerHTML = `<div class="pname">${esc(P.name)}</div><div class="pcls" title="${rc.traco}">${rc.icon} ${rc.nome} · ${c.icon} ${c.nome}${sub ? ` (${sub.icon} ${sub.nome})` : ''} · Nível ${P.lvl}</div>`;
  let choose = '';
  if (P.lvl >= 10 && !P.subclass) {
    choose += `<h4>Escolha sua subclasse <span class="pts">nível 10!</span></h4>` + SUBCLASSES[P.cls].map(s =>
      `<button class="tal sub" data-sub="${s.id}"><b>${s.icon} ${s.nome}</b><span>${s.desc}</span></button>`).join('');
  }
  if (P.talentOffer) {
    choose += `<h4>Escolha um talento <span class="pts">novo!</span></h4>` + P.talentOffer.map(id =>
      `<button class="tal" data-tal="${id}"><b>${TALENTS[id].icon} ${TALENTS[id].nome}</b><span>${TALENTS[id].desc}</span></button>`).join('');
  }
  if (P.talents.length || sub) {
    choose += `<h4>Talentos</h4><div class="tchips">${sub ? `<span class="subchip" title="${sub.desc}">${sub.icon} ${sub.nome}</span>` : ''}${P.talents.map(id => `<span title="${TALENTS[id].desc}">${TALENTS[id].icon} ${TALENTS[id].nome}</span>`).join('')}</div>`;
  }
  $('p-talents').innerHTML = choose;
  $('p-attrs').innerHTML = `<h4>Atributos <span class="small" title="Ganhe +1 ponto a cada 2 níveis. Poções de Poder/Agilidade/Vigor (Alfas, chefes, lendários, baús) sobem o atributo para sempre.">máx ${ATTR_MAX}</span>${P.points ? `<span class="pts">${P.points} ponto(s)!</span>` : ''}</h4>` + ATTRS.map(k => {
    const v = A(P, k), bonus = v - P.attrs[k];
    return `<div class="attr" title="${ATTR_DESC[k]}"><span class="an">${ATTR_NAMES[k]}</span><span class="pips">${'●'.repeat(Math.min(v, 13))}</span><span class="av">${v}${bonus ? `<i>(+${bonus})</i>` : ''}</span>
      ${P.points && P.attrs[k] < ATTR_MAX ? `<button data-attr="${k}">+</button>` : '<span></span>'}</div>`;
  }).join('');
  const slot = (s, label) => {
    const it = P.equip[s];
    return `<div class="slot" ${it ? `style="border-color:${TIER_COLORS[it.tier]}" title="${esc(it.name)}${it.upg ? ' +' + it.upg : ''} — ${itemDesc(it)} (${TIER_NAMES[it.tier]})${s === 'anel' || s === 'amuleto' ? ' · clique para guardar' : ''}"` : `title="${label} vazio"`} data-eq="${s}">
      ${it ? itemIcon(it) : '<span class="empty">' + label + '</span>'}</div>`;
  };
  $('p-equip').innerHTML = `<h4>Equipamento</h4><div class="eqrow">${slot('arma', 'Arma')}${slot('armadura', 'Armad.')}${slot('anel', 'Anel')}${slot('amuleto', 'Amul.')}</div>
    <div class="small">${esc(P.equip.arma.name)}${P.equip.arma.upg ? ' +' + P.equip.arma.upg : ''}: ${itemDesc(P.equip.arma)}</div>`;
  $('p-inv').innerHTML = `<h4>Mochila</h4><div class="inv">` + P.inv.map((it, i) => {
    if (!it) return `<div class="slot"></div>`;
    const better = it.slot !== 'pedra' && itemScore(it) > itemScore(P.equip[it.slot] || null);
    const hint = it.slot === 'pedra' ? 'Clique: usar' : 'Clique: equipar';
    return `<div class="slot" data-inv="${i}" style="border-color:${itemColor(it)}" title="${esc(it.name)} — ${itemDesc(it)}${it.slot === 'pedra' ? '' : ` (${TIER_NAMES[it.tier]})`}\n${hint} · Botão direito: soltar no chão">${itemIcon(it)}${better ? '<i class="up">▲</i>' : ''}</div>`;
  }).join('') + '</div>';
  const bsel = P.ballSel || 'poke';
  $('p-pots').innerHTML = `<div class="potrow"><button data-pot="1" title="Botão direito: soltar uma no chão">❤️ Cura ×${P.pots.hp} <small>[Q]</small></button>
    <button data-elix="1" ${P.bag.elixir ? '' : 'disabled'} title="+2 de dano e +20% de cadência por 30s">🧪 Elixir ×${P.bag.elixir} <small>[2]</small></button></div>
    <div class="potrow balls">${Object.keys(BALLS).map(k => `<button data-ball="${k}" class="${bsel === k ? 'sel' : ''}" title="${BALLS[k].nome} (+${BALLS[k].bonus} na captura). Clique para escolher qual o F joga.">${BALLS[k].icon} ×${ballCount(P, k)}</button>`).join('')}<small>[F]</small></div>`;
  $('p-pets').innerHTML = `<h4>Companheiros <span class="small">${P.pets.length}/${MAX_PETS}</span></h4>` + (P.pets.length
    ? `<div class="pets">${P.pets.map((pt, i) => {
      const ev = evoLevel(pt.pid);
      const evt = ev === undefined ? '' : ev ? (pt.lvl >= ev ? 'pronto para evoluir!' : `evolui no Nv ${ev}`) : 'forma final';
      return `<div class="pet ${i === P.petIdx ? 'on' : ''}" data-pet="${i}" title="${esc(pt.name)} (${TYPE_PT[pt.type]}) · ${evt}\nClique: ${i === P.petIdx ? 'guardar' : 'chamar'} · Botão direito 2×: soltar">
        <img src="${petIconUrl(pt.pid)}" alt=""><span>${esc(pt.name)} <b>Nv ${pt.lvl}</b></span>${typeBadge(pt.type)}
        <div class="pxp"><div style="width:${pt.lvl >= PET_MAX ? 100 : Math.min(100, pt.xp / petNeed(pt.lvl) * 100)}%"></div></div><i>${evt}</i>
        <div class="phm">${HM_KEYS.map(k => (pt.hms || []).includes(k) ? `<span class="hmk" title="${HMS[k].nome}">${HMS[k].icon}</span>`
          : P.hms.includes(k) && canLearn(pt.pid, k) ? `<button class="hmt" data-teach="${i}:${k}" title="Ensinar ${HMS[k].mo} ${HMS[k].nome}">+${HMS[k].icon}</button>` : '').join('')}</div></div>`;
    }).join('')}</div>${P.bag.doce && P.petIdx >= 0 ? `<button data-candy="1" class="candy">🍬 Dar Doce Raro ao ativo (×${P.bag.doce})</button>` : ''}`
    : '<div class="small">Enfraqueça um Pokémon, mire nele e aperte <b>F</b> para jogar uma Pokébola. Companheiros sobem de nível e evoluem!</div>')
    + (P.hms.length ? `<div class="small keyit">Itens-chave: ${P.hms.map(k => `<span title="${HMS[k].desc}">${HMS[k].icon} ${HMS[k].mo} ${HMS[k].nome}</span>`).join(' ')}</div>` : '');
  if (NET.mode === 'host') $('p-room').innerHTML = `<h4>Multiplayer</h4><div class="room">Código da sala: <b>${NET.room}</b> <button data-copy="1">Copiar</button></div><div class="small">Seus amigos escolhem "Entrar em sala" e digitam este código.</div>`;
  else if (NET.mode === 'client') $('p-room').innerHTML = `<h4>Multiplayer</h4><div class="room">Conectado à sala <b>${NET.room}</b></div>`;
  else $('p-room').innerHTML = '';
  $('p-room').innerHTML += '<button data-save="1" class="savebtn" title="Baixa um arquivo .json com seu personagem (Ctrl+S)">💾 Salvar em arquivo</button>';
}

$('panel').addEventListener('click', ev => {
  const t = ev.target.closest('[data-attr],[data-inv],[data-eq],[data-pot],[data-ball],[data-copy],[data-tal],[data-sub],[data-pet],[data-elix],[data-candy],[data-save],[data-teach]');
  if (!t || !G || !G.P) return;
  const P = G.P;
  if (t.dataset.attr) {
    const k = t.dataset.attr;
    if (P.points > 0 && P.attrs[k] < ATTR_MAX) {
      const oldMax = maxHP(P);
      P.attrs[k]++; P.points--;
      P.hp += Math.max(0, maxHP(P) - oldMax);
      saveGame();
    }
  } else if (t.dataset.tal) chooseTalent(t.dataset.tal);
  else if (t.dataset.sub) chooseSubclass(t.dataset.sub);
  else if (t.dataset.pet !== undefined && !ev.target.closest('[data-teach]')) { const i = +t.dataset.pet; P.petIdx = P.petIdx === i ? -1 : i; saveGame(); }
  else if (t.dataset.inv !== undefined) {
    const i = +t.dataset.inv, it = P.inv[i];
    if (it && it.slot === 'pedra') useStone(i);
    else if (it) { const old = maxHP(P); P.inv[i] = P.equip[it.slot] || null; P.equip[it.slot] = it; P.hp += Math.max(0, maxHP(P) - old); sfx('pick'); }
  } else if ((t.dataset.eq === 'anel' || t.dataset.eq === 'amuleto') && P.equip[t.dataset.eq]) {
    const i = P.inv.indexOf(null);
    if (i >= 0) { P.inv[i] = P.equip[t.dataset.eq]; P.equip[t.dataset.eq] = null; }
  } else if (t.dataset.pot) usePotion();
  else if (t.dataset.elix) useElixir();
  else if (t.dataset.candy) giveCandy();
  else if (t.dataset.save) exportSave();
  else if (t.dataset.teach) { const [i, k] = t.dataset.teach.split(':'); teachHM(+i, k); }
  else if (t.dataset.ball) { P.ballSel = t.dataset.ball; G.toasts.push({ text: `F agora joga: ${BALLS[P.ballSel].nome}`, color: '#e5e7eb', t: 2 }); }
  else if (t.dataset.copy) { if (navigator.clipboard) navigator.clipboard.writeText(NET.room); G.toasts.push({ text: 'Código copiado!', color: '#86efac', t: 2 }); }
  P.hp = Math.min(P.hp, maxHP(P));
  G.dirty = true;
  t.blur();
});
$('panel').addEventListener('contextmenu', ev => {
  const t = ev.target.closest('[data-inv],[data-pet],[data-pot],[data-ball]');
  if (!t || !G || !G.P) return;
  ev.preventDefault();
  const P = G.P;
  if (t.dataset.inv !== undefined) {
    const i = +t.dataset.inv;
    if (P.inv[i]) { dropItems([P.inv[i]]); P.inv[i] = null; }
  } else if (t.dataset.pot) { if (P.pots.hp > 0) { P.pots.hp--; dropItems([potion()]); } }
  else if (t.dataset.ball) {
    const k = t.dataset.ball;
    if (ballCount(P, k) > 0) { if (k === 'poke') { P.balls--; dropItems([ballItem()]); } else { P.bag[k]--; dropItems([consItem(k)]); } }
  } else {
    const i = +t.dataset.pet, pt = P.pets[i];
    if (G.relIdx !== i || G.time - G.relT > 2.5) {
      G.relIdx = i; G.relT = G.time;
      G.toasts.push({ text: `Clique com o botão direito de novo para soltar ${pt.name} (Nv ${pt.lvl}).`, color: '#fca5a5', t: 2.5 });
      return;
    }
    G.relIdx = -1;
    P.pets.splice(i, 1);
    if (P.petIdx === i) P.petIdx = -1; else if (P.petIdx > i) P.petIdx--;
    G.toasts.push({ text: `${pt.name} foi solto na natureza.`, color: '#cbd5e1', t: 2.5 });
  }
  saveGame();
  G.dirty = true;
});

$('panel').addEventListener('mouseover', ev => {
  const t = ev.target.closest('[data-pet]'), tip = $('ptip');
  if (!t || !G || !G.P) { tip.classList.add('hidden'); return; }
  tip.innerHTML = petTip(G.P, +t.dataset.pet);
  tip.classList.remove('hidden');
  const r = t.getBoundingClientRect();
  tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 8, Math.max(8, r.top)) + 'px';
  tip.style.left = Math.max(8, r.left - tip.offsetWidth - 10) + 'px';
});
$('panel').addEventListener('mouseleave', () => $('ptip').classList.add('hidden'));

/* ---------- Entrada ---------- */
function typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); }
window.addEventListener('keydown', ev => {
  if (ev.target === $('chat-in')) {
    if (ev.key === 'Enter') {
      const s = $('chat-in').value.trim();
      if (s && G && G.P) emitEvent({ t: 'chat', name: G.P.name, text: s.slice(0, 120) });
      closeChat();
    } else if (ev.key === 'Escape') closeChat();
    return;
  }
  if (typing()) return;
  if (state !== 'play' || !G || !G.P) return;
  K[ev.code] = true;
  const P = G.P;
  if (ev.code === 'Escape' && G.npcOpen) closeNPC();
  else if (ev.code === 'Space') { ev.preventDefault(); useAbility(); }
  else if (ev.code === 'KeyQ' || ev.code === 'Digit1') usePotion();
  else if (ev.code === 'Digit2') useElixir();
  else if (ev.code === 'KeyX') toggleRide();
  else if (ev.code === 'KeyV') { if (G.npcOpen === 'fly') closeNPC(); else openFly(); }
  else if (ev.code === 'KeyF') throwBall();
  else if (ev.code === 'KeyS' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); K.KeyS = false; exportSave(); }
  else if (ev.code === 'KeyE') {
    if (G.npcOpen) closeNPC();
    else if (G.nearPortal) usePortal(P, G.nearPortal);
    else if (G.nearNPC) openNPC(G.nearNPC.id);
    else if (G.nearHM) useHMTile(P, G.nearHM);
  } else if (ev.code === 'Digit3') { const i = P.inv.findIndex(it => it && it.slot === 'pedra'); if (i >= 0) { useStone(i); G.dirty = true; } }
  else if (ev.code === 'KeyT') autofire = !autofire;
  else if (ev.code === 'KeyM') showMap = !showMap;
  else if (ev.code === 'KeyN') { soundOn = !soundOn; G.toasts.push({ text: soundOn ? 'Som ligado' : 'Som desligado', color: '#e5e7eb', t: 1.5 }); }
  else if (ev.code === 'KeyR') {
    if (P.recallCd <= 0 && !G.recall && !inTown(P.x, P.y)) { G.recall = { t: 1.5 }; text(P.x, P.y - 40, 'Voltando à vila... fique parado', '#fde68a', 12); }
    else if (P.recallCd > 0) text(P.x, P.y - 40, `Retorno em ${Math.ceil(P.recallCd)}s`, '#cbd5e1', 12);
  } else if (ev.code === 'Enter') { ev.preventDefault(); openChat(); }
});
window.addEventListener('keyup', ev => { K[ev.code] = false; });
window.addEventListener('blur', () => { for (const k in K) K[k] = false; mouse.down = false; });
function openChat() { const c = $('chat-in'); c.classList.remove('hidden'); c.value = ''; for (const k in K) K[k] = false; c.focus(); }
function closeChat() { const c = $('chat-in'); c.classList.add('hidden'); c.blur(); }

cv.addEventListener('mousemove', ev => { const r = cv.getBoundingClientRect(); mouse.x = ev.clientX - r.left; mouse.y = ev.clientY - r.top; });
cv.addEventListener('mousedown', ev => { if (ev.button === 0) mouse.down = true; if (document.activeElement) document.activeElement.blur(); });
window.addEventListener('mouseup', ev => { if (ev.button === 0) mouse.down = false; });
cv.addEventListener('contextmenu', ev => ev.preventDefault());

function resize() {
  W = cv.width = Math.max(300, window.innerWidth - $('panel').offsetWidth);
  H = cv.height = window.innerHeight;
}
window.addEventListener('resize', resize);

/* ---------- Menu ---------- */
const menuSel = { hero: null, mode: 'solo', loaded: false };

function renderHero() {
  const h = menuSel.hero, c = CLASSES[h.cls], rc = RACES[h.race];
  const fake = { cls: h.cls, race: h.race, lvl: 1, attrs: h.attrs, talents: [], subclass: null, equip: { arma: startWeapon(h.cls), armadura: { ac: 0 }, anel: null } };
  $('hero').innerHTML = `<canvas width="72" height="72" id="hero-spr"></canvas>
    <div class="hero-info">
      <div class="hero-line"><span class="hchip">${rc.icon} ${rc.nome}</span><span class="hchip">${c.icon} ${c.nome}</span>${typeBadge(h.type)}</div>
      <div class="small">${c.desc} ${rc.traco}</div>
      <div class="small">Habilidade: <b>${c.abil.nome}</b> — ${c.abil.desc}</div>
      <div class="hero-stats">${ATTRS.map(k => `<span title="${ATTR_DESC[k]}">${ATTR_NAMES[k]} <b>${h.attrs[k]}</b></span>`).join('')}
        <span>❤️ <b>${maxHP(fake)}</b> PV</span><span>🛡️ CA <b>${AC(fake)}</b></span>${h.points ? `<span>+${h.points} pontos livres</span>` : ''}</div>
      <div class="small">Tipo ${TYPE_PT[h.type]}: forte contra ${TYPE_CHART[h.type].s.map(t => TYPE_PT[t]).join(', ') || 'nada'}.</div>
    </div>`;
  const x = $('hero-spr').getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(CLS_SPR[h.cls][0], 0, 0, 72, 72);
}
function renderHall() {
  let hall = [];
  try { hall = JSON.parse(localStorage.getItem(HALL_KEY) || '[]'); } catch (e) { /* ignora */ }
  $('hall').innerHTML = hall.length ? `<h3>🪦 Salão dos Caídos</h3><ol>${hall.slice(0, 5).map(h => `<li><b>${esc(h.name)}</b> — ${esc(h.cls)} Nv ${h.lvl} · ${h.fame} fama · morto por ${esc(h.src)}</li>`).join('')}</ol>` : '';
}
function renderContinue() {
  const s = loadSave();
  $('continue-box').innerHTML = s && CLASSES[s.cls] ? `<button id="btn-cont" class="big alt" ${menuSel.loaded ? '' : 'disabled'}>▶ Continuar: ${esc(s.name)} (${(RACES[s.race] || RACES.humano).nome} ${CLASSES[s.cls].nome} Nv ${s.lvl})</button>` : '';
  const b = $('btn-cont');
  if (b) b.onclick = () => startGame(s);
}

$('btn-roll').onclick = () => { menuSel.hero = rollHero(); renderHero(); };
$('btn-import').onclick = () => $('file-import').click();
$('file-import').onchange = async ev => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    const s = j.save || j;
    if (!s || !CLASSES[s.cls] || !s.name) throw new Error('arquivo inválido');
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    renderContinue();
    $('menu-err').textContent = '';
    $('import-msg').textContent = `✅ Save de ${s.name} (nível ${s.lvl}) carregado. Clique em Continuar.`;
  } catch (e) { $('import-msg').textContent = '❌ Não consegui ler esse arquivo: ' + e.message; }
};
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => {
  menuSel.mode = r.value;
  $('join-code').disabled = r.value !== 'join';
  if (r.value === 'join') $('join-code').focus();
}));
$('btn-start').onclick = () => startGame(null);
$('btn-again').onclick = () => {
  $('death').classList.add('hidden');
  menuSel.hero = rollHero();
  renderHero(); renderContinue(); renderHall();
  $('mode-box').classList.add('hidden');
  $('menu').classList.remove('hidden');
  state = 'menu';
};

async function startGame(saved) {
  $('menu-err').textContent = '';
  const name = ($('name').value.trim() || 'Aventureiro').slice(0, 14);
  if (!G) {
    newWorld();
    const btns = [$('btn-start'), $('btn-cont')].filter(Boolean);
    btns.forEach(b => { b.disabled = true; });
    try {
      if (menuSel.mode === 'host') { $('menu-err').textContent = 'Criando sala...'; await netHost(); }
      else if (menuSel.mode === 'join') { $('menu-err').textContent = 'Conectando...'; await netJoin($('join-code').value); }
    } catch (e) {
      G = null;
      Object.assign(NET, { mode: 'solo', peer: null });
      $('menu-err').textContent = 'Erro: ' + (e.message || e.type || e);
      btns.forEach(b => { b.disabled = false; });
      return;
    }
    btns.forEach(b => { b.disabled = false; });
    $('menu-err').textContent = '';
  }
  let P;
  if (saved) {
    P = createPlayer(saved.name, { cls: saved.cls, race: saved.race, type: saved.ptype, attrs: saved.attrs, points: 0 });
    SAVE_FIELDS.forEach(k => { if (saved[k] !== undefined && saved[k] !== null) P[k] = saved[k]; });
    if (saved.talentOffer) P.talentOffer = saved.talentOffer;
    if (!RACES[P.race]) P.race = 'humano';
    if (!TYPE_PT[P.ptype]) P.ptype = 'normal';
    if (!('amuleto' in P.equip)) P.equip.amuleto = null;
    P.bag = Object.assign({ grande: 0, ultra: 0, doce: 0, elixir: 0 }, P.bag || {});
    if (!P.story) P.story = { ch: 0, done: false };
    P.hms = (P.hms || []).filter(k => HMS[k]); P.fly = P.fly || ['vila']; P.chests = P.chests || [];
    for (const pt of P.pets) pt.hms = (pt.hms || []).filter(k => HMS[k]);
    for (const pt of P.pets) { pt.lvl = pt.lvl || 5; pt.xp = pt.xp || 0; loadEvo(pt.pid); }
    loadPokedex(P.pets.map(pt => pt.pid)).then(() => { if (G) G.dirty = true; });
  } else P = createPlayer(name, menuSel.hero);
  P.hp = Math.min(Math.max(1, P.hp), maxHP(P));
  G.P = P;
  G.cam.x = P.x; G.cam.y = P.y;
  G.dirty = true;
  state = 'play';
  $('menu').classList.add('hidden');
  emitEvent({ t: 'chat', sys: 1, text: `${P.name} (${heroLabel(P)}, tipo ${TYPE_PT[P.ptype]}) entrou no reino.` });
  if (NET.mode === 'host') G.toasts.push({ text: `Sala criada! Código: ${NET.room}`, color: '#86efac', t: 6 });
  if (!saved) G.toasts.push({ text: 'Fale com Sildo Invernal (🛡️, ao norte da vila) com [E] para começar a história!', color: '#fef3c7', t: 7 });
  ensureTalentOffer(P);
  saveGame();
}

/* ---------- Loop ---------- */
let last = performance.now();
function step(now, draw) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G && state !== 'lost') { update(dt); if (draw) render(); }
  else if (!G && draw) { ctx.fillStyle = '#0f0b1a'; ctx.fillRect(0, 0, W, H); }
}
function frame() {
  if (!document.hidden) step(performance.now(), true);
  requestAnimationFrame(frame);
}
// Com a aba em segundo plano o navegador pausa o requestAnimationFrame;
// um timer dentro de um Worker não é limitado e mantém o mundo (e o host) rodando.
try {
  const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),33)'], { type: 'text/javascript' })));
  wk.onmessage = () => { if (document.hidden) step(performance.now(), false); };
} catch (e) { setInterval(() => { if (document.hidden) step(performance.now(), false); }, 33); }

function boot() {
  buildClassSprites();
  buildNPCSprites();
  buildWorld();
  resize();
  menuSel.hero = rollHero();
  $('name').value = pick(['Arwen', 'Thorin', 'Elric', 'Lyra', 'Kael', 'Brienne', 'Gandor', 'Mira', 'Fenrir', 'Sable']);
  renderHero(); renderHall(); renderContinue();
  requestAnimationFrame(frame);
  loadPokedex(coreIds(), (n, t) => {
    $('load-n').textContent = `${n}/${t}`;
    $('load-b').style.width = (n / t * 100) + '%';
  }).then(() => {
    menuSel.loaded = true;
    $('load').innerHTML = '✅ Pokémon prontos para a batalha!';
    $('btn-start').disabled = false;
    renderContinue();
    // Pokémon das masmorras e da noite carregam em segundo plano
    return loadPokedex(THEME_IDS.concat(NIGHT_POOL));
  });
}
boot();
