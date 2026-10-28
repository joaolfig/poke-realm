'use strict';
/* ============ História: "A Mina Perdida de Pedrafunda" ============
 * Adaptação livre da estrutura da aventura introdutória de D&D 5e
 * "Lost Mine of Phandelver" (Starter Set): emboscada na estrada, esconderijo
 * dos bandidos, castelo dos brutamontes e a caverna com a forja mágica.
 * Cada jogador tem o próprio capítulo (P.story = { ch, done }).
 * Os chefes da história são criados pelo host quando alguém chega perto do marcador.
 */
const STORY = [
  {
    titulo: 'Prólogo',
    intro: `Você chegou a <b>Pedrafunda</b> escoltando a carroça de suprimentos do anão <b>Gundo Buscapedra</b>.
      Gundo seguiu na frente pela estrada do norte, empolgado: jurava ter encontrado a entrada da <b>Caverna do Eco</b>,
      uma mina perdida onde, há séculos, mestres antigos forjavam cristais com a energia dos Pokémon, a <b>Forja dos Encantos</b>.<br><br>
      Ele nunca chegou. Hoje cedo, acharam a carroça dele virada na estrada, cercada de marcas de garra.`,
  },
  {
    titulo: 'Emboscada na Estrada', obj: 'Investigue a carroça atacada na estrada ao norte (Campos Verdes)', at: [8.75, 8.25], zone: 1, lvl: 2,
    kind: 'boss', boss: 217, adds: [216, 216, 216], nome: 'Garrão',
    intro: `A carroça de Gundo foi atacada na estrada ao norte da vila. Os rastros são de um bando de Pokémon selvagens
      liderados por um Ursaring enorme, que os moradores chamam de <b>Garrão</b>. Vá até lá, descubra o que aconteceu e traga notícias.`,
    fim: `Entre os destroços você encontrou o mapa rasgado de Gundo e um broche vermelho. É o símbolo dos <b>Capas Vermelhas</b>,
      bandidos que vêm aterrorizando a região. Garrão não agia sozinho: alguém o mandou atacar a carroça.`,
  },
  {
    titulo: 'O Esconderijo dos Capas Vermelhas', obj: 'Entre no esconderijo na Floresta Antiga (oeste) e derrote o Cajado de Vidro', at: [3.5, 9.5], zone: 2, lvl: 6,
    kind: 'dungeon', theme: 'capas', nome: 'Cajado de Vidro',
    intro: `Os Capas Vermelhas obedecem a um mago misterioso chamado <b>Cajado de Vidro</b>, que se esconde numa caverna
      na Floresta Antiga, a oeste. Ele usa um Alakazam para manter todos sob controle. Se alguém sabe onde está Gundo, é ele.`,
    fim: `Nos papéis do Cajado de Vidro há uma ordem marcada com o desenho de uma teia: <i>"Levem o anão ao Castelo Garra-Torta.
      Ele vai nos mostrar o caminho da Caverna."</i> Quem assina é a <b>Aranha Negra</b>.`,
  },
  {
    titulo: 'O Castelo Garra-Torta', obj: 'Invada as ruínas nas Montanhas Rochosas (norte) e liberte Gundo', at: [7.5, 3.5], zone: 3, lvl: 11,
    kind: 'boss', boss: 68, adds: [66, 67, 67, 66], nome: 'Rei Grol',
    intro: `O Castelo Garra-Torta é uma ruína nas Montanhas Rochosas, ao norte, tomada por um bando de lutadores brutais.
      O chefe deles, um Machamp imenso chamado <b>Rei Grol</b>, guarda Gundo como prisioneiro. Prepare-se: vai ser difícil.`,
    fim: `Você libertou Gundo! Machucado, mas teimoso como todo anão, ele voltou com você para Pedrafunda.
      A notícia é ruim: a Aranha Negra já está dentro da Caverna do Eco, tentando despertar a Forja para dominar os Pokémon da região.`,
  },
  {
    titulo: 'A Caverna do Eco', obj: 'Desça à Caverna do Eco, no extremo nordeste das Terras Sombrias, e detenha a Aranha Negra', at: [17.5, 1.5], zone: 4, lvl: 15,
    kind: 'dungeon', theme: 'eco', nome: 'Aranha Negra',
    intro: `Gundo desenhou o caminho: a entrada da <b>Caverna do Eco</b> fica no extremo nordeste das Terras Sombrias.
      Lá dentro, a <b>Aranha Negra</b> e seu Galvantula tecem teias sobre a Forja dos Encantos. Este é o fim da linha. Para ela ou para você.`,
    fim: `A Aranha Negra caiu, e a Forja dos Encantos voltou a brilhar com uma luz calma. Gundo promete usar o fogo antigo para o bem.
      Pedrafunda tem um novo herói.`,
  },
];
const STORY_IDS = [217, 216, 68, 66, 67, 65, 596, 168, 167, 595];
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
    createDungeon(x, y, null, s.zone, { theme: s.theme, ttl: 600, force: true, quiet: true });
  }
}

// chamado no onKill de cada jogador
function storyKill(m) {
  const P = G.P;
  if (!m.st || !P.story || P.story.ch !== m.st || P.story.done) return;
  P.story.done = true;
  G.toasts.push({ text: `📖 Capítulo concluído: ${STORY[m.st].titulo}! Volte à vila e fale com Sildo.`, color: '#fde047', t: 6, big: 1 });
  sfx('lvl');
  saveGame();
}

/* ---------- Diálogos (Sildo e Gundo) ---------- */
function renderStoryNPC(n, P) {
  const st = P.story;
  if (n.id === 'gundo') {
    if (storyOver(P)) return `<p class="fala">"A Forja dos Encantos está acesa de novo! Graças a você."</p>
      <p>A Ferreira Duna agora aprimora equipamentos até <b>+8</b>, e eu posso <b>reencantar</b> uma arma ou armadura (sortear novos afixos).</p>
      ${['arma', 'armadura'].map(s => { const it = P.equip[s], c = 40 + it.tier * 40; return `<div class="shoprow"><span>${itemIcon(it)} ${esc(it.name)}</span><button data-act="reforge:${s}" ${P.gold < c ? 'disabled' : ''}>Reencantar (${c} 🪙)</button></div>`; }).join('')}`;
    return `<p class="fala">"Aquela Aranha... ela quer a Forja para dominar os Pokémon. A Caverna do Eco fica no extremo nordeste das Terras Sombrias. Tome cuidado lá embaixo."</p>`;
  }
  if (storyOver(P)) {
    return `<p class="fala">"${STORY[4].fim}"</p><p>A história principal terminou, mas os lendários ainda vagam pelas Terras Sombrias e as masmorras continuam se abrindo. Boa caçada, herói!</p>`;
  }
  const s = STORY[st.ch];
  if (st.ch === 0) return `<p>${s.intro}</p><p class="fala">"Eu sou Sildo Invernal, cavaleiro da guarda. Você aceita procurar o nosso amigo?"</p><button data-act="story:start" class="good">📖 Aceitar a missão</button>`;
  if (st.done) return `<p>${s.fim}</p><button data-act="story:next" class="good">📖 Continuar a história (recompensa)</button>`;
  const warn = P.lvl < s.lvl ? ` <span style="color:#fca5a5">(recomendado nível ${s.lvl}, você é nível ${P.lvl})</span>` : '';
  return `<div class="quest cur"><b>Capítulo ${st.ch}: ${s.titulo}</b><p>${s.intro}</p><div class="small">🎯 ${s.obj}${warn}<br>O destino aparece como ★ no minimapa.</div></div>`;
}

function storyAct(P, arg) {
  const st = P.story;
  if (arg === 'start' && st.ch === 0) {
    st.ch = 1; st.done = false;
    G.toasts.push({ text: `📖 Capítulo 1: ${STORY[1].titulo}`, color: '#fde047', t: 4, big: 1 });
  } else if (arg === 'next' && st.done) {
    const ch = st.ch;
    const xp = Math.round(xpNeed(P.lvl) * 0.35), gold = 80 * ch;
    P.gold += gold;
    const it = ch === 4 ? { slot: 'amuleto', tier: 6, name: 'Coração da Forja', relic: 1, mods: { hp: 0.15, dmg: 2, cd: 0.15, regen: 0.5 } } : genItem(clamp(ch + 2, 0, 6));
    const i = P.inv.indexOf(null);
    if (i >= 0) P.inv[i] = it; else G.bags.push({ x: P.x, y: P.y + 30, items: [it], life: 120 });
    P.bag.doce += 1;
    drinkStat(P, pick(ATTRS));
    const hm = { 1: 'cut', 2: 'surf', 3: 'flash' }[ch];
    if (hm) giveHM(P, hm);
    G.toasts.push({ text: `🎁 +${xp} XP, +${gold} 🪙, ${it.name}, 🍬 Doce Raro`, color: '#facc15', t: 4 });
    st.ch++; st.done = false;
    if (st.ch < STORY.length) G.toasts.push({ text: `📖 Capítulo ${st.ch}: ${STORY[st.ch].titulo}`, color: '#fde047', t: 4, big: 1 });
    else G.toasts.push({ text: '🏆 Você completou a história de Pedrafunda!', color: '#fde047', t: 6, big: 1 });
    gainXP(xp, true);
  } else return;
  sfx('lvl');
}

/* ---------- HUD ---------- */
function drawQuestHUD(hy, ox, oy) {
  const P = G.P, q = P.quest;
  if (!q || inDungeonArea(P.x)) return hy;
  hy += 18;
  ctx.textAlign = 'left'; ctx.font = 'bold 12px system-ui'; ctx.fillStyle = q.done ? '#86efac' : '#e5e7eb'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  const plain = q.desc.replace(/<div[\s\S]*$/, '').replace(/<[^>]+>/g, '');
  const t = questTarget(P), dist = t ? ` · ${Math.round(Math.hypot(t.x - P.x, t.y - P.y) / 32)}m` : '';
  outlined(q.done ? '📜 Contrato cumprido! Volte ao Mestre da Guilda' : `📜 ${plain} (${q.have}/${q.need})${dist}`, 12, hy);
  if (t) {
    const bx = t.x + ox, by = t.y + oy;
    if (bx < 0 || by < 0 || bx > W || by > H) {
      const a = Math.atan2(by - H / 2, bx - W / 2);
      const ex = clamp(W / 2 + Math.cos(a) * (W / 2 - 60), 40, W - 40), ey = clamp(H / 2 + Math.sin(a) * (H / 2 - 60), 40, H - 40);
      ctx.font = '18px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🎯', ex, ey + 6);
    } else { ctx.font = '22px system-ui'; ctx.textAlign = 'center'; ctx.fillText('🎯', bx, by - 30 + Math.sin(G.time * 4) * 3); }
  }
  return hy;
}
function storyTarget(P) {
  if (!P || !P.story || storyOver(P)) return null;
  const st = P.story, s = STORY[st.ch];
  if (st.ch === 0 || st.done) return { x: 0, y: -205, label: st.ch === 0 ? 'Fale com Sildo Invernal na vila' : 'Volte à vila e fale com Sildo', titulo: s.titulo };
  const [x, y] = storyPos(st.ch);
  return { x, y, label: s.obj, titulo: `Cap. ${st.ch}: ${s.titulo}`, lvl: s.lvl };
}
function drawStoryHUD(hy, ox, oy) {
  const P = G.P, t = storyTarget(P);
  if (!t || inDungeonArea(P.x)) return hy;
  hy += 20;
  ctx.textAlign = 'left'; ctx.font = 'bold 13px system-ui'; ctx.fillStyle = '#fde68a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
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
    ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fde047';
    outlined('★', bx, by - 40 + Math.sin(G.time * 4) * 4);
  }
  return hy;
}
