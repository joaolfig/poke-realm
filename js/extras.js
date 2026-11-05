'use strict';
/* ============ Mecânicas de cada região: fósseis, Megaevolução e Dynamax ============
 * Fósseis (Kanto, Hoenn, Sinnoh, Unova, Kalos e Galar): o Cientista de Fósseis da 2ª cidade dá uma missão e o jogador
 * escolhe um fóssil da região; outros fósseis caem (raramente) de Pokémon de Pedra e Terra e ele os revive por ouro.
 * Megaevolução (Kanto, Hoenn e Kalos) e Dynamax (Galar): fim de jogo, depois dos 8 ginásios da região.
 * [U] (segurar LB no controle, ⋯ no celular) ativa no companheiro líder; os outros jogadores veem pela rede.
 */
const FOSSILS = {
  helix: { nome: 'Fóssil Hélice', pid: 138, reg: 'kanto' }, dome: { nome: 'Fóssil Domo', pid: 140, reg: 'kanto' }, amber: { nome: 'Âmbar Antigo', pid: 142, reg: 'kanto' },
  root: { nome: 'Fóssil Raiz', pid: 345, reg: 'hoenn' }, claw: { nome: 'Fóssil Garra', pid: 347, reg: 'hoenn' },
  skull: { nome: 'Fóssil Crânio', pid: 408, reg: 'sinnoh' }, armor: { nome: 'Fóssil Armadura', pid: 410, reg: 'sinnoh' },
  cover: { nome: 'Fóssil Casco', pid: 564, reg: 'unova' }, plume: { nome: 'Fóssil Pluma', pid: 566, reg: 'unova' },
  jaw: { nome: 'Fóssil Mandíbula', pid: 696, reg: 'kalos' }, sail: { nome: 'Fóssil Vela', pid: 698, reg: 'kalos' },
  birddrake: { nome: 'Fóssil Ave e Dragão', pid: 880, reg: 'galar' }, birddino: { nome: 'Fóssil Ave e Dino', pid: 881, reg: 'galar' },
  fishdrake: { nome: 'Fóssil Peixe e Dragão', pid: 882, reg: 'galar' }, fishdino: { nome: 'Fóssil Peixe e Dino', pid: 883, reg: 'galar' },
};
const regionFossils = () => Object.keys(FOSSILS).filter(k => FOSSILS[k].reg === REGION_ID);
const FOSSIL_KILLS = 15, FOSSIL_COST = 500;
// espécie -> forma Mega na PokeAPI (Charizard e Mewtwo usam a X)
const MEGA = { 3: 10033, 6: 10034, 9: 10036, 15: 10090, 18: 10073, 65: 10037, 80: 10071, 94: 10038, 115: 10039, 127: 10040, 130: 10041, 142: 10042, 150: 10043, 181: 10045,
  208: 10072, 212: 10046, 214: 10047, 229: 10048, 248: 10049, 254: 10065, 257: 10050, 260: 10064, 282: 10051, 302: 10066, 303: 10052, 306: 10053, 308: 10054, 310: 10055,
  319: 10070, 323: 10087, 334: 10067, 354: 10056, 359: 10057, 362: 10074, 373: 10089, 376: 10076, 380: 10062, 381: 10063, 384: 10079, 428: 10088, 445: 10058, 448: 10059,
  460: 10060, 475: 10068, 531: 10069, 719: 10075 };
const MEGA_REGIONS = ['kanto', 'hoenn', 'kalos'], DYNA_REGIONS = ['galar'];
const MEGA_T = 25, MEGA_CD = 90, MEGA_K = 1.6, DYNA_T = 18, DYNA_CD = 120, DYNA_K = 1.4;
// terminou os 8 ginásios desta região
const gyms8 = P => !!(P && P.story && (P.story.ch > 8 || (P.story.ch === 8 && P.story.done)));
const leaderAlly = P => G.allies.find(a => a.pet && a.slot === P.petIdx);
const boostMul = P => (P.megaT > 0 ? MEGA_K : 1) * (P.dynaT > 0 ? DYNA_K : 1);
// tamanho do companheiro na tela: o líder cresce na Mega e fica gigante no Dynamax
const allyScale = a => { const P = G.P; return a.pet && P && a.slot === P.petIdx ? (P.dynaT > 0 ? 2.3 : P.megaT > 0 ? 1.2 : 1) : 1; };

/* ---------- Pokémon novo na equipe (ou no PC) ---------- */
async function giveMon(P, pid, why) {
  await loadPokedex([pid]);
  const p = POKE[pid]; if (!p) return;
  const mon = { pid, name: p.name, type: mainType(p), lvl: clamp(P.lvl - 2, 5, 28), xp: 0 };
  dexCatch(P, pid);
  if (P.pets.length >= petCap(P)) { P.box = P.box || []; P.box.push(mon); G.toasts.push({ text: `🦴 ${p.name} ${why} e foi para o PC (equipe cheia).`, color: '#fde68a', t: 5, big: 1 }); }
  else { P.pets.push(mon); if (P.petAct.length < petSlots(P)) { P.petAct.push(P.pets.length - 1); P.petIdx = P.petAct[0]; } G.toasts.push({ text: `🦴 ${p.name} ${why}! Ele entrou para a sua equipe.`, color: '#fde68a', t: 5, big: 1 }); }
  sfx('lvl'); G.dirty = true; saveGame();
}

/* ---------- Cientista de Fósseis (2ª cidade) ---------- */
function renderFossil(P) {
  const F = regionFossils(), st = (P.fossilQ || {})[REGION_ID] || 0, n = (P.fossilN || {})[REGION_ID] || 0;
  let h = `<p class="fala">"Eu estudo Pokémon de milhões de anos atrás. Com um fóssil e um pouco de ouro, eu trago o Pokémon de volta à vida."</p>`;
  if (st === 0) h += `<div class="quest"><b>🦴 Missão: Escavação</b><div class="small">As escavações de ${REGION.nome} estão cheias de Pokémon de Pedra e Terra. Derrote ${FOSSIL_KILLS} deles e eu te dou um fóssil para escolher.</div><button data-act="fossil:aceitar" class="good">Aceitar</button></div>`;
  else if (st === 1 && n < FOSSIL_KILLS) h += `<div class="quest cur"><b>🦴 Escavação</b><div class="small">Derrote Pokémon de Pedra ou Terra: ${n}/${FOSSIL_KILLS}</div></div>`;
  else if (st === 1) h += `<div class="quest cur"><b>🦴 Escavação concluída!</b><div class="small">Escolha um fóssil. Eu trago o Pokémon de volta na hora.</div>`
    + F.map(k => `<button data-act="fossil:escolher:${k}" class="good">${FOSSILS[k].nome} → ${POKE[FOSSILS[k].pid] ? POKE[FOSSILS[k].pid].name : '?'}</button>`).join(' ') + '</div>';
  else h += `<div class="small">Os outros fósseis de ${REGION.nome} (${F.map(k => FOSSILS[k].nome).join(', ')}) aparecem, raramente, ao derrotar Pokémon de Pedra ou Terra por aqui.</div>`;
  const mine = Object.keys(P.fossils || {}).filter(k => P.fossils[k] > 0 && FOSSILS[k]);
  if (mine.length) h += '<h4>Reviver fósseis</h4>' + mine.map(k => `<div class="shoprow"><span>🦴 ${FOSSILS[k].nome} ×${P.fossils[k]}</span><button data-act="fossil:reviver:${k}" ${P.gold < FOSSIL_COST ? 'disabled' : ''}>Reviver ${FOSSIL_COST} 🪙</button></div>`).join('');
  return h;
}
function fossilAct(P, a, k) {
  P.fossilQ = P.fossilQ || {}; P.fossilN = P.fossilN || {}; P.fossils = P.fossils || {};
  if (a === 'aceitar' && !P.fossilQ[REGION_ID]) { P.fossilQ[REGION_ID] = 1; P.fossilN[REGION_ID] = 0; G.toasts.push({ text: `🦴 Missão: derrote ${FOSSIL_KILLS} Pokémon de Pedra ou Terra.`, color: '#fde68a', t: 4 }); }
  else if (a === 'escolher' && P.fossilQ[REGION_ID] === 1 && (P.fossilN[REGION_ID] || 0) >= FOSSIL_KILLS && FOSSILS[k] && FOSSILS[k].reg === REGION_ID) { P.fossilQ[REGION_ID] = 2; giveMon(P, FOSSILS[k].pid, `voltou à vida do ${FOSSILS[k].nome}`); }
  else if (a === 'reviver' && FOSSILS[k] && P.fossils[k] > 0 && P.gold >= FOSSIL_COST) { P.fossils[k]--; P.gold -= FOSSIL_COST; giveMon(P, FOSSILS[k].pid, `voltou à vida do ${FOSSILS[k].nome}`); }
  G.dirty = true;
}

/* ---------- abates: missão dos fósseis, fósseis raros e Megapedras ---------- */
function extrasKill(P, m) {
  const p = POKE[m.pid], rocky = p && p.types.some(t => t === 'rock' || t === 'ground');
  P.fossilQ = P.fossilQ || {}; P.fossilN = P.fossilN || {}; P.fossils = P.fossils || {};
  if (rocky && P.fossilQ[REGION_ID] === 1 && (P.fossilN[REGION_ID] || 0) < FOSSIL_KILLS) {
    const n = P.fossilN[REGION_ID] = (P.fossilN[REGION_ID] || 0) + 1;
    text(m.x, m.y - 30, `🦴 Escavação ${n}/${FOSSIL_KILLS}`, '#fde68a', 12);
    if (n === FOSSIL_KILLS) G.toasts.push({ text: `🦴 Escavação concluída! Volte ao Cientista de Fósseis em ${townName(TOWNS[1] || TOWNS[0])} para escolher seu fóssil.`, color: '#fde68a', t: 6, big: 1 });
  }
  const F = regionFossils();
  if (rocky && F.length && Math.random() < (m.kind === 1 ? 0.03 : m.kind >= 2 ? 0.06 : 0.004)) {
    const k = pick(F); P.fossils[k] = (P.fossils[k] || 0) + 1;
    G.toasts.push({ text: `🦴 Você achou um ${FOSSILS[k].nome}! O Cientista de Fósseis de ${townName(TOWNS[1] || TOWNS[0])} pode revivê-lo.`, color: '#fde68a', t: 6, big: 1 });
  }
  // Megapedras: só nas regiões com Megaevolução, depois da Pedra-Chave
  if (P.megaKey && MEGA_REGIONS.includes(REGION_ID) && MEGA[m.pid] && !(P.megaStones || []).includes(m.pid) && Math.random() < (m.kind === 1 ? 0.12 : m.kind >= 2 ? 0.3 : 0.01)) {
    P.megaStones = [...(P.megaStones || []), m.pid];
    G.toasts.push({ text: `💎 Você achou a Megapedra de ${p ? p.name : '?'}! Com ele como líder, [U] megaevolui.`, color: '#c4b5fd', t: 6, big: 1 });
  }
}
// Mercador: vende a Megapedra do seu líder (só nas regiões com Megaevolução, depois da Pedra-Chave)
function megaShop(P) {
  const pt = activePet(P);
  if (!P.megaKey || !MEGA_REGIONS.includes(REGION_ID) || !pt || !MEGA[pt.pid] || (P.megaStones || []).includes(pt.pid)) return [];
  return [{ id: 'mega', nome: `Megapedra de ${pt.name} <i>para o seu líder</i>`, icon: '💎', preco: 3000 }];
}
function buyMega(P) { const pt = activePet(P); if (pt && MEGA[pt.pid]) { P.megaStones = [...(P.megaStones || []), pt.pid]; G.toasts.push({ text: `💎 Megapedra de ${pt.name}! [U] megaevolui.`, color: '#c4b5fd', t: 4 }); } }

/* ---------- Megaevolução e Dynamax ---------- */
function useBoost(P) {
  const pt = activePet(P), a = leaderAlly(P);
  if (!P.megaKey && !P.dynaBand) { G.toasts.push({ text: 'Megaevolução e Dynamax chegam no fim da jornada: a Pedra-Chave em Kanto, Hoenn ou Kalos e o Bracelete Dynamax em Galar, depois dos 8 ginásios.', color: '#cbd5e1', t: 4 }); return; }
  if (!pt || !a) { G.toasts.push({ text: 'Chame um companheiro para fora da Poké Ball primeiro.', color: '#fca5a5', t: 2.5 }); return; }
  if (P.megaT > 0 || P.dynaT > 0) return;
  if ((P.boostCd || 0) > 0) { text(P.x, P.y - 40, `Pronto em ${Math.ceil(P.boostCd)}s`, '#cbd5e1', 12); return; }
  const mega = P.megaKey && MEGA[pt.pid] && (P.megaStones || []).includes(pt.pid);
  if (mega) {
    P.megaT = MEGA_T; P.boostCd = MEGA_CD; ensurePoke(MEGA[pt.pid]);
    emitEvent({ t: 'fx', x: Math.round(a.x), y: Math.round(a.y), r: 120, color: '#c4b5fd' });
    G.toasts.push({ text: `💎 ${pt.name} megaevoluiu! (+60% de dano por ${MEGA_T}s)`, color: '#c4b5fd', t: 3, big: 1 });
  } else if (P.dynaBand) {
    P.dynaT = DYNA_T; P.boostCd = DYNA_CD;
    emitEvent({ t: 'fx', x: Math.round(a.x), y: Math.round(a.y), r: 160, color: '#ef4444' });
    G.toasts.push({ text: `🔴 ${pt.name} virou Dynamax! Gigante, com golpes em área por ${DYNA_T}s.`, color: '#fca5a5', t: 3, big: 1 });
  } else { G.toasts.push({ text: P.megaKey ? `${pt.name} não tem Megapedra. Elas caem de Alfas e chefes que megaevoluem, ou o Mercador vende a do seu líder.` : 'Só com o Bracelete Dynamax.', color: '#fca5a5', t: 3.5 }); return; }
  sfx('lvl'); G.dirty = true;
}
// a cada quadro: prêmios do fim de jogo, tempos e o visual da Mega
function extrasTick(P, dt) {
  if (!P) return;
  if (gyms8(P) && MEGA_REGIONS.includes(REGION_ID) && !P.megaKey) { P.megaKey = 1; G.toasts.push({ text: `💎 Os 8 ginásios de ${REGION.nome}! Você recebeu a Pedra-Chave: com a Megapedra do líder, [U] megaevolui o companheiro. Megapedras caem de Alfas e chefes que megaevoluem.`, color: '#c4b5fd', t: 8, big: 1 }); saveGame(); }
  if (gyms8(P) && DYNA_REGIONS.includes(REGION_ID) && !P.dynaBand) { P.dynaBand = 1; G.toasts.push({ text: '🔴 Os 8 estádios de Galar! A Professora Magnolia te deu o Bracelete Dynamax: [U] deixa o companheiro gigante, com golpes em área.', color: '#fca5a5', t: 8, big: 1 }); saveGame(); }
  P.boostCd = Math.max(0, (P.boostCd || 0) - dt);
  if (P.megaT > 0 && (P.megaT -= dt) <= 0) { P.megaT = 0; G.toasts.push({ text: 'A Megaevolução acabou.', color: '#cbd5e1', t: 2 }); }
  if (P.dynaT > 0 && (P.dynaT -= dt) <= 0) { P.dynaT = 0; G.toasts.push({ text: 'O Dynamax acabou.', color: '#cbd5e1', t: 2 }); }
  const a = leaderAlly(P), pt = activePet(P);
  for (const x of G.allies) if (x.pet && x.megaLook && (x !== a || !(P.megaT > 0))) { x.look = null; x.megaLook = 0; }
  if (a && pt && P.megaT > 0 && MEGA[pt.pid]) { a.look = MEGA[pt.pid]; a.megaLook = 1; }
}
// Golpe Max do Dynamax: explosão em área no alvo
function dynaBlast(a, t, col) {
  burst(t.x, t.y, '#ef4444', 30); burst(t.x, t.y, col, 20);
  G.fx.push({ k: 'ring', x: t.x, y: t.y, r: 0, R: 120, life: 0.45, max: 0.45, color: '#ef4444', fill: true });
  for (const e of G.enemies) if (e.hp > 0 && !e.dead && Math.hypot(e.x - t.x, e.y - t.y) < 120 + (e.r || 12)) allyHit(e, a, 2);
  G.shake = Math.min(8, G.shake + 3);
}
// painel: estado e tecla
function boostLine(P) {
  if (!P.megaKey && !P.dynaBand) return '';
  const pt = activePet(P), can = pt && P.megaKey && MEGA[pt.pid] && (P.megaStones || []).includes(pt.pid) ? 'Megaevolução' : P.dynaBand ? 'Dynamax' : '';
  const st = P.megaT > 0 ? `ativa ${Math.ceil(P.megaT)}s` : P.dynaT > 0 ? `ativo ${Math.ceil(P.dynaT)}s` : P.boostCd > 0 ? `${Math.ceil(P.boostCd)}s` : can ? 'pronto' : 'sem Megapedra do líder';
  return `<div class="small" title="[U] (segurar LB no controle)">[U] ${can || 'Megaevolução'}: ${st}</div>`;
}
function extrasKeyItems(P) {
  const parts = [];
  if (P.megaKey) parts.push(`<span title="Com a Megapedra do líder, [U] megaevolui">💎 Pedra-Chave</span>`);
  if ((P.megaStones || []).length) parts.push(`<span title="Megapedras">💎 ${P.megaStones.map(id => POKE[id] ? POKE[id].name : '#' + id).join(', ')}</span>`);
  if (P.dynaBand) parts.push('<span title="[U] deixa o companheiro gigante">🔴 Bracelete Dynamax</span>');
  for (const k of Object.keys(P.fossils || {})) if (P.fossils[k] > 0 && FOSSILS[k]) parts.push(`<span title="Leve ao Cientista de Fósseis da 2ª cidade">🦴 ${FOSSILS[k].nome} ×${P.fossils[k]}</span>`);
  return parts.length ? `<div class="small keyit">${parts.join(' ')}</div>` : '';
}
