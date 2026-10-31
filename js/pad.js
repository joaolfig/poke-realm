'use strict';
/* ============ Controle (Xbox / padrão "standard" da Gamepad API) ============
 * Ligado por opção (menu inicial ou painel). Analógico esquerdo anda, direito mira e atira.
 * Os botões viram as mesmas teclas do teclado (reaproveita todos os atalhos do jogo).
 * Modo menu (Start, ou automático nas telas de menu): o direcional move uma seleção pelos
 * botões da tela; a tela rola sozinha até o item e a descrição dele aparece numa caixa,
 * então nada depende de rolar ou passar o mouse.
 */
const PAD_KEY = 'pkr_pad_v1';
const PAD = { on: false, nav: false, prev: [], focus: null, rep: 0, aim: 0, aimR: 230, moveK: {}, hint: 0 };
try { PAD.on = localStorage.getItem(PAD_KEY) === '1'; } catch (e) { /* ignora */ }

// botões do layout "standard": 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View, 9 Menu, 10 L3, 11 R3, 12-15 direcional
const PAD_KEYS = { 0: 'KeyE', 2: 'KeyQ', 3: 'KeyF', 4: 'Digit2', 5: 'Space', 6: 'ShiftLeft', 12: 'Digit3', 13: 'KeyX', 14: 'KeyR', 15: 'KeyV', 10: 'KeyM', 11: 'KeyT', 8: 'KeyH' };
const PAD_HELP = [
  ['Analógico esquerdo', 'Andar'], ['Analógico direito', 'Mirar (empurrar já atira)'], ['RT', 'Atirar'], ['RB', 'Especial'], ['LT', 'Rolamento (talento)'],
  ['A', 'Falar / portal / MO'], ['B', 'Fechar janela'], ['X', 'Poção'], ['Y', 'Pokébola'], ['LB', 'Elixir'],
  ['↑ direcional', 'Usar cristal'], ['↓ direcional', 'Montar'], ['← direcional', 'Voltar à vila'], ['→ direcional', 'Voar (montaria voadora)'],
  ['L3', 'Mapa'], ['R3', 'Tiro automático'], ['View', 'Controles'], ['Menu (Start)', 'Modo menu: painel, inventário, talentos'],
];
const PAD_NAV_HELP = [['Direcional / analógico', 'Mover a seleção'], ['A', 'Escolher / clicar'], ['X', 'Ação do botão direito (soltar item ou companheiro)'], ['B ou Start', 'Sair do modo menu']];

function setPad(on) {
  PAD.on = on;
  try { localStorage.setItem(PAD_KEY, on ? '1' : '0'); } catch (e) { /* ignora */ }
  document.body.classList.toggle('pad', on);
  if (!on) { padNav(false); mouse.down = false; for (const k in PAD.moveK) K[k] = false; }
  renderPadToggles();
  renderPadHelp();
}
function renderPadToggles() {
  document.querySelectorAll('[data-padtoggle]').forEach(b => { b.textContent = `🎮 Controle: ${PAD.on ? 'ligado' : 'desligado'}`; b.classList.toggle('good', PAD.on); });
}
function renderPadHelp() {
  const box = $('pad-help');
  if (!box) return;
  box.classList.toggle('hidden', !PAD.on);
  box.innerHTML = `<h3>Controle</h3><div class="padgrid">${PAD_HELP.map(([b, t]) => `<kbd>${b}</kbd><span>${t}</span>`).join('')}</div>
    <h3>Modo menu</h3><div class="padgrid">${PAD_NAV_HELP.map(([b, t]) => `<kbd>${b}</kbd><span>${t}</span>`).join('')}</div>`;
}
document.addEventListener('click', ev => { if (ev.target.closest('[data-padtoggle]')) setPad(!PAD.on); });

function keyTap(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
}

/* ---------- modo menu: navegação espacial pelos elementos clicáveis ---------- */
const NAV_SEL = 'button:not(:disabled), [data-inv], [data-eq], [data-pet], .modes label, #maps button, input#name, input#join-code:not(:disabled)';
function navRoot() {
  for (const id of ['lost', 'death', 'menu']) if (!$(id).classList.contains('hidden')) return $(id);
  if (G && G.npcOpen && !$('npc').classList.contains('hidden')) return $('npc');
  if (!$('help').classList.contains('hidden')) return $('help');
  return $('panel');
}
function navItems() {
  return [...navRoot().querySelectorAll(NAV_SEL)].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; });
}
function padNav(on) {
  PAD.nav = on;
  if (!on) { setFocus(null); return; }
  mouse.down = false;
  // começa no item mais alto (e mais à esquerda) da tela
  if (!PAD.focus || !document.contains(PAD.focus)) setFocus(navItems().sort((p, q) => { const a = p.getBoundingClientRect(), b = q.getBoundingClientRect(); return a.top - b.top || a.left - b.left; })[0] || null);
}
function setFocus(el) {
  if (PAD.focus) PAD.focus.classList.remove('padfocus');
  PAD.focus = el;
  const info = $('padinfo');
  if (!el) { info.classList.add('hidden'); $('ptip').classList.add('hidden'); return; }
  el.classList.add('padfocus');
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  // a descrição que normalmente aparece passando o mouse
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  const tip = el.getAttribute('title') || (el.closest('[title]') && el.closest('[title]').getAttribute('title')) || '';
  info.textContent = tip;
  info.classList.toggle('hidden', !tip || !$('ptip').classList.contains('hidden'));
}
function navMove(dx, dy) {
  const items = navItems();
  if (!items.length) return;
  if (!PAD.focus || !items.includes(PAD.focus)) return setFocus(items[0]);
  const a = PAD.focus.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = 1e9;
  for (const el of items) {
    if (el === PAD.focus) continue;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const along = (x - ax) * dx + (y - ay) * dy, side = Math.abs((x - ax) * dy) + Math.abs((y - ay) * dx);
    if (along <= 2) continue;
    const sc = along + side * 2.5;
    if (sc < bs) { bs = sc; best = el; }
  }
  if (best) setFocus(best);
}
function navPress(alt) {
  const el = PAD.focus;
  if (!el || !document.contains(el)) return;
  if (alt) { el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); }
  else if (el.tagName === 'INPUT') { el.focus(); if (el.id === 'name') el.select(); }
  else el.click();
  // a interface pode ter sido redesenhada: mantém a seleção no item equivalente
  setTimeout(() => { if (PAD.nav && (!PAD.focus || !document.contains(PAD.focus))) setFocus(navItems()[0] || null); }, 60);
}

/* ---------- leitura do controle (chamada a cada quadro) ---------- */
function padTick(dt) {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
  if (!gp) return;
  if (!PAD.on) {
    // avisa uma vez que há um controle e como ligar
    if (!PAD.hint && gp.buttons.some(b => b.pressed)) { PAD.hint = 1; if (G && G.toasts) G.toasts.push({ text: '🎮 Controle detectado! Ligue em "Controle" no menu ou no painel.', color: '#93c5fd', t: 5 }); }
    return;
  }
  const btn = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
  const down = i => btn(i) && !PAD.prev[i];
  const ax = i => { const v = gp.axes[i] || 0; return Math.abs(v) < 0.25 ? 0 : v; };
  const overlay = ['menu', 'death', 'lost'].some(id => !$(id).classList.contains('hidden'));
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  // telas de menu e janelas de NPC ligam o modo menu sozinhas, e desligam quando fecham
  if (overlay && !PAD.nav) { padNav(true); PAD.auto = 'overlay'; }
  else if (!overlay && PAD.nav && PAD.auto === 'overlay') { padNav(false); PAD.auto = null; }
  if (G && G.npcOpen && !PAD.nav && !overlay) { padNav(true); PAD.auto = 'npc'; }
  else if (G && !G.npcOpen && PAD.nav && PAD.auto === 'npc') { padNav(false); PAD.auto = null; }

  if (typing) {
    // digitando o nome/código: A ou B confirma e volta à navegação
    if (down(0) || down(1) || down(9)) document.activeElement.blur();
  } else if (PAD.nav) {
    let dx = (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0), dy = (btn(13) ? 1 : 0) - (btn(12) ? 1 : 0);
    if (!dx && !dy) { const lx = ax(0), ly = ax(1); if (Math.abs(lx) > 0.6) dx = Math.sign(lx); else if (Math.abs(ly) > 0.6) dy = Math.sign(ly); }
    PAD.rep -= dt;
    if (dx || dy) { if (PAD.rep <= 0) { navMove(dx, dy); PAD.rep = PAD.moved ? 0.14 : 0.35; PAD.moved = true; } }
    else { PAD.rep = 0; PAD.moved = false; }
    if (down(0)) navPress(false);
    if (down(2)) navPress(true);
    if (down(1) || down(9)) {
      if (G && G.npcOpen) closeNPC();
      else if (!$('help').classList.contains('hidden')) $('help').classList.add('hidden');
      if (!overlay) { padNav(false); PAD.auto = null; }
    }
    // navegando no menu o herói fica parado e não atira
    for (const k in PAD.moveK) K[k] = false;
    mouse.down = false;
  } else if (state === 'play' && G && G.P) {
    // andar
    const lx = ax(0), ly = ax(1);
    const mk = { KeyA: lx < -0.35, KeyD: lx > 0.35, KeyW: ly < -0.35, KeyS: ly > 0.35 };
    for (const k in mk) { K[k] = mk[k]; PAD.moveK[k] = 1; }
    // mirar: o cursor vira um ponto em volta do herói
    const rx = ax(2), ry = ax(3), rm = Math.hypot(rx, ry);
    if (rm > 0.3) { PAD.aim = Math.atan2(ry, rx); PAD.aimR = 120 + rm * 200; }
    else if (lx || ly) { if (!btn(7)) PAD.aim = Math.atan2(ly, lx); }
    mouse.x = W / 2 + Math.cos(PAD.aim) * PAD.aimR; mouse.y = H / 2 + Math.sin(PAD.aim) * PAD.aimR;
    mouse.down = btn(7) || rm > 0.55;
    // botões de ação
    for (const i in PAD_KEYS) if (down(+i)) keyTap(PAD_KEYS[i]);
    if (down(1)) { if (G.npcOpen) closeNPC(); else if (!$('help').classList.contains('hidden')) $('help').classList.add('hidden'); }
    if (down(9)) { padNav(true); PAD.auto = null; }
  }
  PAD.prev = gp.buttons.map(b => b.pressed || b.value > 0.5);
}

// mira desenhada no mapa (com controle não há cursor do mouse)
function drawPadReticle() {
  if (!PAD.on || PAD.nav || !G || !G.P || state !== 'play') return;
  const x = mouse.x, y = mouse.y;
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.moveTo(x - 14, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 5); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 14); ctx.stroke();
}

window.addEventListener('gamepadconnected', () => { PAD.hint = 0; });
document.addEventListener('DOMContentLoaded', () => { setPad(PAD.on); });
