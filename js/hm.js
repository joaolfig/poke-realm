'use strict';
/* ============ HMs, pontos de voo, baús secretos e habilidades ============
 * As HMs são itens-chave reutilizáveis (P.hms). Cada companheiro só aprende
 * as HMs que aprenderia nos jogos (lista de golpes da PokeAPI: POKE[id].hm).
 * Só o companheiro ATIVO e que conhece a HM permite usar o efeito.
 */
// move = nome do golpe na PokeAPI (usado para saber quem pode aprender)
// Só 4 HMs, cada uma com um papel claro. Fly ficou nas montarias voadoras (como no Let's Go).
// As HMs só vêm da história (uma por ginásio) e valem só na região onde foram ganhas (P.hms é da região atual).
// Elas abrem o caminho entre as zonas: Cut -> zona 2, Rock Smash -> zona 3, Surf -> zona 4.
// A zona 5 fica atrás do Portão da Liga, que só abre com 7 insígnias.
// Ordem padrão (medida nos mapas): Cut no 1º (o 2º ginásio já fica na zona 2), Flash no 2º,
// Rock Smash no 4º (zona 3 começa no Nv 14: 5º ginásio e 2ª cidade), Surf no 6º (zona 4: 7º ginásio).
// Hoenn tem ordem própria: a 2ª cidade (Porto dos Lírios) só se alcança pelo mar, então Surf vem no 4º.
const HM_GYM_BASE = { 1: 'cut', 2: 'flash', 4: 'smash', 6: 'surf' };
const HM_GYM = { ...HM_GYM_BASE };
const hmGymOf = k => +Object.keys(HM_GYM).find(n => HM_GYM[n] === k);
const HM_ZONE = { cut: 2, smash: 3, surf: 4 };
const HM_ICON = { cut: '✂️', smash: '🪨', surf: '🌊', flash: '💡', fly: '🪶' };
// fala do líder ao entregar cada HM
const HM_LINES = {
  cut: () => 'Leve esta HM e corte os arbustos que fecham a estrada. Daqui pra frente, o caminho só se abre para quem sabe usar Cut.',
  smash: () => 'Rochas rachadas bloqueiam as passagens para as terras mais altas. Rock Smash abre caminho por elas.',
  flash: () => 'Alguns ginásios são escuros como breu, e a noite aqui não perdoa. Com Flash você enxerga o que os outros não veem.',
  surf: () => 'Um rio fundo separa as terras mais perigosas. Com Surf, seu companheiro te leva pela água até lá.',
};
// o que falta para chegar a uma zona
function needFor(P, z) {
  const miss = [];
  if (z >= 2 && !P.hms.includes('cut')) miss.push('Cut');
  if (z >= 3 && !P.hms.includes('smash')) miss.push('Rock Smash');
  if (z >= 4 && !P.hms.includes('surf')) miss.push('Surf');
  if (z >= 5 && badgeCount(P) < 7) miss.push(`7 insígnias (você tem ${badgeCount(P)})`);
  return miss;
}
// lista de caminhos para o guia da vila
function pathChecklist(P) {
  const row = (ok, txt) => `<div class="small" style="color:${ok ? '#86efac' : '#fca5a5'}">${ok ? '✔' : '✖'} ${txt}</div>`;
  return '<h4>Caminhos</h4>'
    + row(P.hms.includes('cut'), `✂️ Cut abre as rotas para ${ZONES[2].nome} (${hmGymOf('cut')}º ginásio)`)
    + row(P.hms.includes('smash'), `🪨 Rock Smash abre as rotas para ${ZONES[3].nome} (${hmGymOf('smash')}º ginásio)`)
    + row(P.hms.includes('surf'), `🌊 Surf atravessa o rio até ${ZONES[4].nome}, o mar e as ilhas distantes (${hmGymOf('surf')}º ginásio)`)
    + row(badgeCount(P) >= 7, `🏅 O Portão da Liga para ${ZONES[5].nome} abre com 7 insígnias (você tem ${badgeCount(P)})`)
    + row(P.hms.includes('flash'), `💡 Flash ilumina ginásios escuros, a noite e a névoa (${hmGymOf('flash')}º ginásio)`)
    + row(P.hms.includes('fly'), `🪶 Fly leva você a qualquer cidade já visitada com [V] (missão em ${TOWNS[1] ? TOWNS[1].nome : 'outra cidade'})`)
    + '<div class="small">HMs só funcionam com um companheiro que as saiba fora da Poké Ball (ensine no painel). Os bloqueios aparecem no minimapa.</div>';
}
const HMS = {
  cut: { mo: 'HM01', move: 'cut', nome: 'Cut', icon: '✂️', preco: 120, ch: 0, desc: 'Corta arvorezinhas que bloqueiam atalhos e baús ([E] perto delas).' },
  surf: { mo: 'HM02', move: 'surf', nome: 'Surf', icon: '🌊', preco: 300, ch: 3, desc: 'Atravesse águas fundas montado no companheiro. Surfando, [E] nos pontos escuros mergulha atrás de tesouros.' },
  smash: { mo: 'HM03', move: 'rock-smash', nome: 'Rock Smash', icon: '🪨', preco: 150, ch: 0, desc: 'Quebra rochas rachadas ([E]); às vezes há itens dentro.' },
  fly: { mo: 'HM05', move: 'fly', nome: 'Fly', icon: '🪶', preco: 0, ch: 5, desc: 'Com um companheiro voador fora da Poké Ball que saiba Fly, [V] leva você a qualquer cidade já visitada.' },
  flash: { mo: 'HM04', move: 'flash', nome: 'Flash', icon: '💡', preco: 200, ch: 2, desc: 'Ilumina masmorras escuras e a noite, e dissipa a névoa das áreas sombrias.' },
};
const HM_KEYS = Object.keys(HMS);
const HM_MOVES = Object.fromEntries(Object.entries(HMS).map(([k, h]) => [h.move, k]));
const activePet = P => (P && P.petIdx >= 0 ? P.pets[P.petIdx] || null : null);
// Fly: qualquer Pokémon do tipo Voador aprende
const canLearn = (pid, k) => !!(POKE[pid] && (k === 'fly' ? POKE[pid].types.includes('flying') : POKE[pid].hm && POKE[pid].hm.includes(k)));
// qualquer companheiro fora da Pokébola que saiba a HM serve (desde que você tenha a HM desta região)
function petKnows(P, k) {
  if (!P || !P.hms.includes(k) || G.evo) return false;
  return G.allies.some(a => a.pet && P.pets[a.slot] && (P.pets[a.slot].hms || []).includes(k));
}
const petIsFlyer = pid => !!(POKE[pid] && POKE[pid].types.includes('flying') && !POKE[pid].types.includes('water'));
// 1 = pode entrar na água funda, 2 = pode subir cachoeira
const swimFlags = P => (petKnows(P, 'surf') || ridingFlyer(P) ? 1 : 0);
const ridingFlyer = P => !!(P.riding && activePet(P) && rideFlies(activePet(P).pid));

function giveHM(P, k) {
  if (P.hms.includes(k)) return;
  P.hms.push(k);
  const opens = HM_ZONE[k] ? ` Ela abre o caminho para ${ZONES[HM_ZONE[k]].nome}.` : k === 'flash' ? ' Ela ilumina ginásios escuros e a névoa.' : k === 'fly' ? ' Com ela, [V] leva você a qualquer cidade já visitada.' : '';
  G.toasts.push({ text: `📀 Você recebeu a ${HMS[k].mo} ${HMS[k].nome}!${opens}`, color: '#93c5fd', t: 7, big: 1 });
  G.toasts.push({ text: `👉 No painel, em Companheiros, aperte +${HMS[k].icon} para ensinar ${HMS[k].nome} (o botão está piscando).`, color: '#fde68a', t: 9 });
  P.hmTeach = k; // destaca os botões de ensinar até alguém aprender
  if (!P.pets.some(pt => canLearn(pt.pid, k))) G.toasts.push({ text: `Nenhum companheiro seu pode aprender ${HMS[k].nome}. Capture um Pokémon ${k === 'fly' ? 'do tipo Voador' : 'compatível'}!`, color: '#fca5a5', t: 9 });
  sfx('lvl');
  G.dirty = true;
}
function teachHM(i, k) {
  const P = G.P, pt = P.pets[i];
  if (!pt || !P.hms.includes(k) || !canLearn(pt.pid, k)) return;
  pt.hms = pt.hms || [];
  if (pt.hms.includes(k)) return;
  pt.hms.push(k);
  if (P.hmTeach === k) P.hmTeach = null;
  G.toasts.push({ text: `${HMS[k].icon} ${pt.name} aprendeu ${HMS[k].nome}! Deixe ${pt.name} fora da Poké Ball para usar.`, color: '#93c5fd', t: 4 });
  sfx('lvl');
  saveGame();
}

/* ---------- Pontos de voo (descobertos ao passar perto) ---------- */
const LANDMARKS = [
  { id: 'vila', nome: 'Vila', at: [9, 11.12] },
  { id: 'campos', nome: 'Acampamento dos Campos', at: [12, 10.5] },
  { id: 'lago', nome: 'Mirante da Floresta', at: [8.5, 7.5] },
  { id: 'clareira', nome: 'Clareira do Oeste', at: [2.5, 7.5] },
  { id: 'leste', nome: 'Posto do Leste', at: [16.5, 7.5] },
  { id: 'refugio', nome: 'Refúgio da Montanha', at: [8, 5.5] },
  { id: 'pico', nome: 'Pico do Norte', at: [10.5, 2] },
  { id: 'ruinas', nome: 'Ruínas do Noroeste', at: [3, 3] },
  { id: 'torre', nome: 'Torre do Leste', at: [17, 3] },
].map(l => { const [x, y] = cellPt(...l.at); return { ...l, x, y }; });

function updateHM(dt) {
  const P = G.P;
  for (const c of G.cuts) if (G.time > c.t && !(P && Math.hypot(P.x - c.x, P.y - c.y) < 60)) { TT[c.i] = c.k; c.done = true; }
  G.cuts = G.cuts.filter(c => !c.done);
  if (!P) return;
  P.flyCd = Math.max(0, (P.flyCd || 0) - dt);
  G.nearHM = nearHM(P);
  updateFog(dt);
  // [R] volta para a última cidade em que o jogador esteve
  if (!inDungeonArea(P.x)) { const t = townAt(P.x, P.y); if (t && P.lastTown !== t.i) { P.lastTown = t.i; G.dirty = true; } }
  for (const l of LANDMARKS) {
    if (P.fly.includes(l.id) || Math.hypot(P.x - l.x, P.y - l.y) > 260) continue;
    P.fly.push(l.id);
    questProgress('explorar', { id: l.id });
    G.toasts.push({ text: `📍 Ponto de voo descoberto: ${l.nome}`, color: '#93c5fd', t: 3.5 });
    saveGame();
  }
}

function drawLandmarks(ox, oy) {
  for (const l of LANDMARKS) {
    if (l.id === 'vila' || l.id === 'town2') continue;
    const x = l.x + 46 + ox, y = l.y - 30 + oy;
    if (x < -80 || y < -80 || x > W + 80 || y > H + 80) continue;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 16, 26, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b45309'; ctx.beginPath(); ctx.moveTo(x - 22, y + 14); ctx.lineTo(x, y - 18); ctx.lineTo(x + 22, y + 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7c2d12'; ctx.beginPath(); ctx.moveTo(x - 5, y + 14); ctx.lineTo(x, y - 4); ctx.lineTo(x + 5, y + 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6b4423'; ctx.fillRect(x - 40, y - 2, 4, 18);
    ctx.fillStyle = '#a16207'; ctx.fillRect(x - 50, y - 10, 24, 12);
    ctx.font = '9px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('🪶', x - 38, y - 1);
    const known = G.P && G.P.fly.includes(l.id);
    ctx.font = 'bold 10px Barlow Semi Condensed, system-ui'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = known ? '#93c5fd' : '#cbd5e1';
    outlined(l.nome, x, y - 24);
  }
}

function openFly() {
  const P = G.P;
  if (inDungeonArea(P.x)) return G.toasts.push({ text: 'Não dá para voar dentro de uma masmorra.', color: '#fca5a5', t: 2 });
  if (!P.hms.includes('fly')) return G.toasts.push({ text: `Você ainda não tem a HM05 Fly. Ela é entregue em ${TOWNS[1] ? TOWNS[1].nome : 'outra cidade'} durante a história.`, color: '#fca5a5', t: 3.5 });
  if (!petKnows(P, 'fly')) return G.toasts.push({ text: 'Para voar, deixe fora da Poké Ball um companheiro voador que saiba Fly (ensine no painel).', color: '#fca5a5', t: 3 });
  if (P.flyCd > 0) return G.toasts.push({ text: `Seu companheiro está cansado. Fly de novo em ${Math.ceil(P.flyCd)}s.`, color: '#fca5a5', t: 2 });
  G.npcOpen = 'fly'; G.npcRef = null;
  $('npc').classList.remove('hidden');
  renderNPC();
}
function renderFly(P) {
  const rows = LANDMARKS.filter(l => P.fly.includes(l.id)).map(l => {
    const d0 = Math.round(Math.hypot(l.x - P.x, l.y - P.y) / 32);
    return `<div class="shoprow"><span>📍 ${l.nome} <i>${d0}m</i></span><button data-act="fly:${l.id}">Fly</button></div>`;
  }).join('');
  const pt = P.pets.find((x, i) => P.petAct.includes(i) && (x.hms || []).includes('fly')) || activePet(P);
  return `<div class="npc-head"><span>🪶 <b>Fly com ${esc(pt ? pt.name : '')}</b></span><button data-act="close" title="Fechar (Esc)">✕</button></div>
    ${rows}<div class="small">Toda cidade que você visita vira um destino. Novas cidades aparecem quando você passa perto delas.</div>`;
}
function flyTo(P, id) {
  const l = LANDMARKS.find(x => x.id === id);
  if (!l || !P.fly.includes(id) || !petKnows(P, 'fly')) return;
  closeNPC();
  const pt = P.pets.find((x, i) => P.petAct.includes(i) && (x.hms || []).includes('fly')) || activePet(P);
  burst(P.x, P.y, '#e0f2fe', 30);
  P.x = l.x + rand(-20, 20); P.y = l.y + rand(14, 30);
  const tw = townAt(P.x, P.y); if (tw) P.lastTown = tw.i;
  G.cam.x = P.x; G.cam.y = P.y;
  burst(P.x, P.y, '#e0f2fe', 30);
  G.shake = 6;
  P.flyCd = 15;
  G.toasts.push({ text: `🪶 ${pt.name} usou Fly! Você pousou em ${l.nome}.`, color: '#93c5fd', t: 3 });
  sfx('pot');
}

/* ---------- Obstáculos de HM ---------- */
const tileXY = i => [(i % NX - OX + 0.5) * TILE, (Math.floor(i / NX) - OY + 0.5) * TILE];
const HM_TILE = { [TK.CUTTREE]: 'cut', [TK.CRACKED]: 'smash', [TK.DIVE]: 'dive', [TK.CHEST]: 'chest' };
const hmNeed = k => (k === 'dive' ? 'surf' : k);
function nearHM(P) {
  if (inDungeonArea(P.x)) return null;
  const tx = Math.floor(P.x / TILE), ty = Math.floor(P.y / TILE);
  let best = null, bd = 58;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const i = tIdx(tx + dx + OX, ty + dy + OY);
    if (i < 0 || !HM_TILE[TT[i]]) continue;
    const k = HM_TILE[TT[i]];
    if (k === 'dive' && (G.usedDive.has(i))) continue;
    if (k === 'chest') { const sc = SECRET_AT.get(i); if (!sc || P.chests.includes(sc.id)) continue; }
    const d0 = Math.hypot((tx + dx + 0.5) * TILE - P.x, (ty + dy + 0.5) * TILE - P.y);
    if (d0 < bd) { bd = d0; best = { k, i }; }
  }
  return best;
}
function hmHint(P, h) {
  if (h.k === 'chest') return '[E] Abrir o baú';
  const H = HMS[hmNeed(h.k)];
  if (petKnows(P, hmNeed(h.k))) return { cut: '[E] Cortar a árvore', smash: '[E] Quebrar a rocha', dive: '[E] Mergulhar' }[h.k];
  const what = { cut: 'Árvore cortável', smash: 'Rocha rachada', dive: 'Ponto de mergulho' }[h.k];
  if (!P.hms.includes(hmNeed(h.k))) { const g = Object.keys(HM_GYM).find(n => HM_GYM[n] === hmNeed(h.k)); return `${what}: você ganha ${H.nome} (${H.mo}) ao vencer o ${g}º ginásio de ${REGION.nome}`; }
  return `${what}: precisa de um companheiro fora da Pokébola que saiba ${H.nome} (${H.mo})`;
}
const zoneOf = P => { const z = zoneAt(P.x, P.y); return z >= 1 ? z : 1; };
function useHMTile(P, h) {
  if (h.k === 'chest') return openChest(P, h.i);
  if (!petKnows(P, hmNeed(h.k))) { G.toasts.push({ text: hmHint(P, h), color: '#fca5a5', t: 3 }); return; }
  const pt = activePet(P);
  if (h.k === 'dive') {
    if (!isDeep(P.x, P.y)) { text(P.x, P.y - 40, 'Surfe até ficar em cima do ponto escuro', '#cbd5e1', 12); return; }
    G.usedDive.add(h.i);
    const items = [stone(pick(TYPES)), genItem(clamp(zoneOf(P) + 1, 0, 6)), Math.random() < 0.3 ? consItem('ultra') : consItem('doce')];
    G.bags.push({ x: P.x, y: P.y + 10, items, life: 60 });
    G.toasts.push({ text: `🤿 ${pt.name} mergulhou e trouxe um tesouro do fundo!`, color: '#93c5fd', t: 3 });
    burst(P.x, P.y, '#93c5fd', 30);
    sfx('pot');
    return;
  }
  emitEvent({ t: 'cut', i: h.i });
  text(P.x, P.y - 44, `${pt.name} usou ${HMS[hmNeed(h.k)].nome}!`, '#86efac', 13);
  sfx('crit');
  const r = Math.random();
  if (h.k === 'smash' ? r < 0.3 : r < 0.12) G.bags.push({ x: P.x + rand(-20, 20), y: P.y + 20, items: [r < 0.06 ? consItem('grande') : h.k === 'smash' && r < 0.15 ? stone(pick(TYPES)) : potion()], life: 60 });
}
function cutTile(i) {
  const k = TT[i];
  if (k !== TK.CUTTREE && k !== TK.CRACKED) return;
  TT[i] = TK.GRASS;
  const [x, y] = tileXY(i);
  G.cuts.push({ i, k, x, y, t: G.time + 150 });
  if (k === TK.CUTTREE) { burst(x, y, '#3f9b4a', 18); burst(x, y, '#6b4423', 8); } else { burst(x, y, '#8b8378', 26); G.shake = 4; }
}
// baús dos esconderijos: cada um abre uma vez por personagem
function openChest(P, i) {
  const sc = SECRET_AT.get(i);
  if (!sc || P.chests.includes(sc.id)) return;
  P.chests.push(sc.id);
  const z = Math.max(1, sc.zone);
  const items = [genItem(clamp(z + 2, 0, 6)), genItem(clamp(z + 1, 0, 6)), consItem('doce'), statPot()];
  if (z >= 3) items.push(consItem('ultra'));
  const gold = 60 * z;
  P.gold += gold;
  G.bags.push({ x: P.x, y: P.y + 16, items, life: 120 });
  G.toasts.push({ text: `🎁 Baú secreto aberto! +${gold} 🪙 e tesouros`, color: '#facc15', t: 4, big: 1 });
  sfx('lvl');
  saveGame();
}
function drawChests(ox, oy) {
  const P = G.P;
  for (const sc of SECRETS) {
    const x = sc.x + ox, y = sc.y + oy;
    if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
    const open = P && P.chests.includes(sc.id);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 14, y + 8, 28, 5);
    ctx.fillStyle = '#7c4a1e'; ctx.fillRect(x - 13, y - 6, 26, 16);
    ctx.fillStyle = open ? '#3b2410' : '#a16207'; ctx.fillRect(x - 13, y - (open ? 14 : 12), 26, open ? 5 : 8);
    ctx.fillStyle = '#facc15'; ctx.fillRect(x - 2, y - 5, 4, 5);
    if (!open && Math.random() < 0.08) G.parts.push({ x: sc.x + rand(-12, 12), y: sc.y - 10, vx: 0, vy: -25, life: 0.7, color: '#fde047', size: 2 });
  }
}
// cachoeiras e pontos de mergulho são animados (desenhados a cada quadro)
function drawAnimTiles(ox, oy, tx0, tx1, ty0, ty1) {
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const i = tIdx(tx + OX, ty + OY);
    if (i < 0) continue;
    const k = TT[i], sx = tx * TILE + ox, sy = ty * TILE + oy;
    if (k === TK.WATERFALL) {
      ctx.fillStyle = '#3d86d8'; ctx.fillRect(sx, sy, TILE, TILE);
      ctx.fillStyle = '#bfe3ff';
      for (let c = 0; c < 4; c++) { const off = (G.time * 90 + c * 23 + tx * 7) % 40 - 8; ctx.fillRect(sx + 3 + c * 8, sy + off, 3, 10); }
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(sx, sy + TILE - 4, TILE, 4);
    } else if (k === TK.DIVE && !G.usedDive.has(i)) {
      ctx.fillStyle = 'rgba(8,20,60,.55)'; ctx.beginPath(); ctx.ellipse(sx + 16, sy + 16, 20, 13, 0, 0, 7); ctx.fill();
      if (Math.random() < 0.05) G.parts.push({ x: sx - ox + 16 + rand(-8, 8), y: sy - oy + 16, vx: 0, vy: -18, life: 0.8, color: '#e0f2fe', size: 2 });
    }
  }
}

/* ---------- Habilidades dos companheiros (efeitos de status) ---------- */
// st: 1 sono, 2 paralisia, 3 queimadura, 4 veneno, 5 congelado, 6 confusão
const STATUS = {
  1: { txt: 'fazer o inimigo dormir', label: '💤 Dormiu!', dur: 4, color: '#bfdbfe' },
  2: { txt: 'paralisar o inimigo', label: '⚡ Paralisado!', dur: 4, color: '#fde047' },
  3: { txt: 'queimar o inimigo', label: '🔥 Queimado!', dur: 4, color: '#fb923c' },
  4: { txt: 'envenenar o inimigo', label: '☠ Envenenado!', dur: 6, color: '#c084fc' },
  5: { txt: 'congelar o inimigo', label: '❄ Congelado!', dur: 2.5, color: '#a5f3fc' },
  6: { txt: 'confundir o inimigo', label: '💫 Confuso!', dur: 3, color: '#f9a8d4' },
};
const ABIL = [
  { ids: [39, 40, 174], nome: 'Canção de Ninar', st: 1, ch: 0.019 },
  { ids: [96, 97, 92, 93, 94, 280, 281, 282], nome: 'Hipnose', st: 1, ch: 0.016 },
  { ids: [12, 43, 44, 45, 182, 69, 70, 71], nome: 'Pó do Sono', st: 1, ch: 0.019 },
  { ids: [25, 26, 172, 125, 239, 179, 180, 181, 81, 82, 100, 101], nome: 'Estática', st: 2, ch: 0.052 },
  { ids: [77, 78, 126, 240, 37, 38, 58, 59, 4, 5, 6], nome: 'Corpo Chamejante', st: 3, ch: 0.065 },
  { ids: [13, 14, 15, 29, 30, 31, 32, 33, 34, 72, 73, 88, 89, 109, 110, 167, 168, 48, 49, 41, 42, 169], nome: 'Ponto Venenoso', st: 4, ch: 0.078 },
  { ids: [79, 80, 199, 63, 64, 65, 122], nome: 'Confusão', st: 6, ch: 0.039 },
];
const ABIL_BY_ID = {};
for (const a of ABIL) for (const id of a.ids) ABIL_BY_ID[id] = a;
// por tipo (quando a espécie não tem habilidade própria): paralisia só no Elétrico, queimadura só no Fogo,
// veneno só no Veneno e no Inseto, confusão só no Psíquico e no Fantasma (e o Gelo congela).
// Os outros tipos não causam status e batem com força total. A mesma regra vale para os golpes que acertam o jogador.
const TYPE_ABIL = {
  electric: { nome: 'Faísca', st: 2, ch: 0.033 }, fire: { nome: 'Brasa', st: 3, ch: 0.039 }, poison: { nome: 'Toxina', st: 4, ch: 0.046 },
  bug: { nome: 'Ferrão Venenoso', st: 4, ch: 0.033 }, psychic: { nome: 'Mente Confusa', st: 6, ch: 0.026 }, ghost: { nome: 'Raio Confuso', st: 6, ch: 0.026 },
  ice: { nome: 'Toque Gélido', st: 5, ch: 0.019 },
};
// quem causa status bate menos (quanto maior a chance, menor o dano: 12% de chance -> -18% de dano)
const abilDmgMul = ab => (ab ? 1 - Math.min(0.2, ab.ch * 1.5) : 1);
// ---------- status no jogador (golpes de Alfas e chefes) ----------
// 2 paralisado (mais lento e atira menos), 3 queimado (dano por segundo e bate menos), 4 envenenado (dano por segundo), 6 confuso (mira treme: ~60% dos tiros acertam)
const PLAYER_ST_CH = 0.03;
const PST = {
  2: { label: '⚡ Paralisado', dur: 4, color: '#fde047', fx: 'mais lento e atira menos', tint: 'sepia(1) saturate(7) hue-rotate(12deg) brightness(1.25)' },
  3: { label: '🔥 Queimado', dur: 4, color: '#fb923c', dot: 0.025, fx: 'perde vida e bate menos', tint: 'sepia(1) saturate(8) hue-rotate(-28deg) brightness(1.05)' },
  4: { label: '☠ Envenenado', dur: 6, color: '#c084fc', dot: 0.02, fx: 'perde vida', tint: 'sepia(1) saturate(5) hue-rotate(235deg) brightness(0.95)' },
  6: { label: '💫 Confuso', dur: 3, color: '#f9a8d4', fx: 'a mira treme', tint: 'sepia(1) saturate(4) hue-rotate(285deg) brightness(1.15)' },
};
// qual status cada tipo de ataque pode causar no jogador
const PST_BY_TYPE = { electric: 2, fire: 3, poison: 4, bug: 4, psychic: 6, ghost: 6 };
const pst = (P, st) => P && P.pstT > 0 && P.pst === st;
// filtro que pisca o boneco na cor do status (st = código do status, ou 0)
const pstTint = st => (st && PST[st] && Math.sin(G.time * 12) > -0.2 ? PST[st].tint : '');
function playerStatus(P, st) {
  if (!P || !PST[st] || P.pstT > 0 || P.pvp) return;
  P.pst = st; P.pstT = PST[st].dur; P.pdotT = 1;
  text(P.x, P.y - 50, PST[st].label + '!', PST[st].color, 15);
  sfx('hurt');
}
function curePlayerStatus(P) { if (P && P.pstT > 0) { P.pstT = 0; P.pst = 0; text(P.x, P.y - 50, '✨ Curado!', '#86efac', 13); } }
function updatePlayerStatus(P, dt) {
  if (!(P.pstT > 0)) return;
  P.pstT -= dt;
  const S = PST[P.pst];
  if (S && S.dot && (P.pdotT -= dt) <= 0) {
    P.pdotT = 1;
    // queimadura e veneno machucam, mas não matam sozinhos
    const dmg = Math.max(1, Math.min(P.hp - 1, Math.round(maxHP(P) * S.dot)));
    if (dmg > 0) { P.hp -= dmg; text(P.x, P.y - 34, `-${dmg}`, S.color, 12); }
  }
  if (Math.random() < 0.3) G.parts.push({ x: P.x + rand(-12, 12), y: P.y + rand(-16, 8), vx: 0, vy: -30, life: 0.5, color: S ? S.color : '#fff', size: 2 });
  if (P.pstT <= 0) P.pst = 0;
}
function petAbility(pid) {
  if (ABIL_BY_ID[pid]) return ABIL_BY_ID[pid];
  const p = POKE[pid];
  if (!p) return null;
  for (const t of p.types) if (TYPE_ABIL[t]) return TYPE_ABIL[t];
  return null;
}
// host: aplica o status (chefes não dormem, não congelam nem ficam confusos)
function applyStatus(e, st, from = NET.myId) {
  if (!e || e.dead || !STATUS[st]) return;
  if (e.boss && (st === 1 || st === 5 || st === 6)) return;
  if (e.st === 1 || e.st === 5) return;
  e.st = st; e.stT = STATUS[st].dur; e.dotT = 1; e.stBy = from; // dano do veneno/queimadura conta para quem aplicou
}
function inflict(e, st) {
  text(e.x, e.y - e.h / 2 - 22, STATUS[st].label, STATUS[st].color, 13);
  if (isHost()) applyStatus(e, st);
  else { e.st = st; if (NET.host && NET.host.open) NET.host.send({ t: 'st', id: e.id, st }); }
}
// desenho do status em cima do inimigo
function drawStatus(e, x, y) {
  const st = e.st;
  if (!st) return;
  const top = y - e.h / 2;
  if (st === 1) {
    ctx.font = 'bold 13px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1e3a8a'; ctx.fillStyle = '#e0f2fe';
    for (let k = 0; k < 3; k++) {
      const ph = (G.time * 0.8 + k / 3) % 1;
      ctx.globalAlpha = 1 - ph; ctx.font = `bold ${10 + k * 3}px Barlow Semi Condensed, system-ui`;
      outlined('z', x + 8 + ph * 16 + k * 4, top - 4 - ph * 26 - k * 6);
    }
    ctx.globalAlpha = 1;
  } else if (st === 5) {
    ctx.fillStyle = 'rgba(165,243,252,.35)'; ctx.strokeStyle = 'rgba(224,242,254,.8)'; ctx.lineWidth = 2;
    ctx.fillRect(x - e.w * 0.4, y - e.h * 0.45, e.w * 0.8, e.h * 0.85); ctx.strokeRect(x - e.w * 0.4, y - e.h * 0.45, e.w * 0.8, e.h * 0.85);
  } else if (st === 6) {
    ctx.font = '12px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center';
    for (let k = 0; k < 3; k++) { const a = G.time * 4 + k * 2.09; ctx.fillText('⭐', x + Math.cos(a) * 14, top - 6 + Math.sin(a) * 4); }
  } else if (Math.random() < 0.35) {
    const col = st === 2 ? '#fde047' : st === 3 ? '#fb923c' : '#c084fc';
    G.parts.push({ x: e.x + rand(-e.w * 0.3, e.w * 0.3), y: e.y + rand(-e.h * 0.3, e.h * 0.2), vx: st === 2 ? rand(-60, 60) : 0, vy: st === 2 ? rand(-60, 60) : -35, life: 0.45, color: col, size: st === 4 ? 4 : 3 });
  }
}

/* ---------- Ficha do companheiro (tooltip) ---------- */
function petTip(P, i) {
  const pt = P.pets[i];
  if (!pt) return '';
  const p = POKE[pt.pid], st = p ? p.stats : {};
  const ev = evoLevel(pt.pid);
  const evt = ev === undefined ? 'carregando evolução...' : ev ? `evolui no Nv ${ev}` : 'forma final';
  const f = clamp(Math.max(st.attack || 60, st['special-attack'] || 60) / 80, 0.7, 1.7);
  const ab = petAbility(pt.pid);
  const hm = HM_KEYS.map(k => {
    const h = HMS[k], knows = pt.hms && pt.hms.includes(k), can = canLearn(pt.pid, k);
    const s = knows ? '✅ conhece' : can ? (P.hms.includes(k) ? '📘 pode aprender (clique no +)' : `📘 pode aprender (precisa da ${h.mo})`) : '— não aprende';
    return `<div class="${knows ? 'ok' : can ? '' : 'no'}">${h.icon} ${h.nome}: ${s}</div>`;
  }).join('');
  return `<div class="tip-h"><b>${esc(pt.name)}</b> Nv ${pt.lvl} ${(p ? p.types : [pt.type]).map(typeBadge).join(' ')}</div>
    <div>⚔️ Ataque ${Math.max(st.attack || 0, st['special-attack'] || 0) || '?'} · ❤️ PV ${st.hp || '?'} · 💨 Vel ${st.speed || '?'}</div>
    <div>🎯 Tiro: (${1 + Math.floor(pt.lvl / 8)}d8 + ${Math.floor(pt.lvl / 2)}) × ${f.toFixed(2)}, tipo ${TYPE_PT[pt.type]}</div>
    <div>✨ Golpe especial: <b>${MOVES[pt.type] || 'Investida'}</b> (leque a cada 6s)</div>
    <div>🌀 ${ab ? `<b>${ab.nome}</b>: ${Math.round(ab.ch * 100)}% por acerto de ${STATUS[ab.st].txt} (bate ${Math.round((1 - abilDmgMul(ab)) * 100)}% menos)` : 'Sem habilidade especial (bate com força total)'}</div>
    <div>🧬 ${evt} · XP ${pt.xp}/${petNeed(pt.lvl)}</div>
    ${petIsFlyer(pt.pid) ? '<div>🪽 Voa sobre a água</div>' : ''}
    <div class="tip-hm"><b>HMs</b>${hm}</div>`;
}
// passar o mouse sobre o companheiro no mapa mostra um resumo
function drawPetHover(ox, oy) {
  const P = G.P, a = G.allies.find(x => x.pet);
  if (!P || !a) return;
  const mw = mouseWorld();
  if (Math.hypot(mw.x - a.x, mw.y - a.y) > 26) return;
  const pt = activePet(P);
  if (!pt) return;
  const ab = petAbility(pt.pid);
  const lines = [`${pt.name} · Nv ${pt.lvl} · ${TYPE_PT[pt.type]}`, `Especial: ${MOVES[pt.type] || 'Investida'}`, ab ? `Habilidade: ${ab.nome}` : 'Sem habilidade',
    'HMs: ' + (HM_KEYS.filter(k => pt.hms && pt.hms.includes(k)).map(k => HMS[k].icon + ' ' + HMS[k].nome).join(', ') || 'nenhuma')];
  ctx.font = '12px Barlow Semi Condensed, system-ui';
  const w = Math.max(...lines.map(s => ctx.measureText(s).width)) + 16, x = a.x + ox + 20, y = a.y + oy - 70;
  ctx.fillStyle = 'rgba(15,11,26,.92)'; ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5;
  roundRect(x, y, w, lines.length * 16 + 10, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e7e3f5'; ctx.textAlign = 'left';
  lines.forEach((s, i) => ctx.fillText(s, x + 8, y + 18 + i * 16));
}
