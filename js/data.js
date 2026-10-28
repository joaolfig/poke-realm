'use strict';
const $ = id => document.getElementById(id);
/* ============ Dados fixos do jogo ============ */
const API = 'https://pokeapi.co/api/v2/pokemon/';
const ICON_URL = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-vii/icons/${id}.png`;
const TILE = 32, VILA_R = 300;

const CLASSES = {
  guerreiro: {
    nome: 'Guerreiro', icon: '⚔️', hd: 10, ac: 15, crit: 20, dieAdj: 2, attrs: { POD: 3, AGI: 1, VIG: 3 },
    spr: { h: '#9ca3af', b: '#b91c1c', d: '#7f1d1d' },
    desc: 'Tanque de curto alcance. Golpes pesados e muita vida.',
    wpn: { shots: 1, speed: 480, life: 0.55, size: 9, rate: 2.6, shape: 'blade', color: '#e5e7eb' },
    abil: { nome: 'Berserk', cd: 9, desc: 'Elmo do Berserker: por 5s você e os aliados próximos ganham +50% de cadência, +25% de velocidade e +1d6 de dano.' },
    weapons: ['Espada Curta', 'Espada Longa', 'Espada Bastarda', 'Montante', 'Lâmina Flamejante', 'Vingadora Sagrada', 'Matadora de Dragões'], wicon: '⚔️',
  },
  mago: {
    nome: 'Mago', icon: '🔮', hd: 6, ac: 10, crit: 20, dieAdj: 0, attrs: { POD: 4, AGI: 2, VIG: 1 },
    spr: { h: '#312e81', b: '#4338ca', d: '#1e1b4b' },
    desc: 'Frágil, mas com longo alcance e explosões em área.',
    wpn: { shots: 2, speed: 420, life: 1.15, size: 6, rate: 2.2, wave: true, shape: 'orb', color: '#c4b5fd' },
    abil: { nome: 'Bomba Arcana', cd: 3.5, desc: 'Feitiço: 20 projéteis explodem em círculo no cursor, cada um causando (1 + nível/6)d6 + Poder/2 do seu tipo. Mire em cima do alvo!' },
    weapons: ['Cajado de Aprendiz', 'Cajado de Carvalho', 'Cajado Arcano', 'Cajado das Tempestades', 'Cajado Astral', 'Cajado do Arquimago', 'Cajado do Vazio'], wicon: '🪄',
  },
  ladino: {
    nome: 'Ladino', icon: '🗡️', hd: 8, ac: 12, crit: 19, dieAdj: -2, attrs: { POD: 2, AGI: 4, VIG: 1 },
    spr: { h: '#111827', b: '#374151', d: '#1f2937' },
    desc: 'Ataques rápidos. Crítico em 19-20 com Ataque Furtivo.',
    wpn: { shots: 1, speed: 560, life: 0.6, size: 5, rate: 4.5, shape: 'dagger', color: '#cbd5e1' },
    abil: { nome: 'Manto Sombrio', cd: 9, desc: 'Manto: invisível por 3s (inimigos te ignoram e você fica mais rápido) e o próximo ataque é crítico.' },
    weapons: ['Adaga', 'Adaga Afiada', 'Punhal Élfico', 'Adaga Envenenada', 'Lâmina Sombria', 'Presa da Noite', 'Beijo da Morte'], wicon: '🗡️',
  },
  clerigo: {
    nome: 'Clérigo', icon: '✨', hd: 8, ac: 14, crit: 20, dieAdj: 0, attrs: { POD: 2, AGI: 1, VIG: 4 },
    spr: { h: '#eab308', b: '#f1f5f9', d: '#cbd5e1' },
    desc: 'Suporte resistente. Cura a si e aos aliados próximos.',
    wpn: { shots: 1, speed: 400, life: 0.95, size: 7, rate: 2.4, shape: 'orb', color: '#fde68a' },
    abil: { nome: 'Tomo Sagrado', cd: 6, desc: 'Tomo: cura (2 + nível/3)d8 + Vigor em você e nos aliados próximos.' },
    weapons: ['Maça Simples', 'Maça de Ferro', 'Martelo Abençoado', 'Maça Radiante', 'Martelo do Alvorecer', 'Maça dos Santos', 'Martelo Divino'], wicon: '🔨',
  },
  patrulheiro: {
    nome: 'Patrulheiro', icon: '🏹', hd: 10, ac: 13, crit: 20, dieAdj: 0, attrs: { POD: 3, AGI: 3, VIG: 1 },
    spr: { h: '#166534', b: '#15803d', d: '#14532d' },
    desc: 'Flechas de longo alcance que atravessam inimigos.',
    wpn: { shots: 1, speed: 520, life: 1.0, size: 5, rate: 2.0, pierce: true, shape: 'arrow', color: '#fbbf24' },
    abil: { nome: 'Aljava Pesada', cd: 3, desc: 'Aljava: dispara uma flecha enorme e perfurante que causa (3 + nível/3)d8 + Poder e deixa os inimigos lentos por 3s.' },
    weapons: ['Arco Curto', 'Arco Longo', 'Arco Composto', 'Arco Élfico', 'Arco do Vento', 'Arco Lunar', 'Arco das Estrelas'], wicon: '🏹',
  },
};

const WDICE = [[1, 6], [1, 8], [1, 8], [1, 10], [1, 10], [1, 12], [2, 8]];
const WBONUS = [0, 0, 1, 1, 2, 3, 4];
const ARMORS = ['Gibão de Couro', 'Couro Batido', 'Cota de Malha', 'Peitoral de Aço', 'Meia-Armadura', 'Armadura de Placas', 'Armadura Dracônica'];
const TIER_COLORS = ['#9ca3af', '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#f0f9ff'];
const TIER_NAMES = ['Comum', 'Incomum', 'Raro', 'Muito Raro', 'Épico', 'Lendário', 'Artefato'];

const ZONES = [
  { nome: 'Vila Pedrafunda', cols: ['#7cc46a', '#74bc62', '#82ca70'], lvl: 1 },
  { nome: 'Campos Verdes', cols: ['#6fbf55', '#76c55b', '#7fcc62', '#72c258'], lvl: 1 },
  { nome: 'Floresta Antiga', cols: ['#3f7d3a', '#447f3e', '#4a8744', '#418140'], lvl: 5 },
  { nome: 'Montanhas Rochosas', cols: ['#9a8b6c', '#a39474', '#94866a', '#9e9071'], lvl: 10 },
  { nome: 'Terras Sombrias', cols: ['#3b2f4a', '#40334f', '#382c47', '#43354f'], lvl: 15 },
];

// Pokémon por zona (IDs da PokeAPI)
const ZONE_POOLS = {
  1: [16, 19, 10, 13, 43, 60, 69, 161, 263, 399, 41, 21],
  2: [25, 58, 74, 77, 92, 63, 66, 37, 54, 46, 102, 86],
  3: [93, 64, 67, 75, 59, 55, 125, 126, 123, 95, 124, 208, 229],
  4: [94, 65, 68, 130, 149, 248, 373, 376, 445, 448, 282, 461],
};
// Pokémon que aparecem na água (aquáticos nadam, voadores pairam por cima)
const WATER_POOLS = {
  1: [129, 54, 60, 118, 72, 98, 183, 270, 278, 278, 16],
  2: [120, 90, 116, 79, 194, 341, 418, 223, 279, 21, 41],
  3: [86, 73, 117, 195, 121, 99, 61, 131, 226, 22, 279],
  4: [130, 171, 170, 319, 211, 87, 91, 230, 226, 142, 169],
};
const BOSSES = [150, 384, 383, 382, 145, 146, 144, 487, 249, 250, 483, 484];

const TYPE_COLORS = {
  normal: '#d6d2b8', fire: '#ff7b3a', water: '#4fa3ff', grass: '#6fdc5a', electric: '#ffe14a', ice: '#9ff0ff',
  fighting: '#e0543c', poison: '#c86ee6', ground: '#e3c46d', flying: '#b2a6ff', psychic: '#ff6fa8', bug: '#b8d83a',
  rock: '#c9b25a', ghost: '#9b87e6', dragon: '#8a6cff', dark: '#a07a60', steel: '#c8d0e0', fairy: '#ffb3e6',
};

// Sprite 12x12 dos humanos (h = capacete/cabelo, s = pele, e = olho, b = roupa, d = detalhe, l = pernas)
const PSPR = [
  '....hhhh....',
  '...hhhhhh...',
  '...hssssh...',
  '...sesses...',
  '...ssssss...',
  '....ssss....',
  '..bbbbbbbb..',
  '.sbbddbbbbs.',
  '.s.bbbbbb.s.',
  '...bbddbb...',
];
const PLEGS = [['...ll..ll...', '...ll..ll...'], ['..ll....ll..', '..l......l..']];
