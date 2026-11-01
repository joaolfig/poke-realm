'use strict';
/* ============ Celular (toque) ============
 * Liga sozinho em aparelhos de toque (ponteiro principal "grosso"); ?mobile=1 / ?mobile=0 força.
 * Nada aqui roda no PC: todas as funções saem logo se MOBILE for falso.
 * Os comandos viram as mesmas ações do teclado/controle (keyTap, useAbility, throwBall...),
 * então quem joga no celular joga junto com quem está no PC ou no controle, na mesma sala.
 *  - analógico esquerdo (aparece onde o polegar encosta): andar
 *  - tiro sempre ligado, mirando sozinho (o mais perto; Alfas e chefes têm preferência)
 *  - analógico direito (área livre à direita): escolhe a direção/alvo; a mira trava no Pokémon
 *  - tocar num Pokémon também trava a mira nele
 *  - botões: ⭐ especial, 💨 rolamento, ⚪ captura (arrastar = mirar), 💬 interagir, 🧪 poção, ☰ painel, ⋯ menu
 */
const MOBILE = (() => {
  const q = /[?&]mobile=([01])/.exec(location.search);
  if (q) return q[1] === '1';
  try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; }
})();
const TCH = { ptr: new Map(), lock: null, tgt: null, stickL: null, stickR: null, abil: null, dash: null, cap: null, ui: 0 };
const T_RANGE = 480, T_CONE = 0.44; // alcance da mira automática; cone de ~25° do analógico direito
const T_DRAG = 90, T_DEAD = 18;      // arrasto máximo dos botões (px) e zona morta (voltar ao centro cancela)

function touchSetup() {
  if (!MOBILE) return;
  document.body.classList.add('mobile');
  const vp = document.querySelector('meta[name=viewport]');
  if (vp) vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  const L = document.createElement('div');
  L.id = 'touch';
  L.innerHTML = `
    <div id="t-stickL" class="tstick hidden"><div class="tknob"></div></div>
    <div id="t-stickR" class="tstick hidden"><div class="tknob"></div></div>
    <div class="tbtns">
      <button id="t-act" class="tb tb-act hidden" data-t="act">💬</button>
      <button id="t-pot" class="tb tb-pot" data-t="pot">🧪<i></i></button>
      <button id="t-cap" class="tb tb-cap" data-t="cap">⚪<i></i></button>
      <button id="t-dash" class="tb tb-dash hidden" data-t="dash">💨</button>
      <button id="t-abil" class="tb tb-abil" data-t="abil">⭐</button>
    </div>
    <div class="ttop"><button class="tb tb-sm" data-t="more">⋯</button><button class="tb tb-sm" data-t="panel">☰</button></div>
    <div id="t-more" class="hidden">
      <button data-k="KeyV">🕊️ Fly</button><button data-k="KeyR">🏠 Voltar à cidade</button><button data-k="KeyX">🐎 Montar</button>
      <button data-k="KeyC">🔄 Trocar Pokémon</button><button data-k="KeyG">⚪ Trocar bola</button><button data-k="Digit3">💎 Cristal</button>
      <button data-k="KeyZ">🪶 Talismã (fuga)</button><button data-k="KeyB">⬆ Equipar o melhor</button><button data-k="KeyM">🗺️ Mapa</button>
      <button data-k="KeyP">📖 Pokédex</button><button data-k="KeyL">📜 Avisos</button><button data-k="Enter">💬 Chat</button><button data-k="KeyN">🔊 Som</button>
    </div>`;
  document.body.appendChild(L);
  const rot = document.createElement('div');
  rot.id = 'rotate'; rot.innerHTML = '<div>📱↻<br>Gire o aparelho<br><span>O jogo é jogado deitado</span></div>';
  document.body.appendChild(rot);
  L.addEventListener('pointerdown', tDown, { passive: false });
  window.addEventListener('pointermove', tMove, { passive: false });
  window.addEventListener('pointerup', tUp);
  window.addEventListener('pointercancel', tUp);
  $('t-more').addEventListener('click', ev => {
    const b = ev.target.closest('[data-k]');
    if (!b) return;
    $('t-more').classList.add('hidden');
    keyTap(b.dataset.k);
  });
  // sem menu do navegador no toque longo, sem zoom de dois dedos
  L.addEventListener('contextmenu', ev => ev.preventDefault());
  document.addEventListener('gesturestart', ev => ev.preventDefault());
  // tela cheia e paisagem no primeiro toque (quando o navegador deixa)
  const fs = () => {
    const d = document.documentElement;
    if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignora */ } }).catch(() => {});
  };
  document.addEventListener('pointerup', fs, { once: true });
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();
}

// tela -> mundo e mundo -> tela (o canvas é encolhido por VIEW_K no celular)
const tWorld = (cx, cy) => ({ x: cx / VIEW_K - W / 2 + G.cam.x, y: cy / VIEW_K - H / 2 + G.cam.y });
const tScreen = (x, y) => ({ x: x - G.cam.x + W / 2, y: y - G.cam.y + H / 2 });
const tPlaying = () => state === 'play' && G && G.P && !G.npcOpen;
const tAlive = e => e && (e.remote ? !e.dead : e.hp > 0 && !e.dead && G.emap.has(e.id));

// alvos possíveis: Pokémon vivos e, na arena PvP, os outros jogadores
function tPool() {
  const P = G.P, pool = G.enemies.filter(e => e.hp > 0 && !e.dead);
  if (P.pvp) for (const r of G.remotes.values()) if (r.name && !r.dead && !r.invis) pool.push(r);
  return pool;
}
// mira automática: o mais perto, com Alfas e chefes preferidos quando estão a distância parecida
function tAutoTarget() {
  const P = G.P;
  let best = null, bs = 1e9;
  for (const e of tPool()) {
    const d = Math.hypot(e.x - P.x, e.y - P.y);
    if (d > T_RANGE) continue;
    const sc = d - (e.alfa || e.boss ? 140 : 0) - (e === TCH.tgt ? 40 : 0);
    if (sc < bs) { bs = sc; best = e; }
  }
  return best;
}
// o melhor alvo numa direção (analógico direito / arrastar a captura)
function tConeTarget(ang, cone, range, pool) {
  const P = G.P;
  let best = null, bs = 1e9;
  for (const e of pool) {
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
    if (d > range || d < 1) continue;
    const da = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - ang), Math.cos(Math.atan2(dy, dx) - ang)));
    if (da > cone) continue;
    const sc = da * 300 + d * 0.5;
    if (sc < bs) { bs = sc; best = e; }
  }
  return best;
}

/* ---------- captura: o Pokémon mais fácil de pegar e a bola certa ---------- */
const tCatchable = () => G.enemies.filter(e => e.hp > 0 && !e.dead && !e.boss && Math.hypot(e.x - G.P.x, e.y - G.P.y) < 340);
// a bola mais barata que já dá boa chance (≥ 60%); se nenhuma dá, a melhor que houver
function tBestBall(e) {
  const P = G.P, have = ['poke', 'grande', 'ultra'].filter(k => ballCount(P, k) > 0);
  if (!have.length) return null;
  const odds = have.map(k => ({ k, c: catchRoll(P, e, k).chance }));
  return odds.find(o => o.c >= 0.6) || odds.reduce((a, b) => (b.c > a.c ? b : a));
}
function tCatchPick() {
  const list = tCatchable();
  if (TCH.lock && list.includes(TCH.lock)) return TCH.lock;
  let best = null, bs = -1;
  for (const e of list) { const o = tBestBall(e), sc = (o ? o.c : 0) - Math.hypot(e.x - G.P.x, e.y - G.P.y) / 3000; if (sc > bs) { bs = sc; best = e; } }
  return best;
}

/* ---------- entrada ---------- */
function tDown(ev) {
  if (!MOBILE) return;
  const b = ev.target.closest('[data-t]');
  if (ev.target.closest('#t-more')) return; // botões do menu ⋯ (clique normal)
  ev.preventDefault();
  const x = ev.clientX, y = ev.clientY;
  if (document.body.classList.contains('drawer') && !b) { document.body.classList.remove('drawer'); return; }
  if (!$('t-more').classList.contains('hidden') && !(b && b.dataset.t === 'more')) { $('t-more').classList.add('hidden'); if (!b) return; }
  try { ev.target.setPointerCapture(ev.pointerId); } catch (e) { /* ignora */ }
  if (b) {
    const t = b.dataset.t, o = { kind: t, x0: x, y0: y, dx: 0, dy: 0, max: 0, el: b };
    if (t === 'panel') { document.body.classList.toggle('drawer'); TCH.stickL = null; for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) K[k] = false; return; }
    if (t === 'more') { $('t-more').classList.toggle('hidden'); return; }
    if (t === 'act') { keyTap('KeyE'); return; }
    if (t === 'pot') { keyTap('KeyQ'); return; }
    TCH.ptr.set(ev.pointerId, o); b.classList.add('on');
    if (t === 'abil') TCH.abil = o; else if (t === 'dash') TCH.dash = o; else if (t === 'cap') TCH.cap = o;
    return;
  }
  if (!tPlaying()) return;
  // metade esquerda: analógico de andar (nasce onde o dedo encostou)
  if (x < window.innerWidth * 0.45 && !TCH.stickL) {
    const o = { kind: 'L', x0: x, y0: y, dx: 0, dy: 0 };
    TCH.ptr.set(ev.pointerId, o); TCH.stickL = o; tStickEl('t-stickL', o);
    return;
  }
  // lado direito: tocou num Pokémon = trava a mira nele; senão vira o analógico de mirar
  const w = tWorld(x, y);
  let hit = null, hd = 1e9;
  for (const e of tPool()) { const d = Math.hypot(e.x - w.x, e.y - w.y); if (d < (e.r || 14) + 28 && d < hd) { hd = d; hit = e; } }
  if (hit) { TCH.lock = hit; return; }
  if (!TCH.stickR) { const o = { kind: 'R', x0: x, y0: y, dx: 0, dy: 0 }; TCH.ptr.set(ev.pointerId, o); TCH.stickR = o; tStickEl('t-stickR', o); }
}
function tMove(ev) {
  const o = TCH.ptr.get(ev.pointerId);
  if (!o) return;
  ev.preventDefault();
  let dx = ev.clientX - o.x0, dy = ev.clientY - o.y0;
  const m = Math.hypot(dx, dy), R = o.kind === 'L' || o.kind === 'R' ? 50 : T_DRAG;
  if (m > R) { dx *= R / m; dy *= R / m; }
  o.dx = dx; o.dy = dy; o.max = Math.max(o.max || 0, m);
  if (o.kind === 'L' || o.kind === 'R') tStickEl(o.kind === 'L' ? 't-stickL' : 't-stickR', o);
}
function tUp(ev) {
  const o = TCH.ptr.get(ev.pointerId);
  if (!o) return;
  TCH.ptr.delete(ev.pointerId);
  if (o.el) o.el.classList.remove('on');
  const m = Math.hypot(o.dx, o.dy), drag = o.max > T_DEAD;
  if (o.kind === 'L') { TCH.stickL = null; $('t-stickL').classList.add('hidden'); for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) K[k] = false; }
  else if (o.kind === 'R') { TCH.stickR = null; $('t-stickR').classList.add('hidden'); }
  else if (o.kind === 'abil') {
    TCH.abil = null;
    if (!tPlaying()) return;
    if (!drag) keyTap('Space'); // toque: no alvo da mira automática
    else if (m > T_DEAD) tWithAim(tDragPoint(o, 380), () => keyTap('Space'));
    // arrastou e voltou ao centro: cancelou
  } else if (o.kind === 'dash') {
    TCH.dash = null;
    if (!tPlaying()) return;
    const P = G.P, had = P.dashCd;
    doDash();
    if (drag && m > T_DEAD && P.dash && !had) P.dash.a = Math.atan2(o.dy, o.dx);
  } else if (o.kind === 'cap') {
    const e = TCH.capE;
    TCH.cap = null; TCH.capE = null;
    if (!tPlaying() || (drag && m <= T_DEAD)) return;
    if (!e) { text(G.P.x, G.P.y - 40, tCatchable().length ? 'Sem Poké Balls!' : 'Nenhum Pokémon perto para capturar', '#cbd5e1', 12); return; }
    const ball = tBestBall(e);
    throwBall(e, ball && ball.k);
  }
}
function tStickEl(id, o) {
  const el = $(id);
  el.classList.remove('hidden');
  el.style.left = o.x0 + 'px'; el.style.top = o.y0 + 'px';
  el.firstElementChild.style.transform = `translate(${o.dx}px, ${o.dy}px)`;
}
// ponto no mundo para onde um botão foi arrastado (arrasto máximo = alcance)
function tDragPoint(o, range) {
  const P = G.P, m = Math.hypot(o.dx, o.dy), k = clamp((m - T_DEAD) / (T_DRAG - T_DEAD), 0, 1) * range;
  return { x: P.x + o.dx / (m || 1) * k, y: P.y + o.dy / (m || 1) * k };
}
// mira por um instante num ponto do mundo (o especial lê o cursor e P.aim)
function tWithAim(p, fn) {
  const P = G.P, s = tScreen(p.x, p.y);
  mouse.x = s.x; mouse.y = s.y; P.aim = Math.atan2(p.y - P.y, p.x - P.x);
  fn();
}

/* ---------- a cada quadro ---------- */
function touchTick(dt) {
  if (!MOBILE || !G || !G.P || state !== 'play') { if (MOBILE) mouse.down = false; return; }
  const P = G.P;
  // andar
  const L = TCH.stickL;
  if (L && !G.npcOpen) {
    const m = Math.hypot(L.dx, L.dy) / 50, a = Math.atan2(L.dy, L.dx);
    const on = m > 0.3, cx = Math.cos(a), cy = Math.sin(a);
    K.KeyA = on && cx < -0.38; K.KeyD = on && cx > 0.38; K.KeyW = on && cy < -0.38; K.KeyS = on && cy > 0.38;
  }
  // alvo: travado (até cair ou ficar longe) > analógico direito > automático
  if (TCH.lock && (!tAlive(TCH.lock) || Math.hypot(TCH.lock.x - P.x, TCH.lock.y - P.y) > 620)) TCH.lock = null;
  const R = TCH.stickR, rm = R ? Math.hypot(R.dx, R.dy) / 50 : 0;
  let aimA = null;
  if (R && rm > 0.3) {
    aimA = Math.atan2(R.dy, R.dx);
    const t = tConeTarget(aimA, T_CONE, 560, tPool());
    if (t) TCH.lock = t;
  }
  const t = TCH.lock || (aimA === null ? tAutoTarget() : null);
  TCH.tgt = t;
  // o especial e o rolamento sendo arrastados mostram para onde vão; a captura escolhe o alvo pela direção
  if (TCH.cap) {
    const o = TCH.cap;
    TCH.capE = o.max > T_DEAD ? (Math.hypot(o.dx, o.dy) > T_DEAD ? tConeTarget(Math.atan2(o.dy, o.dx), 0.6, 340, tCatchable()) : null) : tCatchPick();
  }
  const ab = TCH.abil;
  if (ab && ab.max > T_DEAD && Math.hypot(ab.dx, ab.dy) > T_DEAD) { const p = tDragPoint(ab, 380), s = tScreen(p.x, p.y); mouse.x = s.x; mouse.y = s.y; }
  else if (t) { const s = tScreen(t.x, t.y); mouse.x = s.x; mouse.y = s.y; }
  else if (aimA !== null) { mouse.x = W / 2 + Math.cos(aimA) * 200 + (P.x - G.cam.x); mouse.y = H / 2 + Math.sin(aimA) * 200 + (P.y - G.cam.y); }
  // tiro sempre ligado quando há alvo (ou mirando com o analógico); nunca dentro da vila nem com janela aberta
  const safe = !inDungeonArea(P.x) && inTown(P.x, P.y);
  // segurando a captura o tiro pausa (para não derrubar o Pokémon que você quer pegar)
  mouse.down = !!(t || aimA !== null) && !G.npcOpen && !safe && !TCH.cap;
  // botões: só o que faz sentido agora (atualiza 5×/s)
  TCH.ui -= dt;
  if (TCH.ui <= 0) { TCH.ui = 0.2; tButtons(P); }
}
function tButtons(P) {
  const near = G.npcOpen ? '' : nearDgChest(P) || nearXChest(P) || nearMoonChest(P) ? '🎁' : G.nearPortal ? '🌀' : G.nearNPC ? '💬' : G.nearHM ? '✋' : '';
  const act = $('t-act');
  act.classList.toggle('hidden', !near);
  if (near && act.firstChild.nodeValue !== near) act.firstChild.nodeValue = near;
  $('t-dash').classList.toggle('hidden', !hasT(P, 'esquiva'));
  const cd = (el, f) => el.style.setProperty('--cd', Math.round(clamp(f, 0, 1) * 360) + 'deg');
  cd($('t-abil'), P.abilCd / Math.max(0.1, abilCd(P)));
  cd($('t-dash'), (P.dashCd || 0) / 3);
  $('t-pot').lastChild.textContent = P.pots.hp;
  $('t-cap').lastChild.textContent = P.balls + (P.bag.grande || 0) + (P.bag.ultra || 0);
}

// desenho sobre o mapa: alvo travado/automático, onde o especial cai e o alvo da captura com a chance
function drawTouch() {
  if (!MOBILE || !G || !G.P || state !== 'play') return;
  const P = G.P, corners = (e, col, R) => {
    const s = tScreen(e.x, e.y), k = 8;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.moveTo(s.x + sx * R, s.y + sy * (R - k)); ctx.lineTo(s.x + sx * R, s.y + sy * R); ctx.lineTo(s.x + sx * (R - k), s.y + sy * R); }
    ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke(); ctx.lineCap = 'butt';
  };
  if (TCH.tgt && tAlive(TCH.tgt)) corners(TCH.tgt, TCH.lock ? '#ff5a4a' : '#ffe14a', (TCH.tgt.r || 14) + 10);
  const ab = TCH.abil;
  if (ab && ab.max > T_DEAD) {
    const cancel = Math.hypot(ab.dx, ab.dy) <= T_DEAD;
    const p = tDragPoint(ab, 380), s = tScreen(p.x, p.y), ps = tScreen(P.x, P.y);
    ctx.strokeStyle = cancel ? 'rgba(248,113,113,.9)' : 'rgba(255,225,74,.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(s.x, s.y, 26, 0, 7); ctx.stroke();
    if (cancel) { ctx.font = 'bold 14px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fca5a5'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; outlined('solte para cancelar', ps.x - 50, ps.y - 50); }
  }
  const dh = TCH.dash;
  if (dh && dh.max > T_DEAD && Math.hypot(dh.dx, dh.dy) > T_DEAD) {
    const ps = tScreen(P.x, P.y), a = Math.atan2(dh.dy, dh.dx);
    ctx.strokeStyle = 'rgba(147,197,253,.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.lineTo(ps.x + Math.cos(a) * 140, ps.y + Math.sin(a) * 140); ctx.stroke();
  }
  if (TCH.cap) {
    const e = TCH.capE;
    if (e && tAlive(e)) {
      const s = tScreen(e.x, e.y), o = tBestBall(e);
      ctx.strokeStyle = '#f87171'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, (e.r || 14) + 16, 0, 7); ctx.stroke();
      if (o) { ctx.font = 'bold 15px Barlow Semi Condensed, system-ui'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; outlined(`${BALLS[o.k].icon} ${Math.round(o.c * 100)}%`, s.x - 22, s.y - (e.r || 14) - 24); }
    }
  }
}

touchSetup();
