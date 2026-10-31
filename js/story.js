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
  if (!s || !s.at || P.story.done) return;
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
  G.toasts.push({ text: `📖 ${STORY[m.st].titulo} vencido! Volte à vila e fale com ${REGION.guia.nome}.`, color: '#fde047', t: 6, big: 1 });
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
    return `<p class="fala">"${STORY[STORY.length - 1].fim}"</p><p>A história de ${REGION.nome} terminou, mas os lendários ainda vagam pelas áreas mais perigosas e os ginásios aceitam revanches pelos portais dos Alfas. Que tal conhecer outra região?</p>`;
  }
  const s = STORY[st.ch];
  if (st.ch === 0) return `<p>${s.intro}</p><p class="fala">"Eu sou ${n.nome}. Você aceita a jornada pelos oito ginásios de ${REGION.nome}?"</p><button data-act="story:start" class="good">📖 Aceitar a jornada</button>`;
  if (st.done) return `<p>${s.fim}</p><button data-act="story:next" class="good">📖 Continuar a história (recompensa)</button>`;
  const warn = P.lvl < s.lvl ? ` <span style="color:#fca5a5">(recomendado nível ${s.lvl}, você é nível ${P.lvl})</span>` : '';
  return `<div class="quest cur"><b>${st.ch <= 8 ? `Insígnia ${st.ch}/8: ` : 'Capítulo final: '}${s.titulo}</b><p>${s.intro}</p><div class="small">🎯 ${s.obj}${warn}<br>O destino aparece como ★ no minimapa.</div></div>`;
}

function storyAct(P, arg) {
  const st = P.story;
  if (arg === 'start' && st.ch === 0) {
    st.ch = 1; st.done = false;
    G.toasts.push({ text: `📖 Capítulo 1: ${STORY[1].titulo}`, color: '#fde047', t: 4, big: 1 });
  } else if (arg === 'next' && st.done) {
    const ch = st.ch;
    const last = ch === STORY.length - 1, xp = Math.round(xpNeed(P.lvl) * 0.35), gold = 60 * ch;
    P.gold += gold;
    const it = last ? { slot: 'amuleto', tier: 6, name: `Medalha do Campeão de ${REGION.nome}`, relic: 1, mods: { hp: 0.15, dmg: 2, cd: 0.15, regen: 0.5 } } : genItem(clamp(Math.round(ch * 0.7) + 1, 0, 6));
    const i = P.inv.indexOf(null);
    if (i >= 0) P.inv[i] = it; else G.bags.push({ x: P.x, y: P.y + 30, items: [it], life: 120 });
    P.bag.doce += 1;
    drinkStat(P, pick(ATTRS));
    const hm = HM_GYM[ch];
    if (hm) giveHM(P, hm);
    if (ch <= 8) G.toasts.push({ text: `🏅 Insígnia ${ch}/8 de ${REGION.nome} conquistada!`, color: '#fde047', t: 4, big: 1 });
    G.toasts.push({ text: `🎁 +${xp} XP, +${gold} 🪙, ${it.name}, 🍬 Doce Raro`, color: '#facc15', t: 4 });
    st.ch++; st.done = false;
    if (st.ch < STORY.length) G.toasts.push({ text: `📖 Capítulo ${st.ch}: ${STORY[st.ch].titulo}`, color: '#fde047', t: 4, big: 1 });
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
  const guia = REGION.guia.nome;
  if (st.ch === 0 || st.done) return { x: 0, y: -205, label: st.ch === 0 ? `Fale com ${guia} na vila` : `Volte à vila e fale com ${guia}`, titulo: s.titulo };
  const [x, y] = storyPos(st.ch);
  return { x, y, label: s.obj, titulo: st.ch <= 8 ? `Insígnia ${st.ch}/8` : 'Final', lvl: s.lvl };
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
