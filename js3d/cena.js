// Cena de teste em 3D (Three.js): herói andando num campo, câmera de cima inclinada, criaturas originais
// que atiram padrões de bullet-hell, colisão com o cenário. Funciona com teclado/mouse, controle e toque.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LIMITE = 70; // metade do tamanho jogável do mapa

// ---------- renderizador, cena, câmera e luz ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd3f0);
scene.fog = new THREE.Fog(0x9fd3f0, 55, 110);

const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 300);
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x4f6b32, 1.0));
const sol = new THREE.DirectionalLight(0xfff1d6, 1.8);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, far: 120 });
sol.shadow.bias = -0.0005;
scene.add(sol, sol.target);

// materiais reaproveitados (um por cor)
const MATS = {};
const mat = (cor, extra = {}) => (MATS[cor + JSON.stringify(extra)] ||= new THREE.MeshStandardMaterial({ color: cor, flatShading: true, roughness: 0.85, ...extra }));
function peca(geo, m, x = 0, y = 0, z = 0, pai = scene) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = true;
  pai.add(o);
  return o;
}

// ---------- chão: grama com variação de cor e uma trilha de terra ----------
const trilha = (x, z) => Math.abs(z - Math.sin(x * 0.08) * 6) < 2.4;
{
  const g = new THREE.PlaneGeometry(170, 170, 85, 85);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, cores = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    if (trilha(x, z)) c.setHex(0xc9b27a).offsetHSL(0, 0, rand(-0.03, 0.03));
    else c.setHSL(0.27 + rand(-0.02, 0.02), 0.45, 0.37 + rand(-0.04, 0.04));
    cores.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  const chao = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  chao.receiveShadow = true;
  scene.add(chao);
}

// ---------- cenário com colisão (círculos no plano XZ) ----------
const solidos = []; // { x, z, r, agua }
const livre = (x, z, r) => Math.hypot(x, z) > 10 && !trilha(x, z) && solidos.every(s => Math.hypot(s.x - x, s.z - z) > s.r + r + 1);

function arvore(x, z) {
  const g = new THREE.Group(), s = rand(0.8, 1.35);
  g.position.set(x, 0, z);
  g.rotation.y = rand(0, 6);
  scene.add(g);
  peca(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 2 * s, 6), mat(0x7a5232), 0, s, 0, g);
  peca(new THREE.ConeGeometry(2 * s, 3 * s, 7), mat(0x2f7d3a), 0, 3 * s, 0, g);
  peca(new THREE.ConeGeometry(1.5 * s, 2.5 * s, 7), mat(0x3d9a48), 0, 4.6 * s, 0, g);
  solidos.push({ x, z, r: 0.8 * s });
}
function pedra(x, z) {
  const s = rand(0.7, 1.6);
  const o = peca(new THREE.DodecahedronGeometry(s, 0), mat(0x8d8f94), x, s * 0.45, z);
  o.rotation.set(rand(0, 3), rand(0, 3), 0);
  o.scale.y = 0.7;
  solidos.push({ x, z, r: s * 0.9 });
}
function casa(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  peca(new THREE.BoxGeometry(6, 4, 5), mat(0xf1e4c8), 0, 2, 0, g);
  const telhado = peca(new THREE.ConeGeometry(5, 2.6, 4), mat(0xc0483b), 0, 5.3, 0, g);
  telhado.rotation.y = Math.PI / 4;
  telhado.scale.z = 0.85;
  peca(new THREE.BoxGeometry(1.2, 2, 0.1), mat(0x6b4226), 0, 1, 2.55, g);
  peca(new THREE.BoxGeometry(1, 1, 0.1), mat(0x9bd4ff, { emissive: 0x224466 }), -1.9, 2.4, 2.55, g);
  peca(new THREE.BoxGeometry(1, 1, 0.1), mat(0x9bd4ff, { emissive: 0x224466 }), 1.9, 2.4, 2.55, g);
  solidos.push({ x, z, r: 3.7 });
}
function lago(x, z, r) {
  const agua = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ color: 0x3f9ad8, transparent: true, opacity: 0.85, roughness: 0.2, metalness: 0.1 }));
  agua.rotation.x = -Math.PI / 2;
  agua.position.set(x, 0.05, z);
  agua.receiveShadow = true;
  scene.add(agua);
  const borda = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.8, 24), mat(0xb9a66f));
  borda.rotation.x = -Math.PI / 2;
  borda.position.set(x, 0.04, z);
  scene.add(borda);
  solidos.push({ x, z, r: r - 0.4, agua: true }); // não dá para andar, mas os tiros passam por cima
}

casa(-14, -16);
casa(18, -20);
lago(16, 16, 6);
for (let i = 0; i < 70; i++) { // borda de árvores marcando o limite
  const a = (i / 70) * Math.PI * 2;
  arvore(Math.cos(a) * (LIMITE + 4) + rand(-2, 2), Math.sin(a) * (LIMITE + 4) + rand(-2, 2));
}
for (let n = 0; n < 60;) { const x = rand(-65, 65), z = rand(-65, 65); if (livre(x, z, 1.5)) { arvore(x, z); n++; } }
for (let n = 0; n < 30;) { const x = rand(-65, 65), z = rand(-65, 65); if (livre(x, z, 1.2)) { pedra(x, z); n++; } }
// tufos de grama/flores só de enfeite (sem colisão)
for (let i = 0; i < 160; i++) {
  const x = rand(-68, 68), z = rand(-68, 68);
  if (trilha(x, z)) continue;
  const flor = Math.random() < 0.3;
  const o = new THREE.Mesh(new THREE.ConeGeometry(flor ? 0.15 : 0.25, flor ? 0.5 : 0.7, 4), mat(flor ? [0xf4d03f, 0xf28cb1, 0xffffff][i % 3] : 0x4f9c3e));
  o.position.set(x, 0.3, z);
  scene.add(o);
}

// empurra um círculo para fora de tudo que é sólido e mantém dentro do mapa
function colide(pos, r) {
  for (const s of solidos) {
    const dx = pos.x - s.x, dz = pos.z - s.z, d = Math.hypot(dx, dz), min = s.r + r;
    if (d < min && d > 0.0001) { pos.x = s.x + (dx / d) * min; pos.z = s.z + (dz / d) * min; }
  }
  const d = Math.hypot(pos.x, pos.z);
  if (d > LIMITE) { pos.x *= LIMITE / d; pos.z *= LIMITE / d; }
}

// ---------- barra de vida flutuante (encolhe para o centro) ----------
function barra(pai, y) {
  const fundo = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x222222, depthTest: false }));
  fundo.scale.set(1.7, 0.2, 1);
  fundo.position.y = y;
  fundo.renderOrder = 10;
  const frente = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x5be35b, depthTest: false }));
  frente.scale.set(1.6, 0.13, 1);
  frente.position.y = y;
  frente.renderOrder = 11;
  pai.add(fundo, frente);
  return f => { frente.scale.x = 1.6 * clamp(f, 0, 1); frente.material.color.setHex(f > 0.5 ? 0x5be35b : f > 0.25 ? 0xf2c94c : 0xe25b4c); fundo.visible = frente.visible = f < 1; };
}

// ---------- herói (feito de formas simples) ----------
const heroi = { pos: new THREE.Vector3(0, 0, 0), hp: 100, max: 100, mira: new THREE.Vector3(0, 0, 1), cdTiro: 0, dash: 0, cdDash: 0, invul: 0, semDano: 9, mortes: 0, abates: 0, passo: 0 };
const raiz = new THREE.Group();
scene.add(raiz);
const corpo = new THREE.Group();
raiz.add(corpo);
peca(new THREE.CapsuleGeometry(0.55, 0.8, 4, 8), mat(0x6d4bd8), 0, 1.05, 0, corpo);
peca(new THREE.SphereGeometry(0.45, 12, 10), mat(0xf2c9a0), 0, 2.05, 0, corpo);
const chapeu = peca(new THREE.ConeGeometry(0.62, 1.1, 8), mat(0x3b2a8a), 0, 2.78, -0.05, corpo);
chapeu.rotation.x = -0.25;
peca(new THREE.SphereGeometry(0.07, 6, 6), mat(0x222222), -0.16, 2.1, 0.4, corpo);
peca(new THREE.SphereGeometry(0.07, 6, 6), mat(0x222222), 0.16, 2.1, 0.4, corpo);
peca(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), mat(0x8a5a2b), 0.7, 1.2, 0.2, corpo);
const gema = peca(new THREE.OctahedronGeometry(0.22), mat(0x7fe8ff, { emissive: 0x2fb8e0, emissiveIntensity: 0.8 }), 0.7, 2.4, 0.2, corpo);
const sombraFake = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
sombraFake.rotation.x = -Math.PI / 2;
sombraFake.position.y = 0.03;
raiz.add(sombraFake);

// ---------- padrões de tiro por tipo ----------
const ESPECIES = {
  brasa: { nome: 'Brasa', hp: 60, vel: 3.4, bala: 0xff8a3d },  // leque mirado em você
  gota: { nome: 'Gota', hp: 80, vel: 2.4, bala: 0x6cc8ff },    // anel em volta dela
  broto: { nome: 'Broto', hp: 70, vel: 2.8, bala: 0xa6f06b },  // espiral girando
};
// ---------- Pokémon: dois modos para comparar ----------
// ?modo=sprites -> sprites 2D animados do PMDCollab (8 direções) em pé no cenário 3D
// padrão         -> modelos 3D da Pokemon-3D-api, só os que têm animação completa (parado, andar, ataque, dano, queda)
const SPRITES = /[?&]modo=sprites/.test(location.search);
const POKES = SPRITES ? {
  brasa: [[4, 'Charmander'], [37, 'Vulpix'], [58, 'Growlithe'], [77, 'Ponyta'], [155, 'Cyndaquil']],
  gota: [[7, 'Squirtle'], [54, 'Psyduck'], [60, 'Poliwag'], [116, 'Horsea'], [79, 'Slowpoke']],
  broto: [[43, 'Oddish'], [69, 'Bellsprout'], [152, 'Chikorita'], [252, 'Treecko'], [1, 'Bulbasaur']],
} : {
  // [id, nome, altura real em metros]: os modelos vêm cada um numa escala, então o tamanho sai da altura da Pokédex
  brasa: [[994, 'Iron Moth', 1.2], [839, 'Coalossal', 2.8]],
  gota: [[846, 'Arrokuda', 0.5], [341, 'Corphish', 0.6], [932, 'Nacli', 0.4], [933, 'Naclstack', 0.6]],
  broto: [[253, 'Grovyle', 0.9], [947, 'Brambleghast', 1.2]],
};
const COMPANHEIRO = SPRITES ? [133, 'Eevee'] : [1, 'Bulbasaur', 0.7];
const BASES = {}; // id -> dados carregados (modelo ou folhas de sprite)
if (SPRITES) {
  document.getElementById('fonte').textContent = 'sprites animados do PMDCollab';
  Object.assign(document.getElementById('trocaModo'), { textContent: 'Ver com modelos 3D', href: '3d.html?v=5' });
}

// --- modo 3D: modelos .glb (Draco + WebP) ---
const URL_MODELO = id => `https://raw.githubusercontent.com/Pokemon-3D-api/assets/main/models/opt/regular/${id}.glb`;
const carregador = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/'));
// clipes por papel, em ordem de preferência (os nomes variam entre modelos)
const CLIPES = {
  parado: [/battlewait01_loop/, /defaultwait01_loop/, /wait00/, /aidle/, /idle|wait/i],
  anda: [/walk01_loop/, /walk/i, /run/i],
  tiro: [/rangeattack01/, /attack01/, /bd_attack$/, /fight_b/, /attack|fight/i],
  dor: [/damage01/, /bd_damage/, /damage|hurt/i],
  cai: [/down01_start/, /ko$/i, /down|faint/i],
};
async function carregaModelo(id, metros = 1) {
  const gltf = await carregador.loadAsync(URL_MODELO(id));
  const cena = gltf.scene;
  cena.updateMatrixWorld(true);
  // altura no jogo pela altura real, um pouco suavizada para os pequenos não sumirem nem os grandes taparem a tela:
  // 0,4 m -> 1,0 · 0,7 m -> 1,4 · 0,9 m -> 1,7 · 1,2 m -> 2,2 · 2,8 m -> 4; os compridos (peixes, cobras) têm o comprimento limitado
  const caixa = new THREE.Box3().setFromObject(cena, true), tam = caixa.getSize(new THREE.Vector3());
  const alvo = clamp(1.9 * metros ** 0.75, 0.9, 4);
  const escala = Math.min(alvo / Math.max(tam.y, 1e-4), (alvo * 1.8) / Math.max(tam.x, tam.z, 1e-4));
  const desloc = new THREE.Vector3(-(caixa.min.x + caixa.max.x) / 2, -caixa.min.y, -(caixa.min.z + caixa.max.z) / 2).multiplyScalar(escala);
  const clipes = {};
  for (const [papel, lista] of Object.entries(CLIPES)) {
    for (const re of lista) { const c = gltf.animations.find(c => re.test(c.name)); if (c) { clipes[papel] = c; break; } }
  }
  BASES[id] = { cena, clipes, escala, desloc, alto: tam.y * escala };
}
function visualModelo(id) {
  const base = BASES[id], g = new THREE.Group(), copia = SkeletonUtils.clone(base.cena);
  copia.scale.setScalar(base.escala);
  copia.position.copy(base.desloc);
  copia.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.userData.m0 = o.material; } });
  g.add(copia);
  const mixer = new THREE.AnimationMixer(copia), acoes = {};
  for (const [papel, clip] of Object.entries(base.clipes)) acoes[papel] = mixer.clipAction(clip);
  for (const papel of ['tiro', 'dor', 'cai']) if (acoes[papel]) { acoes[papel].setLoop(THREE.LoopOnce); acoes[papel].clampWhenFinished = true; }
  let atual = acoes.parado || acoes.anda, umaVez = 0;
  atual?.play();
  const troca = (nova, fade) => { if (!nova || nova === atual) return; nova.reset().play(); atual?.crossFadeTo(nova, fade, false); atual = nova; };
  // golpes: o clipe é acelerado para caber no tempo do jogo
  const MAX = { tiro: 0.7, dor: 0.45, cai: 1.2 };
  return {
    g,
    olhar(d) { g.rotation.y = Math.atan2(d.x, d.z); },
    acao(papel) {
      const a = acoes[papel];
      if (!a) return papel === 'cai' ? 0.3 : 0;
      if (papel === 'tiro' && atual === a && umaVez > 0) return umaVez;
      const dur = Math.min(a.getClip().duration, MAX[papel]);
      a.timeScale = a.getClip().duration / dur;
      if (atual === a) atual = null; // permite repetir o mesmo golpe
      troca(a, 0.08);
      umaVez = dur;
      return dur;
    },
    update(dt, andando, morto) {
      umaVez -= dt;
      if (umaVez <= 0 && !morto) troca(andando ? acoes.anda || acoes.parado : acoes.parado || acoes.anda, 0.2);
      mixer.update(dt);
    },
    flash(on) { copia.traverse(o => { if (o.isMesh) o.material = on ? mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.8 }) : o.userData.m0; }); },
  };
}

// --- modo sprites: folhas do PMDCollab (linhas = 8 direções, colunas = quadros; durações em 1/60 s) ---
const URL_SPR = (id, arq) => `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${String(id).padStart(4, '0')}/${arq}`;
const PX = 0.075; // tamanho de um pixel do sprite no mundo
const SPR_PAPEL = { parado: ['Idle', 'Walk'], anda: ['Walk'], tiro: ['Shoot', 'Charge', 'Attack'], dor: ['Hurt'], cai: ['Faint', 'Hurt'] };
async function carregaSprite(id) {
  const xml = new DOMParser().parseFromString(await (await fetch(URL_SPR(id, 'AnimData.xml'))).text(), 'text/xml');
  const defs = {};
  for (const an of xml.querySelectorAll('Anim')) {
    const t = q => an.querySelector(q)?.textContent;
    defs[t('Name')] = { copia: t('CopyOf'), w: +t('FrameWidth'), h: +t('FrameHeight'), dur: [...an.querySelectorAll('Duration')].map(d => +d.textContent / 60) };
  }
  const real = nome => (defs[nome]?.copia || nome);
  const anims = {}, imgs = {};
  for (const [papel, nomes] of Object.entries(SPR_PAPEL)) {
    const nome = nomes.map(real).find(n => defs[n] && !defs[n].copia);
    if (!nome) continue;
    imgs[nome] ||= new THREE.TextureLoader().loadAsync(URL_SPR(id, nome + '-Anim.png'));
    const tex = await imgs[nome];
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const d = defs[nome];
    anims[papel] = { tex, ...d, cols: Math.round(tex.image.width / d.w), total: d.dur.reduce((x, y) => x + y, 0) };
  }
  if (!anims.anda) throw new Error('sprite sem Walk: ' + id);
  BASES[id] = { anims, alto: anims.anda.h * PX * 0.7 };
}
function visualSprite(id) {
  const base = BASES[id], g = new THREE.Group();
  const m = new THREE.SpriteMaterial({ alphaTest: 0.5 }), s = new THREE.Sprite(m);
  g.add(s);
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.03;
  sombra.scale.y = 0.7;
  g.add(sombra);
  const texs = {}; // cada Pokémon tem a própria cópia da textura (o quadro muda o offset)
  const dir = new THREE.Vector3(0, 0, 1);
  let papel = 'parado', t = 0, umaVez = 0;
  const usar = (p, denovo) => { if (!base.anims[p]) p = p === 'parado' ? 'anda' : 'parado'; if (p !== papel || denovo) { papel = p; t = 0; } };
  return {
    g,
    olhar(d) { if (d.lengthSq() > 1e-4) dir.copy(d).setY(0).normalize(); },
    acao(p) {
      const a = base.anims[p];
      if (!a) return p === 'cai' ? 0.3 : 0;
      if (p === 'tiro' && papel === 'tiro' && umaVez > 0) return umaVez;
      usar(p, true);
      umaVez = a.total;
      return a.total;
    },
    update(dt, andando, morto) {
      umaVez -= dt;
      if (umaVez <= 0 && !morto) usar(andando ? 'anda' : 'parado');
      const a = base.anims[papel];
      t += dt;
      // quadro: parado e andar em laço; golpes param no último quadro
      let q = 0, tt = umaVez > 0 || morto ? Math.min(t, a.total - 1e-3) : t % a.total;
      while (q < a.dur.length - 1 && tt >= a.dur[q]) { tt -= a.dur[q]; q++; }
      // direção vista da câmera: 0 baixo, 1 baixo-dir, 2 dir, 3 cima-dir, 4 cima, 5 cima-esq, 6 esq, 7 baixo-esq
      const cx = Math.cos(yaw), sx = Math.sin(yaw);
      const dx = dir.x * cx - dir.z * sx, dy = -dir.x * sx - dir.z * cx;
      const linha = ((Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 90) / 45) % 8) + 8) % 8;
      const tex = (texs[papel] ||= a.tex.clone());
      tex.repeat.set(1 / a.cols, 1 / 8);
      tex.offset.set(q / a.cols, 1 - (linha + 1) / 8);
      if (m.map !== tex) { m.map = tex; m.needsUpdate = true; }
      s.scale.set(a.w * PX, a.h * PX, 1);
      s.center.set(0.5, 0.5 - 7 / a.h); // os pés ficam ~7 px abaixo do centro do quadro
    },
    flash(on) { m.color.setRGB(1, on ? 0.45 : 1, on ? 0.45 : 1); },
  };
}

const carregaBase = SPRITES ? carregaSprite : carregaModelo;
const visual = id => (SPRITES ? visualSprite(id) : visualModelo(id));

// nome flutuando em cima do Pokémon
function etiqueta(pai, texto, y) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#000a';
  ctx.strokeText(texto, 128, 44);
  ctx.fillStyle = '#fff';
  ctx.fillText(texto, 128, 44);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(2.4, 0.6, 1);
  s.position.y = y;
  s.renderOrder = 12;
  pai.add(s);
}

const inimigos = [], caindo = [];
function novoInimigo() {
  const tipos = Object.keys(POKES).filter(t => POKES[t].some(([id]) => BASES[id]));
  if (!tipos.length) return;
  const tipo = tipos[Math.floor(rand(0, tipos.length))], esp = ESPECIES[tipo];
  const opcoes = POKES[tipo].filter(([id]) => BASES[id]), poke = opcoes[Math.floor(rand(0, opcoes.length))];
  let x, z;
  do { x = rand(-60, 60); z = rand(-60, 60); } while (!livre(x, z, 1) || Math.hypot(x - heroi.pos.x, z - heroi.pos.z) < 25);
  const raizI = new THREE.Group();
  raizI.position.set(x, 0, z);
  scene.add(raizI);
  const vis = visual(poke[0]);
  raizI.add(vis.g);
  const e = { tipo, esp, raiz: raizI, vis, hp: esp.hp, max: esp.hp, cd: rand(1, 2), ang: 0, fase: 0, vagar: new THREE.Vector3(x, 0, z), flash: 0, t: rand(0, 6), lado: Math.random() < 0.5 ? 1 : -1 };
  const y = Math.max(2.6, BASES[poke[0]].alto + 0.5);
  e.barra = barra(raizI, y);
  etiqueta(raizI, poke[1], y + 0.4);
  inimigos.push(e);
}

// companheiro: segue o herói e atira no inimigo mais perto
let comp = null;
function criaCompanheiro() {
  if (!BASES[COMPANHEIRO[0]]) return;
  const vis = visual(COMPANHEIRO[0]), r = new THREE.Group();
  r.position.set(-2, 0, -2);
  r.add(vis.g);
  scene.add(r);
  etiqueta(r, COMPANHEIRO[1], Math.max(2.5, BASES[COMPANHEIRO[0]].alto + 0.5));
  comp = { raiz: r, vis, cd: 0 };
}

const todos = [...Object.values(POKES).flat(), COMPANHEIRO];
Promise.allSettled(todos.map(([id, , metros]) => carregaBase(id, metros))).then(res => {
  res.forEach((r, i) => r.status === 'rejected' && console.warn('Pokémon não carregou:', todos[i][1], r.reason));
  for (let i = 0; i < 9; i++) novoInimigo();
  criaCompanheiro();
  aviso(inimigos.length ? (SPRITES ? 'Sprites animados!' : 'Pokémon 3D animados!') : 'Os Pokémon não carregaram');
});

// ---------- tiros e partículas ----------
const GEO_BALA = new THREE.SphereGeometry(0.28, 8, 6), GEO_MEU = new THREE.SphereGeometry(0.2, 6, 4), GEO_FAISCA = new THREE.BoxGeometry(0.15, 0.15, 0.15);
const balas = [], meus = [], faiscas = [];
function bala(x, z, ang, vel, cor) {
  const m = new THREE.Mesh(GEO_BALA, mat(cor, { emissive: cor, emissiveIntensity: 0.9 }));
  m.position.set(x, 1, z);
  scene.add(m);
  balas.push({ m, vx: Math.sin(ang) * vel, vz: Math.cos(ang) * vel, vida: 5 });
}
function explode(p, cor, n = 14) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(GEO_FAISCA, mat(cor, { emissive: cor, emissiveIntensity: 0.6 }));
    m.position.copy(p);
    m.position.y = 1;
    scene.add(m);
    faiscas.push({ m, v: new THREE.Vector3(rand(-5, 5), rand(3, 8), rand(-5, 5)), vida: rand(0.4, 0.8) });
  }
}
const bloqueia = (x, z) => solidos.some(s => !s.agua && Math.hypot(s.x - x, s.z - z) < s.r);

// ---------- entrada: teclado, mouse, controle e toque ----------
const teclas = {};
addEventListener('keydown', e => { teclas[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => { teclas[e.code] = false; });
const mouse = { ndc: new THREE.Vector2(), atirando: false, usado: false };
const ehToque = matchMedia('(pointer: coarse)').matches;
if (ehToque) document.body.classList.add('touch');
renderer.domElement.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mouse.usado = true; } });
renderer.domElement.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) mouse.atirando = true; });
addEventListener('pointerup', e => { if (e.pointerType === 'mouse') mouse.atirando = false; });
let zoom = 1, yaw = 0;
addEventListener('wheel', e => { zoom = clamp(zoom + Math.sign(e.deltaY) * 0.1, 0.6, 1.7); }, { passive: true });

// analógico na tela: toque na metade esquerda
const toque = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
const stick = document.getElementById('stick'), knob = document.getElementById('knob');
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || toque.id !== null || e.clientX > innerWidth / 2) return;
  Object.assign(toque, { id: e.pointerId, cx: e.clientX, cy: e.clientY, x: 0, y: 0 });
  stick.style.display = 'block';
  stick.style.left = e.clientX - 60 + 'px';
  stick.style.top = e.clientY - 60 + 'px';
});
addEventListener('pointermove', e => {
  if (e.pointerId !== toque.id) return;
  let dx = e.clientX - toque.cx, dy = e.clientY - toque.cy;
  const d = Math.hypot(dx, dy);
  if (d > 50) { dx *= 50 / d; dy *= 50 / d; }
  toque.x = dx / 50;
  toque.y = dy / 50;
  knob.style.left = 35 + dx + 'px';
  knob.style.top = 35 + dy + 'px';
});
addEventListener('pointerup', e => { if (e.pointerId === toque.id) { toque.id = null; toque.x = toque.y = 0; stick.style.display = 'none'; } });
addEventListener('pointercancel', e => { if (e.pointerId === toque.id) { toque.id = null; toque.x = toque.y = 0; stick.style.display = 'none'; } });
let pedeDash = false;
document.getElementById('dashbtn').addEventListener('pointerdown', e => { e.preventDefault(); pedeDash = true; });

// converte direção da tela (direita, para cima) em direção no chão, considerando o giro da câmera
function telaParaChao(ix, iy) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return new THREE.Vector3(ix * c - iy * s, 0, -ix * s - iy * c);
}

// ---------- mensagens e HUD ----------
const elMsg = document.getElementById('msg'), elHp = document.getElementById('hp'), elInfo = document.getElementById('info');
let tMsg = 0;
function aviso(t) { elMsg.textContent = t; elMsg.style.opacity = 1; tMsg = 1.6; }

// ---------- laço principal ----------
const relogio = new THREE.Clock();
const ray = new THREE.Raycaster(), planoMira = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1), pontoMira = new THREE.Vector3();
const alvoCam = new THREE.Vector3();
let padAntes = {}, fps = 60;

function quadro() {
  const dt = Math.min(relogio.getDelta(), 0.05);
  fps += (1 / Math.max(dt, 0.001) - fps) * 0.05;

  // --- leitura da entrada ---
  let ix = (teclas.KeyD || teclas.ArrowRight ? 1 : 0) - (teclas.KeyA || teclas.ArrowLeft ? 1 : 0);
  let iy = (teclas.KeyW || teclas.ArrowUp ? 1 : 0) - (teclas.KeyS || teclas.ArrowDown ? 1 : 0);
  let atira = mouse.atirando, dashAgora = teclas.Space || pedeDash, mira = null;
  pedeDash = false;
  if (teclas.KeyQ) yaw += dt * 1.8;
  if (teclas.KeyE) yaw -= dt * 1.8;
  const pad = [...(navigator.getGamepads?.() || [])].find(Boolean);
  if (pad) {
    const zm = v => (Math.abs(v) < 0.2 ? 0 : v);
    ix += zm(pad.axes[0]);
    iy -= zm(pad.axes[1]);
    const ax = zm(pad.axes[2] || 0), ay = zm(pad.axes[3] || 0);
    if (Math.hypot(ax, ay) > 0.3) { mira = telaParaChao(ax, -ay); atira = true; }
    if (pad.buttons[7]?.pressed) atira = true;
    if (pad.buttons[0]?.pressed && !padAntes.a) dashAgora = true;
    if (pad.buttons[4]?.pressed) yaw += dt * 1.8;
    if (pad.buttons[5]?.pressed) yaw -= dt * 1.8;
    padAntes = { a: pad.buttons[0]?.pressed };
  }
  if (toque.id !== null) { ix += toque.x; iy -= toque.y; }
  const mov = telaParaChao(ix, iy);
  if (mov.length() > 1) mov.normalize();

  // mira: mouse aponta no chão; no celular mira sozinha no inimigo mais perto e atira (ajuda só do celular)
  if (!mira && mouse.usado && !ehToque) {
    ray.setFromCamera(mouse.ndc, camera);
    if (ray.ray.intersectPlane(planoMira, pontoMira)) mira = pontoMira.clone().sub(heroi.pos).setY(0);
  }
  if (ehToque) {
    let melhor = null, dm = 18;
    for (const e of inimigos) { const d = e.raiz.position.distanceTo(heroi.pos); if (d < dm) { dm = d; melhor = e; } }
    if (melhor) { mira = melhor.raiz.position.clone().sub(heroi.pos).setY(0); atira = true; }
  }
  if (!mira && mov.lengthSq() > 0.01) mira = mov.clone();
  if (mira && mira.lengthSq() > 0.01) heroi.mira.copy(mira).normalize();

  // --- herói ---
  heroi.cdDash -= dt;
  heroi.invul -= dt;
  heroi.semDano += dt;
  if (dashAgora && heroi.cdDash <= 0 && heroi.hp > 0) {
    heroi.dash = 0.18;
    heroi.cdDash = 0.8;
    heroi.invul = 0.25;
    heroi.dashDir = (mov.lengthSq() > 0.01 ? mov : heroi.mira).clone().normalize();
  }
  if (heroi.hp > 0) {
    if (heroi.dash > 0) { heroi.dash -= dt; heroi.pos.addScaledVector(heroi.dashDir, 28 * dt); }
    else heroi.pos.addScaledVector(mov, 9 * dt);
    colide(heroi.pos, 0.6);
    if (heroi.semDano > 3) heroi.hp = Math.min(heroi.max, heroi.hp + 8 * dt);
    heroi.cdTiro -= dt;
    if (atira && heroi.cdTiro <= 0) {
      heroi.cdTiro = 0.16;
      const m = new THREE.Mesh(GEO_MEU, mat(0xfff3a0, { emissive: 0x7fe8ff, emissiveIntensity: 1 }));
      m.position.copy(heroi.pos).addScaledVector(heroi.mira, 0.9);
      m.position.y = 1.3;
      scene.add(m);
      meus.push({ m, v: heroi.mira.clone().multiplyScalar(26), vida: 0.9 });
    }
  }
  raiz.position.copy(heroi.pos);
  corpo.rotation.y = Math.atan2(heroi.mira.x, heroi.mira.z);
  const andando = mov.lengthSq() > 0.01 && heroi.hp > 0;
  heroi.passo += dt * (andando ? 12 : 3);
  corpo.position.y = andando ? Math.abs(Math.sin(heroi.passo)) * 0.18 : Math.sin(heroi.passo) * 0.03;
  corpo.rotation.z = andando ? Math.sin(heroi.passo) * 0.06 : 0;
  gema.rotation.y += dt * 3;
  corpo.visible = heroi.invul > 0 && heroi.dash <= 0 ? Math.floor(heroi.invul * 20) % 2 === 0 : true;

  // --- inimigos ---
  for (const e of inimigos) {
    e.t += dt;
    const p = e.raiz.position, para = heroi.pos.clone().sub(p).setY(0), dist = para.length();
    const bravo = dist < 20 && heroi.hp > 0;
    let vel = new THREE.Vector3();
    if (bravo) {
      // chega até ~9 de distância e fica rodeando você
      const dir = para.clone().normalize(), lado = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(e.lado);
      vel.addScaledVector(dir, dist > 10 ? 1 : dist < 7 ? -1 : 0).addScaledVector(lado, 0.6);
      e.vis.olhar(dir);
      e.cd -= dt;
      const ang = Math.atan2(dir.x, dir.z);
      if (e.tipo === 'brasa' && e.cd <= 0) {
        e.cd = 1.1;
        e.vis.acao('tiro');
        for (let k = -2; k <= 2; k++) bala(p.x, p.z, ang + k * 0.22, 11, e.esp.bala);
      } else if (e.tipo === 'gota' && e.cd <= 0) {
        e.cd = 2;
        e.fase = (e.fase + 1) % 2;
        e.vis.acao('tiro');
        for (let k = 0; k < 14; k++) bala(p.x, p.z, (k + e.fase * 0.5) * (Math.PI * 2 / 14), 7, e.esp.bala);
      } else if (e.tipo === 'broto' && e.cd <= 0) {
        // rajada em espiral por 2 s, depois 1,5 s de descanso
        e.fase += 0.12;
        e.vis.acao('tiro');
        e.ang += 0.45;
        bala(p.x, p.z, e.ang, 8, e.esp.bala);
        bala(p.x, p.z, e.ang + Math.PI, 8, e.esp.bala);
        e.cd = 0.12;
        if (e.fase > 2) { e.fase = 0; e.cd = 1.5; }
      }
    } else {
      if (p.distanceTo(e.vagar) < 1 || Math.random() < 0.002) e.vagar.set(clamp(p.x + rand(-12, 12), -60, 60), 0, clamp(p.z + rand(-12, 12), -60, 60));
      const d = e.vagar.clone().sub(p);
      if (d.length() > 1) { vel.copy(d.normalize()).multiplyScalar(0.5); e.vis.olhar(d); }
    }
    p.addScaledVector(vel, e.esp.vel * dt);
    colide(p, 0.9);
    e.vis.update(dt, vel.lengthSq() > 0.01, false);
    e.flash -= dt;
    e.dorCd = (e.dorCd || 0) - dt;
    e.vis.flash(e.flash > 0);
    e.barra(e.hp / e.max);
  }
  // quem desmaiou toca a animação de queda e some
  for (let i = caindo.length - 1; i >= 0; i--) {
    const c = caindo[i];
    c.tempo -= dt;
    c.vis.update(dt, false, true);
    if (c.tempo <= 0) { explode(c.raiz.position, c.esp.bala, 22); scene.remove(c.raiz); caindo.splice(i, 1); }
  }

  // --- companheiro: fica atrás do herói e atira no inimigo mais perto ---
  if (comp) {
    const alvo = heroi.pos.clone().addScaledVector(heroi.mira, -2.2).add(new THREE.Vector3(heroi.mira.z, 0, -heroi.mira.x).multiplyScalar(1.4));
    const p = comp.raiz.position, falta = alvo.sub(p).setY(0), anda = falta.length() > 0.6;
    if (falta.length() > 25) p.copy(heroi.pos);
    else if (anda) p.addScaledVector(falta.normalize(), Math.min(falta.length() * 4, 11) * dt);
    colide(p, 0.5);
    let perto = null, dm = 14;
    for (const e of inimigos) { const d = e.raiz.position.distanceTo(p); if (d < dm) { dm = d; perto = e; } }
    const olha = perto ? perto.raiz.position.clone().sub(p) : anda ? falta : heroi.mira;
    comp.vis.olhar(olha);
    comp.cd -= dt;
    if (perto && heroi.hp > 0 && comp.cd <= 0) {
      comp.cd = 0.55;
      comp.vis.acao('tiro');
      const m = new THREE.Mesh(GEO_MEU, mat(0xffe08a, { emissive: 0xffa53d, emissiveIntensity: 1 }));
      m.position.copy(p).setY(1);
      scene.add(m);
      meus.push({ m, v: olha.setY(0).normalize().multiplyScalar(20), vida: 0.9, dano: 6 });
    }
    comp.vis.update(dt, anda, false);
  }

  // --- meus tiros ---
  for (let i = meus.length - 1; i >= 0; i--) {
    const t = meus[i];
    t.m.position.addScaledVector(t.v, dt);
    t.vida -= dt;
    let fim = t.vida <= 0 || bloqueia(t.m.position.x, t.m.position.z);
    for (const e of inimigos) {
      if (fim) break;
      const p = e.raiz.position;
      if (Math.hypot(p.x - t.m.position.x, p.z - t.m.position.z) < 1.1) {
        e.hp -= t.dano || 10;
        e.flash = 0.08;
        fim = true;
        if (e.hp > 0 && e.dorCd <= 0) { e.vis.acao('dor'); e.dorCd = 1.2; }
        if (e.hp <= 0) {
          e.vis.flash(false);
          e.barra(0);
          caindo.push({ raiz: e.raiz, vis: e.vis, esp: e.esp, tempo: e.vis.acao('cai') + 0.15 });
          inimigos.splice(inimigos.indexOf(e), 1);
          heroi.abates++;
          setTimeout(novoInimigo, 5000);
        }
      }
    }
    if (fim) { scene.remove(t.m); meus.splice(i, 1); }
  }

  // --- tiros inimigos ---
  for (let i = balas.length - 1; i >= 0; i--) {
    const b = balas[i];
    b.m.position.x += b.vx * dt;
    b.m.position.z += b.vz * dt;
    b.vida -= dt;
    let fim = b.vida <= 0 || bloqueia(b.m.position.x, b.m.position.z);
    if (!fim && heroi.hp > 0 && Math.hypot(b.m.position.x - heroi.pos.x, b.m.position.z - heroi.pos.z) < 0.75) {
      fim = true;
      if (heroi.invul <= 0) {
        heroi.hp -= 12;
        heroi.invul = 0.4;
        heroi.semDano = 0;
        explode(heroi.pos, 0xff4444, 8);
        if (heroi.hp <= 0) {
          heroi.hp = 0;
          heroi.mortes++;
          aviso('Você caiu! Voltando...');
          setTimeout(() => { heroi.pos.set(0, 0, 0); heroi.hp = heroi.max; heroi.invul = 2; }, 1500);
        }
      }
    }
    if (fim) { scene.remove(b.m); balas.splice(i, 1); }
  }

  // --- partículas ---
  for (let i = faiscas.length - 1; i >= 0; i--) {
    const f = faiscas[i];
    f.v.y -= 20 * dt;
    f.m.position.addScaledVector(f.v, dt);
    f.m.rotation.x += dt * 8;
    f.vida -= dt;
    if (f.vida <= 0 || f.m.position.y < 0) { scene.remove(f.m); faiscas.splice(i, 1); }
  }

  // --- câmera de cima, inclinada, seguindo com suavidade ---
  alvoCam.lerp(heroi.pos, 1 - Math.exp(-8 * dt));
  const atras = 15 * zoom, alto = 21 * zoom;
  camera.position.set(alvoCam.x + Math.sin(yaw) * atras, alto, alvoCam.z + Math.cos(yaw) * atras);
  camera.lookAt(alvoCam.x, 1, alvoCam.z);
  sol.position.set(alvoCam.x + 25, 45, alvoCam.z + 15);
  sol.target.position.copy(alvoCam);

  // --- HUD ---
  elHp.style.width = (heroi.hp / heroi.max) * 100 + '%';
  elInfo.innerHTML = `Vida ${Math.ceil(heroi.hp)}/${heroi.max} · Abates ${heroi.abates} · Quedas ${heroi.mortes}<br>Tiros na tela: ${balas.length} · ${Math.round(fps)} FPS`;
  tMsg -= dt;
  if (tMsg <= 0) elMsg.style.opacity = 0;

  renderer.render(scene, camera);
  requestAnimationFrame(quadro);
}
aviso('Carregando Pokémon 3D...');
requestAnimationFrame(quadro);
window.__cena = { heroi, inimigos, balas, BASES, SPRITES, get comp() { return comp; } }; // para os testes automáticos
