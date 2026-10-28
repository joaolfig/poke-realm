'use strict';
/* ============ Companheiros ============
 * P.pets guarda até 4 Pokémon capturados ({ pid, name, type, lvl, xp }); P.petIdx é o ativo.
 * O ativo ganha XP com os abates, sobe de nível e evolui seguindo a cadeia de
 * evolução da PokeAPI. Em tempo de jogo, G.allies tem o ativo e os espíritos do Necromante.
 */
const MAX_PETS = 4, PET_MAX = 30;
const petNeed = l => Math.round(55 * Math.pow(l, 1.75));
const mainType = p => { let t = p.types[0]; if (t === 'normal' && p.types[1]) t = p.types[1]; return t; };
const MOVES = {
  normal: 'Investida', fire: 'Lança-Chamas', water: 'Jato d\'Água', grass: 'Folha Navalha', electric: 'Choque do Trovão', ice: 'Raio de Gelo',
  fighting: 'Golpe Karatê', poison: 'Ácido', ground: 'Tremor', flying: 'Ataque de Asa', psychic: 'Confusão', bug: 'Picada', rock: 'Lançar Rochas',
  ghost: 'Bola Sombria', dragon: 'Fúria do Dragão', dark: 'Mordida', steel: 'Cauda de Ferro', fairy: 'Brilho Mágico',
};

/* ---------- Evolução (PokeAPI: pokemon-species -> evolution-chain) ---------- */
const EVO_KEY = 'pkr_evo_v1';
let EVO = null;
const evoLoading = new Set();
function evoCache() {
  if (!EVO) { try { EVO = JSON.parse(localStorage.getItem(EVO_KEY) || '{}'); } catch (e) { EVO = {}; } }
  return EVO;
}
// guarda, para cada Pokémon, as evoluções possíveis: [[id, nível do companheiro], ...]
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
      return [idOf(c.species.url), clamp(lv, 3, 28)];
    }) : [];
    const classic = opts.filter(o => o[0] <= 809);
    if (classic.length) opts = classic;
    C[pid] = opts;
    try { localStorage.setItem(EVO_KEY, JSON.stringify(C)); } catch (e) { /* cheio */ }
    if (G) G.dirty = true;
  } catch (e) { /* sem internet: tenta de novo depois */ } finally { evoLoading.delete(pid); }
}
function evoLevel(pid) {
  const o = evoCache()[pid];
  if (!o) return undefined;
  return o.length ? Math.min(...o.map(x => x[1])) : 0;
}

function petGainXP(n) {
  const P = G.P, pt = P.pets[P.petIdx];
  if (!pt || pt.lvl >= PET_MAX || !G.allies.some(a => a.pet)) return;
  pt.xp += Math.round(n);
  let up = false;
  while (pt.lvl < PET_MAX && pt.xp >= petNeed(pt.lvl)) { pt.xp -= petNeed(pt.lvl); pt.lvl++; up = true; }
  if (up) {
    const a = G.allies.find(x => x.pet);
    if (a) text(a.x, a.y - 30, `${pt.name} subiu para o Nv ${pt.lvl}!`, '#86efac', 13);
    sfx('pick');
    G.dirty = true;
  }
  checkEvolve(pt);
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

function checkEvolve(pt) {
  if (G.evo) return;
  const opts = evoCache()[pt.pid];
  if (!opts) { loadEvo(pt.pid); return; }
  const ids = opts.filter(o => o[1] <= pt.lvl).map(o => o[0]);
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
  const a = G.allies.find(x => x.pet);
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

/* ---------- Comportamento em jogo ---------- */
function syncPet() {
  const P = G.P;
  const want = P.petIdx >= 0 && P.pets[P.petIdx] ? P.pets[P.petIdx] : null;
  const cur = G.allies.find(a => a.pet);
  if (cur && (!want || cur.pid !== want.pid || cur.slot !== P.petIdx)) G.allies = G.allies.filter(a => a !== cur);
  if (want && !G.allies.some(a => a.pet) && POKE[want.pid]) {
    G.allies.unshift({ pet: true, slot: P.petIdx, pid: want.pid, type: want.type, lvl: want.lvl, x: P.x - 30, y: P.y + 20, cd: 1, spT: 4, t: 0, face: 1 });
  }
  const a = G.allies.find(x => x.pet);
  if (a && want) a.lvl = want.lvl;
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
  const n = G.allies.length, feras = P.subclass === 'feras';
  G.allies.forEach((a, i) => {
    a.t += dt;
    const ang = P.aim + Math.PI + (i - (n - 1) / 2) * 0.8;
    const tx = P.x + Math.cos(ang) * 46, ty = P.y + Math.sin(ang) * 46;
    const k = Math.min(1, dt * 6);
    const ox = a.x;
    a.x += (tx - a.x) * k; a.y += (ty - a.y) * k;
    if (Math.hypot(a.x - P.x, a.y - P.y) > 400 || !walkable(a.x, a.y)) { a.x = P.x; a.y = P.y; }
    a.moving = Math.abs(a.x - ox) > 0.3;
    if (a.pet && a.pid === 132) dittoLook(a, dt);
    if (a.pet && (P.riding || P.surfing)) { a.x = P.x; a.y = P.y; return; } // está carregando o jogador
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
      a.spT = a.lvl >= 15 ? 5 : 6.5;
    } else spawnPB({ x: a.x, y: a.y, a: shotAng, spd: 380, life: 1.1, r: 5, color: col, shape: 'orb', ally: a });
    a.cd = (a.ghost ? 1.2 : 0.9) / (feras ? 1.5 : 1);
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
  let dmg = petDmg(a) * (1 + M(P, 'pet')) * (sp ? 1.5 : 1);
  if (P.subclass === 'feras') dmg *= 2;
  const r = typed(P, e, Math.max(1, Math.round(dmg)), a.type);
  dealDamage(e, r.dmg);
  hitText(e, r.dmg, r.eff, false, true);
  // habilidade do companheiro (ex.: Canção de Ninar do Jigglypuff faz dormir)
  const ab = !a.ghost && petAbility(a.pid);
  if (ab && !e.dead && e.hp > 0 && !e.st && Math.random() < ab.ch) inflict(e, ab.st);
}

/* ---------- Captura ---------- */
const BALLS = { poke: { nome: 'Pokébola', icon: '⚪', bonus: 0 }, grande: CONS.grande, ultra: CONS.ultra };
const ballCount = (P, k) => (k === 'poke' ? P.balls : P.bag[k] || 0);
function throwBall() {
  const P = G.P;
  let k = P.ballSel || 'poke';
  if (ballCount(P, k) <= 0) k = ['ultra', 'grande', 'poke'].find(b => ballCount(P, b) > 0);
  if (!k) { text(P.x, P.y - 40, 'Sem Pokébolas!', '#fca5a5', 13); return; }
  const mw = mouseWorld();
  let e = null, bd = 1e9;
  for (const o of G.enemies) {
    if (o.hp <= 0) continue;
    const dd = Math.hypot(o.x - mw.x, o.y - mw.y);
    if (dd < o.r + 60 && dd < bd && Math.hypot(o.x - P.x, o.y - P.y) < 360) { bd = dd; e = o; }
  }
  if (!e) { text(P.x, P.y - 40, 'Mire num Pokémon próximo', '#cbd5e1', 12); return; }
  if (e.boss) { text(e.x, e.y - e.h / 2, 'Não pode ser capturado!', '#fca5a5', 13); return; }
  if (P.pets.length >= MAX_PETS) { G.toasts.push({ text: `Você já tem ${MAX_PETS} companheiros. Solte um no painel (botão direito duas vezes).`, color: '#fca5a5', t: 3 }); return; }
  if (k === 'poke') P.balls--; else P.bag[k]--;
  G.dirty = true;
  // rolagem de captura: d20 + nível/2 + bônus da bola contra uma CD que cai com a vida do alvo
  const dc = 8 + e.zone * 2 + (e.alfa ? 4 : 0) + Math.round(e.hp / e.maxHp * 10) - (e.kind === 4 ? 6 : 0);
  const nat = d(20), total = nat + Math.floor(P.lvl / 2) + (hasT(P, 'domador') ? 4 : 0) + BALLS[k].bonus + M(P, 'cap');
  G.fx.push({ k: 'ring', x: e.x, y: e.y, r: 0, R: e.r + 20, life: 0.5, max: 0.5, color: k === 'ultra' ? '#facc15' : k === 'grande' ? '#60a5fa' : '#f87171' });
  if (nat === 20 || total >= dc) capture(e, `${BALLS[k].icon} 🎲 ${nat}+${total - nat} vs CD ${dc}`);
  else {
    text(e.x, e.y - e.h / 2 - 10, `Escapou! (🎲 ${nat}+${total - nat} vs CD ${dc})`, '#fca5a5', 13);
    e.flash = 0.2;
  }
  sfx('pick');
}

function capture(e, rollTxt) {
  const P = G.P;
  e.hp = 0; e.dead = true;
  const lvl = clamp(e.zone * 4 - 3 + randi(0, 2) + (e.alfa ? 3 : 0) + (e.kind === 4 ? 2 : 0), 1, 25);
  P.pets.push({ pid: e.pid, name: e.p.name, type: e.type, lvl, xp: 0 });
  if (P.petIdx < 0) P.petIdx = P.pets.length - 1;
  loadEvo(e.pid);
  burst(e.x, e.y, '#f87171', 30);
  burst(e.x, e.y, '#ffffff', 20);
  G.toasts.push({ text: `Você capturou ${e.p.name} (Nv ${lvl})! ${rollTxt}`, color: '#86efac', t: 3.5 });
  sfx('lvl');
  if (isHost()) hostRemoveCaptured(e.id);
  else if (NET.host && NET.host.open) NET.host.send({ t: 'cap', id: e.id });
  questProgress('captura', { types: e.p.types, zone: e.zone });
  questProgress('pegar', { pid: e.pid });
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
const alliesToNet = () => G.allies.filter(a => !(a.pet && mountPid(G.P))).map(a => [a.look || a.pid, Math.round(a.x), Math.round(a.y), a.ghost ? 1 : 0]);
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
    ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#f87171';
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
