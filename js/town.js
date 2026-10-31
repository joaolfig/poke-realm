'use strict';
/* ============ Vila inicial: prédios e enfeites ============
 * Tudo é decoração (não bloqueia o caminho), desenhado em ordem de profundidade
 * junto com NPCs e jogadores. Os prédios continuam sólidos via solidAt().
 */
const WOOD = { dk: '#3b2516', md: '#5c3a22', lt: '#7d5434' };
const STONE = { dk: '#5d5852', md: '#7f7970', lt: '#a39c91' };
// a placa do portal principal usa o nome da vila da região

function shingles(x, y, w, h, col) {
  ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  for (let r = 0, yy = y + 3; yy < y + h - 2; r++, yy += 7) {
    ctx.fillStyle = shade(col, 0.72); ctx.fillRect(x, yy + 4, w, 2);
    ctx.fillStyle = shade(col, 1.12); ctx.fillRect(x, yy, w, 1);
    for (let xx = x + ((r & 1) ? 5 : 0); xx < x + w; xx += 10) { ctx.fillStyle = shade(col, 0.8); ctx.fillRect(xx, yy, 1, 5); }
  }
}
function windowAt(x, y, lit) {
  ctx.fillStyle = WOOD.dk; ctx.fillRect(x - 2, y - 2, 18, 16);
  ctx.fillStyle = lit ? '#f4c86a' : '#7fa6bf'; ctx.fillRect(x, y, 14, 12);
  ctx.fillStyle = lit ? '#fde7a8' : '#b9d4e3'; ctx.fillRect(x, y, 6, 5);
  ctx.fillStyle = WOOD.dk; ctx.fillRect(x + 6, y, 2, 12); ctx.fillRect(x, y + 5, 14, 2);
  ctx.fillStyle = shade(WOOD.md, 1.1); ctx.fillRect(x - 6, y - 2, 4, 16); ctx.fillRect(x + 16, y - 2, 4, 16); // venezianas
  ctx.fillStyle = '#7a5f3e'; ctx.fillRect(x - 2, y + 14, 18, 3); // floreira
  ctx.fillStyle = '#d9534f'; ctx.fillRect(x, y + 12, 3, 3); ctx.fillStyle = '#f2d24b'; ctx.fillRect(x + 6, y + 12, 3, 3); ctx.fillStyle = '#e88fc0'; ctx.fillRect(x + 11, y + 12, 3, 3);
}

function drawBuilding(b, ox, oy) {
  const x = Math.round(b.x - b.w / 2 + ox), y = Math.round(b.y - b.h / 2 + oy), w = b.w, h = b.h;
  const wallH = Math.round(h * 0.5), wy = y + h - wallH, lit = typeof isNight === 'function' && isNight();
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + 2, y + h - 2, w + 6, 8);
  // fundação de pedra
  ctx.fillStyle = STONE.md; ctx.fillRect(x + 2, y + h - 8, w - 4, 8);
  for (let xx = x + 2, k = 0; xx < x + w - 4; xx += 9, k++) { ctx.fillStyle = k & 1 ? STONE.lt : STONE.dk; ctx.fillRect(xx, y + h - 8 + (k & 1) * 4, 8, 3); }
  // parede de enxaimel
  ctx.fillStyle = b.wall; ctx.fillRect(x + 4, wy, w - 8, wallH - 8);
  ctx.fillStyle = WOOD.md;
  ctx.fillRect(x + 4, wy, w - 8, 4); ctx.fillRect(x + 4, wy + Math.round(wallH / 2) - 4, w - 8, 3);
  for (let xx = x + 4; xx <= x + w - 10; xx += Math.floor((w - 14) / 4)) ctx.fillRect(xx, wy, 5, wallH - 8);
  ctx.fillRect(x + w - 9, wy, 5, wallH - 8);
  ctx.strokeStyle = WOOD.md; ctx.lineWidth = 3; ctx.beginPath(); // mãos-francesas
  ctx.moveTo(x + 8, wy + wallH / 2 - 3); ctx.lineTo(x + 24, wy + 4); ctx.moveTo(x + w - 8, wy + wallH / 2 - 3); ctx.lineTo(x + w - 24, wy + 4); ctx.stroke();
  // janelas e porta em arco
  windowAt(x + 16, wy + wallH / 2 - 1, lit); windowAt(x + w - 30, wy + wallH / 2 - 1, lit);
  const dx = x + w / 2 - 10, dh = 26;
  ctx.fillStyle = STONE.lt; ctx.fillRect(dx - 3, y + h - dh - 6, 26, dh + 2);
  ctx.fillStyle = WOOD.dk; ctx.beginPath(); ctx.moveTo(dx, y + h - 6); ctx.lineTo(dx, y + h - dh + 4); ctx.arc(dx + 10, y + h - dh + 4, 10, Math.PI, 0); ctx.lineTo(dx + 20, y + h - 6); ctx.fill();
  ctx.fillStyle = WOOD.md; ctx.fillRect(dx + 3, y + h - dh, 6, dh - 6); ctx.fillRect(dx + 11, y + h - dh, 6, dh - 6);
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(dx + 2, y + h - 20, 7, 2); ctx.fillRect(dx + 2, y + h - 12, 7, 2);
  ctx.fillStyle = '#e8b04a'; ctx.fillRect(dx + 14, y + h - 15, 2, 2);
  ctx.fillStyle = STONE.dk; ctx.fillRect(dx - 4, y + h - 4, 28, 4); // degrau
  // telhado com beiral
  const rh = h - wallH + 6;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 4, y + rh - 2, w + 8, 5);
  shingles(x - 6, y, w + 12, rh, b.roof);
  ctx.fillStyle = shade(b.roof, 0.6); ctx.fillRect(x - 6, y, w + 12, 3); ctx.fillRect(x - 6, y + rh - 3, w + 12, 3);
  ctx.fillStyle = shade(b.roof, 0.6); ctx.fillRect(x - 6, y, 3, rh); ctx.fillRect(x + w + 3, y, 3, rh);
  // chaminé
  if (b.chimney) {
    const cx = x + w - 30;
    ctx.fillStyle = STONE.dk; ctx.fillRect(cx, y - 16, 16, 22); ctx.fillStyle = STONE.md; ctx.fillRect(cx + 2, y - 14, 12, 18);
    ctx.fillStyle = STONE.lt; ctx.fillRect(cx - 2, y - 18, 20, 4);
    if (Math.random() < 0.18) G.parts.push({ x: b.x + b.w / 2 - 22, y: b.y - b.h / 2 - 18, vx: rand(-6, 6), vy: -28, life: 1.6, color: '#b8b2aa', size: 5 });
  }
  // placa pendurada
  const sx = x + w / 2 + 18, sy = wy + 6;
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(sx, sy, 22, 2); ctx.fillRect(sx + 4, sy + 2, 1, 4); ctx.fillRect(sx + 17, sy + 2, 1, 4);
  ctx.fillStyle = WOOD.dk; ctx.fillRect(sx + 1, sy + 6, 20, 16); ctx.fillStyle = WOOD.lt; ctx.fillRect(sx + 2, sy + 7, 18, 14);
  ctx.font = '11px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#000';
  ctx.fillText(b.sign, sx + 11, sy + 18);
}

/* ---------- enfeites ---------- */
const TOWN_DECOR = [
  { k: 'fountain', x: 0, y: 0 },
  { k: 'lamp', x: -62, y: -92 }, { k: 'lamp', x: 62, y: -92 }, { k: 'lamp', x: -62, y: 100 }, { k: 'lamp', x: 62, y: 100 },
  { k: 'lamp', x: -100, y: -12 }, { k: 'lamp', x: 100, y: -12 },
  { k: 'stall', x: -250, y: 44, awn: '#b8423a' }, { k: 'stall', x: 250, y: 44, awn: '#3c6e9e' },
  { k: 'anvil', x: -92, y: 132 }, { k: 'barrels', x: -214, y: 112 }, { k: 'crates', x: 212, y: -98 },
  { k: 'barrels', x: 214, y: 116 }, { k: 'crates', x: -212, y: -100 },
  { k: 'bench', x: -56, y: 52 }, { k: 'bench', x: 56, y: 52 },
  { k: 'planter', x: -36, y: -150 }, { k: 'planter', x: 36, y: -150 },
  { k: 'tree', x: -228, y: -178 }, { k: 'tree', x: 228, y: -182 }, { k: 'tree', x: -168, y: 236 }, { k: 'tree', x: 172, y: 232 },
  { k: 'tree', x: -262, y: 128 }, { k: 'tree', x: 262, y: 140 },
];
// portais nas entradas: onde as ruas cruzam a borda da vila (recalculados a cada região)
// portais de cada cidade (coordenadas locais, relativas ao centro da cidade)
const TOWN_GATES = [[], []];
const decorSy = d => (d.k === 'gate' ? d.y + Math.abs(d.ty) * 46 : d.k === 'tree' ? d.y + 6 : d.k === 'stall' ? d.y + 16 : d.y);
function rebuildTownDecor() {
  for (let i = TOWN_DECOR.length - 1; i >= 0; i--) if (TOWN_DECOR[i].k === 'gate') TOWN_DECOR.splice(i, 1);
  for (const d of TOWN_DECOR) d.sy = decorSy(d);
  TOWNS.forEach((t, ti) => {
    const R = VILA_R - 8, found = [], gates = TOWN_GATES[ti] = [];
    const pd = (x, y) => pathDist(t.x + x, t.y + y);
    for (let a = 0; a < Math.PI * 2; a += 0.01) {
      const x = Math.cos(a) * R, y = Math.sin(a) * R, d = pd(x, y);
      if (d < 12 && !found.some(f => Math.abs(Math.atan2(Math.sin(f.a - a), Math.cos(f.a - a))) < 0.4)) found.push({ a, d, x, y });
    }
    for (const f of found) {
      // centraliza no meio da rua
      let best = f;
      for (let a = f.a - 0.2; a < f.a + 0.2; a += 0.005) { const x = Math.cos(a) * R, y = Math.sin(a) * R, d = pd(x, y); if (d < best.d) best = { a, d, x, y }; }
      const g = { k: 'gate', x: best.x, y: best.y, tx: -Math.sin(best.a), ty: Math.cos(best.a), main: Math.abs(best.a + Math.PI / 2) < 0.4, town: ti };
      g.sy = decorSy(g);
      gates.push(g);
    }
  });
}

function post(x, y, h) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 6, y - 2, 13, 4);
  ctx.fillStyle = STONE.md; ctx.fillRect(x - 5, y - 6, 11, 6);
  ctx.fillStyle = WOOD.dk; ctx.fillRect(x - 3, y - h, 7, h - 5); ctx.fillStyle = WOOD.lt; ctx.fillRect(x - 3, y - h, 2, h - 5);
}
function drawDecor(d, ox, oy) {
  const x = Math.round(d.x + ox), y = Math.round(d.y + oy), t = G.time;
  switch (d.k) {
    case 'fountain': {
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y + 6, 44, 16, 0, 0, 7); ctx.fill();
      ctx.fillStyle = STONE.dk; ctx.beginPath(); ctx.ellipse(x, y + 2, 42, 18, 0, 0, 7); ctx.fill();
      ctx.fillStyle = STONE.lt; ctx.beginPath(); ctx.ellipse(x, y - 2, 42, 18, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3d7fb8'; ctx.beginPath(); ctx.ellipse(x, y - 2, 34, 13, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(220,240,255,.6)'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 2; k++) { const p = (t * 0.6 + k * 0.5) % 1; ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.ellipse(x, y - 2, 8 + p * 24, 3 + p * 9, 0, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = STONE.md; ctx.fillRect(x - 6, y - 30, 12, 28); ctx.fillStyle = STONE.lt; ctx.fillRect(x - 6, y - 30, 4, 28);
      ctx.fillStyle = STONE.lt; ctx.beginPath(); ctx.ellipse(x, y - 30, 12, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8fc6ee';
      for (let k = 0; k < 6; k++) {
        const p = (t * 1.4 + k / 6) % 1, a = k / 6 * Math.PI * 2;
        ctx.fillRect(x + Math.cos(a) * p * 16 - 1, y - 34 + p * p * 30 - Math.sin(p * Math.PI) * 10 + Math.sin(a) * p * 5, 2, 3);
      }
      break;
    }
    case 'lamp': {
      post(x, y, 46);
      ctx.fillStyle = WOOD.dk; ctx.fillRect(x - 6, y - 48, 13, 3);
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 5, y - 60, 11, 12); ctx.fillRect(x - 3, y - 63, 7, 3);
      const fl = 0.85 + Math.sin(t * 9 + d.x) * 0.08 + Math.sin(t * 23 + d.y) * 0.05;
      ctx.fillStyle = `rgba(255,214,120,${(0.9 * fl).toFixed(2)})`; ctx.fillRect(x - 3, y - 58, 7, 8);
      ctx.fillStyle = `rgba(255,200,100,${((isNight() ? 0.22 : 0.08) * fl).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y - 54, isNight() ? 46 : 22, 0, 7); ctx.fill();
      break;
    }
    case 'stall': {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 30, y + 14, 62, 6);
      ctx.fillStyle = WOOD.md; ctx.fillRect(x - 28, y - 4, 56, 18); ctx.fillStyle = WOOD.lt; ctx.fillRect(x - 28, y - 4, 56, 4);
      const goods = ['#d9534f', '#f2d24b', '#7cc46a', '#e8a04a', '#b07cd8'];
      for (let k = 0; k < 6; k++) { ctx.fillStyle = goods[(k + (d.x > 0 ? 2 : 0)) % 5]; ctx.beginPath(); ctx.arc(x - 20 + k * 8, y - 6, 4, 0, 7); ctx.fill(); }
      ctx.fillStyle = WOOD.dk; ctx.fillRect(x - 28, y - 34, 3, 48); ctx.fillRect(x + 25, y - 34, 3, 48);
      for (let k = 0; k < 7; k++) { ctx.fillStyle = k & 1 ? '#efe6d2' : d.awn; ctx.fillRect(x - 32 + k * 9, y - 40, 9, 12); }
      for (let k = 0; k < 7; k++) { ctx.fillStyle = k & 1 ? '#efe6d2' : d.awn; ctx.beginPath(); ctx.arc(x - 27.5 + k * 9, y - 28, 4.5, 0, Math.PI); ctx.fill(); }
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(x - 32, y - 40, 63, 3);
      break;
    }
    case 'anvil':
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 12, y + 2, 24, 4);
      ctx.fillStyle = WOOD.md; ctx.fillRect(x - 7, y - 8, 14, 10);
      ctx.fillStyle = '#3c3f44'; ctx.fillRect(x - 12, y - 16, 22, 6); ctx.fillRect(x - 5, y - 10, 10, 3); ctx.fillRect(x + 10, y - 15, 5, 3);
      ctx.fillStyle = '#6b7078'; ctx.fillRect(x - 12, y - 16, 22, 2);
      break;
    case 'barrels':
      for (const [bx, by] of [[-9, 0], [9, 2], [0, -10]]) {
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + bx - 8, y + by + 1, 16, 4);
        ctx.fillStyle = WOOD.md; ctx.fillRect(x + bx - 7, y + by - 18, 14, 19);
        ctx.fillStyle = WOOD.lt; ctx.fillRect(x + bx - 7, y + by - 18, 4, 19);
        ctx.fillStyle = '#4a4a4a'; ctx.fillRect(x + bx - 7, y + by - 15, 14, 2); ctx.fillRect(x + bx - 7, y + by - 5, 14, 2);
        ctx.fillStyle = WOOD.dk; ctx.beginPath(); ctx.ellipse(x + bx, y + by - 18, 7, 3, 0, 0, 7); ctx.fill();
      }
      break;
    case 'crates':
      for (const [bx, by, s] of [[-8, 0, 16], [9, 2, 14], [-2, -14, 13]]) {
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + bx - s / 2, y + by, s + 2, 4);
        ctx.fillStyle = '#9a7246'; ctx.fillRect(x + bx - s / 2, y + by - s, s, s);
        ctx.strokeStyle = WOOD.md; ctx.lineWidth = 2; ctx.strokeRect(x + bx - s / 2 + 1, y + by - s + 1, s - 2, s - 2);
        ctx.beginPath(); ctx.moveTo(x + bx - s / 2 + 2, y + by - 2); ctx.lineTo(x + bx + s / 2 - 2, y + by - s + 2); ctx.stroke();
      }
      break;
    case 'bench':
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x - 18, y + 1, 36, 4);
      ctx.fillStyle = WOOD.dk; ctx.fillRect(x - 15, y - 6, 3, 7); ctx.fillRect(x + 12, y - 6, 3, 7);
      ctx.fillStyle = WOOD.lt; ctx.fillRect(x - 18, y - 9, 36, 4); ctx.fillStyle = WOOD.md; ctx.fillRect(x - 18, y - 16, 36, 4);
      break;
    case 'planter':
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x - 13, y + 1, 26, 4);
      ctx.fillStyle = STONE.md; ctx.fillRect(x - 12, y - 10, 24, 11); ctx.fillStyle = STONE.lt; ctx.fillRect(x - 12, y - 10, 24, 3);
      ctx.fillStyle = '#3f8f3a'; ctx.beginPath(); ctx.ellipse(x, y - 13, 12, 6, 0, 0, 7); ctx.fill();
      for (let k = 0; k < 5; k++) { ctx.fillStyle = ['#d9534f', '#f2d24b', '#e88fc0', '#fff', '#b07cd8'][k]; ctx.fillRect(x - 9 + k * 4, y - 16 + (k & 1) * 3, 3, 3); }
      break;
    case 'tree': ctx.drawImage(treeImg(TK.TREE, 1, Math.abs(d.x) % 4), x - 32, y - 76); break;
    case 'gate': {
      const p1x = x + d.tx * 46, p1y = y + d.ty * 46, p2x = x - d.tx * 46, p2y = y - d.ty * 46;
      // cerquinha saindo dos dois lados
      for (const s of [1, -1]) for (let k = 1; k <= 3; k++) post(x + d.tx * s * (46 + k * 16), y + d.ty * s * (46 + k * 16), 20);
      post(p1x, p1y, 58); post(p2x, p2y, 58);
      ctx.strokeStyle = WOOD.dk; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p1x, p1y - 54); ctx.lineTo(p2x, p2y - 54); ctx.stroke();
      ctx.strokeStyle = WOOD.lt; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p1x, p1y - 56); ctx.lineTo(p2x, p2y - 56); ctx.stroke();
      // flâmulas
      for (const [px, py] of [[p1x, p1y], [p2x, p2y]]) {
        const wv = Math.sin(t * 3 + px * 0.05) * 2;
        ctx.fillStyle = '#9e3b32'; ctx.beginPath(); ctx.moveTo(px - 4, py - 50); ctx.lineTo(px + 5, py - 50); ctx.lineTo(px + 5 + wv, py - 30); ctx.lineTo(px + wv, py - 34); ctx.lineTo(px - 4 + wv, py - 30); ctx.fill();
        ctx.fillStyle = '#e8b04a'; ctx.fillRect(px - 1 + wv * 0.5, py - 46, 3, 3);
      }
      if (d.main) {
        const mx = (p1x + p2x) / 2, my = (p1y + p2y) / 2 - 50;
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(mx - 22, my, 1, 6); ctx.fillRect(mx + 21, my, 1, 6);
        ctx.fillStyle = WOOD.dk; ctx.fillRect(mx - 40, my + 5, 80, 16); ctx.fillStyle = WOOD.lt; ctx.fillRect(mx - 39, my + 6, 78, 14);
        ctx.font = 'bold 11px Tiny5, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#2a1a0c'; ctx.fillText(((d.town ? TOWNS[d.town].nome : ZONES[0].nome) || '').replace(/^(Vila|Cidade|Porto) (d[aoe]s? )?/, '').toUpperCase().slice(0, 14), mx, my + 17);
      }
      break;
    }
  }
}
