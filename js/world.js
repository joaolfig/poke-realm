'use strict';
/* ============ Vila: NPCs, loja, ferreiro e missões ============ */
const NPCS = [
  { id: 'cura', nome: 'Vendedora de Poké Balls', icon: '⚪', x: -140, y: -68, spr: { h: '#fde68a', b: '#ef4444', d: '#991b1b' }, fala: 'Poké Balls fresquinhas! E cintos para levar mais companheiros.' },
  { id: 'loja', nome: 'Mercador Bento', icon: '🛒', x: 140, y: -68, spr: { h: '#3f2a14', b: '#a16207', d: '#713f12' }, fala: 'Tenho de tudo, se você tiver ouro!' },
  { id: 'ferreiro', nome: 'Ferreira Duna', icon: '🔨', x: -140, y: 136, spr: { h: '#ea580c', b: '#57534e', d: '#292524' }, fala: 'Traga ouro e eu deixo seu equipamento mais forte.' },
  { id: 'guilda', nome: 'Mestre da Guilda', icon: '📜', x: 140, y: 140, spr: { h: '#e5e7eb', b: '#1d4ed8', d: '#1e3a8a' }, fala: 'O reino precisa de heróis. Escolha um contrato.' },
  { id: 'sildo', nome: 'Sildo Invernal', icon: '🛡️', x: 0, y: -205, spr: { h: '#94a3b8', b: '#475569', d: '#1e293b' }, fala: '' },
  { id: 'dex', nome: 'Pesquisadora Íris', icon: '📖', x: 60, y: 205, spr: { h: '#7c2d12', b: '#f8fafc', d: '#0f766e' }, fala: '' },
  { id: 'gundo', nome: 'Gundo Buscapedra', icon: '⛏️', x: -60, y: 205, spr: { h: '#b45309', b: '#7c2d12', d: '#451a03' }, fala: '', show: P => storyOver(P) },
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
  for (const n of NPCS) if (['cura', 'loja', 'ferreiro', 'guilda', 'sildo', 'dex'].includes(n.id))
    NPCS2.push({ ...n, x: n.x + t.x, y: n.y + t.y, town: 1, nome: n.id === 'sildo' ? `Assistente ${REGION.guia.nome.split(' ').pop()}` : n.nome, show: null });
}
const allNPCs = () => NPCS.concat(NPCS2);
function nearNPC(P) {
  if (inDungeonArea(P.x) || !inTown(P.x, P.y)) return null;
  return allNPCs().find(n => (!n.show || n.show(P)) && Math.hypot(n.x - P.x, n.y - P.y) < 60) || null;
}
function drawNPC(n, ox, oy) {
  if (n.show && !(G.P && n.show(G.P))) return;
  const x = n.x + ox, y = n.y + oy + Math.sin(G.time * 2 + n.x) * 1;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 17, 12, 4, 0, 0, 7); ctx.fill();
  ctx.drawImage(NPC_SPR[n.id], x - 18, y - 18, 36, 36);
  ctx.font = 'bold 11px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fef3c7';
  outlined(`${n.icon} ${n.nome}`, x, y - 26);
  const P = G.P;
  if (n.id === 'guilda' && P && (!P.quest || P.quest.done)) {
    ctx.font = 'bold 20px Barlow Semi Condensed, system-ui'; ctx.fillStyle = P.quest && P.quest.done ? '#4ade80' : '#facc15';
    outlined(P.quest && P.quest.done ? '?' : '!', x, y - 40 + Math.sin(G.time * 5) * 3);
  }
  if (n.id === 'sildo' && P && P.story && !storyOver(P) && ((n.town === 1 && needT2(P)) || (!needT2(P) && (n.town || 0) === storyHub(P) && (P.story.ch === 0 || P.story.done)))) {
    ctx.font = 'bold 22px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fde047';
    outlined('!', x, y - 40 + Math.sin(G.time * 5) * 3);
  }
}

/* ---------- Diálogo ---------- */
function openNPC(id) { G.npcOpen = id; G.npcRef = G.nearNPC && G.nearNPC.id === id ? G.nearNPC : NPCS.find(n => n.id === id); $('npc').classList.remove('hidden'); renderNPC(); sfx('open'); }
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
    { id: 'arma', nome: CLASSES[P.cls].weapons[tier], icon: CLASSES[P.cls].wicon, preco: 60 + tier * 45, tier },
    { id: 'armadura', nome: ARMORS[tier], icon: '🛡️', preco: 50 + tier * 40, tier },
    { id: 'anel', nome: 'Anel aleatório', icon: '💍', preco: 70 + tier * 30, tier },
    { id: 'amuleto', nome: 'Amuleto aleatório', icon: '📿', preco: 90 + tier * 40, tier },
  ];
}
const sellPrice = it => 8 + it.tier * 12 + (it.upg || 0) * 10;
const upgMax = (P, town = npcTown()) => (town === 1 || !TOWNS[1] ? (storyOver(P) ? 8 : 6) : 4);
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
    const inv = P.inv.map((it, i) => it ? `<button class="sell" data-act="sell:${i}" title="${esc(it.name)}">${itemIcon(it)} ${esc(it.name)} → ${sellPrice(it)} 🪙</button>` : '').join('');
    body += `<h4>Vender</h4>${inv || '<div class="small">Mochila vazia.</div>'}`;
  } else if (n.id === 'dex') {
    body += renderDexNPC(P);
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
    const q = P.quest;
    if (q) {
      body += `<div class="quest cur"><b>${q.desc}</b><div class="qbar"><div style="width:${Math.min(100, q.have / q.need * 100)}%"></div></div>
        <div class="small">${q.have}/${q.need} · Recompensa: ${q.xp} XP, ${q.gold} 🪙${q.bonus ? ', ' + BONUS_NAMES[q.bonus] : ''}</div></div>
        ${q.done ? '<button data-act="claim" class="good">🎁 Receber recompensa</button>' : '<button data-act="abandon">Abandonar contrato</button>'}`;
    } else {
      // as ofertas acompanham o jogador: refeitas quando ele muda de faixa de nível, ganha acesso a outra zona ou troca de região
      if (!P.questOffer || P.questOffer.some(o => o.zt !== questZone(P) || o.reg !== REGION_ID)) P.questOffer = genQuests(P);
      body += P.questOffer.map((o, i) => `<div class="quest"><b>${o.desc}</b><div class="small">Recompensa: ${o.xp} XP, ${o.gold} 🪙${o.bonus ? ', ' + BONUS_NAMES[o.bonus] : ''}</div>
        <button data-act="accept:${i}">Aceitar</button></div>`).join('');
    }
  }
  $('npc').innerHTML = `<div class="npc-head"><span>${n.icon} <b>${n.nome}</b></span><span>🪙 ${P.gold}</span><button data-act="close" title="Fechar (Esc)">✕</button></div>${body}`;
  padFixDom($('npc'));
}

$('npc').addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]');
  if (!b || !G || !G.P) return;
  const P = G.P, [act, arg] = b.dataset.act.split(':');
  if (act === 'close') return closeNPC();
  if (act === 'heal') { P.hp = maxHP(P); burst(P.x, P.y, '#f9a8d4', 20); sfx('pot'); }
  else if (act === 'gift') { P.pots.hp = Math.max(P.pots.hp, 2); P.giftT = 300; sfx('pick'); }
  else if (act === 'buy') buyItem(P, arg);
  else if (act === 'sell') {
    const it = P.inv[+arg];
    if (it) { P.gold += sellPrice(it); P.inv[+arg] = null; sfx('pick'); }
  } else if (act === 'upg') {
    const it = P.equip[arg], c = upgCost(it);
    if (P.gold >= c && (it.upg || 0) < upgMax(P)) {
      P.gold -= c; it.upg = (it.upg || 0) + 1;
      if (it.slot === 'arma') it.bonus++; else it.ac++;
      G.toasts.push({ text: `🔨 ${it.name} agora é +${it.upg}!`, color: '#fdba74', t: 2.5 });
      sfx('lvl');
    }
  } else if (act === 'accept') { P.quest = P.questOffer[+arg]; P.questOffer = null; P.recentQ = [P.quest.k, ...(P.recentQ || [])].slice(0, 3); sfx('pick'); }
  else if (act === 'abandon') { P.quest = null; }
  else if (act === 'claim') claimQuest(P);
  else if (act === 'story') storyAct(P, arg);
  else if (act === 'dex') dexClaim(P, +arg);
  else if (act === 'dexopen') { closeNPC(); toggleDex(); }
  else if (act === 'fly') { flyTo(P, arg); return; }
  else if (act === 'reforge') {
    const it = P.equip[arg], c = 40 + it.tier * 40;
    if (storyOver(P) && P.gold >= c) {
      P.gold -= c;
      const upg = it.upg || 0;
      Object.assign(it, genItem(it.tier, arg));
      if (upg) { it.upg = upg; if (it.slot === 'arma') it.bonus += upg; else it.ac += upg; }
      G.toasts.push({ text: `✨ Reencantado: ${it.name}`, color: '#c4b5fd', t: 3 });
      sfx('lvl');
    }
  }
  G.dirty = true;
  saveGame();
  renderNPC();
});

function buyItem(P, id) {
  const s = shopList(P).concat(ballShop(P)).find(x => x.id === id);
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
  else if (CONS[id]) P.bag[id]++;
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
  pegar: [['Pesquisadora Sofia', 'preciso de um exemplar para a minha pesquisa'], ['Menino Pedrinho', 'sempre sonhei em ter um'], ['Criador Otto', 'falta essa espécie no meu rancho'], ['Colecionador Ivo', 'é a peça que falta na minha coleção']],
};
const MATERIAL = { flying: 'Penas', fire: 'Cinzas', water: 'Escamas', grass: 'Folhas', bug: 'Seda', poison: 'Glândulas de veneno', electric: 'Faíscas engarrafadas',
  ground: 'Torrões', rock: 'Pedrinhas raras', ghost: 'Ectoplasma', psychic: 'Cristais mentais', fighting: 'Faixas', normal: 'Pelos', ice: 'Gelo eterno',
  dragon: 'Escamas de dragão', dark: 'Garras sombrias', steel: 'Parafusos', fairy: 'Pó de fada' };
// zona dos contratos: a do nível do jogador, mas só até onde ele já consegue chegar (HMs e insígnias)
const questZone = P => { let z = lvlZone(P.lvl); while (z > 1 && needFor(P, z).length) z--; return z; };
function genQuests(P) {
  const z = questZone(P);
  const recent = P.recentQ || [];
  const unknown = LANDMARKS.filter(l => !P.fly.includes(l.id) && zoneAt(l.x, l.y) <= z + 1);
  let kinds = ['tipo', 'zona', 'alfa', 'masmorra', 'captura', 'evento', 'caca', 'caca', 'coleta', 'coleta', 'especie', 'especie', 'pegar', 'pegar', 'pegaralfa', 'pesquisa', 'pesquisa', 'noturno', ...(z >= 2 ? ['bolaboa'] : []), ...(unknown.length ? ['explorar'] : [])];
  const fresh = kinds.filter(k => !recent.includes(k));
  if (fresh.length >= 3) kinds = fresh;
  const picked = [];
  for (const k of kinds.sort(() => Math.random() - 0.5)) if (!picked.includes(k) && picked.length < 3) picked.push(k);
  return picked.map((k, idx) => {
    const T = QTIERS[idx], q = { k, have: 0, done: false, tier: idx, zt: z, zone: z, reg: REGION_ID };
    const need = base => Math.max(1, Math.round(base * T.m));
    const pool = ZONE_POOLS[z].filter(id => POKE[id]);
    let [who, why] = pick(QPEOPLE[k]);
    let diff = 1;
    if (k === 'tipo') {
      const p = POKE[pick(pool)]; q.type = p ? mainType(p) : 'normal'; q.need = need(10 + z * 3);
      q.desc = `Derrote ${q.need} Pokémon do tipo ${TYPE_PT[q.type]}`;
    } else if (k === 'zona') {
      q.need = need(18 + z * 5);
      q.desc = `Derrote ${q.need} Pokémon em ${ZONES[z].nome}`;
    } else if (k === 'alfa') {
      q.need = need(1 + Math.floor(z / 2)); diff = 2;
      q.desc = `Derrote ${q.need} Pokémon Alfa`;
    } else if (k === 'masmorra') {
      q.need = need(idx ? 1.3 : 1); diff = 3;
      q.desc = q.need > 1 ? `Conclua ${q.need} masmorras (derrote os chefes)` : 'Conclua uma masmorra (derrote o chefe)';
    } else if (k === 'captura') {
      const p = POKE[pick(pool)]; q.type = p ? mainType(p) : 'normal'; q.need = need(1 + Math.floor(z / 3)); diff = 1.6;
      q.desc = `Capture ${q.need} Pokémon do tipo ${TYPE_PT[q.type]} (zona ${z} ou acima)`;
    } else if (k === 'evento') {
      q.need = need(idx === 2 ? 1.3 : 1); diff = 2;
      q.desc = q.need > 1 ? `Complete ${q.need} eventos do mundo` : 'Complete um evento do mundo';
    } else if (k === 'caca') {
      q.pid = pick(pool); q.need = 1; diff = 2.4;
      let pt = randomZonePoint(z);
      for (let t = 0; t < 10 && Math.hypot(pt[0], pt[1]) < 900; t++) pt = randomZonePoint(z);
      q.x = Math.round(pt[0]); q.y = Math.round(pt[1]);
      q.desc = `Caçada: derrote ${POKE[q.pid] ? POKE[q.pid].name : 'o Pokémon'} Procurado (🎯 no mapa)`;
    } else if (k === 'especie') {
      q.pid = pick(pool); q.need = need(6 + z * 2); diff = 1.2;
      if (POKE[q.pid] && POKE[q.pid].types.includes('water')) [who, why] = ['Pescadora Marina', 'espantaram todos os peixes'];
      q.desc = `Derrote ${q.need} ${POKE[q.pid] ? POKE[q.pid].name : 'Pokémon'}`;
    } else if (k === 'pegar') {
      q.pid = pick(pool); q.need = idx === 2 ? 2 : 1; diff = 1.8;
      q.desc = `Capture ${q.need > 1 ? q.need + ' ' : 'um '}${POKE[q.pid] ? POKE[q.pid].name : 'Pokémon'} (aparece em ${ZONES[z].nome})`;
    } else if (k === 'pegaralfa') {
      q.need = 1; diff = 2.6;
      q.desc = 'Capture um Pokémon Alfa (enfraqueça bem: eles resistem mais)';
    } else if (k === 'pesquisa') {
      q.need = need(3 + Math.floor(z / 2)); q.seen = []; diff = 1.7;
      q.desc = `Pesquisa de campo: capture ${q.need} espécies diferentes em ${ZONES[z].nome}`;
    } else if (k === 'noturno') {
      q.need = need(2); diff = 1.8;
      q.desc = `Capture ${q.need} Pokémon durante a noite (zona ${z} ou acima)`;
    } else if (k === 'bolaboa') {
      q.need = need(2); diff = 1.6;
      q.desc = `Capture ${q.need} Pokémon usando Great Ball ou Ultra Ball (zona ${z} ou acima)`;
    } else if (k === 'coleta') {
      const p = POKE[pick(pool)]; q.type = p ? mainType(p) : 'normal'; q.need = need(5 + z * 2); diff = 1.4;
      q.desc = `Colete ${q.need} ${MATERIAL[q.type]} de Pokémon do tipo ${TYPE_PT[q.type]}`;
    } else {
      // quanto mais difícil, mais longe da vila
      const byDist = [...unknown].sort((p, o) => Math.hypot(p.x, p.y) - Math.hypot(o.x, o.y));
      const l = byDist[Math.min(byDist.length - 1, Math.floor(idx * byDist.length / 3))]; q.lm = l.id; q.need = 1; q.x = l.x; q.y = l.y; diff = 1.5;
      q.desc = `Descubra o ponto de voo "${l.nome}" (🎯 no mapa)`;
    }
    q.desc = `<span class="qtier t${idx}">${T.n}</span> ${q.desc}<div class="small"><i>${who}: "${why}."</i></div>`;
    q.xp = Math.round(xpNeed(P.lvl) * (0.1 + 0.06 * diff) * T.r);
    q.gold = Math.round((30 + z * 25) * diff * T.r);
    q.bonus = idx === 2 ? (Math.random() < 0.5 ? 'statpot' : 'item') : idx === 1 ? pick(['stone', 'item', 'ball']) : pick(['ball', 'stone', null]);
    return q;
  });
}

function questProgress(k, info = {}) {
  const P = G && G.P, q = P && P.quest;
  if (!q || q.done || q.k !== k) return;
  if ((k === 'tipo' || k === 'coleta') && !(info.types || []).includes(q.type)) return;
  if (k === 'captura' && (!(info.types || []).includes(q.type) || (info.zone || 0) < q.zone)) return;
  if (k === 'zona' && info.zone !== q.zone) return;
  if ((k === 'caca' || k === 'especie' || k === 'pegar') && info.pid !== q.pid) return;
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
    G.toasts.push({ text: '📜 Contrato cumprido! Volte a um Mestre da Guilda.', color: '#4ade80', t: 4 });
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
  e.maxHp = Math.round(e.maxHp * BOUNTY_HP[tier] || 2.5); e.hp = e.maxHp;
  e.scale *= 1.3; e.w *= 1.3; e.h *= 1.3; e.r *= 1.3;
  e.cdBoss = 1.6 - tier * 0.2;
}
function questTick(dt) {
  const P = G.P, q = P && P.quest;
  G.qT = (G.qT || 0) - dt;
  if (!q || q.done || q.k !== 'caca' || G.qT > 0) return;
  G.qT = 1;
  if (Math.hypot(P.x - q.x, P.y - q.y) > 700) return;
  const m = { pid: q.pid, zone: q.zone, x: q.x, y: q.y, tier: q.tier };
  if (isHost()) hostBounty(m); else if (NET.host && NET.host.open) NET.host.send({ t: 'bounty', ...m });
}
function hostBounty(m) {
  const key = m.pid + ':' + m.x + ':' + m.y;
  if (!POKE[m.pid] || (G.bountyCd[key] || 0) > G.time) return;
  if (G.enemies.some(e => e.bountyT !== undefined && e.pid === m.pid && Math.hypot(e.x - m.x, e.y - m.y) < 1200)) return;
  const b = hostSpawn(m.pid, m.zone, 1, m.x, m.y);
  bountyMod(b, m.tier || 0);
  b.bkey = key;
  for (let i = 0; i < 2 + (m.tier || 0); i++) hostSpawn(pick(ZONE_POOLS[m.zone]), m.zone, 0, m.x + rand(-120, 120), m.y + rand(-120, 120));
  emitEvent({ t: 'toast', text: `🎯 ${b.name} apareceu!`, color: '#fca5a5', big: 1 });
}
function questTarget(P) {
  const q = P && P.quest;
  return q && !q.done && (q.k === 'caca' || q.k === 'explorar') ? q : null;
}

function claimQuest(P) {
  const q = P.quest;
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
  P.quest = null;
  P.questOffer = genQuests(P);
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
    announce('🌙 A noite caiu: Pokémon Fantasma e Sombrio surgem, e todo XP vale +50%.', '#a78bfa');
  }
}

function updateEvent(ev, dt) {
  if (ev.ids) {
    const alive = ev.ids.map(id => G.emap.get(id)).filter(Boolean);
    ev.left = alive.length;
    if (alive.length) { ev.x = alive.reduce((s, e) => s + e.x, 0) / alive.length; ev.y = alive.reduce((s, e) => s + e.y, 0) / alive.length; }
    if (ev.kind !== 'raro' && !alive.length) return eventDone(ev);
  }
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
    if (G.npcOpen && G.npcOpen !== 'fly') {
      const n = G.npcRef || NPCS.find(x => x.id === G.npcOpen);
      if (!n || Math.hypot(n.x - P.x, n.y - P.y) > 110) closeNPC();
    }
  } else if (G.npcOpen) closeNPC();
  updateMeteors(dt);
}

/* ============ Clima por zona ============
 * Cada zona sorteia um clima conforme o bioma (o host decide e manda no snapshot).
 * Dura 4-6 min e às vezes não há clima. À noite o clima some (a noite já é o "clima" dela).
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
  G.wxT = G.wxT || [0, rand(5, 60), rand(5, 60), rand(5, 60), rand(5, 60), rand(5, 60)];
  for (let z = 1; z <= 5; z++) {
    if ((G.wxT[z] -= dt) > 0) continue;
    G.wxT[z] = rand(240, 360);
    const opts = ZONES[z] && WEATHER_BY_BIO[ZONES[z].bio] || [];
    G.wx[z] = !opts.length || Math.random() < 0.4 ? '' : pick(opts);
  }
}
// local (todo jogador): avisa quando o clima onde você está muda, e aplica o desgaste da areia/neve
function weatherTick(dt) {
  // anoitecer e amanhecer graduais (~8s) em vez de mudar de uma vez
  G.nightK = clamp((G.nightK || 0) + (isNight() ? dt : -dt) / 8, 0, 1);
  const P = G.P;
  if (!P) return;
  const w = weatherAt(P.x, P.y), k = w ? w.k : '';
  if (k !== G.wxSeen) {
    if (w) G.toasts.push({ text: `${w.icon} ${w.nome} em ${areaName(P.x, P.y)}: ${w.fx}`, color: w.color, t: 5, big: 1 });
    else if (G.wxSeen && !isNight()) G.toasts.push({ text: '🌤 O tempo abriu.', color: '#e5e7eb', t: 2.5 });
    G.wxSeen = k;
  }
  if (w && w.chip && !P.pvp && !w.chip.includes(pType(P)) && (G.wxChipT = (G.wxChipT || 2) - dt) <= 0) {
    G.wxChipT = 2;
    const dmg = Math.max(0, Math.min(P.hp - 1, Math.round(maxHP(P) * 0.015))); // incomoda, mas não mata
    if (dmg > 0) { P.hp -= dmg; text(P.x, P.y - 34, `-${dmg} ${w.icon}`, w.color, 12); }
  }
}
// camada de clima por cima do mundo
function drawWeather() {
  const P = G.P, w = P && weatherAt(G.cam.x, G.cam.y);
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
  for (let z = 1; z <= 5; z++) { for (const id of ZONE_POOLS[z] || []) add(id, `Zona ${z}`); for (const id of WATER_POOLS[z] || []) add(id, `Água · zona ${z}`); }
  for (const id of NIGHT_POOL) add(id, 'à noite');
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
  const cells = DEX_IDS.map(pid => {
    const c = d.c.includes(pid), s = c || d.s.includes(pid);
    return `<div class="dexc ${c ? 'got' : s ? 'seen' : 'unk'}" title="${s ? `${esc(dexName(pid))} — ${DEX_WHERE[pid]}` : '??? — ainda não encontrado'}">
      <img src="${dexIcon(pid)}" alt="" loading="lazy">${c ? '<i>●</i>' : ''}<span>${s ? esc(dexName(pid)) : '???'}</span></div>`;
  }).join('');
  box.innerHTML = `<h3>📖 Pokédex de ${REGION.nome} <span class="small">[P] fecha</span></h3>
    <div class="small">${d.s.length} vistos · <b>${d.c.length}/${DEX_IDS.length}</b> capturados (${Math.floor(d.c.length / DEX_IDS.length * 100)}%) · passe o mouse para ver onde cada um aparece. Lendários contam ao serem derrotados.</div>
    <div class="dexgrid">${cells}</div>`;
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
