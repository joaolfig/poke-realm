'use strict';
/* ============ História (uma por região, preenchida por setRegion em regions.js) ============
 * Capítulo 0 = prólogo, 1-8 = ginásios, 9 = confronto final com a organização vilã.
 * Cada jogador tem o próprio progresso por região (P.stories[região] = { ch, done }).
 * As masmorras dos ginásios são criadas pelo host quando alguém chega perto do marcador.
 */
const STORY = [];
const STORY_IDS = [];
const storyPos = ch => cellPt(...STORY[ch].at);
const storyOver = P => P.story && P.story.ch >= STORY.length;
// no meio da história (antes do 5º ginásio) o jogador precisa ir à 2ª cidade; dali em diante a jornada segue de lá
const T2_CH = 5;
const needT2 = P => !!(TOWNS[1] && P.story && P.story.ch >= T2_CH && !P.story.t2 && !storyOver(P));
const storyHub = P => (TOWNS[1] && P.story && P.story.t2 ? 1 : 0);
const storyGuide = P => (storyHub(P) ? NPCS2.find(n => n.id === 'sildo') : NPCS.find(n => n.id === 'sildo'));
const hubName = P => townName(TOWNS[storyHub(P)]);
// etapas de captura dentro da história: o 1º companheiro (antes do 1º ginásio) e,
// no fim de jogo, uma captura com Great/Ultra Ball na zona 4 (antes do 7º ginásio)
const CAPU_CH = 7;
function storyStep(P) {
  const st = P && P.story;
  if (!st || st.done || storyOver(P)) return null;
  if (st.ch === 1 && !P.pets.length) return 'cap1';
  if (st.ch === CAPU_CH && !st.capU) return 'capU';
  return null;
}
// ponto de captura sugerido: o lugar da zona mais perto da cidade-base
function capPoint(P, z) {
  const t = TOWNS[storyHub(P)] || TOWNS[0];
  let b = null, bd = 1e18;
  for (const p of ZPTS[z]) { const d0 = (p[0] - t.x) ** 2 + (p[1] - t.y) ** 2; if (d0 > 500 * 500 && d0 < bd) { bd = d0; b = p; } }
  return b || randomZonePoint(z);
}
// chamado quando o jogador captura um Pokémon (k = bola usada)
function storyCapture(P, e, k) {
  const st = P.story;
  if (!st) return;
  if (st.ch === 1 && !st.done && P.pets.length === 1) {
    G.toasts.push({ text: `📖 Seu primeiro companheiro! ${e.p.name} vai lutar ao seu lado. Agora siga para o ${STORY[1].titulo}.`, color: '#fde047', t: 6, big: 1 });
  }
  if (st.ch === CAPU_CH && !st.capU && (k === 'grande' || k === 'ultra') && e.zone >= 4) {
    st.capU = true;
    G.toasts.push({ text: `📖 ${e.p.name} capturado com ${BALLS[k].nome}! A prova está feita: o caminho para o ${STORY[CAPU_CH].titulo} está livre.`, color: '#fde047', t: 7, big: 1 });
    sfx('lvl');
  }
}

// ajusta um inimigo da história (igual no host e nos clientes)
function storyMod(e, ch) {
  const s = STORY[ch];
  if (!s) return;
  e.story = ch;
  e.name = `${s.nome} (${e.p.name})`;
  if (e.kind === 1) {
    e.boss = true;
    e.maxHp = Math.round(e.maxHp * 2.2); e.hp = e.maxHp;
    e.scale *= 1.25; e.w *= 1.25; e.h *= 1.25; e.r *= 1.25;
    e.speed *= 0.8;
    e.cdBoss = ch === 1 ? 1.8 : 1.25;
  }
}

function storyTick(dt) {
  const P = G.P;
  if (!P || !P.story) return;
  G.storyT = (G.storyT || 0) - dt;
  if (G.storyT > 0) return;
  G.storyT = 1;
  const s = STORY[P.story.ch];
  if (!s || !s.at || P.story.done || needT2(P) || storyStep(P)) return;
  const [x, y] = storyPos(P.story.ch);
  if (Math.hypot(P.x - x, P.y - y) > 700) return;
  if (isHost()) hostStory(P.story.ch);
  else if (NET.host && NET.host.open) NET.host.send({ t: 'story', ch: P.story.ch });
}

function hostStory(ch) {
  const s = STORY[ch];
  if (!s || !s.at) return;
  const [x, y] = storyPos(ch);
  if (s.kind === 'boss') {
    if (G.enemies.some(e => e.story === ch) || (G.storyCd[ch] || 0) > G.time || !POKE[s.boss]) return;
    const b = hostSpawn(s.boss, s.zone, 1, x, y - 60);
    storyMod(b, ch);
    for (const id of s.adds) if (POKE[id]) hostSpawn(id, s.zone, 0, x + rand(-130, 130), y + rand(-160, 20));
    emitEvent({ t: 'toast', text: `⚔ ${b.name} apareceu!`, color: '#fca5a5', big: 1 });
  } else {
    const open = [...G.dungeons.values()].find(d => d.theme === s.theme && !d.done);
    if (open) {
      if (!G.portals.some(p => p.dg === open.id && !p.exit)) G.portals.push({ id: ++G.poNext, x: Math.round(x), y: Math.round(y), theme: s.theme, ttl: 600, dg: open.id, exit: 0 });
      return;
    }
    // o ginásio nunca é mais fácil que a zona onde fica
    createDungeon(x, y, null, Math.max(s.zone, zoneAt(x, y)), { theme: s.theme, ttl: 600, force: true, quiet: true });
  }
}

// chamado no onKill de cada jogador
function storyKill(m) {
  const P = G.P;
  if (!m.st || !P.story || P.story.ch !== m.st || P.story.done) return;
  P.story.done = true;
  G.toasts.push({ text: `📖 ${STORY[m.st].titulo} vencido! Volte para ${hubName(P)} e fale com ${storyGuide(P).nome}.`, color: '#fde047', t: 6, big: 1 });
  sfx('lvl');
  saveGame();
}

/* ---------- Diálogos (Sildo e Gundo) ---------- */
function renderStoryNPC(n, P) {
  const st = P.story;
  if (n.id === 'gundo') {
    if (storyOver(P)) return `<p class="fala">"Então você é o novo campeão de ${REGION.nome}! Minha oficina está às suas ordens."</p>
      <p>A ferraria agora aprimora equipamentos até <b>+8</b>, e eu posso <b>reencantar</b> uma arma ou armadura (sortear novos afixos).</p>
      ${['arma', 'armadura'].map(s => { const it = P.equip[s], c = 40 + it.tier * 40; return `<div class="shoprow"><span>${itemIcon(it)} ${esc(it.name)}</span><button data-act="reforge:${s}" ${P.gold < c ? 'disabled' : ''}>Reencantar (${c} 🪙)</button></div>`; }).join('')}`;
    return `<p class="fala">"Volte quando for campeão. Aí conversamos."</p>`;
  }
  if (storyOver(P)) {
    return `<p class="fala">"${STORY[STORY.length - 1].fim}"</p><p>A história de ${REGION.nome} terminou, e agora os lendários despertaram: eles aparecem em qualquer canto do mapa, são fortes demais para um herói sozinho e se regeneram sem parar. Junte um grupo para caçá-los. E os ginásios aceitam revanches pelos portais dos Alfas. Que tal conhecer outra região?</p>`;
  }
  const s = STORY[st.ch];
  const t2 = TOWNS[1], helper = NPCS2.find(x => x.id === 'sildo');
  if (n.town === 1) {
    // assistente na 2ª cidade
    if (needT2(P)) return `<p class="fala">"Você deve ser quem ${REGION.guia.nome} mandou! Que bom que chegou a ${t2.nome}."</p>
      <p>Daqui em diante a jornada fica longe de casa, e ${t2.nome} fica bem no meio de ${REGION.nome}: é daqui que você parte para os próximos ginásios, e é aqui que você volta depois de cada vitória.</p>
      <div class="quest cur" style="margin-top:8px"><b>📀 ${n.nome} entrega a ${HMS.fly.mo} ${HMS.fly.nome}</b>
      <p class="fala">"Com Fly, um companheiro voador te leva para <b>qualquer cidade que você já visitou</b>: aperte <b>[V]</b> e escolha o destino. Toda cidade por onde você passa vira um destino novo."</p>
      <div class="small">Ensine Fly a um Pokémon do tipo Voador no painel (botão <b>+🪶</b>) e deixe ele fora da Poké Ball.<br>
      E lembre: <b>[R]</b> agora te leva de volta à <b>última cidade</b> em que você esteve, não só à ${ZONES[0].nome}.</div></div>
      <button data-act="story:t2" class="good">📀 Receber a ${HMS.fly.mo} ${HMS.fly.nome}</button>`;
    if (!st.t2 && !storyOver(P)) return `<p class="fala">"Olá! ${REGION.guia.nome} me pediu para cuidar dos treinadores que chegam a ${t2.nome}. Quando a sua jornada passar por aqui, venha falar comigo."</p>`;
  } else if (st.t2 && !storyOver(P)) {
    // o guia da vila manda o jogador para a 2ª cidade
    return `<p class="fala">"A sua jornada agora segue a partir de ${t2.nome}. ${helper.nome} está esperando você lá com as próximas missões."</p>
      <div class="small">Use <b>[V]</b> Fly com um companheiro voador para chegar rápido.</div>`;
  } else if (needT2(P)) {
    return `<div class="quest cur"><b>📖 Missão: ${t2.nome}</b><p class="fala">"Você já tem quatro insígnias! Daqui pra frente os ginásios ficam longe demais da ${ZONES[0].nome}. Vá até <b>${t2.nome}</b>, no coração de ${REGION.nome}, e fale com ${helper.nome}. É de lá que a sua jornada continua, e ${helper.nome} tem uma HM que vai mudar o seu jeito de viajar."</p>
      <div class="small">🎯 Vá até ${t2.nome} e fale com ${helper.nome}<br>O destino aparece como ★ no minimapa.</div></div>` + pathChecklist(P);
  }
  const step = storyStep(P);
  if (step === 'cap1') return `<div class="quest cur"><b>📖 Primeiro passo: um companheiro</b><p class="fala">"Ninguém enfrenta um ginásio sozinho. Antes de qualquer coisa, você precisa de um parceiro. Procure um Pokémon no mato alto aqui perto, enfraqueça ele sem derrotar e jogue uma Poké Ball."</p>
      <div class="small">🎯 Capture seu primeiro Pokémon ([F] ou Y no controle joga a Poké Ball). Há um bom lugar marcado com ★ no minimapa.</div></div>`;
  if (step === 'capU' && (n.town || 0) === storyHub(P)) return `<div class="quest cur"><b>📖 A prova do treinador</b><p class="fala">"Os últimos líderes não recebem qualquer um. Eles querem ver se você sabe lidar com os Pokémon selvagens de ${ZONES[4].nome}... e esses não se entregam fácil. Traga a prova: capture um deles."</p>
      <div class="small">🎯 Capture um Pokémon em ${ZONES[4].nome} com uma <b>Great Ball 🔵</b> ou <b>Ultra Ball 🟡</b>. O ★ no minimapa mostra um bom lugar.</div></div>` + pathChecklist(P);
  if (st.ch === 0) return `<p>${s.intro}</p><p class="fala">"Eu sou ${n.nome}. Você aceita a jornada pelos oito ginásios de ${REGION.nome}?"</p><button data-act="story:start" class="good">📖 Aceitar a jornada</button>`;
  if (st.done) {
    // o líder entrega a HM na conversa (a HM é parte da história, não um prêmio automático)
    const hm = HM_GYM[st.ch], H = hm && HMS[hm];
    const gift = H ? `<div class="quest cur" style="margin-top:8px"><b>📀 ${s.nome} entrega a ${H.mo} ${H.nome}</b>
      <p class="fala">"${HM_LINES[hm](s.nome)}"</p>
      <div class="small">${HM_ZONE[hm] ? `Ela abre o caminho para <b>${ZONES[HM_ZONE[hm]].nome}</b> (ícone ${HM_ICON[hm]} no minimapa).` : 'Ela ilumina ginásios escuros, a noite e a névoa.'}
      Depois, ensine a HM a um companheiro no painel (botão <b>+${H.icon}</b>) e deixe ele fora da Poké Ball.</div></div>` : '';
    const gate = st.ch === 7 ? `<div class="quest cur" style="margin-top:8px"><b>🏅 7 insígnias!</b><p>Com elas, o Portão da Liga se abre para ${ZONES[5].nome}.</p></div>` : '';
    return `<p>${s.fim}</p>${gift}${gate}<button data-act="story:next" class="good">${H ? `📀 Receber a ${H.mo} ${H.nome} e continuar` : '📖 Continuar a história (recompensa)'}</button>`;
  }
  const warn = P.lvl < s.lvl ? ` <span style="color:#fca5a5">(recomendado nível ${s.lvl}, você é nível ${P.lvl})</span>` : '';
  const need = s.at ? needFor(P, zoneAt(...cellPt(...s.at))) : [];
  // o caminho até o ginásio passa por um bloqueio de HM: a história avisa qual usar
  const zt = s.at ? zoneAt(...cellPt(...s.at)) : 1;
  const block = zt >= 2 && zt <= 4 ? (() => { const k = { 2: 'cut', 3: 'smash', 4: 'surf' }[zt], H = HMS[k];
    return `<p class="fala">O caminho até lá passa por ${{ cut: 'arbustos que fecham a estrada', smash: 'rochas rachadas que bloqueiam a passagem', surf: 'um rio largo e fundo' }[k]}. Use <b>${H.icon} ${H.nome}</b> com um companheiro que a saiba.</p>`; })()
    : zt >= 5 ? `<p class="fala">O caminho passa pelo Portão da Liga, que só abre para quem tem 7 insígnias.</p>` : '';
  // lugares escuros: a história lembra do Flash
  const dark = (s.theme && DARK_THEMES.includes(s.theme) ? `<p class="fala">Dizem que lá dentro é escuro como breu. Sem <b>💡 Flash</b> você mal vai enxergar um palmo à frente.</p>` : '')
    + (ZONES[zt] && ZONES[zt].fog ? `<p class="fala">${ZONES[zt].nome} vive coberta por uma névoa espessa. O <b>💡 Flash</b> abre caminho por ela.</p>` : '');
  return `<div class="quest cur"><b>${st.ch <= 8 ? `Insígnia ${st.ch}/8: ` : 'Capítulo final: '}${s.titulo}</b><p>${s.intro}</p>${block}${dark}<div class="small">🎯 ${s.obj}${warn}<br>O destino aparece como ★ no minimapa.${need.length ? `<br><span style="color:#fca5a5">Para chegar lá você precisa de: ${need.join(', ')}.</span>` : ''}</div></div>` + pathChecklist(P);
}

function storyAct(P, arg) {
  const st = P.story;
  if (arg === 'start' && st.ch === 0) {
    st.ch = 1; st.done = false;
    if (!P.pets.length) { P.balls += 2; G.toasts.push({ text: '📖 Primeiro passo: capture um Pokémon para ser seu companheiro (+2 Poké Balls).', color: '#fde047', t: 6, big: 1 }); }
    else G.toasts.push({ text: `📖 Capítulo 1: ${STORY[1].titulo}`, color: '#fde047', t: 4, big: 1 });
  } else if (arg === 't2' && needT2(P)) {
    st.t2 = true;
    giveHM(P, 'fly');
    G.toasts.push({ text: `📖 A jornada agora parte de ${TOWNS[1].nome}. [R] volta para a última cidade visitada.`, color: '#fde047', t: 6, big: 1 });
    G.toasts.push({ text: `📖 Capítulo ${st.ch}: ${STORY[st.ch].titulo}`, color: '#fde047', t: 4, big: 1 });
  } else if (arg === 'next' && st.done) {
    const ch = st.ch;
    // a história não dá dinheiro: recompensa em XP, item, Doce Raro, atributo e HMs
    const last = ch === STORY.length - 1, xp = Math.round(xpNeed(P.lvl) * 0.35);
    const it = last ? { slot: 'amuleto', tier: 6, name: `Medalha do Campeão de ${REGION.nome}`, relic: 1, mods: { hp: 0.15, dmg: 2, cd: 0.15, regen: 0.5 } } : genItem(clamp(Math.round(ch * 0.7) + 1, 0, 6));
    const i = P.inv.indexOf(null);
    if (i >= 0) P.inv[i] = it; else G.bags.push({ x: P.x, y: P.y + 30, items: [it], life: 120 });
    P.bag.doce += 1;
    drinkStat(P, pick(ATTRS));
    const hm = HM_GYM[ch];
    if (hm) giveHM(P, hm);
    if (ch <= 8) G.toasts.push({ text: `🏅 Insígnia ${ch}/8 de ${REGION.nome} conquistada!`, color: '#fde047', t: 4, big: 1 });
    G.toasts.push({ text: `🎁 +${xp} XP, ${it.name}, 🍬 Doce Raro`, color: '#facc15', t: 4 });
    st.ch++; st.done = false;
    if (needT2(P)) G.toasts.push({ text: `📖 Nova missão: vá até ${TOWNS[1].nome} e fale com ${NPCS2.find(n => n.id === 'sildo').nome}`, color: '#fde047', t: 6, big: 1 });
    else if (storyStep(P) === 'capU') G.toasts.push({ text: `📖 Nova missão: capture um Pokémon em ${ZONES[4].nome} com Great ou Ultra Ball`, color: '#fde047', t: 6, big: 1 });
    else if (st.ch < STORY.length) G.toasts.push({ text: `📖 Capítulo ${st.ch}: ${STORY[st.ch].titulo}`, color: '#fde047', t: 4, big: 1 });
    else G.toasts.push({ text: `🏆 Você é o campeão de ${REGION.nome}!`, color: '#fde047', t: 6, big: 1 });
    gainXP(xp, true);
  } else return;
  sfx('lvl');
}

/* ---------- HUD ---------- */
function drawQuestHUD(hy, ox, oy) {
  const P = G.P, q = P.quest;
  if (!q || inDungeonArea(P.x)) return hy;
  hy += 18;
  ctx.textAlign = 'left'; ctx.font = 'bold 12px Barlow Semi Condensed, system-ui'; ctx.fillStyle = q.done ? '#86efac' : '#e5e7eb'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  const plain = q.desc.replace(/<div[\s\S]*$/, '').replace(/<[^>]+>/g, '');
  const t = questTarget(P), dist = t ? ` · ${Math.round(Math.hypot(t.x - P.x, t.y - P.y) / 32)}m` : '';
  outlined(q.done ? '📜 Contrato cumprido! Volte ao Mestre da Guilda' : `📜 ${plain} (${q.have}/${q.need})${dist}`, 12, hy);
  if (t) {
    const bx = t.x + ox, by = t.y + oy;
    if (bx < 0 || by < 0 || bx > W || by > H) {
      const a = Math.atan2(by - H / 2, bx - W / 2);
      const ex = clamp(W / 2 + Math.cos(a) * (W / 2 - 60), 40, W - 40), ey = clamp(H / 2 + Math.sin(a) * (H / 2 - 60), 40, H - 40);
      ctx.font = '18px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.fillText('🎯', ex, ey + 6);
    } else { ctx.font = '22px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.fillText('🎯', bx, by - 30 + Math.sin(G.time * 4) * 3); }
  }
  return hy;
}
function storyTarget(P) {
  if (!P || !P.story || storyOver(P)) return null;
  const st = P.story, s = STORY[st.ch];
  const gd = storyGuide(P);
  const step = storyStep(P);
  if (step) {
    const z = step === 'cap1' ? 1 : 4, k = 'cap' + REGION_ID + storyHub(P) + z;
    if (!G[k]) G[k] = capPoint(P, z);
    const [x, y] = G[k];
    return step === 'cap1' ? { x, y, label: 'Capture seu primeiro Pokémon (enfraqueça e jogue a Poké Ball)', titulo: 'Primeiro passo' }
      : { x, y, label: `Capture um Pokémon em ${ZONES[4].nome} com Great ou Ultra Ball`, titulo: 'A prova do treinador', lvl: ZONE_LVL[4] };
  }
  if (needT2(P)) { const h = NPCS2.find(n => n.id === 'sildo'); return { x: h.x, y: h.y, label: `Vá até ${TOWNS[1].nome} e fale com ${h.nome}`, titulo: `Missão: ${TOWNS[1].nome}` }; }
  if (st.ch === 0 || st.done) return { x: gd.x, y: gd.y, label: st.ch === 0 ? `Fale com ${gd.nome} na vila` : `Volte para ${hubName(P)} e fale com ${gd.nome}`, titulo: s.titulo };
  const [x, y] = storyPos(st.ch);
  const need = needFor(P, zoneAt(x, y));
  if (s.theme && DARK_THEMES.includes(s.theme) && !P.hms.includes('flash')) need.push('Flash (é escuro)');
  return { x, y, label: s.obj + (need.length ? ` (precisa de ${need.join(', ')})` : ''), titulo: st.ch <= 8 ? `Insígnia ${st.ch}/8` : 'Final', lvl: s.lvl };
}
function drawStoryHUD(hy, ox, oy) {
  const P = G.P, t = storyTarget(P);
  if (!t || inDungeonArea(P.x)) return hy;
  hy += 20;
  ctx.textAlign = 'left'; ctx.font = 'bold 13px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fde68a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  const dist = Math.round(Math.hypot(t.x - P.x, t.y - P.y) / 32);
  outlined(`📖 ${t.titulo} — ${t.label} · ${dist}m${t.lvl && P.lvl < t.lvl ? ` (Nv ${t.lvl}+)` : ''}`, 12, hy);
  // seta na borda da tela
  const bx = t.x + ox, by = t.y + oy;
  if (bx < 0 || by < 0 || bx > W || by > H) {
    const a = Math.atan2(by - H / 2, bx - W / 2);
    const ex = clamp(W / 2 + Math.cos(a) * (W / 2 - 40), 40, W - 40), ey = clamp(H / 2 + Math.sin(a) * (H / 2 - 40), 40, H - 40);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = '#fde047'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-7, -9); ctx.lineTo(-7, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else {
    ctx.font = 'bold 22px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fde047';
    outlined('★', bx, by - 40 + Math.sin(G.time * 4) * 4);
  }
  return hy;
}
