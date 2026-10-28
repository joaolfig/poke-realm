'use strict';
/* ============ Multiplayer (PeerJS) ============
 * Topologia estrela: o host simula o mundo (inimigos, tiros inimigos, chefes)
 * e envia snapshots a 15 Hz. Cada jogador controla o próprio personagem,
 * calcula os próprios acertos e envia o dano ao host.
 */
const NET = {
  mode: 'solo', peer: null, conns: new Map(), host: null, room: null, myId: 'local', t: 0,
  outB: [], // tiros inimigos criados neste tick (host -> clientes)
  outS: [], // meus tiros cosméticos
  relayS: [], // tiros cosméticos de clientes para repassar
};
const ROOM_PREFIX = 'pokerealm-v1-';
const isHost = () => NET.mode !== 'client';
const netActive = () => NET.mode === 'host' ? NET.conns.size > 0 : NET.mode === 'client';

function randCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

function netHost() {
  return new Promise((res, rej) => {
    if (typeof Peer === 'undefined') return rej(new Error('PeerJS não carregou (verifique a internet).'));
    const code = randCode();
    const peer = new Peer(ROOM_PREFIX + code);
    let opened = false, failed = false;
    const fail = e => { if (opened || failed) return; failed = true; try { peer.destroy(); } catch (x) { /* ignora */ } rej(e); };
    peer.on('open', id => {
      if (failed) return;
      opened = true;
      Object.assign(NET, { peer, mode: 'host', myId: id, room: code });
      res(code);
    });
    peer.on('connection', c => {
      if (!G) { c.close(); return; }
      c.on('open', () => { NET.conns.set(c.peer, c); G.dirty = true; });
      c.on('data', m => hostOnData(c.peer, m));
      c.on('close', () => dropConn(c.peer));
      c.on('error', () => dropConn(c.peer));
    });
    peer.on('error', e => { if (!opened) fail(e); else console.warn('PeerJS:', e); });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignora */ } });
    setTimeout(() => fail(new Error('Tempo esgotado ao contatar o servidor do PeerJS.')), 12000);
  });
}

function netJoin(code) {
  return new Promise((res, rej) => {
    if (typeof Peer === 'undefined') return rej(new Error('PeerJS não carregou (verifique a internet).'));
    code = code.trim().toUpperCase();
    if (!code) return rej(new Error('Digite o código da sala.'));
    const peer = new Peer();
    let done = false, failed = false;
    const fail = e => { if (done || failed) return; failed = true; try { peer.destroy(); } catch (x) { /* ignora */ } rej(e); };
    peer.on('open', id => {
      if (failed) return;
      NET.myId = id;
      const c = peer.connect(ROOM_PREFIX + code, { reliable: true });
      c.on('open', () => {
        if (failed) return;
        done = true;
        Object.assign(NET, { peer, host: c, mode: 'client', room: code });
        res();
      });
      c.on('data', clientOnData);
      c.on('close', hostLost);
      c.on('error', hostLost);
    });
    peer.on('error', e => {
      if (!done) fail(e.type === 'peer-unavailable' ? new Error('Sala não encontrada. Confira o código.') : e);
      else console.warn('PeerJS:', e);
    });
    setTimeout(() => fail(new Error('Não foi possível conectar à sala (tempo esgotado).')), 15000);
  });
}

function dropConn(id) {
  if (!NET.conns.has(id)) return;
  NET.conns.delete(id);
  const r = G.remotes.get(id);
  if (r && r.name) emitEvent({ t: 'chat', sys: 1, text: `${r.name} saiu do reino.` });
  G.remotes.delete(id);
  G.dirty = true;
}

function hostLost() {
  if (NET.mode !== 'client' || NET.lost) return;
  NET.lost = true;
  state = 'lost';
  $('lost').classList.remove('hidden');
}

function netBroadcastExcept(m, except) {
  for (const [id, c] of NET.conns) if (id !== except && c.open) c.send(m);
}

// Evento que todos devem ver: aplica localmente e propaga
function emitEvent(m) {
  m.from = NET.myId;
  handleEvent(m, true);
  if (NET.mode === 'client') { if (NET.host && NET.host.open) NET.host.send(m); }
  else if (NET.mode === 'host') netBroadcastExcept(m, null);
}

function hostOnData(from, m) {
  switch (m.t) {
    case 'p': {
      let r = G.remotes.get(from);
      if (m.dead) { if (r) r.dead = true; break; }
      if (!r) { r = { id: from, x: m.s[0], y: m.s[1], walk: 0 }; G.remotes.set(from, r); }
      const s = m.s;
      Object.assign(r, { name: m.name, cls: m.cls, tx: s[0], ty: s[1], face: s[2], moving: !!s[3], invis: !!s[4], hp: s[5], maxHp: s[6], lvl: s[7], aim: s[8], ptype: s[9] || '', mount: s[10] || 0, allies: m.al || [], dead: false });
      if (m.b) for (const sh of m.b) { addCosmetic(sh); NET.relayS.push([from, ...sh]); }
      break;
    }
    case 'cap':
      hostRemoveCaptured(m.id);
      break;
    case 'story':
      hostStory(m.ch);
      break;
    case 'bounty':
      hostBounty(m);
      break;
    case 'st':
      applyStatus(G.emap.get(m.id), m.st);
      break;
    case 'h': {
      const e = G.emap.get(m.id);
      if (e && !e.dead) { if (m.slow) e.slowT = m.slow; applyHit(e, m.dmg); }
      break;
    }
    case 'chat': case 'heal': case 'fx': case 'drop': case 'bag': case 'buff': case 'cut':
      m.from = from;
      handleEvent(m, false);
      netBroadcastExcept(m, from);
      break;
  }
}

function clientOnData(m) {
  if (!G) return;
  if (m.t === 'snap') {
    const seen = new Set();
    for (const a of m.e) {
      const [id, pid, kind, zone, x, y, hp, st, stat] = a;
      seen.add(id);
      let e = G.emap.get(id);
      if (!e) {
        if (!POKE[pid]) continue;
        e = makeEnemy(id, pid, zone, kind, x, y);
        if (st >= 10) bountyMod(e, st - 10); else if (st) storyMod(e, st);
        G.enemies.push(e); G.emap.set(id, e);
      }
      e.tx = x; e.ty = y;
      if (stat && stat !== e.st && STATUS[stat]) text(e.x, e.y - e.h / 2 - 22, STATUS[stat].label, STATUS[stat].color, 12);
      e.st = stat || 0;
      if (G.time - (e.localHitT || -9) > 0.5) e.hp = hp; else e.hp = Math.min(e.hp, hp);
    }
    for (const e of G.enemies) if (!seen.has(e.id)) { e.gone = true; G.emap.delete(e.id); }
    G.enemies = G.enemies.filter(e => !e.gone);

    const ps = new Set();
    for (const a of m.pl) {
      if (a[0] === NET.myId) continue;
      ps.add(a[0]);
      let r = G.remotes.get(a[0]);
      if (!r) { r = { id: a[0], x: a[3], y: a[4], walk: 0 }; G.remotes.set(a[0], r); G.dirty = true; }
      Object.assign(r, { name: a[1], cls: a[2], tx: a[3], ty: a[4], face: a[5], moving: !!a[6], invis: !!a[7], hp: a[8], maxHp: a[9], lvl: a[10], aim: a[11], ptype: a[12] || '', allies: a[13] || [], mount: a[14] || 0, dead: false });
    }
    for (const id of [...G.remotes.keys()]) if (!ps.has(id)) { G.remotes.delete(id); G.dirty = true; }

    dungeonsFromNet(m.dg, m.po);
    G.evInfo = m.ev || null;
    for (const b of m.b) spawnEB(G.emap.get(b[0]), b);
    for (const s of m.cs) if (s[0] !== NET.myId) addCosmetic(s.slice(1));
    return;
  }
  handleEvent(m, false);
}

function sendSnapshot() {
  const e = G.enemies.map(e => [e.id, e.pid, e.kind, e.zone, Math.round(e.x), Math.round(e.y), Math.max(0, Math.round(e.hp)), e.story || (e.bountyT !== undefined ? 10 + e.bountyT : 0), e.st || 0]);
  const pl = [];
  const P = G.P;
  if (P) pl.push([NET.myId, P.name, P.cls, Math.round(P.x), Math.round(P.y), P.face, P.moving ? 1 : 0, P.invis > 0 ? 1 : 0, Math.round(P.hp), maxHP(P), P.lvl, +P.aim.toFixed(2), myType(P), alliesToNet(), mountPid(P)]);
  for (const r of G.remotes.values()) if (!r.dead && r.name) pl.push([r.id, r.name, r.cls, Math.round(r.tx), Math.round(r.ty), r.face, r.moving ? 1 : 0, r.invis ? 1 : 0, r.hp, r.maxHp, r.lvl, r.aim || 0, r.ptype || '', r.allies || [], r.mount || 0]);
  const cs = NET.outS.map(s => [NET.myId, ...s]).concat(NET.relayS);
  const m = { t: 'snap', e, pl, b: NET.outB, cs, dg: dungeonsToNet(), po: portalsToNet(), ev: G.evInfo };
  for (const c of NET.conns.values()) if (c.open) c.send(m);
  NET.outB = []; NET.outS = []; NET.relayS = [];
}

function sendPlayerState() {
  if (!NET.host || !NET.host.open) return;
  const P = G.P;
  if (!P) { NET.host.send({ t: 'p', dead: 1 }); NET.outS = []; return; }
  const m = { t: 'p', name: P.name, cls: P.cls, s: [Math.round(P.x), Math.round(P.y), P.face, P.moving ? 1 : 0, P.invis > 0 ? 1 : 0, Math.round(P.hp), maxHP(P), P.lvl, +P.aim.toFixed(2), myType(P), mountPid(P)] };
  if (NET.outS.length) m.b = NET.outS;
  if (G.allies.length) m.al = alliesToNet();
  NET.host.send(m);
  NET.outS = [];
}

const myType = P => (P.tempTypeT > 0 ? P.tempType : '');

function netTick(dt) {
  NET.t += dt;
  if (NET.t < 1 / 15) return;
  NET.t = 0;
  if (NET.mode === 'host') {
    if (NET.conns.size) sendSnapshot();
    else { NET.outB = []; NET.outS = []; NET.relayS = []; }
  } else if (NET.mode === 'client') sendPlayerState();
  else NET.outS = [];
}
