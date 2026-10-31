'use strict';
/* ============ Arena PvP ============
 * Uma ilha cercada de penhascos embaixo do mapa (zona 6), com obstáculos simétricos que
 * pedem MOs: lagos fundos (Surfar), arbustos (Corte), rochas rachadas (Esmaga-Rocha),
 * pedras grandes para se cobrir e mato alto para se esconder.
 * No multiplayer, um jogador desafia outros pelo painel; quem aceita é levado à arena.
 * Lá dentro os tiros dos jogadores se acertam. Perder NÃO apaga o personagem:
 * você volta à vila com a vida cheia.
 */
const ARENA_Z = 6, ARENA_W = 50, ARENA_H = 34;
const PVP = { invites: new Map(), rect: null }; // invites: id de quem desafiou -> nome
const inArena = (x, y) => x < DG_BASE - 5000 && zoneAt(x, y) === ARENA_Z;

// chamado por buildWorld (antes de calcular a água): esculpe a arena nas linhas extras de mar
function carveArena() {
  const cxT = Math.floor(((WX0 + WX1) / 2) / TILE) + OX, cyT = Math.floor((WY1 - 2.2 * CELL) / TILE) + OY;
  const x0 = cxT - (ARENA_W >> 1), y0 = cyT - (ARENA_H >> 1);
  PVP.rect = { x0, y0 };
  const set = (i, j, k) => { const t = tIdx(x0 + i, y0 + j); if (t >= 0) { TT[t] = k; TZ[t] = ARENA_Z; } };
  for (let j = 0; j < ARENA_H; j++) for (let i = 0; i < ARENA_W; i++) {
    const edge = i < 2 || j < 2 || i >= ARENA_W - 2 || j >= ARENA_H - 2;
    set(i, j, edge ? TK.CLIFF : TK.GRASS);
  }
  // tudo espelhado entre a esquerda e a direita
  const mir = (i, j, k) => { set(i, j, k); set(ARENA_W - 1 - i, j, k); };
  // lago central fundo (só Surfar atravessa pelo meio) e dois laguinhos
  for (let j = 11; j <= 22; j++) for (let i = 21; i <= 28; i++) if (((i - 24.5) / 4.2) ** 2 + ((j - 16.5) / 6) ** 2 < 1) set(i, j, TK.WATER);
  for (const [ci, cj] of [[12, 6], [12, 27]]) for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 3; i <= ci + 3; i++) if (((i - ci) / 3.2) ** 2 + ((j - cj) / 2.2) ** 2 < 1) mir(i, j, TK.WATER);
  // muros de arbustos (Corte) protegendo as bases
  for (let j = 10; j <= 23; j++) if (j < 15 || j > 18) mir(8, j, TK.CUTTREE);
  for (let i = 15; i <= 19; i++) { mir(i, 4, TK.CUTTREE); mir(i, 29, TK.CUTTREE); }
  // rochas rachadas (Esmaga-Rocha) fechando atalhos
  for (const [i, j] of [[18, 13], [18, 14], [18, 19], [18, 20], [5, 4], [6, 4], [5, 29], [6, 29]]) mir(i, j, TK.CRACKED);
  // pedras grandes para se cobrir
  for (const [i, j] of [[13, 15], [13, 18], [16, 9], [16, 24], [21, 6], [21, 27], [4, 12], [4, 21]]) mir(i, j, TK.BOULDER);
  // mato alto para se esconder
  for (let j = 13; j <= 20; j++) for (let i = 3; i <= 6; i++) if ((i + j) % 3) mir(i, j, TK.TALL);
  for (let j = 7; j <= 9; j++) for (let i = 18; i <= 22; i++) { mir(i, j, TK.TALL); mir(i, j + 17, TK.TALL); }
}
function arenaSpawn(side) {
  const r = PVP.rect, i = side ? ARENA_W - 5 : 4, j = (ARENA_H >> 1) + randi(-2, 2);
  return [(r.x0 + i - OX + 0.5) * TILE, (r.y0 + j - OY + 0.5) * TILE];
}

/* ---------- desafio e entrada ---------- */
function pvpInvite(id) {
  const P = G.P;
  if (!P || !G.remotes.get(id)) return;
  emitEvent({ t: 'pvpinv', to: id, name: P.name });
  G.toasts.push({ text: `⚔ Desafio enviado para ${G.remotes.get(id).name}.`, color: '#fca5a5', t: 3 });
}
function pvpAccept(id) {
  const P = G.P, name = PVP.invites.get(id);
  if (!P || name === undefined) return;
  PVP.invites.clear();
  emitEvent({ t: 'pvpok', a: id, b: NET.myId, name: P.name });
}
function pvpEnter(side, foe) {
  const P = G.P;
  if (!P || !PVP.rect) return;
  if (G.npcOpen) closeNPC();
  P.riding = false; P.surfing = false; G.recall = null;
  const [x, y] = arenaSpawn(side);
  burst(P.x, P.y, '#fca5a5', 24);
  P.x = x; P.y = y; G.cam.x = x; G.cam.y = y;
  P.pvp = { foe, t: 3 }; // 3s de proteção ao chegar
  P.hp = maxHP(P);
  burst(P.x, P.y, '#fca5a5', 24);
  G.toasts.push({ text: `⚔ Arena! Derrote ${foe}. Morrer aqui não apaga o personagem.`, color: '#fca5a5', t: 5, big: 1 });
  sfx('boss');
}
function pvpLeave(lost, by) {
  const P = G.P;
  if (!P) return;
  P.pvp = null;
  P.x = rand(-50, 50); P.y = rand(55, 80); G.cam.x = P.x; G.cam.y = P.y;
  P.hp = maxHP(P);
  if (lost) emitEvent({ t: 'pvpout', name: P.name, by: by || '' });
  G.dirty = true;
}

/* ---------- dano entre jogadores ---------- */
// dano de PvP que vai junto com cada tiro meu (os tiros dos outros chegam como cosméticos)
function pvpShotDmg(P, o) {
  if (!P.pvp) return 0;
  const w = P.equip.arma, sp = o.spell || 0;
  const base = sp === 1 ? roll(1 + Math.floor(P.lvl / 6), 6) + A(P, 'POD') / 2
    : sp ? roll(2 + Math.floor(P.lvl / 4), 8) + A(P, 'POD')
      : roll(w.dice[0], w.dice[1]) + A(P, 'POD') + w.bonus + M(P, 'dmg');
  let dmg = Math.max(1, Math.round(base * 0.6));
  if (P.nextCrit && !sp) { dmg *= 2; P.nextCrit = false; } // Manto do Ladino: o próximo ataque é crítico também no rival
  return dmg;
}
function pvpHitCheck(b) {
  const P = G.P;
  if (!P || !P.pvp || !b.dmg || b.own === NET.myId || P.pvp.t > 0 || P.dodgeT > 0) return false;
  if ((b.x - P.x) ** 2 + (b.y - P.y) ** 2 > (b.r + 10) ** 2) return false;
  let dmg = Math.round(b.dmg * clamp(1 - (AC(P) - 12) * 0.03, 0.5, 1));
  if (P.shield > 0) { const ab = Math.min(P.shield, dmg); P.shield -= ab; dmg -= ab; }
  if (dmg > 0) {
    P.hp -= dmg; P.sinceHit = 0;
    G.shake = Math.min(6, G.shake + 2);
    text(P.x, P.y - 34, `-${dmg}`, '#f87171', 14);
    sfx('hurt');
  }
  if (P.hp <= 0) { const who = G.remotes.get(b.own); pvpLeave(true, who ? who.name : 'um rival'); }
  return true;
}
// áreas de dano do rival (ex.: veneno do Assassino): quem está dentro calcula o próprio dano
function pvpAoeTick(dt) {
  const P = G.P;
  if (!PVP.aoe) return;
  for (const a of PVP.aoe) {
    a.dur -= dt;
    if ((a.wait -= dt) > 0) continue;
    if ((a.tick -= dt) > 0) continue;
    a.tick = 0.5;
    if (!P || !P.pvp || P.pvp.t > 0 || P.dodgeT > 0 || Math.hypot(P.x - a.x, P.y - a.y) > a.r) continue;
    const dmg = Math.round(a.dmg * clamp(1 - (AC(P) - 12) * 0.03, 0.5, 1));
    P.hp -= dmg; P.sinceHit = 0;
    text(P.x, P.y - 34, `-${dmg} ☠`, '#a3e635', 13);
    if (P.hp <= 0) { PVP.aoe = []; pvpLeave(true, a.name); return; }
  }
  PVP.aoe = PVP.aoe.filter(a => a.dur > 0);
}
function pvpTick(dt) {
  const P = G.P;
  pvpAoeTick(dt);
  if (!P) return;
  if (P.pvp) {
    P.pvp.t -= dt;
    if (!inArena(P.x, P.y)) P.pvp = null; // saiu (ex.: [R] voltar à vila)
  }
}

/* ---------- eventos de rede ---------- */
function pvpEvent(m) {
  const P = G.P;
  if (m.t === 'pvpinv') {
    if (m.to !== NET.myId || !P) return;
    PVP.invites.set(m.from, m.name);
    G.toasts.push({ text: `⚔ ${m.name} desafiou você para a arena! Aceite no painel.`, color: '#fca5a5', t: 6, big: 1 });
    sfx('open'); G.dirty = true;
  } else if (m.t === 'pvpok') {
    if (!P) return;
    if (m.a === NET.myId) pvpEnter(0, m.name);
    else if (m.b === NET.myId) { const r = G.remotes.get(m.a); pvpEnter(1, r ? r.name : 'o rival'); }
  } else if (m.t === 'pvpaoe') {
    if (m.from === NET.myId || !P || !P.pvp) return;
    (PVP.aoe = PVP.aoe || []).push({ x: m.x, y: m.y, r: m.r, dur: m.dur, wait: m.wait || 0, dmg: m.dmg, tick: 0, name: m.name });
    G.zones.push({ k: 'veneno', x: m.x, y: m.y, r: m.r, t: m.dur + (m.wait || 0), wait: 99, every: 99, tick: 99, fx: 1 }); // só o desenho da nuvem
  } else if (m.t === 'pvpout') {
    G.toasts.push({ text: m.by ? `🏆 ${m.by} derrotou ${m.name} na arena!` : `${m.name} saiu da arena.`, color: '#facc15', t: 5, big: 1 });
    if (P && P.pvp && m.by === P.name) G.toasts.push({ text: 'Vitória! Use [R] para voltar à vila ou espere outro desafio.', color: '#86efac', t: 5 });
  }
}

// seção do painel (só no multiplayer)
function pvpPanel() {
  const P = G.P;
  if (!P || NET.mode === 'solo') return '';
  const others = [...G.remotes.entries()].filter(([, r]) => r.name && !r.dead);
  let h = '<h4>Arena PvP</h4>';
  if (P.pvp) h += `<button data-pvp="sair" class="savebtn">🏳 Sair da arena (voltar à vila)</button>`;
  else {
    for (const [id, name] of PVP.invites) h += `<div class="shoprow"><span>⚔ ${esc(name)} te desafiou</span><span><button data-pvp="ok:${id}" class="good">Aceitar</button> <button data-pvp="no:${id}">Recusar</button></span></div>`;
    h += others.length ? others.map(([id, r]) => `<div class="shoprow"><span>${esc(r.name)} <i>Nv ${r.lvl || '?'}</i></span><button data-pvp="inv:${id}" title="Convida para um duelo na arena. Morrer lá não apaga o personagem.">Desafiar</button></div>`).join('')
      : '<div class="small">Ninguém mais na sala para desafiar.</div>';
  }
  return h;
}
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-pvp]');
  if (!b || !G || !G.P) return;
  const [act, id] = b.dataset.pvp.split(':');
  if (act === 'inv') pvpInvite(id);
  else if (act === 'ok') pvpAccept(id);
  else if (act === 'no') { PVP.invites.delete(id); }
  else if (act === 'sair') { pvpLeave(true, ''); }
  G.dirty = true;
});
