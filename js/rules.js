'use strict';
/* ============ Atributos (D&D simplificado) ============ */
const ATTRS = ['POD', 'AGI', 'VIG'];
const ATTR_NAMES = { POD: 'Poder', AGI: 'Agilidade', VIG: 'Vigor' };
const ATTR_DESC = {
  POD: 'A cada 2 pontos: +1 de dano e +½ no acerto. Fortalece as habilidades.',
  AGI: 'A cada 2 pontos: +½ CA, mais velocidade e cadência de tiro.',
  VIG: 'A cada 2 pontos: +1 PV por nível e mais regeneração.',
};
// teto 20 e 1 ponto por nível; cada ponto vale metade (o poder máximo é o mesmo de antes, mas a progressão vai até o nível 30)
const ATTR_MAX = 20;

/* ============ Tipos ============ */
const TYPE_PT = {
  normal: 'Normal', fire: 'Fogo', water: 'Água', grass: 'Planta', electric: 'Elétrico', ice: 'Gelo', fighting: 'Lutador',
  poison: 'Veneno', ground: 'Terra', flying: 'Voador', psychic: 'Psíquico', bug: 'Inseto', rock: 'Pedra', ghost: 'Fantasma',
  dragon: 'Dragão', dark: 'Sombrio', steel: 'Aço', fairy: 'Fada',
};
const TYPES = Object.keys(TYPE_PT);
// tabela oficial (Gen 6+): s = super efetivo (×2), w = pouco efetivo (×½), i = imune (×0)
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
    else if (c.i.includes(t)) m = 0;
  }
  return m;
}

/* ============ Raças ============ */
const RACES = {
  humano: { nome: 'Humano', icon: '🧑', bonus: {}, points: 2, resist: [], traco: 'Versátil: começa com 2 pontos de atributo extras para pôr onde quiser.' },
  elfo: { nome: 'Elfo', icon: '🧝', bonus: { AGI: 1 }, points: 0, resist: ['psychic'], traco: 'Olhos de elfo: atira 20% mais longe, crítico a partir do 18 natural com +50% de dano, e vê inimigos no minimapa. Resiste a Psíquico.' },
  anao: { nome: 'Anão', icon: '🧔', bonus: { VIG: 1 }, points: 0, resist: ['poison', 'rock'], traco: 'Robusto: +2 PV por nível. Resiste a Veneno e Pedra.' },
  halfling: { nome: 'Halfling', icon: '🍀', bonus: { AGI: 1 }, points: 0, resist: [], traco: 'Ágil e sortudo: +10% de velocidade, 8% de chance de esquivar, +1 na CA e rerola o 1 natural nos ataques.' },
  tiefling: { nome: 'Tiefling', icon: '😈', bonus: { POD: 1 }, points: 0, resist: ['dark', 'ghost'], traco: 'Fúria infernal: +10% de dano, +25% com menos da metade da vida. Resiste a Sombrio e Fantasma.' },
  draconato: { nome: 'Draconato', icon: '🐲', bonus: { POD: 1 }, points: 0, resist: ['dragon', 'fire'], traco: 'Escamas: recebe 10% menos dano. Resiste a Dragão e Fogo.' },
};

/* ============ Subclasses (nível 16) ============
 * Cada subclasse troca o especial ([Espaço]) por outro, inspirado nos itens de
 * habilidade das classes de Realm of the Mad God, sempre ligado à classe de origem.
 */
const SUB_LVL = 16;
const SUBCLASSES = {
  guerreiro: [
    { id: 'barbaro', nome: 'Bárbaro', icon: '🪓', desc: '+25% PV máximos e dano recebido pela metade enquanto em fúria.',
      abil: { nome: 'Escudo de Impacto', cd: 6, desc: 'Escudo: golpeia à frente com 7 estilhaços pesados ((2 + nível/4)d8 + Poder) que podem paralisar, e entra em fúria por 3s.' } },
    { id: 'paladino', nome: 'Paladino', icon: '🛡️', desc: '+2 CA.',
      abil: { nome: 'Selo Sagrado', cd: 10, desc: 'Selo: por 6s você e os aliados próximos causam +1d6 de dano e recebem 25% menos dano, e todos são curados em 2d8 + nível.' } },
  ],
  mago: [
    { id: 'evocador', nome: 'Evocador', icon: '⚡', desc: '+15% de cadência de tiro.',
      abil: { nome: 'Cetro Relampejante', cd: 3, desc: 'Cetro: um raio atinge o inimigo mais perto do cursor e salta para até 5 outros ((2 + nível/5)d8 + Poder/2, perde 15% por salto).' } },
    { id: 'necromante', nome: 'Necromante', icon: '💀', desc: 'Pokémon derrotados podem voltar como espírito aliado por 15s (30%, máx. 3).',
      abil: { nome: 'Crânio Ceifador', cd: 4.5, desc: 'Crânio: explosão no cursor que causa (1 + nível/5)d10 + Poder/2 em área e cura você em 20% do dano causado.' } },
  ],
  ladino: [
    { id: 'assassino', nome: 'Assassino', icon: '🗡️', desc: 'Margem de crítico +1 e críticos causam +30% de dano.',
      abil: { nome: 'Frasco de Veneno', cd: 5, desc: 'Veneno: arremessa um frasco no cursor; a nuvem causa (1 + nível/6)d6 a cada 0,5s por 4s em quem estiver dentro.' } },
    { id: 'trapaceiro', nome: 'Trapaceiro', icon: '🎭', desc: '10% de chance de esquivar de qualquer ataque.',
      abil: { nome: 'Prisma Ilusório', cd: 7, desc: 'Prisma: você se teleporta até o cursor e deixa uma ilusão que atrai os inimigos por 4s. Fica invisível por 2s e o próximo ataque é crítico.' } },
  ],
  clerigo: [
    { id: 'vida', nome: 'Domínio da Vida', icon: '💖', desc: 'Curas 50% mais fortes e aliados perto de você regeneram PV.',
      abil: { nome: 'Santuário', cd: 10, desc: 'Tomo da Vida: cria um santuário por 6s que cura (1 + nível/6)d6 + Vigor/2 por segundo quem estiver dentro, tira os status e deixa os inimigos lentos.' } },
    { id: 'guerra', nome: 'Domínio da Guerra', icon: '⚔️', desc: '+2 CA e seus tiros causam +1d6 de dano.',
      abil: { nome: 'Hino de Batalha', cd: 9, desc: 'Hino: você e os aliados próximos entram em fúria por 5s, são curados em 1d8 + nível/2 e os inimigos em volta ficam paralisados.' } },
  ],
  patrulheiro: [
    { id: 'feras', nome: 'Mestre das Feras', icon: '🐾', desc: 'Seus companheiros causam +50% de dano.',
      abil: { nome: 'Armadilha da Caçadora', cd: 5, desc: 'Armadilha: arma no cursor e explode quando um inimigo chega perto ((2 + nível/4)d8 + Poder em área, deixa lentos) e agita seus companheiros.' } },
    { id: 'arcano', nome: 'Atirador Arcano', icon: '✴️', desc: 'Flechas explodem ao acertar, causando metade do dano em volta.',
      abil: { nome: 'Aljava Arcana', cd: 5, desc: 'Aljava: dispara 3 flechas arcanas que atravessam até 2 inimigos em leque ((2 + nível/4)d8 + Poder) que podem paralisar.' } },
  ],
  druida: [
    { id: 'lua', nome: 'Círculo da Lua', icon: '🌙', desc: 'A Forma Selvagem fica bem maior, dura 18s, dá +50% de PV (em vez de 30%) e cura 25% da vida ao transformar.',
      abil: { nome: 'Forma Selvagem Lunar', cd: 28, desc: 'Forma Selvagem: vira o seu companheiro líder por 18s, com +50% de PV, e se cura em 25% da vida ao transformar.' } },
    { id: 'terra', nome: 'Círculo da Terra', icon: '🌱', desc: 'A Forma Selvagem fica um pouco maior e, ao transformar, raízes brotam em volta por 6s: curam você e os aliados e deixam os inimigos lentos.',
      abil: { nome: 'Forma Selvagem da Terra', cd: 24, desc: 'Forma Selvagem: vira o seu companheiro líder por 12s (+30% de PV) e faz brotar raízes que curam (1 + nível/6)d6 + Vigor/2 por segundo e deixam os inimigos lentos.' } },
  ],
};
/* ============ Bênçãos do Clérigo ============
 * Cada fase do Clérigo tem as suas bênçãos; ele escolhe UMA ativa no templo da 2ª cidade.
 * A bênção vai junto com as curas dele (Tomo, Santuário e Hino) e vale para quem for curado.
 * No próprio Clérigo ela vale menos (escudo pela metade, bônus de dano 35%: é uma classe de suporte),
 * (exceto a Graça Salvadora, que no próprio Clérigo só volta 5 min depois de salvá-lo).
 */
const BLESS = {
  escudo: { nome: 'Escudo da Fé', icon: '🛡️', subs: ['clerigo'], desc: 'A cura que passaria da vida máxima vira escudo (no mínimo 10% da vida) por 5s, até 20% da vida máxima.' },
  feras: { nome: 'Bênção das Feras', icon: '🐾', subs: ['clerigo'], desc: 'Os companheiros de quem você cura causam +20% de dano por 6s.' },
  escudo2: { nome: 'Escudo da Fé Maior', icon: '🛡️', subs: ['vida'], desc: 'A cura que passaria da vida máxima vira escudo (no mínimo 10% da vida) por 5s, até 25% da vida máxima.' },
  graca: { nome: 'Graça Salvadora', icon: '🕊️', subs: ['vida'], desc: 'Os ALIADOS que você cura ficam protegidos por 8s: recebem 10% menos dano e, se levarem um golpe fatal, voltam com 50% da vida, ficam 2s intocáveis e uma explosão de luz paralisa os inimigos em volta. Protege você também. Depois de salvar alguém, só volta para aquele jogador em 90s (em você, em 5 min).' },
  feras2: { nome: 'Bênção das Feras Maior', icon: '🐾', subs: ['guerra'], desc: 'Os companheiros de quem você cura causam +30% de dano por 6s.' },
  ritmo: { nome: 'Ritmo Sagrado', icon: '🎵', subs: ['guerra'], desc: 'Quem você cura atira 20% mais rápido por 6s.' },
};
const blessPhase = P => (P.cls !== 'clerigo' ? null : P.subclass || 'clerigo');
const blessOf = P => (P.bless && BLESS[P.bless] && BLESS[P.bless].subs.includes(blessPhase(P)) ? P.bless : null);
const subInfo = id => Object.values(SUBCLASSES).flat().find(s => s.id === id);

/* ============ Talentos (níveis 4, 8, 12 ... 28) ============
 * max = quantas vezes dá para pegar (cada vez soma um nível do talento). off = só para saves antigos.
 */
const TALENTS = {
  equipe: { nome: 'Batalha em Equipe', icon: '🤝', max: 3, desc: '+1 companheiro fora da Pokébola ao mesmo tempo (até 4). Com mais companheiros, cada um bate um pouco menos.' },
  afinidade: { nome: 'Afinidade Elemental', icon: '💎', max: 3, desc: 'Cristais de tipo duram +15s (base 30s).' },
  esquiva: { nome: 'Rolamento', icon: '💨', desc: '[Shift] avança rápido na direção em que você anda e fica intocável por um instante (recarga 3s).' },
  ricochete: { nome: 'Ricochete', icon: '↩', desc: 'Seus tiros que acertam quicam uma vez para o inimigo mais próximo.' },
  perfurante: { nome: 'Perfuração', icon: '📌', desc: 'Seus tiros atravessam um inimigo a mais.' },
  atirador: { nome: 'Atirador Certeiro', icon: '🎯', desc: '+1 projétil em cada ataque.' },
  eco: { nome: 'Eco Arcano', icon: '🔁', desc: '25% de chance de o especial não gastar a recarga.' },
  barreira: { nome: 'Barreira', icon: '🔰', desc: 'Usar o especial cria um escudo que absorve 15% da sua vida máxima por 4s.' },
  foco: { nome: 'Foco', icon: '🔮', max: 2, desc: 'O especial recarrega 15% mais rápido.' },
  mentor: { nome: 'Mentor', icon: '📘', desc: 'Companheiros ganham 50% mais XP e usam o golpe especial 30% mais vezes.' },
  vampirico: { nome: 'Toque Vampírico', icon: '🩸', desc: 'Críticos curam 30% do dano causado.' },
  adepto: { nome: 'Adepto Elemental', icon: '🌈', desc: 'Golpes super efetivos causam +50% de dano.' },
  domador: { nome: 'Domador', icon: '⚪', desc: '+4 nas rolagens de captura e +1 Poké Ball a cada 15 abates.' },
  alquimista: { nome: 'Alquimista', icon: '⚗️', desc: 'Poções 50% mais fortes e +1 Poção de Cura a cada 10 abates.' },
  tesouro: { nome: 'Caçador de Tesouros', icon: '💰', desc: '+15% de chance de saque e +50% de ouro.' },
  mobilidade: { nome: 'Mobilidade', icon: '👟', desc: '+20% de velocidade de movimento.' },
  sortudo: { nome: 'Sortudo', icon: '🎲', desc: 'Seus ataques rolam 2d20 e ficam com o maior.' },
  regeneracao: { nome: 'Regeneração', icon: '💚', desc: 'Regeneração de PV 2,5× maior.' },
  // talentos de tipo: só aparecem para os tipos (naturais) que ganham de verdade com eles
  couraca: { nome: 'Couraça Elemental', icon: '🛡️', max: 2, types: ['rock', 'grass', 'ice', 'fire', 'flying', 'bug', 'psychic', 'dark'], desc: 'Golpes super efetivos em você causam 20% menos dano (no nível 2: 35% menos).' },
  persistencia: { nome: 'Persistência', icon: '🪨', types: ['poison', 'bug', 'grass', 'normal', 'rock', 'fire', 'electric', 'ice'], desc: 'Seus golpes pouco efetivos perdem só metade do dano que perderiam (½ vira ¾, ¼ vira ⅝).' },
  quebra: { nome: 'Quebra-Imunidade', icon: '🔨', types: ['electric', 'normal', 'poison', 'psychic'], desc: 'Contra alvos imunes ao seu tipo, você ainda causa 30% do dano.' },
  // antigos: continuam funcionando em saves velhos, mas não são mais oferecidos
  robusto: { nome: 'Robusto', icon: '💪', off: 1, desc: '+2 PV máximos por nível.' },
  maos: { nome: 'Mãos Ligeiras', icon: '⚡', off: 1, desc: '+20% de cadência de tiro.' },
  critico: { nome: 'Crítico Aprimorado', icon: '💥', off: 1, desc: 'Margem de crítico +1 (ex.: 19-20).' },
  defensor: { nome: 'Defensor', icon: '🛡️', off: 1, desc: '+2 na CA.' },
  olho: { nome: 'Olho de Águia', icon: '🦅', off: 1, desc: 'Seus tiros vão 25% mais longe.' },
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
  dragon: { nome: 'Ninho do Dragão', floor: ['#2a2440', '#30294a'], wall: '#0f0c1a', top: '#4e4380', accent: '#8a6cff', pool: [147, 148, 371, 372, 443, 444, 610, 611, 333, 334], boss: 635 },
};
const TYPE_THEME = {
  fire: 'fire', water: 'water', grass: 'grass', bug: 'grass', normal: 'grass', electric: 'electric', ghost: 'ghost', dark: 'ghost',
  poison: 'ghost', psychic: 'psychic', fairy: 'psychic', ice: 'ice', rock: 'mine', ground: 'mine', steel: 'mine', fighting: 'mine',
  dragon: 'dragon', flying: 'dragon',
};
const DARK_THEMES = ['ghost', 'mine']; // masmorras escuras (Flash ilumina)
const THEME_IDS = [...new Set(Object.values(THEMES).flatMap(t => [...t.pool, t.boss]))];

/* ============ Eventos do mundo ============ */
const RARE_POOL = [133, 147, 246, 447, 132, 175, 374, 443];
const MIGRATION_POOL = [16, 21, 41];
const NIGHT_POOL = [92, 93, 200, 353, 355, 198, 215, 302, 228, 425];
