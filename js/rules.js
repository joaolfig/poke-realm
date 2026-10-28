'use strict';
/* ============ Atributos (D&D simplificado) ============ */
const ATTRS = ['POD', 'AGI', 'VIG'];
const ATTR_NAMES = { POD: 'Poder', AGI: 'Agilidade', VIG: 'Vigor' };
const ATTR_DESC = {
  POD: '+1 de dano por ponto e +½ no acerto. Fortalece as habilidades.',
  AGI: '+½ CA por ponto, mais velocidade e cadência de tiro.',
  VIG: '+1 PV por nível para cada ponto e mais regeneração.',
};
const ATTR_MAX = 10;

/* ============ Tipos ============ */
const TYPE_PT = {
  normal: 'Normal', fire: 'Fogo', water: 'Água', grass: 'Planta', electric: 'Elétrico', ice: 'Gelo', fighting: 'Lutador',
  poison: 'Veneno', ground: 'Terra', flying: 'Voador', psychic: 'Psíquico', bug: 'Inseto', rock: 'Pedra', ghost: 'Fantasma',
  dragon: 'Dragão', dark: 'Sombrio', steel: 'Aço', fairy: 'Fada',
};
const TYPES = Object.keys(TYPE_PT);
// s = super efetivo (×2), w = pouco efetivo (×½), i = imune (aqui ×¼ para não travar o jogo)
const TYPE_CHART = {
  normal: { s: [], w: ['rock', 'steel'], i: ['ghost'] },
  fire: { s: ['grass', 'ice', 'bug', 'steel'], w: ['fire', 'water', 'rock', 'dragon'], i: [] },
  water: { s: ['fire', 'ground', 'rock'], w: ['water', 'grass', 'dragon'], i: [] },
  electric: { s: ['water', 'flying'], w: ['electric', 'grass', 'dragon'], i: ['ground'] },
  grass: { s: ['water', 'ground', 'rock'], w: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'], i: [] },
  ice: { s: ['grass', 'ground', 'flying', 'dragon'], w: ['fire', 'water', 'ice', 'steel'], i: [] },
  fighting: { s: ['normal', 'ice', 'rock', 'dark', 'steel'], w: ['poison', 'flying', 'psychic', 'bug', 'fairy'], i: ['ghost'] },
  poison: { s: ['grass', 'fairy'], w: ['poison', 'ground', 'rock', 'ghost'], i: ['steel'] },
  ground: { s: ['fire', 'electric', 'poison', 'rock', 'steel'], w: ['grass', 'bug'], i: ['flying'] },
  flying: { s: ['grass', 'fighting', 'bug'], w: ['electric', 'rock', 'steel'], i: [] },
  psychic: { s: ['fighting', 'poison'], w: ['psychic', 'steel'], i: ['dark'] },
  bug: { s: ['grass', 'psychic', 'dark'], w: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'], i: [] },
  rock: { s: ['fire', 'ice', 'flying', 'bug'], w: ['fighting', 'ground', 'steel'], i: [] },
  ghost: { s: ['psychic', 'ghost'], w: ['dark'], i: ['normal'] },
  dragon: { s: ['dragon'], w: ['steel'], i: ['fairy'] },
  dark: { s: ['psychic', 'ghost'], w: ['fighting', 'dark', 'fairy'], i: [] },
  steel: { s: ['ice', 'rock', 'fairy'], w: ['fire', 'water', 'electric', 'steel'], i: [] },
  fairy: { s: ['fighting', 'dragon', 'dark'], w: ['fire', 'poison', 'steel'], i: [] },
};
function typeEff(atk, defs) {
  const c = TYPE_CHART[atk];
  if (!c) return 1;
  let m = 1;
  for (const t of defs) {
    if (c.s.includes(t)) m *= 2;
    else if (c.w.includes(t)) m *= 0.5;
    else if (c.i.includes(t)) m *= 0.25;
  }
  return Math.max(0.25, Math.min(4, m));
}

/* ============ Raças ============ */
const RACES = {
  humano: { nome: 'Humano', icon: '🧑', bonus: {}, points: 2, resist: [], traco: 'Versátil: começa com 2 pontos de atributo extras.' },
  elfo: { nome: 'Elfo', icon: '🧝', bonus: { AGI: 1 }, points: 0, resist: ['psychic'], traco: 'Vê inimigos no minimapa e atira 15% mais longe. Resiste a Psíquico.' },
  anao: { nome: 'Anão', icon: '🧔', bonus: { VIG: 1 }, points: 0, resist: ['poison', 'rock'], traco: '+1 PV por nível. Resiste a Veneno e Pedra.' },
  halfling: { nome: 'Halfling', icon: '🍀', bonus: { AGI: 1 }, points: 0, resist: [], traco: 'Rerola o 1 natural nos ataques e tem +1 na CA.' },
  tiefling: { nome: 'Tiefling', icon: '😈', bonus: { POD: 1 }, points: 0, resist: ['fire', 'dark'], traco: 'Resiste a Fogo e Sombrio.' },
  draconato: { nome: 'Draconato', icon: '🐲', bonus: { POD: 1 }, points: 0, resist: ['dragon', 'fire'], traco: 'Escamas: +1 CA. Resiste a Dragão e Fogo.' },
};

/* ============ Subclasses (nível 10) ============ */
const SUBCLASSES = {
  guerreiro: [
    { id: 'barbaro', nome: 'Bárbaro', icon: '🪓', desc: '+25% PV máximos. Berserk dura 7s e corta pela metade o dano recebido.' },
    { id: 'paladino', nome: 'Paladino', icon: '🛡️', desc: '+2 CA. Berserk também cura você e aliados próximos em 2d8 + nível.' },
  ],
  mago: [
    { id: 'evocador', nome: 'Evocador', icon: '🔥', desc: 'Bomba Arcana com 28 projéteis (em vez de 20) e +1d8 de dano em cada.' },
    { id: 'necromante', nome: 'Necromante', icon: '💀', desc: 'Pokémon que você derrota têm 30% de chance de voltar como espírito aliado por 15s (máx. 3).' },
  ],
  ladino: [
    { id: 'assassino', nome: 'Assassino', icon: '🗡️', desc: 'Margem de crítico +1 e críticos causam +50% de dano.' },
    { id: 'trapaceiro', nome: 'Trapaceiro', icon: '🎭', desc: 'O Manto te teleporta até o cursor e a invisibilidade dura 5s.' },
  ],
  clerigo: [
    { id: 'vida', nome: 'Domínio da Vida', icon: '💖', desc: 'Curas 50% mais fortes e aliados perto de você regeneram PV.' },
    { id: 'guerra', nome: 'Domínio da Guerra', icon: '⚔️', desc: '+2 CA e seus tiros causam +1d6 de dano. O Tomo também deixa você e aliados 30% mais rápidos por 4s.' },
  ],
  patrulheiro: [
    { id: 'feras', nome: 'Mestre das Feras', icon: '🐾', desc: 'Seus companheiros causam o dobro de dano e atiram 50% mais rápido.' },
    { id: 'arcano', nome: 'Atirador Arcano', icon: '✴️', desc: 'Flechas explodem ao acertar, causando metade do dano em volta.' },
  ],
};
const subInfo = id => Object.values(SUBCLASSES).flat().find(s => s.id === id);

/* ============ Talentos (níveis 4, 8, 12, 16 e 20) ============ */
const TALENTS = {
  atirador: { nome: 'Atirador Certeiro', icon: '🎯', desc: '+1 projétil em cada ataque.' },
  robusto: { nome: 'Robusto', icon: '💪', desc: '+2 PV máximos por nível.' },
  sortudo: { nome: 'Sortudo', icon: '🎲', desc: 'Seus ataques rolam 2d20 e ficam com o maior.' },
  vampirico: { nome: 'Toque Vampírico', icon: '🩸', desc: 'Críticos curam 30% do dano causado.' },
  mobilidade: { nome: 'Mobilidade', icon: '👟', desc: '+20% de velocidade de movimento.' },
  maos: { nome: 'Mãos Ligeiras', icon: '⚡', desc: '+20% de cadência de tiro.' },
  critico: { nome: 'Crítico Aprimorado', icon: '💥', desc: 'Margem de crítico +1 (ex.: 19-20).' },
  defensor: { nome: 'Defensor', icon: '🛡️', desc: '+2 na CA.' },
  adepto: { nome: 'Adepto Elemental', icon: '🌈', desc: 'Golpes super efetivos causam +50% de dano.' },
  foco: { nome: 'Foco', icon: '🔮', desc: 'Seu especial recarrega 30% mais rápido.' },
  regeneracao: { nome: 'Regeneração', icon: '💚', desc: 'Regeneração de PV 2,5× maior.' },
  tesouro: { nome: 'Caçador de Tesouros', icon: '💰', desc: '+15% de chance de saque e +50% de ouro.' },
  olho: { nome: 'Olho de Águia', icon: '🦅', desc: 'Seus tiros vão 25% mais longe.' },
  alquimista: { nome: 'Alquimista', icon: '⚗️', desc: 'Poções 50% mais fortes e +1 Poção de Cura a cada 10 abates.' },
  afinidade: { nome: 'Afinidade Elemental', icon: '💎', desc: 'Cristais de tipo duram o dobro (180s).' },
  domador: { nome: 'Domador', icon: '⚪', desc: '+4 nas rolagens de captura e +1 Pokébola a cada 15 abates.' },
};

/* ============ Temas de masmorra ============ */
const THEMES = {
  fire: { nome: 'Vulcão Ardente', floor: ['#4a2418', '#55291b'], wall: '#1f0d08', top: '#7a3a22', accent: '#ff7b3a', pool: [4, 5, 37, 58, 77, 126, 218, 228, 240, 322], boss: 6 },
  water: { nome: 'Gruta Submersa', floor: ['#173548', '#1b3d52'], wall: '#0a1a26', top: '#2f6b8a', accent: '#4fa3ff', pool: [7, 54, 60, 72, 90, 116, 118, 183, 222, 258], boss: 9 },
  grass: { nome: 'Bosque Selvagem', floor: ['#22401f', '#284a24'], wall: '#0f1f0d', top: '#3f6b33', accent: '#6fdc5a', pool: [1, 43, 46, 48, 69, 102, 114, 152, 187, 123], boss: 3 },
  electric: { nome: 'Usina Abandonada', floor: ['#3a3a2a', '#424230'], wall: '#16160e', top: '#77744a', accent: '#ffe14a', pool: [25, 81, 100, 125, 172, 179, 239, 309, 403, 522], boss: 466 },
  ghost: { nome: 'Torre Assombrada', floor: ['#2a2238', '#30273f'], wall: '#110d18', top: '#4d3f66', accent: '#9b87e6', pool: [92, 93, 200, 353, 355, 198, 215, 302, 228, 425], boss: 477 },
  psychic: { nome: 'Templo Psíquico', floor: ['#3d2436', '#45293d'], wall: '#1a0f17', top: '#7a4a6b', accent: '#ff6fa8', pool: [63, 64, 79, 96, 122, 177, 203, 280, 325, 517], boss: 65 },
  ice: { nome: 'Caverna Congelada', floor: ['#2c4652', '#324e5b'], wall: '#101d23', top: '#7fb3c7', accent: '#9ff0ff', pool: [86, 87, 124, 215, 220, 225, 361, 459, 363, 582], boss: 473 },
  mine: { nome: 'Mina Profunda', floor: ['#3b3128', '#43382d'], wall: '#16110c', top: '#6e5c48', accent: '#e3c46d', pool: [27, 50, 66, 74, 95, 104, 111, 246, 299, 524], boss: 464 },
  // masmorras da história
  capas: { nome: 'Esconderijo dos Capas Vermelhas', floor: ['#3a2622', '#422b26'], wall: '#140c0a', top: '#6b2a22', accent: '#ef4444', pool: [19, 20, 52, 53, 56, 57, 96, 97], boss: 65, story: 2 },
  eco: { nome: 'Caverna do Eco', floor: ['#1e1b2e', '#24203a'], wall: '#09070f', top: '#3d3560', accent: '#a3e635', pool: [167, 168, 595, 48, 49, 41, 42, 93], boss: 596, story: 4 },
  dragon: { nome: 'Ninho do Dragão', floor: ['#2a2440', '#30294a'], wall: '#0f0c1a', top: '#4e4380', accent: '#8a6cff', pool: [147, 148, 371, 372, 443, 444, 610, 611, 333, 334], boss: 635 },
};
const TYPE_THEME = {
  fire: 'fire', water: 'water', grass: 'grass', bug: 'grass', normal: 'grass', electric: 'electric', ghost: 'ghost', dark: 'ghost',
  poison: 'ghost', psychic: 'psychic', fairy: 'psychic', ice: 'ice', rock: 'mine', ground: 'mine', steel: 'mine', fighting: 'mine',
  dragon: 'dragon', flying: 'dragon',
};
const DARK_THEMES = ['ghost', 'eco', 'mine']; // masmorras escuras (Lampejo ilumina)
const THEME_IDS = [...new Set(Object.values(THEMES).flatMap(t => [...t.pool, t.boss]))];

/* ============ Eventos do mundo ============ */
const RARE_POOL = [133, 147, 246, 447, 132, 175, 374, 443];
const MIGRATION_POOL = [16, 21, 41];
const NIGHT_POOL = [92, 93, 200, 353, 355, 198, 215, 302, 228, 425];
