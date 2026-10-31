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
  ['A', 'Falar / portal / MO'], ['B', 'Fechar janela'], ['X', 'Poção'], ['Y', 'Poké Ball'], ['LB', 'Elixir'],
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
  renderHelpHint();
  if (G) G.dirty = true;
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
// .slot inclui os espaços vazios da mochila: assim a grade não tem buracos na navegação
const NAV_SEL = 'button:not(:disabled), .slot, [data-pet], .modes label, #maps button, input#name, input#join-code:not(:disabled)';
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
// identidade de um item da interface, para reencontrá-lo quando o painel ou a loja são redesenhados
const kindOf = el => (el.dataset && el.dataset.act ? el.dataset.act.split(':')[0] : Object.keys(el.dataset || {})[0] || el.tagName);
const sigOf = el => el.id || el.tagName + JSON.stringify(el.dataset) + (el.dataset && Object.keys(el.dataset).length ? '' : el.textContent.trim().slice(0, 30));
function setFocus(el) {
  if (PAD.focus) PAD.focus.classList.remove('padfocus');
  PAD.focus = el;
  if (el) { const r = el.getBoundingClientRect(); PAD.sig = sigOf(el); PAD.kind = kindOf(el); PAD.idx = navItems().indexOf(el); PAD.pos = [r.left + r.width / 2, r.top + r.height / 2]; }
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
// o item selecionado sumiu (a interface foi redesenhada): volta para o mesmo item ou para o mais próximo de onde estava
function relocate() {
  if (!PAD.nav || (PAD.focus && document.contains(PAD.focus))) return;
  const items = navItems();
  let el = PAD.sig && items.find(i => sigOf(i) === PAD.sig);
  // sumiu (ex.: o item vendido): fica no que ocupou o lugar dele na lista, se for do mesmo tipo
  if (!el && PAD.idx >= 0) { const c = items[Math.min(PAD.idx, items.length - 1)]; if (c && kindOf(c) === PAD.kind) el = c; }
  if (!el && PAD.pos) {
    let bd = 1e9;
    for (const i of items) { const r = i.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - PAD.pos[0], r.top + r.height / 2 - PAD.pos[1]); if (d < bd) { bd = d; el = i; } }
  }
  setFocus(el || items[0] || null);
}
function navMove(dx, dy) {
  relocate();
  const items = navItems();
  if (!items.length) return;
  if (!PAD.focus || !items.includes(PAD.focus)) return setFocus(items[0]);
  const a = PAD.focus.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = 1e9;
  for (const el of items) {
    if (el === PAD.focus) continue;
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const along = (x - ax) * dx + (y - ay) * dy;
    if (along <= 2) continue;
    // na mesma coluna (ou linha) o desvio lateral não conta: anda certinho pelas grades
    const overlap = dx ? r.top < a.bottom && r.bottom > a.top : r.left < a.right && r.right > a.left;
    const side = overlap ? 0 : Math.abs((x - ax) * dy) + Math.abs((y - ay) * dx);
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
  setTimeout(relocate, 30);
}

/* ---------- leitura do controle (chamada a cada quadro) ---------- */
function padTick(dt) {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
  if (!gp) return;
  if (!PAD.on) {
    // Start liga o controle (assim dá para religar mesmo sem teclado e mouse)
    const st = !!(gp.buttons[9] && gp.buttons[9].pressed);
    if (st && !PAD.prev[9]) { setPad(true); PAD.prev = gp.buttons.map(b => b.pressed || b.value > 0.5); if (G && G.toasts) G.toasts.push({ text: '🎮 Controle ligado!', color: '#93c5fd', t: 3 }); return; }
    PAD.prev[9] = st;
    // avisa uma vez que há um controle e como ligar
    if (!PAD.hint && gp.buttons.some(b => b.pressed)) { PAD.hint = 1; if (G && G.toasts) G.toasts.push({ text: '🎮 Controle detectado! Aperte Start para ligar.', color: '#93c5fd', t: 5 }); }
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
    relocate();
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
    const rx = ax(2), ry = ax(3), rm = Math.hypot(rx, ry), shooting = btn(7) || rm > 0.55;
    if (rm > 0.3) { PAD.aim = Math.atan2(ry, rx); PAD.aimR = 140 + rm * 180; }
    else if ((lx || ly) && !btn(7)) PAD.aim = Math.atan2(ly, lx);
    // mira semi-assistida: se há um Pokémon perto da direção apontada (cone de ~20°, até 520px),
    // a mira é puxada 75% do caminho até ele. Ajuda bastante, mas ainda é preciso apontar.
    // Atirando sem mexer o analógico direito, vale a direção em que você anda (cone mais aberto).
    PAD.lock = padAimTarget(PAD.aim, rm > 0.3 ? 0.35 : shooting ? 0.6 : 0);
    let fa = PAD.aim, fr = PAD.aimR;
    if (PAD.lock) {
      const dx = PAD.lock.x - G.P.x, dy = PAD.lock.y - G.P.y, ta = Math.atan2(dy, dx);
      fa = PAD.aim + Math.atan2(Math.sin(ta - PAD.aim), Math.cos(ta - PAD.aim)) * 0.75;
      fr = Math.hypot(dx, dy);
    }
    mouse.x = W / 2 + Math.cos(fa) * fr + (G.P.x - G.cam.x); mouse.y = H / 2 + Math.sin(fa) * fr + (G.P.y - G.cam.y);
    mouse.down = shooting;
    // botões de ação
    for (const i in PAD_KEYS) if (down(+i)) keyTap(PAD_KEYS[i]);
    if (down(1)) { if (G.npcOpen) closeNPC(); else if (!$('help').classList.contains('hidden')) $('help').classList.add('hidden'); }
    if (down(9)) { padNav(true); PAD.auto = null; }
  }
  PAD.prev = gp.buttons.map(b => b.pressed || b.value > 0.5);
}

// alvo da mira assistida: o inimigo com melhor equilíbrio entre ângulo e distância dentro do cone
function padAimTarget(ang, cone) {
  const P = G.P;
  if (!cone || !P) return null;
  let best = null, bs = 1e9;
  const pool = G.enemies.filter(e => e.hp > 0 && !e.dead);
  for (const r of G.remotes.values()) if (P.pvp && r.name && !r.dead) pool.push({ x: r.x, y: r.y, r: 12, remote: 1 });
  for (const e of pool) {
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
    if (d > 520 || d < 1) continue;
    const da = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - ang), Math.cos(Math.atan2(dy, dx) - ang)));
    if (da > cone) continue;
    const sc = da * 300 + d * 0.5 - (e === PAD.lock ? 60 : 0); // um pouco de "memória" para não ficar trocando de alvo
    if (sc < bs) { bs = sc; best = e; }
  }
  return best;
}

// mira desenhada no mapa (com controle não há cursor do mouse)
function drawPadReticle() {
  if (!PAD.on || PAD.nav || !G || !G.P || state !== 'play') return;
  const x = mouse.x, y = mouse.y;
  // contorno preto grosso + amarelo vivo por cima: aparece em grama, areia, neve e masmorras escuras
  const shape = () => {
    ctx.beginPath(); ctx.arc(x, y, 10, 0, 7);
    ctx.moveTo(x - 17, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 17, y);
    ctx.moveTo(x, y - 17); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 17);
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#000'; ctx.lineWidth = 6; shape(); ctx.stroke();
  ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 2.5; shape(); ctx.stroke();
  ctx.fillStyle = '#ff3b3b'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); ctx.stroke();
  if (PAD.lock) {
    // travado num alvo: cantoneiras vermelhas em volta do Pokémon
    const e = PAD.lock, R = (e.r || 14) + 10, ex = e.x - G.cam.x + W / 2, ey = e.y - G.cam.y + H / 2, k = 8;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
    const corners = () => { ctx.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.moveTo(ex + sx * R, ey + sy * (R - k)); ctx.lineTo(ex + sx * R, ey + sy * R); ctx.lineTo(ex + sx * (R - k), ey + sy * R); } };
    corners(); ctx.stroke(); ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 2.5; corners(); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

window.addEventListener('gamepadconnected', () => { PAD.hint = 0; });
document.addEventListener('DOMContentLoaded', () => { setPad(PAD.on); });

/* ---------- dicas na tela: troca as teclas pelos botões do controle ---------- */
const PAD_LBL = { E: 'A', 'Espaço': 'RB', Q: 'X', 1: 'X', F: 'Y', 2: 'LB', 3: '↑', X: '↓', R: '←', V: '→', M: 'L3', T: 'R3', H: 'View', Shift: 'LT', Esc: 'B' };
const PAD_RE = /\[(E|Espaço|Q|F|R|V|X|T|M|H|Shift|Esc|1|2|3)\]|\((T|Esc)\)/g;
const padText = s => (PAD.on && typeof s === 'string' ? s.replace(PAD_RE, (m, a, b) => (a ? `[${PAD_LBL[a]}]` : `(${PAD_LBL[b]})`)) : s);
// aplica nos textos e dicas (title) de um pedaço da interface
function padFixDom(root) {
  if (!PAD.on || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (PAD_RE.test(n.nodeValue)) { PAD_RE.lastIndex = 0; n.nodeValue = padText(n.nodeValue); }
  PAD_RE.lastIndex = 0;
  root.querySelectorAll('[title]').forEach(el => { const t = el.getAttribute('title'); if (PAD_RE.test(t)) { PAD_RE.lastIndex = 0; el.setAttribute('title', padText(t)); } PAD_RE.lastIndex = 0; });
}
// linha de atalhos no fim do painel (teclado ou controle) + botões de som e controle
function renderHelpHint() {
  const el = document.querySelector('.help-hint');
  if (!el) return;
  const som = ['🔇 Som: desligado', '🔈 Som: só efeitos', '🔊 Som: música e efeitos'][typeof soundMode === 'number' ? soundMode : 2];
  el.innerHTML = (PAD.on ? '<kbd>View</kbd> controles · <kbd>Start</kbd> menu · <kbd>L3</kbd> mapa' : '<kbd>H</kbd> controles · <kbd>N</kbd> música/som · <kbd>M</kbd> mapa')
    + `<button data-sound class="savebtn">${som}</button><button data-padtoggle class="savebtn">🎮 Controle: ${PAD.on ? 'ligado' : 'desligado'}</button>`;
}
document.addEventListener('click', ev => { if (ev.target.closest('[data-sound]')) { const t = cycleSound(); if (G && G.toasts) G.toasts.push({ text: t, color: '#e5e7eb', t: 1.8 }); renderHelpHint(); } });
