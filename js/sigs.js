'use strict';
/* ============ Golpes de assinatura temáticos ============
 * Cada chefe importante (líderes de ginásio, chefes de masmorra, lendários e chefes finais) tem golpes tirados do
 * moveset dele: Charizard solta Labareda, Blastoise Hidro Bomba, Pidgeotto e Tornadus soltam tornados, a Miltank rola...
 * Vale para todas as regiões, de Kanto a Paldea. Os outros chefes usam 3 golpes do próprio tipo.
 * Formatos: círculo (c), faixa (l) e golpe que anda (m: tornado, redemoinho, pedra rolando, orbe), que depois do aviso
 * percorre um caminho e acerta quem tocar (uma vez). Tudo sempre avisado no chão antes de acertar.
 * fx = estilo visual quando o golpe estoura (chamas, jato d'água, raio do céu, pedras, folhas...).
 */
const sRing = (x, y, R, n, r, d, a0 = Math.random() * 6.28) => Array.from({ length: n }, (_, i) => tC(x + Math.cos(a0 + i * 6.283 / n) * R, y + Math.sin(a0 + i * 6.283 / n) * R, r, d));
const sChain = (e, t, n, r, d0, dd) => { const a = Math.atan2(t.y - e.y, t.x - e.x), L = Math.max(160, Math.hypot(t.x - e.x, t.y - e.y) + 80); return Array.from({ length: n }, (_, i) => tC(e.x + Math.cos(a) * L * (i + 1) / n, e.y + Math.sin(a) * L * (i + 1) / n, r, d0 + i * dd)); };
const sFan = (e, a, ks, len, w, d) => ks.map(k => tL(e.x, e.y, a + k, len, w, d));
const sPar = (e, a, offs, len, w, d) => offs.map(o => tL(e.x - Math.sin(a) * o, e.y + Math.cos(a) * o, a, len, w, d));
const sX = (t, a, len, w, d) => [tL(t.x - Math.cos(a + 0.785) * len / 2, t.y - Math.sin(a + 0.785) * len / 2, a + 0.785, len, w, d), tL(t.x - Math.cos(a - 0.785) * len / 2, t.y - Math.sin(a - 0.785) * len / 2, a - 0.785, len, w, d)];
const sRain = (t, n, R, r, d0, dd) => Array.from({ length: n }, (_, i) => tC(...near2(t, R), r, d0 + (i % 3) * dd));
// golpe que anda: sai de (x, y) na direção a, a spd px/s por dur s; wob = quanto serpenteia para os lados
const tM = (x, y, a, spd, dur, r, d, wob = 0, ph = 0) => ({ s: 'm', x: Math.round(x), y: Math.round(y), a: +a.toFixed(3), spd, dur, r, d: +d.toFixed(2), wob, ph: +ph.toFixed(2) });
const fwd = (e, a, k) => [e.x + Math.cos(a) * k, e.y + Math.sin(a) * k];

const SIG_MOVES = {
  // ---------- fogo ----------
  lancachamas: { nome: '🔥 Lança-Chamas', fx: 'flame', f: (e, t, a) => sFan(e, a, [-0.3, 0, 0.3], 640, 64, 1.1) },
  labareda: { nome: '🔥 Labareda', fx: 'flame', f: (e, t, a) => [tL(e.x, e.y, a, 820, 105, 1.2), ...[0, 1, 2, 3, 4].map(i => tL(t.x, t.y, a + i * 1.2566, 190, 46, 1.75))] },
  erupcao: { nome: '🌋 Erupção', fx: 'flame', f: (e, t) => Array.from({ length: 6 }, (_, i) => tC(...near2(t, 190), 70, 1.2 + (i % 2) * 0.35)) },
  anelfogo: { nome: '🔥 Redemoinho de Fogo', fx: 'flame', f: (e, t) => [...sRing(t.x, t.y, 150, 8, 58, 1.2), tC(t.x, t.y, 60, 2.1)] },
  rodafogo: { nome: '🔥 Roda de Fogo', fx: 'flame', f: (e, t, a) => [-0.4, 0, 0.4].map((k, i) => tM(e.x, e.y, a + k, 300, 2.4, 30, 1.0 + i * 0.25)) },
  investidafogo: { nome: '🔥 Investida Flamejante', fx: 'flame', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 560, 100, 0.95)] },
  chamaazul: { nome: '💙 Chama Azul', fx: 'blueflame', f: (e, t, a) => [...sFan(e, a, [-0.5, -0.25, 0, 0.25, 0.5], 680, 58, 1.2), tC(t.x, t.y, 110, 1.9)] },
  tempestademagma: { nome: '🌋 Tempestade de Magma', fx: 'flame', f: (e, t) => [...sRing(t.x, t.y, 200, 10, 55, 1.1), ...sRing(t.x, t.y, 110, 6, 55, 1.7), tC(t.x, t.y, 60, 2.3)] },
  // ---------- água ----------
  hidrobomba: { nome: '💦 Hidro Bomba', fx: 'jet', f: (e, t, a) => [tL(e.x, e.y, a, 820, 90, 1.05), tL(e.x, e.y, a + 0.35, 780, 70, 1.6), tL(e.x, e.y, a - 0.35, 780, 70, 2.1)] },
  jato: { nome: "💧 Jato d'Água", fx: 'jet', f: (e, t, a) => [0, 1, 2, 3].map(i => tL(e.x, e.y, a + (i - 1.5) * 0.12, 700, 46, 1.0 + i * 0.28)) },
  surf: { nome: '🌊 Surf', fx: 'jet', f: (e, t, a) => sPar(e, a, [-150, 150], 760, 120, 1.25) },
  redemoinho: { nome: '🌀 Redemoinho', fx: 'whirl', f: (e, t, a) => [tM(...fwd(e, a + 0.5, 40), a + 0.35, 170, 3.4, 50, 1.2, 70, 0), tM(...fwd(e, a - 0.5, 40), a - 0.35, 170, 3.4, 50, 1.5, 70, 3.1)] },
  chuva: { nome: '💧 Chuva Torrencial', fx: 'drop', f: (e, t) => sRain(t, 10, 260, 48, 1.0, 0.35) },
  giro: { nome: '⭐ Giro Rápido', fx: 'star', f: (e, t, a) => [tM(e.x, e.y, a, 400, 1.7, 32, 1.0), tM(e.x, e.y, a + 0.45, 400, 1.7, 32, 1.45), tM(e.x, e.y, a - 0.45, 400, 1.7, 32, 1.9)] },
  origem: { nome: '🌊 Pulso Original', fx: 'jet', f: (e, t, a) => [...Array.from({ length: 8 }, (_, i) => tL(e.x, e.y, a + i * 0.785, 620, 60, 1.2)), ...Array.from({ length: 8 }, (_, i) => tL(e.x, e.y, a + 0.39 + i * 0.785, 620, 60, 2.0))] },
  aquacauda: { nome: '💧 Aqua Jato', fx: 'jet', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 600, 85, 0.95)] },
  // ---------- elétrico ----------
  trovao: { nome: '⚡ Trovão', fx: 'bolt', f: (e, t) => [0.9, 1.35, 1.8, 2.25].map(d => tC(...near2(t, 70), 65, d)) },
  raio: { nome: '⚡ Raio', fx: 'bolt', f: (e, t, a) => [tL(e.x, e.y, a, 760, 60, 1.0), tL(e.x, e.y, a + 0.3, 700, 50, 1.5), tL(e.x, e.y, a - 0.3, 700, 50, 1.5)] },
  rede: { nome: '⚡ Rede Elétrica', fx: 'bolt', f: (e, t, a) => sX(t, a, 620, 58, 1.2) },
  descarga: { nome: '⚡ Descarga', fx: 'spark', f: e => [tC(e.x, e.y, 190, 1.2), ...sRing(e.x, e.y, 300, 8, 55, 1.9)] },
  bolaeletrica: { nome: '⚡ Bola Elétrica', fx: 'spark', f: (e, t, a) => [-0.5, -0.17, 0.17, 0.5].map((k, i) => tM(e.x, e.y, a + k, 260, 2.6, 28, 1.0 + i * 0.2, 35, i)) },
  investidaeletrica: { nome: '⚡ Investida Selvagem', fx: 'spark', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 580, 95, 0.95)] },
  canhaozap: { nome: '⚡ Canhão Zap', fx: 'spark', st: 2, f: (e, t, a) => [tM(e.x, e.y, a, 150, 4, 52, 1.3, 25)] },
  // ---------- planta ----------
  folhas: { nome: '🍃 Tempestade de Folhas', fx: 'leaf', f: (e, t, a) => [-0.4, 0, 0.4].map(k => tL(e.x, e.y, a + k, 620, 60, 1.1)) },
  petalas: { nome: '🌸 Dança das Pétalas', fx: 'petal', f: (e, t) => Array.from({ length: 9 }, (_, i) => tC(t.x + Math.cos(i * 0.9) * (40 + i * 22), t.y + Math.sin(i * 0.9) * (40 + i * 22), 55, 1.0 + i * 0.15)) },
  raizes: { nome: '🌿 Planta Frenética', fx: 'leaf', f: (e, t) => [...sRing(t.x, t.y, 130, 6, 58, 1.1), tC(t.x, t.y, 70, 2.0)] },
  raiosolar: { nome: '☀ Raio Solar', fx: 'sun', f: (e, t, a) => [tL(e.x, e.y, a, 860, 125, 1.6)] },
  laminafolha: { nome: '🍃 Lâmina de Folha', fx: 'leaf', f: (e, t, a) => [...sX(t, a, 560, 56, 1.05), ...sX(t, a + 0.785, 560, 56, 1.7)] },
  // ---------- gelo ----------
  nevasca: { nome: '❄ Nevasca', fx: 'ice', f: (e, t, a) => [0, 1, 2, 3].map(k => tL(e.x, e.y, a + 0.4 + k * Math.PI / 2, 560, 70, 1.2)) },
  raiogelo: { nome: '❄ Raio de Gelo', fx: 'ice', f: (e, t, a) => [tL(e.x, e.y, a, 720, 70, 1.0), tL(e.x, e.y, a + 0.22, 720, 70, 1.7), tL(e.x, e.y, a - 0.22, 720, 70, 1.7)] },
  granizo: { nome: '🧊 Granizo', fx: 'ice', f: (e, t) => sRain(t, 9, 240, 55, 1.0, 0.4) },
  presagelo: { nome: '🧊 Queda de Gelo', fx: 'ice', f: (e, t) => sChain(e, t, 6, 62, 0.95, 0.18) },
  // ---------- terra / pedra ----------
  terremoto: { nome: '🌍 Terremoto', fx: 'quake', f: e => [tC(e.x, e.y, 240, 1.5)] },
  fissura: { nome: '🌍 Fissura', fx: 'quake', f: (e, t, a) => sPar(e, a, [-110, 0, 110], 640, 55, 1.2) },
  escavar: { nome: '🕳 Escavar', fx: 'quake', tp: 1, f: (e, t) => [tC(t.x, t.y, 120, 1.4), ...sRing(t.x, t.y, 230, 6, 55, 2.0)] },
  precipicio: { nome: '⛰ Lâminas do Precipício', fx: 'rock', f: (e, t, a) => [-0.45, 0, 0.45].flatMap((k, i) => { const tt = { x: e.x + Math.cos(a + k) * 420, y: e.y + Math.sin(a + k) * 420 }; return sChain(e, tt, 5, 55, 1.0 + i * 0.15, 0.14); }) },
  broca: { nome: '🌀 Broca Giratória', fx: 'rock', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 600, 90, 0.95)] },
  deslizamento: { nome: '🪨 Deslizamento', fx: 'rock', f: (e, t) => Array.from({ length: 7 }, (_, i) => tC(...near2(t, 230), 60, 1.1 + i * 0.08)) },
  tumba: { nome: '🪨 Tumba de Rochas', fx: 'rock', f: (e, t) => sRing(t.x, t.y, 120, 8, 52, 1.3) },
  pedraafiada: { nome: '🪨 Pedra Afiada', fx: 'rock', f: (e, t) => sChain(e, t, 6, 62, 0.95, 0.18) },
  rolagem: { nome: '🪨 Rolagem', fx: 'boulder', f: (e, t, a) => [tM(e.x, e.y, a, 330, 2.4, 38, 0.95), tM(e.x, e.y, a + 0.3, 330, 2.4, 38, 1.6), tM(e.x, e.y, a - 0.3, 330, 2.4, 38, 2.2)] },
  cabecada: { nome: '💥 Cabeçada Dura', fx: 'rock', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 620, 110, 1.0)] },
  // ---------- psíquico / fantasma / sombrio ----------
  psiquico: { nome: '🔮 Psíquico', fx: 'psy', f: (e, t) => [tC(t.x, t.y, 125, 1.25)] },
  psicorte: { nome: '🔮 Psicorte', fx: 'psy', f: (e, t, a) => sX(t, a, 600, 62, 1.15) },
  futuro: { nome: '🔮 Visão do Futuro', fx: 'psy', f: (e, t) => [1.1, 1.9, 2.7].map(d => tC(...near2(t, 120), 95, d)) },
  psicoonda: { nome: '🔮 Golpe Psíquico', fx: 'psy', f: e => [...sRing(e.x, e.y, 150, 8, 48, 1.0), ...sRing(e.x, e.y, 280, 12, 48, 1.5), ...sRing(e.x, e.y, 410, 16, 48, 2.0)] },
  lustro: { nome: '✨ Brilho Purificador', fx: 'psy', f: (e, t, a) => [tL(e.x, e.y, a, 820, 100, 1.2), tC(t.x, t.y, 120, 1.8)] },
  bolasombria: { nome: '👻 Bola Sombria', fx: 'shadow', f: (e, t, a) => [0, 1, 2].map(i => tM(e.x, e.y, a + (i - 1) * 0.2, 280, 2.4, 34, 1.0 + i * 0.35)) },
  pesadelo: { nome: '👻 Pesadelo', fx: 'shadow', f: (e, t) => [...sRing(t.x, t.y, 170, 8, 55, 1.2), ...sRing(t.x, t.y, 90, 5, 50, 1.9)] },
  sombra: { nome: '👻 Sombra Ardilosa', fx: 'shadow', tp: 1, f: e => [tC(e.x, e.y, 145, 1.0)] },
  fogofatuo: { nome: '👻 Fogo-Fátuo', fx: 'ghostfire', st: 3, f: (e, t, a) => [-0.6, -0.3, 0, 0.3, 0.6].map((k, i) => tM(e.x, e.y, a + k, 150, 3.6, 26, 1.0 + i * 0.12, 45, i * 1.3)) },
  emboscada: { nome: '🌑 Emboscada', fx: 'shadow', tp: 1, f: e => [tC(e.x, e.y, 145, 1.0)] },
  pulsosombrio: { nome: '🌑 Pulso Sombrio', fx: 'shadow', f: e => [tC(e.x, e.y, 210, 1.3)] },
  golpebaixo: { nome: '🌑 Golpe Baixo', fx: 'shadow', tp: 1, f: (e, t, a) => sX(t, a, 520, 60, 1.05) },
  // ---------- lutador / normal ----------
  investida: { nome: '💥 Investida', fx: 'dust', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 540, 95, 0.95)] },
  ondachoque: { nome: '👊 Onda de Choque', fx: 'quake', f: (e, t) => sChain(e, t, 5, 75, 0.95, 0.2) },
  chutegiratorio: { nome: '🦵 Chute Giratório', fx: 'dust', f: e => [tC(e.x, e.y, 170, 1.1), ...sRing(e.x, e.y, 280, 6, 60, 1.7)] },
  esferaaura: { nome: '🔵 Esfera de Aura', fx: 'aura', f: (e, t, a) => [-0.35, 0, 0.35].map((k, i) => tM(e.x, e.y, a + k, 340, 2.0, 32, 1.0 + i * 0.3)) },
  socodinamico: { nome: '👊 Soco Dinâmico', fx: 'quake', st: 6, f: (e, t) => [tC(t.x, t.y, 130, 1.3)] },
  espadasanta: { nome: '⚔ Espada Sagrada', fx: 'steel', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 560, 90, 1.0), ...sX(t, a, 480, 50, 1.6)] },
  hiperraio: { nome: '💥 Hiper Raio', fx: 'beam', f: (e, t, a) => [tL(e.x, e.y, a, 860, 115, 1.45)] },
  pisotear: { nome: '💥 Pisotear', fx: 'quake', f: e => sRing(e.x, e.y, 150, 7, 70, 1.15) },
  esmagar: { nome: '✊ Garra Esmagadora', fx: 'quake', f: (e, t) => [tC(t.x, t.y, 150, 1.6), tC(e.x, e.y, 200, 1.1)] },
  // ---------- dragão / voador / inseto ----------
  cometa: { nome: '☄ Cometa Draco', fx: 'meteor', f: (e, t) => Array.from({ length: 5 }, (_, i) => tC(...near2(t, 200), 85, 1.2 + i * 0.22)) },
  furia: { nome: '🐉 Fúria do Dragão', fx: 'dragon', f: (e, t, a) => sFan(e, a, [-0.6, -0.3, 0, 0.3, 0.6], 600, 52, 1.2) },
  pulsodragao: { nome: '🐉 Pulso do Dragão', fx: 'dragon', f: (e, t) => [tC(t.x, t.y, 110, 1.1), ...sRing(t.x, t.y, 210, 7, 60, 1.8)] },
  garradragao: { nome: '🐉 Fúria Total', fx: 'dragon', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 580, 100, 0.95), ...sRing(t.x, t.y, 160, 6, 55, 1.8)] },
  furacao: { nome: '🌪 Furacão', fx: 'wind', f: (e, t, a) => [-0.7, 0, 0.7].map((k, i) => tM(...fwd(e, a + k, 60), a + k * 0.45, 190, 3.6, 42, 1.1 + i * 0.25, 70, i * 2)) },
  ataqueaereo: { nome: '🪶 Ataque Aéreo', fx: 'wind', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 600, 85, 0.95)] },
  rajada: { nome: '🌬 Rajada', fx: 'wind', f: (e, t, a) => sPar(e, a, [-140, 0, 140], 700, 60, 1.15) },
  aeroblast: { nome: '🌪 Aeroblast', fx: 'wind', f: (e, t, a) => [tL(e.x, e.y, a, 880, 110, 1.2), tM(...fwd(e, a + 1.2, 80), a + 0.5, 180, 3.2, 44, 1.9, 60), tM(...fwd(e, a - 1.2, 80), a - 0.5, 180, 3.2, 44, 1.9, 60, 3)] },
  enxame: { nome: '🐝 Enxame', fx: 'bug', f: (e, t) => Array.from({ length: 9 }, (_, i) => tC(...near2(t, 260), 45, 1.0 + (i % 3) * 0.25)) },
  teia: { nome: '🕸 Teia', fx: 'web', f: (e, t, a) => [...sX(t, a, 560, 50, 1.1), tC(t.x, t.y, 70, 1.8)] },
  picada: { nome: '🐛 Picada', fx: 'bug', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 520, 80, 0.95)] },
  xtesoura: { nome: '✂ Tesoura X', fx: 'slash', f: (e, t, a) => [...sX(t, a, 520, 56, 1.0), ...sX(t, a + 0.785, 520, 56, 1.55)] },
  // ---------- aço / veneno / fada ----------
  chuvaaco: { nome: '⚙ Chuva de Aço', fx: 'steel', f: (e, t) => { const o = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((i + j) % 2 === 0) o.push(tC(t.x + i * 120, t.y + j * 120, 60, 1.2)); return o; } },
  caudaferro: { nome: '⚙ Cauda de Ferro', fx: 'steel', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 560, 100, 1.0)] },
  canhaoflash: { nome: '⚙ Canhão Flash', fx: 'beam', f: (e, t, a) => [tL(e.x, e.y, a, 820, 120, 1.5)] },
  rugidotempo: { nome: '⏳ Rugido do Tempo', fx: 'time', f: (e, t) => [tC(e.x, e.y, 260, 1.7), ...sRing(t.x, t.y, 130, 6, 55, 1.1)] },
  bombalodo: { nome: '☠ Bomba de Lodo', fx: 'slime', st: 4, f: (e, t) => Array.from({ length: 4 }, () => tC(...near2(t, 150), 85, 1.2)) },
  ondatoxica: { nome: '☠ Onda Tóxica', fx: 'slime', st: 4, f: e => [tC(e.x, e.y, 200, 1.3)] },
  espinhostox: { nome: '☠ Espinhos Tóxicos', fx: 'slime', st: 4, f: (e, t) => sChain(e, t, 5, 65, 1.0, 0.2) },
  explosao: { nome: '💥 Explosão', fx: 'flame', f: e => [tC(e.x, e.y, 250, 1.9)] },
  luamagica: { nome: '🌙 Lua Mágica', fx: 'fairy', f: (e, t) => Array.from({ length: 6 }, (_, i) => tC(t.x + Math.cos(i * 1.047) * 150, t.y + Math.sin(i * 1.047) * 150, 62, 1.2)) },
  vozencantada: { nome: '🎶 Voz Encantada', fx: 'fairy', f: e => [tC(e.x, e.y, 200, 1.25)] },
  brilho: { nome: '✨ Brilho Deslumbrante', fx: 'fairy', f: (e, t) => sRain(t, 8, 220, 60, 1.0, 0.35) },
  // ---------- golpes das regiões novas (Kalos, Galar, Paldea) e dos lendários ----------
  avalanche: { nome: '🧊 Avalanche', fx: 'ice', f: (e, t, a) => [-2, -1, 0, 1, 2].map(i => tM(e.x - Math.sin(a) * i * 58, e.y + Math.cos(a) * i * 58, a, 210, 3, 34, 1.15)) },
  giragelo: { nome: '⛸ Pirueta de Gelo', fx: 'ice', f: (e, t, a) => [-0.5, 0, 0.5].map((k, i) => tM(e.x, e.y, a + k, 260, 2.6, 34, 1.0 + i * 0.3, 55, i * 2)) },
  geomancia: { nome: '🌈 Geomancia', fx: 'fairy', f: e => [...sRing(e.x, e.y, 160, 8, 55, 1.1), ...sRing(e.x, e.y, 300, 12, 55, 1.6), ...sRing(e.x, e.y, 440, 16, 55, 2.1)] },
  asamorte: { nome: '🦅 Asa da Morte', fx: 'shadow', f: (e, t, a) => [...sFan(e, a, [-0.5, -0.25, 0, 0.25, 0.5], 700, 60, 1.15), tC(t.x, t.y, 100, 1.9)] },
  eternabeam: { nome: '☠ Raio Eterno', fx: 'dragon', f: (e, t, a) => [tL(e.x, e.y, a, 900, 150, 1.6), ...sRing(e.x, e.y, 260, 10, 55, 2.3)] },
  colisao: { nome: '🦖 Curso de Colisão', fx: 'dust', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 600, 110, 1.0), tC(t.x, t.y, 150, 1.7)] },
  derrapagem: { nome: '⚡ Derrapagem Elétrica', fx: 'spark', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 600, 105, 1.0), ...sX(t, a, 520, 55, 1.7)] },
  homenagem: { nome: '👻 Última Homenagem', fx: 'ghostfire', f: (e, t) => sRain(t, 9, 250, 52, 1.0, 0.35) },
  julgamento: { nome: '✨ Julgamento', fx: 'meteor', f: (e, t) => Array.from({ length: 10 }, (_, i) => tC(...near2(t, 300), 70, 1.1 + (i % 4) * 0.25)) },
  raiocruzado: { nome: '⚡ Raio Cruzado', fx: 'bolt', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 580, 100, 0.95), ...[1.2, 1.6, 2.0].map(d => tC(...near2(t, 90), 65, d))] },
  espadagigante: { nome: '🗡 Espada Gigante', fx: 'steel', dash: 1, f: (e, t, a) => [tL(e.x, e.y, a, 620, 120, 1.0), ...sFan(t, a, [-1.2, 1.2], 300, 50, 1.6)] },
  escudogigante: { nome: '🛡 Escudo Gigante', fx: 'steel', f: (e, t, a) => [tC(e.x, e.y, 200, 1.2), ...sPar(e, a, [-120, 0, 120], 640, 60, 1.7)] },
  // ---------- golpes de suporte: só o Druida transformado usa (u = efeito; cd = recarga própria) ----------
  // status: não causam dano, só o efeito nos inimigos dentro do aviso (chefes não dormem nem ficam confusos)
  canto: { nome: '💤 Canção de Ninar', fx: 'fairy', u: 'st', ust: 1, cd: 7, f: (e, t) => [tC(t.x, t.y, 160, 1.0)] },
  hipnose: { nome: '🌀 Hipnose', fx: 'psy', u: 'st', ust: 1, cd: 7, f: (e, t, a) => [tL(e.x, e.y, a, 520, 110, 0.9)] },
  esporo: { nome: '🍄 Esporo', fx: 'petal', u: 'st', ust: 1, cd: 7, f: (e, t) => [tC(t.x, t.y, 80, 0.9), ...sRing(t.x, t.y, 120, 5, 60, 1.1)] },
  posono: { nome: '💤 Pó do Sono', fx: 'petal', u: 'st', ust: 1, cd: 7, f: (e, t) => sRain(t, 6, 150, 60, 0.9, 0.2) },
  ondatrovao: { nome: '⚡ Onda Trovão', fx: 'spark', u: 'st', ust: 2, cd: 6, f: (e, t, a) => sFan(e, a, [-0.35, 0, 0.35], 560, 70, 0.9) },
  poparalisa: { nome: '✨ Pó Paralisante', fx: 'spark', u: 'st', ust: 2, cd: 6, f: (e, t) => sRain(t, 6, 150, 60, 0.9, 0.2) },
  olhar: { nome: '👁 Olhar Paralisante', fx: 'slime', u: 'st', ust: 2, cd: 6, f: (e, t, a) => [tL(e.x, e.y, a, 600, 130, 0.8)] },
  supersom: { nome: '🔊 Supersom', fx: 'psy', u: 'st', ust: 6, cd: 6, f: e => sRing(e.x, e.y, 0, 1, 200, 0.8) },
  raioconfuso: { nome: '💫 Raio Confuso', fx: 'ghostfire', u: 'st', ust: 6, cd: 6, f: (e, t) => [tC(t.x, t.y, 140, 0.9)] },
  dancaconfusa: { nome: '💃 Dança Cambaleante', fx: 'fairy', u: 'st', ust: 6, cd: 6, f: e => [tC(e.x, e.y, 220, 0.9)] },
  // clima: muda o tempo da área por 25 s (Água e Elétrico mais fortes na chuva, Fogo no sol), para o grupo todo
  dancachuva: { nome: '🌧 Dança da Chuva', u: 'wx', wx: 'chuva', cd: 12, f: () => [] },
  diaensolarado: { nome: '☀ Dia Ensolarado', u: 'wx', wx: 'sol', cd: 12, f: () => [] },
  // cura para você e quem estiver perto
  luzlua: { nome: '🌙 Luz da Lua', u: 'heal', cd: 8, f: () => [] },
  sintese: { nome: '🌿 Síntese', u: 'heal', cd: 8, f: () => [] },
  pulsocura: { nome: '💗 Pulso Curativo', u: 'heal', cd: 8, f: () => [] },
  // incentivos para o grupo perto (os mesmos efeitos das classes de suporte)
  barreira: { nome: '🛡 Barreira', u: 'buff', bk: 'selo', dur: 5, cd: 10, f: () => [] },
  ventofavor: { nome: '🌬 Vento a Favor', u: 'buff', bk: 'pressa', dur: 6, cd: 10, f: () => [] },
  uivo: { nome: '🐺 Uivo', u: 'buff', bk: 'furia', dur: 4, cd: 10, f: () => [] },
  maoamiga: { nome: '🤝 Mão Amiga', u: 'buff', bk: 'furia', dur: 4, cd: 10, f: () => [] },
  // some no chão e sai embaixo do alvo, com dano em volta
  escavarw: { nome: '🕳 Escavar', fx: 'quake', u: 'dig', f: (e, t) => [tC(t.x, t.y, 130, 0.5)] },
  // Zorua e Zoroark: o 1º toque disfarça de um Pokémon na mira (a mesma espécie o ignora por pouco tempo); o 2º solta a Explosão Noturna
  ilusao: { nome: '🦊 Ilusão', u: 'illu', cd: 6, f: () => [] },
  explosaonoturna: { nome: '🌑 Explosão Noturna', fx: 'shadow', f: e => [tC(e.x, e.y, 200, 0.6), ...sRing(e.x, e.y, 320, 10, 55, 1.0)] },
  // Magikarp e Ditto
  splash: { nome: '💦 Splash', u: 'nada', cd: 2, f: () => [] },
  transformar: { nome: '🟣 Transformação', u: 'copy', f: () => [] },
  terablast: { nome: '💎 Explosão Tera', fx: 'star', f: (e, t, a) => [tL(e.x, e.y, a, 840, 110, 1.3), ...sRing(t.x, t.y, 150, 8, 50, 1.9)] },
};

// golpes de cada chefe, tirados do moveset dele
const SIG_SPECIES = {
  // ginásios de Kanto e Mewtwo
  95: ['deslizamento', 'tumba', 'rolagem'], 121: ['hidrobomba', 'giro', 'psiquico'], 26: ['trovao', 'bolaeletrica', 'investidaeletrica'],
  45: ['petalas', 'raiosolar', 'bombalodo'], 110: ['bombalodo', 'ondatoxica', 'explosao'], 65: ['psicoonda', 'psicorte', 'futuro'],
  59: ['lancachamas', 'labareda', 'rodafogo'], 112: ['terremoto', 'deslizamento', 'rolagem'], 150: ['psicoonda', 'psiquico', 'futuro'],
  // Johto e Lugia
  17: ['furacao', 'rajada', 'ataqueaereo'], 123: ['xtesoura', 'ataqueaereo', 'enxame'], 241: ['rolagem', 'pisotear', 'investida'],
  94: ['bolasombria', 'pesadelo', 'sombra'], 62: ['socodinamico', 'hidrobomba', 'ondachoque'], 208: ['caudaferro', 'terremoto', 'tumba'],
  221: ['nevasca', 'terremoto', 'granizo'], 230: ['hidrobomba', 'redemoinho', 'pulsodragao'], 249: ['aeroblast', 'furacao', 'redemoinho'],
  // Hoenn e Kyogre
  299: ['tumba', 'canhaozap', 'deslizamento'], 297: ['ondachoque', 'investida', 'socodinamico'], 310: ['trovao', 'bolaeletrica', 'raio'],
  324: ['erupcao', 'anelfogo', 'lancachamas'], 289: ['hiperraio', 'pisotear', 'investida'], 334: ['furacao', 'cometa', 'rajada'],
  338: ['raiosolar', 'deslizamento', 'psiquico'], 350: ['hidrobomba', 'redemoinho', 'raiogelo'], 382: ['origem', 'hidrobomba', 'redemoinho'],
  // Sinnoh e Dialga
  409: ['cabecada', 'deslizamento', 'pedraafiada'], 407: ['petalas', 'bombalodo', 'raiosolar'], 448: ['esferaaura', 'ondachoque', 'investida'],
  419: ['jato', 'redemoinho', 'aquacauda'], 429: ['fogofatuo', 'bolasombria', 'pesadelo'], 411: ['canhaoflash', 'chuvaaco', 'tumba'],
  460: ['nevasca', 'granizo', 'folhas'], 466: ['trovao', 'bolaeletrica', 'investidaeletrica'], 483: ['rugidotempo', 'canhaoflash', 'cometa'],
  // Unova e Reshiram
  512: ['folhas', 'laminafolha', 'raiosolar'], 505: ['hiperraio', 'investida', 'pisotear'], 542: ['xtesoura', 'folhas', 'teia'],
  523: ['investidaeletrica', 'trovao', 'bolaeletrica'], 530: ['terremoto', 'escavar', 'broca'], 581: ['furacao', 'rajada', 'hidrobomba'],
  614: ['nevasca', 'presagelo', 'raiogelo'], 612: ['garradragao', 'furia', 'xtesoura'], 643: ['chamaazul', 'labareda', 'cometa'],
  // chefes das masmorras
  6: ['labareda', 'lancachamas', 'furacao'], 9: ['hidrobomba', 'jato', 'surf'], 3: ['raiosolar', 'petalas', 'raizes'],
  477: ['bolasombria', 'pesadelo', 'sombra'], 473: ['nevasca', 'terremoto', 'presagelo'], 464: ['deslizamento', 'terremoto', 'rolagem'],
  635: ['cometa', 'furia', 'pulsosombrio'],
  // lendários
  144: ['nevasca', 'raiogelo', 'furacao'], 145: ['trovao', 'descarga', 'furacao'], 146: ['labareda', 'anelfogo', 'furacao'],
  243: ['trovao', 'investidaeletrica', 'descarga'], 244: ['erupcao', 'labareda', 'anelfogo'], 245: ['hidrobomba', 'redemoinho', 'raiogelo'],
  377: ['pedraafiada', 'terremoto', 'tumba'], 378: ['nevasca', 'raiogelo', 'granizo'], 379: ['canhaoflash', 'chuvaaco', 'caudaferro'],
  380: ['lustro', 'psicoonda', 'pulsodragao'], 381: ['lustro', 'pulsodragao', 'cometa'],
  480: ['psicoonda', 'futuro', 'psiquico'], 481: ['psicoonda', 'luamagica', 'futuro'], 482: ['psicorte', 'psicoonda', 'futuro'],
  485: ['tempestademagma', 'erupcao', 'labareda'], 486: ['esmagar', 'pisotear', 'hiperraio'], 488: ['luamagica', 'psicoonda', 'futuro'],
  638: ['espadasanta', 'canhaoflash', 'caudaferro'], 639: ['espadasanta', 'pedraafiada', 'terremoto'], 640: ['espadasanta', 'laminafolha', 'folhas'],
  641: ['furacao', 'rajada', 'ataqueaereo'], 642: ['trovao', 'bolaeletrica', 'raio'], 645: ['precipicio', 'terremoto', 'pedraafiada'],
  383: ['precipicio', 'erupcao', 'terremoto'], 384: ['cometa', 'furacao', 'garradragao'], 250: ['labareda', 'anelfogo', 'furacao'],
  487: ['sombra', 'pesadelo', 'bolasombria'], 484: ['hidrobomba', 'furia', 'redemoinho'], 644: ['raiocruzado', 'trovao', 'cometa'],
  151: ['psiquico', 'futuro', 'esferaaura'], 251: ['laminafolha', 'futuro', 'petalas'], 385: ['futuro', 'chuvaaco', 'psiquico'], 386: ['psicoonda', 'hiperraio', 'psicorte'],
  490: ['surf', 'chuva', 'redemoinho'], 491: ['pesadelo', 'pulsosombrio', 'emboscada'], 492: ['raiosolar', 'petalas', 'laminafolha'], 493: ['julgamento', 'hiperraio', 'cometa'],
  494: ['investidafogo', 'labareda', 'psiquico'], 646: ['nevasca', 'presagelo', 'cometa'], 647: ['espadasanta', 'hidrobomba', 'aquacauda'],
  648: ['vozencantada', 'psiquico', 'chutegiratorio'], 649: ['canhaoflash', 'xtesoura', 'raio'],
  // Kalos e Xerneas / Yveltal
  666: ['furacao', 'enxame', 'rajada'], 696: ['cabecada', 'garradragao', 'pedraafiada'], 673: ['laminafolha', 'investida', 'terremoto'],
  695: ['raio', 'descarga', 'bolaeletrica'], 700: ['luamagica', 'vozencantada', 'brilho'], 678: ['psiquico', 'psicoonda', 'futuro'],
  713: ['avalanche', 'presagelo', 'cabecada'], 716: ['geomancia', 'luamagica', 'brilho'], 717: ['asamorte', 'furacao', 'pulsosombrio'],
  718: ['precipicio', 'terremoto', 'cometa'], 719: ['pedraafiada', 'brilho', 'tumba'], 720: ['psicoonda', 'futuro', 'pulsosombrio'], 721: ['hidrobomba', 'erupcao', 'labareda'],
  // Galar e Eternatus
  830: ['petalas', 'rajada', 'folhas'], 834: ['rolagem', 'hidrobomba', 'pedraafiada'], 851: ['anelfogo', 'lancachamas', 'rodafogo'],
  68: ['socodinamico', 'ondachoque', 'chutegiratorio'], 869: ['luamagica', 'brilho', 'vozencantada'], 839: ['tumba', 'erupcao', 'deslizamento'],
  862: ['golpebaixo', 'emboscada', 'investida'], 884: ['canhaoflash', 'cometa', 'caudaferro'], 890: ['eternabeam', 'cometa', 'bombalodo'],
  888: ['espadagigante', 'espadasanta', 'luamagica'], 889: ['escudogigante', 'cabecada', 'esferaaura'], 892: ['golpebaixo', 'socodinamico', 'ondachoque'],
  893: ['laminafolha', 'raizes', 'golpebaixo'], 894: ['descarga', 'rede', 'investidaeletrica'], 895: ['cometa', 'furia', 'pulsodragao'],
  896: ['presagelo', 'nevasca', 'pisotear'], 897: ['bolasombria', 'pesadelo', 'sombra'], 898: ['psicoonda', 'futuro', 'raiosolar'],
  // Paldea e Koraidon / Miraidon
  920: ['picada', 'xtesoura', 'golpebaixo'], 930: ['raiosolar', 'petalas', 'raizes'], 939: ['descarga', 'canhaozap', 'trovao'],
  976: ['jato', 'psicorte', 'aquacauda'], 982: ['hiperraio', 'broca', 'pisotear'], 972: ['homenagem', 'bolasombria', 'sombra'],
  956: ['psicoonda', 'psiquico', 'futuro'], 975: ['giragelo', 'presagelo', 'pisotear'], 1007: ['colisao', 'garradragao', 'labareda'], 1008: ['derrapagem', 'pulsodragao', 'trovao'],
  1001: ['folhas', 'raizes', 'pulsosombrio'], 1002: ['presagelo', 'granizo', 'golpebaixo'], 1003: ['terremoto', 'fissura', 'pulsosombrio'], 1004: ['lancachamas', 'anelfogo', 'pulsosombrio'],
  1014: ['socodinamico', 'bombalodo', 'ondachoque'], 1015: ['psicoonda', 'bombalodo', 'futuro'], 1016: ['ataqueaereo', 'bombalodo', 'luamagica'],
  1017: ['laminafolha', 'investida', 'raizes'], 1024: ['terablast', 'tumba', 'psicoonda'], 1025: ['bombalodo', 'ondatoxica', 'bolasombria'],
};
// quem não tem golpes próprios usa os do tipo
const SIG_TYPE = {
  fire: ['erupcao', 'lancachamas', 'anelfogo'], water: ['hidrobomba', 'surf', 'chuva'], electric: ['trovao', 'rede', 'descarga'],
  grass: ['folhas', 'raizes', 'petalas'], ice: ['nevasca', 'raiogelo', 'granizo'], ground: ['terremoto', 'fissura', 'escavar'],
  rock: ['deslizamento', 'pedraafiada', 'tumba'], psychic: ['psiquico', 'psicorte', 'futuro'], ghost: ['sombra', 'bolasombria', 'pesadelo'],
  dark: ['emboscada', 'pulsosombrio', 'golpebaixo'], fighting: ['investida', 'ondachoque', 'chutegiratorio'], normal: ['investida', 'hiperraio', 'pisotear'],
  dragon: ['cometa', 'furia', 'pulsodragao'], poison: ['bombalodo', 'ondatoxica', 'espinhostox'], flying: ['furacao', 'ataqueaereo', 'rajada'],
  bug: ['enxame', 'teia', 'picada'], steel: ['chuvaaco', 'caudaferro', 'canhaoflash'], fairy: ['luamagica', 'vozencantada', 'brilho'],
};
/* ---------- O golpe único do Druida na Forma Selvagem ----------
 * Os chefes sorteiam entre os 3 golpes deles; o Druida transformado usa sempre UM golpe, o que mais combina com o Pokémon
 * (previsível para quem joga). Quem tem golpes próprios usa o primeiro da lista ou o escolhido aqui; os outros usam o
 * golpe padrão do tipo, ou um dos golpes do tipo que o Pokémon aprende nos jogos (WILD_LEARN, tirado dos golpes da PokeAPI).
 */
const WILD_ONE = {
  121: 'giro', 110: 'explosao', 419: 'aquacauda', 466: 'investidaeletrica', 512: 'laminafolha', 530: 'broca', 614: 'presagelo', 6: 'lancachamas',
  464: 'deslizamento', 645: 'terremoto', 251: 'futuro', 678: 'psicoonda', 869: 'brilho', 893: 'raizes', 894: 'rede', 895: 'furia', 982: 'broca', 297: 'socodinamico',
};
const WILD_DEF = { fire: 'lancachamas', water: 'hidrobomba', electric: 'trovao', grass: 'folhas', ice: 'nevasca', ground: 'terremoto', rock: 'deslizamento', psychic: 'psiquico',
  ghost: 'bolasombria', dark: 'pulsosombrio', fighting: 'chutegiratorio', normal: 'hiperraio', dragon: 'cometa', poison: 'bombalodo', flying: 'furacao', bug: 'enxame', steel: 'canhaoflash', fairy: 'luamagica' };
const WILD_LEARN = {}; for (const [k, ids] of Object.entries({ petalas: [1, 2, 43, 44, 45, 182, 192, 315, 406, 407, 420, 421, 549, 556, 930], raizes: [3, 154, 254, 389, 497, 652, 724, 812, 908], investida: [19, 52, 133, 161, 190, 216, 263, 287, 288, 399, 440, 446, 506, 507, 532, 533, 534, 572, 619, 659, 676, 701, 734, 739, 740, 759, 760, 819, 870, 889, 891, 892, 915, 924, 992, 1007], ataqueaereo: [21, 22, 83, 84, 85, 277, 519, 520, 731, 732, 821], brilho: [39, 40, 174, 209, 210, 684, 685, 764, 868, 869, 926, 927, 985], ondachoque: [56, 57, 67, 68, 107, 236, 296, 297, 307, 308, 447, 448, 620, 766, 903, 979], surf: [98, 270, 349, 366, 400, 580], erupcao: [155, 156, 157, 244, 323, 324], picada: [167, 168, 214, 545, 588, 589], teia: [213, 736, 737, 824], pisotear: [293, 294, 626, 831], caudaferro: [304, 305, 863], chuvaaco: [375, 376, 385], chuva: [771], golpebaixo: [827], anelfogo: [850], pedraafiada: [1022] })) for (const id of ids) WILD_LEARN[id] = k;
// golpes de suporte de cada Pokémon (Jigglypuff canta, Diglett cava, Politoed chama a chuva...)
const WILD_UTIL = {};
for (const [k, ids] of Object.entries({
  canto: [39, 40, 174, 401, 402], hipnose: [96, 97, 92, 93, 60, 61, 163, 164, 280, 281, 686, 687, 517, 518, 504, 505], esporo: [46, 47, 285, 286, 590, 591], posono: [12, 43, 44, 69, 70, 71, 182, 315, 406, 548, 549],
  ondatrovao: [172, 179, 180, 181, 417, 587, 702, 777, 921, 922, 923, 859, 860, 861], poparalisa: [48, 49, 269, 742, 743], olhar: [23, 24, 206, 336],
  supersom: [41, 42, 169, 535, 536, 537, 441], raioconfuso: [170, 171, 200], dancaconfusa: [327],
  dancachuva: [186, 278, 279, 270, 271, 272], diaensolarado: [37, 38, 191, 192, 420, 421, 357],
  luzlua: [35, 36, 173, 197, 337], sintese: [152, 153, 154, 556], pulsocura: [113, 242, 440, 531, 594, 577, 578, 579, 175, 176, 468, 858, 868, 869, 764],
  barreira: [122, 439, 436, 437, 876, 856, 857, 866, 561, 825, 826, 832, 416], ventofavor: [187, 188, 189, 333, 425, 426, 546, 547, 580], uivo: [261, 262, 228, 229, 506, 507, 508, 744, 835, 836], maoamiga: [311, 312],
  escavarw: [50, 51, 27, 28, 529, 960, 961, 328], splash: [129], transformar: [132], ilusao: [570, 571],
})) for (const id of ids) WILD_UTIL[id] = k;
const wildSigKey = (pid, type) => WILD_UTIL[pid] || WILD_ONE[pid] || (SIG_SPECIES[pid] && SIG_SPECIES[pid][0]) || WILD_LEARN[pid] || WILD_DEF[type] || 'investida';

// escolhe o próximo golpe do chefe: sorteia entre os dele, sem repetir o último
function sigPick(e) {
  const L = SIG_SPECIES[e.pid] || SIG_TYPE[e.type] || SIG_TYPE.normal;
  const opts = L.length > 1 ? L.filter(k => k !== e.lastSig) : L, k = pick(opts);
  e.lastSig = k;
  return SIG_MOVES[k];
}

/* ---------- golpes que andam ---------- */
function sigMovePos(o) {
  const k = o.act || 0, along = o.spd * k, side = (o.wob || 0) * Math.sin(k * 3.2 + (o.ph || 0));
  return { x: o.x + Math.cos(o.a) * along - Math.sin(o.a) * side, y: o.y + Math.sin(o.a) * along + Math.cos(o.a) * side };
}

/* ---------- visual ---------- */
const SIG_STYLE = {
  flame: { c: ['#fef08a', '#fde047', '#fdba74', '#fb923c', '#f97316', '#ef4444'], beam: '#fb923c', rise: 1 },
  blueflame: { c: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#60a5fa', '#ffffff'], beam: '#38bdf8', rise: 1 },
  jet: { c: ['#ffffff', '#e0f2fe', '#7dd3fc', '#38bdf8', '#3b82f6'], beam: '#60a5fa' },
  drop: { c: ['#e0f2fe', '#7dd3fc', '#3b82f6'] },
  whirl: { c: ['#e0f2fe', '#7dd3fc', '#2563eb'] },
  star: { c: ['#fde68a', '#c4b5fd', '#ffffff'] },
  bolt: { c: ['#fef9c3', '#fde047', '#facc15', '#ffffff'], beam: '#fde047', sky: 1 },
  spark: { c: ['#fef9c3', '#fde047', '#facc15'] },
  leaf: { c: ['#bbf7d0', '#4ade80', '#16a34a', '#a3e635'], swirl: 1 },
  petal: { c: ['#fbcfe8', '#f9a8d4', '#f472b6', '#ffffff'], swirl: 1 },
  sun: { c: ['#ffffff', '#fef9c3', '#fde047'], beam: '#fef08a' },
  ice: { c: ['#ffffff', '#e0f2fe', '#a5f3fc', '#67e8f9'] },
  quake: { c: ['#a16207', '#92400e', '#d6d3d1', '#78716c'] },
  rock: { c: ['#78716c', '#a8a29e', '#57534e', '#d6d3d1'], big: 1 },
  boulder: { c: ['#78716c', '#a8a29e', '#d6d3d1'] },
  psy: { c: ['#f9a8d4', '#f472b6', '#e879f9'], rings: 1 },
  shadow: { c: ['#581c87', '#7c3aed', '#1f1235', '#a78bfa'], rise: 1 },
  ghostfire: { c: ['#c4b5fd', '#8b5cf6', '#6d28d9'], rise: 1 },
  aura: { c: ['#bfdbfe', '#60a5fa', '#2563eb', '#ffffff'] },
  dust: { c: ['#d6d3d1', '#a8a29e', '#e7e5e4'] },
  beam: { c: ['#ffffff', '#fde68a', '#fdba74'], beam: '#fff7ed' },
  meteor: { c: ['#c4b5fd', '#a78bfa', '#f0abfc', '#ffffff'], sky: 1, big: 1 },
  dragon: { c: ['#a78bfa', '#818cf8', '#c084fc', '#f0abfc'], rise: 1 },
  wind: { c: ['#ffffff', '#e2e8f0', '#cbd5e1'], swirl: 1 },
  bug: { c: ['#bef264', '#a3e635', '#65a30d'] },
  web: { c: ['#ffffff', '#e5e7eb'] },
  slash: { c: ['#ffffff', '#d9f99d', '#a3e635'], beam: '#ecfccb' },
  steel: { c: ['#ffffff', '#e5e7eb', '#9ca3af', '#fde68a'] },
  time: { c: ['#a5f3fc', '#60a5fa', '#ffffff'], rings: 1 },
  slime: { c: ['#c084fc', '#a855f7', '#7e22ce', '#d8b4fe'], big: 1 },
  fairy: { c: ['#fbcfe8', '#ffffff', '#f9a8d4', '#fde68a'] },
};
// partículas quando o golpe estoura (cx, cy = centro do círculo ou meio da faixa)
function sigBurst(o, cx, cy) {
  const S = SIG_STYLE[o.fx];
  if (!S) { burst(cx, cy, TYPE_COLORS[o.ty] || '#fca5a5', o.s === 'c' ? 18 : 26); return; }
  const col = () => S.c[Math.floor(Math.random() * S.c.length)];
  const big = S.big ? 2 : 0;
  if (o.s === 'l') {
    // faixa: um jato de partículas correndo do começo ao fim (chamas, água, vento, raio...)
    const ca = Math.cos(o.a), sa = Math.sin(o.a);
    for (let i = 0; i < 46; i++) {
      const k = Math.random() * o.len, side = (Math.random() - 0.5) * o.w * 0.8, sp = rand(160, 420);
      G.parts.push({ x: o.x + ca * k - sa * side, y: o.y + sa * k + ca * side, vx: ca * sp + (S.swirl ? -sa * rand(-120, 120) : 0), vy: sa * sp + (S.swirl ? ca * rand(-120, 120) : 0) - (S.rise ? rand(20, 80) : 0), life: rand(0.35, 0.75), color: col(), size: rand(3, 6) + big });
    }
    if (S.beam) G.fx.push({ k: 'beam', x: o.x, y: o.y, a: o.a, len: o.len, w: o.w * 0.7, color: S.beam, life: 0.3, max: 0.3 });
  } else {
    const R = o.r || 40;
    for (let i = 0; i < (o.s === 'm' ? 16 : 26); i++) {
      const a = Math.random() * 6.28, d = Math.random() * R * 0.8, sp = rand(60, 220);
      G.parts.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, vx: S.swirl ? -Math.sin(a) * sp : Math.cos(a) * sp, vy: (S.swirl ? Math.cos(a) * sp : Math.sin(a) * sp) - (S.rise ? rand(60, 160) : 0), life: rand(0.35, 0.8), color: col(), size: rand(3, 6) + big });
    }
    // raio ou meteoro caindo do céu
    if (S.sky) {
      const pts = []; for (let i = 0; i <= 6; i++) pts.push([cx + (o.fx === 'meteor' ? -160 * (1 - i / 6) : (i && i < 6 ? rand(-22, 22) : 0)), cy - 420 * (1 - i / 6)]);
      G.fx.push({ k: 'bolt', pts, color: S.c[1], life: 0.25, max: 0.25 });
    }
    if (S.rings) G.fx.push({ k: 'ring', x: cx, y: cy, r: 0, R: R * 1.4, life: 0.5, max: 0.5, color: S.c[1] });
  }
}
// rastro dos golpes que andam
function sigTrail(o, p) {
  const S = SIG_STYLE[o.fx];
  if (!S || Math.random() > 0.6) return;
  const c = S.c[Math.floor(Math.random() * S.c.length)];
  G.parts.push({ x: p.x + rand(-o.r * 0.6, o.r * 0.6), y: p.y + rand(-o.r * 0.6, o.r * 0.6), vx: rand(-30, 30), vy: S.rise ? -rand(30, 80) : rand(-30, 30), life: rand(0.3, 0.6), color: c, size: rand(2, 5) });
}
// desenho do golpe que anda: tornado, redemoinho, pedra rolando, estrela, orbes
function sigDrawMover(o, x, y) {
  const t = G.time, r = o.r, S = SIG_STYLE[o.fx] || { c: [TYPE_COLORS[o.ty] || '#fca5a5'] };
  ctx.save();
  if (o.fx === 'wind') {
    // tornado: funil de elipses girando, mais largo em cima
    for (let i = 0; i < 7; i++) {
      const k = i / 6, wob = Math.sin(t * 9 + i * 0.9) * 5 * k;
      ctx.strokeStyle = `rgba(241,245,249,${0.85 - k * 0.3})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x + wob, y + r * 0.4 - i * r * 0.32, r * (0.3 + k * 0.9), r * (0.12 + k * 0.22), 0, 0, 7); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(148,163,184,.25)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.45, r * 0.6, r * 0.2, 0, 0, 7); ctx.fill();
  } else if (o.fx === 'whirl') {
    // redemoinho: arcos azuis girando
    ctx.fillStyle = 'rgba(37,99,235,.35)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.strokeStyle = i % 2 ? '#e0f2fe' : '#60a5fa'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * (0.3 + i * 0.22), t * (4 + i) + i, t * (4 + i) + i + 3.6); ctx.stroke(); }
  } else if (o.fx === 'boulder') {
    // pedra rolando
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.8, r * 0.9, r * 0.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#78716c'; ctx.strokeStyle = '#292524'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    const sp = t * o.spd / r;
    ctx.strokeStyle = '#44403c'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const a = sp + i * 2.1; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2); ctx.lineTo(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85); ctx.stroke(); }
    ctx.fillStyle = '#a8a29e'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.2, 0, 7); ctx.fill();
  } else if (o.fx === 'star') {
    // estrela girando (Giro Rápido)
    ctx.translate(x, y); ctx.rotate(t * 14);
    ctx.fillStyle = '#c4b5fd'; ctx.strokeStyle = '#4c1d95'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f87171'; ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, 7); ctx.fill();
  } else if (o.fx === 'flame') {
    // roda de fogo
    ctx.fillStyle = 'rgba(249,115,22,.45)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fde047'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r * 0.75, t * 10, t * 10 + 4.5); ctx.stroke();
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, -t * 8, -t * 8 + 4); ctx.stroke();
  } else {
    // orbe brilhante (elétrico, aura, sombra, fogo-fátuo)
    const c0 = S.c[0], c1 = S.c[1] || c0, pul = 1 + Math.sin(t * 12) * 0.08;
    ctx.globalAlpha = 0.35; ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x, y, r * 1.35 * pul, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x, y, r * pul, 0, 7); ctx.fill();
    ctx.fillStyle = c0; ctx.beginPath(); ctx.arc(x, y, r * 0.55 * pul, 0, 7); ctx.fill();
    if (o.fx === 'spark') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4); ctx.stroke(); } }
  }
  ctx.restore();
}
