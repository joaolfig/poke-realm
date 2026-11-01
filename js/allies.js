'use strict';
/* ============ Companheiros ============
 * P.pets guarda até 4 Pokémon capturados ({ pid, name, type, lvl, xp }).
 * P.petAct lista os que estão fora da Pokébola (o talento Batalha em Equipe libera até 4);
 * o primeiro (P.petIdx) é o líder: usa HMs e serve de montaria.
 * O ativo ganha XP com os abates, sobe de nível e evolui seguindo a cadeia de
 * evolução da PokeAPI. Em tempo de jogo, G.allies tem o ativo e os espíritos do Necromante.
 */
const PET_MAX = 30;
// vagas de companheiro: começa com 2 e compra mais com a Vendedora de Poké Balls (Cinto), até 6
const PET_CAP_MAX = 6, CINTO_PRECO = { 2: 350, 3: 750, 4: 1300, 5: 2000 };
const petCap = P => clamp(P.petCap || 2, 2, PET_CAP_MAX);
const petNeed = l => Math.round(55 * Math.pow(l, 1.75));
const mainType = p => { let t = p.types[0]; if (t === 'normal' && p.types[1]) t = p.types[1]; return t; };
const MOVES = {
  normal: 'Investida', fire: 'Lança-Chamas', water: 'Jato d\'Água', grass: 'Folha Navalha', electric: 'Choque do Trovão', ice: 'Raio de Gelo',
  fighting: 'Golpe Karatê', poison: 'Ácido', ground: 'Tremor', flying: 'Ataque de Asa', psychic: 'Confusão', bug: 'Picada', rock: 'Lançar Rochas',
  ghost: 'Bola Sombria', dragon: 'Fúria do Dragão', dark: 'Mordida', steel: 'Cauda de Ferro', fairy: 'Brilho Mágico',
};

/* ---------- Evolução (PokeAPI: pokemon-species -> evolution-chain) ---------- */
const EVO_KEY = 'pkr_evo_v2'; // v2: guarda também o tipo do cristal das evoluções por pedra
let EVO = null;
const evoLoading = new Set();
function evoCache() {
  if (!EVO) { try { EVO = JSON.parse(localStorage.getItem(EVO_KEY) || '{}'); } catch (e) { EVO = {}; } }
  return EVO;
}
// pedras de evolução dos jogos -> cristal do tipo que o jogador entrega ao companheiro
const STONE_TYPE = { 'fire-stone': 'fire', 'water-stone': 'water', 'thunder-stone': 'electric', 'leaf-stone': 'grass', 'ice-stone': 'ice', 'moon-stone': 'fairy', 'sun-stone': 'fire', 'shiny-stone': 'fairy', 'dusk-stone': 'dark', 'dawn-stone': 'psychic' };
// guarda, para cada Pokémon, as evoluções possíveis: [[id, nível do companheiro, tipo do cristal (só nas por pedra)], ...]
async function loadEvo(pid) {
  const C = evoCache();
  if (C[pid] || evoLoading.has(pid)) return;
  evoLoading.add(pid);
  try {
    const sp = await (await fetch('https://pokeapi.co/api/v2/pokemon-species/' + pid)).json();
    const ch = await (await fetch(sp.evolution_chain.url)).json();
    const idOf = u => +u.split('/').filter(Boolean).pop();
    const find = (n, depth) => {
      if (idOf(n.species.url) === pid) return [n, depth];
      for (const c of n.evolves_to) { const r = find(c, depth + 1); if (r) return r; }
      return null;
    };
    const f = find(ch.chain, 0);
    let opts = f ? f[0].evolves_to.map(c => {
      const det = (c.evolution_details || [])[0] || {};
      // níveis dos jogos comprimidos para o nosso ritmo; evoluções por pedra/troca viram nível fixo
      const lv = det.min_level ? Math.ceil(det.min_level * 0.6) : f[1] === 0 ? 14 : 22;
      const st = det.trigger && det.trigger.name === 'use-item' && det.item && STONE_TYPE[det.item.name];
      return st ? [idOf(c.species.url), clamp(lv, 3, 28), st] : [idOf(c.species.url), clamp(lv, 3, 28)];
    }) : [];
    const classic = opts.filter(o => o[0] <= 809);
    if (classic.length) opts = classic;
    C[pid] = opts;
    try { localStorage.setItem(EVO_KEY, JSON.stringify(C)); } catch (e) { /* cheio */ }
    if (G) G.dirty = true;
  } catch (e) { /* sem internet: tenta de novo depois */ } finally { evoLoading.delete(pid); }
}
// nível da evolução automática (as por pedra não contam: precisam do cristal)
function evoLevel(pid) {
  if (pid === EEVEE) return 0;
  const o = evoCache()[pid];
  if (!o) return undefined;
  const lv = o.filter(x => !x[2]);
  return lv.length ? Math.min(...lv.map(x => x[1])) : 0;
}
// evoluções por cristal: [[id, nível mínimo, tipo], ...] (o Eevee vira a evolução do tipo do cristal)
const stoneOpts = pid => (pid === EEVEE ? Object.entries(EEVEE_EVO).map(([t, id]) => [id, EEVEE_LVL, t]) : (evoCache()[pid] || []).filter(x => x[2]));
const hasCrystal = (P, t) => P.inv.findIndex(it => it && it.slot === 'pedra' && it.type === t);
// texto curto para o cartão do companheiro
function stoneTxt(pt) {
  const so = stoneOpts(pt.pid);
  if (!so.length) return '';
  const ts = [...new Set(so.map(o => TYPE_PT[o[2]]))], lv = Math.min(...so.map(o => o[1]));
  return `evolui com Cristal de ${ts.join(', ').replace(/, ([^,]*)$/, ' ou $1')}${pt.lvl < lv ? ` (a partir do Nv ${lv})` : ''}`;
}
// entrega o cristal (consome) e o companheiro evolui
function crystalEvolve(i) {
  const P = G.P, pt = P.pets[i];
  if (!pt || G.evo) return;
  const so = stoneOpts(pt.pid);
  const ok = so.filter(o => pt.lvl >= o[1] && hasCrystal(P, o[2]) >= 0);
  if (!ok.length) {
    const lv = Math.min(...so.map(o => o[1]));
    return G.toasts.push({ text: pt.lvl < lv ? `${pt.name} só aceita o cristal a partir do Nv ${lv}.` : `Você precisa de um ${stoneTxt(pt).replace('evolui com ', '')} na mochila.`, color: '#fca5a5', t: 3.5 });
  }
  const [id, , t] = ok[0], k = hasCrystal(P, t);
  P.inv[k] = null;
  G.evo = { pt, ids: [id], t: 3.2, ready: false };
  loadPokedex([id]).then(() => { if (G && G.evo && G.evo.pt === pt) G.evo.ready = true; });
  G.toasts.push({ text: `💎 ${pt.name} absorveu o Cristal de ${TYPE_PT[t]} e está evoluindo!`, color: TYPE_COLORS[t], t: 3.5, big: 1 });
  sfx('boss'); G.dirty = true; saveGame();
}

function petGainXP(n) {
  const P = G.P, act = G.allies.filter(a => a.pet);
  const k = (hasT(P, 'mentor') ? 1.5 : 1) * (act.length > 1 ? 0.75 : 1);
  for (const a of act) {
    const pt = P.pets[a.slot];
    if (!pt || pt.lvl >= PET_MAX) continue;
    pt.xp += Math.round(n * k);
    let up = false;
    while (pt.lvl < PET_MAX && pt.xp >= petNeed(pt.lvl)) { pt.xp -= petNeed(pt.lvl); pt.lvl++; up = true; }
    if (up) { text(a.x, a.y - 30, `${pt.name} subiu para o Nv ${pt.lvl}!`, '#86efac', 13); sfx('pick'); G.dirty = true; }
    checkEvolve(pt);
  }
}
// chama/guarda um companheiro; com o talento Batalha em Equipe vários ficam fora ao mesmo tempo
function togglePet(P, i) {
  if (!P.pets[i]) return;
  if (P.petAct.includes(i)) P.petAct = P.petAct.filter(j => j !== i);
  else if (P.petAct.length < petSlots(P)) P.petAct.push(i);
  else P.petAct[P.petAct.length - 1] = i;
  P.petIdx = P.petAct.length ? P.petAct[0] : -1;
  G.dirty = true;
}
function giveCandy() {
  const P = G.P, pt = P.pets[P.petIdx];
  if (!pt || P.bag.doce <= 0 || pt.lvl >= PET_MAX) return;
  P.bag.doce--;
  pt.lvl++; pt.xp = 0;
  G.toasts.push({ text: `🍬 ${pt.name} comeu um Doce Raro e foi para o Nv ${pt.lvl}!`, color: '#f9a8d4', t: 3 });
  sfx('lvl');
  checkEvolve(pt);
  G.dirty = true;
  saveGame();
}

// Eevee: evolui com o cristal do tipo da evolução (Água, Elétrico, Fogo, Psíquico, Sombrio, Planta, Gelo ou Fada)
const EEVEE = 133, EEVEE_LVL = 14;
const EEVEE_EVO = { water: 134, electric: 135, fire: 136, psychic: 196, dark: 197, grass: 470, ice: 471, fairy: 700 };
function checkEvolve(pt) {
  if (G.evo || pt.pid === EEVEE) return;
  const opts = evoCache()[pt.pid];
  if (!opts) { loadEvo(pt.pid); return; }
  const ids = opts.filter(o => o[1] <= pt.lvl && !o[2]).map(o => o[0]); // as por pedra esperam o cristal
  if (!ids.length) return;
  G.evo = { pt, ids, t: 3.2, ready: false };
  loadPokedex(ids).then(() => { if (G && G.evo && G.evo.pt === pt) G.evo.ready = true; });
  G.toasts.push({ text: `✨ O quê? ${pt.name} está evoluindo!`, color: '#fde047', t: 3.5, big: 1 });
  sfx('boss');
}
function updateEvo(dt) {
  const ev = G.evo, P = G.P;
  if (!ev || !P) return;
  ev.t -= dt;
  const a = G.allies.find(x => x.pet && P.pets[x.slot] === ev.pt);
  if (a && Math.random() < 0.4) G.parts.push({ x: a.x + rand(-20, 20), y: a.y + rand(-20, 20), vx: 0, vy: -50, life: 0.6, color: '#fef9c3', size: 3 });
  if (ev.t > 0 || !ev.ready) return;
  G.evo = null;
  const ok = ev.ids.filter(id => POKE[id] && POKE[id].img);
  if (!ok.length) return;
  // evoluções ramificadas (ex.: Eevee) preferem o tipo do herói
  const same = ok.filter(id => POKE[id].types.includes(P.ptype));
  const id = pick(same.length ? same : ok), pt = ev.pt, old = pt.name;
  pt.pid = id; pt.name = POKE[id].name; pt.type = mainType(POKE[id]);
  if (a) { burst(a.x, a.y, '#fde047', 40); burst(a.x, a.y, '#ffffff', 30); G.fx.push({ k: 'ring', x: a.x, y: a.y, r: 0, R: 120, life: 0.8, max: 0.8, color: '#fde047' }); }
  G.toasts.push({ text: `🎉 Parabéns! ${old} evoluiu para ${pt.name}!`, color: '#fde047', t: 5, big: 1 });
  sfx('lvl');
  loadEvo(id);
  G.dirty = true;
  saveGame();
}

/* ---------- Montarias (como em Pokémon Let's Go) ---------- */
const RIDE_IDS = new Set([3, 6, 9, 18, 31, 34, 53, 59, 78, 85, 95, 111, 112, 115, 128, 130, 131, 142, 143, 149, 208, 229, 232, 234, 241, 248, 324, 373, 445]);
const FLY_RIDE = new Set([6, 18, 142, 149, 373]);
const canRide = pid => { const p = POKE[pid]; return !!p && (RIDE_IDS.has(pid) || (p.height >= 17 && !p.types.includes('ghost'))); };
const rideFlies = pid => FLY_RIDE.has(pid) || (canRide(pid) && petIsFlyer(pid));
function toggleRide() {
  const P = G.P;
  if (P.riding) { P.riding = false; text(P.x, P.y - 44, 'Desmontou', '#cbd5e1', 12); return; }
  if (P.wildT > 0 || P.lform) return text(P.x, P.y - 44, 'Transformado não dá para montar', '#fca5a5', 12);
  const pt = activePet(P);
  if (!pt || !G.allies.some(a => a.pet)) return G.toasts.push({ text: 'Chame um companheiro grande para montar (Arcanine, Rapidash, Onix, Lapras...).', color: '#fca5a5', t: 3 });
  if (!canRide(pt.pid)) return G.toasts.push({ text: `${pt.name} é pequeno demais para carregar você.`, color: '#fca5a5', t: 2.5 });
  if (inDungeonArea(P.x)) return G.toasts.push({ text: 'Não dá para montar dentro de masmorras.', color: '#fca5a5', t: 2 });
  P.riding = true;
  burst(P.x, P.y, '#fde68a', 16);
  text(P.x, P.y - 48, `Você montou em ${pt.name}!${rideFlies(pt.pid) ? ' (voando)' : ''}`, '#fde68a', 13);
  sfx('pot');
}
const mountPid = P => { const pt = activePet(P); return P && (P.riding || P.surfing) && pt ? pt.pid : 0; };
// desenha a montaria embaixo do jogador; devolve quanto o jogador sobe
function drawMount(pid, wx, wy, x, y, face, moving, t) {
  const p = POKE[pid];
  if (!p || !p.img) { ensurePoke(pid); return 0; }
  const w = p.img.width * 1.9, h = p.img.height * 1.9, fl = rideFlies(pid) && !(G.P && G.P.surfing && !G.P.riding);
  if (fl) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 26, w * 0.3, 6, 0, 0, 7); ctx.fill();
    const bob = Math.sin(t * 3) * 3;
    drawMon(p.img, p, x, y - 4 + bob, w, h, face, t, false, DG_BASE, wy, true, 1);
    return h * 0.35 + 10 - bob;
  }
  drawMon(p.img, p, x, y + 12, w, h, face, t, moving, wx, wy + 8, false, 1);
  return h * 0.3;
}

/* ---------- Forma Selvagem (Druida): vira o companheiro líder ---------- */
const wildDur = P => (hasS(P, 'lua') ? 18 : 12);
// tamanho da forma: 0 = Druida, 1 = Círculo da Terra (um pouco maior), 2 = Círculo da Lua (ainda maior)
const wildSizeK = P => (hasS(P, 'lua') ? 2 : hasS(P, 'terra') ? 1 : 0);
const WILD_SIZE = [1, 1.15, 1.3];
function wildShape(P) {
  const pt = activePet(P);
  if (!pt || !POKE[pt.pid] || !G.allies.some(a => a.pet && a.slot === P.petIdx)) {
    text(P.x, P.y - 40, 'Chame um companheiro para usar a Forma Selvagem', '#fca5a5', 12); P.abilCd = 0.4; return false;
  }
  const before = maxHP(P);
  P.riding = false;
  P.wildT = wildDur(P); P.wildPid = pt.pid; P.wildType = mainType(POKE[pt.pid]); P.wildSlot = P.petIdx;
  P.hp += maxHP(P) - before; // os PV extras chegam cheios
  if (hasS(P, 'lua')) P.hp = Math.min(maxHP(P), P.hp + maxHP(P) * 0.25);
  if (hasS(P, 'terra')) G.zones.push({ k: 'raizes', x: P.x, y: P.y, r: 150, t: 6, wait: 0, every: 1, tick: 0 });
  burst(P.x, P.y, '#86efac', 30); burst(P.x, P.y, TYPE_COLORS[P.wildType], 24);
  emitEvent({ t: 'fx', x: Math.round(P.x), y: Math.round(P.y), r: 90, color: '#86efac' });
  text(P.x, P.y - 50, `🌿 Você virou ${pt.name}!`, '#86efac', 14);
  sfx('lvl');
  return true;
}
function endWild(P) {
  P.wildT = 0;
  P.hp = Math.min(P.hp, maxHP(P));
  burst(P.x, P.y, '#86efac', 22);
  text(P.x, P.y - 44, 'Você voltou à forma normal', '#cbd5e1', 12);
}
function wildTick(P, dt) {
  if (!(P.wildT > 0)) return;
  P.wildT -= dt;
  if (P.wildT <= 0 || P.petIdx !== P.wildSlot || !activePet(P) || activePet(P).pid !== P.wildPid) endWild(P);
  else if (Math.random() < 0.12) G.parts.push({ x: P.x + rand(-16, 16), y: P.y + rand(-10, 14), vx: rand(-10, 10), vy: -30, life: 0.6, color: Math.random() < 0.5 ? '#86efac' : TYPE_COLORS[P.wildType], size: 3 });
}
// desenha o Druida transformado: o Pokémon no lugar do herói, com os pés no mesmo ponto
function drawWildForm(pid, wx, wy, x, y, face, moving, alpha, ptype, sk, mul = 1) {
  const p = POKE[pid];
  if (!p || !p.img) { ensurePoke(pid); return false; }
  const ih = p.img.height, k = clamp(1.9, 44 / ih, 92 / ih) * WILD_SIZE[sk || 0] * mul, w = p.img.width * k, h = ih * k;
  if (ptype) {
    ctx.strokeStyle = TYPE_COLORS[ptype]; ctx.lineWidth = 2; ctx.globalAlpha = (0.6 + Math.sin(G.time * 6) * 0.2) * alpha;
    ctx.beginPath(); ctx.ellipse(x, y + 16, Math.max(20, w * 0.36), 7, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  }
  drawMon(p.img, p, x, y + 17 - h * 0.42, w, h, face, G.time, moving, wx, wy + 17 - h * 0.42, petIsFlyer(pid), alpha);
  return true;
}

/* ---------- Comportamento em jogo ---------- */
function syncPet() {
  const P = G.P;
  const slots = P.petAct.filter(i => P.pets[i]).slice(0, petSlots(P));
  G.allies = G.allies.filter(a => !a.pet || (slots.includes(a.slot) && P.pets[a.slot].pid === a.pid));
  slots.forEach((i, n) => {
    const pt = P.pets[i];
    let a = G.allies.find(x => x.pet && x.slot === i);
    if (!a && POKE[pt.pid]) { a = { pet: true, slot: i, pid: pt.pid, type: pt.type, lvl: pt.lvl, x: P.x - 30, y: P.y + 20, cd: 1 + n * 0.3, spT: 4 + n, t: 0, face: 1 }; G.allies.push(a); }
    if (a) a.lvl = pt.lvl;
  });
  // o líder vai na frente da lista (montaria e HMs)
  G.allies.sort((a, b) => (b.pet && b.slot === P.petIdx) - (a.pet && a.slot === P.petIdx));
}

function addSpirit(pid) {
  const P = G.P;
  if (!POKE[pid] || G.allies.filter(a => a.ghost).length >= 3) return;
  const p = POKE[pid];
  G.allies.push({ ghost: true, pid, type: mainType(p), x: P.x, y: P.y, ttl: 15, cd: 0.5, t: 0, face: 1 });
  text(P.x, P.y - 50, `💀 ${p.name} se ergue como espírito!`, '#c4b5fd', 13);
}

function updateAllies(dt) {
  const P = G.P;
  if (!P) { G.allies = []; return; }
  syncPet();
  updateEvo(dt);
  G.allies = G.allies.filter(a => a.ttl === undefined || (a.ttl -= dt) > 0);
  const n = G.allies.length;
  G.allies.forEach((a, i) => {
    a.t += dt;
    // fica atrás do herói em relação à mira, mas o ângulo gira devagar e a velocidade é limitada
    // (antes, mirar perto do herói fazia o ponto pular para o outro lado e o Pokémon atravessar a tela)
    const want = P.aim + Math.PI + (i - (n - 1) / 2) * 0.8;
    if (a.ang === undefined) a.ang = want;
    a.ang += clamp(Math.atan2(Math.sin(want - a.ang), Math.cos(want - a.ang)), -3 * dt, 3 * dt);
    const tx = P.x + Math.cos(a.ang) * 46, ty = P.y + Math.sin(a.ang) * 46;
    const ox = a.x, dd = Math.hypot(tx - a.x, ty - a.y), step = Math.min(dd, Math.max(moveSpeed(P) * 1.3, dd * 6) * dt);
    if (dd > 0.01) { a.x += (tx - a.x) / dd * step; a.y += (ty - a.y) / dd * step; }
    if (Math.hypot(a.x - P.x, a.y - P.y) > 400 || !walkable(a.x, a.y)) { a.x = P.x; a.y = P.y; }
    a.moving = Math.abs(a.x - ox) > 0.3;
    if (a.pet && a.pid === 132) dittoLook(a, dt);
    if (a.pet && a.slot === P.petIdx && (P.riding || P.surfing || P.wildT > 0)) { a.x = P.x; a.y = P.y; return; } // está carregando o jogador (ou o Druida virou ele)
    if (a.rageT > 0) a.rageT -= dt;
    a.cd -= dt;
    if (a.pet) a.spT -= dt;
    if (a.cd > 0 || (G.evo && a.pet)) return;
    if (!inDungeonArea(P.x) && inTown(P.x, P.y)) { a.cd = 0.3; return; } // paz na vila
    let best = null, bd = 400;
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const dd = Math.hypot(e.x - a.x, e.y - a.y);
      if (dd < bd) { bd = dd; best = e; }
    }
    if (!best) { a.cd = 0.3; return; }
    const shotAng = Math.atan2(best.y - a.y, best.x - a.x);
    a.face = Math.cos(shotAng) >= 0 ? 1 : -1;
    const col = TYPE_COLORS[a.type];
    if (a.pet && a.spT <= 0) {
      // golpe especial: leque de projéteis mais fortes
      const shots = 3 + Math.floor(a.lvl / 10) * 2;
      for (let s = 0; s < shots; s++) spawnPB({ x: a.x, y: a.y, a: shotAng + (s - (shots - 1) / 2) * 0.16, spd: 420, life: 1.1, r: 8, color: col, shape: 'orb', ally: a, sp: 1 });
      text(a.x, a.y - 34, `${POKE[a.pid] ? POKE[a.pid].name : ''} usou ${MOVES[a.type] || 'Investida'}!`, col, 13);
      a.spT = (a.lvl >= 15 ? 5 : 6.5) * (hasT(P, 'mentor') ? 0.7 : 1);
    } else spawnPB({ x: a.x, y: a.y, a: shotAng, spd: 380, life: 1.1, r: 5, color: col, shape: 'orb', ally: a });
    a.cd = (a.ghost ? 1.2 : 0.9) / (a.rageT > 0 ? 1.6 : 1);
  });
}

// Ditto copia a aparência do Pokémon mais perto (Transformação)
function dittoLook(a, dt) {
  let best = null, bd = 450;
  for (const e of G.enemies) { const dd = Math.hypot(e.x - a.x, e.y - a.y); if (e.hp > 0 && dd < bd && POKE[e.pid] && POKE[e.pid].img) { bd = dd; best = e; } }
  if (best) {
    a.lookT = 4;
    if (a.look !== best.pid) { a.look = best.pid; burst(a.x, a.y, '#c4b5fd', 18); text(a.x, a.y - 30, `Ditto usou Transformação! (${best.p.name})`, '#c4b5fd', 12); }
  } else if (a.look && (a.lookT -= dt) <= 0) { a.look = 0; burst(a.x, a.y, '#c4b5fd', 12); }
}

function petDmg(a) {
  const P = G.P;
  if (a.ghost) return Math.ceil((roll(1, 8) + Math.floor(P.lvl / 2)) * 0.7);
  const p = POKE[a.pid], st = p ? p.stats : {};
  const f = clamp(Math.max(st.attack || 60, st['special-attack'] || 60) / 80, 0.7, 1.7);
  return Math.round((roll(1 + Math.floor(a.lvl / 8), 8) + Math.floor(a.lvl / 2)) * f);
}
function allyHit(e, a, sp) {
  const P = G.P;
  // com vários companheiros fora, cada um bate menos (4 juntos ≈ 2,5× um sozinho)
  const nPets = G.allies.filter(x => x.pet).length;
  let dmg = petDmg(a) * (1 + M(P, 'pet')) * (sp ? 1.5 : 1) * (a.ghost ? 1 : [1, 0.8, 0.7, 0.62][Math.max(0, nPets - 1)] || 0.62);
  if (P.subclass === 'feras') dmg *= 1.5;
  if (P.ferasT > 0) dmg *= 1 + P.ferasK; // Bênção das Feras (Clérigo)
  const ab = !a.ghost && petAbility(a.pid);
  dmg *= abilDmgMul(ab) * hmDmgMul(a.pid);
  const r = typed(P, e, Math.max(1, Math.round(dmg)), a.type, true);
  dealDamage(e, r.dmg);
  hitText(e, r.dmg, r.eff, false, true);
  // habilidade do companheiro (ex.: Canção de Ninar do Jigglypuff faz dormir)
  if (ab && !e.dead && e.hp > 0 && !e.st && Math.random() < ab.ch) { const st = stPick(ab.st); if (st === 2 && a.type === 'electric') e.shockT = G.time + STATUS[2].dur; inflict(e, st); }
}

/* ---------- Captura ---------- */
// A Poké Ball comum perde força com o nível do Pokémon: −2 por nível acima do 11.
// Com o alvo quase sem vida e o herói no mesmo nível: ~45% no Nv 13, ~35% no Nv 14, ~15% no Nv 16 e só 20 natural do Nv 17 em diante.
const POKE_BALL_FREE = 11;
const BALLS = { poke: { nome: 'Poké Ball', icon: '⚪', bonus: 0 }, grande: CONS.grande, ultra: CONS.ultra };
// [C] / LB: troca o companheiro líder pelo próximo que está na Poké Ball (se todos já estão fora, passa a liderança)
function cyclePet() {
  const P = G.P;
  if (!P || G.evo) return;
  if (!P.pets.length) return G.toasts.push({ text: 'Você ainda não tem companheiros. Capture um com a Poké Ball!', color: '#fca5a5', t: 2.5 });
  if ((G.petSwapT || 0) > G.time) return;
  G.petSwapT = G.time + 0.4;
  const bench = P.pets.map((_, i) => i).filter(i => !P.petAct.includes(i));
  if (!P.petAct.length) P.petAct = [bench[0]];
  else if (!bench.length) P.petAct.push(P.petAct.shift());
  else { const cur = P.petAct[0], next = bench.find(i => i > cur); P.petAct[0] = next !== undefined ? next : bench[0]; }
  P.petIdx = P.petAct[0];
  const pt = P.pets[P.petIdx];
  G.toasts.push({ text: `⚪ Vai, ${pt.name}! (Nv ${pt.lvl})`, color: '#86efac', t: 2 });
  sfx('pick');
  G.dirty = true;
  saveGame();
}
// B (controle) / [G]: troca a bola que o F joga (pula as que estão em falta)
function cycleBall() {
  const P = G.P, ks = Object.keys(BALLS), cur = ks.indexOf(P.ballSel || 'poke');
  let k = ks[cur];
  for (let n = 1; n <= ks.length; n++) { const c = ks[(cur + n) % ks.length]; if (ballCount(P, c) > 0) { k = c; break; } }
  if (k === (P.ballSel || 'poke') && ballCount(P, k) <= 0) return G.toasts.push({ text: 'Você está sem Poké Balls.', color: '#fca5a5', t: 2 });
  P.ballSel = k;
  G.toasts.push({ text: `${BALLS[k].icon} F agora joga: ${BALLS[k].nome} (×${ballCount(P, k)})`, color: '#e5e7eb', t: 2 });
  sfx('pick');
  G.dirty = true;
}
const ballCount = (P, k) => (k === 'poke' ? P.balls : P.bag[k] || 0);
function throwBall() {
  const P = G.P;
  let k = P.ballSel || 'poke';
  if (ballCount(P, k) <= 0) k = ['ultra', 'grande', 'poke'].find(b => ballCount(P, b) > 0);
  if (!k) { text(P.x, P.y - 40, 'Sem Poké Balls!', '#fca5a5', 13); return; }
  const mw = mouseWorld();
  let e = null, bd = 1e9;
  if (typeof PAD !== 'undefined' && PAD.on) {
    // no controle a bola usa a mesma faixa da mira assistida dos ataques, com o mesmo alcance do mouse
    const cone = padCone(PAD.rm || 0, true);
    for (const o of G.enemies) {
      const dx = o.x - P.x, dy = o.y - P.y, dist = Math.hypot(dx, dy);
      if (o.hp <= 0 || o.dead || dist > 360) continue;
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - PAD.aim), Math.cos(Math.atan2(dy, dx) - PAD.aim)));
      const sc = da * 300 + dist * 0.3;
      if (da < cone && sc < bd) { bd = sc; e = o; }
    }
  } else for (const o of G.enemies) {
    if (o.hp <= 0) continue;
    const dd = Math.hypot(o.x - mw.x, o.y - mw.y);
    if (dd < o.r + 60 && dd < bd && Math.hypot(o.x - P.x, o.y - P.y) < 360) { bd = dd; e = o; }
  }
  if (!e) { text(P.x, P.y - 40, 'Mire num Pokémon próximo', '#cbd5e1', 12); return; }
  if (e.boss) { text(e.x, e.y - e.h / 2, 'Não pode ser capturado!', '#fca5a5', 13); return; }
  if (k === 'poke') P.balls--; else P.bag[k]--;
  G.dirty = true;
  // rolagem de captura: d20 + nível/2 + bônus da bola contra uma CD que cai com a vida do alvo
  // CD sobe com o nível do Pokémon e com a vida que ainda tem
  const elv = e.lvl || e.zone * 5;
  const dc = 6 + Math.floor(elv * 0.6) + (e.alfa ? 4 : 0) + Math.round(e.hp / e.maxHp * 10) - (e.kind === 4 ? 6 : 0);
  const pen = k === 'poke' ? Math.max(0, elv - POKE_BALL_FREE) * 2 : 0;
  const nat = d(20), total = nat + Math.floor(P.lvl / 2) + (hasT(P, 'domador') ? 4 : 0) + BALLS[k].bonus + M(P, 'cap') - pen;
  const ok = nat === 20 || total >= dc, rollTxt = `${BALLS[k].icon} 🎲 ${nat}${total - nat >= 0 ? '+' : ''}${total - nat} vs CD ${dc}`;
  if (pen && !ok && !G.ballTip) { G.ballTip = 1; G.toasts.push({ text: '⚪ Essa Poké Ball não segurou... será que é forte o bastante?', color: '#fde68a', t: 8 }); }
  // a bola voa em arco até o Pokémon; o resultado sai quando ela chega
  const dist = Math.hypot(e.x - P.x, e.y - P.y);
  G.throws = G.throws || [];
  G.throws.push({ k, e, x0: P.x, y0: P.y - 10, t: 0, dur: clamp(dist / 700, 0.22, 0.5), ok, rollTxt });
  sfx('ui');
}
function updateThrows(dt) {
  if (!G.throws || !G.throws.length) return;
  for (const b of G.throws) {
    b.t += dt;
    if (b.t < b.dur) continue;
    b.done = true;
    const e = b.e;
    if (e.dead || e.hp <= 0 || !G.emap.has(e.id)) { text(e.x, e.y - 20, 'A Poké Ball caiu no chão...', '#cbd5e1', 12); continue; }
    G.fx.push({ k: 'ring', x: e.x, y: e.y, r: 0, R: e.r + 20, life: 0.5, max: 0.5, color: b.k === 'ultra' ? '#facc15' : b.k === 'grande' ? '#60a5fa' : '#f87171' });
    if (b.ok && G.P) capture(e, b.rollTxt, b.k);
    else { text(e.x, e.y - e.h / 2 - 10, `Escapou! (${b.rollTxt.replace(/^\S+ /, '')})`, '#fca5a5', 13); e.flash = 0.2; burst(e.x, e.y, '#f87171', 10); sfx('pick'); }
  }
  G.throws = G.throws.filter(b => !b.done);
}
function drawThrows(ox, oy) {
  if (!G.throws) return;
  for (const b of G.throws) {
    const p = Math.min(1, b.t / b.dur), tx = b.e.x, ty = b.e.y;
    const x = b.x0 + (tx - b.x0) * p + ox, y = b.y0 + (ty - b.y0) * p - Math.sin(p * Math.PI) * 50 + oy;
    const top = b.k === 'ultra' ? '#fbbf24' : b.k === 'grande' ? '#3b82f6' : '#ef4444';
    // sombra no chão
    ctx.beginPath(); ctx.ellipse(b.x0 + (tx - b.x0) * p + ox, b.y0 + (ty - b.y0) * p + oy + 12, 6, 2.5, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(b.t * 18);
    ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI); ctx.fill();
    ctx.fillStyle = top; ctx.beginPath(); ctx.arc(0, 0, 7, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
    ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

function capture(e, rollTxt, k = 'poke') {
  const P = G.P;
  e.hp = 0; e.dead = true;
  const lvl = clamp(e.lvl || e.zone * 5 - 4, 1, 28); // o companheiro vem no nível em que foi capturado
  const mon = { pid: e.pid, name: e.p.name, type: e.type, lvl, xp: 0 };
  dexCatch(P, e.pid);
  const toPC = P.pets.length >= petCap(P);
  if (toPC) { P.box = P.box || []; P.box.push(mon); G.toasts.push({ text: `💻 Equipe cheia: ${e.p.name} foi para o PC. Troque num PC das cidades.`, color: '#93c5fd', t: 4.5 }); }
  else { P.pets.push(mon); if (P.petAct.length < petSlots(P)) { P.petAct.push(P.pets.length - 1); P.petIdx = P.petAct[0]; } }
  loadEvo(e.pid);
  burst(e.x, e.y, '#f87171', 30);
  burst(e.x, e.y, '#ffffff', 20);
  G.toasts.push({ text: `Você capturou ${e.p.name} (Nv ${lvl})! ${rollTxt}`, color: '#86efac', t: 3.5 });
  sfx('lvl');
  if (isHost()) hostRemoveCaptured(e.id);
  else if (NET.host && NET.host.open) NET.host.send({ t: 'cap', id: e.id });
  questProgress('captura', { types: e.p.types, zone: e.zone });
  questProgress('pegar', { pid: e.pid });
  if (e.alfa) questProgress('pegaralfa');
  questProgress('pesquisa', { pid: e.pid, zone: e.zone });
  if (isNight()) questProgress('noturno', { zone: e.zone });
  if (k !== 'poke') questProgress('bolaboa', { zone: e.zone });
  storyCapture(P, e, k);
  G.dirty = true;
  saveGame();
}

function hostRemoveCaptured(id) {
  const e = G.emap.get(id);
  if (!e) return;
  e.dead = true;
  G.emap.delete(id);
  G.enemies = G.enemies.filter(x => x.id !== id);
  if (e.kind === 4) hostEventTargetGone(e, true);
}

/* ---------- Desenho e rede ---------- */
const alliesToNet = () => G.allies.filter(a => !(a.pet && a.slot === G.P.petIdx && (mountPid(G.P) || G.P.wildT > 0))).map(a => [a.look || a.pid, Math.round(a.x), Math.round(a.y), a.ghost ? 1 : 0]);
const pokeLoading = new Set();
function ensurePoke(id) {
  if (POKE[id] || pokeLoading.has(id)) return;
  pokeLoading.add(id);
  loadPokedex([id]).finally(() => { pokeLoading.delete(id); if (G) G.dirty = true; });
}

function drawAlly(pid, wx, wy, ox, oy, ghost, t, face, moving, evolving, lvl) {
  const p = POKE[pid];
  if (!p || !p.img) { ensurePoke(pid); return; }
  const x = wx + ox, y = wy + oy;
  const k = evolving ? 1 + Math.sin(G.time * 18) * 0.15 : 1;
  const w = p.img.width * 1.6 * k, h = p.img.height * 1.6 * k;
  const img = ghost ? ghostImg(p) : evolving && Math.floor(G.time * 8) % 2 ? whiteImg(p) : p.img;
  drawMon(img, p, x, y, w, h, face, t, moving, wx, wy, ghost || petIsFlyer(pid), ghost ? 0.55 : 1);
  if (!ghost) {
    ctx.font = 'bold 10px Barlow Semi Condensed, system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#f87171';
    ctx.fillText(lvl ? `♥ ${lvl}` : '♥', x, y - h / 2 - 4);
  }
}
const ghostImg = p => variantImg(p, 'imgG', (x, im, c) => {
  x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.6; x.fillStyle = '#a78bfa'; x.fillRect(0, 0, c.width, c.height);
});

function petIconUrl(pid) {
  const p = POKE[pid];
  if (!p || !p.img) { ensurePoke(pid); return ''; }
  if (!p.url) { try { p.url = p.img.toDataURL ? p.img.toDataURL() : ''; } catch (e) { p.url = ''; } }
  return p.url;
}

/* ---------- PC (nas cidades): guarda os Pokémon que não cabem na equipe ---------- */
// mexe na equipe mantendo quem está fora da Poké Ball (petAct guarda índices)
function teamEdit(P, fn) {
  const out = P.petAct.map(i => P.pets[i]);
  fn();
  P.petAct = out.map(m => P.pets.indexOf(m)).filter(i => i >= 0).slice(0, petSlots(P));
  // quem saiu estava fora da Poké Ball? o próximo da equipe assume o lugar
  for (let i = 0; i < P.pets.length && P.petAct.length < Math.min(petSlots(P), out.length || 1); i++) if (!P.petAct.includes(i)) P.petAct.push(i);
  P.petIdx = P.petAct.length ? P.petAct[0] : -1;
  G.dirty = true; saveGame();
}
// janela do PC (mesmo visual da Pokédex): clique num cartão para selecionar; com um da equipe e um do PC, troca
function openPC(n) {
  G.pcRef = n; G.pcSelT = -1; G.pcSelB = -1;
  $('pcwin').classList.remove('hidden');
  renderPCWin();
  const P = G.P;
  loadPokedex([...P.pets, ...(P.box || [])].map(m => m.pid)).then(() => { if (!$('pcwin').classList.contains('hidden')) renderPCWin(); });
  sfx('open');
}
function closePC() { $('pcwin').classList.add('hidden'); G.pcRef = null; }
function pcCard(m, attr, sel) {
  if (!m) return `<div class="dexc pcempty" ${attr}><span>vaga livre</span></div>`;
  const p = POKE[m.pid], ty = (p ? p.types : [m.type]).map(t => `<i class="dt" style="background:${TYPE_COLORS[t]}"></i>`).join('');
  return `<div class="dexc pccard ${sel ? 'sel' : ''}" ${attr} title="${esc(m.name)} · Nv ${m.lvl}"><em>Nv ${m.lvl}</em>
    <img src="${petIconUrl(m.pid) || dexIcon(m.pid)}" alt=""><span>${esc(m.name)}</span><div class="dts">${ty}</div></div>`;
}
function renderPCWin() {
  const P = G.P; if (!P) return;
  P.box = P.box || [];
  const cap = petCap(P), tS = G.pcSelT, bS = G.pcSelB, full = P.pets.length >= cap;
  const team = Array.from({ length: cap }, (_, i) => pcCard(P.pets[i], `data-pct="${i}"`, tS === i)).join('');
  const box = P.box.map((m, i) => pcCard(m, `data-pcb="${i}"`, bS === i)).join('');
  const tm = P.pets[tS], bm = P.box[bS];
  let hint = 'Clique num Pokémon da equipe ou do PC para escolher.';
  let btns = '';
  if (tm && bm) { hint = `Trocar <b>${esc(tm.name)}</b> (equipe) por <b>${esc(bm.name)}</b> (PC)?`; btns = '<button data-pca="trocar" class="good">⇄ Trocar</button>'; }
  else if (tm) { hint = `<b>${esc(tm.name)}</b> selecionado. Escolha alguém do PC para trocar, ou guarde no PC.`; btns = `<button data-pca="guardar" ${P.pets.length <= 1 ? 'disabled title="Fique com pelo menos um"' : ''}>⬇ Guardar no PC</button>`; }
  else if (bm) { hint = full ? `<b>${esc(bm.name)}</b> selecionado. A equipe está cheia: escolha quem sai.` : `<b>${esc(bm.name)}</b> selecionado.`; btns = full ? '' : '<button data-pca="pegar" class="good">⬆ Levar para a equipe</button>'; }
  $('pcwin').innerHTML = `<div class="dexhead"><span class="dextitle">💻 PC · Armazenamento</span><button data-pca="x" title="Fechar (Esc)">✕</button></div>
    <h4>Equipe ${P.pets.length}/${cap}</h4><div class="pcteam">${team}</div>
    <div class="pcact"><span>${hint}</span><span>${btns}</span></div>
    <h4>PC · ${P.box.length} Pokémon</h4>
    <div class="dexgrid pcgrid">${box || '<div class="small">O PC está vazio. Quando a equipe estiver cheia, os Pokémon capturados vêm para cá.</div>'}</div>`;
}
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-pct],[data-pcb],[data-pca]');
  if (!t || !G || !G.P || $('pcwin').classList.contains('hidden')) return;
  const P = G.P;
  if (t.dataset.pct !== undefined) { const i = +t.dataset.pct; if (!P.pets[i]) { if (G.pcSelB >= 0) pcAct(P, 'pegar', G.pcSelB); } else G.pcSelT = G.pcSelT === i ? -1 : i; }
  else if (t.dataset.pcb !== undefined) { const i = +t.dataset.pcb; G.pcSelB = G.pcSelB === i ? -1 : i; }
  else if (t.dataset.pca === 'x') return closePC();
  else if (t.dataset.pca === 'guardar') pcAct(P, 'guardar', G.pcSelT);
  else if (t.dataset.pca === 'pegar') pcAct(P, 'pegar', G.pcSelB);
  else if (t.dataset.pca === 'trocar') { G.pcSel = G.pcSelT; pcAct(P, 'pegar', G.pcSelB); }
  sfx('ui');
  renderPCWin();
});
function pcAct(P, act, i) {
  P.box = P.box || [];
  if (act === 'sel') { G.pcSel = G.pcSel === i ? -1 : i; return; }
  if (act === 'guardar') {
    const m = P.pets[i];
    if (!m) return;
    if (P.pets.length <= 1) return G.toasts.push({ text: 'Fique com pelo menos um Pokémon na equipe.', color: '#fca5a5', t: 2.5 });
    teamEdit(P, () => { P.pets.splice(i, 1); P.box.push(m); });
    G.pcSel = -1; G.pcSelT = -1;
    G.toasts.push({ text: `💻 ${m.name} foi guardado no PC.`, color: '#93c5fd', t: 2.5 });
  } else if (act === 'pegar') {
    const m = P.box[i];
    if (!m) return;
    if (P.pets.length < petCap(P)) {
      teamEdit(P, () => { P.box.splice(i, 1); P.pets.push(m); });
      G.toasts.push({ text: `💻 ${m.name} entrou na equipe.`, color: '#86efac', t: 2.5 });
      G.pcSelB = -1;
    } else if (G.pcSel >= 0 && P.pets[G.pcSel]) {
      const out = P.pets[G.pcSel];
      teamEdit(P, () => { P.pets[G.pcSel] = m; P.box[i] = out; });
      G.toasts.push({ text: `💻 Troca feita: ${m.name} entrou, ${out.name} foi para o PC.`, color: '#86efac', t: 3 });
      G.pcSel = -1; G.pcSelT = -1; G.pcSelB = -1;
    } else G.toasts.push({ text: 'Equipe cheia: escolha primeiro quem sai da equipe.', color: '#fca5a5', t: 2.5 });
  }
  loadPokedex([...P.pets, ...P.box].map(m => m.pid)).then(() => { if (!$('pcwin').classList.contains('hidden')) renderPCWin(); });
}
function renderPC(P) {
  P.box = P.box || [];
  if (G.pcSel === undefined) G.pcSel = -1;
  const row = (m, html) => `<div class="pcrow"><img src="${petIconUrl(m.pid) || dexIcon(m.pid)}" alt=""><span>${esc(m.name)} <b>Nv ${m.lvl}</b> ${typeBadge(m.type)}</span>${html}</div>`;
  const full = P.pets.length >= petCap(P);
  return `<p class="fala">"Bem-vindo ao sistema de armazenamento de Pokémon!"</p>
    <h4>Equipe ${P.pets.length}/${petCap(P)}</h4>
    ${P.pets.map((m, i) => row(m, `<span><button data-act="pc:sel:${i}" class="${G.pcSel === i ? 'good' : ''}">${G.pcSel === i ? '✔ Sai da equipe' : 'Trocar'}</button> <button data-act="pc:guardar:${i}">Guardar</button></span>`)).join('')}
    <h4>PC ${P.box.length}</h4>
    ${P.box.length ? `<div class="pcbox">${P.box.map((m, i) => row(m, `<button data-act="pc:pegar:${i}" ${full && G.pcSel < 0 ? 'disabled' : ''}>${full ? (G.pcSel >= 0 ? 'Trocar' : 'Pegar') : 'Pegar'}</button>`)).join('')}</div>` : '<div class="small">O PC está vazio. Quando a equipe estiver cheia, os Pokémon capturados vêm para cá.</div>'}
    <div class="small">${full ? 'Equipe cheia: clique em "Trocar" em quem vai sair e depois em "Trocar" no Pokémon do PC.' : 'Há espaço na equipe: é só pegar.'}</div>`;
}
