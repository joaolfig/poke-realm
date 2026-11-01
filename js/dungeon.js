'use strict';
/* ============ Masmorras ============
 * Ficam no mesmo sistema de coordenadas do mundo, bem longe do mapa principal
 * (x >= DG_BASE). O layout é gerado por semente, então host e clientes geram
 * a mesma masmorra recebendo só [id, tema, semente, zona].
 */
const DG_BASE = 100000, DG_SPACING = 30000, DG_W = 200, DG_H = 70;

function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inDungeonArea = x => x > DG_BASE - 5000;
function dungeonAt(x) {
  if (!G || x < DG_BASE - 5000) return null;
  return G.dungeons.get(Math.floor((x - DG_BASE + 10000) / DG_SPACING)) || null;
}

// Ginásios (e o confronto final): a etapa da história (1-9) define o tamanho e a dificuldade
const gymStage = theme => (THEMES[theme] && THEMES[theme].story) || 0;
const gymFights = gs => clamp(2 + Math.floor((gs - 1) / 2), 2, 5); // salas antes do líder: 2 no 1º, 5 no 8º e no final
// plano das salas (só o host): algumas com chefes do time do líder, outras com bandos do ginásio, ordem sorteada
function gymPlan(gs) {
  const n = gymFights(gs), bosses = clamp(1 + Math.floor(gs / 3), 1, n - 1);
  const plan = [...Array(bosses).fill('chefe'), ...Array(n - bosses).fill(0).map(() => (Math.random() < 0.35 ? 'misto' : 'bando'))];
  return plan.sort(() => Math.random() - 0.5);
}
// Pokémon do time do líder como chefe de sala: forte, mas abaixo do Pokémon principal do líder
function gymMini(e, gs) {
  const s = STORY[gs];
  e.mini = gs; e.boss = true;
  e.name = `${s ? s.nome : 'Líder'} (${e.p.name})`;
  e.maxHp = Math.round(e.maxHp * (1.8 + 0.12 * gs));
  // nunca mais forte que o Pokémon principal do líder (no máximo 70% da vida dele)
  const th = THEMES[gs === 9 ? 'final' : 'gym' + gs];
  if (th && POKE[th.boss]) e.maxHp = Math.min(e.maxHp, Math.round(enemyStats(th.boss, e.zone, 3).maxHp * 1.2 * 0.7));
  e.hp = e.maxHp;
  e.scale *= 1.2; e.w *= 1.2; e.h *= 1.2; e.r *= 1.2;
  e.speed *= 0.85;
  e.cdBoss = Math.max(1.1, 1.75 - gs * 0.07);
}
const pick2 = (R, a) => a[Math.floor(R() * a.length)];
// formatos de sala (tiram pedaços do retângulo)
function shapeRoom(grid, x, y, w, h, shape) {
  const off = (i, j) => { if (i > 0 && j > 0 && i < DG_W - 1 && j < DG_H - 1) grid[j * DG_W + i] = 0; };
  if (shape === 'oval') { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (((i + 0.5 - x - w / 2) / (w / 2)) ** 2 + ((j + 0.5 - y - h / 2) / (h / 2)) ** 2 > 1) off(i, j); }
  else if (shape === 'cruz') { const cw = Math.floor(w / 3.2), ch = Math.floor(h / 3.2); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if ((i < x + cw || i >= x + w - cw) && (j < y + ch || j >= y + h - ch)) off(i, j); }
  else if (shape === 'poco') { const pw = Math.max(2, Math.floor(w / 5)), ph = Math.max(2, Math.floor(h / 5)), px = x + Math.floor(w / 2 - pw / 2), py = y + Math.floor(h / 2 - ph / 2) - ph - 1; for (let j = py; j < py + ph; j++) for (let i = px; i < px + pw; i++) off(i, j); for (let j = py + 2 * ph + 2; j < py + 3 * ph + 2; j++) for (let i = px; i < px + pw; i++) off(i, j); }
}
// terreno perigoso conforme o tema: lava queima, ácido envenena, gelo e espinhos só machucam
const DG_HAZARD = { fire: 'lava', ghost: 'acido', ice: 'gelo', water: 'acido', psychic: 'espinhos', electric: 'espinhos', mine: 'espinhos', grass: 'acido', dragon: 'lava' };
const HAZ = {
  lava: { c1: '#9a3412', c2: '#f97316', st: 3, nome: 'lava' }, acido: { c1: '#3f6212', c2: '#a3e635', st: 4, nome: 'ácido' },
  gelo: { c1: '#155e75', c2: '#a5f3fc', st: 0, nome: 'gelo cortante' }, espinhos: { c1: '#44403c', c2: '#d6d3d1', st: 0, nome: 'espinhos' },
};
const TOWER_MODS = {
  rapidos: '💨 Rápidos', alfas: '👑 Só Alfas', tipo: '🎯 Um tipo só', enxame: '🐝 Enxame', semcura: '🩸 Sem regeneração',
  escuro: '🌑 Escuro', explosivos: '💥 Explodem ao morrer', chuva: '🌧 Chuva', areia: '🌪 Areia',
};
// força dos inimigos da torre: +8% por andar acima do 1º (vida e dano)
function towerScale(e, f) {
  if (!f || f <= 1) return;
  const k = Math.pow(1.08, f - 1);
  e.maxHp = Math.round(e.maxHp * k); e.hp = e.maxHp;
  e.atk += Math.floor(f / 3);
  e.dice = [e.dice[0], e.dice[1], e.dice[2] + Math.floor(f * 0.8)];
}
const DG_MODS = {
  escuro: '🌑 Escura: sem Flash você mal enxerga', frenesi: '💢 Frenesi: os Pokémon são mais rápidos e atacam mais',
  infestada: '🐛 Infestada: o dobro de Pokémon nas salas', rica: '💰 Rica: salas de tesouro extras',
};
function genDungeon(id, theme, seed, zone, floor = 0) {
  const R = mulberry32(seed), grid = new Uint8Array(DG_W * DG_H), rooms = [];
  const carve = (x, y, w, h) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i > 0 && j > 0 && i < DG_W - 1 && j < DG_H - 1) grid[j * DG_W + i] = 1;
  };
  let cx = 3;
  const gs = gymStage(theme), kinds = floor ? ['start', floor % 5 ? 'fight' : 'boss'] : ['start', ...Array(gs ? gymFights(gs) : 2 + Math.floor(R() * 3)).fill('fight'), 'boss'];
  // modificador da masmorra comum (sai da semente: igual para todos)
  const mod = !gs && !floor && zone >= 2 && R() < 0.6 ? pick2(R, ['escuro', 'frenesi', 'infestada', 'rica']) : '';
  // torre: 1 modificador por andar (2 a partir do 15)
  const mods = [];
  if (floor) { const all = Object.keys(TOWER_MODS); while (mods.length < (floor >= 15 ? 2 : 1)) { const m = pick2(R, all); if (!mods.includes(m)) mods.push(m); } }
  const hz = DG_HAZARD[theme] || 'espinhos';
  for (const kind of kinds) {
    const w = kind === 'start' ? 10 : floor ? 30 : kind === 'boss' ? 24 : gs ? 16 + Math.floor(R() * 4) : 14 + Math.floor(R() * 6);
    const h = kind === 'start' ? 10 : floor ? 24 : kind === 'boss' ? 22 : gs ? 15 + Math.floor(R() * 5) : 12 + Math.floor(R() * 6);
    const y = clamp(Math.floor(DG_H / 2 - h / 2 + (R() - 0.5) * 16), 2, DG_H - h - 2);
    const shape = kind === 'fight' ? pick2(R, ['ret', 'ret', 'oval', 'cruz', 'poco']) : kind === 'boss' ? pick2(R, ['ret', 'oval']) : 'ret';
    rooms.push({ x: cx, y, w, h, kind, state: 0, shape });
    carve(cx, y, w, h);
    shapeRoom(grid, cx, y, w, h, shape);
    cx += w + (gs ? 6 + Math.floor(R() * 3) : 6 + Math.floor(R() * 5));
  }
  // corredores em L entre salas consecutivas
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i], b = rooms[i + 1];
    const ax = (a.x + a.w / 2) | 0, ay = (a.y + a.h / 2) | 0, bx = (b.x + b.w / 2) | 0, by = (b.y + b.h / 2) | 0;
    carve(Math.min(ax, bx), ay - 2, Math.abs(bx - ax) + 1, 4);
    carve(bx - 2, Math.min(ay, by) - 2, 4, Math.abs(by - ay) + 4);
  }
  // salas de tesouro: ramos acima ou abaixo de algumas salas de luta, com um baú
  const side = [], chests = [];
  const fights = rooms.filter(r => r.kind === 'fight');
  const nSide = gs || floor ? 0 : (mod === 'rica' ? 2 : R() < 0.6 ? 1 : 0);
  for (let k = 0; k < nSide && fights.length; k++) {
    const r = fights[Math.floor(R() * fights.length)], up = R() < 0.5;
    const w = 9, h = 7, sx = (r.x + r.w / 2 - w / 2) | 0, sy = up ? r.y - h - 6 : r.y + r.h + 6;
    if (sy < 2 || sy + h > DG_H - 2 || side.some(s => s.x === sx)) continue;
    side.push({ x: sx, y: sy, w, h, kind: 'tesouro', state: 0 });
    carve(sx, sy, w, h);
    const mx = (r.x + r.w / 2) | 0;
    carve(mx - 1, up ? sy + h : r.y + r.h - 1, 3, 7);
    chests.push({ x: DG_BASE + id * DG_SPACING + (sx + w / 2) * TILE, y: (sy + h / 2) * TILE, i: chests.length });
  }
  // terreno perigoso nas salas de luta das masmorras comuns
  if (!gs && !floor) for (const r of fights) {
    if (R() < 0.45) continue;
    for (let k = 0; k < 2 + Math.floor(R() * 3); k++) {
      const px = r.x + 2 + Math.floor(R() * (r.w - 6)), py = r.y + 2 + Math.floor(R() * (r.h - 6)), pw = 2 + Math.floor(R() * 3), ph = 2 + Math.floor(R() * 2);
      for (let j = py; j < py + ph; j++) for (let i = px; i < px + pw; i++) if (grid[j * DG_W + i] === 1) grid[j * DG_W + i] = 2;
    }
  }
  // pilares para se proteger dos tiros
  for (const r of rooms) {
    if (r.kind === 'start') continue;
    const n = r.kind === 'boss' ? 4 : 1 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const px = r.x + 3 + Math.floor(R() * (r.w - 8)), py = r.y + 3 + Math.floor(R() * (r.h - 8));
      if (Math.abs(px - (r.x + r.w / 2)) < 3 && Math.abs(py - (r.y + r.h / 2)) < 3) continue;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) grid[(py + j) * DG_W + px + i] = 0;
    }
  }
  // enigma: uma sala de luta tem a saída selada; placas de pressão ou runas em ordem abrem a porta e revelam um baú
  let pz = null;
  if (!gs && !floor && fights.length && R() < 0.65) {
    const r = fights[Math.floor(R() * fights.length)], kind = R() < 0.5 ? 'placas' : 'runas', n = kind === 'placas' ? 3 : 4;
    const ay = (r.y + r.h / 2) | 0, door = [];
    for (let i = r.x + r.w; i <= r.x + r.w + 1; i++) for (let j = ay - 3; j <= ay + 2; j++) if (grid[j * DG_W + i] === 1) { grid[j * DG_W + i] = 3; door.push(j * DG_W + i); }
    const pts = [];
    for (let k = 0; k < 200 && pts.length < n; k++) {
      const tx = r.x + 2 + Math.floor(R() * (r.w - 4)), ty = r.y + 2 + Math.floor(R() * (r.h - 4));
      if (grid[ty * DG_W + tx] !== 1 || pts.some(p => Math.abs(p[0] - tx) + Math.abs(p[1] - ty) < 5)) continue;
      pts.push([tx, ty]);
    }
    if (door.length && pts.length === n) {
      const order = pts.map((_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      pz = { kind, room: rooms.indexOf(r), door, order, lit: [], step: 0, done: false, showT: -1, pts: pts.map(([tx, ty]) => ({ x: DG_BASE + id * DG_SPACING + (tx + 0.5) * TILE, y: (ty + 0.5) * TILE })) };
      chests.push({ x: DG_BASE + id * DG_SPACING + (r.x + r.w / 2) * TILE, y: (r.y + r.h / 2) * TILE, i: chests.length, pz: 1 });
    } else for (const c of door) grid[c] = 1;
  }
  return { id, theme, seed, zone, grid, rooms, side, chests, mod, hz, floor, mods, pz, wx: mods.includes('chuva') ? 'chuva' : mods.includes('areia') ? 'areia' : '', ox: DG_BASE + id * DG_SPACING, oy: 0, done: false, doneT: 0, emptyT: 0, ent: { x: 0, y: 0 }, bossId: 0, mini: null };
}

function walkable(x, y) {
  if (x < DG_BASE - 5000) return true;
  const dg = dungeonAt(x);
  if (!dg) return false;
  const tx = Math.floor((x - dg.ox) / TILE), ty = Math.floor((y - dg.oy) / TILE);
  if (tx < 0 || ty < 0 || tx >= DG_W || ty >= DG_H) return false;
  const g = dg.grid[ty * DG_W + tx];
  return g >= 1 && g !== 3; // 3 = porta selada do enigma
}
// tipo de terreno perigoso sob o ponto (ou null)
function hazardAt(x, y) {
  const dg = dungeonAt(x);
  if (!dg) return null;
  const tx = Math.floor((x - dg.ox) / TILE), ty = Math.floor((y - dg.oy) / TILE);
  return dg.grid[ty * DG_W + tx] === 2 ? HAZ[dg.hz] : null;
}
const walkableR = (x, y, r) => walkable(x - r, y - r) && walkable(x + r, y - r) && walkable(x - r, y + r) && walkable(x + r, y + r);
function inRoom(dg, r, x, y) {
  const tx = (x - dg.ox) / TILE, ty = (y - dg.oy) / TILE;
  return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
}
const roomCenter = (dg, r) => ({ x: dg.ox + (r.x + r.w / 2) * TILE, y: dg.oy + (r.y + r.h / 2) * TILE });
function roomPos(dg, r) {
  for (let k = 0; k < 30; k++) {
    const x = dg.ox + (r.x + 2 + Math.random() * (r.w - 4)) * TILE, y = dg.oy + (r.y + 2 + Math.random() * (r.h - 4)) * TILE;
    if (walkableR(x, y, 16)) return { x, y };
  }
  return roomCenter(dg, r);
}

/* ---------- Lado do host ---------- */
function createDungeon(x, y, type, zone, o = {}) {
  if (G.dungeons.size >= (o.force ? 6 : 3)) return null;
  const theme = o.theme || TYPE_THEME[type] || 'grass';
  const id = ++G.dgNext;
  const dg = genDungeon(id, theme, randi(1, 2e9), clamp(Math.max(zone, THEMES[theme].zmin || 1), 1, 5), o.floor || 0);
  dg.ent = { x: Math.round(x), y: Math.round(y) };
  const gs = gymStage(theme);
  if (gs) { dg.plan = gymPlan(gs); dg.used = []; }
  G.dungeons.set(id, dg);
  G.portals.push({ id: ++G.poNext, x: Math.round(x), y: Math.round(y), theme, ttl: o.ttl || 60, dg: id, exit: 0 });
  if (!o.quiet) emitEvent({ t: 'toast', text: `🌀 Um portal para ${THEMES[theme].nome} se abriu! (60s)`, color: THEMES[theme].accent });
  return dg;
}

function spawnRoom(dg, r) {
  const th = THEMES[dg.theme];
  const pool = th.pool.filter(id => POKE[id]);
  const fallback = ZONE_POOLS[clamp(dg.zone, 1, 5)];
  if (dg.floor) return towerRoom(dg, r, pool.length ? pool : fallback);
  if (r.kind === 'tesouro') {
    // às vezes um Alfa guarda o baú
    if (Math.random() < 0.5) { const c = roomCenter(dg, r); const e = hostSpawn(pick(pool.length ? pool : fallback), dg.zone, 1, c.x, c.y - 40); e.dg = dg.id; e.cd = rand(1, 2); }
    return;
  }
  if (r.kind === 'boss') {
    const c = roomCenter(dg, r);
    const b = hostSpawn(POKE[th.boss] ? th.boss : pick(fallback), dg.zone, 3, c.x + 120, c.y);
    b.dg = dg.id; dg.bossId = b.id;
    b.maxHp = Math.round(b.maxHp * 1.2); b.hp = b.maxHp; // reforço de masmorra
    if (th.story) storyMod(b, th.story);
    for (let i = 0; i < 2 + Math.floor(dg.zone / 2); i++) {
      const p = roomPos(dg, r);
      hostSpawn(pick(pool.length ? pool : fallback), dg.zone, 0, p.x, p.y).dg = dg.id;
    }
    emitEvent({ t: 'toast', text: `⚔ ${b.name} guarda o fim de ${th.nome}!`, color: th.accent, big: 1 });
  } else if (dg.plan) {
    // sala de ginásio: chefes do time do líder, bandos do ginásio ou os dois
    const gs = gymStage(dg.theme), idx = dg.rooms.filter(x => x.kind === 'fight').indexOf(r), kind = dg.plan[idx] || 'bando';
    const team = pool.filter(id => id !== th.boss), src = team.length ? team : pool.length ? pool : fallback;
    const nextMini = () => { let opts = src.filter(id => !dg.used.includes(id)); if (!opts.length) { dg.used = []; opts = src; } const id = pick(opts); dg.used.push(id); return id; };
    const nB = kind === 'chefe' ? (gs >= 5 && Math.random() < 0.5 ? 2 : 1) : kind === 'misto' ? 1 : 0;
    const c = roomCenter(dg, r);
    for (let i = 0; i < nB; i++) {
      const b = hostSpawn(nextMini(), dg.zone, 1, c.x + (nB > 1 ? (i ? 110 : -110) : 0), c.y - 40);
      b.dg = dg.id; gymMini(b, gs); b.cd = rand(1.5, 2.5);
    }
    const nM = kind === 'bando' ? 3 + dg.zone + Math.floor(gs / 3) : kind === 'misto' ? 2 + Math.floor(gs / 3) : randi(0, 2);
    for (let i = 0; i < nM; i++) {
      const p = roomPos(dg, r);
      const e = hostSpawn(pick(src), dg.zone, 0, p.x, p.y);
      e.dg = dg.id; e.maxHp = Math.round(e.maxHp * 1.3); e.hp = e.maxHp; e.cd = rand(1.5, 2.8);
    }
    if (nB) emitEvent({ t: 'toast', text: `⚔ Pokémon de ${STORY[gs] ? STORY[gs].nome : 'o líder'} bloqueiam o caminho!`, color: th.accent });
  } else {
    // variantes de sala: bando, elite (Alfa + poucos), enxame (muitos e fracos) ou emboscada (chegam em ondas)
    const v = pick(['bando', 'bando', 'elite', 'enxame', 'emboscada']);
    const src = pool.length ? pool : fallback, inf = dg.mod === 'infestada' ? 2 : 1;
    const wave = (n, alfa, hpK) => {
      for (let i = 0; i < n; i++) {
        const p = roomPos(dg, r);
        const e = hostSpawn(pick(src), dg.zone, alfa && i === 0 ? 1 : Math.random() < 0.04 ? 1 : 0, p.x, p.y);
        e.dg = dg.id;
        e.maxHp = Math.round(e.maxHp * 1.3 * hpK); e.hp = e.maxHp; // reforço de masmorra
        e.cd = rand(1.5, 2.8); // tempo para o grupo reagir ao entrar na sala
        if (dg.mod === 'frenesi') { e.speed *= 1.25; e.cdBoss = 0.8; }
      }
    };
    const base = 3 + dg.zone + randi(0, 1);
    if (v === 'elite') wave((2 + Math.floor(dg.zone / 2)) * inf, true, 1);
    else if (v === 'enxame') wave(Math.round(base * 1.7) * inf, false, 0.55);
    else if (v === 'emboscada') { wave(Math.ceil(base / 2) * inf, false, 1); setTimeout(() => { if (G.dungeons.get(dg.id)) { wave(Math.ceil(base / 2) * inf, false, 1); emitEvent({ t: 'toast', text: '⚠ Emboscada! Mais Pokémon chegaram!', color: '#fca5a5' }); } }, 2500); }
    else wave(base * inf, false, 1);
  }
}

function closeDungeon(dg) {
  G.enemies = G.enemies.filter(e => { if (e.dg === dg.id) { G.emap.delete(e.id); return false; } return true; });
  G.portals = G.portals.filter(p => p.dg !== dg.id && dungeonAt(p.x) !== dg); // inclui a escada que estava dentro dela
  G.dungeons.delete(dg.id);
}

function hostDungeons(dt) {
  for (const p of G.portals) p.ttl -= dt;
  G.portals = G.portals.filter(p => p.ttl > 0);
  G.dgT -= dt;
  if (G.dgT > 0) return;
  G.dgT = 0.25;
  const pls = allPlayers();
  for (const dg of [...G.dungeons.values()]) {
    const inside = pls.filter(p => dungeonAt(p.x) === dg);
    for (const r of dg.rooms.concat(dg.side || [])) {
      if (r.state || r.kind === 'start') continue;
      if (inside.some(p => inRoom(dg, r, p.x, p.y))) { r.state = 1; spawnRoom(dg, r); }
    }
    if (dg.floor && !dg.cleared && dg.rooms.every(r => r.kind === 'start' || r.state) && !G.enemies.some(e => e.dg === dg.id && e.hp > 0 && !e.dead)) towerCleared(dg);
    dg.emptyT = inside.length ? 0 : dg.emptyT + 0.25;
    const entOpen = G.portals.some(p => p.dg === dg.id && !p.exit);
    if ((dg.emptyT > 15 && !entOpen) || (dg.done && G.time - dg.doneT > 120)) closeDungeon(dg);
  }
}

// chamado pelo host quando um inimigo morre
function hostOnKill(e) {
  const tdg = e.dg && G.dungeons.get(e.dg);
  if (tdg && tdg.mods && tdg.mods.includes('explosivos')) for (let k = 0; k < 8; k++) eShot(e, k * Math.PI / 4, 170);
  if (e.kind === 3 && e.dg) {
    const dg = G.dungeons.get(e.dg);
    if (dg && !dg.done) {
      dg.done = true; dg.doneT = G.time;
      const c = roomCenter(dg, dg.rooms[dg.rooms.length - 1]);
      G.portals.push({ id: ++G.poNext, x: Math.round(c.x), y: Math.round(c.y), theme: dg.theme, ttl: 120, dg: dg.id, exit: 1 });
      emitEvent({ t: 'toast', text: `🏆 ${THEMES[dg.theme].nome} concluída! Um portal de saída surgiu.`, color: '#facc15', big: 1 });
    }
  } else if (!e.dg && !inDungeonArea(e.x) && (e.kind === 1 || (e.kind === 0 && Math.random() < 0.008))) {
    createDungeon(e.x, e.y, e.type, e.zone);
  }
}

/* ---------- Rede ---------- */
const dungeonsToNet = () => [...G.dungeons.values()].map(d => [d.id, d.theme, d.seed, d.zone, d.done ? 1 : 0, d.ent.x, d.ent.y, d.floor || 0, d.pz && d.pz.done ? 1 : 0]);
const portalsToNet = () => G.portals.map(p => [p.id, p.x, p.y, p.theme, Math.round(p.ttl), p.dg, p.exit]);
function dungeonsFromNet(dgs, pos) {
  const seen = new Set();
  for (const a of dgs || []) {
    seen.add(a[0]);
    let dg = G.dungeons.get(a[0]);
    if (!dg) { dg = genDungeon(a[0], a[1], a[2], a[3], a[7] || 0); G.dungeons.set(a[0], dg); }
    dg.done = !!a[4]; dg.ent = { x: a[5], y: a[6] };
    if (a[8] && dg.pz && !dg.pz.done) pzOpen(dg, true);
  }
  for (const id of [...G.dungeons.keys()]) if (!seen.has(id)) G.dungeons.delete(id);
  G.portals = (pos || []).map(a => ({ id: a[0], x: a[1], y: a[2], theme: a[3], ttl: a[4], dg: a[5], exit: a[6] }));
}

/* ---------- Jogador ---------- */
function nearPortal(P) {
  let best = null, bd = 46;
  for (const p of G.portals) { const dd = Math.hypot(p.x - P.x, p.y - P.y); if (dd < bd) { bd = dd; best = p; } }
  return best;
}
function usePortal(P, p) {
  const dg = G.dungeons.get(p.dg);
  if (!dg) return;
  burst(P.x, P.y, THEMES[p.theme].accent, 24);
  if (p.exit) { P.x = dg.ent.x + rand(-40, 40); P.y = dg.ent.y + rand(-40, 40); }
  else { const c = roomCenter(dg, dg.rooms[0]); P.x = c.x + rand(-30, 30); P.y = c.y + rand(-30, 30); if (dg.mod) G.toasts.push({ text: `🌀 ${THEMES[dg.theme].nome} · ${DG_MODS[dg.mod]}`, color: THEMES[dg.theme].accent, t: 5, big: 1 }); if (dg.floor) towerEnter(P, dg); }
  G.cam.x = P.x; G.cam.y = P.y;
  burst(P.x, P.y, THEMES[p.theme].accent, 24);
  sfx('pot');
}

/* ---------- Desenho ---------- */
function renderDungeonFloor(dg, ox, oy) {
  const th = THEMES[dg.theme];
  ctx.fillStyle = th.wall;
  ctx.fillRect(0, 0, W, H);
  const cam = G.cam;
  const tx0 = Math.max(0, Math.floor((cam.x - W / 2 - dg.ox) / TILE) - 1), tx1 = Math.min(DG_W - 1, Math.ceil((cam.x + W / 2 - dg.ox) / TILE) + 1);
  const ty0 = Math.max(0, Math.floor((cam.y - H / 2 - dg.oy) / TILE) - 1), ty1 = Math.min(DG_H - 1, Math.ceil((cam.y + H / 2 - dg.oy) / TILE) + 1);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const sx = dg.ox + tx * TILE + ox, sy = dg.oy + ty * TILE + oy;
    const g = dg.grid[ty * DG_W + tx];
    if (g === 2) {
      const z = HAZ[dg.hz], k = 0.5 + 0.5 * Math.sin(G.time * 3 + tx * 0.7 + ty * 1.3);
      ctx.fillStyle = z.c1; ctx.fillRect(sx, sy, TILE, TILE);
      ctx.globalAlpha = 0.35 + 0.35 * k; ctx.fillStyle = z.c2; ctx.fillRect(sx + 4, sy + 4, TILE - 8, TILE - 8); ctx.globalAlpha = 1;
    } else if (g === 1) {
      const h = hash(tx + dg.id * 991, ty);
      ctx.fillStyle = th.floor[h < 0.5 ? 0 : 1];
      ctx.fillRect(sx, sy, TILE, TILE);
      if (h > 0.97) { ctx.fillStyle = th.accent; ctx.globalAlpha = 0.25; ctx.fillRect(sx + 10, sy + 12, 6, 6); ctx.globalAlpha = 1; }
    } else if (g === 3) {
      // porta selada: grades com brilho do tema
      ctx.fillStyle = '#0b0b10'; ctx.fillRect(sx, sy, TILE, TILE);
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(G.time * 4); ctx.fillStyle = th.accent; ctx.fillRect(sx, sy, TILE, TILE); ctx.globalAlpha = 1;
      ctx.fillStyle = '#9ca3af'; for (let k = 4; k < TILE; k += 9) ctx.fillRect(sx + k, sy, 3, TILE); // grades de ferro
      ctx.fillStyle = '#6b7280'; ctx.fillRect(sx, sy + 6, TILE, 3); ctx.fillRect(sx, sy + TILE - 9, TILE, 3);
    } else if (ty + 1 < DG_H && dg.grid[(ty + 1) * DG_W + tx] >= 1) {
      // face frontal da parede, dá sensação de altura
      ctx.fillStyle = th.top;
      ctx.fillRect(sx, sy + 12, TILE, TILE - 12);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(sx, sy + TILE - 4, TILE, 4);
    }
  }
}

// nível recomendado de uma masmorra: ginásio/final = nível do capítulo; torre = andar; comum = faixa da zona
function dgLevelTxt(dg) {
  if (!dg) return '';
  if (dg.floor) return `Andar ${dg.floor} (Nv 30)`;
  const st = THEMES[dg.theme] && THEMES[dg.theme].story;
  if (st && STORY[st] && STORY[st].lvl) return `Nv ${STORY[st].lvl}+`;
  const z = clamp(dg.zone, 1, 5);
  return `Nv ${ZONE_LVL[z]}–${ZONE_LVL_MAX[z]}`;
}
function drawPortals(ox, oy) {
  for (const p of G.portals) {
    const x = p.x + ox, y = p.y + oy;
    if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue;
    const col = p.exit ? '#facc15' : THEMES[p.theme].accent;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = col; ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 38, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(0, 0, 26 - i * 7, 34 - i * 9, 0, G.time * (2 + i) + i, G.time * (2 + i) + i + 4.2); ctx.stroke();
    }
    ctx.restore();
    ctx.font = 'bold 11px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = col;
    const s = `${p.exit ? 'Saída' : `${THEMES[p.theme].nome} · ${dgLevelTxt(G.dungeons.get(p.dg))}`} · ${Math.ceil(p.ttl)}s`;
    ctx.strokeText(s, x, y - 46); ctx.fillText(s, x, y - 46);
  }
}

function dungeonMinimap(dg) {
  if (!dg.mini) {
    const c = document.createElement('canvas');
    c.width = 160; c.height = Math.ceil(DG_H * 0.8);
    const x = c.getContext('2d');
    x.fillStyle = '#0b0816'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = THEMES[dg.theme].accent;
    for (let ty = 0; ty < DG_H; ty++) for (let tx = 0; tx < DG_W; tx++) if (dg.grid[ty * DG_W + tx]) x.fillRect(tx * 0.8, ty * 0.8, 1, 1);
    dg.mini = c;
  }
  return dg.mini;
}

/* ---------- Baús das salas de tesouro (cada jogador abre o seu) ---------- */
function nearDgChest(P) {
  const dg = dungeonAt(P.x);
  if (!dg || !dg.chests) return null;
  dg.opened = dg.opened || new Set();
  return dg.chests.find(c => !dg.opened.has(c.i) && !(c.pz && !(dg.pz && dg.pz.done)) && Math.hypot(c.x - P.x, c.y - P.y) < 50) || null;
}
function openDgChest(P, c) {
  const dg = dungeonAt(P.x);
  dg.opened.add(c.i);
  const items = [genItem(clamp(dg.zone + randi(0, 2), 0, 6)), potion()];
  if (Math.random() < 0.5) items.push(ballItem());
  if (dg.zone >= 3 && Math.random() < 0.25) items.push(statPot());
  if (c.pz) items.push(stone(pick(TYPES)), Math.random() < 0.5 ? statPot() : genItem(clamp(dg.zone + 2, 0, 6))); // prêmio do enigma
  G.bags.push({ x: c.x, y: c.y + 30, items, life: 120 });
  burst(c.x, c.y, '#facc15', 30);
  G.toasts.push({ text: '💰 Baú aberto!', color: '#facc15', t: 2.5 });
  sfx('lvl');
}
function drawDgChests(ox, oy) {
  const P = G.P, dg = P && dungeonAt(P.x);
  if (!dg || !dg.chests) return;
  dg.opened = dg.opened || new Set();
  for (const c of dg.chests) {
    if (c.pz && !(dg.pz && dg.pz.done)) continue;
    const x = c.x + ox, y = c.y + oy, open = dg.opened.has(c.i);
    if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 15, y + 9, 30, 5);
    ctx.fillStyle = '#7c4a1e'; ctx.fillRect(x - 14, y - 6, 28, 16);
    ctx.fillStyle = open ? '#3a2410' : '#a0642a'; ctx.fillRect(x - 14, y - (open ? 16 : 12), 28, open ? 6 : 8);
    ctx.fillStyle = '#facc15'; ctx.fillRect(x - 3, y - 4, 6, 6);
    if (!open && Math.random() < 0.08) G.parts.push({ x: c.x + rand(-12, 12), y: c.y - 10, vx: 0, vy: -25, life: 0.6, color: '#fde047', size: 2 });
  }
}
// terreno perigoso: machuca quem pisa (e lava/ácido podem causar status)
function hazardTick(dt) {
  const P = G.P;
  if (!P || !inDungeonArea(P.x) || (G.hzT = (G.hzT || 0) - dt) > 0) return;
  const z = hazardAt(P.x, P.y);
  if (!z || P.dodgeT > 0) return;
  G.hzT = 0.5;
  const dmg = Math.max(1, Math.round(maxHP(P) * 0.025));
  P.hp -= dmg; P.sinceHit = 0;
  text(P.x, P.y - 34, `-${dmg} ${z.nome}`, z.c2, 12);
  if (z.st && Math.random() < 0.15) playerStatus(P, z.st);
  if (P.hp <= 0) playerDie(z.nome);
}

/* ============ Torre Infinita (mapa à parte; liberada depois da história) ============
 * Cada andar é uma arena; ao limpar, abre a escada para o próximo. Cada andar é 8% mais forte.
 * A cada 5 andares, um chefe (lendário a partir do 20). Morrer aqui não apaga o personagem.
 */
const towerBest = P => ((P.towerR || {})[REGION_ID] || 0);
const towerCk = P => ((P.towerCk || {})[REGION_ID] || 0);
function towerRoom(dg, r, pool) {
  const f = dg.floor, c = roomCenter(dg, r), mods = dg.mods || [];
  let src = pool;
  if (mods.includes('tipo')) { const t = pick(src.map(id => POKE[id] && POKE[id].types[0]).filter(Boolean)); const f2 = src.filter(id => POKE[id] && POKE[id].types.includes(t)); if (f2.length) src = f2; }
  const tune = (e, boss) => {
    e.dg = dg.id;
    e.maxHp = Math.round(e.maxHp * (boss ? 1.2 : 1.3)); e.hp = e.maxHp; // reforço de masmorra (igual nos clientes)
    towerScale(e, f);
    if (mods.includes('rapidos')) { e.speed *= 1.3; e.cdBoss = 0.85; }
    e.cd = rand(1.5, 2.6);
  };
  if (r.kind === 'boss') {
    const pid = f >= 20 && BOSSES.some(id => POKE[id]) ? pick(BOSSES.filter(id => POKE[id])) : pick(src);
    const b = hostSpawn(pid, 5, 3, c.x, c.y - 40);
    tune(b, true); dg.bossId = b.id;
    emitEvent({ t: 'toast', text: `🗼 Andar ${f}: ${b.p.name} guarda a passagem!`, color: '#a78bfa', big: 1 });
  }
  const swarm = mods.includes('enxame');
  const n = Math.round(Math.min(12, 5 + Math.floor(f / 3)) * (swarm ? 1.6 : 1) * (r.kind === 'boss' ? 0.5 : 1));
  for (let i = 0; i < n; i++) {
    const p = roomPos(dg, r);
    const e = hostSpawn(pick(src), 5, mods.includes('alfas') ? 1 : Math.random() < 0.08 ? 1 : 0, p.x, p.y);
    tune(e, false);
    if (swarm) { e.maxHp = Math.round(e.maxHp * 0.6); e.hp = e.maxHp; }
  }
}
function towerCleared(dg) {
  dg.cleared = true;
  const r = dg.rooms[dg.rooms.length - 1], c = roomCenter(dg, r);
  // saque do andar e escada para o próximo
  // a cada andar um item mítico; nos andares de guardião, mais um e uma poção de atributo
  const items = [mythItem(dg.floor)];
  if (dg.floor % 5 === 0) items.push(statPot(), mythItem(dg.floor));
  if (Math.random() < 0.5) items.push(consItem('ultra'));
  G.bags.push({ x: c.x - 60, y: c.y, items, life: 180 });
  const nx = createDungeon(c.x, c.y, null, 5, { theme: 'torre', force: true, quiet: true, floor: dg.floor + 1, ttl: 600 });
  if (nx) nx.ent = { ...dg.ent };
  emitEvent({ t: 'toast', text: `🗼 Andar ${dg.floor} limpo! A escada para o andar ${dg.floor + 1} apareceu.`, color: '#a78bfa', big: 1 });
}
// pedido para abrir a torre (no guardião da 2ª cidade)
function towerRequest(f) {
  const n = NPCS2.find(x => x.id === 'torre');
  if (!n) return;
  if (isHost()) towerStart(f, n.x, n.y + 50);
  else if (NET.host && NET.host.open) NET.host.send({ t: 'tower', f, x: n.x, y: n.y + 50 });
}
function towerStart(f, x, y) {
  f = clamp(f | 0, 1, 999);
  if (G.portals.some(p => Math.hypot(p.x - x, p.y - y) < 30)) return;
  const dg = createDungeon(x, y, null, 5, { theme: 'torre', force: true, quiet: true, floor: f, ttl: 60 });
  if (dg) emitEvent({ t: 'toast', text: `🗼 A Torre Infinita abriu no andar ${f}! Entrem pelo portal (60s).`, color: '#a78bfa', big: 1 });
}
function towerEnter(P, dg) {
  P.towerR = P.towerR || {};
  const best = towerBest(P);
  const names = (dg.mods || []).map(m => TOWER_MODS[m]).join(' · ');
  G.toasts.push({ text: `🗼 Andar ${dg.floor}${names ? ' · ' + names : ''}`, color: '#c4b5fd', t: 5, big: 1 });
  if (dg.floor > best) {
    P.towerR[REGION_ID] = dg.floor;
    if (best && dg.floor % 5 === 0) emitEvent({ t: 'chat', sys: 1, text: `🏆 ${P.name} chegou ao andar ${dg.floor} da Torre Infinita!` });
    saveGame();
  }
}
// chefe de andar vencido: libera começar do andar seguinte
function towerCheckpoint(P, f) {
  P.towerCk = P.towerCk || {};
  if (f > towerCk(P)) { P.towerCk[REGION_ID] = f; G.toasts.push({ text: `🗼 Checkpoint! Agora você pode começar a Torre no andar ${f + 1}.`, color: '#fde047', t: 5 }); saveGame(); }
}
// morrer na torre não apaga o personagem
function towerFall(P, dg, src) {
  burst(P.x, P.y, '#a78bfa', 40);
  const t = TOWNS[1] || TOWNS[0];
  P.x = t.x + rand(-40, 40); P.y = t.y + rand(60, 90); G.cam.x = P.x; G.cam.y = P.y;
  P.hp = maxHP(P); P.pstT = 0;
  G.toasts.push({ text: `🗼 Você caiu no andar ${dg.floor} (${src}). Recorde: andar ${towerBest(P)}. Nada foi perdido.`, color: '#c4b5fd', t: 6, big: 1 });
  emitEvent({ t: 'chat', sys: 1, text: `🗼 ${P.name} caiu no andar ${dg.floor} da Torre Infinita.` });
  G.dirty = true;
}
function renderTowerNPC(P) {
  if (!storyOver(P)) return `<p class="fala">"A Torre Infinita só se abre para quem venceu a história de ${REGION.nome}. Volte quando for campeão."</p>`;
  const ck = towerCk(P), starts = [1];
  for (let f = 5; f <= ck; f += 5) starts.push(f + 1);
  return `<p class="fala">"Lá dentro, cada andar é mais difícil que o anterior. A cada 5 andares há um guardião, e quem o vence pode recomeçar dali. Se cair, você volta para cá, sem perder nada."</p>
    <div class="small">Seu recorde em ${REGION.nome}: <b>andar ${towerBest(P) || '—'}</b> · checkpoint: ${ck ? 'andar ' + (ck + 1) : 'nenhum ainda'}</div>
    <h4>Começar no andar</h4>
    ${starts.map(f => `<div class="shoprow"><span>🗼 Andar ${f} <i>(${f === 1 ? 'nível da zona 5' : `+${Math.round((Math.pow(1.08, f - 1) - 1) * 100)}% de força`})</i></span><button data-act="torre:${f}" class="good">Abrir portal</button></div>`).join('')}
    <div class="small">O grupo entra junto pelo portal. Cada andar dá itens; os guardiões dão mais.</div>`;
}

/* ---------- Loja da Torre: aparece no fim de cada andar limpo ---------- */
function towerShopOf(dg) {
  if (!dg || !dg.floor || !G.portals.some(p => !p.exit && dungeonAt(p.x) === dg)) return null; // a escada já apareceu
  const c = roomCenter(dg, dg.rooms[dg.rooms.length - 1]);
  return { id: 'tshop', nome: 'Mercadora da Torre', icon: '🛒', x: c.x + 110, y: c.y + 30, town: 2 };
}
function nearTowerShop(P) { const n = towerShopOf(dungeonAt(P.x)); return n && Math.hypot(n.x - P.x, n.y - P.y) < 60 ? n : null; }
function towerShopList(P) {
  return [
    { id: 'pot', nome: 'Poção de Cura', icon: '❤️', preco: 40 },
    { id: 'grande', nome: 'Great Ball', icon: '🔵', preco: 80 },
    { id: 'ultra', nome: 'Ultra Ball', icon: '🟡', preco: 180 },
    { id: 'doce', nome: 'Doce Raro (+1 nível do companheiro)', icon: '🍬', preco: 220 },
    { id: 'stone', nome: 'Cristal de tipo aleatório', icon: '💎', preco: 70 },
    { id: 'statpot', nome: 'Poção de Atributo (+2 permanente, aleatório)', icon: '⚗️', preco: 1500 },
  ];
}
function renderTowerShop(P) {
  const cap = upgMax(P, 2);
  return `<p class="fala">"Subiu até aqui? Então merece o melhor que eu tenho. Só aqui na torre eu passo dos limites das forjas lá de baixo."</p>
    <h4>Forja da Torre (até +${cap})</h4>
    ${['arma', 'armadura'].map(s => { const it = P.equip[s], c = upgCost(it), maxed = (it.upg || 0) >= cap;
      return `<div class="shoprow"><span>${itemIcon(it)} ${esc(it.name)}${it.upg ? ' +' + it.upg : ''}</span><button data-act="upg:${s}" ${maxed || P.gold < c ? 'disabled' : ''}>${maxed ? 'Máximo' : `Aprimorar (${c} 🪙)`}</button></div>`; }).join('')}
    <h4>Suprimentos</h4>
    ${towerShopList(P).map(s => `<div class="shoprow"><span>${s.icon} ${s.nome}</span><button data-act="buy:${s.id}" ${P.gold < s.preco ? 'disabled' : ''}>${s.preco} 🪙</button></div>`).join('')}
    <div class="small">Você tem ${P.gold} 🪙.</div>`;
}
function drawTowerShop(ox, oy) {
  const P = G.P, n = P && towerShopOf(dungeonAt(P.x));
  if (!n) return;
  const x = n.x + ox, y = n.y + oy;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 17, 14, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#6d28d9'; ctx.fillRect(x - 30, y + 2, 22, 14); ctx.fillStyle = '#a78bfa'; ctx.fillRect(x - 30, y - 2, 22, 5); // banca
  if (NPC_SPR.loja) ctx.drawImage(NPC_SPR.loja, x - 18, y - 18, 36, 36);
  ctx.font = 'bold 11px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#e9d5ff';
  outlined('🛒 Mercadora da Torre', x, y - 26);
}

/* ---------- Enigmas das masmorras ----------
 * Placas: pise nas 3 placas (ficam acesas; o grupo pode dividir). Runas: elas brilham numa ordem quando você entra
 * na sala; toque nelas na mesma ordem (errou, apagam e mostram a ordem de novo).
 * Cada toque vira um evento de rede, então todo mundo vê o mesmo estado; ao resolver, a porta abre e surge um baú.
 */
const RUNE_GLYPH = ['▲', '●', '■', '◆'];
function pzTick(dt) {
  const P = G.P, dg = P && dungeonAt(P.x), pz = dg && dg.pz;
  if (!pz || pz.done) return;
  const room = dg.rooms[pz.room], inside = inRoom(dg, room, P.x, P.y);
  if (pz.kind === 'runas') {
    if (inside && pz.showT < 0) pz.showT = 0;
    if (pz.showT >= 0) pz.showT += dt;
  }
  const i = pz.pts.findIndex(p => Math.hypot(p.x - P.x, p.y - P.y) < 22);
  if (i >= 0 && G.pzStand !== i && !(pz.kind === 'runas' && pz.showT >= 0 && pz.showT < pz.order.length * 0.7 + 0.3)) emitEvent({ t: 'pz', dg: dg.id, i });
  G.pzStand = i;
}
function pzEvent(m) {
  const dg = G.dungeons.get(m.dg), pz = dg && dg.pz;
  if (!pz || pz.done) return;
  const p = pz.pts[m.i];
  if (pz.kind === 'placas') {
    if (pz.lit[m.i]) return;
    pz.lit[m.i] = true; burst(p.x, p.y, THEMES[dg.theme].accent, 14); sfx('pick');
    if (pz.lit.filter(Boolean).length >= pz.pts.length) pzOpen(dg);
  } else if (pz.order[pz.step] === m.i) {
    pz.lit[m.i] = true; pz.step++; burst(p.x, p.y, '#fde68a', 16); sfx('pick');
    if (pz.step >= pz.pts.length) pzOpen(dg);
  } else if (!pz.lit[m.i]) {
    pz.lit = []; pz.step = 0; pz.showT = 0; // errou: apaga e mostra a ordem de novo
    text(p.x, p.y - 30, '✖ Ordem errada!', '#fca5a5', 14); sfx('hit');
  }
}
function pzOpen(dg, quiet) {
  const pz = dg.pz;
  pz.done = true;
  for (const c of pz.door) dg.grid[c] = 1;
  dg.mini = null;
  if (quiet) return;
  const r = roomCenter(dg, dg.rooms[pz.room]);
  burst(r.x, r.y, '#facc15', 40);
  G.toasts.push({ text: '🔓 O enigma foi resolvido! A porta se abriu e um baú apareceu na sala.', color: '#facc15', t: 4, big: 1 });
  sfx('lvl');
}
function drawPuzzle(ox, oy) {
  const P = G.P, dg = P && dungeonAt(P.x), pz = dg && dg.pz;
  if (!pz) return;
  const acc = THEMES[dg.theme].accent;
  pz.pts.forEach((p, i) => {
    const x = p.x + ox, y = p.y + oy;
    if (pz.kind === 'placas') {
      ctx.fillStyle = '#374151'; ctx.fillRect(x - 13, y - 13, 26, 26);
      ctx.fillStyle = pz.lit[i] || pz.done ? acc : '#6b7280'; ctx.fillRect(x - 10, y - 10, 20, 20);
      if (pz.lit[i] && Math.random() < 0.1) G.parts.push({ x: p.x + rand(-8, 8), y: p.y - 6, vx: 0, vy: -25, life: 0.5, color: acc, size: 2 });
    } else {
      // na hora de mostrar a ordem, cada runa brilha na sua vez
      const show = pz.showT >= 0 && pz.showT < pz.order.length * 0.7 + 0.3 && pz.order[Math.floor(pz.showT / 0.7)] === i && pz.showT % 0.7 < 0.55;
      const on = show || pz.lit[i] || pz.done;
      ctx.fillStyle = '#292524'; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill();
      if (on) { ctx.fillStyle = show ? 'rgba(253,230,138,.5)' : `${acc}66`; ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fill(); }
      ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = on ? (show ? '#fef3c7' : acc) : '#78716c';
      ctx.fillText(RUNE_GLYPH[i], x, y + 6);
    }
  });
  if (pz.done || !inRoom(dg, dg.rooms[pz.room], P.x, P.y)) return;
  ctx.font = 'bold 14px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fde68a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  outlined(pz.kind === 'placas' ? `🧩 A saída está selada: pise nas placas para abrir (${pz.lit.filter(Boolean).length}/${pz.pts.length})`
    : `🧩 A saída está selada: toque as runas na ordem em que elas brilharam (${pz.step}/${pz.pts.length})`, W / 2, 96);
}
