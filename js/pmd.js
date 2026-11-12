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
// formas Mega (id da PokeAPI -> pasta da forma no PMDCollab): só as que já têm sprite lá (28 de 46; as outras ficam com o ícone)
const PMD_FORMS = { 10034: '0006/0001', 10037: '0065/0001', 10071: '0080/0002', 10038: '0094/0001', 10039: '0115/0001', 10042: '0142/0001', 10072: '0208/0001',
  10048: '0229/0001', 10049: '0248/0001', 10065: '0254/0001', 10051: '0282/0001', 10066: '0302/0001', 10052: '0303/0001', 10054: '0308/0001', 10055: '0310/0001',
  10070: '0319/0001', 10087: '0323/0001', 10067: '0334/0001', 10056: '0354/0001', 10057: '0359/0001', 10074: '0362/0001', 10062: '0380/0001', 10063: '0381/0001',
  10079: '0384/0001', 10088: '0428/0001', 10059: '0448/0001', 10068: '0475/0001', 10075: '0719/0001' };
const PMD = { on: false, data: {}, loading: new Set() };
const PMD_KEY = 'pkr_pmd_v1';
const PMD_URL = (id, arq) => `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${PMD_FORMS[id] || String(id).padStart(4, '0')}/${arq}`;
// papel -> animações do PMDCollab, em ordem de preferência
const PMD_PAPEL = { idle: ['Idle', 'Walk'], walk: ['Walk'], shoot: ['Shoot', 'Charge', 'Attack'], hurt: ['Hurt'] };
const pmdHas = id => PMD_IDS.has(id) || !!PMD_FORMS[id];

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
    // caixa do desenho (todas as direções e quadros), relativa ao centro do quadro, e o tamanho médio do corpo
    // virado para a câmera (linha 0), que é a pose do ícone: é ele que fica do tamanho do ícone
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, somaH = 0, somaW = 0, n = 0;
    for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) {
      let a0 = 1e9, b0 = 1e9, a1 = -1e9, b1 = -1e9;
      for (let ly = 0; ly < d.h; ly++) for (let lx = 0; lx < d.w; lx++) {
        if (px[((rr * d.h + ly) * c.width + cc * d.w + lx) * 4 + 3] < 128) continue;
        if (lx < a0) a0 = lx; if (lx > a1) a1 = lx; if (ly < b0) b0 = ly; if (ly > b1) b1 = ly;
      }
      if (a1 < a0) continue;
      if (rr === 0) { somaH += b1 - b0 + 1; somaW += a1 - a0 + 1; n++; }
      x0 = Math.min(x0, a0 - d.w / 2); x1 = Math.max(x1, a1 - d.w / 2); y0 = Math.min(y0, b0 - d.h / 2); y1 = Math.max(y1, b1 - d.h / 2);
    }
    if (x1 < x0) { x0 = -d.w / 2; y0 = -d.h / 2; x1 = d.w / 2 - 1; y1 = d.h / 2 - 1; }
    anims[papel] = { im, w: d.w, h: d.h, dur: d.dur, total: d.dur.reduce((a, b) => a + b, 0), cols, rows, x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1, alt0: n ? somaH / n : y1 - y0 + 1, larg0: n ? somaW / n : x1 - x0 + 1 };
  }
  if (!anims.walk) throw new Error('sem Walk');
  if (!anims.idle) anims.idle = anims.walk;
  // referência de tamanho: o corpo parado de frente (o resto se alinha pelo centro dele)
  const r = anims.idle;
  PMD.data[id] = { anims, refW: r.larg0, refH: r.alt0, refX: r.x0 + r.bw / 2, refY: r.y0 + r.bh / 2 };
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
  // (posição e hora ficam no _pk que o pmdFrame preenche; quem ainda não tem _pk é descartado)
  for (const s of L) { const k = s._pk; if (!k) continue; const d = Math.hypot(k.px - wx, k.py - wy); if (G.time - k.seen < 0.5 && d < bd) { bd = d; best = s; } }
  for (let i = L.length - 1; i >= 0; i--) if (L[i] !== best && (!L[i]._pk || G.time - L[i]._pk.seen > 3)) L.splice(i, 1);
  if (!best) { best = {}; L.push(best); }
  return best;
}

// quadro atual: devolve um "recorte" que o drawMon sabe desenhar (ou null para usar o ícone de sempre)
// st guarda direção e animação; ev: { shotT, shotA, flash } do inimigo
function pmdFrame(pid, st, wx, wy, moving, face, ev) {
  if (!PMD.on) return null;
  const D = PMD.data[pid];
  if (!D) { pmdEnsure(pid); return null; }
  const s = st._pk || (st._pk = { px: wx, py: wy, dx: face > 0 ? 1 : -1, dy: 0.4, papel: 'idle', t0: G.time, until: 0, hurtT: -9, lastFlash: 0, shotSeen: ev && ev.shotT || 0, lt: G.time, walkT: -9 });
  const now = G.time, dt = Math.max(1e-3, now - s.lt);
  s.seen = now; s.lt = now;
  // andando: pela velocidade de verdade (em qualquer direção) e com uma folga de 0,2 s, para não ficar trocando
  // entre parado e andar a cada quadro (voltando sempre ao 1º quadro) quando o companheiro só ajeita a posição
  const mx = wx - s.px, my = wy - s.py, vel = Math.hypot(mx, my) / dt;
  if (moving || (vel > 25 && vel < 3000)) s.walkT = now;
  const andando = now - s.walkT < 0.2;
  // direção: para onde anda; ao atirar, para onde atirou
  if (vel > 25 && vel < 3000) { s.dx += (mx / dt - s.dx) * 0.2; s.dy += (my / dt - s.dy) * 0.2; }
  s.px = wx; s.py = wy;
  ev = ev || {};
  if (ev.shotT && now - ev.shotT < 0.5) { s.dx = Math.cos(ev.shotA); s.dy = Math.sin(ev.shotA); }
  // animação: dano (no máximo 1 vez por segundo) > tiro > andar > parado
  // (ev.anda: quem atira andando, como o Druida e os companheiros, só vira para o alvo e segue no passo)
  const flashUp = (ev.flash || 0) > 0 && !(s.lastFlash > 0);
  s.lastFlash = ev.flash || 0;
  let quer = andando ? 'walk' : 'idle', solta = false;
  if (flashUp && now - s.hurtT > 1 && D.anims.hurt) { s.hurtT = now; s.papel = 'hurt'; s.t0 = now; s.until = now + Math.min(0.45, D.anims.hurt.total); }
  else if (ev.shotT && ev.shotT > s.shotSeen && D.anims.shoot && s.papel !== 'hurt' && !(ev.anda && andando) && !(s.papel === 'shoot' && now < s.until)) {
    s.papel = 'shoot'; s.t0 = now; s.until = now + Math.min(0.6, D.anims.shoot.total);
  }
  if (ev.shotT) s.shotSeen = ev.shotT;
  if (now < s.until && !(s.papel === 'shoot' && ev.anda && andando)) { quer = s.papel; solta = true; }
  if (quer !== s.papel) { s.papel = quer; s.t0 = now; s.until = 0; }
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

// desenha o recorte no lugar do ícone: de frente, o corpo tem a área do ícone (w x h), centrado no mesmo ponto
// (medido Pokémon por Pokémon; fator fixo não servia: a razão sprite/ícone variava de 0,8 a 1,4. Só pela altura,
// os sprites ficavam ~14% mais estreitos que os ícones; pela área, altura e largura ficam a menos de 10% cada)
function pmdDraw(f, w, h) {
  const k = Math.sqrt((w * h) / (f.refW * f.refH));
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
  ctx.drawImage(f.im, f.sx, f.sy, f.sw, f.sh, f.ox * k, f.oy * k, f.sw * k, f.sh * k);
  ctx.imageSmoothingEnabled = sm;
}

// opção no menu: aparece para Solo e Criar sala (quem entra numa sala usa a escolha do anfitrião)
try { PMD.pref = localStorage.getItem(PMD_KEY) === '1'; } catch (e) { PMD.pref = false; }
