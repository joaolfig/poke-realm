'use strict';
/* ============ Sprites animados (PMDCollab) ============
 * Opção da partida, escolhida por quem joga sozinho ou cria a sala (os convidados seguem o anfitrião).
 * Só troca o desenho dos Pokémon no mundo (inimigos, companheiros, montaria e Forma Selvagem): andam, ficam
 * parados, atiram e levam dano animados, virados para 8 direções. Quem não tem sprite lá sai dos sorteios
 * (natureza, água, noite, masmorras, ginásios, contratos); chefes, lendários e quem já está na equipe ficam,
 * com o ícone de sempre. Ícones dos menus e da Pokédex não mudam.
 * Folhas: github.com/PMDCollab/SpriteCollab (linhas = 8 direções, colunas = quadros, durações em 1/60 s).
 */
// Pokémon com sprite que tem pelo menos a animação de andar (conferido em nov/2026: 974 de 1025)
const PMD_IDS = new Set('1-513,515,517-519,521,524-537,539-557,559-563,566-590,593-615,617,619-625,627-667,669-682,684-731,734,736-755,757-764,766-837,840-865,867-869,871-892,894-928,930,932-941,946,948,951-953,955,957-972,974-985,987-989,991-992,994-998,1000,1004-1007,1009-1013,1015-1019,1024-1025'
  .split(',').flatMap(f => { const [a, b = a] = f.split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); }));
const PMD = { on: false, data: {}, loading: new Set() };
const PMD_KEY = 'pkr_pmd_v1';
const PMD_URL = (id, arq) => `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${String(id).padStart(4, '0')}/${arq}`;
// papel -> animações do PMDCollab, em ordem de preferência
const PMD_PAPEL = { idle: ['Idle', 'Walk'], walk: ['Walk'], shoot: ['Shoot', 'Charge', 'Attack'], hurt: ['Hurt'] };
const pmdHas = id => PMD_IDS.has(id);

// sorteios sem quem não tem sprite (se um sorteio ficaria vazio, fica como estava)
function pmdFilterPools() {
  if (!PMD.on) return;
  const keep = a => { const f = a.filter(pmdHas); return f.length ? f : a; };
  for (const k of Object.keys(ZONE_POOLS)) ZONE_POOLS[k] = keep(ZONE_POOLS[k]);
  for (const k of Object.keys(WATER_POOLS)) WATER_POOLS[k] = keep(WATER_POOLS[k]);
  for (const a of [RARE_POOL, NIGHT_POOL, MIGRATION_POOL, ALL_BABIES]) replaceArr(a, keep(a));
  if (REGION.babies) REGION.babies = keep(REGION.babies);
  for (const t of Object.values(THEMES)) t.pool = keep(t.pool);
  replaceArr(THEME_IDS, [...new Set(Object.values(THEMES).flatMap(t => [...t.pool, t.boss]))]);
}

// baixa a folha de cada papel e mede onde o desenho fica em cada quadro (para alinhar as animações pelo corpo)
async function pmdLoadData(id) {
  const xml = new DOMParser().parseFromString(await (await fetch(PMD_URL(id, 'AnimData.xml'))).text(), 'text/xml');
  const defs = {};
  for (const an of xml.querySelectorAll('Anim')) {
    const t = q => (an.querySelector(q) || {}).textContent;
    defs[t('Name')] = { copia: t('CopyOf'), w: +t('FrameWidth'), h: +t('FrameHeight'), dur: [...an.querySelectorAll('Duration')].map(d => +d.textContent / 60) };
  }
  const real = n => (defs[n] && defs[n].copia) || n;
  const folhas = {}, anims = {};
  for (const [papel, nomes] of Object.entries(PMD_PAPEL)) {
    const nome = nomes.map(real).find(n => defs[n] && !defs[n].copia && defs[n].dur.length);
    if (!nome) continue;
    folhas[nome] = folhas[nome] || new Promise((res, rej) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => res(im); im.onerror = rej;
      im.src = PMD_URL(id, nome + '-Anim.png');
    });
    const im = await folhas[nome], d = defs[nome], cols = Math.max(1, Math.round(im.width / d.w)), rows = Math.max(1, Math.round(im.height / d.h));
    // caixa do desenho (todas as direções e quadros), relativa ao centro do quadro
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
      if (px[(yy * c.width + xx) * 4 + 3] < 20) continue;
      const lx = (xx % d.w) - d.w / 2, ly = (yy % d.h) - d.h / 2;
      if (lx < x0) x0 = lx; if (lx > x1) x1 = lx; if (ly < y0) y0 = ly; if (ly > y1) y1 = ly;
    }
    if (x1 < x0) { x0 = -d.w / 2; y0 = -d.h / 2; x1 = d.w / 2 - 1; y1 = d.h / 2 - 1; }
    anims[papel] = { im, w: d.w, h: d.h, dur: d.dur, total: d.dur.reduce((a, b) => a + b, 0), cols, rows, x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
  }
  if (!anims.walk) throw new Error('sem Walk');
  if (!anims.idle) anims.idle = anims.walk;
  // referência de tamanho: o corpo parado (o resto se alinha pelo centro dele)
  const r = anims.idle;
  PMD.data[id] = { anims, refW: r.bw, refH: r.bh, refX: r.x0 + r.bw / 2, refY: r.y0 + r.bh / 2 };
}
function pmdEnsure(id) {
  if (PMD.data[id] || PMD.loading.has(id) || !pmdHas(id)) return;
  PMD.loading.add(id);
  pmdLoadData(id).catch(e => { console.warn('sprite PMDCollab não carregou:', id, e); PMD.data[id] = null; })
    .finally(() => { PMD.loading.delete(id); if (G) G.dirty = true; });
}

// estado de animação de quem não é inimigo (companheiros, montaria, forma): achado pela posição do quadro anterior
const PMD_TRACK = new Map();
function pmdTrack(pid, wx, wy) {
  const L = PMD_TRACK.get(pid) || [];
  PMD_TRACK.set(pid, L);
  let best = null, bd = 90;
  for (const s of L) { const d = Math.hypot(s.px - wx, s.py - wy); if (G.time - s.seen < 0.5 && d < bd) { bd = d; best = s; } }
  if (!best) { best = {}; L.push(best); }
  for (let i = L.length - 1; i >= 0; i--) if (L[i] !== best && G.time - L[i].seen > 3) L.splice(i, 1);
  return best;
}

// quadro atual: devolve um "recorte" que o drawMon sabe desenhar (ou null para usar o ícone de sempre)
// st guarda direção e animação; ev: { shotT, shotA, flash } do inimigo
function pmdFrame(pid, st, wx, wy, moving, face, ev) {
  if (!PMD.on) return null;
  const D = PMD.data[pid];
  if (!D) { pmdEnsure(pid); return null; }
  const s = st._pk || (st._pk = { px: wx, py: wy, dx: face > 0 ? 1 : -1, dy: 0.4, papel: 'idle', t0: G.time, until: 0, hurtT: -9, lastFlash: 0, shotSeen: ev && ev.shotT || 0 });
  s.seen = G.time;
  // direção: para onde anda; ao atirar, para onde atirou
  const mx = wx - s.px, my = wy - s.py;
  if (Math.hypot(mx, my) > 0.6) { s.dx += (mx - s.dx) * 0.35; s.dy += (my - s.dy) * 0.35; }
  s.px = wx; s.py = wy;
  ev = ev || {};
  const now = G.time;
  if (ev.shotT && now - ev.shotT < 0.5) { s.dx = Math.cos(ev.shotA); s.dy = Math.sin(ev.shotA); }
  // animação: dano (no máximo 1 vez por segundo) > tiro > andar > parado
  const flashUp = (ev.flash || 0) > 0 && !(s.lastFlash > 0);
  s.lastFlash = ev.flash || 0;
  let quer = moving ? 'walk' : 'idle', solta = false;
  if (flashUp && now - s.hurtT > 1 && D.anims.hurt) { s.hurtT = now; s.papel = 'hurt'; s.t0 = now; s.until = now + Math.min(0.45, D.anims.hurt.total); }
  else if (ev.shotT && ev.shotT > s.shotSeen && D.anims.shoot && s.papel !== 'hurt') {
    s.papel = 'shoot'; s.t0 = now; s.until = now + Math.min(0.6, D.anims.shoot.total);
  }
  if (ev.shotT) s.shotSeen = ev.shotT;
  if (now < s.until) { quer = s.papel; solta = true; }
  if (quer !== s.papel) { s.papel = quer; s.t0 = now; }
  const a = D.anims[s.papel] || D.anims.idle;
  // quadro: golpes param no último, andar e parado em laço
  let tt = now - s.t0;
  tt = solta ? Math.min(tt * (a.total / Math.max(0.05, s.until - s.t0)), a.total - 1e-3) : tt % a.total;
  let q = 0;
  while (q < a.dur.length - 1 && tt >= a.dur[q]) { tt -= a.dur[q]; q++; }
  // linha da folha: 0 baixo, 1 baixo-dir, 2 dir, 3 cima-dir, 4 cima, 5 cima-esq, 6 esq, 7 baixo-esq
  const ang = Math.atan2(s.dy, s.dx) * 180 / Math.PI;
  let row = ((Math.round((90 - ang) / 45) % 8) + 8) % 8;
  if (row >= a.rows) row = 0;
  return {
    pk: 1, im: a.im, sx: q * a.w + a.w / 2 + a.x0, sy: row * a.h + a.h / 2 + a.y0, sw: a.bw, sh: a.bh,
    ox: a.x0 - D.refX, oy: a.y0 - D.refY, refW: D.refW, refH: D.refH,
  };
}

// cópias da folha em branco (dano) e dourado (Alfa), feitas só quando precisam
function pmdTint(f, cor, alpha) {
  const k = '_t' + cor;
  if (!f.im[k]) {
    const c = document.createElement('canvas'); c.width = f.im.width; c.height = f.im.height;
    const x = c.getContext('2d'); x.drawImage(f.im, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.globalAlpha = alpha; x.fillStyle = cor; x.fillRect(0, 0, c.width, c.height);
    f.im[k] = c;
  }
  return Object.assign({}, f, { im: f.im[k] });
}

// desenha o recorte no lugar do ícone: mesma área do ícone (w x h), corpo centrado no mesmo ponto
function pmdDraw(f, w, h) {
  const k = Math.sqrt((w * h) / (f.refW * f.refH));
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(f.im, f.sx, f.sy, f.sw, f.sh, f.ox * k, f.oy * k, f.sw * k, f.sh * k);
  ctx.imageSmoothingEnabled = sm;
}

// opção no menu: aparece para Solo e Criar sala (quem entra numa sala usa a escolha do anfitrião)
try { PMD.pref = localStorage.getItem(PMD_KEY) === '1'; } catch (e) { PMD.pref = false; }
