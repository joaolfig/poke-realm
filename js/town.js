'use strict';
/* ============ Vila inicial: prédios e enfeites ============
 * Tudo é decoração (não bloqueia o caminho), desenhado em ordem de profundidade
 * junto com NPCs e jogadores. Os prédios continuam sólidos via solidAt().
 */
const WOOD = { dk: '#3b2516', md: '#5c3a22', lt: '#7d5434' };
const STONE = { dk: '#5d5852', md: '#7f7970', lt: '#a39c91' };
// a placa do portal principal usa o nome da vila da região

/* ---------- Cara de cada região nas cidades ----------
 * walls: enxaimel | reboco | madeira | tijolo | pedra · roof: telha | palha | neve | curvo
 * center: peça no meio da praça (ocupa o lugar do chafariz) · tree/lamp: árvores e postes da cidade
 * extra: enfeites a mais (coordenadas locais) · plaza: cor do calçamento
 */
const TOWN_STYLE = {
  kanto: { walls: 'enxaimel', roof: 'telha', roofs: ['#b23a33', '#46607a', '#4f4a45', '#5b3f6e'], center: 'fountain', tree: 'tree', lamp: 'lamp', awn: ['#b8423a', '#3c6e9e'], plaza: '#d6cdb8', extra: [] },
  johto: { walls: 'madeira', wall: '#c9a676', roof: 'curvo', roofs: ['#3a3f4a', '#4a3a30', '#2f3a33', '#5a2f2a'], center: 'shrine', tree: 'cherry', lamp: 'lantern', awn: ['#8f2f2a', '#3a3f4a'], plaza: '#cfc2a2',
    extra: [{ k: 'bamboo', x: -300, y: -40 }, { k: 'bamboo', x: 300, y: -40 }] },
  hoenn: { walls: 'reboco', wall: '#f4efe2', roof: 'telha', roofs: ['#2f8f8a', '#d9822b', '#3c79b8', '#e0a83a'], center: 'fountain', tree: 'palm', lamp: 'lamp', awn: ['#e0583a', '#2f9fb0'], plaza: '#e6d6a4',
    extra: [{ k: 'parasol', x: -300, y: -20, c: '#e0583a' }, { k: 'parasol', x: 300, y: -20, c: '#2f9fb0' }] },
  sinnoh: { walls: 'madeira', wall: '#8a6340', roof: 'neve', roofs: ['#3c5a7a', '#6b3a3a', '#4a5a3a', '#5a4a6a'], center: 'bonfire', tree: 'pine', lamp: 'lamp', awn: ['#3c5a7a', '#6b3a3a'], plaza: '#d3d9de',
    extra: [{ k: 'snowman', x: -300, y: -30 }, { k: 'snowman', x: 300, y: 10 }] },
  unova: { walls: 'tijolo', wall: '#b5653f', roof: 'telha', roofs: ['#5a6270', '#3d4a5c', '#6b5a4a', '#4a4a5a'], center: 'clock', tree: 'tree', lamp: 'modern', awn: ['#3d4a5c', '#c9a227'], plaza: '#b9b9bd',
    extra: [{ k: 'hydrant', x: -110, y: 168 }, { k: 'hydrant', x: 110, y: -170 }] },
  kalos: { walls: 'reboco', wall: '#ece0c6', roof: 'telha', roofs: ['#4a5878', '#5a6a8a', '#3e4a66', '#6a5a7a'], center: 'tower', tree: 'topiary', lamp: 'ornate', awn: ['#2f4a7a', '#b8423a'], plaza: '#ddd5c6',
    extra: [{ k: 'cafe', x: -300, y: -30 }, { k: 'cafe', x: 300, y: -30 }] },
  galar: { walls: 'pedra', wall: '#a8a196', roof: 'palha', roofs: ['#b89a5a', '#a88e52', '#9c8a5a', '#b5975c'], center: 'well', tree: 'tree', lamp: 'lamp', awn: ['#7a2f3a', '#2f5a3a'], plaza: '#bdb6a6',
    extra: [{ k: 'hay', x: -300, y: -30 }, { k: 'hay', x: 300, y: 0 }] },
  paldea: { walls: 'reboco', wall: '#f7f3ea', roof: 'telha', roofs: ['#c4622d', '#b8572a', '#cf6f35', '#a94f28'], center: 'tiles', tree: 'orange', lamp: 'lamp', awn: ['#e0b030', '#c4622d'], plaza: '#e3c9a2',
    extra: [{ k: 'pot', x: -300, y: -30 }, { k: 'pot', x: 300, y: 0 }] },
};
const townStyle = () => TOWN_STYLE[REGION_ID] || TOWN_STYLE.kanto;

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
  const S = townStyle(), bi = BUILDINGS.indexOf(b), wall = S.wall || b.wall, roof = (S.roofs && S.roofs[bi]) || b.roof;
  ctx.fillStyle = wall; ctx.fillRect(x + 4, wy, w - 8, wallH - 8);
  if (S.walls === 'enxaimel') { // parede de enxaimel
    ctx.fillStyle = WOOD.md;
    ctx.fillRect(x + 4, wy, w - 8, 4); ctx.fillRect(x + 4, wy + Math.round(wallH / 2) - 4, w - 8, 3);
    for (let xx = x + 4; xx <= x + w - 10; xx += Math.floor((w - 14) / 4)) ctx.fillRect(xx, wy, 5, wallH - 8);
    ctx.fillRect(x + w - 9, wy, 5, wallH - 8);
    ctx.strokeStyle = WOOD.md; ctx.lineWidth = 3; ctx.beginPath(); // mãos-francesas
    ctx.moveTo(x + 8, wy + wallH / 2 - 3); ctx.lineTo(x + 24, wy + 4); ctx.moveTo(x + w - 8, wy + wallH / 2 - 3); ctx.lineTo(x + w - 24, wy + 4); ctx.stroke();
  } else if (S.walls === 'madeira') { // tábuas deitadas (ou troncos)
    for (let yy = wy + 4; yy < wy + wallH - 8; yy += 6) { ctx.fillStyle = shade(wall, 0.72); ctx.fillRect(x + 4, yy, w - 8, 1); ctx.fillStyle = shade(wall, 1.12); ctx.fillRect(x + 4, yy + 1, w - 8, 1); }
    ctx.fillStyle = shade(wall, 0.6); ctx.fillRect(x + 4, wy, 4, wallH - 8); ctx.fillRect(x + w - 8, wy, 4, wallH - 8);
  } else if (S.walls === 'tijolo') {
    for (let r = 0, yy = wy; yy < wy + wallH - 8; r++, yy += 5) for (let xx = x + 4 + (r & 1 ? 6 : 0); xx < x + w - 4; xx += 12) { ctx.fillStyle = shade(wall, 0.78); ctx.fillRect(xx, yy, 1, 5); ctx.fillRect(x + 4, yy + 4, w - 8, 1); }
  } else if (S.walls === 'pedra') {
    for (let r = 0, yy = wy; yy < wy + wallH - 8; r++, yy += 8) for (let xx = x + 4 + (r & 1 ? 7 : 0); xx < x + w - 4; xx += 14) { ctx.fillStyle = shade(wall, hash(xx, yy) < 0.5 ? 0.86 : 1.08); ctx.fillRect(xx + 1, yy + 1, 12, 6); }
  } else { // reboco: parede lisa com rodapé e friso
    ctx.fillStyle = shade(wall, 0.85); ctx.fillRect(x + 4, wy + wallH - 14, w - 8, 6); ctx.fillStyle = shade(roof, 1.1); ctx.fillRect(x + 4, wy, w - 8, 3);
  }
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
  if (S.roof === 'palha') { // palha: camadas onduladas
    ctx.fillStyle = roof; ctx.fillRect(x - 6, y, w + 12, rh);
    for (let yy = y + 2; yy < y + rh - 2; yy += 5) for (let xx = x - 6; xx < x + w + 6; xx += 3) { ctx.fillStyle = shade(roof, hash(xx, yy) < 0.5 ? 0.8 : 1.15); ctx.fillRect(xx, yy + (xx % 6 ? 0 : 1), 2, 3); }
  } else shingles(x - 6, y, w + 12, rh, roof);
  ctx.fillStyle = shade(roof, 0.6); ctx.fillRect(x - 6, y, w + 12, 3); ctx.fillRect(x - 6, y + rh - 3, w + 12, 3);
  ctx.fillStyle = shade(roof, 0.6); ctx.fillRect(x - 6, y, 3, rh); ctx.fillRect(x + w + 3, y, 3, rh);
  if (S.roof === 'neve') { ctx.fillStyle = '#f2f6f9'; ctx.fillRect(x - 6, y - 3, w + 12, 7); for (let xx = x - 4; xx < x + w + 4; xx += 9) ctx.fillRect(xx, y + 4, 5, 2 + (xx % 3)); }
  if (S.roof === 'curvo') { ctx.fillStyle = shade(roof, 0.5); for (const s of [-1, 1]) { const ex = s < 0 ? x - 10 : x + w + 6; ctx.fillRect(ex, y + rh - 8, 4, 4); ctx.fillRect(ex + (s < 0 ? -2 : 2), y + rh - 12, 4, 4); } }
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

/* ---------- enfeites de cada região ---------- */
// desenha as variações (peça central, árvores, postes) e os enfeites próprios; devolve false se não conhece o tipo
function drawStyled(k, d, x, y, t) {
  const sh = (w, h = 5) => { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y + 2, w, h, 0, 0, 7); ctx.fill(); };
  switch (k) {
    case 'shrine': { // portal torii com duas lanternas de pedra
      sh(46, 12);
      ctx.fillStyle = '#b8342a'; ctx.fillRect(x - 30, y - 56, 7, 56); ctx.fillRect(x + 23, y - 56, 7, 56);
      ctx.fillStyle = '#2a2020'; ctx.fillRect(x - 42, y - 66, 84, 6); ctx.fillStyle = '#b8342a'; ctx.fillRect(x - 36, y - 58, 72, 5); ctx.fillRect(x - 3, y - 60, 6, 6);
      for (const s of [-1, 1]) { const lx = x + s * 46; ctx.fillStyle = STONE.dk; ctx.fillRect(lx - 4, y - 18, 8, 18); ctx.fillStyle = STONE.lt; ctx.fillRect(lx - 9, y - 28, 18, 10); ctx.fillRect(lx - 11, y - 32, 22, 4);
        ctx.fillStyle = `rgba(255,200,110,${isNight() ? 0.9 : 0.5})`; ctx.fillRect(lx - 4, y - 26, 8, 6); }
      return true;
    }
    case 'bonfire': { // fogueira com troncos e pedras
      sh(30, 10);
      for (let a = 0; a < 8; a++) { ctx.fillStyle = a & 1 ? STONE.lt : STONE.md; ctx.beginPath(); ctx.arc(x + Math.cos(a * 0.785) * 22, y - 2 + Math.sin(a * 0.785) * 8, 5, 0, 7); ctx.fill(); }
      ctx.fillStyle = WOOD.md; ctx.fillRect(x - 14, y - 8, 28, 5); ctx.save(); ctx.translate(x, y - 6); ctx.rotate(0.6); ctx.fillRect(-14, -2, 28, 5); ctx.restore();
      for (let k = 0; k < 5; k++) { const f = Math.sin(t * 9 + k * 1.7) * 3; ctx.fillStyle = ['#f97316', '#fbbf24', '#ef4444', '#fde68a', '#f97316'][k]; ctx.beginPath(); ctx.moveTo(x - 10 + k * 5, y - 8); ctx.lineTo(x - 8 + k * 5 + f * 0.3, y - 26 - f - (k === 2 ? 8 : 0)); ctx.lineTo(x - 5 + k * 5, y - 8); ctx.fill(); }
      for (let k = 0; k < 3; k++) { const p = (t * 0.9 + k / 3) % 1; ctx.fillStyle = `rgba(251,191,36,${(1 - p).toFixed(2)})`; ctx.fillRect(x - 6 + k * 6 + Math.sin(t * 3 + k) * 4, y - 28 - p * 40, 2, 2); } // fagulhas
      ctx.fillStyle = `rgba(255,170,80,${isNight() ? 0.2 : 0.08})`; ctx.beginPath(); ctx.arc(x, y - 14, isNight() ? 70 : 34, 0, 7); ctx.fill();
      return true;
    }
    case 'clock': { // torre do relógio moderna
      sh(22, 8);
      ctx.fillStyle = '#4b5563'; ctx.fillRect(x - 12, y - 78, 24, 78); ctx.fillStyle = '#6b7280'; ctx.fillRect(x - 12, y - 78, 6, 78);
      ctx.fillStyle = '#e5e7eb'; ctx.beginPath(); ctx.arc(x, y - 62, 9, 0, 7); ctx.fill();
      const hr = t * 0.05, mn = t * 0.6; ctx.strokeStyle = '#111827'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 62); ctx.lineTo(x + Math.sin(hr) * 5, y - 62 - Math.cos(hr) * 5); ctx.moveTo(x, y - 62); ctx.lineTo(x + Math.sin(mn) * 7, y - 62 - Math.cos(mn) * 7); ctx.stroke();
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(x - 16, y - 82, 32, 5); ctx.fillStyle = '#c9a227'; ctx.fillRect(x - 2, y - 92, 4, 10);
      return true;
    }
    case 'tower': { // mini torre de ferro (a Torre Prisma de Lumiose)
      sh(30, 9);
      ctx.strokeStyle = '#3f4756'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 24, y); ctx.lineTo(x - 4, y - 90); ctx.moveTo(x + 24, y); ctx.lineTo(x + 4, y - 90); ctx.stroke();
      ctx.lineWidth = 2; for (const hh of [18, 40, 62]) { const ww = 24 - hh * 0.22; ctx.beginPath(); ctx.moveTo(x - ww, y - hh); ctx.lineTo(x + ww, y - hh); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x, y, 14, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = `hsl(${(t * 40) % 360},80%,70%)`; ctx.fillRect(x - 3, y - 98, 6, 8);
      return true;
    }
    case 'well': { // poço de pedra com telhadinho
      sh(26, 9);
      ctx.fillStyle = STONE.dk; ctx.beginPath(); ctx.ellipse(x, y - 4, 22, 9, 0, 0, 7); ctx.fill(); ctx.fillStyle = STONE.md; ctx.fillRect(x - 22, y - 20, 44, 16); ctx.fillStyle = '#1f3a52'; ctx.beginPath(); ctx.ellipse(x, y - 20, 18, 6, 0, 0, 7); ctx.fill();
      for (let k = 0; k < 5; k++) { ctx.fillStyle = STONE.lt; ctx.fillRect(x - 20 + k * 9, y - 18 + (k & 1) * 6, 7, 4); }
      ctx.fillStyle = WOOD.dk; ctx.fillRect(x - 20, y - 52, 4, 32); ctx.fillRect(x + 16, y - 52, 4, 32); ctx.fillRect(x - 20, y - 46, 40, 3);
      ctx.fillStyle = '#b89a5a'; ctx.beginPath(); ctx.moveTo(x - 28, y - 50); ctx.lineTo(x, y - 66); ctx.lineTo(x + 28, y - 50); ctx.fill();
      ctx.fillStyle = WOOD.md; ctx.fillRect(x - 3, y - 44, 6, 8);
      return true;
    }
    case 'tiles': { // fonte de azulejos azuis (Paldea)
      sh(44, 16);
      ctx.fillStyle = '#e8e2d6'; ctx.beginPath(); ctx.ellipse(x, y - 2, 42, 18, 0, 0, 7); ctx.fill();
      for (let a = 0; a < 16; a++) { ctx.fillStyle = a & 1 ? '#2f5fa8' : '#f4f1ea'; ctx.fillRect(x + Math.cos(a * 0.3927) * 38 - 3, y - 2 + Math.sin(a * 0.3927) * 15 - 3, 6, 6); }
      ctx.fillStyle = '#3d7fb8'; ctx.beginPath(); ctx.ellipse(x, y - 2, 30, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2f5fa8'; ctx.fillRect(x - 5, y - 30, 10, 28); ctx.fillStyle = '#f4f1ea'; ctx.fillRect(x - 5, y - 26, 10, 3); ctx.fillRect(x - 5, y - 16, 10, 3);
      ctx.fillStyle = '#8fc6ee'; for (let k = 0; k < 6; k++) { const p = (t * 1.4 + k / 6) % 1, a = k / 6 * Math.PI * 2; ctx.fillRect(x + Math.cos(a) * p * 14 - 1, y - 32 + p * p * 28 + Math.sin(a) * p * 4, 2, 3); }
      return true;
    }
    case 'cherry': case 'orange': case 'topiary': case 'oak': {
      if (k === 'topiary') { sh(14, 5); ctx.fillStyle = '#7a5434'; ctx.fillRect(x - 8, y - 10, 16, 10); ctx.fillStyle = '#2f6b3a'; ctx.beginPath(); ctx.moveTo(x - 13, y - 10); ctx.lineTo(x, y - 62); ctx.lineTo(x + 13, y - 10); ctx.fill(); ctx.fillStyle = '#3f8a4a'; ctx.beginPath(); ctx.moveTo(x - 6, y - 14); ctx.lineTo(x, y - 56); ctx.lineTo(x + 2, y - 14); ctx.fill(); return true; }
      ctx.drawImage(treeImg(TK.TREE, 1, Math.abs(d.x) % 4), x - 32, y - 76);
      const dots = k === 'cherry' ? ['#f9a8d4', '#fbcfe8', '#f472b6'] : ['#f59e0b', '#fb923c', '#fbbf24'];
      for (let i = 0; i < (k === 'cherry' ? 22 : 9); i++) { ctx.fillStyle = dots[i % 3]; ctx.fillRect(x - 22 + hash(i, d.x) * 44, y - 72 + hash(d.y, i) * 40, k === 'cherry' ? 4 : 5, k === 'cherry' ? 4 : 5); }
      return true;
    }
    case 'palm': {
      sh(14, 4);
      ctx.strokeStyle = '#8b6a43'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y - 36, x + 2, y - 70); ctx.stroke();
      ctx.strokeStyle = '#6b4f30'; ctx.lineWidth = 1; for (let k = 1; k < 8; k++) { ctx.beginPath(); ctx.moveTo(x - 3 + k * 0.6, y - k * 9); ctx.lineTo(x + 4 + k * 0.6, y - k * 9); ctx.stroke(); }
      for (let a = 0; a < 6; a++) { const an = -Math.PI / 2 + (a - 2.5) * 0.55 + Math.sin(t * 1.5 + a) * 0.05; ctx.strokeStyle = a & 1 ? '#2f8a3a' : '#3fa04a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 2, y - 70); ctx.quadraticCurveTo(x + 2 + Math.cos(an) * 22, y - 70 + Math.sin(an) * 22 - 6, x + 2 + Math.cos(an) * 34, y - 70 + Math.sin(an) * 30 + 14); ctx.stroke(); }
      return true;
    }
    case 'pine': ctx.drawImage(treeImg(TK.PINE, 1, Math.abs(d.x) % 4), x - 32, y - 76); ctx.fillStyle = '#f2f6f9'; ctx.fillRect(x - 10, y - 74, 20, 4); ctx.fillRect(x - 16, y - 52, 8, 3); ctx.fillRect(x + 8, y - 44, 8, 3); return true;
    case 'lantern': { // poste com lanterna de papel vermelha
      post(x, y, 46);
      ctx.fillStyle = '#b8342a'; ctx.beginPath(); ctx.ellipse(x, y - 54, 8, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a2020'; ctx.fillRect(x - 6, y - 65, 12, 3); ctx.fillRect(x - 6, y - 45, 12, 3);
      ctx.fillStyle = `rgba(255,140,90,${isNight() ? 0.25 : 0.1})`; ctx.beginPath(); ctx.arc(x, y - 54, isNight() ? 40 : 20, 0, 7); ctx.fill();
      return true;
    }
    case 'ornate': case 'modern': {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 6, y - 2, 13, 4);
      const col = k === 'ornate' ? '#1f2937' : '#9ca3af'; ctx.fillStyle = col; ctx.fillRect(x - 2, y - 58, 4, 58); ctx.fillRect(x - 5, y - 4, 10, 4);
      if (k === 'ornate') { ctx.fillRect(x - 14, y - 58, 28, 3); for (const s of [-1, 1]) { ctx.fillStyle = col; ctx.fillRect(x + s * 12 - 4, y - 70, 8, 12); ctx.fillStyle = 'rgba(255,220,140,.9)'; ctx.fillRect(x + s * 12 - 2, y - 68, 4, 8); } }
      else { ctx.fillRect(x, y - 60, 16, 3); ctx.fillStyle = '#f8fafc'; ctx.fillRect(x + 10, y - 58, 8, 3); }
      ctx.fillStyle = `rgba(255,230,170,${isNight() ? 0.2 : 0.06})`; ctx.beginPath(); ctx.arc(x, y - 60, isNight() ? 46 : 22, 0, 7); ctx.fill();
      return true;
    }
    case 'bamboo': sh(16, 4); for (let i = 0; i < 5; i++) { const bx = x - 12 + i * 6, hh = 60 + (i % 3) * 14; ctx.fillStyle = i & 1 ? '#5f9a3a' : '#7fb54a'; ctx.fillRect(bx, y - hh, 4, hh); ctx.fillStyle = '#3f6a2a'; for (let yy = y - hh + 12; yy < y; yy += 14) ctx.fillRect(bx, yy, 4, 2); ctx.fillStyle = '#6fae4a'; ctx.fillRect(bx + 3, y - hh + 6, 8, 3); } return true;
    case 'parasol': sh(18, 5); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x - 1, y - 44, 3, 44); for (let i = 0; i < 6; i++) { ctx.fillStyle = i & 1 ? '#f8fafc' : d.c; ctx.beginPath(); ctx.moveTo(x, y - 52); ctx.arc(x, y - 40, 26, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6); ctx.fill(); } return true;
    case 'snowman': sh(14, 4); ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(x, y - 12, 12, 0, 7); ctx.arc(x, y - 30, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#111827'; ctx.fillRect(x - 4, y - 33, 2, 2); ctx.fillRect(x + 2, y - 33, 2, 2); ctx.fillStyle = '#f97316'; ctx.fillRect(x, y - 30, 5, 2); ctx.fillStyle = '#b8342a'; ctx.fillRect(x - 8, y - 23, 16, 3); return true;
    case 'hydrant': sh(8, 3); ctx.fillStyle = '#c53030'; ctx.fillRect(x - 5, y - 18, 10, 18); ctx.fillRect(x - 8, y - 12, 16, 4); ctx.beginPath(); ctx.arc(x, y - 18, 5, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x - 1, y - 24, 2, 3); return true;
    case 'cafe': sh(22, 6); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x - 1, y - 40, 2, 32); for (let i = 0; i < 6; i++) { ctx.fillStyle = i & 1 ? '#f8fafc' : '#2f4a7a'; ctx.fillRect(x - 24 + i * 8, y - 46, 8, 6); } ctx.fillStyle = '#8b5e3c'; ctx.fillRect(x - 12, y - 16, 24, 3); ctx.fillRect(x - 2, y - 13, 3, 11); for (const s of [-1, 1]) { ctx.fillStyle = '#1f2937'; ctx.fillRect(x + s * 18 - 3, y - 12, 6, 2); ctx.fillRect(x + s * 18 - 3, y - 12, 2, 12); } return true;
    case 'hay': sh(20, 6); for (const [hx, hy] of [[-9, 0], [9, 0], [0, -12]]) { ctx.fillStyle = '#d4b45a'; ctx.fillRect(x + hx - 10, y + hy - 12, 20, 12); ctx.fillStyle = '#b8963f'; for (let k = 0; k < 4; k++) ctx.fillRect(x + hx - 9 + k * 5, y + hy - 12, 1, 12); ctx.fillStyle = '#8b6a2a'; ctx.fillRect(x + hx - 10, y + hy - 7, 20, 2); } return true;
    case 'pot': sh(16, 5); for (const [px, s] of [[-9, 1], [9, 0.8]]) { ctx.fillStyle = '#c4622d'; ctx.beginPath(); ctx.moveTo(x + px - 8 * s, y - 16 * s); ctx.lineTo(x + px + 8 * s, y - 16 * s); ctx.lineTo(x + px + 6 * s, y); ctx.lineTo(x + px - 6 * s, y); ctx.fill(); ctx.fillStyle = '#3f8a3a'; ctx.beginPath(); ctx.ellipse(x + px, y - 20 * s, 10 * s, 7 * s, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f59e0b'; ctx.fillRect(x + px - 3, y - 24 * s, 3, 3); } return true;
  }
  return false;
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
// peças de um portão para ordenar na tela: cada poste da cerquinha e os dois postes grandes na própria altura;
// a trave vai junto do poste mais à frente (mais embaixo na tela)
function gateParts(g) {
  const parts = [];
  for (const s of [1, -1]) {
    // cada poste leva as tábuas até o próximo (de dentro para fora), para a cerca parecer contínua
    for (let k = 0; k <= 3; k++) {
      const d = 46 + k * 16, n = d + 16;
      parts.push({ k: 'gpost', h: k ? 20 : 58, x: g.x + g.tx * s * d, y: g.y + g.ty * s * d, rx: k < 3 ? g.tx * s * 16 : 0, ry: k < 3 ? g.ty * s * 16 : 0 });
    }
  }
  for (const p of parts) p.sy = p.y;
  parts.push({ ...g, sy: g.y + Math.abs(g.ty) * 46 + 1 });
  return parts;
}
const decorSy = d => (d.k === 'gate' ? d.y + Math.abs(d.ty) * 46 : d.k === 'tree' ? d.y + 6 : d.k === 'stall' ? d.y + 16 : d.y);
function rebuildTownDecor() {
  for (let i = TOWN_DECOR.length - 1; i >= 0; i--) if (TOWN_DECOR[i].k === 'gate' || TOWN_DECOR[i].reg) TOWN_DECOR.splice(i, 1);
  for (const e of townStyle().extra || []) TOWN_DECOR.push({ ...e, reg: 1 });
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
  const x = Math.round(d.x + ox), y = Math.round(d.y + oy), t = G.time, S = townStyle();
  const k = d.k === 'fountain' ? S.center : d.k === 'tree' ? S.tree : d.k === 'lamp' ? S.lamp : d.k;
  if (k !== d.k && drawStyled(k, d, x, y, t)) return;
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
      const awn = (S.awn && S.awn[d.x < 0 ? 0 : 1]) || d.awn;
      for (let k = 0; k < 7; k++) { ctx.fillStyle = k & 1 ? '#efe6d2' : awn; ctx.fillRect(x - 32 + k * 9, y - 40, 9, 12); }
      for (let k = 0; k < 7; k++) { ctx.fillStyle = k & 1 ? '#efe6d2' : awn; ctx.beginPath(); ctx.arc(x - 27.5 + k * 9, y - 28, 4.5, 0, Math.PI); ctx.fill(); }
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
    case 'gpost': { // poste do portão ou da cerquinha (cada um na sua profundidade), com as tábuas até o próximo
      if (d.rx || d.ry) for (const hh of [8, 15]) {
        ctx.strokeStyle = WOOD.dk; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - hh); ctx.lineTo(x + d.rx, y + d.ry - hh); ctx.stroke();
        ctx.strokeStyle = WOOD.lt; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - hh - 1); ctx.lineTo(x + d.rx, y + d.ry - hh - 1); ctx.stroke();
      }
      post(x, y, d.h);
      break;
    }
    case 'gate': {
      // só a trave, as flâmulas e a placa: os postes são desenhados à parte (gateParts)
      const p1x = x + d.tx * 46, p1y = y + d.ty * 46, p2x = x - d.tx * 46, p2y = y - d.ty * 46;
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
