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
function genDungeon(id, theme, seed, zone) {
  const R = mulberry32(seed), grid = new Uint8Array(DG_W * DG_H), rooms = [];
  const carve = (x, y, w, h) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i > 0 && j > 0 && i < DG_W - 1 && j < DG_H - 1) grid[j * DG_W + i] = 1;
  };
  let cx = 3;
  const gs = gymStage(theme), kinds = ['start', ...Array(gs ? gymFights(gs) : 3).fill('fight'), 'boss'];
  for (const kind of kinds) {
    const w = kind === 'start' ? 10 : kind === 'boss' ? 24 : gs ? 16 + Math.floor(R() * 4) : 14 + Math.floor(R() * 6);
    const h = kind === 'start' ? 10 : kind === 'boss' ? 22 : gs ? 15 + Math.floor(R() * 5) : 12 + Math.floor(R() * 6);
    const y = clamp(Math.floor(DG_H / 2 - h / 2 + (R() - 0.5) * 16), 2, DG_H - h - 2);
    rooms.push({ x: cx, y, w, h, kind, state: 0 });
    carve(cx, y, w, h);
    cx += w + (gs ? 6 + Math.floor(R() * 3) : 6 + Math.floor(R() * 5));
  }
  // corredores em L entre salas consecutivas
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i], b = rooms[i + 1];
    const ax = (a.x + a.w / 2) | 0, ay = (a.y + a.h / 2) | 0, bx = (b.x + b.w / 2) | 0, by = (b.y + b.h / 2) | 0;
    carve(Math.min(ax, bx), ay - 2, Math.abs(bx - ax) + 1, 4);
    carve(bx - 2, Math.min(ay, by) - 2, 4, Math.abs(by - ay) + 4);
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
  return { id, theme, seed, zone, grid, rooms, ox: DG_BASE + id * DG_SPACING, oy: 0, done: false, doneT: 0, emptyT: 0, ent: { x: 0, y: 0 }, bossId: 0, mini: null };
}

function walkable(x, y) {
  if (x < DG_BASE - 5000) return true;
  const dg = dungeonAt(x);
  if (!dg) return false;
  const tx = Math.floor((x - dg.ox) / TILE), ty = Math.floor((y - dg.oy) / TILE);
  if (tx < 0 || ty < 0 || tx >= DG_W || ty >= DG_H) return false;
  return dg.grid[ty * DG_W + tx] === 1;
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
  const dg = genDungeon(id, theme, randi(1, 2e9), clamp(Math.max(zone, THEMES[theme].zmin || 1), 1, 5));
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
    const n = 3 + dg.zone + randi(0, 1);
    for (let i = 0; i < n; i++) {
      const p = roomPos(dg, r);
      const e = hostSpawn(pick(pool.length ? pool : fallback), dg.zone, Math.random() < 0.04 ? 1 : 0, p.x, p.y);
      e.dg = dg.id;
      e.maxHp = Math.round(e.maxHp * 1.3); e.hp = e.maxHp; // reforço de masmorra
      e.cd = rand(1.5, 2.8); // tempo para o grupo reagir ao entrar na sala
    }
  }
}

function closeDungeon(dg) {
  G.enemies = G.enemies.filter(e => { if (e.dg === dg.id) { G.emap.delete(e.id); return false; } return true; });
  G.portals = G.portals.filter(p => p.dg !== dg.id);
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
    for (const r of dg.rooms) {
      if (r.state || r.kind === 'start') continue;
      if (inside.some(p => inRoom(dg, r, p.x, p.y))) { r.state = 1; spawnRoom(dg, r); }
    }
    dg.emptyT = inside.length ? 0 : dg.emptyT + 0.25;
    const entOpen = G.portals.some(p => p.dg === dg.id && !p.exit);
    if ((dg.emptyT > 15 && !entOpen) || (dg.done && G.time - dg.doneT > 120)) closeDungeon(dg);
  }
}

// chamado pelo host quando um inimigo morre
function hostOnKill(e) {
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
const dungeonsToNet = () => [...G.dungeons.values()].map(d => [d.id, d.theme, d.seed, d.zone, d.done ? 1 : 0, d.ent.x, d.ent.y]);
const portalsToNet = () => G.portals.map(p => [p.id, p.x, p.y, p.theme, Math.round(p.ttl), p.dg, p.exit]);
function dungeonsFromNet(dgs, pos) {
  const seen = new Set();
  for (const a of dgs || []) {
    seen.add(a[0]);
    let dg = G.dungeons.get(a[0]);
    if (!dg) { dg = genDungeon(a[0], a[1], a[2], a[3]); G.dungeons.set(a[0], dg); }
    dg.done = !!a[4]; dg.ent = { x: a[5], y: a[6] };
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
  else { const c = roomCenter(dg, dg.rooms[0]); P.x = c.x + rand(-30, 30); P.y = c.y + rand(-30, 30); }
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
    if (g === 1) {
      const h = hash(tx + dg.id * 991, ty);
      ctx.fillStyle = th.floor[h < 0.5 ? 0 : 1];
      ctx.fillRect(sx, sy, TILE, TILE);
      if (h > 0.97) { ctx.fillStyle = th.accent; ctx.globalAlpha = 0.25; ctx.fillRect(sx + 10, sy + 12, 6, 6); ctx.globalAlpha = 1; }
    } else if (ty + 1 < DG_H && dg.grid[(ty + 1) * DG_W + tx] === 1) {
      // face frontal da parede, dá sensação de altura
      ctx.fillStyle = th.top;
      ctx.fillRect(sx, sy + 12, TILE, TILE - 12);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(sx, sy + TILE - 4, TILE, 4);
    }
  }
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
    const s = `${p.exit ? 'Saída' : THEMES[p.theme].nome} · ${Math.ceil(p.ttl)}s`;
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
