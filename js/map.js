'use strict';
/* ============ Mapa do mundo ============
 * A região é desenhada à mão num grid grosso (MACRO, células de 400px) e as
 * fronteiras são distorcidas por ruído. A vila fica na origem (0,0).
 * Cada tile guarda um tipo (TT) e uma zona de perigo (TZ).
 * Fronteiras entre regiões viram barreiras naturais (árvores, penhascos, rio)
 * e só se atravessa pelas rotas.
 */
const MACRO = [
  '~~~~~~~~~~~~~~~~~~~~',
  '~~4444~~~33333~~444~',
  '~444444333333334444~',
  '~44444333LL3333444~~',
  '~444233333333333222~',
  '~222222333333222222~',
  '~222LL2222223322222~',
  '~2222222222222L2222~',
  '~2222111111112222~~~',
  '~~221111111111122~~~',
  '~~111111VV11111111~~',
  '~~~11111VV111111~~~~',
  '~~~~1111111111~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~',
];
// mundo de ~12000 x 8400 px (a vila fica no canto entre as células 8/9 e 10/11)
const CELL = 600, WX0 = -9 * CELL, WY0 = -11 * CELL, WX1 = WX0 + 20 * CELL, WY1 = WY0 + 14 * CELL;
const OX = -Math.floor(WX0 / TILE), OY = -Math.floor(WY0 / TILE);
const NX = Math.floor(WX1 / TILE) + OX + 1, NY = Math.floor(WY1 / TILE) + OY + 1;
const cellPt = (cx, cy) => [WX0 + cx * CELL, WY0 + cy * CELL];

const TK = { GRASS: 0, TALL: 1, PATH: 2, WATER: 3, TREE: 4, ROCK: 5, FLOWER: 6, PLAZA: 7, FENCE: 8, CLIFF: 9, SAND: 10, DEAD: 11, GRAVE: 12, CRYSTAL: 13, BRIDGE: 14, PINE: 15, SNOW: 16, SEA: 17, CUTTREE: 18, CRACKED: 19, BOULDER: 20, WATERFALL: 21, DIVE: 22, CHEST: 23, DTREE: 24, POND: 25 };
// barreiras só onde têm função: fronteiras (progresso), anéis dos baús (loot), água funda e prédios.
// DTREE = árvore decorativa (atravessável), POND = laguinho raso
const SOLIDK = new Uint8Array(32);
// água não está aqui: a profundidade é um campo contínuo (wetAt), rasa atravessa e funda bloqueia
// decorações soltas (pedrinhas, pinheiros, árvores mortas, lápides) não bloqueiam: o jogo é de desviar de tiros
[TK.TREE, TK.FENCE, TK.CLIFF, TK.CUTTREE, TK.CRACKED, TK.BOULDER, TK.CHEST].forEach(k => { SOLIDK[k] = 1; });
const OBJK = new Uint8Array(32); // desenhados por cima do chão, com sobra para cima
[TK.TREE, TK.ROCK, TK.DEAD, TK.GRAVE, TK.CRYSTAL, TK.PINE, TK.CUTTREE, TK.CRACKED, TK.BOULDER, TK.DTREE].forEach(k => { OBJK[k] = 1; });

// Rotas (em coordenadas de célula), ligando a vila a todas as regiões
const ROUTES = [
  [[9, 11], [9, 9], [8.5, 7.5], [8, 5.5], [7.5, 3.5], [10.5, 2]],
  [[9, 11], [12, 10.5], [15, 9.5], [16.5, 7.5], [16, 5], [17, 3], [17.5, 1.5]],
  [[9, 11], [6, 10.5], [3.5, 9.5], [2.5, 7.5], [2, 5], [3, 3], [4, 1.5]],
  [[2, 5], [4, 5], [8, 5.5], [13, 5.5], [16, 5]],
  [[9, 11], [9, 12.4]],
].map(r => r.map(([cx, cy]) => cellPt(cx, cy)));

// Prédios da vila (x, y = centro)
const BUILDINGS = [
  { id: 'cura', x: -140, y: -128, w: 120, h: 76, roof: '#e05252', wall: '#f5efe0', sign: '❤️' },
  { id: 'loja', x: 140, y: -128, w: 120, h: 76, roof: '#3b82f6', wall: '#f5efe0', sign: '🛒' },
  { id: 'ferreiro', x: -140, y: 78, w: 120, h: 76, roof: '#78716c', wall: '#e7d8c0', sign: '🔨', chimney: 1 },
  { id: 'guilda', x: 140, y: 78, w: 132, h: 80, roof: '#7c3aed', wall: '#efe6d6', sign: '📜' },
];

// esconderijos com baú, cercados por um obstáculo de MO
const SECRETS = [
  { id: 's_cut1', k: 'cut', at: [11, 9.6] },
  { id: 's_cut2', k: 'cut', at: [6.5, 7] },
  { id: 's_smash1', k: 'smash', at: [11.5, 4.2] },
  { id: 's_smash2', k: 'smash', at: [5.2, 8.6] },
  { id: 's_smash3', k: 'smash', at: [5.5, 4.0] },
  { id: 's_cut3', k: 'cut', at: [15.5, 2.0] },
  { id: 's_surf2', k: 'surf', at: [13.5, 2.5] },
  { id: 's_surf', k: 'surf', at: [4.5, 11.5] },
].map(sc => { const [x, y] = cellPt(...sc.at); return { ...sc, x, y, zone: 1 }; });
const SECRET_AT = new Map();
const inTown = (x, y) => x * x + y * y < VILA_R * VILA_R;
const MZ = { '~': -1, L: -2, 1: 1, 2: 2, 3: 3, 4: 4, V: 1 };
function macroAt(x, y) {
  const cx = Math.floor((x - WX0) / CELL), cy = Math.floor((y - WY0) / CELL);
  if (cy < 0 || cy >= MACRO.length || cx < 0 || cx >= 20) return -1;
  return MZ[MACRO[cy][cx]];
}
function zoneRaw(x, y) {
  const wx = x + (vnoise(x / 780 + 31, y / 780) - 0.5) * 540 + (vnoise(x / 160, y / 160 + 9) - 0.5) * 100;
  const wy = y + (vnoise(x / 780, y / 780 + 57) - 0.5) * 540 + (vnoise(x / 160 + 5, y / 160) - 0.5) * 100;
  return macroAt(wx, wy);
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
function pathDist(x, y) {
  const qx = x + (vnoise(x / 230, y / 230 + 3) - 0.5) * 90, qy = y + (vnoise(x / 230 + 8, y / 230) - 0.5) * 90;
  let best = 1e9;
  for (const r of ROUTES) for (let i = 0; i < r.length - 1; i++) {
    const a = r[i], b = r[i + 1];
    if (qx < Math.min(a[0], b[0]) - 200 || qx > Math.max(a[0], b[0]) + 200 || qy < Math.min(a[1], b[1]) - 200 || qy > Math.max(a[1], b[1]) + 200) continue;
    best = Math.min(best, segDist(qx, qy, a[0], a[1], b[0], b[1]));
  }
  // dentro da vila as ruas são retas
  if (inTown(x, y)) best = Math.min(Math.abs(x), Math.abs(y + Math.abs(x) / 6));
  return best;
}

let TT = null, TZ = null, TV = null, WET = null, MINIMAP = null;
const ZPTS = { 1: [], 2: [], 3: [], 4: [] };
const tIdx = (ix, iy) => (ix < 0 || iy < 0 || ix >= NX || iy >= NY ? -1 : iy * NX + ix);
function tileIdx(x, y) { return tIdx(Math.floor(x / TILE) + OX, Math.floor(y / TILE) + OY); }
function tileKind(x, y) { const i = tileIdx(x, y); return i < 0 ? TK.SEA : TT[i]; }
function zoneAt(x, y) { const i = tileIdx(x, y); return i < 0 ? -1 : TZ[i]; }
// profundidade da água: média 3x3 dos tiles de água, interpolada e com um pouco de ruído (bordas orgânicas)
const SHALLOW_T = 0.22, DEEP_T = 0.62;
function wetAt(x, y) {
  const fx = x / TILE + OX - 0.5, fy = y / TILE + OY - 0.5;
  const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const g = (i, j) => { const k = tIdx(i, j); return k < 0 ? 1 : WET[k]; };
  const a = g(ix, iy), b = g(ix + 1, iy), c = g(ix, iy + 1), e = g(ix + 1, iy + 1);
  if (a + b + c + e === 0) return 0;
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + e) * tx * ty + (vnoise(x / 45, y / 45) - 0.5) * 0.16;
}
const isWater = (x, y) => x < DG_BASE - 5000 && tileKind(x, y) !== TK.BRIDGE && wetAt(x, y) > SHALLOW_T;
const isDeep = (x, y) => x < DG_BASE - 5000 && tileKind(x, y) !== TK.BRIDGE && wetAt(x, y) > DEEP_T;
// swim: bit 1 = entra na água funda (Surfar/voador/aquático), bit 2 = sobe cachoeira
function solidAt(x, y, swim) {
  if (x > DG_BASE - 5000) return false;
  const sw = swim | 0, i = tileIdx(x, y);
  if (i < 0) return !(sw & 1);
  if (SOLIDK[TT[i]]) return true;
  if (TT[i] === TK.WATERFALL) return !(sw & 2);
  if (!(sw & 1) && TT[i] !== TK.BRIDGE && (WET[i] > 0 || TT[i] === TK.SEA) && wetAt(x, y) > DEEP_T) return true;
  if (inTown(x, y)) for (const b of BUILDINGS) if (Math.abs(x - b.x) < b.w / 2 - 4 && Math.abs(y - b.y) < b.h / 2 - 4) return true;
  return false;
}
const solidR = (x, y, r, swim) => solidAt(x - r, y - r, swim) || solidAt(x + r, y - r, swim) || solidAt(x - r, y + r, swim) || solidAt(x + r, y + r, swim);
function clampWorld(o) { o.x = clamp(o.x, WX0 + 40, WX1 - 40); o.y = clamp(o.y, WY0 + 40, WY1 - 40); }
function pushOutTown(e) {
  const m = VILA_R + 30, d0 = Math.hypot(e.x, e.y) || 1;
  if (d0 < m) { e.x *= m / d0; e.y *= m / d0; }
}
const randomZonePoint = z => (ZPTS[z].length ? pick(ZPTS[z]) : [0, -1500]);

function carveSecret(sc) {
  const cx = Math.floor(sc.x / TILE) + OX, cy = Math.floor(sc.y / TILE) + OY, c = tIdx(cx, cy);
  if (c < 0) return;
  const R = sc.k === 'surf' ? 6.6 : 3.6, inner = sc.k === 'surf' ? 3 : R - 1.3;
  sc.zone = Math.max(1, TZ[c]);
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
    const j = tIdx(cx + dx, cy + dy), d0 = Math.hypot(dx, dy);
    if (j < 0 || TT[j] === TK.PATH || TT[j] === TK.BRIDGE) continue;
    if (d0 > R) continue;
    if (TZ[j] < 1) TZ[j] = sc.zone;
    if (d0 <= inner) { TT[j] = TK.GRASS; continue; }
    TT[j] = sc.k === 'cut' ? TK.CUTTREE : sc.k === 'smash' ? TK.CRACKED : TK.WATER;
  }
  TT[c] = TK.CHEST;
  SECRET_AT.set(c, sc);
  sc.x = (cx - OX + 0.5) * TILE; sc.y = (cy - OY + 0.5) * TILE;
}

function buildWorld() {
  TT = new Uint8Array(NX * NY); TZ = new Int8Array(NX * NY); TV = new Uint8Array(NX * NY);
  const onPath = new Uint8Array(NX * NY);
  // 1ª passada: zona, rotas e bioma
  for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
    const i = iy * NX + ix, wx = (ix - OX + 0.5) * TILE, wy = (iy - OY + 0.5) * TILE;
    TV[i] = Math.floor(hash(ix * 3 + 7, iy * 5 + 1) * 4);
    const h = hash(ix * 7 + 1, iy * 13 + 5);
    const pd = pathDist(wx, wy);
    if (inTown(wx, wy)) {
      TZ[i] = 0;
      if (pd < 34) { TT[i] = Math.hypot(wx, wy) < 110 ? TK.PLAZA : TK.PATH; onPath[i] = 1; }
      else if (Math.hypot(wx, wy) < 110) TT[i] = TK.PLAZA;
      else TT[i] = h < 0.07 ? TK.FLOWER : TK.GRASS;
      continue;
    }
    let z = zoneRaw(wx, wy);
    if (z === -1) { TZ[i] = -1; TT[i] = TK.SEA; continue; }
    if (z === -2) { TZ[i] = -1; TT[i] = pd < 34 ? TK.BRIDGE : TK.WATER; if (pd < 34) { onPath[i] = 1; TZ[i] = 1; } continue; }
    TZ[i] = z;
    if (pd < 34) { TT[i] = TK.PATH; onPath[i] = 1; continue; }
    const n1 = vnoise(wx / 180 + 40, wy / 180 + 11), n2 = vnoise(wx / 95 + 7, wy / 95 + 70);
    let k = TK.GRASS;
    if (z === 1) k = n1 > 0.64 ? TK.TALL : n2 > 0.84 && n1 < 0.45 ? TK.POND : h < 0.012 ? TK.DTREE : h < 0.06 ? TK.FLOWER : TK.GRASS;
    else if (z === 2) k = n2 > 0.6 && h > 0.45 ? TK.DTREE : n1 > 0.6 ? TK.TALL : h < 0.04 ? TK.DTREE : h < 0.065 ? TK.FLOWER : TK.GRASS;
    else if (z === 3) k = n2 > 0.76 && h < 0.3 ? TK.ROCK : n1 > 0.68 ? TK.SNOW : h < 0.04 ? TK.ROCK : h < 0.075 ? TK.PINE : n1 < 0.28 ? TK.TALL : TK.GRASS;
    else if (z === 4) k = n2 > 0.79 ? TK.POND : n1 > 0.63 ? TK.TALL : h < 0.02 ? TK.DEAD : h < 0.03 ? TK.GRAVE : h < 0.05 ? TK.CRYSTAL : TK.GRASS;
    if ((SOLIDK[k] || k === TK.WATER || k === TK.POND) && pd < 60) k = TK.GRASS; // margem livre ao lado das rotas
    TT[i] = k;
  }
  // 2ª passada: fronteiras naturais e praias
  const T2 = TT.slice();
  for (let iy = 1; iy < NY - 1; iy++) for (let ix = 1; ix < NX - 1; ix++) {
    const i = iy * NX + ix, z = TZ[i];
    if (z < 1 || TT[i] === TK.SEA) continue;
    let bz = 0, sea = false, river = false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const j = tIdx(ix + dx, iy + dy);
      if (j < 0) continue;
      if (TT[j] === TK.SEA) sea = true;
      if (TZ[j] >= 1 && TZ[j] !== z && (TZ[j] === 4 || z === 4)) river = true; // rio largo em volta das Terras Sombrias
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && TZ[j] >= 1 && TZ[j] !== z) bz = Math.max(bz, TZ[j], z);
    }
    if (river) T2[i] = onPath[i] ? TK.BRIDGE : TK.WATER;
    else if (bz) {
      if (onPath[i]) continue;
      const wx = (ix - OX + 0.5) * TILE, wy = (iy - OY + 0.5) * TILE;
      // trechos da fileira de árvores podem ser cortados (atalhos com Corte)
      const nb = vnoise(wx / 260 + 77, wy / 260 + 13) > 0.72;
      T2[i] = bz === 2 ? (nb ? TK.CUTTREE : TK.TREE) : nb ? TK.CRACKED : TK.CLIFF;
    } else if (sea && !onPath[i]) T2[i] = TK.SAND;
  }
  TT = T2;
  for (const sc of SECRETS) carveSecret(sc);
  WET = new Float32Array(NX * NY);
  const wet = k => (k === TK.WATER || k === TK.SEA || k === TK.BRIDGE || k === TK.DIVE ? 1 : k === TK.POND ? 0.5 : 0);
  for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
    let t = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = tIdx(ix + dx, iy + dy); t += j < 0 ? 1 : wet(TT[j]); }
    WET[iy * NX + ix] = t / 9;
  }
  // pontos de mergulho no meio de águas fundas
  for (let i = 0; i < NX * NY; i++) if (WET[i] === 1 && (TT[i] === TK.SEA || TT[i] === TK.WATER) && hash(i * 3 + 1, 77) < 0.0022) TT[i] = TK.DIVE;
  for (let iy = 0; iy < NY; iy += 3) for (let ix = 0; ix < NX; ix += 3) {
    const i = iy * NX + ix, z = TZ[i], x = (ix - OX + 0.5) * TILE, y = (iy - OY + 0.5) * TILE;
    if (z >= 1 && !solidAt(x, y) && !isWater(x, y)) ZPTS[z].push([x, y]);
  }
  // minimapa (160 x 112)
  MINIMAP = document.createElement('canvas');
  MINIMAP.width = 160; MINIMAP.height = 112;
  const mx = MINIMAP.getContext('2d');
  for (let y = 0; y < 112; y++) for (let x = 0; x < 160; x++) {
    const wx = WX0 + (x + 0.5) / 160 * (WX1 - WX0), wy = WY0 + (y + 0.5) / 112 * (WY1 - WY0);
    const k = tileKind(wx, wy), z = zoneAt(wx, wy);
    mx.fillStyle = k === TK.SEA ? '#1c4870' : k === TK.WATER || k === TK.POND ? '#2f6fb8' : k === TK.PATH || k === TK.BRIDGE ? '#e6d3a3' : k === TK.SAND ? '#e8d9a0'
      : k === TK.TREE || k === TK.PINE || k === TK.CUTTREE || k === TK.DTREE ? '#1f5a2a' : k === TK.CLIFF ? '#6d5d48' : z === 0 ? '#d6cfc0' : k === TK.TALL ? shade(ZONES[Math.max(1, z)].cols[0], 0.8) : ZONES[Math.max(0, z)].cols[1];
    mx.fillRect(x, y, 1, 1);
  }
}

/* ---------- Desenho dos tiles (pixel art gerada e guardada em cache) ---------- */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => clamp(Math.round(c * k), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const TALLC = { 0: ['#3f8f3a', '#6cc057'], 1: ['#3f8f3a', '#6cc057'], 2: ['#24572a', '#3f8a3e'], 3: ['#6f6c3e', '#a9a35e'], 4: ['#40285a', '#7a52a0'] };
const PATHC = { 0: '#d8c9a3', 1: '#dcc48e', 2: '#b99b6a', 3: '#a8916f', 4: '#5e4c63' };
const WATERC = { 1: '#3d86d8', 2: '#2f74c0', 3: '#2c6bb3', 4: '#3b2a5e' };
const TCACHE = {};
function tileImg(kind, z, v) {
  const key = kind * 1000 + (z + 1) * 10 + v;
  if (TCACHE[key]) return TCACHE[key];
  const obj = OBJK[kind];
  const c = document.createElement('canvas');
  c.width = 32; c.height = obj ? 44 : 32;
  const g = c.getContext('2d');
  const px = (col, x, y, w = 2, h = 2) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const zz = Math.max(0, z), pal = ZONES[zz].cols, base = pal[v % pal.length];
  const R = k => hash(v * 31 + k, kind * 17 + zz);
  if (!obj) {
    switch (kind) {
      case TK.TALL: {
        const [dk, lt] = TALLC[zz] || TALLC[1];
        px(dk, 0, 0, 32, 32);
        for (let r = 0; r < 3; r++) for (let q = 0; q < 5; q++) {
          const x = q * 8 + (r % 2) * 4 - 4, y = r * 11;
          px(shade(dk, 0.75), x, y + 8, 7, 2);
          px(lt, x + 1, y + 3, 1, 6); px(lt, x + 3, y + 1, 1, 8); px(lt, x + 5, y + 3, 1, 6);
        }
        break;
      }
      case TK.PATH: case TK.PLAZA: {
        const col = kind === TK.PLAZA ? '#d6cdb8' : PATHC[zz];
        px(col, 0, 0, 32, 32);
        if (kind === TK.PLAZA) { px('#bdb29b', 0, 0, 32, 1); px('#bdb29b', 0, 16, 32, 1); px('#bdb29b', (v % 2) * 16, 0, 1, 16); px('#bdb29b', 8 + (v % 2) * 8, 16, 1, 16); }
        else for (let k = 0; k < 4; k++) px(shade(col, 0.85), Math.floor(R(k) * 28) + 2, Math.floor(R(k + 9) * 28) + 2, 2, 2);
        break;
      }
      case TK.SAND: case TK.SNOW: {
        const col = kind === TK.SAND ? '#eadb9f' : '#eef3f8';
        px(col, 0, 0, 32, 32);
        for (let k = 0; k < 5; k++) px(kind === TK.SAND ? '#d4c27f' : '#cfdbe8', Math.floor(R(k) * 30), Math.floor(R(k + 5) * 30), 2, 1);
        break;
      }
      case TK.WATER: case TK.SEA: case TK.BRIDGE: {
        const col = kind === TK.SEA || z < 1 && kind !== TK.WATER ? '#2a64b0' : WATERC[zz] || WATERC[1];
        px(kind === TK.SEA ? '#2a64b0' : col, 0, 0, 32, 32);
        const lt = shade(kind === TK.SEA ? '#2a64b0' : col, 1.3);
        px(lt, 3 + v * 3, 8, 8, 2); px(lt, 16 - v, 21, 9, 2);
        if (kind === TK.BRIDGE) {
          px('#a8743f', 0, 2, 32, 28);
          for (let y = 2; y < 30; y += 6) px('#7a5228', 0, y, 32, 1);
          px('#6b4423', 0, 2, 32, 2); px('#6b4423', 0, 28, 32, 2);
        }
        break;
      }
      case TK.CLIFF: {
        const col = zz === 4 ? '#4a3a5a' : zz === 2 ? '#6d6a55' : '#8d7b64';
        px(col, 0, 0, 32, 32);
        px(shade(col, 1.25), 0, 0, 32, 3);
        for (const [y, o] of [[9, 0], [18, 6], [26, 2]]) { px(shade(col, 0.75), o + v * 2, y, 14, 2); px(shade(col, 0.75), o + 18, y + 2, 10, 2); }
        break;
      }
      case TK.FENCE: {
        px(base, 0, 0, 32, 32);
        px('rgba(0,0,0,.18)', 0, 24, 32, 3);
        px('#e7e1d2', 0, 11, 32, 3); px('#e7e1d2', 0, 18, 32, 3);
        px('#f8f5ee', 3, 6, 5, 19); px('#f8f5ee', 24, 6, 5, 19);
        px('#cfc7b5', 3, 23, 5, 2); px('#cfc7b5', 24, 23, 5, 2);
        break;
      }
      default: { // GRASS e FLOWER (a flor é só sobreposição; o chão vem do groundChunk)
        if (kind !== TK.FLOWER) {
          px(base, 0, 0, 32, 32);
          const dk = shade(base, 0.85);
          for (let k = 0; k < 3; k++) { const x = Math.floor(R(k) * 26) + 2, y = Math.floor(R(k + 3) * 26) + 2; px(dk, x, y, 1, 3); px(dk, x + 2, y + 1, 1, 2); }
        } else {
          for (let k = 0; k < 3; k++) {
            const x = Math.floor(R(k + 20) * 22) + 4, y = Math.floor(R(k + 30) * 22) + 4;
            if (zz === 2) { px('#f2e8d5', x + 2, y + 4, 2, 3); px('#d9433b', x, y + 1, 6, 3); px('#fff', x + 1, y + 1, 1, 1); }
            else if (zz === 4) { px('rgba(103,232,249,.35)', x - 2, y - 2, 8, 8); px('#67e8f9', x, y, 3, 3); }
            else if (zz === 3) { px('#a7f3d0', x, y, 2, 2); px('#e0f2fe', x + 3, y + 1, 2, 2); }
            else { px(['#f87171', '#fde047', '#ffffff', '#f9a8d4'][(v + k) % 4], x, y, 4, 4); px('#facc15', x + 1, y + 1, 2, 2); }
          }
        }
      }
    }
  } else {
    // objetos: desenhados com 12px a mais para cima
    const sh = () => { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(16, 40, 13, 4, 0, 0, 7); g.fill(); };
    const circ = (col, x, y, r) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    if (kind === TK.BOULDER) {
      sh();
      circ('#6d665c', 16, 28, 13); circ('#8a8276', 14, 26, 11); circ('#aaa294', 11, 22, 4);
      px('#5b554b', 20, 33, 6, 2);
    } else if (kind === TK.CRACKED) {
      sh();
      g.fillStyle = '#8a7a66'; g.beginPath(); g.ellipse(16, 30, 13, 10, 0, 0, 7); g.fill();
      g.fillStyle = '#a8977f'; g.beginPath(); g.ellipse(12, 26, 5, 3, 0, 0, 7); g.fill();
      g.strokeStyle = '#3f362b'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(10, 24); g.lineTo(15, 30); g.lineTo(13, 35); g.moveTo(15, 30); g.lineTo(22, 28); g.lineTo(24, 33); g.stroke();
    } else if (kind === TK.CUTTREE) {
      sh(); px('#6b4423', 14, 32, 4, 8);
      circ('#1d5a24', 16, 26, 11); circ('#2f8f3a', 16, 25, 9); circ('#56b04a', 13, 21, 4);
      px('#1d5a24', 15, 15, 2, 4); px('#e5e7eb', 21, 30, 4, 1); px('#e5e7eb', 22, 29, 1, 3);
    } else if (kind === TK.TREE || kind === TK.DTREE) {
      const cs = zz === 2 ? ['#1d4d24', '#2b6b33', '#3f8a44'] : zz === 4 ? ['#2b1f3a', '#3d2d52', '#57417a'] : zz === 3 ? ['#3b5a2c', '#4f7a3a', '#6f9a4a'] : ['#2a7a34', '#3c9a44', '#6cc25a'];
      sh(); px('#6b4423', 13, 28, 6, 12); px('#4e311a', 13, 28, 2, 12);
      circ(cs[0], 16, 18, 14); circ(cs[1], 13, 15, 10); circ(cs[1], 20, 20, 8); circ(cs[2], 10, 10, 4);
    } else if (kind === TK.PINE) {
      sh(); px('#5b3a1e', 14, 32, 4, 8);
      for (const [y, w, c] of [[24, 13, '#1f4f3a'], [15, 10, '#2a6347'], [6, 7, '#357555']]) {
        g.fillStyle = c; g.beginPath(); g.moveTo(16, y - 9); g.lineTo(16 + w, y + 9); g.lineTo(16 - w, y + 9); g.closePath(); g.fill();
      }
      px('#f1f5f9', 14, -1 + 1, 4, 3); px('#e2e8f0', 12, 13, 3, 2); px('#e2e8f0', 19, 22, 3, 2);
    } else if (kind === TK.ROCK) {
      sh();
      g.fillStyle = '#7b7468'; g.beginPath(); g.ellipse(16, 32, 12, 9, 0, 0, 7); g.fill();
      g.fillStyle = '#a8a092'; g.beginPath(); g.ellipse(12, 28, 5, 3, 0, 0, 7); g.fill();
      px('#5b554b', 18, 34, 6, 2);
    } else if (kind === TK.DEAD) {
      sh();
      g.strokeStyle = '#5b4a42'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(16, 40); g.lineTo(16, 14); g.moveTo(16, 24); g.lineTo(7, 14); g.moveTo(16, 20); g.lineTo(25, 10); g.moveTo(7, 14); g.lineTo(5, 7); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(25, 10); g.lineTo(28, 5); g.moveTo(16, 14); g.lineTo(19, 6); g.stroke();
    } else if (kind === TK.GRAVE) {
      sh();
      g.fillStyle = '#8e8ba0'; g.beginPath(); g.moveTo(9, 40); g.lineTo(9, 24); g.arc(16, 24, 7, Math.PI, 0); g.lineTo(23, 40); g.closePath(); g.fill();
      px('#5d5a70', 15, 23, 2, 10); px('#5d5a70', 12, 26, 8, 2); px('#6b6880', 9, 38, 14, 2);
    } else if (kind === TK.CRYSTAL) {
      circ('rgba(192,132,252,.22)', 16, 30, 13);
      g.fillStyle = '#c084fc'; g.beginPath(); g.moveTo(16, 14); g.lineTo(23, 30); g.lineTo(16, 40); g.lineTo(9, 30); g.closePath(); g.fill();
      g.fillStyle = '#f5d0fe'; g.beginPath(); g.moveTo(16, 16); g.lineTo(19, 29); g.lineTo(16, 34); g.closePath(); g.fill();
    }
  }
  TCACHE[key] = c;
  return c;
}

/* ---------- Chão contínuo ----------
 * Em vez de um quadrado de cor por tile, o chão é pintado em pedaços de 256px
 * com pixels de 4px. A consulta do tile é deslocada por ruído, então as bordas
 * entre grama, caminho e areia (e entre zonas) ficam orgânicas.
 */
const GCH = 256, GRES = 4, GCACHE = new Map(), RGBC = {};
const rgbOf = h => RGBC[h] || (RGBC[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const HARDK = new Set([TK.PLAZA, TK.FENCE, TK.CLIFF, TK.WATERFALL, TK.BRIDGE]);
const WETK = new Set([TK.WATER, TK.SEA, TK.DIVE, TK.POND]);
function groundCol(k, z, wx, wy, hx, hy) {
  const zz = Math.max(0, z), fine = hash(hx, hy);
  let col, f = 1;
  if (k === TK.TALL) { col = rgbOf((TALLC[zz] || TALLC[1])[0]); f = 0.94 + vnoise(wx / 90, wy / 90) * 0.12; }
  else if (k === TK.PATH || (zz === 4 && WETK.has(k))) { col = rgbOf(PATHC[zz]); f = 0.95 + vnoise(wx / 70, wy / 70) * 0.08 - (fine < 0.07 ? 0.08 : 0); }
  else if (k === TK.SAND || WETK.has(k)) { col = rgbOf('#eadb9f'); f = 0.96 + vnoise(wx / 60, wy / 60) * 0.06 - (fine < 0.05 ? 0.07 : 0); }
  else if (k === TK.SNOW) { col = rgbOf('#eef3f8'); f = 0.97 + vnoise(wx / 60, wy / 60) * 0.04 - (fine < 0.04 ? 0.05 : 0); }
  else if (k === TK.PLAZA) col = rgbOf('#d6cdb8');
  else if (k === TK.CLIFF || k === TK.WATERFALL) col = rgbOf(zz === 4 ? '#4a3a5a' : zz === 2 ? '#6d6a55' : '#8d7b64');
  else {
    // grama: manchas grandes claras/escuras + pontinhos de capim
    const pal = ZONES[zz].cols, a = rgbOf(pal[0]), b = rgbOf(pal[pal.length - 1]), t = vnoise(wx / 130 + 17, wy / 130);
    col = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    f = 0.9 + vnoise(wx / 260, wy / 260) * 0.16 + (vnoise(wx / 40, wy / 40) - 0.5) * 0.05;
    if (fine < 0.05) f -= 0.1; else if (fine > 0.975) f += 0.08;
  }
  return [col[0] * f, col[1] * f, col[2] * f];
}
function groundChunk(cx, cy) {
  const key = cx + ',' + cy;
  let c = GCACHE.get(key);
  if (c) return c;
  const x0 = cx * GCH, y0 = cy * GCH, n = GCH / GRES;
  c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), D = img.data;
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    const wx = x0 + (px + 0.5) * GRES, wy = y0 + (py + 0.5) * GRES;
    let k = tileKind(wx, wy), sx = wx, sy = wy;
    if (!HARDK.has(k)) {
      const ax = wx + (vnoise(wx / 22, wy / 22) - 0.5) * 22, ay = wy + (vnoise(wx / 22 + 91, wy / 22) - 0.5) * 22, k2 = tileKind(ax, ay);
      if (!HARDK.has(k2)) { k = k2; sx = ax; sy = ay; }
    }
    const col = groundCol(k, zoneAt(sx, sy), wx, wy, px + cx * 977, py + cy * 613), o = (py * n + px) * 4;
    D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  GCACHE.set(key, c);
  return c;
}

/* ---------- Grama que balança ---------- */
const SWAYC = {};
// mato alto: 3 fileiras de touceiras, 5 quadros de inclinação (f = 0..4, 2 = reto).
// edge: bits N=1 L=2 S=4 O=8 dos vizinhos que não são mato; as touceiras desse lado ficam ralas
function tallImg(z, v, f, edge) {
  const key = 't' + z + v + f + '_' + edge;
  if (SWAYC[key]) return SWAYC[key];
  const c = document.createElement('canvas');
  c.width = 32; c.height = 42;
  const g = c.getContext('2d'), zz = Math.max(0, z);
  const [dk, lt] = TALLC[zz] || TALLC[1], mid = shade(lt, 0.8), tip = shade(lt, 1.18), sway = (f - 2) * 1.5;
  for (let r = 0; r < 3; r++) for (let q = 0; q < 5; q++) {
    const R = k => hash(v * 131 + r * 17 + q * 5 + k, zz + 7);
    const out = (r === 0 && edge & 1) || (q === 4 && edge & 2) || (r === 2 && edge & 4) || (q === 0 && edge & 8);
    const near = !out && ((r === 1 && edge & 5) || (q === 3 && edge & 2) || (q === 1 && edge & 8));
    if (out ? R(9) < 0.75 : near && R(9) < 0.3) continue;
    const bx = q * 7 + (r % 2) * 3 - 2 + Math.floor(R(1) * 3), by = 10 + r * 11 + 9 + Math.floor(R(2) * 3) - 1;
    g.fillStyle = shade(dk, 0.7); g.fillRect(bx - 1, by - 1, 7, 2);
    for (let b = 0; b < 3; b++) {
      const h = (7 + Math.floor(R(b + 3) * 6) + (b === 1 ? 3 : 0)) * (out ? 0.6 : near ? 0.8 : 1) | 0, x = bx + b * 2;
      for (let j = 0; j < h; j++) {
        const t = j / h, xo = Math.round(sway * t * t * (b === 1 ? 1.4 : 1) + (b - 1) * t * 1.5);
        g.fillStyle = t > 0.75 ? tip : t > 0.35 ? lt : mid;
        g.fillRect(x + xo, by - j - 1, t < 0.5 ? 2 : 1, 1);
      }
    }
  }
  return (SWAYC[key] = c);
}
// tufinhos espalhados na grama baixa
function tuftImg(z, v, f) {
  const key = 'g' + z + v + f;
  if (SWAYC[key]) return SWAYC[key];
  const c = document.createElement('canvas');
  c.width = 32; c.height = 36;
  const g = c.getContext('2d'), zz = Math.max(0, z), base = ZONES[zz].cols[0];
  const lt = shade(base, 1.32), md = shade(base, 1.12), dk = shade(base, 0.7), sway = (f - 2) * 0.7;
  for (let k = 0; k < 3; k++) {
    const R = q => hash(v * 71 + k * 13 + q, zz + 3);
    const bx = 4 + Math.floor(R(1) * 22), by = 10 + Math.floor(R(2) * 22);
    for (let b = 0; b < 4; b++) {
      const h = 3 + Math.floor(R(b + 4) * 4), x = bx + b * 2 - 3;
      for (let j = 0; j < h; j++) {
        const t = j / h;
        g.fillStyle = j === 0 ? dk : b % 2 ? lt : md;
        g.fillRect(x + Math.round(sway * t * 2 + (b - 1.5) * t), by - j, 1, 1);
      }
    }
  }
  return (SWAYC[key] = c);
}
// vento: ondas que atravessam o campo na diagonal
function windFrame(tx, ty) {
  const ph = G.time * 1.7 - tx * 0.33 - ty * 0.18;
  const s = Math.sin(ph) * 0.75 + Math.sin(ph * 0.37 + 1.3) * 0.35;
  return clamp(Math.round(s * 1.5 + 2), 0, 4);
}

function renderOverworld(ox, oy) {
  const cam = G.cam;
  const tx0 = Math.floor((cam.x - W / 2) / TILE) - 1, tx1 = Math.ceil((cam.x + W / 2) / TILE) + 1;
  const ty0 = Math.floor((cam.y - H / 2) / TILE) - 1, ty1 = Math.ceil((cam.y + H / 2) / TILE) + 2;
  const gc0 = Math.floor((cam.x - W / 2) / GCH), gc1 = Math.floor((cam.x + W / 2) / GCH);
  const gr0 = Math.floor((cam.y - H / 2) / GCH), gr1 = Math.floor((cam.y + H / 2) / GCH);
  for (let cy = gr0; cy <= gr1; cy++) for (let cx = gc0; cx <= gc1; cx++) ctx.drawImage(groundChunk(cx, cy), cx * GCH + ox, cy * GCH + oy, GCH, GCH);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = tIdx(tx + OX, ty + OY), sx = tx * TILE + ox, sy = ty * TILE + oy;
    if (i < 0) continue;
    const k = TT[i], z = TZ[i];
    if (k === TK.TALL) {
      const nt = (a, b) => { const j = tIdx(a + OX, b + OY); return j < 0 || TT[j] !== TK.TALL; };
      const edge = (nt(tx, ty - 1) ? 1 : 0) | (nt(tx + 1, ty) ? 2 : 0) | (nt(tx, ty + 1) ? 4 : 0) | (nt(tx - 1, ty) ? 8 : 0);
      ctx.drawImage(tallImg(z, TV[i] & 3, windFrame(tx, ty), edge), sx, sy - 10);
      continue;
    }
    if (k === TK.GRASS) { if (hash(tx, ty) < 0.45) ctx.drawImage(tuftImg(z, TV[i] & 3, windFrame(tx, ty)), sx, sy - 4); continue; }
    if (k === TK.FLOWER) { ctx.drawImage(tileImg(k, z, TV[i]), sx, sy); continue; }
    if (!HARDK.has(k) || k === TK.WATERFALL) continue;
    ctx.drawImage(tileImg(k, z, TV[i]), sx, sy);
    if (k === TK.CLIFF) {
      const n = tIdx(tx + OX, ty + OY + 1);
      if (n >= 0 && TT[n] !== TK.CLIFF) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(sx, sy + TILE - 6, TILE, 6); }
    }
  }
  const c0 = Math.floor((cam.x - W / 2) / WCH), c1 = Math.floor((cam.x + W / 2) / WCH);
  const r0 = Math.floor((cam.y - H / 2) / WCH), r1 = Math.floor((cam.y + H / 2) / WCH);
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const im = waterChunk(cx, cy);
    if (im) ctx.drawImage(im, cx * WCH + ox, cy * WCH + oy, WCH, WCH);
  }
  drawAnimTiles(ox, oy, tx0, tx1, ty0, ty1);
  // círculo seguro da vila
  ctx.strokeStyle = 'rgba(255,240,190,.5)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]);
  ctx.beginPath(); ctx.arc(ox, oy, VILA_R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,240,190,.05)'; ctx.beginPath(); ctx.arc(ox, oy, VILA_R, 0, 7); ctx.fill();
  // fogueira no centro da vila
  if (Math.abs(cam.x) < W && Math.abs(cam.y) < H) {
    ctx.fillStyle = '#6b5a48'; ctx.beginPath(); ctx.arc(ox, oy, 30, 0, 7); ctx.fill();
    const fl = 1 + Math.sin(G.time * 12) * 0.12;
    ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(ox, oy - 2, 15 * fl, 0, 7); ctx.fill();
    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(ox, oy, 7 * fl, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,100,.08)'; ctx.beginPath(); ctx.arc(ox, oy, 110, 0, 7); ctx.fill();
  }
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = tIdx(tx + OX, ty + OY);
    if (i < 0 || !OBJK[TT[i]]) continue;
    ctx.drawImage(tileImg(TT[i], TZ[i], TV[i]), tx * TILE + ox, ty * TILE + oy - 12);
  }
  drawChests(ox, oy);
  drawLandmarks(ox, oy);
}

/* ---------- Água (campo contínuo desenhado em pedaços de 256px, pixels de 4px) ---------- */
const WCH = 256, WRES = 4, WCACHE = new Map();
const WPAL = {
  sea: { d: [36, 88, 168], d2: [27, 70, 140], s: [92, 172, 228] },
  lake: { d: [47, 116, 192], d2: [36, 96, 166], s: [110, 192, 238] },
  swamp: { d: [58, 40, 96], d2: [44, 30, 76], s: [124, 96, 176] },
};
function waterPal(x, y) {
  const k = tileKind(x, y);
  if (k === TK.SEA || k === TK.SAND) return WPAL.sea;
  return zoneAt(x, y) === 4 ? WPAL.swamp : WPAL.lake;
}
function waterChunk(cx, cy) {
  const key = cx + ',' + cy;
  if (WCACHE.has(key)) return WCACHE.get(key);
  const x0 = cx * WCH, y0 = cy * WCH, n = WCH / WRES;
  let any = false;
  for (let ty = Math.floor(y0 / TILE) - 1; ty <= Math.floor((y0 + WCH) / TILE) + 1 && !any; ty++)
    for (let tx = Math.floor(x0 / TILE) - 1; tx <= Math.floor((x0 + WCH) / TILE) + 1; tx++) {
      const j = tIdx(tx + OX, ty + OY);
      if (j < 0 || WET[j] > 0) { any = true; break; }
    }
  if (!any) { WCACHE.set(key, null); return null; }
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), D = img.data;
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    const wx = x0 + (px + 0.5) * WRES, wy = y0 + (py + 0.5) * WRES;
    const v = wetAt(wx, wy);
    if (v <= SHALLOW_T || tileKind(wx, wy) === TK.BRIDGE) continue;
    const P = waterPal(wx, wy), o = (py * n + px) * 4;
    let col, a;
    if (v > DEEP_T + 0.05) { col = v > 0.93 ? P.d2 : P.d; a = 255; if (hash(px + cx * 977, py + cy * 613) > 0.994) { col = [220, 238, 255]; a = 200; } }
    else if (v > DEEP_T) { col = P.d.map((q, i) => (q + P.s[i]) >> 1); a = 255; }
    else if (v < SHALLOW_T + 0.045) { col = [235, 246, 255]; a = 175; }
    else { col = P.s; a = 150; }
    D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = a;
  }
  g.putImageData(img, 0, 0);
  WCACHE.set(key, c);
  return c;
}
const waterImg = p => variantImg(p, 'imgU', (x, im, c) => {
  x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.55; x.fillStyle = '#1e5fa8'; x.fillRect(0, 0, c.width, c.height);
});
// desenha um Pokémon: na água ele afunda e a parte de baixo fica submersa; voadores pairam com a sombra na água
function drawMon(img, p, x, y, w, h, face, t, moving, wx, wy, flyer, alpha) {
  const foot = wy + h * 0.35, water = wx < DG_BASE - 5000 && isWater(wx, foot);
  const deep = water && isDeep(wx, foot), sub = water && !flyer ? (deep ? 0.42 : 0.16) : 0;
  let hop = sub ? Math.sin(t * 2.2) * 2 : moving ? Math.abs(Math.sin(t * 9)) * 5 : Math.sin(t * 2) * 1;
  if (flyer && water) hop = 10 + Math.sin(t * 3) * 3;
  if (!sub) {
    ctx.fillStyle = water ? 'rgba(0,25,60,.35)' : 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(x, y + h * 0.42 + (flyer && water ? 8 : 0), w * (flyer && water ? 0.24 : 0.32), h * 0.1, 0, 0, 7); ctx.fill();
  }
  if (!img) return;
  const yl = h / 2 - h * sub; // linha d'água (coordenada local)
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y - hop + h * sub * 0.55);
  if (sub) { ctx.save(); ctx.beginPath(); ctx.rect(-w, -h * 2, w * 2, h * 2 + yl); ctx.clip(); }
  ctx.save(); if (face > 0) ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
  if (sub) {
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-w, yl, w * 2, h); ctx.clip();
    ctx.globalAlpha = alpha * 0.3; if (face > 0) ctx.scale(-1, 1);
    ctx.drawImage(waterImg(p) || img, -w / 2, -h / 2, w, h);
    ctx.restore();
    const k = (t * 1.1) % 1;
    ctx.globalAlpha = 0.85 * alpha; ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, yl, w * 0.42, Math.max(3, h * 0.07), 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.6 * (1 - k) * alpha; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, yl, w * (0.46 + k * 0.35), Math.max(4, h * (0.08 + k * 0.06)), 0, 0, 7); ctx.stroke();
    if (moving && Math.random() < 0.3) G.parts.push({ x: wx + rand(-w * 0.4, w * 0.4), y: wy + yl - hop, vx: 0, vy: -10, life: 0.4, color: '#e0f2fe', size: 2 });
  }
  ctx.restore();
}
// marolinha em volta de quem está na água (e os aquáticos ficam meio submersos)
function waterOver(wx, wy, sx, sy, w) {
  if (!isWater(wx, wy)) return;
  const deep = isDeep(wx, wy), P = waterPal(wx, wy), c = deep ? P.d : P.s;
  ctx.globalAlpha = deep ? 0.9 : 0.6;
  ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
  ctx.beginPath(); ctx.ellipse(sx, sy, w * 0.55, w * 0.2, 0, 0, 7); ctx.fill();
  const k = (G.time * 1.2 + wx * 0.01) % 1;
  ctx.globalAlpha = 0.7 * (1 - k); ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(sx, sy, w * (0.5 + k * 0.35), w * (0.18 + k * 0.12), 0, 0, 7); ctx.stroke();
  ctx.globalAlpha = 1;
}

// mato alto cobre a parte de baixo de quem está nele (como nos jogos)
function grassOver(wx, wy, sx, sy, w) {
  if (wx > DG_BASE - 5000 || tileKind(wx, wy) !== TK.TALL) return;
  const z = Math.max(0, zoneAt(wx, wy)), [dk, lt] = TALLC[z] || TALLC[1];
  const n = Math.max(3, Math.round(w / 7));
  for (let k = 0; k < n; k++) {
    const x = sx - w / 2 + k * (w / n) + ((k * 3) % 4) - 2;
    ctx.fillStyle = dk; ctx.fillRect(x, sy - 6, 7, 8);
    ctx.fillStyle = lt; ctx.fillRect(x + 1, sy - 10, 1, 8); ctx.fillRect(x + 3, sy - 12, 1, 10); ctx.fillRect(x + 5, sy - 9, 1, 7);
  }
}

function drawBuilding(b, ox, oy) {
  const x = b.x - b.w / 2 + ox, y = b.y - b.h / 2 + oy, w = b.w, h = b.h, wallH = h * 0.48;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 4, y + h - 2, w, 6);
  ctx.fillStyle = b.wall; ctx.fillRect(x + 4, y + h - wallH, w - 8, wallH);
  ctx.fillStyle = shade('#f5efe0', 0.8); ctx.fillRect(x + 4, y + h - 4, w - 8, 4);
  // telhado
  ctx.fillStyle = shade(b.roof, 0.75); ctx.fillRect(x, y + h - wallH - 6, w, 8);
  ctx.fillStyle = b.roof; ctx.fillRect(x, y, w, h - wallH - 4);
  ctx.fillStyle = shade(b.roof, 1.2);
  for (let k = 6; k < h - wallH - 6; k += 8) ctx.fillRect(x + 2, y + k, w - 4, 2);
  if (b.chimney) { ctx.fillStyle = '#57534e'; ctx.fillRect(x + w - 26, y - 12, 12, 16); if (Math.random() < 0.15) G.parts.push({ x: b.x + b.w / 2 - 20, y: b.y - b.h / 2 - 14, vx: rand(-5, 5), vy: -30, life: 1.4, color: '#a8a29e', size: 5 }); }
  // porta e janelas
  ctx.fillStyle = '#5b3a1e'; ctx.fillRect(x + w / 2 - 9, y + h - 24, 18, 22);
  ctx.fillStyle = '#facc15'; ctx.fillRect(x + w / 2 + 4, y + h - 14, 2, 2);
  ctx.fillStyle = '#93c5fd';
  ctx.fillRect(x + 14, y + h - wallH + 8, 16, 12); ctx.fillRect(x + w - 30, y + h - wallH + 8, 16, 12);
  ctx.fillStyle = '#fff'; ctx.fillRect(x + 14, y + h - wallH + 8, 6, 4); ctx.fillRect(x + w - 30, y + h - wallH + 8, 6, 4);
  ctx.font = '18px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center';
  ctx.fillText(b.sign, x + w / 2, y + (h - wallH) / 2 + 6);
}
