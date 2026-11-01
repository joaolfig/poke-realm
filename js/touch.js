'use strict';
/* ============ Celular (toque) ============
 * Liga sozinho em aparelhos de toque (ponteiro principal "grosso"); ?mobile=1 / ?mobile=0 força.
 * Nada aqui roda no PC: todas as funções saem logo se MOBILE for falso.
 * Os comandos viram as mesmas ações do teclado/controle (keyTap, useAbility, throwBall...),
 * então quem joga no celular joga junto com quem está no PC ou no controle, na mesma sala.
 *  - analógico esquerdo (aparece onde o polegar encosta): andar
 *  - mira automática (opção, ligada por padrão): atira sozinho no mais perto (Alfas e chefes têm preferência)
 *  - analógico direito (área livre à direita): mira livre, para onde você quiser, com uma ajuda leve
 *    (como no controle); soltar volta para a mira automática
 *  - tocar num Pokémon trava a mira nele (tocar de novo, ou tocar no chão, destrava)
 *  - botões: ⭐ especial, 💨 rolamento, ⚪ captura (arrastar = mirar), 💬 interagir, 🧪 poção, ☰ painel, ⋯ menu
 */
const MOBILE = (() => {
  const q = /[?&]mobile=([01])/.exec(location.search);
  if (q) return q[1] === '1';
  try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; }
})();
const TCH = { ptr: new Map(), lock: null, tgt: null, stickL: null, stickR: null, abil: null, dash: null, cap: null, ui: 0 };
const T_RANGE = 480, T_CONE = 0.21; // alcance da mira automática; cone de ~12° da ajuda do analógico direito
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
      <button id="t-act" class="tb tb-act hidden" data-t="act" aria-label="Interagir">💬</button>
      <button id="t-pot" class="tb tb-pot" data-t="pot" aria-label="Poção">🧪<i></i></button>
      <button id="t-cap" class="tb tb-cap" data-t="cap" aria-label="Capturar (arraste para escolher)">⚪<i></i></button>
      <button id="t-dash" class="tb tb-dash hidden" data-t="dash" aria-label="Rolamento">💨</button>
      <button id="t-abil" class="tb tb-abil" data-t="abil" aria-label="Especial (arraste para mirar)">⭐</button>
    </div>
    <div class="ttop"><button class="tb tb-sm" data-t="more" aria-label="Mais ações">⋯</button><button id="t-menu" class="tb tb-sm" data-t="panel" aria-label="Painel do herói">☰</button><button id="t-eq" class="tb tb-sm tb-eq hidden" data-t="eq" aria-label="Equipar o melhor">⬆</button></div>
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
    if (t === 'eq') { keyTap('KeyB'); return; }
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
  if (hit) { TCH.lock = TCH.lock === hit ? null : hit; tBuzz(12); return; }
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
  else if (o.kind === 'R') { TCH.stickR = null; $('t-stickR').classList.add('hidden'); if (!drag) TCH.lock = null; } // toque no chão: destrava
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

const tBuzz = ms => { if (OPTS.vibra !== false && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignora */ } };

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
  // mira: analógico direito (livre) > Pokémon travado com um toque > automática (se ligada)
  if (TCH.lock && (!tAlive(TCH.lock) || Math.hypot(TCH.lock.x - P.x, TCH.lock.y - P.y) > 620)) TCH.lock = null;
  const R = TCH.stickR, rm = R ? Math.min(1, Math.hypot(R.dx, R.dy) / 50) : 0;
  let aimA = null;
  if (R && rm > 0.3) { aimA = Math.atan2(R.dy, R.dx); TCH.lock = null; }
  const t = aimA === null ? TCH.lock || (OPTS.autoAim !== false ? tAutoTarget() : null) : null;
  TCH.tgt = t; TCH.aimA = aimA; TCH.assist = null;
  // o especial e o rolamento sendo arrastados mostram para onde vão; a captura escolhe o alvo pela direção
  if (TCH.cap) {
    const o = TCH.cap;
    TCH.capE = o.max > T_DEAD ? (Math.hypot(o.dx, o.dy) > T_DEAD ? tConeTarget(Math.atan2(o.dy, o.dx), 0.6, 340, tCatchable()) : null) : tCatchPick();
  }
  const ab = TCH.abil;
  if (ab && ab.max > T_DEAD && Math.hypot(ab.dx, ab.dy) > T_DEAD) { const p = tDragPoint(ab, 380), s = tScreen(p.x, p.y); mouse.x = s.x; mouse.y = s.y; }
  else if (t) { const s = tScreen(t.x, t.y); mouse.x = s.x; mouse.y = s.y; }
  else if (aimA !== null) {
    // mira livre com ajuda leve (como no controle): um Pokémon a até ~12° da direção puxa a mira metade do caminho
    let fa = aimA, fr = 110 + rm * 110;
    const n = tConeTarget(aimA, T_CONE, 520, tPool());
    if (n) { const ta = Math.atan2(n.y - P.y, n.x - P.x); fa = aimA + Math.atan2(Math.sin(ta - aimA), Math.cos(ta - aimA)) * 0.5; fr = Math.hypot(n.x - P.x, n.y - P.y); TCH.assist = n; }
    const s = tScreen(P.x + Math.cos(fa) * fr, P.y + Math.sin(fa) * fr); mouse.x = s.x; mouse.y = s.y;
  }
  // tiro sempre ligado quando há alvo (ou mirando com o analógico); nunca dentro da vila nem com janela aberta
  const safe = !inDungeonArea(P.x) && inTown(P.x, P.y);
  // segurando a captura o tiro pausa (para não derrubar o Pokémon que você quer pegar)
  mouse.down = !!(t || aimA !== null) && !G.npcOpen && !safe && !TCH.cap;
  // vibra de leve ao levar dano (dá para desligar nas opções)
  if (TCH.hp !== undefined && P.hp < TCH.hp - 0.5) tBuzz(P.hp < maxHP(P) * 0.3 ? 45 : 20);
  TCH.hp = P.hp;
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
  // ☰ ganha um selo quando há algo para resolver no painel; ⬆ aparece quando há equipamento melhor na mochila
  $('t-eq').classList.toggle('hidden', !bestSwaps(P).length);
  $('t-menu').classList.toggle('badge', !!(P.talentOffer || P.talentPending > 0 || P.points > 0));
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
  if (TCH.aimA !== null && TCH.aimA !== undefined) {
    // mirando com o analógico: linha até a mira e a mira (igual à do controle)
    const ps = tScreen(P.x, P.y), x = mouse.x, y = mouse.y;
    ctx.strokeStyle = 'rgba(255,225,74,.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
    const shape = () => { ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.moveTo(x - 17, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 17, y); ctx.moveTo(x, y - 17); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 17); };
    ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.lineWidth = 6; shape(); ctx.stroke(); ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 2.5; shape(); ctx.stroke(); ctx.lineCap = 'butt';
    if (TCH.assist && tAlive(TCH.assist)) corners(TCH.assist, '#ffe14a', (TCH.assist.r || 14) + 10);
  }
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

/* ---------- painel: segurar um item/companheiro abre os detalhes (no PC isso é passar o mouse e o botão direito) ---------- */
const T_HOLD = '[data-inv],[data-eq],[data-pet],[data-pot],[data-ball]';
function tSheetSetup() {
  if (!MOBILE) return;
  const pan = $('panel'), sh = document.createElement('div');
  sh.id = 't-sheet'; sh.className = 'hidden';
  document.body.appendChild(sh);
  let hold = null;
  pan.addEventListener('pointerdown', ev => {
    const t = ev.target.closest(T_HOLD);
    if (!t) return;
    hold = { t, x: ev.clientX, y: ev.clientY, id: setTimeout(() => { hold = null; TCH.swallow = Date.now(); tSheet(t); tBuzz(15); }, 450) };
  });
  const cancel = ev => { if (hold && (ev.type !== 'pointermove' || Math.hypot(ev.clientX - hold.x, ev.clientY - hold.y) > 10)) { clearTimeout(hold.id); hold = null; } };
  for (const k of ['pointermove', 'pointerup', 'pointercancel']) pan.addEventListener(k, cancel);
  // o toque longo do navegador viraria "botão direito" (soltar o item): aqui ele só abre os detalhes
  pan.addEventListener('contextmenu', ev => { if (ev.tTouch || !ev.target.closest(T_HOLD)) return; ev.preventDefault(); ev.stopImmediatePropagation(); }, true);
  // o clique que vem logo depois do toque longo não equipa nada
  pan.addEventListener('click', ev => { if (Date.now() - (TCH.swallow || 0) < 700) { ev.preventDefault(); ev.stopImmediatePropagation(); } }, true);
  sh.addEventListener('click', ev => {
    const b = ev.target.closest('[data-sh]'), t = TCH.sheetT;
    if (!b || !t || !document.contains(t)) { sh.classList.add('hidden'); return; }
    const k = b.dataset.sh;
    if (k === 'use') t.click();
    else if (k === 'lock') t.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    else if (k === 'drop') { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); e.tTouch = true; t.dispatchEvent(e); }
    // soltar um companheiro pede confirmação (toque de novo); o resto fecha na hora
    if (k === 'drop' && t.dataset.pet !== undefined && !b.dataset.ok) { b.dataset.ok = 1; b.textContent = '⚠ Toque de novo para soltar'; return; }
    sh.classList.add('hidden');
  });
}
function tSheet(t) {
  const P = G && G.P, sh = $('t-sheet');
  if (!P) return;
  TCH.sheetT = t;
  let info = '', use = '', drop = '', lock = '';
  if (t.dataset.pet !== undefined) {
    const i = +t.dataset.pet;
    info = petTip(P, i); use = P.petAct.includes(i) ? '⚪ Guardar na Pokébola' : '⚪ Chamar'; drop = '🌿 Soltar na natureza';
  } else {
    const ti = t.getAttribute('title') || (t.closest('[title]') && t.closest('[title]').getAttribute('title')) || t.textContent.trim();
    // tira as dicas de mouse/teclado (Shift+clique, botão direito...): aqui os botões fazem isso
    info = `<div class="small" style="white-space:pre-line">${ti.split('\n').filter(l => !/Clique|clique|Botão direito/.test(l)).join('\n').replace(/</g, '&lt;')}</div>`;
    if (t.dataset.inv !== undefined) {
      const it = P.inv[+t.dataset.inv];
      if (!it) return;
      use = it.slot === 'pedra' ? '💎 Usar' : '⬆ Equipar'; drop = '🗑 Soltar no chão'; lock = it.locked ? '🔓 Destravar' : '🔒 Travar';
    } else if (t.dataset.eq !== undefined) {
      if (t.dataset.eq === 'anel' || t.dataset.eq === 'amuleto') use = P.equip[t.dataset.eq] ? '⬇ Tirar' : '';
    } else if (t.dataset.pot) { use = '🧪 Beber'; drop = '🗑 Soltar uma no chão'; }
    else if (t.dataset.ball) { use = '⚪ Usar esta bola'; drop = '🗑 Soltar uma no chão'; }
  }
  sh.innerHTML = `${info}<div class="shb">${use ? `<button data-sh="use" class="good">${use}</button>` : ''}${lock ? `<button data-sh="lock">${lock}</button>` : ''}${drop ? `<button data-sh="drop" class="bad">${drop}</button>` : ''}<button data-sh="x">Fechar</button></div>`;
  sh.classList.remove('hidden');
}

touchSetup();
tSheetSetup();
