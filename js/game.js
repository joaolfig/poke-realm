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

const SAVE_KEY = 'pkr_save_v2', CACHE_KEY = 'pkr_poke_v3';

/* ---------- Pokédex (PokeAPI) ---------- */
const POKE = {};
const coreIds = () => regionIds(REGION);

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
    hm: [...new Set(j.moves.map(m => HM_MOVES[m.move.name]).filter(Boolean))], // HMs que aprenderia nos jogos
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
// showMap: 0 = escondido, 1 = minimapa (com zoom, em volta do jogador), 2 = mapa da região inteira
let autofire = false, showMap = 1;

function newWorld() {
  G = {
    P: null, enemies: [], emap: new Map(), eb: [], pb: [], cb: [], bags: [], parts: [], texts: [], fx: [], toasts: [], chat: [],
    remotes: new Map(), dungeons: new Map(), portals: [], dgNext: 0, poNext: 0, dgT: 0, allies: [], meteors: [],
    event: null, evInfo: null, evT: 70, npcOpen: null, nearNPC: null, evo: null, bountyCd: {}, dropN: 0, recall: null, storyCd: {}, relT: 0, relIdx: -1, cuts: [], usedDive: new Set(), nearHM: null,
    time: 0, nextId: 0, spawnT: 0, bossT: 75, shake: 0, area: null, banner: 0, dirty: true,
    saveT: 0, panelT: 0, cam: { x: 0, y: 0 }, fullWarn: 0, nearPortal: null, zones: [], decoys: [],
  };
}

/* ---------- Regras (D&D simplificado) ---------- */
const hasT = (P, id) => P.talents.includes(id);
const tRank = (P, id) => P.talents.filter(t => t === id).length;
const MAX_LVL = 30;
// especial atual: o da subclasse (nível 16) ou o da classe
const curAbil = P => (P.subclass && subInfo(P.subclass) && subInfo(P.subclass).abil) || CLASSES[P.cls].abil;
// quantos companheiros podem ficar fora da Pokébola
const petSlots = P => Math.min(4, 1 + tRank(P, 'equipe'));
const hasS = (P, id) => P.subclass === id;
const race = P => RACES[P.race] || RACES.humano;
const wxSlow = P => { const w = P && G && G.wx && weatherAt(P.x, P.y); if (!w || !w.slow || pType(P) === 'ice' || M(P, 'wx' + w.k) > 0) return 1; return 1 - (1 - w.slow) * (1 - Math.min(1, M(P, 'wxcapa'))); };
// Tiefling: +20% de dano com menos da metade da vida
const infernal = P => (P.race !== 'tiefling' ? 1 : P.hp < maxHP(P) / 2 ? 1.25 : 1.1);
const pType = P => (P.wildT > 0 ? P.wildType : P.tempTypeT > 0 ? P.tempType : P.ptype);
// arma atual: a da classe ou, na Forma Selvagem, o golpe do tipo do Pokémon
const curWpn = P => (P.wildT > 0 ? wildWpn(P.wildType) : CLASSES[P.cls].wpn);
// valor efetivo usado nas regras: cada 2 pontos de atributo valem 1 (o anel soma direto no efetivo)
const A = (P, k) => P.attrs[k] / 2 + (P.equip.anel && P.equip.anel.attr === k ? P.equip.anel.bonus : 0);
// valor mostrado no painel (pontos)
const Araw = (P, k) => P.attrs[k] + (P.equip.anel && P.equip.anel.attr === k ? P.equip.anel.bonus * 2 : 0);
// curva de vida: no Nv 1 a vida é a que seria no Nv 3; ela cresce a cada nível, acelerando até o ritmo normal,
// e no Nv 7 é exatamente a de antes. Daí em diante cresce normalmente (sem trancos e sem nada que encolha).
const hpLvl = P => (P.lvl >= 7 ? P.lvl : P.lvl + (7 - P.lvl) ** 2 / 18);
const maxHP = P => {
  const c = CLASSES[P.cls];
  let h = 15 + (c.hd / 2 + A(P, 'VIG')) * hpLvl(P) + (P.race === 'anao' ? 2 * P.lvl : 0) + (hasT(P, 'robusto') ? 2 * P.lvl : 0);
  if (hasS(P, 'barbaro')) h *= 1.25;
  if (P.wildT > 0) h *= hasS(P, 'lua') ? 1.5 : 1.3; // Forma Selvagem
  return Math.round(h * (1 + M(P, 'hp')));
};
const AC = P => CLASSES[P.cls].ac + Math.floor(A(P, 'AGI') / 2) + (P.equip.armadura ? P.equip.armadura.ac : 0)
  + (P.race === 'halfling' ? 1 : 0) + (hasT(P, 'defensor') ? 2 : 0) + (hasS(P, 'paladino') || hasS(P, 'guerra') ? 2 : 0) + M(P, 'ac');
const toHit = P => 2 + Math.floor(P.lvl / 3) + Math.floor(A(P, 'POD') / 2) + P.equip.arma.bonus + M(P, 'hit');
const critMin = P => Math.max(15, CLASSES[P.cls].crit - (P.race === 'elfo' ? 2 : 0) - (hasT(P, 'critico') ? 1 : 0) - (hasS(P, 'assassino') ? 1 : 0) - (P.lin === 'lobisomem' ? 1 : 0) - M(P, 'crit')); // lobisomem: instinto
const outOfCombat = P => P.sinceHit > 4 && G.time - (P.shotT === undefined ? -99 : P.shotT) > 4 && !P.pvp;
const moveSpeed = P => (160 + A(P, 'AGI') * 8) * (outOfCombat(P) ? 1.3 : 1) * (pst(P, 2) ? 0.85 : 1) * wxSlow(P) * (P.race === 'halfling' ? 1.1 : 1) * (P.invis > 0 ? 1.3 : 1) * (hasT(P, 'mobilidade') ? 1.2 : 1) * (P.furia > 0 ? 1.25 : 1) * (P.hasteT > 0 ? 1.3 : 1) * (P.lin === 'lobisomem' ? 1.05 : 1) * (isBat(P) ? 1.3 : 1) * (1 + M(P, 'speed'));
const fireRate = P => curWpn(P).rate * (P.ritmoT > 0 ? 1 + P.ritmoK : 1) * (isWolf(P) ? 1.35 : 1) * (pst(P, 2) ? 0.7 : 1) * (1 + 0.05 * A(P, 'AGI')) * (hasS(P, 'evocador') ? 1.15 : 1) * (P.furia > 0 ? 1.5 : 1) * (hasT(P, 'maos') ? 1.2 : 1) * (1 + M(P, 'rate'));
const abilCd = P => curAbil(P).cd * (1 - 0.15 * tRank(P, 'foco')) * Math.max(0.5, 1 - M(P, 'cd'));
const rangeMul = P => (P.race === 'elfo' ? 1.2 : 1) * (hasT(P, 'olho') ? 1.25 : 1) * (1 + M(P, 'range'));
// XP para cada nível: acompanha o dano do herói (medido: XP por segundo matando na zona recomendada, nível a nível).
// Dentro de cada zona o herói mata mais rápido a cada nível: ~+13%/nível na zona 1, +6,6% na 2, +8% na 3, ~+4% na 4 e na 5.
// (os inimigos de uma zona dão sempre o mesmo XP). A média de cada zona é a calibrada em jogo (~2 min por nível nas
// zonas 1 e 5, ~3 min nas zonas 2 a 4); a zona 1 começa mais rápida para os primeiros níveis passarem logo.
const XP_TABLE = [
  600, 1300, 1550, 1750, 1900, 2050, // zona 1 (Nv 1-6): medido jogando, ~1 min por nível na simulação (1,5-2 min de verdade)
  5200, 5600, 6000, 6400, 6800, 7200, 7600, // zona 2 (Nv 7-13)
  7400, 8050, 8700, 9400, 10150, 10900, 11950, // zona 3 (Nv 14-20)
  12950, 13650, 14300, 14850, 15400, // zona 4 (Nv 21-25)
  12600, 13000, 13450, 13800, // zona 5 (Nv 26-29 → 30) — zonas 3-5 ×1,4 (medido: subiam rápido demais)
];
const xpNeed = l => XP_TABLE[clamp(l, 1, MAX_LVL - 1) - 1];

// raça, classe e tipo são sorteados
// o sorteio evita a classe, a raça e o tipo do herói anterior (o que morreu ou o que estava na tela)
let heroAvoid = { cls: [], race: [], type: [] };
function rollHero() {
  const fresh = (all, av) => { const ok = all.filter(x => !av.includes(x)); return pick(ok.length ? ok : all); };
  const cls = fresh(Object.keys(CLASSES), heroAvoid.cls), rc = fresh(Object.keys(RACES), heroAvoid.race), type = fresh(TYPES, heroAvoid.type);
  heroAvoid = { cls: [cls], race: [rc], type: [type] };
  const attrs = { ...CLASSES[cls].attrs };
  for (const k in RACES[rc].bonus) attrs[k] += RACES[rc].bonus[k];
  attrs[pick(ATTRS)]++;
  for (const k in attrs) attrs[k] *= 2; // escala de pontos (cada ponto vale metade)
  return { cls, race: rc, type, attrs, points: RACES[rc].points * 2 };
}

function startWeapon(cls) {
  const c = CLASSES[cls];
  return { slot: 'arma', tier: 0, cls, name: c.weapons[0], dice: [WDICE[0][0], WDICE[0][1] + c.dieAdj], bonus: 0, mods: {} };
}

function createPlayer(name, h) {
  const P = {
    name, cls: h.cls, race: h.race, ptype: h.type, subclass: null, lvl: 1, xp: 0, legends: 0, kills: 0, gold: 20,
    attrs: { ...h.attrs }, points: h.points || 0, attrV2: 1, talents: [], talentOffer: null, talentPending: 0, killsPot: 0,
    equip: { arma: startWeapon(h.cls), armadura: { slot: 'armadura', tier: 0, name: 'Roupas de Viagem', ac: 0, mods: {} }, anel: null, amuleto: null },
    inv: Array(8).fill(null), pots: { hp: 3 }, balls: 3, bag: { grande: 0, ultra: 0, doce: 0, abra: 0 }, ballSel: 'poke', story: { ch: 0, done: false },
    pets: [], petIdx: -1, petAct: [], stories: {}, hmsR: {}, quests: {}, qOffers: {}, hasteT: 0, slowCd: 0, hms: [], fly: ['vila'], chests: [], flyCd: 0,
    x: rand(-40, 40), y: rand(55, 80), hp: 1, shootCd: 0, abilCd: 0, breathCd: 0, furia: 0, invis: 0, nextCrit: false,
    recallCd: 0, dashCd: 0, dodgeT: 0, shield: 0, shieldT: 0, seloT: 0, sinceHit: 10, face: 1, walk: 0, moving: false, aim: 0, tempType: null, tempTypeT: 0, alt: 0.14, auraT: 0, giftT: 0,
  };
  P.hp = maxHP(P);
  return P;
}

const SAVE_FIELDS = ['name', 'cls', 'race', 'ptype', 'subclass', 'lvl', 'xp', 'legends', 'kills', 'gold', 'attrs', 'points', 'talents', 'talentOffer',
  'talentPending', 'killsPot', 'attrV2', 'lastTown', 'seenR', 'dexR', 'titles', 'title', 'box', 'towerR', 'towerCk', 'wseed', 'expR', 'bless', 'lin', 'tq', 'moon', 'abraCd', 'equip', 'inv', 'pots', 'balls', 'bag', 'ballSel', 'stories', 'hmsR', 'fly', 'chests', 'recentQ', 'pets', 'petIdx', 'petAct', 'petCap', 'quests', 'qOffers', 'hp'];
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
  // talentos de tipo: só para os tipos que ganham com eles, e nunca para o Druida (o tipo dele muda na Forma Selvagem)
  const pool = Object.keys(TALENTS).filter(k => !TALENTS[k].off && tRank(P, k) < (TALENTS[k].max || 1) && (!TALENTS[k].types || (P.cls !== 'druida' && TALENTS[k].types.includes(P.ptype)))).sort(() => Math.random() - 0.5);
  if (!pool.length) { P.talentPending = 0; return; }
  P.talentOffer = pool.slice(0, 3);
  // pelo menos uma opção de tipo, quando o seu tipo tem acesso a alguma
  const typed = pool.filter(k => TALENTS[k].types);
  if (typed.length && !P.talentOffer.some(k => TALENTS[k].types)) P.talentOffer[P.talentOffer.length - 1] = pick(typed);
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
  if (P.subclass || P.lvl < SUB_LVL || !SUBCLASSES[P.cls].some(s => s.id === id)) return;
  const oldMax = maxHP(P);
  P.subclass = id;
  P.hp += Math.max(0, maxHP(P) - oldMax);
  const s = subInfo(id);
  G.toasts.push({ text: `${s.icon} Você agora é ${s.nome}! Novo especial: ${s.abil.nome}`, color: '#fde047', t: 4.5, big: 1 });
  G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 0, R: 140, life: 0.9, max: 0.9, color: '#fde047' });
  sfx('lvl');
  saveGame();
}

/* ---------- Itens (o resto está em items.js) ---------- */
function useStone(i) {
  const P = G.P, it = P.inv[i];
  P.inv[i] = null;
  P.tempType = it.type;
  P.tempTypeT = 30 + 15 * tRank(P, 'afinidade');
  burst(P.x, P.y, TYPE_COLORS[it.type], 30);
  G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 0, R: 90, life: 0.6, max: 0.6, color: TYPE_COLORS[it.type] });
  G.toasts.push({ text: `💎 Você agora é do tipo ${TYPE_PT[it.type]}!`, color: TYPE_COLORS[it.type], t: 3 });
  sfx('lvl');
}

/* ---------- Inimigos ---------- */
// kind: 0 normal, 1 Alfa, 2 lendário, 3 chefe de masmorra, 4 raro (evento)
function enemyStats(pid, zone, kind) {
  const p = POKE[pid], legend = kind === 2, dboss = kind === 3, alfa = kind === 1, rare = kind === 4;
  // chefes: ataque, defesa e vida base limitados a uma faixa normal (medido: Hariyama, Lucario, Steelix, Excadrill,
  // Rampardos e Dialga matavam 75-100% das tentativas, os outros líderes 0-40%)
  const st = legend || dboss ? { ...p.stats, hp: clamp(p.stats.hp || 60, 60, 105), defense: clamp(p.stats.defense || 60, 50, 105) } : p.stats;
  const atk0 = Math.max(st.attack || 55, st['special-attack'] || 55), atk = legend || dboss ? clamp(atk0, 70, 105) : atk0;
  let type = p.types[0];
  if (type === 'normal' && p.types[1]) type = p.types[1];
  if (!PAT[type]) type = 'normal';
  // a força cresce mais rápido que linear com a zona, acompanhando o poder do herói do nível 1 ao 30
  // (só a zona 1 fica como antes). Lendários são feitos para 2 heróis de nível 30.
  const zh = [1, 1, 3, 5.6, 8.8, 12.8][clamp(Math.round(zone), 1, 5)]; // vida por zona (testado com simulação de combate)
  const nd = Math.max(1, Math.round(zone * 1.75 - 0.9));    // dados de dano: 1 · 3 · 4 · 6 · 8
  return {
    p, pid, zone, kind, boss: kind === 2 || kind === 3, legend, alfa, rare, type, color: TYPE_COLORS[type] || '#fff',
    name: (alfa ? 'Alfa ' : '') + p.name + (rare ? ' ✨' : ''),
    maxHp: Math.round(((st.hp || 50) * 0.35 + 8) * zh * (legend ? LEGEND_HP : dboss ? (zone >= 4 ? 10 : 8) : alfa ? 3 : rare ? 2.5 : 1)),
    ac: 9 + Math.floor((st.defense || 50) / 30) + zone + (legend ? 6 : dboss ? 2 : alfa ? 1 : 0),
    atk: 2 + Math.floor(atk / 35) + Math.round(zone * 2.5) + (legend ? 8 : dboss ? 2 : alfa ? 1 : 0),
    dice: [legend ? 10 : dboss ? nd + 2 : nd + (alfa ? 1 : 0), legend ? 10 : 4 + 2 * Math.min(3, Math.floor(atk / 40)), zone * 2 + (legend ? 20 : dboss ? 3 : 0)],
    speed: (35 + (st.speed || 50) * 0.55) * (legend || dboss ? 0.6 : rare ? 1.5 : 1),
    scale: legend ? 4.2 : dboss ? 3.3 : clamp(1.7 + (p.height || 10) / 35, 1.7, 2.8) * (alfa || rare ? 1.3 : 1),
    xp: Math.round((p.exp || 100) * (0.4 + zone * 0.35) * (1 + (zone - 1) * 0.1) * (legend ? 45 : dboss ? 8 : alfa ? 3 : rare ? 4 : 1)),
    cdMul: (zone >= 5 ? 1.1 : 1) / (1 + (zone - 1) * 0.2 + Math.max(0, zone - 2) * 0.1), // atacam mais rápido nas zonas altas (e um pouco mais no começo)
    cdBoss: legend ? 0.6 : undefined, // lendários atacam mais rápido
  };
}

const alfa = kind => kind === 1;
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
  // nível do Pokémon: dentro da faixa da zona (igual no host e nos clientes, sai do id); Alfas e raros um pouco acima
  const zi = clamp(Math.round(zone), 1, 5);
  e.lvl = clamp(ZONE_LVL[zi] + Math.floor(hash(id, pid) * (ZONE_LVL_MAX[zi] - ZONE_LVL[zi] + 1)) + (alfa(kind) ? 2 : kind === 4 ? 1 : 0), 1, 30);
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
    stc: e && (e.alfa || e.boss) ? 1 : 0,
    color: e ? e.color : '#fff', atk: e ? e.atk : 5, dice: e ? e.dice : [1, 6, 0], src: e ? e.name : 'um Pokémon', type: e ? e.type : 'normal', zone: e ? clamp(Math.round(e.zone), 1, 5) : 1,
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
  if (P) arr.push({ x: P.x, y: P.y, invis: P.invis > 0, champ: storyOver(P) });
  for (const r of G.remotes.values()) if (!r.dead && r.name) arr.push({ x: r.tx, y: r.ty, invis: r.invis, champ: !!r.champ });
  return arr;
}

// Lendários (fim de jogo): regeneram o tempo todo. Com um só jogador por perto a regeneração passa do dano de um
// herói Nv 30 bem equipado (medido: 360-770 de dano/s contra ~710/s); com 2+ jogadores ela cai e o grupo vence em poucos minutos.
const LEGEND_HP = 280, LEGEND_REGEN = 0.0025, LEGEND_REGEN_SOLO = 0.0055;
const legendRegen = e => (allPlayers().filter(p => Math.hypot(p.x - e.x, p.y - e.y) < 1100).length >= 2 ? LEGEND_REGEN : LEGEND_REGEN_SOLO);
function updateEnemiesHost(dt) {
  for (const e of G.enemies) if (e.legend && !e.dead) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * legendRegen(e) * dt);
  const T = allPlayers().filter(t => !t.invis && zoneAt(t.x, t.y) !== 0).concat(G.decoys.map(d => ({ x: d.x, y: d.y })));
  for (const e of G.enemies) {
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    if (e.dash) { bossDash(e, dt); continue; }
    if (e.stT > 0) {
      e.stT -= dt;
      if (e.st === 3 || e.st === 4) { e.dotT -= dt; if (e.dotT <= 0) { e.dotT = 1; applyHit(e, (e.st === 3 ? d(4) : d(3)) + e.zone, e.stBy || null); if (e.dead) continue; } }
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
        // fúria: abaixo de metade da vida
        if (!e.rage && e.hp < e.maxHp / 2) { e.rage = 1; emitEvent({ t: 'toast', text: `💢 ${e.name} ficou furioso!`, color: '#fca5a5' }); }
        e.sigT = (e.sigT === undefined ? rand(2.5, 4) : e.sigT) - dt;
        if (e.sigT <= 0 && dd < 620 && e.st !== 6) { bossSig(e, tgt); e.sigT = sigEvery(e) * (e.rage ? 0.7 : 1); e.cd = Math.max(e.cd, 1.2); }
        e.phaseT += dt;
        if (e.phaseT > BOSS_PH[e.phase].dur) { e.phase = (e.phase + 1) % BOSS_PH.length; e.phaseT = 0; }
        // na fase do golpe do próprio tipo o ritmo segue o padrão (anéis grossos de Aço/Dragão viravam parede de balas)
        if (e.cd <= 0) { BOSS_PH[e.phase].f(e, ang); e.cd = (e.phase === 3 ? Math.max(0.55, PAT[e.type].cd * 0.6) : BOSS_PH[e.phase].cd) * (e.kind === 3 ? 1.3 : e.cdBoss || 1) * (e.rage ? 0.85 : 1); }
      } else if (e.cd <= 0 && dd < 460) {
        const pt = PAT[e.type];
        if (!(e.st === 2 && Math.random() < 0.4)) pt.f(e, ang);
        e.cd = pt.cd * e.cdMul * rand(0.85, 1.2);
      }
    } else {
      // sem ninguém para atacar: perde o interesse, volta para casa (longe da vila) e passeia por lá
      e.calmT = (e.calmT || 0) + dt;
      let hx = e.hx === undefined ? e.x : e.hx, hy = e.hy === undefined ? e.y : e.hy;
      if (!e.dg) for (const t of TOWNS) { const dx = hx - t.x, dy = hy - t.y, d0 = Math.hypot(dx, dy); if (d0 < VILA_R + 260) { const k = (VILA_R + 420) / (d0 || 1); hx = t.x + dx * k; hy = t.y + dy * k; e.hx = hx; e.hy = hy; } }
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
      const can = (x, y) => { const z = zoneAt(x, y); return e.mig || e.boss || (e.aqua ? isWater(x, y) && (z < 1 || z >= e.zone) : (z >= e.zone || (e.fly && z < 0)) && !solidAt(x, y, e.fly ? 1 : 0)); };
      // bloqueado: tenta deslizar por um dos eixos; só inverte a direção de novo depois de um tempo
      // (antes invertia a cada quadro e o Pokémon ficava tremendo de um lado para o outro)
      if (can(nx, ny)) { e.x = nx; e.y = ny; }
      else if (vx && can(nx, e.y)) { e.x = nx; vy = 0; }
      else if (vy && can(e.x, ny)) { e.y = ny; vx = 0; }
      else {
        vx = vy = 0;
        if (G.time - (e.turnT || -9) > 0.8) { e.turnT = G.time; e.wanderA += Math.PI; e.orbit *= -1; e.wanderT = rand(0.8, 1.6); }
      }
      pushOutTown(e);
      clampWorld(e);
    }
    e.moving = Math.abs(vx) + Math.abs(vy) > 1;
    if (Math.abs(vx) > 12 && G.time - (e.faceT || -9) > 0.25) { const f = vx > 0 ? 1 : -1; if (f !== e.face) { e.face = f; e.faceT = G.time; } }
  }
}

function updateEnemiesClient(dt) {
  for (const e of G.enemies) {
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    const dx = e.tx - e.x, dy = e.ty - e.y;
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) { e.x = e.tx; e.y = e.ty; }
    else { const k = Math.min(1, dt * 10); e.x += dx * k; e.y += dy * k; }
    e.moving = Math.abs(dx) + Math.abs(dy) > 2;
    if (Math.abs(dx) > 3 && G.time - (e.faceT || -9) > 0.25) { const f = dx > 0 ? 1 : -1; if (f !== e.face) { e.face = f; e.faceT = G.time; } }
  }
}

function hostSpawning(dt) {
  G.spawnT -= dt;
  if (G.spawnT > 0) return;
  G.spawnT = 0.35;
  const pls = allPlayers().filter(p => !inDungeonArea(p.x) && !inArena(p.x, p.y));
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
  const zp = waterZone(pl.x, pl.y); // no mar, conta a zona da costa mais próxima
  // limite de Pokémon por perto: cresce com a zona (caótico no fim), mas cada tiro das zonas altas dói menos (ZONE_DMG)
  if (near >= [0, 12, 16, 20, 24, 28][Math.min(5, zp)] + (pls.length > 1 ? 5 : 0)) return;
  let x = 0, y = 0, water = false;
  for (let k = 0; k < 4; k++) {
    const a = Math.random() * 6.28, dist = rand(600, 950);
    x = pl.x + Math.cos(a) * dist; y = pl.y + Math.sin(a) * dist;
    if (isWater(x, y)) { if (Math.random() < 0.6) { water = true; break; } continue; }
    if (!solidAt(x, y) && tileKind(x, y) === TK.TALL) break;
  }
  if (!water && (solidAt(x, y) || isWater(x, y))) return;
  let z = zoneAt(x, y);
  if (water && z < 1) z = waterZone(x, y);
  if (z < 1 || z > zp + 1) return;
  const night = !water && isNight() && Math.random() < 0.5 ? NIGHT_POOL.filter(id => POKE[id]) : [];
  const rainy = !water && !night.length && weatherAt(x, y) === WEATHER.chuva && Math.random() < 0.3;
  // zona 1: bebês da região ~3%; outros bebês ~0,6% (raríssimos)
  const br = z === 1 && !water ? Math.random() : 1, own = br < 0.03 && REGION.babies && REGION.babies.length, other = br >= 0.03 && br < 0.036;
  const baby = own || other;
  const pid = own ? pick(REGION.babies) : other ? pick(otherBabies(REGION)) : water || rainy ? pick(WATER_POOLS[z]) : night.length ? pick(night) : pick(ZONE_POOLS[z]);
  if (!POKE[pid]) return;
  // bandos maiores e mais Alfas no meio e no fim do jogo
  const n = baby ? 1 : randi(z >= 4 ? 3 : z >= 2 ? 2 : 1, z >= 4 ? 6 : z >= 3 ? 5 : 3); // bebê aparece sozinho
  for (let i = 0; i < n; i++) {
    const ex = x + rand(-50, 50), ey = y + rand(-50, 50);
    if (water && !isWater(ex, ey)) continue;
    const e = hostSpawn(pid, z, Math.random() < (z >= 4 ? 0.07 : z >= 3 ? 0.055 : 0.04) ? 1 : 0, ex, ey);
    if (water && !e.fly) e.aqua = true;
  }
}

function hostBoss(dt) {
  G.bossT -= dt;
  if (G.bossT > 0) return;
  G.bossT = 150;
  // os lendários só aparecem depois que alguém da sala terminou a história, em qualquer ponto do mapa
  if (G.enemies.some(e => e.legend) || !allPlayers().some(p => p.champ && !inDungeonArea(p.x))) return;
  const pid = pick(BOSSES);
  if (!POKE[pid]) return;
  const [bx, by] = randomZonePoint(randi(1, 5));
  hostSpawn(pid, 5, 2, bx, by);
  emitEvent({ t: 'toast', text: `⚠ ${POKE[pid].name} lendário surgiu em ${areaName(bx, by)}! Siga a seta vermelha.`, color: '#f87171', big: 1 });
}

// from = id do jogador que causou o dano (null para meteoros, veneno etc.)
function applyHit(e, dmg, from = NET.myId) {
  if (e.dead) return;
  if (from) { e.dmgBy = e.dmgBy || {}; e.dmgBy[from] = (e.dmgBy[from] || 0) + Math.max(0, Math.min(dmg, e.hp)); }
  e.hp -= dmg; e.flash = 0.1; e.hitT = G.time;
  if (e.hp <= 0) {
    e.dead = true;
    emitEvent({ t: 'k', id: e.id, pid: e.pid, x: Math.round(e.x), y: Math.round(e.y), xp: e.xp, zone: e.zone, kind: e.kind, name: e.name, type: e.type, st: e.story || (e.bountyT !== undefined ? 10 + e.bountyT : 0) || (e.moonA ? 60 : 0), by: e.dmgBy || {} });
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
    if (mine) sfx('kill');
    G.emap.delete(m.id);
    G.enemies = G.enemies.filter(x => x.id !== m.id);
  }
  if (m.kind === 2) G.toasts.push({ text: `🏆 ${m.name} foi derrotado!`, color: '#facc15', t: 4, big: 1 });
  const P = G.P;
  // contratos de dupla: vale o abate de qualquer um dos dois, se o parceiro estiver a uma distância média de você
  if (P && G.remotes.size && Math.hypot(P.x - m.x, P.y - m.y) < DUO_R && duoNear(P)) {
    const pp = POKE[m.pid];
    questProgress('duoTipo', { types: pp ? pp.types : [m.type] });
    questProgress('duoEspecie', { pid: m.pid });
  }
  if (!P || Math.hypot(P.x - m.x, P.y - m.y) > 900) return;
  // ouro proporcional ao dano que cada um causou. XP: metade dividida igualmente entre os jogadores
  // perto do abate e metade proporcional ao dano (o total por abate continua o mesmo)
  const by = m.by || {}, total = Object.values(by).reduce((a, b) => a + b, 0);
  const share = total > 0 ? (by[NET.myId] || 0) / total : 0;
  const nNear = Math.max(1, allPlayers().filter(p => Math.hypot(p.x - m.x, p.y - m.y) <= 900).length);
  const xpShare = 0.5 / nNear + 0.5 * share;
  // chefes, caçadas e história contam para quem estava junto (cooperação)
  if (m.kind === 3) questProgress('masmorra');
  if (m.st >= 10 && m.st < 40) { questProgress('caca', { pid: m.pid }); questProgress('duoCaca', { pid: m.pid }); }
  if (m.st === 60) moonAlfaLoot(m);
  storyKill(m);
  { const tdg = inDungeonArea(m.x) && dungeonAt(m.x); if (m.kind === 3 && tdg && tdg.floor && tdg.floor % 5 === 0) towerCheckpoint(P, tdg.floor); }
  if (m.kind === 2) { P.legends = (P.legends || 0) + 1; dexCatch(P, m.pid); } // lendário: conta para todos que estavam perto (e entra na Pokédex)
  rollLoot(m); // saque: cada jogador perto rola o seu, mesmo sem ter acertado
  const xp = Math.max(1, Math.round(m.xp * xpShare * (1 + M(P, 'xp'))));
  gainXP(Math.round(xp * catchUp(P)));
  petGainXP(xp * (isNight() ? 1.5 : 1));
  if (share <= 0) { G.dirty = true; return; }
  P.kills++;
  P.killsPot = (P.killsPot || 0) + 1;
  if (hasT(P, 'alquimista') && P.killsPot % 10 === 0) { P.pots.hp++; text(P.x, P.y - 60, '+1 Poção (Alquimista)', '#fca5a5', 12); }
  if (hasT(P, 'domador') && P.killsPot % 15 === 0) { P.balls++; text(P.x, P.y - 70, '+1 Poké Ball (Domador)', '#e5e7eb', 12); }
  const gold = Math.max(1, Math.round(m.zone * randi(1, 3) * ([1, 4, 25, 12, 6][m.kind] || 1) * (hasT(P, 'tesouro') ? 1.5 : 1) * (1 + M(P, 'gold')) * share));
  P.gold += gold;
  text(m.x + 12, m.y - 10, `+${gold}🪙`, '#fde047', 11);
  if (mine && hasS(P, 'necromante') && Math.random() < 0.3 && !m.kind) addSpirit(m.pid);
  const p = POKE[m.pid];
  questProgress('tipo', { types: p ? p.types : [m.type] });
  questProgress('coleta', { types: p ? p.types : [m.type] });
  questProgress('especie', { pid: m.pid });
  if (!inDungeonArea(m.x)) questProgress('zona', { zone: m.zone });
  if (m.kind === 1) { questProgress('alfa'); questProgress('duoAlfa', { duo: [...G.remotes.values()].some(r => !r.dead && r.name && Math.hypot(r.tx - m.x, r.ty - m.y) < 900) }); storyAlfa(P, m); }
  linKill(P); templeKill(P, m);
  G.dirty = true;
}

/* ---------- Jogador ---------- */
// recuperação: quem está abaixo do nível recomendado do próximo capítulo da história ganha +50% de XP nos abates
const catchUp = P => { const s = P.story && !storyOver(P) && STORY[P.story.ch]; return s && s.lvl && P.lvl < s.lvl ? 1.5 : 1; };
function gainXP(n, raw) {
  const P = G.P;
  if (!raw && isNight()) n = Math.round(n * 1.5);
  if (P.lvl >= MAX_LVL) return;
  P.xp += n;
  text(P.x, P.y - 46, `+${n} XP`, '#a7f3d0', 12);
  while (P.lvl < MAX_LVL && P.xp >= xpNeed(P.lvl)) {
    P.xp -= xpNeed(P.lvl);
    P.lvl++;
    P.points++; // 1 ponto de atributo por nível
    if (P.lvl % 4 === 0) P.talentPending++;
    P.hp = maxHP(P);
    G.toasts.push({ text: `⭐ Nível ${P.lvl}! +1 ponto de atributo${P.lvl % 4 === 0 ? ' e um talento novo' : ''}`, color: '#fde047', t: 3 });
    if (P.lvl === SUB_LVL) G.toasts.push({ text: `🏅 Nível ${SUB_LVL}: escolha sua subclasse no painel!`, color: '#fde047', t: 5, big: 1 });
    G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 0, R: 120, life: 0.8, max: 0.8, color: '#fde047' });
    sfx('lvl');
    G.dirty = true;
    ensureTalentOffer(P);
    saveGame();
  }
  if (P.lvl >= MAX_LVL) P.xp = 0;
}

function mouseWorld() { return { x: mouse.x - W / 2 + G.cam.x, y: mouse.y - H / 2 + G.cam.y }; }

// projétil aliado (do jogador ou de um companheiro); é replicado como cosmético para os outros
function spawnPB(o) {
  const b = {
    ox: o.x, oy: o.y, x: o.x, y: o.y, dx: Math.cos(o.a), dy: Math.sin(o.a), a: o.a, spd: o.spd, t: 0, life: o.life,
    amp: o.amp || 0, ph: o.ph || 0, r: o.r, color: o.color, shape: o.shape, pierce: !!o.pierce || !!o.left, hit: o.pierce || o.left || o.skip ? new Set(o.skip ? [o.skip] : []) : null, ally: o.ally || null, sp: o.sp || 0, spell: o.spell || 0,
    left: o.left || 0, rico: !!o.rico, pd: o.pd || 0, bomb: o.bomb || 0,
  };
  G.pb.push(b);
  if (netActive()) NET.outS.push([Math.round(b.ox), Math.round(b.oy), +o.a.toFixed(3), b.spd, +b.life.toFixed(2), b.amp, +b.ph.toFixed(2), b.r, b.shape, b.color, b.pd]);
  return b;
}
// Bomba Arcana: quantos dos 20 projéteis podem acertar o mesmo alvo
const BOMB_CAP = 6;
function shootBullet(a, o = {}) {
  const P = G.P, w = curWpn(P);
  spawnPB({
    a, spd: o.spd || w.speed, life: (o.life || w.life) * rangeMul(P), amp: w.wave ? 14 : 0, ph: o.ph || 0,
    r: o.r || w.size, color: o.color || (P.wildT > 0 || P.tempTypeT > 0 ? TYPE_COLORS[pType(P)] : w.color), shape: o.shape || w.shape, pierce: o.pierce || w.pierce || M(P, 'pierce') > 0, spell: o.spell, x: o.x !== undefined ? o.x : P.x, y: o.y !== undefined ? o.y : P.y,
    left: o.left || (!(o.pierce || w.pierce) && hasT(P, 'perfurante') ? 2 : 0), rico: o.rico, skip: o.skip, bomb: o.bomb, pd: pvpShotDmg(P, o),
  });
}
function addCosmetic(s, own) {
  const [ox, oy, a, spd, life, amp, ph, r, shape, color, dmg] = s;
  G.cb.push({ ox, oy, x: ox, y: oy, dx: Math.cos(a), dy: Math.sin(a), a, spd, t: 0, life, amp, ph, r, shape, color, dmg: dmg || 0, own });
}

function playerShoot() {
  const P = G.P, w = curWpn(P);
  P.shotT = G.time;
  const ca = pst(P, 6) ? rand(-0.2, 0.2) : 0; // confuso: a mira treme
  for (let i = 0; i < w.shots; i++) shootBullet(P.aim + ca + (w.spread ? (i - (w.shots - 1) / 2) * w.spread : 0), { ph: i * Math.PI });
  if (hasT(P, 'atirador')) { P.alt = -P.alt; shootBullet(P.aim + P.alt); }
  if (Math.random() < 0.5) sfx('shoot');
}

// aplica a tabela de tipos a um ataque aliado
function typed(P, e, dmg, atkType, pet) {
  let eff = typeEff(atkType, e.p.types);
  if (!pet) { const w = weatherAt(e.x, e.y), b = wxBoost(e.x, e.y, atkType); if (w && b < 1) dmg *= (M(P, 'wx' + w.k) > 0 ? 1 / b : 1 + (1 / b - 1) * Math.min(1, M(P, 'wxcapa'))); }
  // pouco efetivo do herói mais suave (½ → 0,65; ¼ → ~0,48), para nenhum ginásio ficar impossível só pelo tipo
  if (!pet && eff > 0 && eff < 1) eff = 1 - (1 - eff) * 0.7;
  if (!pet && eff > 0 && eff < 1 && hasT(P, 'persistencia')) eff = 1 - (1 - eff) / 2;
  if (!pet && eff === 0 && hasT(P, 'quebra')) eff = 0.3;
  dmg *= wxBoost(e.x, e.y, atkType); // clima
  if (eff > 1 && hasT(P, 'adepto')) eff *= 1.5;
  return { dmg: eff === 0 ? 0 : Math.max(1, Math.round(dmg * eff)), eff };
}
function hitText(e, dmg, eff, crit, hit, extra = '') {
  const col = crit ? '#facc15' : eff > 1 ? '#fb923c' : eff < 1 ? '#8aa0b8' : hit ? '#ffffff' : '#9ca3af';
  text(e.x + rand(-8, 8), e.y - e.h / 2, `${dmg}${crit ? '!' : ''}${extra}`, col, crit ? 18 : eff > 1 ? 16 : hit ? 14 : 11);
  if (eff !== 1 && G.time - (e.effT || -9) > 1.5) {
    e.effT = G.time;
    text(e.x, e.y - e.h / 2 - 18, eff > 1 ? 'Super efetivo!' : eff === 0 ? 'Não tem efeito...' : 'Pouco efetivo...', eff > 1 ? '#fb923c' : '#8aa0b8', 12);
  }
}

// dano de especial: aplica tipo, mostra o número e devolve o dano causado
function abilHit(e, dmg, type, slow) {
  const P = G.P, r = typed(P, e, Math.max(1, Math.round(dmg)), type || pType(P));
  dealDamage(e, r.dmg, slow || 0);
  hitText(e, r.dmg, r.eff, false, true);
  linSteal1(P, r.dmg);
  return r.dmg;
}
const aimPoint = (P, max) => { const mw = mouseWorld(); let dx = mw.x - P.x, dy = mw.y - P.y; const dd = Math.hypot(dx, dy); if (dd > max) { dx *= max / dd; dy *= max / dd; } return { x: P.x + dx, y: P.y + dy }; };
const enemiesNear = (x, y, r) => G.enemies.filter(e => e.hp > 0 && !e.dead && Math.hypot(e.x - x, e.y - y) < r + e.r);

function useAbility() {
  const P = G.P;
  if (P.abilCd > 0) return;
  if (isWolf(P)) { text(P.x, P.y - 40, '🐺 Na fúria não dá para usar o especial', '#fca5a5', 12); return; }
  if (P.lform && CLASSES[P.cls] === CLASSES.druida) { text(P.x, P.y - 40, 'Você já está transformado', '#fca5a5', 12); return; }
  if (!inDungeonArea(P.x) && inTown(P.x, P.y)) { text(P.x, P.y - 40, '🕊️ A vila é zona de paz', '#fef3c7', 12); return; }
  P.abilCd = abilCd(P); P.shotT = G.time;
  const mw = mouseWorld(), tp = pType(P), lv = P.lvl, pod = A(P, 'POD');
  const fxAt = (x, y, r, color) => emitEvent({ t: 'fx', x: Math.round(x), y: Math.round(y), r, color });
  switch (P.subclass || P.cls) {
    case 'guerreiro': // Elmo: Berserk para você e quem estiver perto
      emitEvent({ t: 'buff', k: 'furia', x: Math.round(P.x), y: Math.round(P.y), dur: 5, name: P.name });
      fxAt(P.x, P.y, 160, '#ef4444'); sfx('boom'); break;
    case 'barbaro': { // Escudo de Impacto (Cavaleiro): leque curto de estilhaços que paralisam
      for (let i = 0; i < 7; i++) shootBullet(P.aim + (i - 3) * 0.13, { spd: 520, life: 0.38, r: 10, color: '#e5e7eb', shape: 'blade', spell: 3 });
      P.furia = Math.max(P.furia, 3);
      fxAt(P.x + Math.cos(P.aim) * 60, P.y + Math.sin(P.aim) * 60, 70, '#e5e7eb'); sfx('boom'); break;
    }
    case 'paladino': // Selo Sagrado (Paladino): dano extra e proteção para o grupo
      emitEvent({ t: 'buff', k: 'selo', x: Math.round(P.x), y: Math.round(P.y), dur: 6, name: P.name });
      emitEvent({ t: 'heal', x: Math.round(P.x), y: Math.round(P.y), amt: roll(2, 8) + lv, name: P.name });
      fxAt(P.x, P.y, 200, '#fde68a'); sfx('lvl'); break;
    case 'mago': { // Feitiço: bomba de projéteis no cursor
      const t = aimPoint(P, 380);
      const bomb = G.bombId = (G.bombId || 0) + 1;
      for (let i = 0; i < 20; i++) shootBullet(i * Math.PI / 10, { x: t.x, y: t.y, spd: 330, life: 0.55, r: 6, color: TYPE_COLORS[tp], shape: 'orb', spell: 1, bomb });
      fxAt(t.x, t.y, 50, TYPE_COLORS[tp]); sfx('boom'); break;
    }
    case 'evocador': { // Cetro Relampejante (Feiticeiro): raio em cadeia
      const t = aimPoint(P, 420);
      let cur = (P.pvp ? pvpFoesNear(t.x, t.y, 160) : []).concat(enemiesNear(t.x, t.y, 160)).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
      if (!cur) { text(P.x, P.y - 40, 'Nenhum alvo perto do cursor', '#cbd5e1', 12); P.abilCd = 0.4; return; }
      const hit = new Set(), pts = [[P.x, P.y]];
      let k = 1;
      for (let j = 0; j < 6 && cur; j++) {
        hit.add(cur.id); pts.push([cur.x, cur.y]);
        if (cur.pvpFoe) { pvpBlast(cur.x, cur.y, 40, (roll(2 + Math.floor(lv / 5), 8) + Math.floor(pod / 2)) * k); break; }
        abilHit(cur, (roll(2 + Math.floor(lv / 5), 8) + Math.floor(pod / 2)) * k, tp);
        k *= 0.85;
        const from = cur;
        cur = enemiesNear(from.x, from.y, 220).filter(e => !hit.has(e.id)).sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      }
      G.fx.push({ k: 'bolt', pts, life: 0.3, max: 0.3, R: 0, r: 0, color: TYPE_COLORS[tp] });
      sfx('crit'); break;
    }
    case 'necromante': { // Crânio Ceifador (Necromante): explosão que drena vida
      const t = aimPoint(P, 360);
      let tot = 0;
      for (const e of enemiesNear(t.x, t.y, 110)) tot += abilHit(e, roll(1 + Math.floor(lv / 5), 10) + Math.floor(pod / 2), tp);
      if (P.pvp && pvpFoesNear(t.x, t.y, 110).length) { const dm = roll(1 + Math.floor(lv / 5), 10) + Math.floor(pod / 2); pvpBlast(t.x, t.y, 110, dm); tot += Math.round(dm * PVP_K); }
      if (tot) { const h = Math.ceil(tot * 0.2); P.hp = Math.min(maxHP(P), P.hp + h); text(P.x, P.y - 34, `+${h}`, '#86efac', 14); }
      fxAt(t.x, t.y, 110, '#a78bfa'); sfx('boom'); break;
    }
    case 'ladino': // Manto: invisibilidade
      P.invis = 3; P.nextCrit = true; burst(P.x, P.y, '#6b7280', 20); break;
    case 'assassino': { // Frasco de Veneno (Assassino): nuvem que corrói
      const t = aimPoint(P, 330);
      G.zones.push({ k: 'veneno', x: t.x, y: t.y, r: 100, t: 4.4, wait: 0.4, every: 0.5, tick: 0 });
      if (P.pvp) emitEvent({ t: 'pvpaoe', x: Math.round(t.x), y: Math.round(t.y), r: 100, dur: 4, wait: 0.4, dmg: Math.max(1, Math.round((roll(1 + Math.floor(lv / 6), 6)) * PVP_K)), name: P.name });
      fxAt(t.x, t.y, 100, '#a3e635'); sfx('pot'); break;
    }
    case 'trapaceiro': { // Prisma Ilusório (Trapaceiro): teleporte + ilusão que atrai os inimigos
      const t = aimPoint(P, 280);
      emitEvent({ t: 'decoy', x: Math.round(P.x), y: Math.round(P.y), dur: 4, cls: P.cls, ptype: pType(P) });
      burst(P.x, P.y, '#c084fc', 16);
      if (walkableR(t.x, t.y, 10) && !solidR(t.x, t.y, 10)) { P.x = t.x; P.y = t.y; }
      P.invis = 2; P.nextCrit = true; burst(P.x, P.y, '#c084fc', 20); sfx('pot'); break;
    }
    case 'clerigo': { // Tomo: cura em área
      const amt = roll(2 + Math.floor(lv / 3), 8) + A(P, 'VIG');
      emitEvent({ t: 'heal', x: Math.round(P.x), y: Math.round(P.y), amt: Math.max(1, Math.round(amt * clericChoir(P))), name: P.name, bl: blessOf(P), r: 260 }); break;
    }
    case 'vida': // Santuário (Sacerdote): área de cura contínua
      G.zones.push({ k: 'santuario', x: P.x, y: P.y, r: 150, t: 6, wait: 0, every: 1, tick: 0 });
      fxAt(P.x, P.y, 150, '#fde68a'); sfx('pot'); break;
    case 'guerra': // Hino de Batalha (Bardo): fúria para o grupo e paralisia em volta
      emitEvent({ t: 'buff', k: 'furia', x: Math.round(P.x), y: Math.round(P.y), dur: 5, name: P.name });
      emitEvent({ t: 'heal', x: Math.round(P.x), y: Math.round(P.y), amt: Math.round((d(8) + Math.floor(lv / 2)) * clericChoir(P)), name: P.name, quiet: 1, bl: blessOf(P), r: 260 });
      for (const e of enemiesNear(P.x, P.y, 170)) if (!e.boss || Math.random() < 0.5) inflict(e, 2);
      fxAt(P.x, P.y, 170, '#f97316'); sfx('boom'); break;
    case 'patrulheiro': // Aljava: flechada pesada que perfura e deixa lento
      shootBullet(P.aim, { spd: 600, life: 0.9, r: 12, color: '#fde047', shape: 'arrow', pierce: true, spell: 2 });
      fxAt(P.x + Math.cos(P.aim) * 30, P.y + Math.sin(P.aim) * 30, 40, '#fde047'); G.shake = Math.min(8, G.shake + 3);
      sfx('crit'); break;
    case 'feras': { // Armadilha da Caçadora (Caçadora)
      const t = aimPoint(P, 300);
      G.zones.push({ k: 'armadilha', x: t.x, y: t.y, r: 120, t: 6, wait: 0.5, every: 0.1, tick: 0 });
      if (P.pvp) emitEvent({ t: 'pvpaoe', x: Math.round(t.x), y: Math.round(t.y), r: 90, dur: 6, wait: 0.5, once: 1, dmg: Math.max(1, Math.round((roll(2 + Math.floor(lv / 4), 8) + pod) * PVP_K)), name: P.name });
      sfx('pick'); break;
    }
    case 'druida': case 'lua': case 'terra': // Forma Selvagem: vira o companheiro líder
      if (!wildShape(P)) return;
      break;
    case 'arcano': // Aljava Arcana: leque de flechas perfurantes
      for (let i = 0; i < 3; i++) shootBullet(P.aim + (i - 1) * 0.14, { spd: 620, life: 0.85, r: 9, color: '#c084fc', shape: 'arrow', pierce: true, left: 2, spell: 4 }); // cada flecha atravessa até 2 inimigos
      sfx('crit'); break;
  }
  if (hasT(P, 'barreira')) { P.shield = Math.round(maxHP(P) * 0.15); P.shieldT = 4; }
  if (hasT(P, 'eco') && Math.random() < 0.25) { P.abilCd = 0.3; text(P.x, P.y - 50, '🔁 Eco!', '#c4b5fd', 13); }
}

// áreas dos especiais (veneno, santuário, armadilha): só quem lançou calcula o efeito
function updateZones(dt) {
  const P = G.P;
  for (const z of G.zones) {
    z.t -= dt;
    if (z.wait > 0) { z.wait -= dt; continue; }
    z.tick -= dt;
    if (z.tick > 0) continue;
    z.tick = z.every;
    if (!P) continue;
    if (z.k === 'veneno') {
      for (const e of enemiesNear(z.x, z.y, z.r)) abilHit(e, roll(1 + Math.floor(P.lvl / 6), 6), 'poison');
    } else if (z.k === 'santuario' || z.k === 'raizes') {
      emitEvent({ t: 'heal', x: Math.round(z.x), y: Math.round(z.y), amt: Math.round((roll(1 + Math.floor(P.lvl / 6), 6) + Math.floor(A(P, 'VIG') / 2)) * (z.k === 'raizes' ? 1 : 1.5)), name: P.name, quiet: 1, r: z.r, bl: z.k === 'santuario' ? blessOf(P) : null });
      for (const e of enemiesNear(z.x, z.y, z.r)) e.slowT = Math.max(e.slowT || 0, 1.2);
    } else if (z.k === 'armadilha') {
      if (!enemiesNear(z.x, z.y, 60).length && z.t > 0) continue;
      for (const e of enemiesNear(z.x, z.y, z.r)) abilHit(e, roll(2 + Math.floor(P.lvl / 4), 8) + A(P, 'POD'), pType(P), 3);
      for (const a of G.allies) if (a.pet) { a.cd = 0; a.spT = Math.min(a.spT, 0.5); a.rageT = 4; }
      emitEvent({ t: 'fx', x: Math.round(z.x), y: Math.round(z.y), r: z.r, color: '#fbbf24' });
      sfx('boom');
      z.t = 0;
    }
  }
  G.zones = G.zones.filter(z => z.t > 0);
  for (const d of G.decoys) d.t -= dt;
  G.decoys = G.decoys.filter(d => d.t > 0);
}

// Rolamento (talento): avanço curto e intocável
function doDash() {
  const P = G.P;
  if (!P || !hasT(P, 'esquiva') || P.dashCd > 0) return;
  const mx = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0), my = (K.KeyS || K.ArrowDown ? 1 : 0) - (K.KeyW || K.ArrowUp ? 1 : 0);
  const a = mx || my ? Math.atan2(my, mx) : P.aim;
  // desliza rápido por um instante (o movimento acontece em updateDash, quadro a quadro)
  P.dash = { a, t: 0.18, trailT: 0 };
  P.dashCd = 3; P.dodgeT = 0.3;
  P.face = Math.cos(a) >= 0 ? 1 : -1;
  sfx('ui');
}
function updateDash(dt) {
  const P = G.P, d = P.dash;
  const inDg = inDungeonArea(P.x), sw = swimFlags(P), step = 820 * dt / 4;
  for (let k = 0; k < 4; k++) {
    const nx = P.x + Math.cos(d.a) * step, ny = P.y + Math.sin(d.a) * step;
    if (inDg ? !walkableR(nx, ny, 10) : solidR(nx, ny, 9, sw)) { d.t = 0; break; }
    P.x = nx; P.y = ny;
  }
  // rastro de imagens fantasma e poeira no chão
  if ((d.trailT -= dt) <= 0) { d.trailT = 0.035; (G.trail = G.trail || []).push({ x: P.x, y: P.y, face: P.face, cls: P.cls, ptype: pType(P), t: 0.28 }); }
  if (Math.random() < 0.6) G.parts.push({ x: P.x + rand(-6, 6), y: P.y + 18, vx: -Math.cos(d.a) * 40 + rand(-15, 15), vy: rand(-20, 0), life: 0.35, color: '#d6cdb8', size: 3 });
  if ((d.t -= dt) <= 0) P.dash = null;
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
  let dmg = sp === 1 ? roll((1 + Math.floor(P.lvl / 6)) * (crit ? 2 : 1), 6) + Math.floor(A(P, 'POD') / 2)
    : sp === 2 ? roll((3 + Math.floor(P.lvl / 3)) * (crit ? 2 : 1), 8) + A(P, 'POD')
      : sp === 3 || sp === 4 ? roll((2 + Math.floor(P.lvl / 4)) * (crit ? 2 : 1), 8) + A(P, 'POD')
      : roll(w.dice[0] * (crit ? 2 : 1), w.dice[1]) + A(P, 'POD') + w.bonus + M(P, 'dmg');
  if (P.furia > 0) dmg += d(6);
  if (P.seloT > 0) dmg += d(6);
  dmg = Math.round(dmg * infernal(P) * (pst(P, 3) ? 0.8 : 1));
  { const w = weatherAt(P.x, P.y); if (w) dmg = Math.round(dmg * (1 + M(P, 'wx' + w.k))); } // encantamento de clima
  if (P.tempTypeT > 0) dmg += d(4);
  if (hasS(P, 'guerra')) dmg += d(6);
  if (crit && P.cls === 'ladino') dmg += roll(Math.ceil(P.lvl / 4), 6);
  if (crit && hasS(P, 'assassino')) dmg = Math.round(dmg * 1.3);
  if (crit && P.race === 'elfo') dmg = Math.round(dmg * 1.5); // precisão élfica
  dmg = Math.max(1, dmg);
  if (!hit) dmg = Math.max(1, Math.floor(dmg / 2));
  const res = typed(P, e, dmg, pType(P));
  if (isWolf(P)) res.dmg = Math.round(res.dmg * 1.2);
  dealDamage(e, res.dmg, sp === 2 ? 3 : 0);
  linSteal1(P, res.dmg);
  hitText(e, res.dmg, res.eff, crit, hit);
  if (!crit) sfx(res.eff > 1 ? 'hitSE' : 'hit');
  if ((sp === 3 && Math.random() < 0.35) || (sp === 4 && Math.random() < 0.4)) inflict(e, 2);
  // Forma Selvagem: causa os mesmos status que o Pokémon em que o Druida virou (mesma chance por acerto)
  if (P.wildT > 0 && !sp) { const ab = petAbility(P.wildPid); if (ab && !e.dead && e.hp > 0 && !e.st && Math.random() < ab.ch) { const st = stPick(ab.st); if (st === 2 && P.wildType === 'electric') e.shockT = G.time + STATUS[2].dur; inflict(e, st); } }
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
  if (P.dodgeT > 0) return;
  if (r === 1 || Math.random() < M(P, 'dodge') + (hasS(P, 'trapaceiro') ? 0.1 : 0) + (P.race === 'halfling' ? 0.08 : 0)) { text(P.x, P.y - 34, 'Esquiva!', '#93c5fd', 12); return; }
  const graze = !crit && r + b.atk < AC(P);
  let eff = typeEff(b.type, [pType(P)]);
  if (eff === 0) { text(P.x, P.y - 34, 'Imune!', '#93c5fd', 12); return; }
  if (eff > 1) eff = 1 + (eff - 1) * 0.6; // super efetivo no herói: ×1,6 (duplo ×2,8), para o tipo não decidir sozinho quem sobrevive
  eff *= ZONE_DMG[b.zone || 1];
  if (race(P).resist.includes(b.type) || MA(P, 'resist').includes(b.type) || (P.lin && LIN[P.lin].resist.includes(b.type))) eff *= 0.5;
  eff *= linTaken(P, b.type); // linhagem
  eff *= wxBoost(P.x, P.y, b.type); // clima
  if (eff > 1 && tRank(P, 'couraca')) eff *= tRank(P, 'couraca') >= 2 ? 0.65 : 0.8; // Couraça Elemental
  if (graze) eff *= 0.34;
  if (P.furia > 0 && hasS(P, 'barbaro')) eff *= 0.5;
  if (P.seloT > 0) eff *= 0.75;
  if (P.race === 'draconato') eff *= 0.9; // escamas
  if (P.graceT > 0) eff *= 0.9; // Graça Salvadora
  let dmg = Math.max(1, Math.round((roll(b.dice[0] * (crit ? 2 : 1), b.dice[1]) + b.dice[2]) * eff));
  if (P.shield > 0) { const ab = Math.min(P.shield, dmg); P.shield -= ab; dmg -= ab; if (!dmg) { text(P.x, P.y - 34, 'Escudo!', '#93c5fd', 12); return; } }
  P.hp -= dmg; P.sinceHit = 0;
  if (b.stc && P.hp > 0 && PST_BY_TYPE[b.type] && Math.random() < PLAYER_ST_CH) playerStatus(P, stPick(PST_BY_TYPE[b.type]), b.type);
  G.shake = Math.min(8, G.shake + 2 + dmg * 0.3);
  const tag = graze ? ' (bloqueado)' : crit ? ' CRÍTICO' : eff > 1 ? ' super efetivo' : eff < 1 ? ' resistido' : '';
  text(P.x, P.y - 34, `-${dmg}${tag}`, graze ? '#cbd5e1' : eff > 1 ? '#ff5e5e' : eff < 1 ? '#fda4af' : '#f87171', graze ? 11 : crit || eff > 1 ? 16 : 14);
  sfx('hurt');
  if (P.hp <= 0) playerDie(b.src);
}

function usePotion() {
  const P = G.P;
  if (P && P.pvp) { text(P.x, P.y - 40, 'Sem poções na arena!', '#fca5a5', 12); return; }
  if (P && isWolf(P)) { text(P.x, P.y - 40, '🐺 A fera não bebe poções', '#fca5a5', 12); return; }
  if (!P || P.pots.hp <= 0 || (P.hp >= maxHP(P) && !(P.pstT > 0))) return; // com status a poção serve mesmo de vida cheia
  const h = Math.round(Math.max(roll(2, 4) + 2, maxHP(P) * 0.3) * (hasT(P, 'alquimista') ? 1.5 : 1));
  P.hp = Math.min(maxHP(P), P.hp + h);
  text(P.x, P.y - 34, `+${h}`, '#86efac', 15);
  curePlayerStatus(P);
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
  if (P.pvp || inArena(P.x, P.y)) return pvpLeave(true, src); // na arena ninguém morre de verdade
  heroAvoid = { cls: [P.cls], race: [P.race], type: [P.ptype] }; // o próximo herói sorteado vem diferente
  const tdg = inDungeonArea(P.x) && dungeonAt(P.x);
  if (tdg && tdg.floor) return towerFall(P, tdg, src); // nem na torre
  if (P.graceT > 0) { // Graça Salvadora de um Clérigo aliado
    P.graceT = 0; P.graceCd = P.graceSelf ? 300 : 90; P.hp = Math.round(maxHP(P) * 0.5); P.sinceHit = 0; P.dodgeT = 2; P.pstT = 0;
    // explosão de luz: paralisa os inimigos em volta (chefes resistem metade das vezes)
    for (const e of enemiesNear(P.x, P.y, 170)) { if (!e.boss || Math.random() < 0.5) inflict(e, 2); e.slowT = Math.max(e.slowT || 0, 2); }
    G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 0, R: 170, life: 0.7, max: 0.7, color: '#fde68a' }); G.shake = Math.min(10, G.shake + 5);
    burst(P.x, P.y, '#fde68a', 40); burst(P.x, P.y, '#ffffff', 24); sfx('lvl');
    G.toasts.push({ text: P.graceSelf ? `🕊️ Sua Graça Salvadora te salvou de ${src}! (volta em 5 min)` : `🕊️ A Graça Salvadora de ${P.graceBy || 'um Clérigo'} te salvou de ${src}!`, color: '#fde68a', t: 5, big: 1 });
    emitEvent({ t: 'chat', sys: 1, text: P.graceSelf ? `🕊️ ${P.name} foi salvo da morte pela própria Graça Salvadora.` : `🕊️ ${P.name} foi salvo da morte pela Graça Salvadora de ${P.graceBy || 'um Clérigo'}.` });
    return;
  }
  burst(P.x, P.y, '#ef4444', 40);
  sfx('die');
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignora */ }
  emitEvent({ t: 'chat', sys: 1, text: `☠ ${P.name} (${heroLabel(P)} Nv ${P.lvl}) foi derrotado por ${src}.` });
  $('death-info').innerHTML = `<p><b>${esc(P.name)}</b>, ${heroLabel(P)} de nível ${P.lvl}, foi derrotado por <b>${esc(src)}</b>.</p>
    <div class="dstats"><div><span>Nível</span><b>${P.lvl}</b></div><div><span>Insígnias</span><b>${totalBadges(P)}</b></div><div><span>Lendários derrotados</span><b>${P.legends || 0}</b></div></div>`;
  G.P = null;
  G.allies = [];
  if (G.npcOpen) closeNPC();
  setTimeout(() => $('death').classList.remove('hidden'), 900);
}

function areaName(x, y) {
  if (inDungeonArea(x)) { const dg = dungeonAt(x); return dg ? THEMES[dg.theme].nome : ''; }
  const z = zoneAt(x, y);
  if (z === 0) { const t = townAt(x, y); if (t) return townName(t); }
  return z >= 0 ? ZONES[z].nome : '';
}

function updatePlayer(dt) {
  const P = G.P;
  const mx = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
  const my = (K.KeyS || K.ArrowDown ? 1 : 0) - (K.KeyW || K.ArrowUp ? 1 : 0);
  const inDg = inDungeonArea(P.x);
  if (inDg && !dungeonAt(P.x)) {
    P.x = rand(-50, 50); P.y = rand(55, 80);
    G.toasts.push({ text: 'A masmorra desmoronou! Você foi levado de volta à vila.', color: '#fca5a5', t: 3 });
    return;
  }
  if (P.dash) { updateDash(dt); P.walk += dt; } // durante o rolamento o movimento normal fica de fora
  P.moving = !P.dash && !!(mx || my);
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
        G.toasts.push({ text: `🌊 A água é funda demais. Um companheiro com Surf (HM02, do ${hmGymOf('surf')}º ginásio) leva você.`, color: '#93c5fd', t: 3 });
      }
      clampWorld(P);
    }
    P.walk += dt;
  }
  if (G.recall) {
    G.recall.t -= dt;
    if (P.moving || P.sinceHit < 0.05) { G.recall = null; text(P.x, P.y - 40, 'Retorno cancelado', '#fca5a5', 12); }
    else if (G.recall.t <= 0) { const t = TOWNS[P.lastTown] || TOWNS[0]; G.recall = null; burst(P.x, P.y, '#fde68a', 20); P.x = t.x + rand(-50, 50); P.y = t.y + rand(55, 80); P.recallCd = 45; burst(P.x, P.y, '#fde68a', 20); sfx('pot'); G.cam.x = P.x; G.cam.y = P.y; return; } // o resto do quadro ainda achava que você estava na masmorra (travava o jogo ao voltar dela)
  }
  const wasSurf = P.surfing;
  if (P.riding && (inDg || !activePet(P) || !G.allies.some(a => a.pet) || !canRide(activePet(P).pid) || G.evo)) P.riding = false;
  P.surfing = !inDg && !P.riding && isDeep(P.x, P.y) && petKnows(P, 'surf');
  P.wading = !inDg && !P.surfing && !P.riding && isWater(P.x, P.y);
  if (P.surfing && !wasSurf) text(P.x, P.y - 44, `🌊 ${activePet(P).name} usou Surf!`, '#93c5fd', 13);
  const mw = mouseWorld();
  P.aim = Math.atan2(mw.y - P.y, mw.x - P.x);
  P.face = Math.cos(P.aim) >= 0 ? 1 : -1;

  P.abilCd = Math.max(0, P.abilCd - dt);
  P.dashCd = Math.max(0, (P.dashCd || 0) - dt); P.dodgeT = Math.max(0, (P.dodgeT || 0) - dt); P.seloT = Math.max(0, (P.seloT || 0) - dt);
  // Mago: Escudo Arcano (absorve até 20% da vida e se recarrega depois de 4 s sem levar dano)
  if (P.cls === 'mago') { const cap = maxHP(P) * 0.2; if (P.sinceHit > 4 && P.shield < cap) P.shield = Math.min(cap, (P.shield || 0) + cap * dt / 2); if (P.shield > 0) P.shieldT = Math.max(P.shieldT || 0, 0.5); }
  if ((P.shieldT = Math.max(0, (P.shieldT || 0) - dt)) <= 0) P.shield = 0;
  P.breathCd = Math.max(0, P.breathCd - dt);
  P.furia = Math.max(0, P.furia - dt);
  P.hasteT = Math.max(0, (P.hasteT || 0) - dt);
  P.ritmoT = Math.max(0, (P.ritmoT || 0) - dt); P.ferasT = Math.max(0, (P.ferasT || 0) - dt);
  P.graceT = Math.max(0, (P.graceT || 0) - dt); P.graceCd = Math.max(0, (P.graceCd || 0) - dt);
  P.invis = Math.max(0, P.invis - dt);
  P.recallCd = Math.max(0, P.recallCd - dt);
  P.abraCd = Math.max(0, (P.abraCd || 0) - dt);
  if (P.tempTypeT > 0) {
    P.tempTypeT -= dt;
    if (P.tempTypeT <= 0) { P.tempType = null; G.toasts.push({ text: `O cristal se apagou. Você voltou a ser tipo ${TYPE_PT[P.ptype]}.`, color: '#cbd5e1', t: 3 }); }
  }
  if (hasS(P, 'vida')) {
    P.auraT -= dt;
    if (P.auraT <= 0) { P.auraT = 4; emitEvent({ t: 'heal', x: Math.round(P.x), y: Math.round(P.y), amt: 2 + Math.floor(P.lvl / 2), name: P.name, quiet: 1 }); }
  }
  P.sinceHit += dt;
  updatePlayerStatus(P, dt);
  autoTick(P, dt);
  wildTick(P, dt);
  linTick(P, dt);
  if (outOfCombat(P) && P.moving && Math.random() < 0.25) G.parts.push({ x: P.x + rand(-8, 8), y: P.y + 16, vx: rand(-15, 15), vy: -10, life: 0.35, color: '#e7dcc4', size: 2 });

  const inV = !inDg && inTown(P.x, P.y);
  const regenK = (hasT(P, 'regeneracao') ? 2.5 : 1) * (1 + M(P, 'regen'));
  const noRegen = inDg && (dungeonAt(P.x) || {}).mods && dungeonAt(P.x).mods.includes('semcura');
  const sunBurn = P.lin === 'vampiro' && !inV && !isNight() && !inDg ? 0.5 : 1; // vampiro: de dia regenera pela metade fora das cidades
  if ((P.sinceHit > 5 || inV) && !noRegen) P.hp = Math.min(maxHP(P), P.hp + (0.3 + A(P, 'VIG') * 0.2 + P.lvl * 0.05) * (inV ? 12 : 1) * regenK * sunBurn * dt);

  P.shootCd -= dt;
  // a vila é zona de paz: ninguém ataca de dentro dela
  const safe = !inDg && inTown(P.x, P.y);
  if ((mouse.down || autofire) && state === 'play' && !G.npcOpen && !safe) {
    while (P.shootCd <= 0) { playerShoot(); P.shootCd += 1 / fireRate(P); }
  } else {
    if (P.shootCd < 0) P.shootCd = 0;
    if (safe && mouse.down && !G.npcOpen && G.time - (G.peaceWarn || -9) > 4) { G.peaceWarn = G.time; text(P.x, P.y - 40, '🕊️ Não dá para atacar de dentro da vila', '#fef3c7', 12); }
  }

  const dgNow = inDungeonArea(P.x) && dungeonAt(P.x); // posição atual (um teleporte no meio do quadro muda o lugar)
  const area = dgNow ? 'dg' + dgNow.id : 'z' + zoneAt(P.x, P.y);
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
      if (it.slot === 'ball') { P.balls++; text(P.x, P.y - 50, '+1 Poké Ball', '#e5e7eb', 12); continue; }
      if (it.slot === 'cons' && CONS[it.k].stat) { drinkStat(P, CONS[it.k].stat); continue; }
      if (it.slot === 'cons' && it.k === 'elixir') continue; // item antigo, não existe mais
      if (it.slot === 'cons') { P.bag[it.k] = (P.bag[it.k] || 0) + 1; text(P.x, P.y - 50, `+1 ${CONS[it.k].nome}`, '#f9a8d4', 12); continue; }
      const i = P.inv.indexOf(null);
      if (i < 0) { left.push(it); continue; }
      it = adaptWeapon(it, P);
      P.inv[i] = it;
      text(P.x, P.y - 50, it.name, itemColor(it), 13);
      if (it.slot !== 'pedra' && itemScore(it) > itemScore(P.equip[it.slot] || null)) text(P.x, P.y - 66, '▲ Melhor que o seu! [B] equipa', '#86efac', 12);
    }
    if (left.length && G.time - G.fullWarn > 3) { G.fullWarn = G.time; G.toasts.push({ text: 'Mochila cheia! (venda na loja ou solte no chão com botão direito)', color: '#fca5a5', t: 2.5 }); }
    if (left.length !== bag.items.length) {
      G.dirty = true; sfx('pick');
      if (bag.id) emitEvent({ t: 'bag', id: bag.id, items: left });
    }
    bag.items = left;
  }
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
      logPush({ name: m.sys ? '' : m.name, text: m.text, color: m.sys ? '#fcd34d' : '#e5e7eb', chat: !m.sys });
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
      if (P && P.pvp && !local) break; // na arena só a sua própria cura vale
      if (P && Math.hypot(P.x - m.x, P.y - m.y) < (m.r || 220)) {
        const before = P.hp;
        P.hp = Math.min(maxHP(P), P.hp + m.amt);
        if (!m.quiet || m.r) curePlayerStatus(P); // curas do Clérigo, Paladino e Santuário tiram o status
        if (m.bl && BLESS[m.bl]) blessApply(P, m, before + m.amt - maxHP(P), local);
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
    case 'pz': pzEvent(m); break;
    case 'buff': {
      const P = G.P;
      if (P && P.pvp && !local) break;
      if (P && Math.hypot(P.x - m.x, P.y - m.y) < 240) {
        if (m.k === 'furia') P.furia = Math.max(P.furia, m.dur); else if (m.k === 'selo') P.seloT = Math.max(P.seloT || 0, m.dur); else P.hasteT = Math.max(P.hasteT || 0, m.dur);
        if (!local) text(P.x, P.y - 44, m.k === 'furia' ? `Berserk! (${m.name})` : m.k === 'selo' ? `Selo Sagrado! (${m.name})` : `Pressa! (${m.name})`, '#fca5a5', 12);
      }
      break;
    }
    case 'pvpinv': case 'pvpok': case 'pvpout': case 'pvpaoe': pvpEvent(m); break;
    case 'decoy': G.decoys.push({ x: m.x, y: m.y, t: m.dur, cls: m.cls, ptype: m.ptype }); break;
    case 'tele': teleEvent(m); break;
    case 'moonch': moonChestEvent(m); break;
    case 'gq': groupQEvent(m, local); break;
    case 'cap2': { const P = G.P; if (!local && P && Math.hypot(P.x - m.x, P.y - m.y) < DUO_R && duoNear(P)) questProgress('duoCaptura', { types: m.types }); break; }
    case 'met': G.meteors.push({ x: m.x, y: m.y, r: m.r, t: m.delay, max: m.delay, zone: m.zone || 1 }); break;
    case 'evdone': onEventDone(m); break;
  }
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
  updateZones(dt);
  updateThrows(dt);
  pvpTick(dt);
  updateWorld(dt);
  updateHM(dt);
  if (P) { storyTick(dt); questTick(dt); }

  if (isHost()) { updateEnemiesHost(dt); hostSpawning(dt); hostBoss(dt); hostDungeons(dt); hostEvents(dt); hostWeather(dt); }
  else { updateEnemiesClient(dt); for (const p of G.portals) p.ttl -= dt; }
  weatherTick(dt);
  dexTick(dt);
  exploreTick(dt);
  hazardTick(dt);
  pzTick(dt);

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
      if (b.bomb) { if (e.bombId !== b.bomb) { e.bombId = b.bomb; e.bombC = 0; } if (e.bombC >= BOMB_CAP) continue; e.bombC++; }
      if (G.P) playerHit(e, b);
      if (G.P && !b.ally && !b.rico && !b.spell && hasT(G.P, 'ricochete')) {
        const nx = G.enemies.filter(o => o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 260).sort((p, q) => Math.hypot(p.x - e.x, p.y - e.y) - Math.hypot(q.x - e.x, q.y - e.y))[0];
        if (nx) shootBullet(Math.atan2(nx.y - e.y, nx.x - e.x), { x: e.x, y: e.y, life: 0.5, rico: true, skip: e.id });
      }
      if (!b.pierce || (b.left && --b.left <= 0)) { b.dead = true; break; }
    }
  }
  G.pb = G.pb.filter(b => !b.dead);
  G.cb = G.cb.filter(b => moveShot(b, dt) && !(b.x < DG_BASE - 5000 && inTown(b.x, b.y)) && !pvpHitCheck(b));

  for (const b of G.bags) b.life -= dt;
  G.bags = G.bags.filter(b => b.life > 0 && b.items.length);
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  G.parts = G.parts.filter(p => p.life > 0);
  if (G.trail) { for (const g of G.trail) g.t -= dt; G.trail = G.trail.filter(g => g.t > 0); }
  for (const t of G.texts) { t.t += dt; t.y -= 40 * dt; }
  G.texts = G.texts.filter(t => t.t < t.life);
  for (const f of G.fx) { f.life -= dt; f.r = f.R * (1 - f.life / f.max); }
  G.fx = G.fx.filter(f => f.life > 0);
  for (const t of G.toasts) { t.t -= dt; if (!t.logged) { t.logged = 1; if (!t.big) { const l = G.chat[G.chat.length - 1]; if (l && l.log && l.text === t.text) { l.n = (l.n || 1) + 1; l.t = G.time; } else { G.chat.push({ text: t.text, log: 1, color: t.color, t: G.time }); if (G.chat.length > 9) G.chat.shift(); } t.t = 0; } G.toastLog = G.toastLog || []; const last = G.toastLog[0]; if (last && last.text === t.text) last.n = (last.n || 1) + 1; else G.toastLog.unshift({ text: t.text, color: t.color, at: G.time }); G.toastLog.length = Math.min(G.toastLog.length, 30); if (!$('tlog').classList.contains('hidden')) renderToastLog(); logPush({ text: t.text, color: t.color, big: t.big }); } }
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
  ctx.font = '12px Barlow Semi Condensed, system-ui, sans-serif';
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
function outlined(s, x, y) { s = padText(s); ctx.strokeText(s, x, y); ctx.fillText(s, x, y); }

function drawShot(b, ox, oy) {
  const x = b.x + ox, y = b.y + oy;
  if (b.shape === 'arrow' && b.r >= 11) return drawHeavyArrow(b, x, y); // Aljava Pesada (também para os tiros vistos de outros jogadores)
  if (b.shape === 'thorn') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(b.a); ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -4); ctx.lineTo(-2, 0); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3f6212'; ctx.fillRect(-8, -1, 6, 2);
    ctx.restore();
  } else if (b.shape === 'blade' || b.shape === 'dagger' || b.shape === 'arrow') {
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

// Aljava Pesada: flecha grande dourada com brilho, rastro e faíscas (fácil de distinguir dos tiros comuns)
function drawHeavyArrow(b, x, y) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 2, x, y, 26);
  g.addColorStop(0, 'rgba(255,240,170,.75)'); g.addColorStop(1, 'rgba(250,204,21,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.fill();
  ctx.translate(x, y); ctx.rotate(b.a); ctx.scale(0.75, 0.75);
  // rastro
  for (let k = 1; k <= 5; k++) { ctx.globalAlpha = 0.45 - k * 0.08; ctx.fillStyle = '#fde047'; ctx.fillRect(-16 - k * 11, -3 + k * 0.3, 12, 6 - k * 0.6); }
  ctx.globalAlpha = 1;
  // haste e ponta grandes, com miolo branco
  ctx.fillStyle = '#b45309'; ctx.fillRect(-22, -3, 36, 6);
  ctx.fillStyle = '#fde047'; ctx.fillRect(-22, -2, 36, 4);
  ctx.fillStyle = '#fff7d6'; ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(12, -10); ctx.lineTo(15, 0); ctx.lineTo(12, 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#b45309'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(-26, -7, 6, 4); ctx.fillRect(-26, 3, 6, 4); // penas
  ctx.restore();
  if (Math.random() < 0.6) G.parts.push({ x: b.x + rand(-6, 6), y: b.y + rand(-6, 6), vx: -Math.cos(b.a) * 60 + rand(-30, 30), vy: -Math.sin(b.a) * 60 + rand(-30, 30), life: 0.35, color: Math.random() < 0.5 ? '#fde047' : '#fff7d6', size: 3 });
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
  drawTeles(ox, oy);
  drawNightStuff(ox, oy);
  for (const z of G.zones) {
    const x = z.x + ox, y = z.y + oy, pulse = 1 + Math.sin(G.time * 6) * 0.04;
    const col = z.k === 'veneno' ? '163,230,53' : z.k === 'santuario' ? '253,230,138' : z.k === 'raizes' ? '134,239,172' : '251,191,36';
    ctx.fillStyle = `rgba(${col},${z.k === 'armadilha' ? 0.12 : 0.22})`; ctx.strokeStyle = `rgba(${col},.8)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, (z.k === 'armadilha' ? 22 : z.r) * pulse, 0, 7); ctx.fill(); ctx.stroke();
    if (z.k === 'armadilha') { ctx.fillStyle = '#78350f'; ctx.fillRect(x - 10, y - 4, 20, 8); ctx.fillStyle = '#d1d5db'; for (let k = -8; k <= 8; k += 4) ctx.fillRect(x + k, y - 8, 2, 4); }
  }
  for (const d of G.decoys) drawPlayerSprite(d.cls || 'ladino', d.x + ox, d.y + oy, 1, Math.floor(G.time * 6) % 2, 0.5, 0, d.ptype);
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
      ctx.font = 'bold 10px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
      if (P && Math.hypot(P.x - b.x, P.y - b.y) < 90) b.items.slice(0, 3).forEach((it, i) => { ctx.fillStyle = itemColor(it); outlined(it.name, x, y - 16 - i * 12); });
      if (b.shared) { ctx.fillStyle = '#e5e7eb'; outlined(`${Math.ceil(b.life)}s`, x, y + 22); }
    }
  }
  drawPortals(ox, oy);
  drawDgChests(ox, oy);
  drawPuzzle(ox, oy);
  drawTowerShop(ox, oy);

  // entidades ordenadas por Y
  const ents = [];
  const vis = (x, y) => x + ox > -200 && x + ox < W + 200 && y + oy > -200 && y + oy < H + 200;
  for (const e of G.enemies) if (vis(e.x, e.y)) ents.push({ y: e.y, e });
  for (const r of G.remotes.values()) {
    if (r.dead || !r.cls || r.tx === undefined) continue;
    ents.push({ y: r.y, r });
    if (!(r.invis && G.P && G.P.pvp)) for (const a of r.allies || []) if (vis(a[1], a[2])) ents.push({ y: a[2], ra: a });
  }
  for (const a of G.allies) ents.push({ y: a.y, a });
  // cidades: prédios e enfeites ficam em coordenadas locais (deslocados pelo centro de cada cidade)
  if (!inDg) for (const t of TOWNS) {
    if (Math.abs(cam.x - t.x) > W + 300 || Math.abs(cam.y - t.y) > H + 300) continue;
    for (const n of t.i ? NPCS2 : NPCS) ents.push({ y: n.y, n });
    for (const b of BUILDINGS) ents.push({ y: t.y + b.y + b.h / 2, bld: b, t });
    for (const d of TOWN_DECOR) ents.push({ y: t.y + d.sy, deco: d, t });
    for (const g of TOWN_GATES[t.i] || []) for (const d of (g.parts = g.parts || gateParts(g))) ents.push({ y: t.y + d.sy, deco: d, t });
  }
  if (G.P) ents.push({ y: G.P.y, me: G.P });
  ents.sort((a, b) => a.y - b.y);
  ctx.textAlign = 'center';
  for (const it of ents) {
    if (it.e) { drawEnemy(it.e, ox, oy); if (!it.e.dg && !it.e.fly) grassOver(it.e.x, it.e.y + it.e.h * 0.35, it.e.x + ox, it.e.y + oy + it.e.h * 0.42, it.e.w * 0.6); }
    else if (it.bld) drawBuilding(it.bld, ox + it.t.x, oy + it.t.y);
    else if (it.deco) { drawDecor(it.deco, ox + it.t.x, oy + it.t.y); if (it.deco.k === 'gate') drawFrontObjs(it.t.x + it.deco.x, it.t.y + it.deco.y, ox, oy); else if (it.deco.k === 'gpost') drawFrontObjs(it.t.x + it.deco.x, it.t.y + it.deco.y, ox, oy, 26); }
    else if (it.n) drawNPC(it.n, ox, oy);
    else if (it.a) {
      const a = it.a;
      if (a.pet && a.slot === G.P.petIdx && (mountPid(G.P) || G.P.wildT > 0)) continue; // virou montaria (desenhada embaixo do jogador)
      drawAlly(a.look || a.pid, a.x, a.y, ox, oy, a.ghost, a.t, a.face, a.moving, a.pet && G.evo && G.P && G.evo.pt === G.P.pets[a.slot], a.pet ? a.lvl : 0);
      grassOver(a.x, a.y + 10, a.x + ox, a.y + oy + 14, 26);
    } else if (it.ra) drawAlly(it.ra[0], it.ra[1], it.ra[2], ox, oy, it.ra[3], G.time, 1, false);
    else if (it.r) {
      const r = it.r, x = r.x + ox, y = r.y + oy, hide = r.invis && G.P && G.P.pvp; // rival invisível na arena: só um vulto
      let lift = 0;
      if (hide) { drawPlayerSprite(r.cls, x, y, r.face || 1, 0, 0.07, r.aim || 0, r.ptype); continue; }
      const rw = r.mount < 0 ? Math.floor(-r.mount / 4) : 0, rk = r.mount < 0 ? -r.mount % 4 : 0; // Druida na Forma Selvagem (Pokémon e tamanho)
      if (r.mount > 0) lift = drawMount(r.mount, r.x, r.y, x, y, r.face || 1, r.moving, G.time); else waterOver(r.x, r.y + 16, x, y + 16, 30);
      const rt = pstTint(r.pst || 0);
      if (r.pst) drawStatusAura(r.pst, x, y);
      if (rt) ctx.filter = rt;
      if (!rw || !drawWildForm(rw, r.x, r.y, x, y, r.face || 1, r.moving, r.invis ? 0.4 : 1, r.ptype, rk)) drawPlayerSprite(r.cls, x, y - lift, r.face || 1, r.mount ? 0 : r.moving ? Math.floor(r.walk * 8) % 2 : 0, r.invis ? (G.P && G.P.pvp ? 0.07 : 0.4) : 1, r.aim || 0, r.ptype);
      ctx.filter = 'none';
      if (r.pst === 7) drawShock(x, y - lift - 4, 30, 40);
      ctx.font = 'bold 11px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.textAlign = 'center';
      outlined(`${r.name} · Nv ${r.lvl}`, x, y - 26);
      grassOver(r.x, r.y + 14, x, y + 18, 28);
      bar(x - 16, y + 22, 32, 4, r.hp / r.maxHp, '#22c55e');
      if (r.bubble) drawBubble(x, y - 32, r.bubble.text);
    } else {
      const P = it.me, x = P.x + ox, y = P.y + oy;
      for (const g of G.trail || []) drawPlayerSprite(g.cls, g.x + ox, g.y + oy, g.face, 1, Math.max(0, g.t / 0.28) * 0.45, P.aim, null); // sem o anel do tipo nos fantasmas
      if (P.shield > 0) { ctx.strokeStyle = 'rgba(147,197,253,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.stroke(); }
      if (P.graceT > 0) { ctx.strokeStyle = 'rgba(253,230,138,.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y - 24 + Math.sin(G.time * 4) * 1.5, 10, 3.5, 0, 0, 7); ctx.stroke(); }
      if (P.seloT > 0) { ctx.strokeStyle = 'rgba(253,230,138,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 30 + Math.sin(G.time * 8) * 2, 0, 7); ctx.stroke(); }
      if (P.furia > 0) { ctx.fillStyle = 'rgba(239,68,68,.25)'; ctx.beginPath(); ctx.arc(x, y, 24 + Math.sin(G.time * 15) * 3, 0, 7); ctx.fill(); }
      const mpid = P.wildT > 0 || P.lform ? 0 : mountPid(P);
      let lift = 0;
      if (mpid) {
        lift = drawMount(mpid, P.x, P.y, x, y, P.face > 0 ? 1 : -1, P.moving, G.time);
        if (P.surfing && P.moving && Math.random() < 0.5) G.parts.push({ x: P.x - Math.cos(P.aim) * 10 + rand(-8, 8), y: P.y + 22, vx: rand(-20, 20), vy: rand(-10, 10), life: 0.6, color: '#e0f2fe', size: 3 });
      } else waterOver(P.x, P.y + 16, x, y + 16, 30);
      const tint = pstTint(P.pstT > 0 ? P.pst : 0);
      if (P.pstT > 0) drawStatusAura(P.pst, x, y);
      if (tint) ctx.filter = tint;
      const lin = P.lin && (P.lform || P.wildT <= 0 || !P.wildT) && drawLinHero(P, x, y - lift, P.invis > 0 ? 0.4 : 1);
      if (!lin && !(P.wildT > 0 && drawWildForm(P.wildPid, P.x, P.y, x, y, P.face, P.moving, P.invis > 0 ? 0.4 : 1, pType(P), wildSizeK(P)))) drawPlayerSprite(P.cls, x, y - lift, P.face, mpid ? 0 : P.moving ? Math.floor(P.walk * 8) % 2 : 0, P.invis > 0 ? 0.4 : 1, P.aim, pType(P));
      ctx.filter = 'none';
      if (pst(P, 2) && P.pstShock) drawShock(x, y - lift - 4, 30, 40);
      if (!mpid) grassOver(P.x, P.y + 14, x, y + 18, 28);
      if (G.recall) { ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - G.recall.t / 1.5)); ctx.stroke(); }
      bar(x - 16, y + 22, 32, 4, P.hp / maxHP(P), '#22c55e');
      bar(x - 16, y + 28, 32, 3, 1 - P.abilCd / abilCd(P), '#60a5fa');
      if (P.wildT > 0) bar(x - 16, y + 33, 32, 3, P.wildT / wildDur(P), '#86efac'); // tempo restante da Forma Selvagem
      if (P.bubble) drawBubble(x, y - 26, P.bubble.text);
    }
  }

  drawThrows(ox, oy);
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
    if (f.k === 'bolt') {
      ctx.strokeStyle = f.color; ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.beginPath();
      f.pts.forEach(([px, py], i) => { const jx = i ? rand(-6, 6) : 0, jy = i ? rand(-6, 6) : 0; if (i) ctx.lineTo(px + ox + jx, py + oy + jy); else ctx.moveTo(px + ox, py + oy); });
      ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
      continue;
    }
    ctx.strokeStyle = f.color; ctx.lineWidth = 4; ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(f.x + ox, f.y + oy, f.r, 0, 7); ctx.stroke();
    if (f.fill) { ctx.globalAlpha = a * 0.3; ctx.fillStyle = f.color; ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // escuridão: noite, névoa das Terras Sombrias (Dissipar Névoa) e masmorras escuras (Flash)
  // Flash do companheiro, ou visão noturna de Vampiros e Lobisomens: enxergam no escuro como com Flash
  const flash = G.P && (petKnows(G.P, 'flash') || !!G.P.lin);
  if (inDg) {
    const dg = dungeonAt(cam.x);
    if (dg && (DARK_THEMES.includes(dg.theme) || dg.mod === 'escuro' || (dg.mods && dg.mods.includes('escuro')))) drawNight(ox, oy, flash ? 460 : 175, 'rgba(0,0,0,0.88)');
  } else {
    const fog = (ZONES[zoneAt(cam.x, cam.y)] || {}).fog && !flash;
    // à noite e na névoa quase não se enxerga sem Flash
    const nk = G.nightK || 0, ease = nk * nk * (3 - 2 * nk); // transição suave
    if (fog && ease < 0.99) drawNight(ox, oy, flash ? 380 : 180, flash ? 'rgba(70,60,90,0.6)' : 'rgba(45,38,60,0.84)', 1 - ease);
    if (nk > 0.01 && nk < 0.99) { ctx.fillStyle = `rgba(251,146,60,${(0.22 * Math.sin(Math.PI * nk)).toFixed(3)})`; ctx.fillRect(0, 0, W, H); } // pôr/nascer do sol
    if (ease > 0.01) drawNight(ox, oy, flash ? 420 : 150, flash ? 'rgba(8,6,30,0.62)' : 'rgba(4,3,16,0.88)', ease);
  }
  drawWeather();
  drawPetHover(ox, oy);
  for (const t of G.texts) {
    ctx.globalAlpha = 1 - t.t / t.life;
    ctx.font = `bold ${t.size}px Barlow Semi Condensed, system-ui, sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = t.color; ctx.textAlign = 'center';
    outlined(t.s, t.x + ox, t.y + oy);
  }
  ctx.globalAlpha = 1;

  drawHUD(ox, oy);
}

function drawEnemy(e, ox, oy) {
  const x = e.x + ox, y = e.y + oy;
  if (e.alfa || e.boss || e.rare) {
    ctx.fillStyle = e.legend ? 'rgba(239,68,68,.18)' : e.moonA ? 'rgba(196,181,253,.35)' : e.boss ? 'rgba(168,85,247,.2)' : e.rare ? 'rgba(103,232,249,.25)' : 'rgba(250,204,21,.22)';
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
    if (e.alfa || e.rare) { ctx.font = 'bold 10px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = e.rare ? '#a5f3fc' : '#fde047'; ctx.fillText(e.name, x, y - e.h / 2 - 16); }
  }
}

// cartão do Pokémon sob a mira (canto inferior direito, pequeno)
function drawTargetCard() {
  const P = G.P;
  if (!P || state !== 'play') return;
  let e = PAD.on && PAD.lock && !PAD.lock.remote ? PAD.lock : null;
  if (!e) {
    const mw = mouseWorld();
    let bd = 1e9;
    for (const o of G.enemies) { if (o.hp <= 0 || o.dead) continue; const d = Math.hypot(o.x - mw.x, o.y - mw.y); if (d < o.r + 14 && d < bd) { bd = d; e = o; } }
  }
  if (!e || !e.p) return;
  if (e.hp <= 0 || e.dead) return;
  const w = 214, h = 58;
  const x = W - w - 12;
  let y = H - h - 74; // logo acima da barra de status (canto inferior direito)
  if (typeof MOBILE !== 'undefined' && MOBILE) y = 184; // celular: abaixo do minimapa (embaixo ficam os botões)
  ctx.fillStyle = 'rgba(13,14,16,.86)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = e.legend ? '#f87171' : e.alfa ? '#facc15' : e.boss ? '#a78bfa' : '#44474f'; ctx.lineWidth = 1; ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
  // ícone
  ctx.fillStyle = '#16171a'; ctx.fillRect(x + 6, y + 6, 46, 46);
  const im = e.p.img;
  if (im) { const k = Math.min(42 / im.width, 42 / im.height); ctx.drawImage(im, x + 29 - im.width * k / 2, y + 29 - im.height * k / 2, im.width * k, im.height * k); }
  // nome e tipos
  ctx.textAlign = 'left'; ctx.font = 'bold 13px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#ece5d6';
  const tag = e.legend ? ' ★' : e.rare ? ' ✨' : '';
  let nm = (e.alfa ? 'Alfa ' : '') + e.p.name + tag + (e.lvl && !e.boss ? ` · Nv ${e.lvl}` : '');
  while (ctx.measureText(nm).width > w - 66 && nm.length > 4) nm = nm.slice(0, -2);
  ctx.fillText(nm, x + 58, y + 17);
  let tx = x + 58;
  ctx.font = 'bold 10px Barlow Semi Condensed, system-ui';
  for (const t of e.p.types) {
    const lab = TYPE_PT[t] || t, tw = ctx.measureText(lab).width + 8;
    ctx.fillStyle = TYPE_COLORS[t] || '#888'; ctx.fillRect(tx, y + 22, tw, 13);
    ctx.fillStyle = '#111'; ctx.fillText(lab, tx + 4, y + 32);
    tx += tw + 4;
  }
  // vida
  const f = clamp(e.hp / e.maxHp, 0, 1), bx = x + 58, by = y + 40, bw = w - 66;
  ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, 10);
  ctx.fillStyle = f > 0.5 ? '#3f9f45' : f > 0.2 ? '#d4a017' : '#c0392b'; ctx.fillRect(bx, by, bw * f, 8);
  ctx.font = 'bold 9px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(e.hp)} / ${e.maxHp}`, bx + bw / 2, by + 7.5);
  ctx.textAlign = 'left';
}

// avisos: um feed no canto direito (embaixo do minimapa), em cartões fáceis de ler, em vez do meio da tela
function wrapText(text, maxW, maxLines) {
  const words = String(text).split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; if (lines.length === maxLines - 1) break; } else cur = t;
  }
  const rest = words.slice(lines.join(' ').split(' ').filter(Boolean).length).join(' ');
  if (lines.length === maxLines - 1 && rest) { let l = rest; while (ctx.measureText(l + '…').width > maxW && l.length > 4) l = l.slice(0, -1); lines.push(l === rest ? l : l + '…'); }
  else if (cur) lines.push(cur);
  return lines;
}
function drawToasts(topY = 12) {
  // um aviso por vez, no canto superior esquerdo, abaixo das linhas da área/missão (o mais recente substitui o anterior).
  // Texto longo quebra em linhas (nada é cortado); o histórico completo fica na tecla [L].
  const big = G.toasts.filter(x => x.big), t = big[big.length - 1];
  if (!t) return;
  const n = big.filter(x => x.text === t.text).length;
  ctx.save();
  ctx.font = '600 15px Barlow Semi Condensed, system-ui';
  const room = Math.min(460, W * 0.4);
  const lines = wrapText(t.text + (n > 1 ? ` (×${n})` : ''), room, 5);
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 30, x = 10, y = topY, h = lines.length * 19 + 6;
  ctx.globalAlpha = Math.min(1, t.t * 1.5);
  ctx.fillStyle = 'rgba(13,14,16,.96)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = t.color || '#e5e7eb'; ctx.fillRect(x + 8, y + 9, 6, 6);
  ctx.fillStyle = '#efe9dc'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((l, k) => ctx.fillText(l, x + 20, y + 4 + k * 19));
  ctx.restore();
}
function drawHUD(ox, oy) {
  const P = G.P;
  const cx = P ? P.x : G.cam.x, cy = P ? P.y : G.cam.y;
  const dg = inDungeonArea(cx) ? dungeonAt(cx) : null;
  const name = areaName(cx, cy);
  // fundo escuro suave atrás das linhas de informação (legíveis sobre grama clara e neve)
  { const bh = (G.hudYLast || 40) + 10, gr = ctx.createLinearGradient(0, 0, 560, 0);
    gr.addColorStop(0, 'rgba(8,9,12,.62)'); gr.addColorStop(0.75, 'rgba(8,9,12,.35)'); gr.addColorStop(1, 'rgba(8,9,12,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 560, bh); }
  ctx.textAlign = 'left'; ctx.font = 'bold 14px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  let hy = 22;
  if (dg && dg.floor) { outlined(`🗼 Torre Infinita · Andar ${dg.floor}`, 12, hy); if (dg.mods.length) { hy += 18; ctx.fillStyle = '#c4b5fd'; outlined(dg.mods.map(m => TOWER_MODS[m]).join(' · '), 12, hy); ctx.fillStyle = '#fff'; } }
  else if (dg) {
    outlined(`${name} · Zona ${clamp(dg.zone, 1, 5)}/5 · ${dgLevelTxt(dg)}`, 12, hy);
    ctx.font = 'bold 12px Barlow Semi Condensed, system-ui';
    for (const [t, c] of dgInfo(dg, P)) { hy += 16; ctx.fillStyle = c; outlined(t, 12, hy); }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Barlow Semi Condensed, system-ui';
  }
  else {
    const z = zoneAt(cx, cy);
    if (z >= 0) outlined(`${REGION.nome} · ${name} ${z === ARENA_Z ? '(duelo entre jogadores)' : z ? `· Zona ${z}/5 · Nv ${ZONES[z].lvl}–${ZONES[z].lvlMax}` : '· área segura'}`, 12, hy);
    else { const wz = waterZone(cx, cy); outlined(`${REGION.nome} · ${tileKind(cx, cy) === TK.SEA ? 'Mar' : 'Lago'} · Zona ${wz}/5 · Nv ${ZONES[wz].lvl}–${ZONES[wz].lvlMax}`, 12, hy); }
    const wxh = P && weatherAt(P.x, P.y);
    if (wxh) { hy += 18; ctx.fillStyle = wxh.color; outlined(`${wxh.icon} ${wxh.nome}: ${wxh.fx}`, 12, hy); ctx.fillStyle = '#fff'; }
  }
  ctx.font = '12px Barlow Semi Condensed, system-ui';
  if (NET.mode !== 'solo') { hy += 18; outlined(`Sala ${NET.room} · ${G.remotes.size + 1} jogador(es)${NET.mode === 'host' ? ' · você é o host' : ''}`, 12, hy); }
  const ev = evView();
  if (ev) {
    hy += 20; ctx.font = 'bold 13px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fdba74';
    const extra = ev.total ? ` — ${ev.left}/${ev.total} restantes` : '';
    const dist = P && ev.kind !== 'noite' && ev.kind !== 'meteoros' ? ` · ${Math.round(Math.hypot(ev.x - P.x, ev.y - P.y) / 32)}m` : '';
    outlined(`${EVENT_ICONS[ev.kind]} ${ev.label}${extra} · ${ev.ttl}s${dist}`, 12, hy);
  }
  if (P) hy = drawStoryHUD(hy, ox, oy);
  if (P) hy = drawQuestHUD(hy, ox, oy);
  if (P && P.pstT > 0 && PST[P.pst]) {
    hy += 20; ctx.font = 'bold 13px Barlow Semi Condensed, system-ui'; ctx.fillStyle = PST[P.pst].color;
    outlined(`${PST[P.pst].label}: ${Math.ceil(P.pstT)}s (poção ou cura tira)`, 12, hy);
  }
  if (P && P.tempTypeT > 0) {
    hy += 20; ctx.font = 'bold 13px Barlow Semi Condensed, system-ui'; ctx.fillStyle = TYPE_COLORS[P.tempType];
    outlined(`💎 Tipo ${TYPE_PT[P.tempType]}: ${Math.ceil(P.tempTypeT)}s`, 12, hy);
  }
  drawPadReticle();
  if (typeof drawTouch === 'function') drawTouch();
  try { drawTargetCard(); } catch (e) { /* o cartão nunca pode travar o desenho do jogo */ }
  if (autofire) { hy += 18; ctx.font = 'bold 12px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fde047'; outlined('TIRO AUTOMÁTICO (T)', 12, hy); }
  if (P && catchUp(P) > 1 && !inDungeonArea(P.x)) { hy += 18; ctx.font = 'bold 12px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#86efac'; outlined(`⏫ Recuperação: +50% de XP até o Nv ${STORY[P.story.ch].lvl}`, 12, hy); }
  G.hudY = hy; G.hudYLast = hy; // a caixinha de avisos importantes fica logo abaixo destas linhas

  if (G.banner > 0 && name) {
    ctx.globalAlpha = Math.min(1, G.banner);
    ctx.textAlign = 'center'; ctx.font = 'bold 36px Tiny5, sans-serif'; ctx.lineWidth = 5; ctx.fillStyle = dg ? THEMES[dg.theme].accent : '#fef3c7';
    outlined(name, W / 2, H * 0.28);
    const z = dg ? dg.zone : zoneAt(cx, cy);
    if (z > 0 && P) {
      const Z = ZONES[Math.min(z, 5)], rec = Z.lvl, top = Z.lvlMax || 30, low = P.lvl < rec - 1, high = P.lvl > top + 1;
      ctx.font = 'bold 16px Barlow Semi Condensed, system-ui'; ctx.lineWidth = 4; ctx.fillStyle = low ? '#fca5a5' : high ? '#9ca3af' : '#e5e7eb';
      outlined(low ? `⚠ Perigoso para o seu nível (recomendado ${rec}–${top})` : high ? `Fácil para o seu nível (recomendado ${rec}–${top})` : `Nível recomendado ${rec}–${top}`, W / 2, H * 0.28 + 26);
    }
    ctx.globalAlpha = 1;
  }

  if (P && !G.npcOpen) {
    let hint = null, col = '#fef3c7';
    if (G.nearPortal) { const p = G.nearPortal; hint = p.exit ? '[E] Sair da masmorra' : `[E] Entrar: ${THEMES[p.theme].nome}`; col = p.exit ? '#facc15' : THEMES[p.theme].accent; }
    else if (nearMoonChest(P)) hint = '[E] Abrir o Baú da Lua';
    else if (nearXChest(P)) hint = nearXChest(P).kind === 'gua' && guardAlive(nearXChest(P)) ? '👑 Derrote o guardião para abrir o baú' : '[E] Abrir o baú';
    else if (G.nearNPC) hint = G.nearNPC.id === 'pc' ? '[E] Acessar o Banco Pokémon' : G.nearNPC.id === 'tshop' ? '[E] Ver a loja da Torre' : G.nearNPC.id === 'grupo' ? '[E] Ler o Mural de Grupo' : `[E] Falar com ${G.nearNPC.nome}`;
    else if (!gateOpen() && [[0, -40], [0, 40], [-40, 0], [40, 0]].some(([dx, dy]) => tileKind(P.x + dx, P.y + dy) === TK.GATE)) { hint = `🏅 Portão da Liga: abre com 7 insígnias (você tem ${badgeCount(P)})`; col = '#fcd34d'; }
    else if (G.nearHM) { hint = hmHint(P, G.nearHM); col = G.nearHM.k === 'chest' || petKnows(P, G.nearHM.k) ? '#86efac' : '#cbd5e1'; }
    if (hint) { ctx.textAlign = 'center'; ctx.font = 'bold 16px Barlow Semi Condensed, system-ui'; ctx.lineWidth = 4; ctx.fillStyle = col; outlined(hint, W / 2, H / 2 + 70); }
  }


  let boss = null, bd = 1000;
  for (const e of G.enemies) if (e.boss && P) { const dd = Math.hypot(e.x - P.x, e.y - P.y); if (dd < bd) { bd = dd; boss = e; } }
  if (boss) {
    const w = Math.min(420, W - 260);
    bar(W / 2 - w / 2, 74, w, 12, boss.hp / boss.maxHp, boss.legend ? '#dc2626' : '#a855f7');
    ctx.font = 'bold 13px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    outlined(`${boss.name} — ${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp}${boss.legend ? ` · ♻ regenera ${Math.round(boss.maxHp * legendRegen(boss))}/s${legendRegen(boss) > LEGEND_REGEN ? ' (sozinho! traga mais alguém)' : ''}` : ''}`, W / 2, 68);
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
      ctx.font = 'bold 11px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fca5a5'; ctx.strokeStyle = '#000';
      outlined(`${legend.name} ${P ? Math.round(Math.hypot(legend.x - P.x, legend.y - P.y) / 32) + 'm' : ''}`, ex, ey + 24);
    }
  }

  // minimapa
  if (showMap) {
    let mx = W - 172, my = 12, mw = 160;
    let toM, mh = 160, big = false;
    if (dg) {
      const mm = dungeonMinimap(dg);
      mh = mm.height;
      ctx.globalAlpha = 0.9; ctx.drawImage(mm, mx, my); ctx.globalAlpha = 1;
      toM = (x, y) => [mx + (x - dg.ox) / TILE * 0.8, my + (y - dg.oy) / TILE * 0.8];
    } else if (MINIMAP && KNOWN && P) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (showMap === 2) {
        // mapa da região inteira (com névoa no que ainda não foi explorado)
        big = true;
        const sc = Math.min((W - 80) / (WX1 - WX0), (H - 140) / (WY1 - WY0));
        mw = Math.round((WX1 - WX0) * sc); mh = Math.round((WY1 - WY0) * sc);
        mx = Math.round((W - mw) / 2); my = Math.round((H - mh) / 2) + 20;
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
        ctx.drawImage(KNOWN, mx, my, mw, mh);
        toM = (x, y) => [mx + (x - WX0) * sc, my + (y - WY0) * sc];
      } else {
        // minimapa com zoom: só os arredores do jogador
        const sc = mw / 4200;
        ctx.fillStyle = '#0b1020'; ctx.fillRect(mx, my, mw, mh);
        ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
        ctx.globalAlpha = 0.92;
        ctx.drawImage(KNOWN, mx + mw / 2 + (WX0 - P.x) * sc, my + mh / 2 + (WY0 - P.y) * sc, KNOWN.width * MAP_S * sc, KNOWN.height * MAP_S * sc);
        ctx.globalAlpha = 1;
        toM = (x, y) => [mx + mw / 2 + (x - P.x) * sc, my + mh / 2 + (y - P.y) * sc];
      }
      ctx.restore();
    }
    if (toM) {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
      // marcadores fora do minimapa: ★ e 🎯 grudam na borda (apontando a direção); o resto some
      const inBox = (a, b) => a >= mx && b >= my && a <= mx + mw && b <= my + mh;
      const edge = ([a, b]) => [clamp(a, mx + 7, mx + mw - 7), clamp(b, my + 7, my + mh - 7)];
      const _toM = toM;
      if (!dg && !big) toM = (x, y) => { const p = _toM(x, y); return inBox(p[0], p[1]) ? p : [-999, -999]; };
      if (big) {
        // nomes das cidades já visitadas
        ctx.font = 'bold 11px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
        for (const l of LANDMARKS) if (P.fly.includes(l.id)) { const [a, b] = toM(l.x, l.y); ctx.fillStyle = '#fef3c7'; ctx.fillRect(a - 2, b - 2, 4, 4); outlined(l.nome, a, b - 6); }
        ctx.font = '12px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#cbd5e1';
        const allC = SECRETS.length + XCHESTS.length, gotC = SECRETS.filter(s => P.chests.includes(s.id)).length + XCHESTS.filter(c => xOpen(P, c)).length;
        outlined(`🗺️ ${REGION.nome} · ${Math.round(landExplored())}% explorado · Baús ${gotC}/${allC} · [M] esconde`, W / 2, my - 10);
      }
      const same = x => (dg ? dungeonAt(x) === dg : !inDungeonArea(x));
      if (P && P.race === 'elfo') {
        for (const e of G.enemies) if (same(e.x) && Math.hypot(e.x - P.x, e.y - P.y) < 1000) { const [a, b] = toM(e.x, e.y); ctx.fillStyle = '#f87171'; ctx.fillRect(a - 1, b - 1, 3, 3); }
      }
      if (ev && ev.kind !== 'noite' && same(ev.x)) {
        const [a, b] = toM(ev.x, ev.y);
        ctx.font = 'bold 13px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fdba74'; ctx.strokeStyle = '#000';
        outlined(EVENT_ICONS[ev.kind], a, b + 5);
      }
      // passagens bloqueadas por HM (apagadas quando você já pode passar)
      if (!dg && P) {
        ctx.font = '10px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center';
        for (const g of GATES) {
          if (!fogSeen(g.x, g.y)) continue; // só aparece depois de visto
          const open = g.k === 'badge' ? gateOpen() : P.hms.includes(g.k);
          const [a, b] = toM(g.x, g.y);
          ctx.globalAlpha = open ? 0.35 : 1;
          ctx.fillText({ cut: '✂️', smash: '🪨', surf: '🌊', badge: '🏅' }[g.k], a, b + 4);
        }
        ctx.globalAlpha = 1;
      }
      const qt = !dg && questTarget(P);
      if (qt) { const [a, b] = dg || big ? toM(qt.x, qt.y) : edge(_toM(qt.x, qt.y)); ctx.font = 'bold 12px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; outlined('🎯', a, b + 4); }
      const stt = !dg && storyTarget(P);
      if (stt) { const [a, b] = dg || big ? toM(stt.x, stt.y) : edge(_toM(stt.x, stt.y)); ctx.font = 'bold 14px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fde047'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; outlined('★', a, b + 5); }
      for (const p of G.portals) if (same(p.x)) { const [a, b] = toM(p.x, p.y); ctx.fillStyle = p.exit ? '#facc15' : THEMES[p.theme].accent; ctx.beginPath(); ctx.arc(a, b, 4, 0, 7); ctx.fill(); }
      for (const r of G.remotes.values()) if (!r.dead && r.tx !== undefined && same(r.x) && !(r.invis && P && P.pvp)) { const [a, b] = toM(r.x, r.y); ctx.fillStyle = '#38bdf8'; ctx.fillRect(a - 2, b - 2, 5, 5); }
      for (const e of G.enemies) if (e.boss && same(e.x)) { const [a, b] = toM(e.x, e.y); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(a, b, 5, 0, 7); ctx.fill(); }
      if (P) { const [a, b] = toM(P.x, P.y); ctx.fillStyle = '#fff'; ctx.fillRect(a - 2.5, b - 2.5, 6, 6); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(a - 2.5, b - 2.5, 6, 6); }
    }
  }

  // chat da sala + log dos avisos comuns: mesma fonte, quebrando na largura da caixa de vida (nada fica para fora)
  ctx.textAlign = 'left'; ctx.font = '13px Barlow Semi Condensed, system-ui';
  let chy = H - 160;
  const chatOpen = !$('chat-in').classList.contains('hidden'); // com o chat aberto, o histórico rolável mostra tudo
  for (let i = G.chat.length - 1; i >= 0 && chy > H * 0.45 && !chatOpen; i--) {
    const c = G.chat[i], age = G.time - c.t;
    const txt = c.log ? c.text + (c.n > 1 ? ` (×${c.n})` : '') : c.sys ? c.text : `${c.name}: ${c.text}`;
    const lines = wrapText(txt, 296, 3);
    ctx.globalAlpha = age > 20 ? Math.max(0.25, 1 - (age - 20) / 5) : 1;
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = c.log ? '#d6d0c4' : c.sys ? '#fcd34d' : '#e5e7eb';
    for (let k = lines.length - 1; k >= 0; k--) { outlined(lines[k], 12, chy); chy -= 16; }
    chy -= 2;
  }
  ctx.globalAlpha = 1;
  drawToasts((G.hudY || 22) + 10);
}

/* ---------- Painel lateral ---------- */
const typeBadge = t => `<span class="tbadge" style="background:${TYPE_COLORS[t]}">${TYPE_PT[t]}</span>`;
function updatePanel() {
  const P = G.P;
  if (!P) return;
  const c = CLASSES[P.cls];
  const mh = maxHP(P), need = xpNeed(P.lvl);
  $('b-hp').style.width = (P.hp / mh * 100) + '%'; $('t-hp').textContent = `PV ${Math.ceil(P.hp)} / ${mh}`;
  const S = P.pstT > 0 && PST[P.pst], chip = $('p-st');
  $('b-hp').style.background = S ? S.color : '';
  chip.classList.toggle('hidden', !S);
  if (S) { chip.style.background = S.color; chip.textContent = `${S.label} ${Math.ceil(P.pstT)}s · ${S.fx} · poção ou cura tira`; }
  $('b-xp').style.width = (P.lvl >= MAX_LVL ? 100 : P.xp / need * 100) + '%'; $('t-xp').textContent = P.lvl >= MAX_LVL ? `Nv ${P.lvl} · NÍVEL MÁXIMO` : `Nv ${P.lvl} · XP ${P.xp} / ${need}`;
  $('p-derived').innerHTML = `<div class="st" title="Classe de Armadura: o d20 inimigo + bônus precisa igualar ou superar"><span>CA</span><b>${AC(P)}</b></div>
    <div class="st" title="Bônus de acerto (d20 + isto contra a CA do inimigo)"><span>Acerto</span><b>+${toHit(P)}</b></div>
    <div class="st" title="Ouro"><span>Ouro</span><b style="color:var(--gold)">${P.gold}</b></div><div class="st" title="Insígnias conquistadas em todas as regiões"><span>Insígnias</span><b>${totalBadges(P)}</b></div><div class="st" title="Pokémon lendários derrotados"><span>Lendários</span><b>${P.legends || 0}</b></div>
    <div class="ptype" title="Seu tipo define o que é super efetivo nos seus ataques e quais ataques te acertam forte">Tipo: ${typeBadge(pType(P))}${P.tempTypeT > 0 ? ` <span class="small">cristal ${Math.ceil(P.tempTypeT)}s (natural: ${TYPE_PT[P.ptype]})</span>` : ''}</div>`;
  const ab = curAbil(P), cd = abilCd(P);
  $('p-abil').innerHTML = `<div class="abil ${P.abilCd > 0 ? 'off' : ''}" title="${ab.desc}"><i class="cd" style="width:${P.abilCd > 0 ? Math.min(100, P.abilCd / cd * 100) : 0}%"></i><b>[Espaço] ${ab.nome}</b> <span>${P.abilCd > 0 ? P.abilCd.toFixed(1) + 's' : 'pronto'}</span></div>
    ${blessPhase(P) ? `<div class="small" title="${blessOf(P) ? BLESS[blessOf(P)].desc : 'Escolha uma bênção no templo da 2ª cidade'}">✝ Bênção: ${blessOf(P) ? `${BLESS[blessOf(P)].icon} ${BLESS[blessOf(P)].nome}` : `nenhuma (escolha no templo de ${esc(TOWNS[1] ? townName(TOWNS[1]) : 'a 2ª cidade')})`}</div>` : ''}
    ${blessBuffs(P)}${linBuffs(P)}<div class="small" title="Voltar à última cidade visitada: fique parado 1,5s">[R] ${esc(townName(TOWNS[P.lastTown] || TOWNS[0]))}: ${P.recallCd > 0 ? Math.ceil(P.recallCd) + 's' : 'pronto'}${P.hms.includes('fly') ? ` · [V] Fly: ${P.flyCd > 0 ? Math.ceil(P.flyCd) + 's' : 'pronto'} (${P.fly.length} destinos)` : ''}</div>`;
  padFixDom($('p-abil'));
  if (!G.dirty) return;
  G.dirty = false;
  const rc = race(P), sub = P.subclass ? subInfo(P.subclass) : null;
  $('p-head').innerHTML = `<div class="pname">${esc(P.name)}</div>${P.title ? `<div class="ptitle" data-title="1" title="${(P.titles || []).length > 1 ? 'Clique para trocar o título' : 'Seu título'}">🏅 ${esc(P.title)}${(P.titles || []).length > 1 ? ' ⇄' : ''}</div>` : ''}<div class="pcls" title="${rc.traco}">${rc.nome} ${c.nome}${sub ? ` (${sub.nome})` : ''} · Nível ${P.lvl}</div>`;
  let choose = '';
  if (P.lvl >= SUB_LVL && !P.subclass) {
    choose += `<h4>Escolha sua subclasse <span class="pts">nível ${SUB_LVL}!</span></h4>` + SUBCLASSES[P.cls].map(s =>
      `<button class="tal sub" data-sub="${s.id}"><b>${s.icon} ${s.nome}</b><span>${s.desc}<br><b>Especial: ${s.abil.nome}</b> — ${s.abil.desc}</span></button>`).join('');
  }
  if (P.talentOffer) {
    choose += `<h4>Escolha um talento <span class="pts">novo!</span></h4>` + P.talentOffer.map(id =>
      `<button class="tal" data-tal="${id}"><b>${TALENTS[id].icon} ${TALENTS[id].nome}${TALENTS[id].max ? ` ${tRank(P, id) + 1}/${TALENTS[id].max}` : ''}${TALENTS[id].types ? ` <i class="tbadge" style="background:${TYPE_COLORS[P.ptype]}">do seu tipo</i>` : ''}</b><span>${TALENTS[id].desc}</span></button>`).join('');
  }
  if (P.talents.length || sub) {
    choose += `<h4>Talentos</h4><div class="tchips">${sub ? `<span class="subchip" title="${sub.desc}">${sub.icon} ${sub.nome}</span>` : ''}${[...new Set(P.talents)].map(id => `<span title="${TALENTS[id].desc}">${TALENTS[id].icon} ${TALENTS[id].nome}${tRank(P, id) > 1 ? ' ×' + tRank(P, id) : ''}</span>`).join('')}</div>`;
  }
  $('p-talents').innerHTML = choose;
  $('p-attrs').innerHTML = `<h4>Atributos <span class="small" title="Ganhe +1 ponto por nível. A cada 2 pontos o atributo rende +1. Poções de Poder/Agilidade/Vigor (Alfas, chefes, lendários, baús) dão +2 para sempre.">máx ${ATTR_MAX}</span>${P.points ? `<span class="pts">${P.points} ponto(s)!</span>` : ''}</h4>` + ATTRS.map(k => {
    const v = Araw(P, k), bonus = v - P.attrs[k];
    return `<div class="attr" title="${ATTR_DESC[k]}"><span class="an">${ATTR_NAMES[k]}</span><span><span class="pips" style="width:${Math.min(100, P.attrs[k] / ATTR_MAX * 100)}%"></span></span><span class="av">${v}${bonus ? `<i>(+${bonus})</i>` : ''}</span>
      ${P.points && P.attrs[k] < ATTR_MAX ? `<button data-attr="${k}">+</button>` : '<span></span>'}</div>`;
  }).join('');
  const slot = (s, label) => {
    const it = P.equip[s];
    return `<div class="slot" ${it ? `style="border-color:${TIER_COLORS[it.tier]}" title="${esc(it.name)}${it.upg ? ' +' + it.upg : ''} — ${itemDesc(it)} (${TIER_NAMES[it.tier]})${s === 'anel' || s === 'amuleto' ? ' · clique para guardar' : ''}"` : `title="${label} vazio"`} data-eq="${s}">
      ${it ? itemIcon(it) : '<span class="empty">' + label + '</span>'}</div>`;
  };
  const nb = bestSwaps(P).length;
  $('p-equip').innerHTML = `<h4>Equipamento${nb ? `<button data-eqbest="1" class="eqbest" title="Troca o que está equipado pelos itens melhores da mochila [B]">⬆ Equipar o melhor (${nb})</button>` : ''}</h4><div class="eqrow">${slot('arma', 'Arma')}${slot('armadura', 'Armad.')}${slot('anel', 'Anel')}${slot('amuleto', 'Amul.')}</div>
    <div class="small">${esc(P.equip.arma.name)}${P.equip.arma.upg ? ' +' + P.equip.arma.upg : ''}: ${itemDesc(P.equip.arma)}</div>`;
  $('p-inv').innerHTML = `<h4>Mochila</h4><div class="inv">` + P.inv.map((it, i) => {
    if (!it) return `<div class="slot"></div>`;
    const better = it.slot !== 'pedra' && itemScore(it) > itemScore(P.equip[it.slot] || null);
    const hint = it.slot === 'pedra' ? 'Clique: usar' : 'Clique: equipar';
    return `<div class="slot" data-inv="${i}" style="border-color:${itemColor(it)}" title="${esc(it.name)} — ${itemDesc(it)}${it.slot === 'pedra' ? '' : ` (${TIER_NAMES[it.tier]})`}\n${hint} · Shift+clique: ${it.locked ? 'destravar' : 'travar (não vende nem solta)'} · Botão direito: soltar no chão">${itemIcon(it)}${better ? '<i class="up">▲</i>' : ''}${it.locked ? '<i class="lock">🔒</i>' : ''}</div>`;
  }).join('') + '</div>';
  const bsel = P.ballSel || 'poke';
  $('p-pots').innerHTML = `<div class="potrow"><button data-pot="1" title="Poção de cura [Q] · botão direito: soltar uma no chão">❤️ ×${P.pots.hp}<kbd class="hk">Q</kbd></button><button data-abra="1" title="Talismã de Abra [Z]: te teletransporta na hora para a última cidade, até no meio de uma luta ou de uma masmorra. Só no Mercador (1000 🪙), um por vez, 5 min de recarga.">🌀 ×${P.bag.abra || 0}${P.abraCd > 0 ? ` (${Math.ceil(P.abraCd / 60)} min)` : ''}<kbd class="hk">Z</kbd></button></div>
    <div class="potrow balls">${Object.keys(BALLS).map(k => `<button data-ball="${k}" class="${bsel === k ? 'sel' : ''}" title="${BALLS[k].nome} (+${BALLS[k].bonus} na captura). Clique (ou [G]) para escolher qual o F joga.">${BALLS[k].icon} ×${ballCount(P, k)}${bsel === k ? '<kbd class="hk">F</kbd>' : ''}</button>`).join('')}</div>`;
  $('p-pets').innerHTML = `<h4>Companheiros <span class="small" title="Fora da Pokébola / máximo ao mesmo tempo">${P.petAct.length}/${petSlots(P)} fora · ${P.pets.length}/${petCap(P)}</span></h4>` + (P.pets.length
    ? `<div class="pets">${P.pets.map((pt, i) => {
      const ev = evoLevel(pt.pid);
      const sTxt = stoneTxt(pt), sReady = stoneOpts(pt.pid).some(o => pt.lvl >= o[1] && hasCrystal(P, o[2]) >= 0);
      const lTxt = ev === undefined ? '' : ev ? (pt.lvl >= ev ? 'pronto para evoluir!' : `evolui no Nv ${ev}`) : sTxt ? '' : 'forma final';
      const evt = [lTxt, sTxt].filter(Boolean).join(' · ');
      const on = P.petAct.includes(i);
      return `<div class="pet ${on ? 'on' : ''}" data-pet="${i}" title="${esc(pt.name)} (${TYPE_PT[pt.type]}) · ${evt}\nClique: ${on ? 'guardar' : 'chamar'}${i === P.petIdx ? ' · líder (HMs e montaria)' : ''} · Botão direito 2×: soltar">
        <img src="${petIconUrl(pt.pid)}" alt=""><span>${esc(pt.name)} <b>Nv ${pt.lvl}</b></span>${typeBadge(pt.type)}
        <div class="pxp"><div style="width:${pt.lvl >= PET_MAX ? 100 : Math.min(100, pt.xp / petNeed(pt.lvl) * 100)}%"></div></div><i>${evt}</i>
        <div class="phm">${sReady ? `<button class="hmt pulse" data-stoneevo="${i}" title="Dar o cristal: ${pt.name} ${sTxt} (o cristal é consumido)">💎</button>` : ''}${HM_KEYS.map(k => (pt.hms || []).includes(k) ? `<span class="hmk" title="${HMS[k].nome}">${HMS[k].icon}</span>`
          : P.hms.includes(k) && canLearn(pt.pid, k) ? `<button class="hmt${P.hmTeach === k ? ' pulse' : ''}" data-teach="${i}:${k}" title="Ensinar ${HMS[k].mo} ${HMS[k].nome}">+${HMS[k].icon}</button>` : '').join('')}</div></div>`;
    }).join('')}</div>${P.bag.doce && P.petIdx >= 0 ? `<button data-candy="1" class="candy">🍬 Dar Doce Raro ao ativo (×${P.bag.doce})</button>` : ''}`
    : '<div class="small">Enfraqueça um Pokémon, mire nele e aperte <b>[F]</b> para jogar uma Poké Ball. Companheiros sobem de nível e evoluem!</div>')
    + (P.hms.length ? `<div class="small keyit">Itens-chave: ${P.hms.map(k => `<span title="${HMS[k].desc}">${HMS[k].icon} ${HMS[k].mo} ${HMS[k].nome}</span>`).join(' ')}</div>` : '');
  if (NET.mode === 'host') $('p-room').innerHTML = `<h4>Multiplayer</h4><div class="room">Código da sala: <b>${NET.room}</b> <button data-copy="1">Copiar</button></div><div class="small">Seus amigos escolhem "Entrar em sala" e digitam este código.</div>`;
  else if (NET.mode === 'client') $('p-room').innerHTML = `<h4>Multiplayer</h4><div class="room">Conectado à sala <b>${NET.room}</b></div>`;
  else $('p-room').innerHTML = '';
  $('p-room').innerHTML += pvpPanel();
  $('p-room').innerHTML += optsPanel();
  $('p-room').innerHTML += '<button data-save="1" class="savebtn" title="Baixa um arquivo .json com seu personagem (Ctrl+S)">Salvar em arquivo <small>Ctrl+S</small></button>';
  padFixDom($('panel'));
}

$('panel').addEventListener('click', ev => {
  const t = ev.target.closest('[data-attr],[data-inv],[data-eq],[data-pot],[data-ball],[data-copy],[data-tal],[data-sub],[data-pet],[data-candy],[data-save],[data-teach],[data-stoneevo],[data-abra],[data-eqbest],[data-opt]');
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
  else if (t.dataset.pet !== undefined && !ev.target.closest('[data-teach],[data-stoneevo]')) { togglePet(P, +t.dataset.pet); saveGame(); }
  else if (t.dataset.inv !== undefined) {
    const i = +t.dataset.inv, it = P.inv[i];
    if (it && ev.shiftKey) { it.locked = !it.locked; G.toasts.push({ text: `${it.locked ? '🔒 Travado' : '🔓 Destravado'}: ${it.name}`, color: '#e5e7eb', t: 2 }); sfx('ui'); }
    else if (it && it.slot === 'pedra') useStone(i);
    else if (it) { const old = maxHP(P); P.inv[i] = P.equip[it.slot] || null; P.equip[it.slot] = it; P.hp += Math.max(0, maxHP(P) - old); sfx('pick'); }
  } else if ((t.dataset.eq === 'anel' || t.dataset.eq === 'amuleto') && P.equip[t.dataset.eq]) {
    const i = P.inv.indexOf(null);
    if (i >= 0) { P.inv[i] = P.equip[t.dataset.eq]; P.equip[t.dataset.eq] = null; }
  } else if (t.dataset.pot) usePotion();
  else if (t.dataset.abra) useAbra();
  else if (t.dataset.eqbest) equipBest(P);
  else if (t.dataset.opt) { OPTS[t.dataset.opt] = !OPTS[t.dataset.opt]; saveOpts(); G.dirty = true; updatePanel(); }
  else if (t.dataset.candy) giveCandy();
  else if (t.dataset.save) exportSave();
  else if (t.dataset.stoneevo !== undefined) crystalEvolve(+t.dataset.stoneevo);
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
    if (P.inv[i] && P.inv[i].locked) G.toasts.push({ text: '🔒 Item travado: destrave com Shift+clique para soltar.', color: '#fca5a5', t: 2.5 });
    else if (P.inv[i]) { dropItems([P.inv[i]]); P.inv[i] = null; }
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
    P.petAct = P.petAct.filter(j => j !== i).map(j => (j > i ? j - 1 : j)); P.petIdx = P.petAct.length ? P.petAct[0] : -1;
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
  if (state !== 'play' || !G || !G.P) { if (ev.code === 'KeyN') $('menu-err').textContent = cycleSound(); return; }
  K[ev.code] = true;
  const P = G.P;
  if (ev.code === 'Escape' && G.pcRef) closePC();
  else if (ev.code === 'Escape' && G.npcOpen) closeNPC();
  else if (ev.code === 'Space') { ev.preventDefault(); useAbility(); }
  else if (ev.code === 'KeyQ' || ev.code === 'Digit1') usePotion();
  else if (ev.code === 'KeyX') toggleRide();
  else if (ev.code === 'KeyZ' || ev.code === 'Digit2') useAbra();
  else if (ev.code === 'KeyB') equipBest(P);
  else if (ev.code === 'KeyV') { if (G.npcOpen === 'fly') closeNPC(); else openFly(); }
  else if (ev.code === 'KeyF') throwBall();
  else if (ev.code === 'KeyG') cycleBall();
  else if (ev.code === 'KeyC') cyclePet();
  else if (ev.code === 'KeyS' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); K.KeyS = false; exportSave(); }
  else if (ev.code === 'KeyE') {
    if (G.npcOpen) closeNPC();
    else if (nearDgChest(P)) openDgChest(P, nearDgChest(P));
    else if (nearXChest(P)) openXChest(P, nearXChest(P));
    else if (nearMoonChest(P)) openMoonChest(P, nearMoonChest(P));
    else if (G.nearPortal) usePortal(P, G.nearPortal);
    else if (G.nearNPC) openNPC(G.nearNPC.id);
    else if (G.nearHM) useHMTile(P, G.nearHM);
  } else if (ev.code === 'Digit3') { const i = P.inv.findIndex(it => it && it.slot === 'pedra'); if (i >= 0) { useStone(i); G.dirty = true; } }
  else if (ev.code === 'KeyT') autofire = !autofire;
  else if (ev.code === 'KeyM') { showMap = (showMap + 1) % 3; if (showMap === 2) G.toasts.push({ text: '🗺️ Mapa da região: só aparece o que você já explorou. [M] de novo esconde.', color: '#e5e7eb', t: 2.5 }); }
  else if (ev.code === 'KeyH') $('help').classList.toggle('hidden');
  else if (ev.code === 'KeyP') toggleDex();
  else if (ev.code === 'KeyL') { const b = $('tlog'); if (b.classList.toggle('hidden')) return; renderToastLog(); }
  else if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') doDash();
  else if (ev.code === 'KeyN') G.toasts.push({ text: cycleSound(), color: '#e5e7eb', t: 1.8 });
  else if (ev.code === 'KeyR') {
    if (P.recallCd <= 0 && !G.recall && !inTown(P.x, P.y)) { G.recall = { t: 1.5 }; text(P.x, P.y - 40, `Voltando para ${townName(TOWNS[P.lastTown] || TOWNS[0])}... fique parado`, '#fde68a', 12); }
    else if (P.recallCd > 0) text(P.x, P.y - 40, `Retorno em ${Math.ceil(P.recallCd)}s`, '#cbd5e1', 12);
  } else if (ev.code === 'Enter') { ev.preventDefault(); openChat(); }
});
window.addEventListener('keyup', ev => { K[ev.code] = false; });
window.addEventListener('blur', () => { for (const k in K) K[k] = false; mouse.down = false; });
function openChat() { const c = $('chat-in'); c.classList.remove('hidden'); c.value = ''; for (const k in K) K[k] = false; $('chatlog').classList.remove('hidden'); renderChatLog(true); c.focus(); }
$('chatlog').addEventListener('click', () => { if (!$('chat-in').classList.contains('hidden')) $('chat-in').focus(); }); // clicar no histórico não fecha a digitação
function closeChat() { const c = $('chat-in'); c.classList.add('hidden'); c.blur(); $('chatlog').classList.add('hidden'); }
// histórico do chat: mensagens dos jogadores e todos os avisos (até 200), rolável quando o chat está aberto
function logPush(e) {
  const L = G.fullLog = G.fullLog || [], last = L[L.length - 1];
  if (last && !e.chat && last.text === e.text) { last.n = (last.n || 1) + 1; last.at = G.time; }
  else { L.push({ ...e, at: G.time }); if (L.length > 200) L.shift(); }
  if (!$('chatlog').classList.contains('hidden')) renderChatLog();
}
function renderChatLog(force) {
  const box = $('chatlog'), atEnd = force || box.scrollTop + box.clientHeight >= box.scrollHeight - 8;
  const L = G.fullLog || [];
  const hhmm = s => { const m = Math.floor(s / 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
  box.innerHTML = L.length ? L.map(e => `<div class="cl${e.big ? ' imp' : ''}${e.chat ? ' msg' : ''}"><em>${hhmm(e.at)}</em><span style="color:${e.color || '#d6d0c4'}">${e.name ? `<b>${esc(e.name)}:</b> ` : ''}${esc(e.text)}${e.n > 1 ? ` (×${e.n})` : ''}</span></div>`).join('')
    : '<div class="cl"><span>Nada por aqui ainda.</span></div>';
  if (atEnd) box.scrollTop = box.scrollHeight; // só desce sozinho se você não estiver lendo lá em cima
}

cv.addEventListener('mousemove', ev => { const r = cv.getBoundingClientRect(); mouse.x = ev.clientX - r.left; mouse.y = ev.clientY - r.top; });
cv.addEventListener('mousedown', ev => { if (ev.button === 0) mouse.down = true; if (document.activeElement) document.activeElement.blur(); });
window.addEventListener('mouseup', ev => { if (ev.button === 0) mouse.down = false; });
cv.addEventListener('contextmenu', ev => ev.preventDefault());

// celular: o mundo é desenhado numa área maior e encolhido (VIEW_K < 1), para ver mais do mapa numa tela baixa
let VIEW_K = 1;
function resize() {
  const mob = document.body.classList.contains('mobile');
  const cw = mob ? window.innerWidth : window.innerWidth - $('panel').offsetWidth;
  VIEW_K = mob ? Math.min(1, window.innerHeight / 470) : 1;
  W = cv.width = Math.max(300, Math.round(cw / VIEW_K));
  H = cv.height = Math.round(window.innerHeight / VIEW_K);
  cv.style.width = mob ? cw + 'px' : ''; cv.style.height = mob ? window.innerHeight + 'px' : '';
}
window.addEventListener('resize', resize);

/* ---------- Menu ---------- */
const REGION_KEY = 'pkr_region_v1';
const menuSel = { hero: null, mode: 'solo', loaded: false, region: 'kanto' };
try { const r = localStorage.getItem(REGION_KEY); if (REGIONS[r]) menuSel.region = r; } catch (e) { /* ignora */ }
function renderMaps() {
  $('maps').innerHTML = REGION_IDS.map(id => `<button data-region="${id}" class="${menuSel.region === id ? 'sel' : ''}" title="${REGIONS[id].sub}">${REGIONS[id].nome}</button>`).join('');
  $('map-sub').textContent = REGIONS[menuSel.region].sub;
}
$('maps').addEventListener('click', ev => {
  const b = ev.target.closest('[data-region]');
  if (!b) return;
  menuSel.region = b.dataset.region;
  try { localStorage.setItem(REGION_KEY, menuSel.region); } catch (e) { /* ignora */ }
  renderMaps();
});
// troca o mundo para a região e baixa os Pokémon dela (com progresso no menu)
async function prepRegion(id) {
  if (id !== REGION_ID) setRegion(id);
  const ids = regionIds(REGION).filter(i => !POKE[i]);
  if (ids.length) await loadPokedex(ids, (n, t) => { $('menu-err').textContent = `Carregando os Pokémon de ${REGION.nome}... ${n}/${t}`; });
}

function renderHero() {
  const h = menuSel.hero, c = CLASSES[h.cls], rc = RACES[h.race];
  const fake = { cls: h.cls, race: h.race, lvl: 1, attrs: h.attrs, talents: [], subclass: null, equip: { arma: startWeapon(h.cls), armadura: { ac: 0 }, anel: null } };
  $('hero').innerHTML = `<div class="hero-pic"><canvas width="96" height="96" id="hero-spr"></canvas></div>
    <div class="hero-info">
      <div class="hero-line"><span class="hchip">${rc.nome}</span><span class="hchip">${c.nome}</span>${typeBadge(h.type)}</div>
      <div class="small">${c.desc} ${rc.traco}</div>
      <div class="small">Habilidade: <b>${c.abil.nome}</b> — ${c.abil.desc}</div>
    </div>
    <div class="hero-stats" style="grid-column:1/-1">${ATTRS.map(k => `<span title="${ATTR_DESC[k]}">${ATTR_NAMES[k]} <b>${h.attrs[k]}</b></span>`).join('')}
      <span>PV <b>${maxHP(fake)}</b></span><span>CA <b>${AC(fake)}</b></span>${h.points ? `<span class="free">Pontos livres <b>+${h.points}</b></span>` : ''}</div>
    <div class="small" style="grid-column:1/-1">Tipo ${TYPE_PT[h.type]}: forte contra ${TYPE_CHART[h.type].s.map(t => TYPE_PT[t]).join(', ') || 'nada'}.</div>`;
  const x = $('hero-spr').getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(CLS_SPR[h.cls][0], 0, 0, 96, 96);
}
// dois caminhos bem separados: jogar com o personagem salvo (direita) ou criar um novo (esquerda)
function renderContinue() {
  const s = loadSave(), ok = s && CLASSES[s.cls];
  $('continue-box').innerHTML = '<h3>Personagem salvo</h3>' + (ok
    ? `<button id="btn-cont" class="big alt" style="margin-top:0" ${menuSel.loaded ? '' : 'disabled'}>▶ Jogar com ${esc(s.name)}<small>${(RACES[s.race] || RACES.humano).nome} ${CLASSES[s.cls].nome} · Nível ${s.lvl} · ${s.gold || 0} 🪙 · ${(s.pets || []).length} companheiro(s)</small></button>`
    : '<div class="saved-empty">Nenhum personagem salvo neste navegador. Crie um novo ao lado, ou carregue um save de arquivo abaixo.</div>');
  const b = $('btn-cont');
  if (b) b.onclick = () => startGame(s);
  renderNewWarn();
}
function renderNewWarn() {
  const s = loadSave(), w = $('new-warn'), nm = ($('name').value.trim() || 'Aventureiro').slice(0, 14);
  $('btn-start').textContent = `✚ Criar e jogar com ${nm}`;
  if (s && CLASSES[s.cls] && !G) {
    w.innerHTML = `⚠ Criar um personagem novo <b>substitui ${esc(s.name)} (Nível ${s.lvl})</b>. Para guardá-lo, use "Salvar em arquivo" dentro do jogo antes.`;
    w.classList.remove('hidden');
  } else w.classList.add('hidden');
}
$('name').addEventListener('input', renderNewWarn);

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
    $('import-msg').textContent = `Save de ${s.name} (nível ${s.lvl}) carregado. Clique em Continuar.`;
  } catch (e) { $('import-msg').textContent = 'Não consegui ler esse arquivo: ' + e.message; }
};
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => {
  menuSel.mode = r.value;
  $('map-box').classList.toggle('hidden', r.value === 'join');
  $('join-code').disabled = r.value !== 'join';
  if (r.value === 'join') $('join-code').focus();
}));
$('btn-start').onclick = () => startGame(null);
$('btn-again').onclick = () => {
  $('death').classList.add('hidden');
  menuSel.hero = rollHero();
  renderHero(); renderContinue();
  $('mode-box').classList.add('hidden');
  $('map-box').classList.add('hidden');
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
      if (menuSel.mode !== 'join') await prepRegion(menuSel.region);
      if (menuSel.mode === 'host') { $('menu-err').textContent = 'Criando sala...'; await netHost(); }
      else if (menuSel.mode === 'join') {
        $('menu-err').textContent = 'Conectando...';
        await netJoin($('join-code').value);
        await prepRegion(REGIONS[NET.region] ? NET.region : menuSel.region);
      }
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
    // saves antigos: história e HMs eram globais, agora são por região
    if (!saved.stories) P.stories = {};
    if (!saved.hmsR) P.hmsR = {};
    if (!Array.isArray(P.petAct)) P.petAct = P.petIdx >= 0 ? [P.petIdx] : [];
    // saves antigos: atributos e pontos guardados passam para a escala nova (o dobro, mesmo poder)
    if (!saved.attrV2) { for (const k of ATTRS) P.attrs[k] = Math.min(ATTR_MAX, (P.attrs[k] || 0) * 2); P.points = (P.points || 0) * 2; }
    P.attrV2 = 1;
    P.petCap = Math.max(petCap(P), P.pets.length); // saves antigos tinham 4 vagas: ninguém perde companheiro
    if (!RACES[P.race]) P.race = 'humano';
    if (!TYPE_PT[P.ptype]) P.ptype = 'normal';
    if (!('amuleto' in P.equip)) P.equip.amuleto = null;
    P.bag = Object.assign({ grande: 0, ultra: 0, doce: 0, abra: 0 }, P.bag || {});
    delete P.bag.elixir;
    P.fly = P.fly || ['vila']; P.chests = P.chests || [];
    for (const pt of P.pets) pt.hms = (pt.hms || []).filter(k => HMS[k]);
    for (const pt of P.pets) { pt.lvl = pt.lvl || 5; pt.xp = pt.xp || 0; loadEvo(pt.pid); }
    loadPokedex(P.pets.map(pt => pt.pid)).then(() => { if (G) G.dirty = true; });
  } else P = createPlayer(name, menuSel.hero);
  P.story = P.stories[REGION_ID] = P.stories[REGION_ID] || { ch: 0, done: false };
  P.hms = P.hmsR[REGION_ID] = (P.hmsR[REGION_ID] || []).filter(k => HMS[k]);
  // saves de antes da 2ª cidade: quem já passou do 5º capítulo ganha a missão e a HM Fly
  if (P.story.ch > 5 || (P.story.ch === 5 && P.story.done)) { P.story.t2 = true; if (!P.hms.includes('fly')) P.hms.push('fly'); }
  // a ordem das HMs mudou: quem já passou de um ginásio recebe a HM dele (ninguém perde as que já tem)
  for (let c = 1; c < P.story.ch; c++) if (HM_GYM[c] && !P.hms.includes(HM_GYM[c])) P.hms.push(HM_GYM[c]);
  if (!TOWNS[P.lastTown]) P.lastTown = 0;
  P.petAct = P.petAct.filter(i => P.pets[i]).slice(0, petSlots(P)); P.petIdx = P.petAct.length ? P.petAct[0] : -1;
  P.hp = Math.min(Math.max(1, P.hp), maxHP(P));
  G.P = P;
  G.cam.x = P.x; G.cam.y = P.y;
  buildExploreChests(P);
  initFog(P);
  G.dirty = true;
  state = 'play';
  $('menu').classList.add('hidden');
  emitEvent({ t: 'chat', sys: 1, text: `${P.name} (${heroLabel(P)}, tipo ${TYPE_PT[P.ptype]}) chegou em ${REGION.nome}.` });
  if (NET.mode === 'host') G.toasts.push({ text: `Sala criada! Código: ${NET.room}`, color: '#86efac', t: 6 });
  if (!P.story.ch) G.toasts.push({ text: `Bem-vindo a ${REGION.nome}! Fale com ${REGION.guia.nome} (ao norte da vila) com [E] para começar a jornada.`, color: '#fef3c7', t: 7 });
  ensureTalentOffer(P);
  saveGame();
}

/* ---------- Loop ---------- */
let last = performance.now();
function step(now, draw) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  musicTick(musicKey(), dt);
  padTick(dt);
  if (typeof touchTick === 'function') touchTick(dt);
  if (G && state !== 'lost') { update(dt); if (draw) render(); }
  else if (!G && draw) { ctx.fillStyle = '#0f0b1a'; ctx.fillRect(0, 0, W, H); }
}
function musicKey() {
  const P = G && G.P;
  if (!P || state !== 'play') return 'menu';
  if (inArena(P.x, P.y)) return 'chefe';
  if (G.enemies.some(e => e.boss && e.hp > 0 && Math.hypot(e.x - P.x, e.y - P.y) < 650)) return 'chefe';
  if (inDungeonArea(P.x)) return 'masmorra';
  if (inTown(P.x, P.y)) return 'vila';
  const z = ZONES[zoneAt(P.x, P.y)];
  return z ? { campo: 'campo', floresta: 'floresta', montanha: 'montanha', neve: 'montanha', deserto: 'montanha', vulcao: 'sombra', sombrio: 'sombra', pantano: 'sombra' }[z.bio] || 'campo' : 'campo';
}
/* ---------- Fundo do menu: paisagem em pixel art de baixa resolução ---------- */
const MBG = { cv: $('menu-bg'), stars: [], flies: [], ridges: [] };
(function initMenuBg() {
  const R = mulberry32(7);
  for (let i = 0; i < 90; i++) MBG.stars.push([R(), R() * 0.55, R() * 6, R() < 0.15]);
  for (let i = 0; i < 18; i++) MBG.flies.push([R(), 0.62 + R() * 0.35, R() * 6, 0.3 + R() * 0.7]);
  // três cordilheiras: altura base, amplitude, cor, velocidade
  [[0.5, 0.16, '#2a2238', 2], [0.62, 0.12, '#1b1726', 5], [0.76, 0.08, '#0e0d14', 10]].forEach(([b, a, c, v], k) => {
    const pts = [];
    for (let i = 0; i < 64; i++) pts.push(b - a * (0.5 + 0.5 * Math.sin(i * 0.9 + k * 3) * Math.cos(i * 0.37 + k)) - (R() < 0.2 ? R() * a * 0.5 : 0));
    MBG.ridges.push({ pts, c, v });
  });
})();
function drawMenuBg(now) {
  const cv = MBG.cv, h = 150, w = Math.round(h * innerWidth / Math.max(1, innerHeight));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const x = cv.getContext('2d'), t = now / 1000;
  // céu em faixas (sem degradê suave, combina com o pixel art)
  const bands = ['#0b0b14', '#0f0f1c', '#141325', '#1a172d', '#221b33', '#2c2036', '#382636'];
  bands.forEach((c, i) => { x.fillStyle = c; x.fillRect(0, Math.floor(i * h * 0.1), w, Math.ceil(h * 0.1) + 1); });
  x.fillStyle = bands[6]; x.fillRect(0, h * 0.7, w, h * 0.3);
  for (const [sx, sy, ph, big] of MBG.stars) {
    const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.3 + ph));
    x.fillStyle = `rgba(236,229,214,${a.toFixed(2)})`;
    x.fillRect(Math.floor(sx * w), Math.floor(sy * h), big ? 2 : 1, big ? 2 : 1);
  }
  // lua
  const mx = Math.floor(w * 0.78), my = Math.floor(h * 0.2);
  x.fillStyle = '#3a2f3a'; x.beginPath(); x.arc(mx, my, 14, 0, 7); x.fill();
  x.fillStyle = '#e8d9b0'; x.beginPath(); x.arc(mx, my, 10, 0, 7); x.fill();
  x.fillStyle = '#cbb98f'; x.fillRect(mx - 4, my - 3, 3, 2); x.fillRect(mx + 2, my + 3, 2, 2);
  for (const r of MBG.ridges) {
    x.fillStyle = r.c; x.beginPath(); x.moveTo(0, h);
    const seg = w / 24, off = (t * r.v) % (seg * r.pts.length);
    for (let i = 0; i <= 26; i++) {
      const gx = i * seg - (off % seg), k = (Math.floor(off / seg) + i) % r.pts.length;
      x.lineTo(Math.round(gx), Math.round(r.pts[k] * h));
    }
    x.lineTo(w, h); x.fill();
  }
  for (const [fx, fy, ph, sp] of MBG.flies) {
    const px = ((fx * w + t * 4 * sp + Math.sin(t * sp + ph) * 6) % w + w) % w, py = fy * h + Math.sin(t * 1.7 * sp + ph) * 4;
    const a = Math.max(0, Math.sin(t * 2 * sp + ph));
    x.fillStyle = `rgba(232,176,74,${(a * 0.9).toFixed(2)})`;
    x.fillRect(Math.floor(px), Math.floor(py), 1, 1);
    if (a > 0.7) { x.fillStyle = `rgba(232,176,74,${((a - 0.7) * 0.8).toFixed(2)})`; x.fillRect(Math.floor(px) - 1, Math.floor(py) - 1, 3, 3); }
  }
}
function frame() {
  // um erro num quadro não pode parar o jogo (antes a tela congelava)
  try { if (!document.hidden) step(performance.now(), true); } catch (e) { console.error(e); }
  if (!document.hidden && !$('menu').classList.contains('hidden')) drawMenuBg(performance.now());
  requestAnimationFrame(frame);
}
// Com a aba em segundo plano o navegador pausa o requestAnimationFrame;
// um timer dentro de um Worker não é limitado e mantém o mundo (e o host) rodando.
try {
  const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),33)'], { type: 'text/javascript' })));
  wk.onmessage = () => { if (document.hidden) try { step(performance.now(), false); } catch (e) { console.error(e); } };
} catch (e) { setInterval(() => { if (document.hidden) step(performance.now(), false); }, 33); }

function boot() {
  buildClassSprites();
  buildNPCSprites();
  setRegion(menuSel.region);
  resize();
  menuSel.hero = rollHero();
  $('name').value = pick(['Arwen', 'Thorin', 'Elric', 'Lyra', 'Kael', 'Brienne', 'Gandor', 'Mira', 'Fenrir', 'Sable']);
  renderHero(); renderContinue(); renderMaps();
  requestAnimationFrame(frame);
  loadPokedex(coreIds(), (n, t) => {
    $('load-n').textContent = `${n}/${t}`;
    $('load-b').style.width = (n / t * 100) + '%';
  }).then(() => {
    menuSel.loaded = true;
    $('load').innerHTML = 'Pokémon prontos para a batalha.';
    $('btn-start').disabled = false;
    renderContinue();
    // Pokémon das masmorras e da noite carregam em segundo plano
    return loadPokedex(THEME_IDS);
  });
}
boot();

// histórico dos últimos avisos (tecla L)
function renderToastLog() {
  const L = G.toastLog || [];
  $('tlog').innerHTML = `<div class="dexhead"><span class="dextitle">📜 Avisos recentes</span><span class="small">[L] fecha</span></div>
    ${L.length ? L.map(t => `<div class="tlrow"><i style="background:${t.color || '#e5e7eb'}"></i><span>${esc(t.text)}${t.n > 1 ? ` <b>(×${t.n})</b>` : ''}</span><em>${Math.max(0, Math.round((G.time - t.at) / 60))} min</em></div>`).join('') : '<div class="small">Nenhum aviso ainda.</div>'}`;
}

/* ---------- Bênçãos do Clérigo: efeito em quem recebe a cura (no próprio Clérigo, metade) ---------- */
function blessApply(P, m, over, self) {
  // no próprio Clérigo: escudo pela metade e bônus de dano só 35% (medido no Nv 30: Guerra sozinho ~295/s, abaixo dos atacantes)
  const mh = maxHP(P), b = m.bl, k = !self ? 1 : b === 'escudo' || b === 'escudo2' ? 0.5 : 0.35;
  if (b === 'escudo' || b === 'escudo2') {
    const big = b === 'escudo2', cap = mh * (big ? 0.25 : 0.2) * k, min = m.quiet ? 0 : mh * 0.1 * k;
    const add = Math.max(over, min);
    if (add > 0) { P.shield = Math.round(Math.min(cap, Math.max(P.shield || 0, 0) + add)); P.shieldT = 5; }
  } else if (b === 'feras' || b === 'feras2') { P.ferasT = 6; P.ferasK = (b === 'feras2' ? 0.35 : 0.25) * k; }
  else if (b === 'ritmo') { P.ritmoT = 6; P.ritmoK = 0.25 * k; }
  // Graça: no próprio Clérigo também, mas depois de salvá-lo ela só volta em 5 min (nos aliados, 90 s)
  else if (b === 'graca' && !(P.graceCd > 0)) { if (!(P.graceT > 0) && !self) text(P.x, P.y - 50, `🕊️ Graça Salvadora (${m.name})`, '#fde68a', 12); P.graceT = 8; P.graceBy = self ? null : m.name; P.graceSelf = self; }
}
const blessBuffs = P => {
  const l = [];
  if (P.graceT > 0) l.push(`🕊️ Protegido ${Math.ceil(P.graceT)}s`);
  else if (P.graceCd > 0) l.push(`🕊️ Graça em ${Math.ceil(P.graceCd)}s`);
  if (P.ferasT > 0) l.push(`🐾 +${Math.round(P.ferasK * 100)}% companheiros`);
  if (P.ritmoT > 0) l.push(`🎵 +${Math.round(P.ritmoK * 100)}% cadência`);
  return l.length ? `<div class="small" style="color:#fde68a">${l.join(' · ')}</div>` : '';
};

/* ============ Linhagens: Vampiro e Lobisomem (missão do templo da 2ª cidade) ============
 * Ficam por cima da raça. As formas noturnas têm prioridade sobre a Forma Selvagem do Druida:
 * quando começam, encerram a Forma Selvagem, e enquanto duram não dá para trocar de forma.
 * Vampiro: rouba 3% do dano causado; resiste a Veneno e Sombrio; de dia não regenera fora das cidades;
 *   a cada anoitecer, 33% de chance de virar morcego aos poucos (Zubat/Golbat/Crobat pelo nível) até o amanhecer:
 *   rouba 6%, +25% de velocidade, mas recebe +15% de dano.
 * Lobisomem: +5% de velocidade e faro (baús escondidos aparecem de mais longe).
 *   À noite a Lua enche aos poucos (e mais rápido a cada abate) e o herói vai virando fera na tela;
 *   em 100% vira o lobo da região por 12s: +30% de cadência, +15% de dano, uivo que deixa os inimigos lentos,
 *   sem poções nem especial. De dia a Lua esvazia devagar. Fogo e Fada causam +10% nele.
 */
const LIN = {
  vampiro: { nome: 'Vampiro', icon: '🧛', resist: ['poison', 'dark'], fraco: ['fire'] },
  lobisomem: { nome: 'Lobisomem', icon: '🐺', resist: [], fraco: ['fire', 'fairy'] },
};
const WOLF_PID = { kanto: 571, johto: 571, hoenn: 262, sinnoh: 405, unova: 571 }; // Zoroark em Kanto, Johto e Unova
// morcego do vampiro: Zubat, Golbat e Crobat pelo nível (em Unova, Woobat e Swoobat)
const batPid = P => (REGION_ID === 'unova' ? (P.lvl < 16 ? 527 : 528) : P.lvl < 10 ? 41 : P.lvl < 22 ? 42 : 169);
const wolfPid = () => WOLF_PID[REGION_ID] || 59;
const isBat = P => !!(P.lform && P.lform.kind === 'bat');
const isWolf = P => !!(P.lform && P.lform.kind === 'wolf');
const linSteal = P => (P.lin !== 'vampiro' ? 0 : isBat(P) ? 0.1 : 0.04);
// dano recebido: fraquezas da linhagem e o morcego mais frágil
const linTaken = (P, type) => (P.lin && LIN[P.lin].fraco.includes(type) ? 1.1 : 1) * (isBat(P) ? 1.1 : 1);
function linSteal1(P, dmg) {
  const k = linSteal(P);
  if (!k || dmg <= 0) return;
  P.vampAcc = (P.vampAcc || 0) + dmg * k;
  if (P.vampAcc >= 1) { const h = Math.floor(P.vampAcc); P.vampAcc -= h; P.hp = Math.min(maxHP(P), P.hp + h); }
}
function startLForm(P, kind) {
  if (P.wildT > 0) endWild(P); // a forma da linhagem tem prioridade sobre a do Druida
  P.riding = false;
  const pid = kind === 'bat' ? batPid(P) : wolfPid();
  ensurePoke(pid);
  P.lform = { kind, pid };
  burst(P.x, P.y, kind === 'bat' ? '#7c3aed' : '#dc2626', 36); burst(P.x, P.y, '#111827', 24);
  if (kind === 'wolf') {
    for (const e of enemiesNear(P.x, P.y, 190)) e.slowT = Math.max(e.slowT || 0, 2);
    G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 0, R: 190, life: 0.7, max: 0.7, color: '#dc2626' }); G.shake = Math.min(10, G.shake + 6);
    G.toasts.push({ text: '🐺 A escuridão tomou conta: você virou fera até o amanhecer! (sem poções nem especial)', color: '#fca5a5', t: 4, big: 1 });
  } else G.toasts.push({ text: '🦇 A noite chamou o seu sangue: você virou morcego até o amanhecer!', color: '#c4b5fd', t: 5, big: 1 });
  sfx('boss');
}
function endLForm(P) {
  const k = P.lform && P.lform.kind;
  P.lform = null;
  burst(P.x, P.y, k === 'bat' ? '#7c3aed' : '#dc2626', 22);
  text(P.x, P.y - 44, '🌅 O dia está nascendo: você voltou a ser você', '#cbd5e1', 12);
}
function linTick(P, dt) {
  if (!P.lin) { if (P.lform) endLForm(P); return; }
  // a cada noite, 50% de chance de transformar; a transformação acompanha a escuridão:
  // começa ao anoitecer, fica completa quando está bem escuro e se desfaz aos poucos ao amanhecer
  if (isNight() && !P.nightSeen) {
    P.nightSeen = true; P.nightRoll = Math.random() < 0.5;
    if (P.nightRoll) G.toasts.push({ text: P.lin === 'vampiro' ? '🦇 A noite chama o seu sangue... a transformação começou.' : '🐺 A lua está subindo... você sente a fera despertar.', color: '#c4b5fd', t: 4 });
  }
  if (!isNight() && (G.nightK || 0) < 0.02) { P.nightSeen = false; P.nightRoll = false; }
  // começa com ~40% do anoitecer e completa quando a noite fecha de vez (~15 s, mais rápido que o anoitecer de ~25 s)
  P.transK = P.nightRoll ? clamp(((G.nightK || 0) - 0.4) / 0.6, 0, 1) : 0;
  const kind = P.lin === 'vampiro' ? 'bat' : 'wolf';
  if (P.transK >= 0.995 && !P.lform) startLForm(P, kind);
  else if (P.transK < 0.995 && P.lform) endLForm(P);
  if (isBat(P)) { P.lform.pid = batPid(P); if (Math.random() < 0.08) G.parts.push({ x: P.x + rand(-14, 14), y: P.y + rand(-8, 8), vx: rand(-20, 20), vy: -20, life: 0.5, color: '#7c3aed', size: 2 }); }
  else if (isWolf(P) && Math.random() < 0.2) G.parts.push({ x: P.x + rand(-16, 16), y: P.y + rand(-10, 10), vx: 0, vy: -25, life: 0.4, color: '#dc2626', size: 2 });
}
// fome da fera: sem poções, cada abate cura 5% da vida
function linKill(P) { if (isWolf(P)) { const h = Math.round(maxHP(P) * 0.05); P.hp = Math.min(maxHP(P), P.hp + h); text(P.x, P.y - 34, `+${h}`, '#86efac', 13); } }
// desenho do herói com a linhagem: forma completa, ou o lobisomem se formando aos poucos
function drawLinHero(P, x, y, alpha) {
  if (P.lform) return drawWildForm(P.lform.pid, P.x, P.y, x, y, P.face, P.moving, alpha, pType(P), isWolf(P) ? 1 : 0);
  const wolf = P.lin === 'lobisomem', k = P.transK || 0;
  if (k < 0.15) return false;
  // meio gente, meio fera: o Pokémon vai aparecendo e crescendo por cima do herói
  const m = (k - 0.15) / 0.85;
  drawPlayerSprite(P.cls, x + (k > 0.8 ? rand(-1, 1) : 0), y, P.face, P.moving ? Math.floor(P.walk * 8) % 2 : 0, alpha * (1 - m * 0.85), P.aim, pType(P));
  drawWildForm(wolf ? wolfPid() : batPid(P), P.x, P.y, x, y, P.face, P.moving, alpha * m * 0.9, null, 0, (wolf ? 0.55 : 0.5) + m * (wolf ? 0.6 : 0.5));
  if (!wolf && Math.random() < m * 0.3) G.parts.push({ x: P.x + rand(-14, 14), y: P.y + rand(-14, 10), vx: rand(-15, 15), vy: -20, life: 0.6, color: '#7c3aed', size: 3 }); // névoa roxa
  if (k > 0.5) { ctx.fillStyle = `rgba(${wolf ? '220,38,38' : '168,85,247'},${(0.5 + Math.sin(G.time * 8) * 0.3) * m})`; ctx.fillRect(x - 5, y - 8, 3, 2); ctx.fillRect(x + 2, y - 8, 3, 2); } // olhos brilhando
  return true;
}
const linBuffs = P => {
  if (!P.lin) return '';
  const L = LIN[P.lin];
  const s = P.lin === 'vampiro' ? (isBat(P) ? '🦇 Morcego até o amanhecer · rouba 10%' : P.transK > 0.05 ? `🦇 Transformando... ${Math.round(P.transK * 100)}%` : `rouba 4% do dano${isNight() ? '' : ' · de dia regenera pela metade fora das cidades'}`)
    : isWolf(P) ? '🐺 Fera até o amanhecer (+35% cadência, +20% dano, abates curam 5%; sem poções nem especial)' : P.transK > 0.05 ? `🌕 Transformando... ${Math.round(P.transK * 100)}%` : '50% de chance de virar fera a cada noite';
  return `<div class="small" style="color:#fca5a5">${L.icon} ${L.nome}: ${s}</div>`;
};

/* ============ Golpes de assinatura dos chefes ============
 * Todo chefe (líderes de ginásio, chefes de masmorra, lendários, Procurados e o vilão final) usa de tempos em tempos
 * um golpe próprio do seu tipo, sempre avisado no chão (círculos ou faixas vermelhas que enchem) antes de acertar.
 * O host escolhe o golpe e manda o aviso para todos; cada jogador calcula o próprio dano quando o aviso estoura.
 * Com menos de metade da vida o chefe fica furioso e usa o golpe com mais frequência.
 */
// no começo do jogo o que importa são as balas: golpes de assinatura fracos, raros e com aviso longo;
// no fim eles ficam fortes e frequentes. Todo aviso dura pelo menos ~1 s (sempre dá para sair).
const sigPct = e => (e.legend ? 0.3 : 0.06 + 0.036 * clamp(e.zone, 1, 5)); // fração da vida máxima: ~10% (zona 1) a 24% (zona 5)
const sigEvery = e => (e.legend ? 5 : 10.5 - 1.1 * clamp(e.zone, 1, 5)); // a cada ~9,4 s (zona 1) a ~5 s (zona 5)
const sigWarn = e => Math.max(1, 1.45 - 0.1 * clamp(e.zone, 1, 5)); // aviso mais longo no começo
const near2 = (t, r) => { const a = Math.random() * 6.28, d = Math.random() * r; return [t.x + Math.cos(a) * d, t.y + Math.sin(a) * d]; };
const tC = (x, y, r, delay) => ({ s: 'c', x: Math.round(x), y: Math.round(y), r, d: +delay.toFixed(2) });
const tL = (x, y, a, len, w, delay) => ({ s: 'l', x: Math.round(x), y: Math.round(y), a: +a.toFixed(3), len, w, d: +delay.toFixed(2) });
const BOSS_SIG = {
  fire: { nome: '🔥 Erupção', f: (e, t) => Array.from({ length: 5 }, () => tC(...near2(t, 170), 70, 1.3)) },
  water: { nome: '🌊 Hidro Bomba', f: (e, t, a) => [tL(e.x, e.y, a, 720, 80, 1.0), tL(e.x, e.y, a + 0.5, 600, 60, 1.25), tL(e.x, e.y, a - 0.5, 600, 60, 1.25)] },
  electric: { nome: '⚡ Trovão', f: (e, t) => [0.9, 1.35, 1.8, 2.25].map(d => tC(...near2(t, 70), 65, d)) },
  grass: { nome: '🍃 Tempestade de Folhas', f: (e, t, a) => [-0.4, 0, 0.4].map(k => tL(e.x, e.y, a + k, 620, 60, 1.1)) },
  ice: { nome: '❄ Nevasca', f: (e, t, a) => [0, 1, 2, 3].map(k => tL(e.x, e.y, a + 0.4 + k * Math.PI / 2, 560, 70, 1.2)) },
  ground: { nome: '🌍 Terremoto', f: e => [tC(e.x, e.y, 240, 1.5)] },
  rock: { nome: '🪨 Deslizamento', f: (e, t) => Array.from({ length: 7 }, (_, i) => tC(...near2(t, 230), 60, 1.1 + i * 0.08)) },
  psychic: { nome: '🔮 Psíquico', f: (e, t) => [tC(t.x, t.y, 125, 1.25)] },
  ghost: { nome: '👻 Sombra Ardilosa', tp: 1, f: e => [tC(e.x, e.y, 145, 1.0)] },
  dark: { nome: '🌑 Emboscada', tp: 1, f: e => [tC(e.x, e.y, 145, 1.0)] },
  fighting: { nome: '👊 Investida', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 540, 95, 0.95)] },
  normal: { nome: '💥 Investida', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 540, 95, 0.95)] },
  dragon: { nome: '🐉 Cometa Draco', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 540, 95, 0.95), ...Array.from({ length: 3 }, () => tC(...near2(t, 140), 90, 1.6))] },
  poison: { nome: '☠ Bomba de Lodo', st: 4, f: (e, t) => Array.from({ length: 4 }, () => tC(...near2(t, 150), 85, 1.2)) },
  flying: { nome: '🌪 Furacão', f: (e, t, a) => [tL(t.x - Math.cos(a + 0.8) * 300, t.y - Math.sin(a + 0.8) * 300, a + 0.8, 600, 60, 1.1), tL(t.x - Math.cos(a - 0.8) * 300, t.y - Math.sin(a - 0.8) * 300, a - 0.8, 600, 60, 1.1)] },
  bug: { nome: '🐝 Enxame', f: (e, t) => Array.from({ length: 9 }, (_, i) => tC(...near2(t, 260), 45, 1.0 + (i % 3) * 0.25)) },
  steel: { nome: '⚙ Chuva de Aço', f: (e, t) => { const o = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((i + j) % 2 === 0) o.push(tC(t.x + i * 120, t.y + j * 120, 60, 1.2)); return o; } },
  fairy: { nome: '🌙 Lua Mágica', f: (e, t) => Array.from({ length: 6 }, (_, i) => tC(t.x + Math.cos(i * 1.047) * 150, t.y + Math.sin(i * 1.047) * 150, 62, 1.2)) },
};
// host: usa o golpe de assinatura
function bossSig(e, t) {
  const S = BOSS_SIG[e.type] || BOSS_SIG.normal;
  if (S.tp) { // some e reaparece atrás do alvo
    const a = Math.random() * 6.28, nx = t.x + Math.cos(a) * 110, ny = t.y + Math.sin(a) * 110;
    if (!e.dg || walkableR(nx, ny, Math.min(e.r, 18))) { e.x = nx; e.y = ny; }
  }
  const a = Math.atan2(t.y - e.y, t.x - e.x);
  const list = S.f(e, t, a), wk = sigWarn(e);
  for (const o of list) o.d = +Math.max(0.95, o.d * wk).toFixed(2);
  if (S.dash) e.dash = { a, wait: 0.75 * wk, t: 0.4, spd: 1300 };
  emitEvent({ t: 'tele', l: list, nm: S.nome, bx: Math.round(e.x), by: Math.round(e.y), src: e.name, ty: e.type, pct: +sigPct(e).toFixed(3), st: S.st || 0 });
}
// host: investida (o chefe espera o aviso encher e então dispara na linha)
function bossDash(e, dt) {
  const d = e.dash;
  if (d.wait > 0) { d.wait -= dt; e.moving = false; return; }
  const nx = e.x + Math.cos(d.a) * d.spd * dt, ny = e.y + Math.sin(d.a) * d.spd * dt;
  if (e.dg ? walkableR(nx, ny, Math.min(e.r, 18)) : true) { e.x = nx; e.y = ny; if (!e.dg) clampWorld(e); }
  else d.t = 0;
  e.moving = true;
  if ((d.t -= dt) <= 0) e.dash = null;
}
// todos: avisos no chão
function teleEvent(m) {
  G.teles = G.teles || [];
  for (const o of m.l) G.teles.push({ ...o, t: o.d, max: o.d, ty: m.ty, pct: m.pct, src: m.src, st: m.st });
  const P = G.P;
  if (P && Math.hypot(P.x - m.bx, P.y - m.by) < 900) { text(m.bx, m.by - 70, m.nm, '#fca5a5', 18); sfx('boss'); }
}
function teleHits(o, x, y) {
  if (o.s === 'c') return Math.hypot(x - o.x, y - o.y) < o.r + 10;
  const dx = x - o.x, dy = y - o.y, u = dx * Math.cos(o.a) + dy * Math.sin(o.a), v = -dx * Math.sin(o.a) + dy * Math.cos(o.a);
  return u > -10 && u < o.len + 10 && Math.abs(v) < o.w / 2 + 10;
}
function updateTeles(dt) {
  const P = G.P;
  for (const o of G.teles || []) {
    o.t -= dt;
    if (o.t > 0) continue;
    o.dead = true;
    const cx = o.s === 'c' ? o.x : o.x + Math.cos(o.a) * o.len / 2, cy = o.s === 'c' ? o.y : o.y + Math.sin(o.a) * o.len / 2;
    burst(cx, cy, TYPE_COLORS[o.ty] || '#fca5a5', o.s === 'c' ? 18 : 26);
    G.fx.push(o.s === 'c' ? { k: 'ring', x: o.x, y: o.y, r: 0, R: o.r, life: 0.35, max: 0.35, color: TYPE_COLORS[o.ty] || '#fca5a5', fill: true } : { k: 'ring', x: cx, y: cy, r: 0, R: o.w, life: 0.3, max: 0.3, color: TYPE_COLORS[o.ty] || '#fca5a5' });
    if (P && Math.hypot(P.x - cx, P.y - cy) < 700) G.shake = Math.min(9, G.shake + 3);
    if (!P || P.dodgeT > 0 || P.pvp || !teleHits(o, P.x, P.y)) continue;
    let eff = typeEff(o.ty, [pType(P)]);
    if (eff === 0) { text(P.x, P.y - 34, 'Imune!', '#93c5fd', 12); continue; }
    if (race(P).resist.includes(o.ty) || MA(P, 'resist').includes(o.ty) || (P.lin && LIN[P.lin].resist.includes(o.ty))) eff *= 0.5;
    eff *= linTaken(P, o.ty) * (P.seloT > 0 ? 0.75 : 1) * (P.graceT > 0 ? 0.9 : 1) * (P.race === 'draconato' ? 0.9 : 1);
    let dmg = Math.max(1, Math.round(maxHP(P) * o.pct * Math.min(eff, 1.5) * rand(0.9, 1.1)));
    if (P.shield > 0) { const ab = Math.min(P.shield, dmg); P.shield -= ab; dmg -= ab; }
    if (dmg <= 0) continue;
    P.hp -= dmg; P.sinceHit = 0;
    text(P.x, P.y - 34, `-${dmg}`, '#f87171', 17); sfx('hit');
    const st = o.st || PST_BY_TYPE[o.ty];
    if (st && P.hp > 0 && Math.random() < (o.st ? 1 : 0.35)) playerStatus(P, stPick(st), o.ty);
    if (P.hp <= 0) playerDie(o.src || 'um chefe');
  }
  if (G.teles) G.teles = G.teles.filter(o => !o.dead);
}
function drawTeles(ox, oy) {
  for (const o of G.teles || []) {
    const k = 1 - o.t / o.max, col = TYPE_COLORS[o.ty] || '#ef4444';
    ctx.save();
    ctx.globalAlpha = 0.85;
    if (o.s === 'c') {
      const x = o.x + ox, y = o.y + oy;
      ctx.fillStyle = 'rgba(220,38,38,.16)'; ctx.beginPath(); ctx.arc(x, y, o.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(239,68,68,.35)'; ctx.beginPath(); ctx.arc(x, y, o.r * k, 0, 7); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(x, y, o.r, 0, 7); ctx.stroke();
    } else {
      ctx.translate(o.x + ox, o.y + oy); ctx.rotate(o.a);
      ctx.fillStyle = 'rgba(220,38,38,.16)'; ctx.fillRect(0, -o.w / 2, o.len, o.w);
      ctx.fillStyle = 'rgba(239,68,68,.35)'; ctx.fillRect(0, -o.w / 2, o.len * k, o.w);
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(0, -o.w / 2, o.len, o.w);
    }
    ctx.restore();
  }
}

/* ---------- Talismã de Abra: fuga de emergência ----------
 * Como o Teleporte do Abra: tira você na hora de qualquer lugar (luta, masmorra, torre) e te leva para a última cidade.
 * Você fica intocável por um instante enquanto some. Não funciona na arena PvP.
 * Caro (1000 🪙, só no Mercador, nunca cai de baú), um por vez e 5 min de recarga entre usos.
 */
function useAbra() {
  const P = G.P;
  if (!P) return;
  if (!(P.bag.abra > 0)) return G.toasts.push({ text: '🌀 Você não tem Talismã de Abra. O Mercador vende.', color: '#fca5a5', t: 2.5 });
  if (P.pvp || inArena(P.x, P.y)) return text(P.x, P.y - 40, 'O talismã não funciona na arena', '#fca5a5', 12);
  if (P.abraCd > 0) return text(P.x, P.y - 40, `🌀 Recarregando (${Math.floor(P.abraCd / 60)}:${String(Math.ceil(P.abraCd % 60)).padStart(2, '0')})`, '#fca5a5', 12);
  if (!inDungeonArea(P.x) && inTown(P.x, P.y)) return text(P.x, P.y - 40, 'Você já está numa cidade', '#cbd5e1', 12);
  const t = TOWNS[P.lastTown] || TOWNS[0];
  P.bag.abra--; P.abraCd = 300; P.dodgeT = 1.2; P.riding = false; G.recall = null; P.dash = null;
  burst(P.x, P.y, '#c084fc', 34); burst(P.x, P.y, '#fde68a', 16);
  G.fx.push({ k: 'ring', x: P.x, y: P.y, r: 0, R: 90, life: 0.5, max: 0.5, color: '#c084fc' });
  P.x = t.x + rand(-50, 50); P.y = t.y + rand(55, 80);
  burst(P.x, P.y, '#c084fc', 34);
  G.toasts.push({ text: `🌀 O Talismã de Abra te teletransportou para ${townName(t)}! (restam ${P.bag.abra})`, color: '#c4b5fd', t: 4 });
  sfx('pot'); G.dirty = true; saveGame();
}

// contratos de dupla: distância média entre os parceiros (~50 m)
const DUO_R = 1600;
const duoNear = P => [...G.remotes.values()].some(r => !r.dead && r.name && Math.hypot(r.tx - P.x, r.ty - P.y) < DUO_R);

// grupo: chefes (líderes, Procurados, chefes de masmorra) ganham +60% de vida por jogador a mais na sala (até 4)
// e as salas de masmorra têm +40% de Pokémon por jogador a mais
const nPlayers = () => clamp(1 + (G && G.remotes ? [...G.remotes.values()].filter(r => !r.dead && r.name).length : 0), 1, 4);
const grpK = () => 1 + 0.6 * (nPlayers() - 1);
const grpN = () => 1 + 0.4 * (nPlayers() - 1);

// dificuldade média do começo ao fim (medido com uma IA que desvia das balas): o começo era fácil demais
// e o fim perigoso demais, então o dano dos tiros inimigos varia por zona
const ZONE_DMG = [1, 2.0, 1.3, 0.95, 0.38, 0.3]; // calibrado para ~1/3 de chance de morrer por nível na simulação em cada zona (com o número de Pokémon por perto de cada zona)

// Clérigo em grupo: cada outro jogador perto dele na hora da cura aumenta a cura em 10% (até +30%)
const clericChoir = P => 1 + 0.1 * Math.min(3, [...G.remotes.values()].filter(r => !r.dead && r.name && Math.hypot(r.tx - P.x, r.ty - P.y) < 260).length);

// zona da água: rios e laguinhos já têm a da zona em volta; o mar e os lagos grandes usam a da costa mais próxima
// (antes, quem surfava no mar sempre encontrava Pokémon da zona 1, mesmo ao lado da zona 5)
const WZC = new Map();
function waterZone(x, y) {
  const z0 = zoneAt(x, y);
  if (z0 >= 1 && z0 <= 5) return z0;
  if (z0 === 0) return 1;
  const key = Math.round(x / 256) + ',' + Math.round(y / 256) + REGION_ID;
  if (WZC.has(key)) return WZC.get(key);
  let z = 1;
  search: for (const r of [160, 320, 520, 760, 1050, 1400, 1900, 2500]) for (let k = 0; k < 16; k++) {
    const zz = zoneAt(x + Math.cos(k * 0.3927) * r, y + Math.sin(k * 0.3927) * r);
    if (zz >= 1 && zz <= 5) { z = zz; break search; }
  }
  WZC.set(key, z);
  return z;
}

/* ---------- Equipar o melhor: troca cada espaço pelo item mais forte da mochila (itens travados também valem) ---------- */
function bestSwaps(P) {
  const out = [];
  for (const sl of ['arma', 'armadura', 'anel', 'amuleto']) {
    let bi = -1, bs = itemScore(P.equip[sl] || null);
    P.inv.forEach((it, i) => { if (it && it.slot === sl && itemScore(it) > bs) { bs = itemScore(it); bi = i; } });
    if (bi >= 0) out.push([sl, bi]);
  }
  return out;
}
function equipBest(P) {
  if (!P) return;
  const sw = bestSwaps(P);
  if (!sw.length) return text(P.x, P.y - 40, 'Você já está com o melhor equipamento', '#cbd5e1', 12);
  const old = maxHP(P), names = [];
  for (const [sl, i] of sw) { const it = P.inv[i]; P.inv[i] = P.equip[sl] || null; P.equip[sl] = it; names.push(it.name); }
  P.hp += Math.max(0, maxHP(P) - old);
  G.toasts.push({ text: `⬆ Equipado: ${names.join(', ')}`, color: '#86efac', t: 3 });
  sfx('pick'); G.dirty = true; saveGame();
}

/* ---------- Automáticos (só no celular; lá podem ser desligados no painel, em Opções. PC e controle não têm) ----------
 * Vida abaixo de 15% com Talismã de Abra pronto: foge primeiro (uma poção não salvaria no meio de tanta bala).
 * Vida abaixo de 35% (ou abaixo de 15% sem Talismã): bebe uma poção, com 5 s entre as automáticas.
 * Nada disso na arena PvP.
 */
const OPTS_KEY = 'pkr_opts_v1';
let OPTS = { autoPot: true, autoFlee: true, autoAim: true, vibra: true };
try { Object.assign(OPTS, JSON.parse(localStorage.getItem(OPTS_KEY) || '{}')); } catch (e) { /* ignora */ }
const saveOpts = () => { try { localStorage.setItem(OPTS_KEY, JSON.stringify(OPTS)); } catch (e) { /* ignora */ } };
const AUTO_POT = 0.35, AUTO_FLEE = 0.15;
function autoTick(P, dt) {
  if (!onMobile()) return; // poção e fuga automáticas só no celular
  P.autoPotT = Math.max(0, (P.autoPotT || 0) - dt);
  if (!P || P.hp <= 0 || P.pvp || inArena(P.x, P.y)) return;
  const f = P.hp / maxHP(P), safe = !inDungeonArea(P.x) && inTown(P.x, P.y);
  if (safe) return;
  if (OPTS.autoFlee && f < AUTO_FLEE && P.bag.abra > 0 && !(P.abraCd > 0)) { useAbra(); return; }
  if (OPTS.autoPot && f < AUTO_POT && P.pots.hp > 0 && P.autoPotT <= 0 && !isWolf(P)) { usePotion(); P.autoPotT = 5; }
}
const onMobile = () => typeof MOBILE !== 'undefined' && MOBILE; // MOBILE vem de js/touch.js
const optsPanel = () => !onMobile() ? '' : `<h4>Opções</h4><div class="opts">
  <button data-opt="autoPot" class="${OPTS.autoPot ? 'good' : ''}" title="Bebe uma poção sozinho com menos de 35% de vida (5 s entre poções automáticas)">🧪 Poção automática: ${OPTS.autoPot ? 'ligada' : 'desligada'}</button>
  <button data-opt="autoFlee" class="${OPTS.autoFlee ? 'good' : ''}" title="Com menos de 15% de vida, usa o Talismã de Abra sozinho (se você tiver um pronto) e foge para a cidade">🌀 Fuga automática: ${OPTS.autoFlee ? 'ligada' : 'desligada'}</button>
  <button data-opt="autoAim" class="${OPTS.autoAim ? 'good' : ''}" title="Ligada: atira sozinho no Pokémon mais perto quando você não está mirando. Desligada: só atira quando você mira com o analógico direito ou toca num Pokémon.">🎯 Mira automática: ${OPTS.autoAim ? 'ligada' : 'desligada'}</button>
  <button data-opt="vibra" class="${OPTS.vibra ? 'good' : ''}" title="Vibra de leve ao levar dano">📳 Vibração: ${OPTS.vibra ? 'ligada' : 'desligada'}</button></div>`;
