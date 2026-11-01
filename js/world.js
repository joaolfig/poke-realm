'use strict';
/* ============ Vila: NPCs, loja, ferreiro e missões ============ */
const NPCS = [
  { id: 'cura', nome: 'Vendedora de Poké Balls', icon: '⚪', x: -140, y: -68, spr: { h: '#fde68a', b: '#ef4444', d: '#991b1b' }, fala: 'Poké Balls fresquinhas! E cintos para levar mais companheiros.' },
  { id: 'loja', nome: 'Mercador Bento', icon: '🛒', x: 140, y: -68, spr: { h: '#3f2a14', b: '#a16207', d: '#713f12' }, fala: 'Tenho de tudo, se você tiver ouro!' },
  { id: 'ferreiro', nome: 'Ferreira Duna', icon: '🔨', x: -140, y: 136, spr: { h: '#ea580c', b: '#57534e', d: '#292524' }, fala: 'Traga ouro e eu deixo seu equipamento mais forte.' },
  { id: 'guilda', nome: 'Mestre da Guilda', icon: '📜', x: 140, y: 140, spr: { h: '#e5e7eb', b: '#1d4ed8', d: '#1e3a8a' }, fala: 'O reino precisa de heróis. Escolha um contrato.' },
  { id: 'sildo', nome: 'Sildo Invernal', icon: '🛡️', x: 0, y: -205, spr: { h: '#94a3b8', b: '#475569', d: '#1e293b' }, fala: '' },
  { id: 'torre', nome: 'Guardião da Torre', icon: '🗼', x: 0, y: 150, t2: 1, spr: { h: '#e5e7eb', b: '#6d28d9', d: '#2e1065' }, fala: '' },
  { id: 'pc', nome: 'Banco Pokémon', icon: '💻', x: -62, y: -50, spr: { h: '#94a3b8', b: '#475569', d: '#1e293b' }, fala: '' },
  { id: 'dex', nome: 'Pesquisadora Íris', icon: '📖', x: 60, y: 205, spr: { h: '#7c2d12', b: '#f8fafc', d: '#0f766e' }, fala: '' },
  { id: 'grupo', nome: 'Mural de Grupo', icon: '📌', x: 178, y: -6, spr: { h: '#78350f', b: '#a16207', d: '#451a03' }, fala: '' }, // mural de madeira (desenhado à parte)
  { id: 'templo', nome: 'Sacerdotisa Aurora', icon: '⛪', x: -150, y: 30, t2: 1, spr: { h: '#fde68a', b: '#f8fafc', d: '#ca8a04' }, fala: '' },
  { id: 'gundo', nome: 'Gundo Buscapedra', icon: '⛏️', x: -60, y: 205, t2: 1, spr: { h: '#b45309', b: '#7c2d12', d: '#451a03' }, fala: '' },
];
const NPC_SPR = {};
function buildNPCSprites() {
  for (const n of NPCS) {
    const col = { h: n.spr.h, b: n.spr.b, d: n.spr.d, s: '#e0ac69', e: '#1f2937', l: '#3a2d22' };
    const c = document.createElement('canvas');
    c.width = 12; c.height = 12;
    const x = c.getContext('2d');
    PSPR.concat(PLEGS[0]).forEach((row, y) => {
      for (let i = 0; i < 12; i++) if (col[row[i]]) { x.fillStyle = col[row[i]]; x.fillRect(i, y, 1, 1); }
    });
    NPC_SPR[n.id] = c;
  }
}
// NPCs da segunda cidade: cópias da vila (mesmas lojas) + um assistente do guia (setRegion)
const NPCS2 = [];
function rebuildTownNPCs() {
  NPCS2.length = 0;
  const t = TOWNS[1];
  if (!t) return;
  for (const n of NPCS) if (['cura', 'loja', 'ferreiro', 'guilda', 'sildo', 'dex', 'pc', 'torre', 'gundo', 'templo', 'grupo'].includes(n.id))
    NPCS2.push({ ...n, x: n.x + t.x, y: n.y + t.y, town: 1, nome: n.id === 'sildo' ? `Assistente ${REGION.guia.nome.split(' ').pop()}` : n.nome, show: n.id === 'gundo' ? n.show : null });
}
const allNPCs = () => NPCS.filter(n => !n.t2).concat(NPCS2); // o guardião da torre só existe na 2ª cidade
function nearNPC(P) {
  if (inDungeonArea(P.x)) return nearTowerShop(P);
  if (!inTown(P.x, P.y)) return null;
  return allNPCs().find(n => (!n.show || n.show(P)) && Math.hypot(n.x - P.x, n.y - P.y) < 60) || null;
}
function drawNPC(n, ox, oy) {
  if (n.show && !(G.P && n.show(G.P))) return;
  if (n.t2 && !n.town) return;
  const x = n.x + ox, y = n.y + oy + Math.sin(G.time * 2 + n.x) * 1;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 17, 12, 4, 0, 0, 7); ctx.fill();
  if (n.id === 'pc') {
    ctx.fillStyle = '#334155'; ctx.fillRect(x - 15, y - 14, 30, 30); ctx.fillStyle = '#0f172a'; ctx.fillRect(x - 15, y + 12, 30, 4);
    ctx.fillStyle = '#1e293b'; ctx.fillRect(x - 12, y - 11, 24, 15);
    ctx.fillStyle = Math.sin(G.time * 3) > 0 ? '#38bdf8' : '#7dd3fc'; ctx.fillRect(x - 10, y - 9, 20, 11);
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x, y + 9, 3, 0, 7); ctx.fill();
  } else if (n.id === 'grupo') {
    // mural de madeira com papéis pregados
    ctx.fillStyle = '#451a03'; ctx.fillRect(x - 22, y - 2, 4, 20); ctx.fillRect(x + 18, y - 2, 4, 20);
    ctx.fillStyle = '#78350f'; ctx.fillRect(x - 26, y - 22, 52, 28); ctx.fillStyle = '#a16207'; ctx.fillRect(x - 23, y - 19, 46, 22);
    const pap = ['#fef3c7', '#e0f2fe', '#fde68a', '#fecaca'];
    [[-19, -17], [-6, -16], [7, -17], [-13, -7], [3, -6]].forEach(([a, b], i) => { ctx.fillStyle = pap[i % 4]; ctx.fillRect(x + a, y + b, 11, 9); ctx.fillStyle = '#dc2626'; ctx.fillRect(x + a + 4, y + b, 2, 2); });
  } else ctx.drawImage(NPC_SPR[n.id], x - 18, y - 18, 36, 36);
  ctx.font = 'bold 11px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fef3c7';
  outlined(`${n.icon} ${n.nome}`, x, y - 26);
  const P = G.P;
  const cq = P && QGIVERS[n.id] && (P.quests || {})[n.id];
  if (P && QGIVERS[n.id] && (cq ? cq.done : n.id === 'grupo' ? G.remotes.size : !soloQuest(P))) {
    ctx.font = 'bold 20px Barlow Semi Condensed, system-ui'; ctx.fillStyle = cq && cq.done ? '#4ade80' : '#facc15';
    outlined(cq && cq.done ? '?' : '!', x, y - 40 + Math.sin(G.time * 5) * 3);
  }
  if (n.id === 'sildo' && P && P.story && !storyOver(P) && ((n.town === 1 && needT2(P)) || (!needT2(P) && (n.town || 0) === storyHub(P) && (P.story.ch === 0 || P.story.done)))) {
    ctx.font = 'bold 22px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fde047';
    outlined('!', x, y - 40 + Math.sin(G.time * 5) * 3);
  }
}

/* ---------- Diálogo ---------- */
function openNPC(id) {
  if (id === 'pc') return openPC(G.nearNPC && G.nearNPC.id === 'pc' ? G.nearNPC : NPCS.find(n => n.id === 'pc')); G.npcOpen = id; G.npcRef = G.nearNPC && G.nearNPC.id === id ? G.nearNPC : NPCS.find(n => n.id === id); $('npc').classList.remove('hidden'); renderNPC(); sfx('open'); }
function closeNPC() { G.npcOpen = null; G.npcRef = null; $('npc').classList.add('hidden'); }

// loja de Poké Balls (a antiga curandeira): bolas e vagas extras de companheiro
// em qual cidade fica o NPC aberto agora (0 = vila inicial, 1 = 2ª cidade)
const npcTown = () => (G.npcRef && G.npcRef.town) || 0;
// a Ultra Ball e os melhores aprimoramentos só existem na 2ª cidade
function ballShop(P, town = npcTown()) {
  return [
    { id: 'ball', nome: 'Poké Ball', icon: '⚪', preco: 30 },
    { id: 'grande', nome: 'Great Ball (+3 na captura)', icon: '🔵', preco: 70 },
    town === 1 || !TOWNS[1] ? { id: 'ultra', nome: 'Ultra Ball (+6 na captura)', icon: '🟡', preco: 150, lock: P.lvl < 8 }
      : { id: 'ultra', nome: 'Ultra Ball', icon: '🟡', preco: 150, lock: 1, why: `esgotada aqui` },
    ...(petCap(P) < PET_CAP_MAX ? [{ id: 'cinto', nome: `Cinto de Poké Balls: +1 vaga de companheiro (${petCap(P)} → ${petCap(P) + 1})`, icon: '🎒', preco: CINTO_PRECO[petCap(P)] }] : []),
  ];
}
function shopList(P) {
  // a loja só vende até Muito Raro: os melhores itens vêm de chefes e masmorras
  // na vila inicial o estoque para em Raro; os itens Muito Raros só chegam à loja da 2ª cidade
  const tier = clamp(Math.floor(P.lvl / 4), 0, npcTown() === 1 || !TOWNS[1] ? 3 : 2);
  return [
    { id: 'pot', nome: 'Poção de Cura', icon: '❤️', preco: 25 },
    { id: 'doce', nome: 'Doce Raro (+1 nível do companheiro)', icon: '🍬', preco: 140 },
    { id: 'stone', nome: 'Cristal de tipo aleatório', icon: '💎', preco: 50 },
    { id: 'abra', nome: 'Talismã de Abra <i>fuga instantânea [Z] · 1 por vez</i>', icon: '🌀', preco: 1000 },
    { id: 'arma', nome: CLASSES[P.cls].weapons[tier], icon: CLASSES[P.cls].wicon, preco: 60 + tier * 45, tier },
    { id: 'armadura', nome: ARMORS[tier], icon: '🛡️', preco: 50 + tier * 40, tier },
    { id: 'anel', nome: 'Anel aleatório', icon: '💍', preco: 70 + tier * 30, tier },
    { id: 'amuleto', nome: 'Amuleto aleatório', icon: '📿', preco: 90 + tier * 40, tier },
  ];
}
// preço de reencantar: intermediário (mais caro para itens raros e míticos)
// base por raridade (Comum → Artefato); anel/amuleto ×1,3 (encantamento garantido); Mítico 1740
const REFORGE_BASE = [300, 540, 780, 846, 912, 978, 1044];
const reforgeCost = it => Math.round(REFORGE_BASE[clamp(it.tier, 0, 6)] * (it.myth ? 5 / 3 : 1) * (it.slot === 'anel' || it.slot === 'amuleto' ? 1.3 : 1));
const sellPrice = it => (it.starter ? 25 : 0) + 8 + it.tier * 12 + (it.upg || 0) * 10 + (it.myth ? 150 + it.myth * 10 : 0);
// vila: +4 · 2ª cidade: +6 (+8 depois da história) · loja da torre: +12
const upgMax = (P, town = npcTown()) => (town === 2 ? 12 : town === 1 || !TOWNS[1] ? (storyOver(P) ? 8 : 6) : 4);
const upgCost = it => Math.round(60 * ((it.upg || 0) + 1) * (1 + it.tier * 0.5));

function renderNPC() {
  const P = G.P, n = G.npcRef && G.npcRef.id === G.npcOpen ? G.npcRef : NPCS.find(x => x.id === G.npcOpen);
  if (P && G.npcOpen === 'fly') { $('npc').innerHTML = renderFly(P); return; }
  if (!P || !n) { closeNPC(); return; }
  let body = n.fala ? `<p class="fala">"${n.fala}"</p>` : '';
  if (n.id === 'cura') {
    // dica da vendedora: insinua que a Poké Ball comum não segura os Pokémon mais fortes (sem explicar a regra)
    body += `<p class="fala">"Ouvi dizer que, de ${ZONES[3].nome} em diante, os Pokémon não se deixam prender por qualquer bola... Os treinadores que voltam de lá inteiros nunca levam só Poké Ball na mochila. Por que será que a Great Ball e a Ultra Ball vendem tanto?"</p>`;
    body += '<h4>Poké Balls</h4>' + ballShop(P).map(s => `<div class="shoprow"><span>${s.icon} ${s.nome}</span>
      <button data-act="buy:${s.id}" ${s.lock || P.gold < s.preco ? 'disabled' : ''}>${s.lock ? s.why || 'a partir do Nv 8' : s.preco + ' 🪙'}</button></div>`).join('')
      + `<div class="small">Você tem ${P.balls} Poké Ball, ${P.bag.grande} Great Ball e ${P.bag.ultra} Ultra Ball · ${P.pets.length}/${petCap(P)} companheiros${petCap(P) >= PET_CAP_MAX ? ' (máximo)' : ''}.</div>`;
  } else if (n.id === 'loja') {
    body += '<h4>Comprar</h4>' + shopList(P).map(s => `<div class="shoprow"><span>${s.icon} ${s.nome}${s.tier !== undefined ? ` <i style="color:${TIER_COLORS[s.tier]}">${TIER_NAMES[s.tier]}</i>` : ''}</span>
      <button data-act="buy:${s.id}" ${P.gold < s.preco ? 'disabled' : ''}>${s.preco} 🪙</button></div>`).join('');
    const inv = P.inv.map((it, i) => it ? `<div class="sellrow"><button class="sell" data-act="sell:${i}" title="${esc(it.name)}" ${it.locked ? 'disabled' : ''}>${itemIcon(it)} ${esc(it.name)} → ${sellPrice(it)} 🪙</button><button data-act="lock:${i}" title="${it.locked ? 'Destravar' : 'Travar: não vende nem solta'}">${it.locked ? '🔒' : '🔓'}</button></div>` : '').join('');
    // vender em lote: cristais, ou equipamentos até a raridade escolhida (nunca Míticos nem travados)
    const lot = k => P.inv.filter(it => it && !it.locked && !it.myth && (k === 'pedra' ? it.slot === 'pedra' : it.slot !== 'pedra' && it.tier <= k));
    const lotBtn = (k, txt) => { const L = lot(k); return L.length ? `<button data-act="sellbulk:${k}">${txt} (${L.length} · ${L.reduce((s, it) => s + sellPrice(it), 0)} 🪙)</button>` : ''; };
    const bulk = lotBtn('pedra', '💎 Vender cristais') + [0, 1, 2, 3, 4].map(k => lotBtn(k, `Até ${TIER_NAMES[k]}`)).join('');
    body += `<h4>Vender</h4>${bulk ? `<div class="bulk">${bulk}</div><div class="small">Vender em lote nunca vende itens travados 🔒 nem Míticos.</div>` : ''}${inv || '<div class="small">Mochila vazia.</div>'}`;
  } else if (n.id === 'dex') {
    body += renderContracts(P, 'dex') + renderDexNPC(P); // missões antes das recompensas
  } else if (n.id === 'pc') {
    body += renderPC(P);
  } else if (n.id === 'templo') {
    body += renderTemple(P);
  } else if (n.id === 'torre') {
    body += renderTowerNPC(P);
  } else if (n.id === 'tshop') {
    body += renderTowerShop(P);
  } else if (n.id === 'sildo' || n.id === 'gundo') {
    body += renderStoryNPC(n, P);
  } else if (n.id === 'ferreiro') {
    const cap = upgMax(P);
    body += ['arma', 'armadura'].map(s => {
      const it = P.equip[s], c = upgCost(it), maxed = (it.upg || 0) >= cap;
      return `<div class="shoprow"><span>${itemIcon(it)} ${esc(it.name)}${it.upg ? ' +' + it.upg : ''} <i>${itemDesc(it)}</i></span>
        <button data-act="upg:${s}" ${maxed || P.gold < c ? 'disabled' : ''}>${maxed ? 'Máximo' : `Aprimorar (${c} 🪙)`}</button></div>`;
    }).join('') + `<div class="small">Cada aprimoramento dá +1 de dano na arma ou +1 de CA na armadura (até +${cap}).</div>${cap === 4 && TOWNS[1] ? `<p class="fala">"Mais que isso, só com a forja de ${TOWNS[1].nome}. Minha bigorna não aguenta."</p>` : cap === 6 ? '<div class="small">Vencer a história da região libera até +8.</div>' : ''}`;
  } else if (n.id === 'guilda') {
    body += renderContracts(P, 'guilda');
  }
  if (n.id !== 'guilda' && n.id !== 'dex' && QGIVERS[n.id]) body += renderContracts(P, n.id);
  body = renderIL(n, P) + body; // etapa da história sempre no topo
  $('npc').innerHTML = `<div class="npc-head"><span>${n.icon} <b>${n.nome}</b></span><span>🪙 ${P.gold}</span><button data-act="close" title="Fechar (Esc)">✕</button></div><div class="npc-body">${body}</div>`;
  padFixDom($('npc'));
}

$('npc').addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]');
  if (!b || !G || !G.P) return;
  const P = G.P, [act, arg, arg2] = b.dataset.act.split(':');
  if (act === 'close') return closeNPC();
  if (act === 'heal') { P.hp = maxHP(P); burst(P.x, P.y, '#f9a8d4', 20); sfx('pot'); }
  else if (act === 'gift') { P.pots.hp = Math.max(P.pots.hp, 2); P.giftT = 300; sfx('pick'); }
  else if (act === 'buy') buyItem(P, arg);
  else if (act === 'tq') templeAct(P, arg);
  else if (act === 'bless' && BLESS[arg] && BLESS[arg].subs.includes(blessPhase(P))) { P.bless = arg; burst(P.x, P.y, '#fde68a', 24); sfx('lvl'); G.toasts.push({ text: `✝ Bênção ativa: ${BLESS[arg].nome}`, color: '#fde68a', t: 3 }); saveGame(); }
  else if (act === 'sellbulk') {
    let g = 0, n = 0;
    const k = arg === 'pedra' ? 'pedra' : +arg;
    P.inv.forEach((it, i) => { if (it && !it.locked && !it.myth && (k === 'pedra' ? it.slot === 'pedra' : it.slot !== 'pedra' && it.tier <= k)) { g += sellPrice(it); n++; P.inv[i] = null; } });
    if (n) { P.gold += g; G.toasts.push({ text: `💰 Vendeu ${n} itens por ${g} 🪙`, color: '#facc15', t: 3 }); sfx('pick'); }
  } else if (act === 'lock') {
    const it = P.inv[+arg];
    if (it) { it.locked = !it.locked; sfx('ui'); }
  } else if (act === 'sell') {
    const it = P.inv[+arg];
    if (it && !it.locked) { P.gold += sellPrice(it); P.inv[+arg] = null; sfx('pick'); }
  } else if (act === 'upg') {
    const it = P.equip[arg], c = upgCost(it);
    if (P.gold >= c && (it.upg || 0) < upgMax(P)) {
      P.gold -= c; it.upg = (it.upg || 0) + 1;
      if (it.slot === 'arma') it.bonus++; else it.ac++;
      G.toasts.push({ text: `🔨 ${it.name} agora é +${it.upg}!`, color: '#fdba74', t: 2.5 });
      sfx('lvl');
    }
  } else if (act === 'accept') {
    if (arg !== 'grupo' && soloQuest(P)) return;
    const q = P.qOffers[arg][+arg2]; P.quests[arg] = q; P.qOffers[arg] = null; P.recentQ = [q.k, ...(P.recentQ || [])].slice(0, 4); sfx('pick');
    if (q.gid) emitEvent({ t: 'gq', acc: P.name, start: groupStrip(q), desc: q.desc.replace(/<div[\s\S]*$/, '').replace(/<[^>]+>/g, '') }); // o contrato fica ativo para a sala toda
  }
  else if (act === 'abandon') { delete P.quests[arg]; }
  else if (act === 'claim') claimQuest(P, arg);
  else if (act === 'story') storyAct(P, arg);
  else if (act === 'dex') dexClaim(P, +arg);
  else if (act === 'torre') { towerRequest(+arg); closeNPC(); }
  else if (act === 'pc') { const [a2, i2] = arg.split(':'); pcAct(P, a2, +i2); }
  else if (act === 'dexopen') { closeNPC(); toggleDex(); }
  else if (act === 'fly') { flyTo(P, arg); return; }
  else if (act === 'reforge') {
    const it = P.equip[arg], c = it && reforgeCost(it);
    if (it && P.gold >= c) {
      P.gold -= c;
      const upg = it.upg || 0;
      // Mítico continua Mítico do mesmo andar; anel e amuleto sempre saem com um encantamento ✧
      const nw = it.myth ? mythItem(it.myth, arg) : genItem(it.tier, arg);
      if ((arg === 'anel' || arg === 'amuleto') && !nw.name.includes('✧')) enchant(nw);
      for (const k of Object.keys(it)) delete it[k];
      Object.assign(it, nw);
      if (upg) { it.upg = upg; if (it.slot === 'arma') it.bonus += upg; else if (it.slot === 'armadura') it.ac += upg; }
      G.toasts.push({ text: `✨ Reencantado: ${it.name}`, color: '#c4b5fd', t: 3 });
      sfx('lvl');
    }
  }
  G.dirty = true;
  saveGame();
  renderNPC();
});

function buyItem(P, id) {
  const s = (G.npcOpen === 'tshop' ? towerShopList(P) : shopList(P).concat(ballShop(P))).find(x => x.id === id);
  if (!s || s.lock || P.gold < s.preco) return;
  let it = null;
  if (id === 'stone') it = stone(pick(TYPES));
  else if (id === 'arma' || id === 'armadura' || id === 'anel' || id === 'amuleto') it = genItem(s.tier, id);
  if (it) {
    const i = P.inv.indexOf(null);
    if (i < 0) { G.toasts.push({ text: 'Mochila cheia!', color: '#fca5a5', t: 2 }); return; }
    P.inv[i] = it;
  } else if (id === 'pot') P.pots.hp++;
  else if (id === 'ball') P.balls++;
  else if (id === 'abra' && P.bag.abra >= 1) { G.toasts.push({ text: '🌀 Só dá para carregar um Talismã de Abra por vez.', color: '#fca5a5', t: 2.5 }); return; }
  else if (CONS[id]) P.bag[id]++;
  else if (id === 'statpot') drinkStat(P, pick(ATTRS));
  else if (id === 'cinto') { P.petCap = petCap(P) + 1; G.toasts.push({ text: `🎒 Agora você pode levar ${P.petCap} companheiros!`, color: '#86efac', t: 3 }); G.dirty = true; }
  P.gold -= s.preco;
  sfx('pick');
}

/* ---------- Missões ----------
 * O Mestre da Guilda oferece 3 contratos (fácil, médio, difícil) de tipos variados,
 * cada um pedido por um morador com um motivo. Evita repetir os últimos tipos feitos.
 */
const BONUS_NAMES = { ball: '2 Poké Balls', stone: 'um Cristal', item: 'um item raro', statpot: 'uma Poção de Atributo' };
const QTIERS = [{ n: '★ Fácil', m: 1, r: 1 }, { n: '★★ Médio', m: 1.6, r: 1.9 }, { n: '★★★ Difícil', m: 2.3, r: 3 }];
const QPEOPLE = {
  tipo: [['Fazendeira Lia', 'estão destruindo minha plantação'], ['Guarda Tomé', 'atacaram a patrulha ontem à noite'], ['Vendedor Caco', 'assustam meus clientes na estrada']],
  zona: [['Guarda Tomé', 'a estrada precisa ficar segura para as carroças'], ['Cartógrafa Nina', 'preciso mapear a região em paz'], ['Lenhador Bruno', 'não consigo trabalhar com tanto Pokémon bravo']],
  alfa: [['Caçadora Rita', 'os Alfas estão liderando os bandos contra a vila'], ['Guarda Tomé', 'sem os Alfas os bandos se dispersam']],
  masmorra: [['Estudioso Ivo', 'quero relatos de dentro das masmorras'], ['Mineiro Brás', 'um portal se abriu perto da minha mina']],
  captura: [['Pesquisadora Sofia', 'quero estudar Pokémon vivos'], ['Criador Otto', 'meu rancho precisa de novos Pokémon']],
  evento: [['Cronista Elba', 'preciso de alguém no meio da ação para meu livro'], ['Guarda Tomé', 'precisamos de heróis quando o caos começa']],
  caca: [['Xerife Duarte', 'esse Pokémon já feriu três viajantes'], ['Caçadora Rita', 'é a maior presa da região'], ['Pescadora Marina', 'ele virou meu barco']],
  coleta: [['Alquimista Zuza', 'preciso de ingredientes para poções'], ['Artesã Bia', 'faço amuletos com isso'], ['Curandeira Íris', 'uso isso nos remédios']],
  explorar: [['Cartógrafa Nina', 'meu mapa ainda tem buracos'], ['Estudioso Ivo', 'dizem que há ruínas por lá']],
  especie: [['Fazendeira Lia', 'eles estão comendo toda a colheita'], ['Mineiro Brás', 'cavaram túneis embaixo da minha casa'], ['Guarda Tomé', 'um bando deles bloqueou a ponte']],
  pegaralfa: [['Criador Otto', 'um Alfa daria filhotes fortíssimos'], ['Caçadora Rita', 'quero ver alguém domar um líder de bando']],
  pesquisa: [['Pesquisadora Sofia', 'estou catalogando as espécies da região'], ['Estudioso Ivo', 'quero comparar espécies diferentes']],
  noturno: [['Astrônoma Lua', 'alguns Pokémon só mostram sua verdadeira natureza à noite'], ['Vigia Noel', 'quero companheiros para a ronda da madrugada']],
  bolaboa: [['Vendedora de Poké Balls', 'preciso de relatos de campo das minhas bolas novas'], ['Colecionador Ivo', 'quero ver as bolas especiais em ação']],
  duoTipo: [['Guarda Tomé', 'são muitos: um vigia de cada lado da estrada'], ['Fazendeira Lia', 'peguem um de cada ponta da plantação']],
  duoEspecie: [['Mineiro Brás', 'eles estão em toda parte: dividam a área'], ['Pescadora Marina', 'um em cada margem do rio, por favor']],
  duoCaptura: [['Criador Otto', 'meu rancho precisa de um casal de cada'], ['Pesquisadora Sofia', 'quero amostras de dois pontos diferentes']],
  duoAlfa: [['Mestre da Guilda', 'esses Alfas andam em bando: um herói sozinho não segura'], ['Caçadora Rita', 'preciso de uma dupla afinada']],
  duoCaca: [['Xerife Duarte', 'esse Procurado é forte demais para um só'], ['Mestre da Guilda', 'só aceito esse serviço de quem tem parceiro']],
  pegar: [['Pesquisadora Sofia', 'preciso de um exemplar para a minha pesquisa'], ['Menino Pedrinho', 'sempre sonhei em ter um'], ['Criador Otto', 'falta essa espécie no meu rancho'], ['Colecionador Ivo', 'é a peça que falta na minha coleção']],
};
const MATERIAL = { flying: 'Penas', fire: 'Cinzas', water: 'Escamas', grass: 'Folhas', bug: 'Seda', poison: 'Glândulas de veneno', electric: 'Faíscas engarrafadas',
  ground: 'Torrões', rock: 'Pedrinhas raras', ghost: 'Ectoplasma', psychic: 'Cristais mentais', fighting: 'Faixas', normal: 'Pelos', ice: 'Gelo eterno',
  dragon: 'Escamas de dragão', dark: 'Garras sombrias', steel: 'Parafusos', fairy: 'Pó de fada' };
// zona dos contratos: a do nível do jogador, mas só até onde ele já consegue chegar (HMs e insígnias)
const questZone = P => { let z = lvlZone(P.lvl); while (z > 1 && needFor(P, z).length) z--; return z; };
/* ---------- Quem dá contratos: cada NPC cuida do seu assunto (um contrato ativo por NPC) ----------
 * Guilda: combate · Vendedora de Poké Balls: capturas · Pesquisadora: pesquisa e exploração · Mercador: materiais e pragas.
 * Cada região pesa os tipos de um jeito e tem os próprios personagens pedindo ajuda (REGION.side, em regions.js).
 */
const QGIVERS = {
  guilda: ['tipo', 'zona', 'alfa', 'masmorra', 'evento', 'caca', 'caca', 'especie'],
  cura: ['captura', 'pegar', 'pegar', 'pegaralfa', 'bolaboa', 'bolaboa'],
  dex: ['pesquisa', 'pesquisa', 'pegar', 'explorar'],
  loja: ['coleta', 'coleta', 'especie', 'tipo'],
  grupo: ['duoAlfa', 'duoCaca', 'duoTipo', 'duoEspecie', 'duoCaptura'], // Mural de Grupo: só contratos de grupo (com outros jogadores na sala)
};
// NPC do contrato individual ativo (só pode haver um; o de grupo fica à parte)
const soloQuest = P => Object.keys(P.quests || {}).find(g => g !== 'grupo' && P.quests[g]);
const backTo = g => (g === 'grupo' ? 'ao Mural de Grupo' : `a ${giverName(g)}`);
const giverName = g => (NPCS.find(n => n.id === g) || {}).nome || 'quem te contratou';
function renderContracts(P, g) {
  P.quests = P.quests || {}; P.qOffers = P.qOffers || {};
  const q = P.quests[g];
  let h = g === 'grupo' ? '<h4>Contratos de grupo</h4>' : '<h4>Contratos</h4>';
  if (g === 'grupo' && !q && !G.remotes.size) return h + '<p class="fala">Um aviso pregado no topo do mural: <i>"Serviços só para grupos de heróis. Quem aceita, aceita por todos: o contrato vale para a sala inteira, e o que cada um faz conta para o grupo."</i></p><div class="small">Os contratos aparecem quando há outros jogadores na sua sala.</div>';
  if (q) {
    h += `<div class="quest cur"><b>${q.desc}</b><div class="qbar"><div style="width:${Math.min(100, q.have / q.need * 100)}%"></div></div>
      <div class="small">${q.have}/${q.need} · Recompensa: ${q.xp} XP, ${q.gold} 🪙${q.bonus ? ', ' + BONUS_NAMES[q.bonus] : ''}</div></div>
      ${q.done ? `<button data-act="claim:${g}" class="good">🎁 Receber recompensa</button>` : `<button data-act="abandon:${g}">Abandonar contrato</button>`}`;
  } else {
    // as ofertas acompanham o jogador: refeitas quando ele muda de faixa de nível, ganha acesso a outra zona ou troca de região
    const of = P.qOffers[g];
    if (!of || of.some(o => !o.gid && (o.zt !== questZone(P) || o.reg !== REGION_ID))) P.qOffers[g] = genQuests(P, g);
    groupOffer(P, g);
    // um contrato individual (em qualquer NPC) e um de grupo ao mesmo tempo
    const busy = g !== 'grupo' && soloQuest(P);
    if (busy) h += `<div class="small" style="color:#fca5a5">Você já tem um contrato individual com ${giverName(busy)}. Termine ou abandone antes de pegar outro (o de grupo, do Mural de Grupo, pode ficar junto).</div>`;
    h += P.qOffers[g].map((o, i) => `<div class="quest"><b>${o.desc}</b><div class="small">Recompensa: ${o.xp} XP, ${o.gold} 🪙${o.bonus ? ', ' + BONUS_NAMES[o.bonus] : ''}</div>
      <button data-act="accept:${g}:${i}" ${busy ? 'disabled' : ''}>Aceitar</button></div>`).join('');
  }
  return h;
}
function genQuests(P, g = 'guilda') {
  const z = questZone(P);
  const recent = P.recentQ || [];
  const unknown = LANDMARKS.filter(l => !P.fly.includes(l.id) && zoneAt(l.x, l.y) <= z + 1);
  const side = REGION.side || {};
  // visitar lugares (destinos do Fly) só depois de ter a HM Fly
  let kinds = QGIVERS[g].filter(k => (k !== 'bolaboa' || z >= 2) && (k !== 'explorar' || (unknown.length && P.hms.includes('fly'))));
  for (const [k, n] of Object.entries(side.peso || {})) if (kinds.includes(k)) for (let i = 0; i < n; i++) kinds.push(k);
  const fresh = kinds.filter(k => !recent.includes(k));
  if (new Set(fresh).size >= 3) kinds = fresh;
  const picked = [];
  for (const k of [...kinds].sort(() => Math.random() - 0.5)) if (!picked.includes(k) && picked.length < 3) picked.push(k);
  while (picked.length < 3) picked.push(pick(kinds));
  // contratos de grupo crescem com o número de jogadores na sala (2 a 4): ~0,8× o individual por jogador
  const np = clamp(1 + G.remotes.size, 2, 4), grp = np > 2 ? 'grupo' : 'dupla';
  return picked.map((k, idx) => {
    const T = QTIERS[idx], q = { k, have: 0, done: false, tier: idx, zt: z, zone: z, reg: REGION_ID };
    const need = base => Math.max(1, Math.round(base * T.m));
    const pool = ZONE_POOLS[z].filter(id => POKE[id]);
    let [who, why] = pick([...QPEOPLE[k], ...((side.pessoas || {})[k] || []), ...((side.pessoas || {})[k] || [])]); // os da região aparecem mais
    let diff = 1;
    if (k === 'tipo') {
      const p = POKE[pick(pool)]; q.type = p ? mainType(p) : 'normal'; q.need = need(10 + z * 3);
      q.desc = `Derrote ${q.need} Pokémon do tipo ${TYPE_PT[q.type]}`;
    } else if (k === 'zona') {
      q.need = need(18 + z * 5);
      q.desc = `Derrote ${q.need} Pokémon na Zona ${z}`;
    } else if (k === 'alfa') {
      q.need = need(1 + Math.floor(z / 2)); diff = 2;
      q.desc = `Derrote ${q.need} Pokémon Alfa`;
    } else if (k === 'masmorra') {
      q.need = need(idx ? 1.3 : 1); diff = 3;
      q.desc = q.need > 1 ? `Conclua ${q.need} masmorras (derrote os chefes)` : 'Conclua uma masmorra (derrote o chefe)';
    } else if (k === 'captura') {
      const p = POKE[pick(pool)]; q.type = p ? mainType(p) : 'normal'; q.need = need(1 + Math.floor(z / 3)); diff = 1.6;
      q.desc = `Capture ${q.need} Pokémon do tipo ${TYPE_PT[q.type]} na Zona ${z} ou acima`;
    } else if (k === 'evento') {
      q.need = need(idx === 2 ? 1.3 : 1); diff = 2;
      q.desc = q.need > 1 ? `Complete ${q.need} eventos do mundo` : 'Complete um evento do mundo';
    } else if (k === 'caca') {
      q.pid = pick(pool); q.need = 1; diff = 2.4;
      let pt = randomZonePoint(z);
      for (let t = 0; t < 10 && Math.hypot(pt[0], pt[1]) < 900; t++) pt = randomZonePoint(z);
      q.x = Math.round(pt[0]); q.y = Math.round(pt[1]);
      q.desc = `Caçada: derrote ${POKE[q.pid] ? POKE[q.pid].name : 'o Pokémon'} Procurado (🎯 no mapa)`;
    } else if (k === 'duoTipo') {
      const p = POKE[pick(pool)]; q.type = p ? mainType(p) : 'normal'; q.need = need((10 + z * 3) * 0.8 * np); diff = 1;
      q.desc = `👥 Em ${grp}: derrotem ${q.need} Pokémon do tipo ${TYPE_PT[q.type]} (cada um pode caçar num canto: vale o abate de todos, até ~50 m de distância)`;
    } else if (k === 'duoEspecie') {
      q.pid = pick(pool); q.need = need((6 + z * 2) * 0.8 * np); diff = 1.2;
      q.desc = `👥 Em ${grp}: derrotem ${q.need} ${POKE[q.pid] ? POKE[q.pid].name : 'Pokémon'} (vale o abate de todos, até ~50 m de distância)`;
    } else if (k === 'duoCaptura') {
      const p = POKE[pick(pool)]; q.type = p ? mainType(p) : 'normal'; q.need = need((1 + Math.floor(z / 3)) * 0.8 * np + 0.5); diff = 1.6;
      q.desc = `👥 Em ${grp}: capturem ${q.need} Pokémon do tipo ${TYPE_PT[q.type]} (vale a captura de todos, até ~50 m de distância)`;
    } else if (k === 'duoAlfa') {
      q.need = need((1 + Math.floor(z / 2)) * 0.8 * np + 1); diff = 2;
      q.desc = `👥 Em ${grp}: derrotem ${q.need} Pokémon Alfa (só conta com outro jogador perto de você)`;
    } else if (k === 'duoCaca') {
      q.pid = pick(pool); q.need = 1; q.duo = np; diff = 2.4; // igual à caçada comum
      let pt = randomZonePoint(z);
      for (let t = 0; t < 10 && Math.hypot(pt[0], pt[1]) < 900; t++) pt = randomZonePoint(z);
      q.x = Math.round(pt[0]); q.y = Math.round(pt[1]);
      q.desc = `👥 Caçada em ${grp}: ${POKE[q.pid] ? POKE[q.pid].name : 'o Pokémon'} Procurado gigante (🎯 no mapa; só aparece com 2 jogadores juntos)`;
    } else if (k === 'especie') {
      q.pid = pick(pool); q.need = need(6 + z * 2); diff = 1.2;
      if (POKE[q.pid] && POKE[q.pid].types.includes('water')) [who, why] = ['Pescadora Marina', 'espantaram todos os peixes'];
      q.desc = `Derrote ${q.need} ${POKE[q.pid] ? POKE[q.pid].name : 'Pokémon'}`;
    } else if (k === 'pegar') {
      q.pid = pick(pool); q.need = idx === 2 ? 2 : 1; diff = 1.8;
      q.desc = `Capture ${q.need > 1 ? q.need + ' ' : 'um '}${POKE[q.pid] ? POKE[q.pid].name : 'Pokémon'} (aparece na Zona ${z})`;
    } else if (k === 'pegaralfa') {
      q.need = 1; diff = 2.6;
      q.desc = 'Capture um Pokémon Alfa (enfraqueça bem: eles resistem mais)';
    } else if (k === 'pesquisa') {
      q.need = need(3 + Math.floor(z / 2)); q.seen = []; diff = 1.7;
      q.desc = `Pesquisa de campo: capture ${q.need} espécies diferentes na Zona ${z}`;
    } else if (k === 'noturno') {
      q.need = need(2); diff = 1.8;
      q.desc = `Capture ${q.need} Pokémon durante a noite na Zona ${z} ou acima`;
    } else if (k === 'bolaboa') {
      q.need = need(2); diff = 1.6;
      q.desc = `Capture ${q.need} Pokémon usando Great Ball ou Ultra Ball na Zona ${z} ou acima`;
    } else if (k === 'coleta') {
      const p = POKE[pick(pool)]; q.type = p ? mainType(p) : 'normal'; q.need = need(5 + z * 2); diff = 1.4;
      q.desc = `Colete ${q.need} ${MATERIAL[q.type]} de Pokémon do tipo ${TYPE_PT[q.type]}`;
    } else {
      // quanto mais difícil, mais longe da vila
      const byDist = [...unknown].sort((p, o) => Math.hypot(p.x, p.y) - Math.hypot(o.x, o.y));
      const l = byDist[Math.min(byDist.length - 1, Math.floor(idx * byDist.length / 3))]; q.lm = l.id; q.need = 1; q.x = l.x; q.y = l.y; diff = 1.5;
      q.desc = `Visite "${l.nome}" (🎯 no mapa; o lugar vira destino do Fly)`;
    }
    q.desc = `<span class="qtier t${idx}">${T.n}</span> ${q.desc}<div class="small"><i>${who}: "${why}."</i></div>`;
    // dupla: dá mais trabalho e rende 30% a mais de XP que o contrato individual equivalente (o ouro é o mesmo)
    q.xpk = (0.1 + 0.06 * diff) * T.r * (k.startsWith('duo') ? 1.3 : 1);
    q.xp = Math.round(xpNeed(P.lvl) * q.xpk);
    if (k.startsWith('duo')) q.gid = `${NET.myId || 'eu'}_${Date.now()}_${g}`;
    q.gold = Math.round((30 + z * 25) * diff * T.r);
    q.bonus = idx === 2 ? (Math.random() < 0.5 ? 'statpot' : 'item') : idx === 1 ? pick(['stone', 'item', 'ball']) : pick(['ball', 'stone', null]);
    return q;
  });
}

function questProgress(k, info = {}) {
  const P = G && G.P;
  if (!P || !P.quests) return;
  for (const [g, q] of Object.entries(P.quests)) questStep(P, g, q, k, info);
}
function questStep(P, g, q, k, info) {
  if (!q || q.done || q.k !== k) return;
  if ((k === 'tipo' || k === 'coleta' || k === 'duoTipo' || k === 'duoCaptura') && !(info.types || []).includes(q.type)) return;
  if (k === 'captura' && (!(info.types || []).includes(q.type) || (info.zone || 0) < q.zone)) return;
  if (k === 'zona' && info.zone !== q.zone) return;
  if ((k === 'caca' || k === 'duoCaca' || k === 'especie' || k === 'duoEspecie' || k === 'pegar') && info.pid !== q.pid) return;
  if (k === 'duoAlfa' && !info.duo) return;
  if (k === 'explorar' && info.id !== q.lm) return;
  if ((k === 'noturno' || k === 'bolaboa') && (info.zone || 0) < q.zone) return;
  if (k === 'pesquisa') { if (info.zone !== q.zone || (q.seen = q.seen || []).includes(info.pid)) return; q.seen.push(info.pid); }
  if (k === 'coleta') {
    if (Math.random() > 0.4) return;
    text(P.x, P.y - 58, `+1 ${MATERIAL[q.type]}`, '#fde68a', 12);
  }
  q.have++;
  if (q.have >= q.need) {
    q.done = true;
    G.toasts.push({ text: `📜 Contrato cumprido! Volte ${backTo(g)}.`, color: '#4ade80', t: 4 });
    sfx('lvl');
  }
  G.dirty = true;
}

/* ---------- Caçada: o Procurado aparece quando você chega perto do alvo ---------- */
const BOUNTY_HP = [2.5, 3.5, 5];
function bountyMod(e, tier) {
  e.bountyT = tier;
  e.boss = true;
  e.name = `Procurado: ${e.p.name}`;
  e.maxHp = Math.round(e.maxHp * (BOUNTY_HP[tier] || 2.5) * grpK()); e.hp = e.maxHp;
  e.scale *= 1.3; e.w *= 1.3; e.h *= 1.3; e.r *= 1.3;
  e.cdBoss = 1.6 - tier * 0.2;
}
function questTick(dt) {
  const P = G.P;
  G.qT = (G.qT || 0) - dt;
  if (!P || G.qT > 0) return;
  G.qT = 1;
  for (const q of Object.values(P.quests || {})) if (q && !q.done && (q.k === 'caca' || q.k === 'duoCaca')) bountyNear(P, q);
}
function bountyNear(P, q) {
  if (Math.hypot(P.x - q.x, P.y - q.y) > 700) return;
  // caçada em dupla: o Procurado só aparece com outro jogador junto
  if (q.duo && allPlayers().filter(p => Math.hypot(p.x - q.x, p.y - q.y) < 900).length < 2) {
    if (G.time - (G.duoWarn || -99) > 20) { G.duoWarn = G.time; G.toasts.push({ text: '👥 O Procurado só aparece quando você chega com outro jogador.', color: '#fca5a5', t: 3 }); }
    return;
  }
  const m = { pid: q.pid, zone: q.zone, x: q.x, y: q.y, tier: q.tier, duo: q.duo || 0 };
  if (isHost()) hostBounty(m); else if (NET.host && NET.host.open) NET.host.send({ t: 'bounty', ...m });
}
function hostBounty(m) {
  const key = m.pid + ':' + m.x + ':' + m.y;
  if (!POKE[m.pid] || (G.bountyCd[key] || 0) > G.time) return;
  if (G.enemies.some(e => e.bountyT !== undefined && e.pid === m.pid && Math.hypot(e.x - m.x, e.y - m.y) < 1200)) return;
  const b = hostSpawn(m.pid, m.zone, 1, m.x, m.y);
  bountyMod(b, m.tier || 0);
  if (m.duo) { b.maxHp = Math.round(b.maxHp * 1.1 * m.duo); b.hp = b.maxHp; b.name = `Procurado gigante: ${b.p.name}`; for (let i = 0; i < m.duo + 1; i++) hostSpawn(pick(ZONE_POOLS[m.zone]), m.zone, 1, m.x + rand(-160, 160), m.y + rand(-160, 160)); } // escolta de Alfas
  b.bkey = key;
  for (let i = 0; i < 2 + (m.tier || 0); i++) hostSpawn(pick(ZONE_POOLS[m.zone]), m.zone, 0, m.x + rand(-120, 120), m.y + rand(-120, 120));
  emitEvent({ t: 'toast', text: `🎯 ${b.name} apareceu!`, color: '#fca5a5', big: 1 });
}
function questTarget(P) {
  return (P && Object.values(P.quests || {}).find(q => q && !q.done && (q.k === 'caca' || q.k === 'duoCaca' || q.k === 'explorar'))) || null;
}

function claimQuest(P, g) {
  const q = P.quests[g];
  if (!q || !q.done) return;
  P.gold += q.gold;
  if (q.bonus === 'ball') P.balls += 2;
  else if (q.bonus === 'statpot') drinkStat(P, pick(ATTRS));
  else if (q.bonus) {
    const it = q.bonus === 'stone' ? stone(pick(TYPES)) : genItem(clamp(q.zt + 1, 0, 6));
    const i = P.inv.indexOf(null);
    if (i >= 0) P.inv[i] = it; else G.bags.push({ x: P.x, y: P.y + 30, items: [it], life: 90 });
  }
  G.toasts.push({ text: `🎁 Recompensa: +${q.xp} XP, +${q.gold} 🪙`, color: '#facc15', t: 3 });
  delete P.quests[g];
  if (g === 'grupo') { G.groupBoard = null; emitEvent({ t: 'gq', reset: 1 }); } // o mural é refeito para a sala
  P.qOffers[g] = genQuests(P, g);
  gainXP(q.xp, true);
}

/* ============ Eventos do mundo (simulados pelo host) ============ */
const EVENT_ICONS = { horda: '⚔', migracao: '🪶', meteoros: '☄', raro: '✨', noite: '🌙' };

function hostEvents(dt) {
  const ev = G.event;
  if (ev) {
    ev.ttl -= dt;
    updateEvent(ev, dt);
    if (G.event === ev && ev.ttl <= 0) endEvent(ev);
  } else {
    G.evT -= dt;
    if (G.evT <= 0) { G.evT = rand(90, 140); startEvent(); }
  }
  G.evInfo = G.event ? [G.event.kind, Math.round(G.event.x), Math.round(G.event.y), Math.round(G.event.ttl), G.event.label, G.event.left || 0, G.event.total || 0] : null;
}

function evSpot(pl) {
  for (let k = 0; k < 25; k++) {
    const a = Math.random() * 6.28, r = rand(450, 800);
    const x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r, z = zoneAt(x, y);
    if (z >= 1 && !solidAt(x, y) && !isWater(x, y)) return { x, y, z };
  }
  return null;
}

function startEvent() {
  const pls = allPlayers().filter(p => !inDungeonArea(p.x) && !inArena(p.x, p.y));
  if (!pls.length) return;
  const pl = pick(pls), pz = clamp(zoneAt(pl.x, pl.y), 1, 5);
  const kind = pick(['horda', 'migracao', 'meteoros', 'raro', 'noite']);
  const announce = (text, color) => emitEvent({ t: 'toast', text, color, big: 1 });
  if (kind === 'horda') {
    const s = evSpot(pl);
    if (!s) return;
    const pid = pick(ZONE_POOLS[s.z]);
    if (!POKE[pid]) return;
    const n = 8 + s.z * 2, ids = [];
    for (let i = 0; i < n; i++) { const e = hostSpawn(pid, s.z, 0, s.x + rand(-120, 120), s.y + rand(-120, 120)); e.ev = 1; ids.push(e.id); }
    G.event = { kind, x: s.x, y: s.y, ttl: 120, ids, total: n, left: n, zone: s.z, label: `Horda de ${POKE[pid].name}` };
    announce(`⚔ Uma horda de ${POKE[pid].name} apareceu! Derrote todos em 2 minutos.`, '#fb923c');
  } else if (kind === 'migracao') {
    const pid = pick(MIGRATION_POOL);
    if (!POKE[pid]) return;
    const a = Math.random() * 6.28, sx = pl.x + Math.cos(a) * 800, sy = pl.y + Math.sin(a) * 800;
    const vx = -Math.cos(a) * 170, vy = -Math.sin(a) * 170, ids = [];
    for (let i = 0; i < 10; i++) {
      const e = hostSpawn(pid, pz, 0, sx + rand(-90, 90), sy + rand(-90, 90));
      e.ev = 1; e.mig = { vx: vx * rand(0.9, 1.1), vy: vy * rand(0.9, 1.1) }; e.xp *= 2;
      ids.push(e.id);
    }
    G.event = { kind, x: sx, y: sy, ttl: 14, ids, total: 10, left: 10, zone: pz, label: `Revoada de ${POKE[pid].name}` };
    announce(`🪶 Uma revoada de ${POKE[pid].name} está cruzando a região! (XP em dobro)`, '#b2a6ff');
  } else if (kind === 'meteoros') {
    G.event = { kind, x: pl.x, y: pl.y, ttl: 25, next: 1, zone: pz, label: 'Chuva de Meteoros' };
    announce('☄ Uma chuva de meteoros começou! Desvie das sombras e pegue os cristais que caem.', '#fbbf24');
  } else if (kind === 'raro') {
    const s = evSpot(pl), pool = RARE_POOL.filter(id => POKE[id]);
    if (!s || !pool.length) return;
    const e = hostSpawn(pick(pool), s.z, 4, s.x, s.y);
    e.ev = 1;
    G.event = { kind, x: s.x, y: s.y, ttl: 60, ids: [e.id], zone: s.z, label: `${e.p.name} raro` };
    announce(`✨ Um ${e.p.name} raro foi avistado! Ele foge — enfraqueça e capture (é fácil de pegar).`, '#67e8f9');
  } else {
    G.event = { kind, x: 0, y: 0, ttl: 120, zone: pz, label: 'Noite Sombria' };
    announce('🌙 A noite caiu: Pokémon Fantasma e Sombrio surgem, todo XP vale +50% e fogos-fátuos flutuam nos campos.', '#a78bfa');
  }
}

function updateEvent(ev, dt) {
  if (ev.ids) {
    const alive = ev.ids.map(id => G.emap.get(id)).filter(Boolean);
    ev.left = alive.length;
    if (alive.length) { ev.x = alive.reduce((s, e) => s + e.x, 0) / alive.length; ev.y = alive.reduce((s, e) => s + e.y, 0) / alive.length; }
    if (ev.kind !== 'raro' && !alive.length) return eventDone(ev);
  }
  if (ev.kind === 'noite') nightHost(ev, dt);
  if (ev.kind === 'meteoros') {
    ev.next -= dt;
    if (ev.next <= 0) {
      ev.next = 0.7;
      const a = Math.random() * 6.28, r = rand(0, 380);
      emitEvent({ t: 'met', x: Math.round(ev.x + Math.cos(a) * r), y: Math.round(ev.y + Math.sin(a) * r), r: 75, delay: 1.6, zone: ev.zone });
    }
  }
}

function endEvent(ev) {
  if (ev.kind === 'meteoros' || ev.kind === 'noite') return eventDone(ev);
  if (ev.kind === 'migracao' && ev.left <= ev.total / 2) return eventDone(ev);
  for (const id of ev.ids || []) { const e = G.emap.get(id); if (e) { G.emap.delete(id); e.dead = true; } }
  G.enemies = G.enemies.filter(e => G.emap.has(e.id));
  const msg = { horda: 'A horda se dispersou...', migracao: 'A revoada passou.', raro: `O ${ev.label} fugiu!` }[ev.kind];
  emitEvent({ t: 'toast', text: msg, color: '#cbd5e1' });
  G.event = null;
}

function eventDone(ev) {
  for (const id of ev.ids || []) { const e = G.emap.get(id); if (e && e.mig) { G.emap.delete(id); e.dead = true; } }
  G.enemies = G.enemies.filter(e => G.emap.has(e.id));
  emitEvent({ t: 'evdone', label: ev.label, x: Math.round(ev.x), y: Math.round(ev.y), zone: ev.zone, global: ev.kind === 'noite' ? 1 : 0 });
  G.event = null;
}

function hostEventTargetGone(e) {
  const ev = G.event;
  if (ev && ev.kind === 'raro' && ev.ids.includes(e.id)) eventDone(ev);
}

function onEventDone(m) {
  const P = G.P;
  if (!P || inDungeonArea(P.x) || (!m.global && Math.hypot(P.x - m.x, P.y - m.y) > 1500)) return;
  const xp = Math.round(xpNeed(P.lvl) * 0.08), gold = 25 * (m.zone || 1);
  P.gold += gold; P.balls++;
  G.toasts.push({ text: `🎉 Evento concluído: ${m.label}! +${xp} XP, +${gold} 🪙, +1 Poké Ball`, color: '#facc15', t: 4, big: 1 });
  gainXP(xp, true);
  questProgress('evento');
  G.dirty = true;
}

const evView = () => (G.evInfo ? { kind: G.evInfo[0], x: G.evInfo[1], y: G.evInfo[2], ttl: G.evInfo[3], label: G.evInfo[4], left: G.evInfo[5], total: G.evInfo[6] } : null);
const isNight = () => !!(G.evInfo && G.evInfo[0] === 'noite');

/* ---------- Meteoros (cada cliente resolve o próprio dano) ---------- */
function updateMeteors(dt) {
  const P = G.P;
  for (const m of G.meteors) {
    m.t -= dt;
    if (m.t > 0) continue;
    m.dead = true;
    burst(m.x, m.y, '#fb923c', 30); burst(m.x, m.y, '#78716c', 20);
    G.fx.push({ k: 'ring', x: m.x, y: m.y, r: 0, R: m.r, life: 0.4, max: 0.4, color: '#fdba74', fill: true });
    if (P && Math.hypot(P.x - m.x, P.y - m.y) < 700) { G.shake = Math.min(10, G.shake + 5); sfx('boom'); }
    if (P && Math.hypot(P.x - m.x, P.y - m.y) < m.r + 10 && !(P.dodgeT > 0)) { // o rolamento escapa do impacto
      let eff = typeEff('rock', [pType(P)]);
      if (race(P).resist.includes('rock')) eff *= 0.5;
      // dano proporcional à vida máxima: 25% na zona 1 até 45% na zona 5 (antes das resistências e fraquezas)
      const dmg = Math.max(1, Math.round(maxHP(P) * (0.2 + 0.05 * m.zone) * rand(0.9, 1.1) * eff));
      P.hp -= dmg; P.sinceHit = 0;
      text(P.x, P.y - 34, `-${dmg} meteoro`, '#f87171', 16);
      if (P.hp <= 0) playerDie('uma chuva de meteoros');
    }
    if (isHost()) for (const e of G.enemies) if (e.hp > 0 && Math.hypot(e.x - m.x, e.y - m.y) < m.r + e.r) applyHit(e, Math.max(1, Math.round(e.maxHp * (e.boss ? 0.05 : 0.35))), null);
    if (G.P && Math.hypot(G.P.x - m.x, G.P.y - m.y) < 700 && Math.random() < 0.3) G.bags.push({ x: m.x, y: m.y, items: [stone(pick(TYPES))], life: 60 });
  }
  G.meteors = G.meteors.filter(m => !m.dead);
}
function drawMeteors(ox, oy) {
  for (const m of G.meteors) {
    const x = m.x + ox, y = m.y + oy, k = 1 - m.t / m.max;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(x, y, m.r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(251,146,60,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, m.r, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(251,146,60,.25)'; ctx.beginPath(); ctx.arc(x, y, m.r * k, 0, 7); ctx.fill();
    const fy = y - (1 - k) * 420;
    ctx.fillStyle = '#78716c'; ctx.beginPath(); ctx.arc(x + (1 - k) * 120, fy, 14, 0, 7); ctx.fill();
    ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.arc(x + (1 - k) * 120 + 6, fy - 8, 8, 0, 7); ctx.fill();
  }
}

/* ---------- Noite ---------- */
let nightCanvas = null;
function drawNight(ox, oy, R = 230, col = 'rgba(8,6,30,0.62)', alpha = 1) {
  if (!nightCanvas) nightCanvas = document.createElement('canvas');
  if (nightCanvas.width !== W || nightCanvas.height !== H) { nightCanvas.width = W; nightCanvas.height = H; }
  const x = nightCanvas.getContext('2d');
  x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, W, H);
  x.fillStyle = col; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'destination-out';
  const light = (lx, ly, r) => {
    const g = x.createRadialGradient(lx, ly, 0, lx, ly, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(lx, ly, r, 0, 7); x.fill();
  };
  if (G.P) light(G.P.x + ox, G.P.y + oy, R);
  for (const r of G.remotes.values()) if (!r.dead && r.tx !== undefined) light(r.x + ox, r.y + oy, R * 0.85);
  light(ox, oy, 280);
  ctx.globalAlpha = alpha;
  ctx.drawImage(nightCanvas, 0, 0);
  ctx.globalAlpha = 1;
}

function updateWorld(dt) {
  const P = G.P;
  if (P) {
    P.giftT = Math.max(0, (P.giftT || 0) - dt);
    G.nearNPC = nearNPC(P);
    if (G.pcRef && Math.hypot(G.pcRef.x - P.x, G.pcRef.y - P.y) > 110) closePC();
    if (G.npcOpen && G.npcOpen !== 'fly') {
      const n = G.npcRef || NPCS.find(x => x.id === G.npcOpen);
      if (!n || Math.hypot(n.x - P.x, n.y - P.y) > 110) closeNPC();
    }
  } else if (G.npcOpen) closeNPC();
  updateMeteors(dt);
  updateTeles(dt);
  nightTick(dt);
}

/* ============ Clima por zona ============
 * Cada zona sorteia um clima conforme o bioma (o host decide e manda no snapshot).
 * É um evento raro (~12% a cada 6-10 min por zona, dura 2-3 min). À noite o clima some (a noite já é o "clima" dela).
 * Os efeitos valem para todos: tiros do jogador, companheiros e golpes dos inimigos.
 */
const WEATHER = {
  chuva: { k: 'chuva', icon: '🌧', nome: 'Chuva', fx: 'Água e Elétrico +20% · Fogo −30%', boost: { water: 1.2, electric: 1.2, fire: 0.7 }, color: '#93c5fd' },
  sol: { k: 'sol', icon: '☀️', nome: 'Sol forte', fx: 'Fogo +20% · Água −30%', boost: { fire: 1.2, water: 0.7 }, color: '#fcd34d' },
  areia: { k: 'areia', icon: '🌪', nome: 'Tempestade de areia', fx: 'quem não é Pedra, Terra ou Aço perde vida', boost: { rock: 1.1, ground: 1.1 }, chip: ['rock', 'ground', 'steel'], color: '#e7c98a' },
  neve: { k: 'neve', icon: '❄️', nome: 'Nevasca', fx: 'quem não é Gelo perde vida e fica mais lento', boost: { ice: 1.2 }, chip: ['ice'], slow: 0.88, color: '#e0f2fe' },
};
const WEATHER_BY_BIO = { campo: ['chuva', 'sol'], floresta: ['chuva'], pantano: ['chuva'], deserto: ['sol', 'areia'], vulcao: ['sol'], neve: ['neve'], montanha: ['neve', 'chuva'] };
// clima no ponto (null à noite, nas cidades e onde não há clima)
function weatherAt(x, y) {
  if (!G || isNight()) return null;
  if (inDungeonArea(x)) { const dg = dungeonAt(x); return dg && dg.wx ? WEATHER[dg.wx] : null; }
  const z = zoneAt(x, y);
  return z >= 1 && z <= 5 && G.wx ? WEATHER[G.wx[z]] || null : null;
}
const wxBoost = (x, y, type) => { const w = weatherAt(x, y); return w && w.boost[type] || 1; };
function hostWeather(dt) {
  G.wx = G.wx || ['', '', '', '', '', ''];
  G.wxT = G.wxT || [0, rand(120, 600), rand(120, 600), rand(120, 600), rand(120, 600), rand(120, 600)];
  // clima é evento raro: a cada 6-10 min por zona, só ~12% de chance de começar; dura 2-3 min
  for (let z = 1; z <= 5; z++) {
    if ((G.wxT[z] -= dt) > 0) continue;
    const opts = ZONES[z] && WEATHER_BY_BIO[ZONES[z].bio] || [];
    if (G.wx[z]) { G.wx[z] = ''; G.wxT[z] = rand(360, 600); continue; }
    if (opts.length && Math.random() < 0.12) {
      const k = pick(opts);
      G.wx[z] = k; G.wxT[z] = rand(120, 180);
      emitEvent({ t: 'toast', text: `${WEATHER[k].icon} Evento raro: ${WEATHER[k].nome} em ${ZONES[z].nome}! (${WEATHER[k].fx})`, color: WEATHER[k].color, big: 1 });
    } else G.wxT[z] = rand(360, 600);
  }
}
// local (todo jogador): avisa quando o clima onde você está muda, e aplica o desgaste da areia/neve
function weatherTick(dt) {
  // anoitecer e amanhecer graduais (~25s), com céu de pôr/nascer do sol no meio
  G.nightK = clamp((G.nightK || 0) + (isNight() ? dt : -dt) / 25, 0, 1);
  const P = G.P;
  if (!P) return;
  const w = weatherAt(P.x, P.y), k = w ? w.k : '';
  if (k !== G.wxSeen) {
    if (w) G.toasts.push({ text: `${w.icon} ${w.nome} em ${areaName(P.x, P.y)}: ${w.fx}`, color: w.color, t: 5, big: 1 });
    else if (G.wxSeen && !isNight()) G.toasts.push({ text: '🌤 O tempo abriu.', color: '#e5e7eb', t: 2.5 });
    G.wxSeen = k;
  }
  if (w && w.chip && !P.pvp && !w.chip.includes(pType(P)) && !(M(P, 'wx' + w.k) > 0) && (G.wxChipT = (G.wxChipT || 2) - dt) <= 0) {
    G.wxChipT = 2;
    const dmg = Math.max(0, Math.min(P.hp - 1, Math.round(maxHP(P) * 0.015 * (1 - Math.min(1, M(P, 'wxcapa')))))); // incomoda, mas não mata
    if (dmg > 0) { P.hp -= dmg; text(P.x, P.y - 34, `-${dmg} ${w.icon}`, w.color, 12); }
  }
}
// camada de clima por cima do mundo
function drawWeather() {
  const P = G.P;
  let w = P && weatherAt(G.cam.x, G.cam.y);
  if (P && !w && !isNight() && !inDungeonArea(G.cam.x)) { const t = townAt(G.cam.x, G.cam.y); if (t && G.wx) w = WEATHER[G.wx[t.vz]] || null; }
  if (!w) return;
  const t = G.time;
  ctx.save();
  if (w.k === 'chuva') {
    ctx.fillStyle = 'rgba(30,58,138,.16)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(191,219,254,.55)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < 160; i++) { const x = ((i * 97.13 + t * 260) % (W + 60)) - 30, y = ((i * 53.71 + t * 900) % (H + 60)) - 30; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16); }
    ctx.stroke();
  } else if (w.k === 'sol') {
    ctx.fillStyle = 'rgba(253,186,116,.13)'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.85, -40, 10, W * 0.85, -40, W * 0.7);
    g.addColorStop(0, 'rgba(255,240,180,.35)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (w.k === 'areia') {
    ctx.fillStyle = 'rgba(180,140,70,.28)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(231,201,138,.6)';
    for (let i = 0; i < 140; i++) { const x = ((i * 131.7 + t * 520) % (W + 80)) - 40, y = (i * 61.3 + Math.sin(t * 2 + i) * 20) % H; ctx.fillRect(x, y, 10, 2); }
  } else if (w.k === 'neve') {
    ctx.fillStyle = 'rgba(224,242,254,.14)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 150; i++) { const x = ((i * 89.3 + Math.sin(t + i) * 30 + t * 40) % (W + 40)) - 20, y = ((i * 47.9 + t * 110) % (H + 40)) - 20; ctx.fillRect(x, y, i % 3 ? 2 : 3, i % 3 ? 2 : 3); }
  }
  ctx.restore();
}

/* ============ Pokédex por região ============
 * Espécies da região: zonas, água, noite, raros, migração, ginásios e lendários.
 * Visto = encontrou de perto. Capturado = pegou (lendários contam ao serem derrotados).
 * A Pesquisadora (na vila e na 2ª cidade) dá recompensas e títulos pelo progresso.
 */
const DEX_IDS = [], DEX_WHERE = {};
function buildDex() {
  const where = {};
  const add = (id, w) => { if (!id) return; (where[id] = where[id] || new Set()).add(w); };
  for (let z = 1; z <= 5; z++) { for (const id of ZONE_POOLS[z] || []) add(id, ZONES[z].nome); for (const id of WATER_POOLS[z] || []) add(id, `na água de ${ZONES[z].nome}`); }
  for (const id of NIGHT_POOL) add(id, 'à noite');
  for (const id of REGION.babies || []) add(id, `${ZONES[1].nome} (bem raro)`);
  for (const id of otherBabies(REGION)) add(id, `${ZONES[1].nome} (raríssimo)`);
  for (const id of RARE_POOL) add(id, 'raro (eventos)');
  for (const id of MIGRATION_POOL) add(id, 'migração (eventos)');
  for (const k of Object.keys(THEMES)) { const t = THEMES[k]; if (!t.story) continue; for (const id of t.pool) add(id, t.nome); add(t.boss, t.nome); }
  for (const id of BOSSES) add(id, 'lendário (depois da história)');
  replaceArr(DEX_IDS, Object.keys(where).map(Number).sort((a, b) => a - b));
  for (const k of Object.keys(DEX_WHERE)) delete DEX_WHERE[k];
  for (const id of DEX_IDS) DEX_WHERE[id] = [...where[id]].join(' · ');
}
const dexOf = P => { P.dexR = P.dexR || {}; return P.dexR[REGION_ID] = P.dexR[REGION_ID] || { s: [], c: [], claim: [] }; };
function dexSee(P, pid) { const d = dexOf(P); if (DEX_WHERE[pid] && !d.s.includes(pid)) { d.s.push(pid); G.dirty = true; } }
function dexCatch(P, pid) {
  const d = dexOf(P);
  dexSee(P, pid);
  if (!DEX_WHERE[pid] || d.c.includes(pid)) return;
  d.c.push(pid);
  const pc = Math.floor(d.c.length / DEX_IDS.length * 100), next = DEX_GOALS.find(g => !d.claim.includes(g.pc) && pc >= g.pc);
  G.toasts.push({ text: `📖 ${POKE[pid] ? POKE[pid].name : 'Novo Pokémon'} registrado na Pokédex (${d.c.length}/${DEX_IDS.length})${next ? ' · fale com a Pesquisadora!' : ''}`, color: '#a7f3d0', t: 3.5 });
}
// marca como vistos os Pokémon por perto
function dexTick(dt) {
  const P = G.P;
  if (!P || (G.dexT = (G.dexT || 0) - dt) > 0) return;
  G.dexT = 0.5;
  for (const e of G.enemies) if (!e.dead && Math.abs(e.x - P.x) < 560 && Math.abs(e.y - P.y) < 400) dexSee(P, e.pid);
}
const regTitle = s => s.replace('{R}', REGION.nome);
const DEX_GOALS = [
  { pc: 10, txt: '5 Great Balls', give: P => { P.bag.grande += 5; } },
  { pc: 25, txt: '3 Ultra Balls e +1 vaga de companheiro', give: P => { P.bag.ultra += 3; if (petCap(P) < PET_CAP_MAX) P.petCap = petCap(P) + 1; else P.bag.ultra += 3; } },
  { pc: 50, txt: 'Amuleto do Colecionador e o título "Pesquisador(a) de {R}"', title: 'Pesquisador(a) de {R}',
    give: P => giveItem(P, { slot: 'amuleto', tier: 4, name: 'Amuleto do Colecionador', mods: { cap: 2, xp: 0.1 } }) },
  { pc: 75, txt: 'Poção de atributo, 5 Ultra Balls e o título "Colecionador(a) de {R}"', title: 'Colecionador(a) de {R}', give: P => { drinkStat(P, pick(ATTRS)); P.bag.ultra += 5; } },
  { pc: 100, txt: 'Um item Artefato e o título "Mestre Pokémon de {R}"', title: 'Mestre Pokémon de {R}', give: P => giveItem(P, genItem(6)) },
];
function giveItem(P, it) { const i = P.inv.indexOf(null); if (i >= 0) P.inv[i] = it; else G.bags.push({ x: P.x, y: P.y + 30, items: [it], life: 120 }); }
function dexClaim(P, pc) {
  const d = dexOf(P), g = DEX_GOALS.find(x => x.pc === pc);
  if (!g || d.claim.includes(pc) || d.c.length / DEX_IDS.length * 100 < pc) return;
  d.claim.push(pc);
  g.give(P);
  if (g.title) { P.titles = P.titles || []; const t = regTitle(g.title); if (!P.titles.includes(t)) P.titles.push(t); P.title = t; }
  G.toasts.push({ text: `🎁 Pokédex ${pc}%: ${regTitle(g.txt)}`, color: '#fde047', t: 5, big: 1 });
  sfx('lvl'); saveGame();
}
const dexIcon = pid => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-vii/icons/${pid}.png`;
const dexName = pid => (POKE[pid] || (typeof POKEDEX_PRELOAD !== 'undefined' && POKEDEX_PRELOAD[pid]) || {}).name || '???';
function renderDex() {
  const P = G.P, d = dexOf(P), box = $('dex');
  const f = G.dexF || 'todos';
  const ids = DEX_IDS.filter(pid => { const c = d.c.includes(pid), s = c || d.s.includes(pid); return f === 'todos' || (f === 'cap' ? c : f === 'vis' ? s && !c : !s); });
  const cells = ids.map(pid => {
    const c = d.c.includes(pid), s = c || d.s.includes(pid), p = POKE[pid] || (typeof POKEDEX_PRELOAD !== 'undefined' && POKEDEX_PRELOAD[pid]);
    const ty = s && p ? p.types.map(t => `<i class="dt" style="background:${TYPE_COLORS[t]}"></i>`).join('') : '';
    return `<div class="dexc ${c ? 'got' : s ? 'seen' : 'unk'}" title="${s ? `${esc(dexName(pid))} — ${DEX_WHERE[pid]}` : '??? — ainda não encontrado'}">
      <em>#${String(pid).padStart(3, '0')}</em>${c ? '<b class="ball"></b>' : ''}
      <img src="${dexIcon(pid)}" alt="" loading="lazy"><span>${s ? esc(dexName(pid)) : '???'}</span><div class="dts">${ty}</div></div>`;
  }).join('');
  const pc = d.c.length / DEX_IDS.length * 100;
  const tab = (k, t) => `<button data-dexf="${k}" class="${f === k ? 'on' : ''}">${t}</button>`;
  box.innerHTML = `<div class="dexhead"><span class="dextitle">Pokédex · ${REGION.nome}</span><button data-dexf="x" title="Fechar ([P])">✕</button></div>
    <div class="bar dexbar"><div style="width:${pc}%"></div><span>${d.c.length}/${DEX_IDS.length} capturados · ${d.s.length} vistos · ${Math.floor(pc)}%</span></div>
    <div class="dextabs">${tab('todos', 'Todos')}${tab('cap', 'Capturados')}${tab('vis', 'Só vistos')}${tab('falta', 'Faltando')}</div>
    <div class="dexgrid">${cells || '<div class="small">Nada aqui ainda.</div>'}</div>
    <div class="small dexfoot">Passe o mouse para ver onde cada um aparece · lendários contam ao serem derrotados · recompensas com a Pesquisadora Íris (vila e 2ª cidade)</div>`;
}
function toggleDex() {
  const box = $('dex');
  if (box.classList.contains('hidden')) { renderDex(); box.classList.remove('hidden'); } else box.classList.add('hidden');
}
function renderDexNPC(P) {
  const d = dexOf(P), pc = d.c.length / DEX_IDS.length * 100;
  return `<p class="fala">"Estou registrando todas as espécies de ${REGION.nome}. Cada Pokémon que você captura me ajuda muito, e eu sei recompensar quem ajuda!"</p>
    <div class="small">Capturados: <b>${d.c.length}/${DEX_IDS.length}</b> (${Math.floor(pc)}%) · vistos: ${d.s.length}. Abra a Pokédex com <b>[P]</b>.</div>
    ${DEX_GOALS.map(g => { const ok = d.claim.includes(g.pc), can = !ok && pc >= g.pc;
      return `<div class="shoprow"><span>${ok ? '✅' : can ? '🎁' : '🔒'} <b>${g.pc}%</b>: ${regTitle(g.txt)}</span>${can ? `<button data-act="dex:${g.pc}" class="good">Receber</button>` : ''}</div>`; }).join('')}
    <button data-act="dexopen">📖 Abrir a Pokédex</button>`;
}
document.addEventListener('click', ev => { const b = ev.target.closest('[data-dexf]'); if (!b || !G || !G.P) return; if (b.dataset.dexf === 'x') $('dex').classList.add('hidden'); else { G.dexF = b.dataset.dexf; renderDex(); } });
// clicar no título (no painel) troca entre os títulos conquistados, de qualquer região
document.addEventListener('click', ev => { if (!ev.target.closest('[data-title]') || !G || !G.P) return; const P = G.P, T = P.titles || []; if (T.length < 2) return; P.title = T[(T.indexOf(P.title) + 1) % T.length]; G.dirty = true; saveGame(); });
document.addEventListener('click', ev => { if (ev.target.closest('[data-dexopen]') && G && G.P) toggleDex(); });

/* ============ Exploração: baús escondidos, baús do guardião e marcos de mapa explorado ============
 * Além dos 6 baús selados (com anel de HM), cada personagem tem ~10 baús escondidos e 2 do guardião por região,
 * em lugares sorteados para ele (fixos para aquele personagem). Os escondidos só aparecem de perto;
 * os do guardião ficam em lugares remotos das zonas 4-5 e um chefe surge quando você chega.
 */
const XCHESTS = [];
function rng32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function buildExploreChests(P) {
  XCHESTS.length = 0;
  if (!P.wseed) P.wseed = randi(1, 1e9);
  let h = P.wseed; for (const c of REGION_ID) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const R = rng32(h), placed = SECRETS.map(s => [s.x, s.y]);
  const far = (x, y, d) => placed.every(([a, b]) => Math.hypot(a - x, b - y) > d);
  const place = (z, kind, n, minPath) => {
    const pts = (ZPTS[z] || []).filter(([x, y]) => !inTown(x, y) && pathDist(x, y) > minPath && tileKind(x, y) !== TK.TALL || false);
    for (let k = 0, tries = 0; k < n && tries < 400 && pts.length; tries++) {
      const [x, y] = pts[Math.floor(R() * pts.length)];
      if (!far(x, y, 700)) continue;
      placed.push([x, y]);
      XCHESTS.push({ id: `${REGION_ID}_${kind}${XCHESTS.length}`, kind, x, y, zone: z });
      k++;
    }
  };
  for (let z = 1; z <= 5; z++) place(z, 'esc', 2, 200);
  place(4, 'gua', 1, 320); place(5, 'gua', 1, 320);
}
const xOpen = (P, c) => P.chests.includes(c.id);
const guardAlive = c => G.enemies.some(e => e.kind === 3 && !e.dead && e.hp > 0 && !e.dg && Math.hypot(e.x - c.x, e.y - c.y) < 420);
function nearXChest(P) {
  if (inDungeonArea(P.x)) return null;
  return XCHESTS.find(c => !xOpen(P, c) && Math.hypot(c.x - P.x, c.y - P.y) < 48) || null;
}
function openXChest(P, c) {
  if (c.kind === 'gua' && guardAlive(c)) return G.toasts.push({ text: '👑 O guardião protege o baú. Derrote-o primeiro!', color: '#fca5a5', t: 2.5 });
  P.chests.push(c.id);
  const z = c.zone;
  let items, gold;
  if (c.kind === 'gua') {
    const acc = genItem(5, pick(['anel', 'amuleto'])); if (!acc.name.includes('✧') && Math.random() < 0.5) enchant(acc);
    items = [statPot(), genItem(clamp(z + 2, 0, 6)), acc, consItem('ultra'), consItem('ultra')]; gold = 400;
  } else {
    items = [genItem(clamp(z + 1, 0, 6)), potion(), Math.random() < 0.5 ? ballItem() : consItem('grande')];
    if (Math.random() < 0.25) items.push(consItem('doce'));
    gold = 30 * z;
  }
  P.gold += gold;
  G.bags.push({ x: c.x, y: c.y + 16, items, life: 120 });
  G.toasts.push({ text: c.kind === 'gua' ? `👑 Baú do guardião aberto! +${gold} 🪙 e tesouros raros` : `🎁 Baú escondido! +${gold} 🪙`, color: '#facc15', t: 4, big: c.kind === 'gua' ? 1 : 0 });
  burst(c.x, c.y, '#facc15', 30); sfx('lvl'); saveGame();
}
// guardião: surge quando você chega perto (o host cria; o cliente pede)
function exploreTick(dt) {
  const P = G.P;
  if (!P || inDungeonArea(P.x) || (G.xT = (G.xT || 0) - dt) > 0) return;
  G.xT = 0.5;
  G.guardSent = G.guardSent || new Set();
  for (const c of XCHESTS) {
    if (c.kind !== 'gua' || xOpen(P, c) || G.guardSent.has(c.id) || Math.hypot(c.x - P.x, c.y - P.y) > 520) continue;
    G.guardSent.add(c.id);
    const pid = pick((ZONE_POOLS[c.zone] || []).filter(id => POKE[id]));
    if (!pid) continue;
    if (isHost()) spawnGuardian(pid, c.zone, c.x, c.y);
    else if (NET.host && NET.host.open) NET.host.send({ t: 'guard', pid, z: c.zone, x: Math.round(c.x), y: Math.round(c.y) });
    G.toasts.push({ text: '👑 Um guardião protege um baú aqui perto!', color: '#fca5a5', t: 4, big: 1 });
  }
}
function spawnGuardian(pid, z, x, y) { const e = hostSpawn(pid, z, 3, x + 60, y - 40); e.name = `Guardião (${e.p.name})`; }
function drawXChests(ox, oy) {
  const P = G.P;
  if (!P) return;
  for (const c of XCHESTS) {
    const open = xOpen(P, c), d = Math.hypot(c.x - P.x, c.y - P.y);
    if (c.kind === 'esc' && !open && d > (P.lin === 'lobisomem' ? 320 : 170)) continue; // escondido: só aparece de perto (o faro do lobisomem vê de longe)
    const x = c.x + ox, y = c.y + oy;
    if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
    const gold = c.kind === 'gua';
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 14, y + 8, 28, 5);
    ctx.fillStyle = gold ? '#4c1d95' : '#7c4a1e'; ctx.fillRect(x - 13, y - 6, 26, 16);
    ctx.fillStyle = open ? '#2a1a3a' : gold ? '#a78bfa' : '#a16207'; ctx.fillRect(x - 13, y - (open ? 14 : 12), 26, open ? 5 : 8);
    ctx.fillStyle = '#facc15'; ctx.fillRect(x - 2, y - 5, 4, 5);
    if (!open && Math.random() < (gold ? 0.15 : 0.05)) G.parts.push({ x: c.x + rand(-12, 12), y: c.y - 10, vx: 0, vy: -25, life: 0.7, color: gold ? '#c4b5fd' : '#fde047', size: 2 });
  }
}
// marcos de exploração do mapa (porcentagem da TERRA revelada, por região)
const EXPLORE_GOALS = [
  { pc: 25, txt: '3 Great Balls e um Doce Raro', give: P => { P.bag.grande += 3; P.bag.doce += 1; } },
  { pc: 50, txt: '5 Ultra Balls e uma Poção de Atributo', give: P => { P.bag.ultra += 5; drinkStat(P, pick(ATTRS)); } },
  { pc: 75, txt: 'um anel ou amuleto encantado ✧', give: P => giveItem(P, enchant(genItem(5, pick(['anel', 'amuleto'])))) },
  { pc: 95, txt: 'um Artefato e o título "Explorador(a) de {R}"', title: 'Explorador(a) de {R}', give: P => giveItem(P, genItem(6)) },
];
function landExplored() { return G.landTotal ? G.landSeen / G.landTotal * 100 : 0; }
function exploreCheck(P) {
  const pc = landExplored(); P.expR = P.expR || {}; const done = P.expR[REGION_ID] = P.expR[REGION_ID] || [];
  for (const g of EXPLORE_GOALS) {
    if (pc < g.pc || done.includes(g.pc)) continue;
    done.push(g.pc); g.give(P);
    if (g.title) { P.titles = P.titles || []; const t = regTitle(g.title); if (!P.titles.includes(t)) P.titles.push(t); P.title = t; }
    G.toasts.push({ text: `🗺️ ${g.pc}% de ${REGION.nome} explorado! Recompensa: ${regTitle(g.txt)}`, color: '#93c5fd', t: 6, big: 1 });
    sfx('lvl'); saveGame();
  }
}

/* ============ Templo (2ª cidade): o Clérigo escolhe a bênção ativa ============ */
function renderTemple(P) {
  const ph = blessPhase(P);
  if (!ph) return '<p class="fala">"A luz acolhe todos os viajantes. Só os Clérigos carregam as bênçãos deste templo para a batalha... mas há outra coisa guardada aqui embaixo."</p>' + renderLinQuest(P);
  const phName = ph === 'clerigo' ? 'Clérigo' : subInfo(ph).nome, cur = blessOf(P);
  const opts = Object.entries(BLESS).filter(([, b]) => b.subs.includes(ph));
  let h = `<p class="fala">"Escolha a bênção que vai junto com as suas curas. Você pode trocar sempre que voltar aqui."</p>
    <h4>Bênçãos do ${esc(phName)}</h4>`;
  h += opts.map(([id, b]) => `<div class="shoprow"><span>${b.icon} <b>${b.nome}</b><br><i>${b.desc}</i></span>
    ${cur === id ? '<button disabled>Ativa ✓</button>' : `<button data-act="bless:${id}" class="good">Escolher</button>`}</div>`).join('');
  h += renderLinQuest(P, true);
  h += `<div class="small">As bênçãos valem para quem você cura (Tomo, Santuário e Hino). Em você mesmo valem menos (escudo pela metade, bônus de dano em 35%).${ph === 'clerigo' ? ` No Nv ${SUB_LVL}, cada subclasse libera bênçãos mais fortes.` : ''}</div>`;
  return h;
}

/* ---------- Missão do templo: as maldições do Sangue e da Lua ---------- */
// P.tq = etapa (0 nada, 1 caçada noturna, 2 relicário, 3 escolha, 4 feita) · P.tqN = progresso
const TQ_NIGHT = 12, TQ_LVL = 12, TQ_UNDO = 1500;
function renderLinQuest(P, cleric) {
  const s = P.tq || 0, hd = '<h4>As maldições do templo</h4>';
  if (s === 0) {
    if (P.lvl < TQ_LVL) return cleric ? '' : `<div class="small">Volte quando estiver no Nv ${TQ_LVL} ou mais.</div>`;
    return `${hd}<div class="quest cur"><p class="fala">"Embaixo deste templo dormem duas maldições antigas: o <b>Sangue</b> e a <b>Lua</b>. Elas escolhem quem tem coragem de libertá-las... e cobram um preço. Quer tentar?"</p>
      <div class="small">Recompensa: virar <b>🧛 Vampiro</b> ou <b>🐺 Lobisomem</b> (fica por cima da sua raça).</div></div><button data-act="tq:start" class="good">🕯️ Aceitar a missão</button>`;
  }
  if (s === 1) return `${hd}<div class="quest cur"><b>🌑 Caçada às sombras</b><p class="fala">"As maldições só acordam perto das criaturas das sombras. Derrote Pokémon dos tipos Fantasma ou Sombrio."</p>
    <div class="qbar"><div style="width:${Math.min(100, (P.tqN || 0) / TQ_NIGHT * 100)}%"></div></div><div class="small">${P.tqN || 0}/${TQ_NIGHT} Fantasma ou Sombrio derrotados</div></div>`;
  if (s === 2) return `${hd}<div class="quest cur"><b>⚱️ O relicário</b><p class="fala">"Elas acordaram. Agora preciso do relicário que as prende: ele sempre aparece no fundo de uma masmorra. Derrote o chefe de qualquer masmorra e traga."</p>
    <div class="small">🎯 Conclua uma masmorra (derrote o chefe)</div></div>`;
  if (s === 3) return `${hd}<div class="quest cur"><b>🕯️ O pacto</b><p class="fala">"O relicário está aberto. Escolha qual maldição vai carregar. Ela fica com você em todas as regiões."</p>
    <div class="shoprow"><span>🧛 <b>Pacto do Sangue: Vampiro</b><br><i>Visão noturna. Rouba 4% do dano que causa. Resiste a Veneno e Sombrio. De dia regenera pela metade fora das cidades e leva +10% de Fogo. A cada noite, 50% de chance de virar morcego aos poucos, conforme escurece (${REGION_ID === 'unova' ? 'Woobat, Swoobat' : 'Zubat, Golbat, Crobat'}), até o amanhecer: rouba 10% e fica +30% mais rápido, mas leva +10% de dano.</i></span><button data-act="tq:vampiro" class="good">Escolher</button></div>
    <div class="shoprow"><span>🐺 <b>Pacto da Lua: Lobisomem</b><br><i>Visão noturna, instinto (crítico a partir do 19) e faro para baús escondidos; +5% de velocidade. A cada noite, 50% de chance de virar ${POKE[wolfPid()] ? POKE[wolfPid()].name : 'o lobo da região'} aos poucos, conforme escurece, até o amanhecer: +35% de cadência, +20% de dano, uivo que deixa os inimigos lentos e cada abate cura 5% da vida, mas sem poções nem especial. Leva +10% de Fogo e de Fada.</i></span><button data-act="tq:lobisomem" class="good">Escolher</button></div></div>`;
  const L = LIN[P.lin];
  return `${hd}<div class="quest"><p class="fala">"${L ? `A maldição do ${L.nome} corre em você.` : 'Você não carrega maldição nenhuma.'} Se quiser se livrar dela e escolher de novo, eu faço o ritual... mas não é de graça."</p>
    <button data-act="tq:undo" ${P.gold < TQ_UNDO ? 'disabled' : ''}>Desfazer o pacto (${TQ_UNDO} 🪙)</button></div>`;
}
function templeAct(P, a) {
  if (a === 'start' && !P.tq && P.lvl >= TQ_LVL) { P.tq = 1; P.tqN = 0; G.toasts.push({ text: `🕯️ Missão do templo: derrote ${TQ_NIGHT} Pokémon Fantasma ou Sombrio.`, color: '#c4b5fd', t: 5, big: 1 }); }
  else if ((a === 'vampiro' || a === 'lobisomem') && P.tq === 3) {
    P.lin = a; P.tq = 4; P.moon = 0; P.nightSeen = isNight();
    burst(P.x, P.y, a === 'vampiro' ? '#7c3aed' : '#dc2626', 40);
    G.toasts.push({ text: a === 'vampiro' ? '🧛 Você selou o Pacto do Sangue. A noite agora é sua.' : '🐺 Você selou o Pacto da Lua. Cuidado quando ela encher...', color: '#fca5a5', t: 6, big: 1 });
    sfx('boss');
  } else if (a === 'undo' && P.tq === 4 && P.gold >= TQ_UNDO) { P.gold -= TQ_UNDO; P.lin = null; P.tq = 3; if (P.lform) endLForm(P); sfx('pot'); }
  else return;
  saveGame();
}
function templeKill(P, m) {
  const tps = (POKE[m.pid] || {}).types || [m.type];
  if (P.tq === 1 && (tps.includes('ghost') || tps.includes('dark'))) { P.tqN = (P.tqN || 0) + 1; if (P.tqN >= TQ_NIGHT) { P.tq = 2; G.toasts.push({ text: '🕯️ As maldições acordaram! Agora conclua uma masmorra para achar o relicário.', color: '#c4b5fd', t: 6, big: 1 }); sfx('lvl'); } }
  else if (P.tq === 2 && m.kind === 3) { P.tq = 3; G.toasts.push({ text: `⚱️ Você achou o relicário! Leve à Sacerdotisa Aurora em ${TOWNS[1] ? townName(TOWNS[1]) : 'na 2ª cidade'}.`, color: '#c4b5fd', t: 6, big: 1 }); sfx('lvl'); }
}

/* ============ Eventos da noite ============
 * Durante a Noite Sombria: (1) um Alfa noturno aparece perto de alguém e deixa um tesouro ao cair;
 * (2) Baús da Lua surgem pelo mapa e só existem até o amanhecer (cada jogador abre o seu);
 * (3) fogos-fátuos flutuam pelos campos: fogem de você, mas quem encosta ganha um presentinho.
 */
function moonMod(e) {
  e.moonA = 1; e.alfa = true;
  e.name = `Alfa ${e.p.name}`;
  e.maxHp = Math.round(e.maxHp * 1.6); e.hp = e.maxHp;
  e.scale *= 1.15; e.w *= 1.15; e.h *= 1.15; e.r *= 1.15;
  e.color = '#c4b5fd';
}
// host: chamado a cada quadro da noite
function nightHost(ev, dt) {
  const pls = allPlayers().filter(p => !inDungeonArea(p.x) && !inArena(p.x, p.y));
  if (!pls.length) return;
  if (!ev.chests) {
    ev.chests = 1;
    const list = [];
    // 50% de chance por noite (para cada jogador); quando surgem, ficam longe: entre 50 e 300 m (1 m = 32 px)
    for (const pl of pls) if (Math.random() < 0.5) for (let k = 0; k < 1; k++) { const s = farSpot(pl, 1600, 9600); if (s) list.push({ id: `${G.time | 0}_${list.length}`, x: Math.round(s.x), y: Math.round(s.y), z: s.z, for: pl.id || null }); }
    if (list.length) emitEvent({ t: 'moonch', l: list });
  }
  ev.moonT = (ev.moonT === undefined ? 15 : ev.moonT) - dt;
  if (ev.moonT <= 0 && !ev.moonDone) {
    ev.moonDone = 1;
    const pl = pick(pls), s = evSpot(pl);
    const pool = s && (REGION.moon || NIGHT_POOL).filter(id => POKE[id]);
    if (!s || !pool.length) return;
    const e = hostSpawn(pick(pool), s.z, 1, s.x, s.y);
    moonMod(e);
    emitEvent({ t: 'toast', text: `🌕 Um ${e.name} surgiu na escuridão! Derrote-o para pegar o tesouro dele.`, color: '#c4b5fd', big: 1 });
  }
}
// todos: tesouro do Alfa noturno (cada jogador perto ganha o seu)
function moonAlfaLoot(m) {
  const P = G.P;
  if (!P || Math.hypot(P.x - m.x, P.y - m.y) > 900) return;
  const z = m.zone || 1, items = [stone(pick(TYPES)), genItem(clamp(z + 2, 0, 6))];
  if (Math.random() < 0.4) items.push(consItem('doce'));
  G.bags.push({ x: m.x, y: m.y + 10, items, life: 120 });
  G.toasts.push({ text: '🌕 O Alfa da noite deixou um tesouro!', color: '#c4b5fd', t: 4 });
}
// Baús da Lua
// Baús da Lua e fogos-fátuos só aparecem quando já está bem escuro (o anoitecer leva ~25 s)
const deepNight = () => isNight() && (G.nightK || 0) > 0.97;
function moonChestEvent(m) {
  G.moonCh = (G.moonCh || []).concat(m.l);
  const P = G.P;
}
// ponto em terra firme a uma distância entre rMin e rMax do jogador
function farSpot(pl, rMin, rMax) {
  for (let k = 0; k < 60; k++) {
    const a = Math.random() * 6.28, r = rand(rMin, rMax), x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r, z = zoneAt(x, y);
    if (z >= 1 && z <= Math.min(5, Math.max(1, zoneAt(pl.x, pl.y)) + 1) && !solidAt(x, y) && !isWater(x, y)) return { x, y, z }; // no máximo 1 zona acima da sua
  }
  return null;
}
const moonChOpen = c => (G.moonOpen = G.moonOpen || new Set()).has(c.id);
function nearMoonChest(P) {
  if (!deepNight() || inDungeonArea(P.x)) return null;
  return (G.moonCh || []).find(c => !moonChOpen(c) && Math.hypot(c.x - P.x, c.y - P.y) < 48) || null;
}
function openMoonChest(P, c) {
  G.moonOpen.add(c.id);
  const items = [genItem(clamp(c.z + 1, 0, 6)), stone(pick(TYPES)), consItem('ultra')];
  const gold = 40 * c.z;
  P.gold += gold;
  G.bags.push({ x: c.x, y: c.y + 16, items, life: 120 });
  G.toasts.push({ text: `🌙 Baú da Lua aberto! +${gold} 🪙`, color: '#c4b5fd', t: 4 });
  burst(c.x, c.y, '#c4b5fd', 30); sfx('lvl'); saveGame();
}
// fogos-fátuos (cada jogador vê os seus)
function nightTick(dt) {
  const P = G.P;
  if (!P) return;
  if (!isNight()) { G.moonCh = []; G.moonOpen = null; G.wisps = []; return; }
  G.wisps = G.wisps || [];
  if (deepNight() && !inDungeonArea(P.x) && !inTown(P.x, P.y) && G.wisps.length < 3 && (G.wispT = (G.wispT || 8) - dt) <= 0) {
    G.wispT = rand(18, 30);
    const a = Math.random() * 6.28, r = rand(260, 420), x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
    if (zoneAt(x, y) >= 1 && !isWater(x, y)) G.wisps.push({ x, y, t: 0, life: 45 });
  }
  for (const w of G.wisps) {
    w.t += dt; w.life -= dt;
    const dx = w.x - P.x, dy = w.y - P.y, d = Math.hypot(dx, dy) || 1;
    // foge quando você chega perto, mas um pouco mais devagar que você correndo
    const sp = d < 140 ? moveSpeed(P) * 0.75 : 25;
    w.x += (d < 140 ? dx / d : Math.cos(w.t * 0.7)) * sp * dt; w.y += (d < 140 ? dy / d : Math.sin(w.t * 0.9)) * sp * dt;
    if (Math.random() < 0.3) G.parts.push({ x: w.x + rand(-5, 5), y: w.y + rand(-5, 5), vx: 0, vy: -20, life: 0.5, color: Math.random() < 0.5 ? '#67e8f9' : '#c4b5fd', size: 2 });
    if (d < 26) {
      w.life = 0;
      const z = clamp(zoneAt(P.x, P.y), 1, 5), r = Math.random();
      if (r < 0.12) { P.bag.doce++; G.toasts.push({ text: '✨ O fogo-fátuo virou um Doce Raro!', color: '#67e8f9', t: 3 }); }
      else if (r < 0.3) { G.bags.push({ x: P.x, y: P.y + 20, items: [stone(pick(TYPES))], life: 60 }); G.toasts.push({ text: '✨ O fogo-fátuo deixou um cristal!', color: '#67e8f9', t: 3 }); }
      else if (r < 0.5) { P.pots.hp++; G.toasts.push({ text: '✨ O fogo-fátuo virou uma Poção de Cura!', color: '#67e8f9', t: 3 }); }
      else { const g = 20 * z; P.gold += g; G.toasts.push({ text: `✨ O fogo-fátuo se desfez em ${g} 🪙!`, color: '#67e8f9', t: 3 }); }
      burst(w.x, w.y, '#67e8f9', 24); sfx('pick'); G.dirty = true;
    }
  }
  G.wisps = G.wisps.filter(w => w.life > 0);
}
function drawNightStuff(ox, oy) {
  if (!deepNight()) return;
  for (const c of G.moonCh || []) {
    if (moonChOpen(c)) continue;
    const x = c.x + ox, y = c.y + oy;
    if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
    const g = 0.5 + Math.sin(G.time * 3) * 0.2;
    ctx.fillStyle = `rgba(196,181,253,${g * 0.4})`; ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.fill();
    ctx.fillStyle = '#1e1b4b'; ctx.fillRect(x - 13, y - 6, 26, 16);
    ctx.fillStyle = '#a5b4fc'; ctx.fillRect(x - 13, y - 12, 26, 8);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(x - 2, y - 5, 4, 5);
    if (Math.random() < 0.15) G.parts.push({ x: c.x + rand(-12, 12), y: c.y - 10, vx: 0, vy: -25, life: 0.7, color: '#e0e7ff', size: 2 });
  }
  for (const w of G.wisps || []) {
    const x = w.x + ox, y = w.y + oy + Math.sin(w.t * 3) * 4, a = Math.min(1, w.life / 3);
    const gr = ctx.createRadialGradient(x, y, 1, x, y, 16);
    gr.addColorStop(0, `rgba(240,253,255,${a})`); gr.addColorStop(0.4, `rgba(103,232,249,${a * 0.7})`); gr.addColorStop(1, 'rgba(103,232,249,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill();
  }
}

/* ---------- Mural de Grupo (um mural de madeira na praça das cidades) ----------
 * Um mural só para a sala inteira: todos veem as MESMAS 3 ofertas (evento 'gq' com o mural). Quando qualquer um aceita,
 * o contrato fica ativo para todos na sala, e o progresso de todos soma (até ~50 m de distância). O XP é recalculado pelo nível de cada um (q.xpk).
 * Quando alguém recebe a recompensa, o mural é refeito para a sala.
 */
const groupStrip = q => { const c = { ...q }; delete c.have; delete c.done; delete c.seen; return c; };
function groupOffer(P, g) {
  if (g !== 'grupo' || !G.remotes.size) return;
  const b = G.groupBoard;
  if (b && b.reg === REGION_ID) P.qOffers.grupo = b.list.map(o => ({ ...o, have: 0, done: false, seen: [], xp: Math.round(xpNeed(P.lvl) * o.xpk) }));
  else { G.groupBoard = { reg: REGION_ID, list: P.qOffers.grupo.map(groupStrip) }; emitEvent({ t: 'gq', board: G.groupBoard }); }
}
function groupQEvent(m, local) {
  const P = G.P;
  if (m.board) { if (!local) G.groupBoard = m.board; return; }
  if (m.reset) { if (!local) G.groupBoard = null; return; }
  if (local || !m.start || !P) return;
  // quem aceita ativa o contrato para todos na sala (cada um com o XP do próprio nível)
  P.quests = P.quests || {};
  const cur = P.quests.grupo;
  if (cur && cur.gid === m.start.gid) return;
  P.quests.grupo = { ...m.start, have: 0, done: false, seen: [], xp: Math.round(xpNeed(P.lvl) * m.start.xpk) };
  P.qOffers = P.qOffers || {}; P.qOffers.grupo = null;
  G.toasts.push({ text: `👥 ${m.acc} aceitou um contrato de grupo e ele já está ativo para você: "${m.desc}"`, color: '#93c5fd', t: 7, big: 1 });
  G.dirty = true; saveGame();
}
