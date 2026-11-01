'use strict';
/* ============ Regiões (mapas escolhidos ao criar a sala) ============
 * Cada região é inspirada numa região dos jogos: Pokémon das gerações de lá
 * (com repetições de outras gerações, como nos jogos), 8 ginásios inspirados
 * nos ginásios reais e uma história própria que passa por eles.
 * Todas usam o mesmo "esqueleto" de rotas (vila na origem), mas o relevo,
 * os biomas e os nomes mudam. setRegion() troca tudo antes de gerar o mundo.
 */

// biomas: cores do chão, mato alto, caminho, penhasco, árvores e flores
const BIOMES = {
  vila: { cols: ['#7cc46a', '#74bc62', '#82ca70'], tall: ['#3f8f3a', '#6cc057'], path: '#d8c9a3', cliff: '#8d7b64', tree: 'verde', flower: 'cores' },
  campo: { cols: ['#6fbf55', '#76c55b', '#7fcc62'], tall: ['#3f8f3a', '#6cc057'], path: '#dcc48e', cliff: '#8d7b64', tree: 'verde', flower: 'cores' },
  floresta: { cols: ['#3f7d3a', '#447f3e', '#4a8744'], tall: ['#24572a', '#3f8a3e'], path: '#b99b6a', cliff: '#6d6a55', tree: 'escuro', flower: 'cogumelo' },
  montanha: { cols: ['#9a8b6c', '#a39474', '#94866a'], tall: ['#6f6c3e', '#a9a35e'], path: '#a8916f', cliff: '#8d7b64', tree: 'oliva', flower: 'menta' },
  neve: { cols: ['#dde8ef', '#e6eef3', '#d3e0e9'], tall: ['#6f8fa0', '#b3cfdc'], path: '#aebbc4', cliff: '#7f8d9b', tree: 'neve', flower: 'menta' },
  sombrio: { cols: ['#3b2f4a', '#40334f', '#382c47'], tall: ['#40285a', '#7a52a0'], path: '#5e4c63', cliff: '#4a3a5a', tree: 'roxo', flower: 'cristal', fog: 1, swamp: 1 },
  deserto: { cols: ['#d9c38a', '#e0ca92', '#d2bb80'], tall: ['#9c8a4a', '#c9b46a'], path: '#c4a76c', cliff: '#a8875c', tree: 'seco', flower: 'cores' },
  vulcao: { cols: ['#5f4d45', '#66534b', '#584741'], tall: ['#4a3a30', '#8a6a48'], path: '#3e3431', cliff: '#4a3c38', tree: 'seco', flower: 'brasa' },
  pantano: { cols: ['#4f6b45', '#56724a', '#4a6541'], tall: ['#2f4a2c', '#5d7d4a'], path: '#6b5e46', cliff: '#5a5a48', tree: 'escuro', flower: 'cogumelo', swamp: 1 },
};
const ZONE_LVL = [1, 1, 7, 14, 21, 26];
const ZONE_LVL_MAX = [30, 6, 13, 20, 25, 30]; // faixa recomendada de cada zona (mínimo a máximo)
const lvlZone = l => (l < 7 ? 1 : l < 14 ? 2 : l < 21 ? 3 : l < 26 ? 4 : 5);

const GYM_LVL = [4, 7, 10, 13, 16, 20, 23, 26, 29];
const GYM_ZONE = [1, 2, 2, 3, 3, 4, 4, 5, 5];

// cores das masmorras por tipo do ginásio
const GYM_STYLE = {
  rock: ['#3b3128', '#43382d', '#16110c', '#6e5c48'], ground: ['#4a3a24', '#52412a', '#1c140a', '#7a6040'], steel: ['#3a3e44', '#42464d', '#15171a', '#6f7782'],
  fighting: ['#43302a', '#4b362f', '#180f0c', '#7a4a3a'], water: ['#173548', '#1b3d52', '#0a1a26', '#2f6b8a'], electric: ['#3a3a2a', '#424230', '#16160e', '#77744a'],
  grass: ['#22401f', '#284a24', '#0f1f0d', '#3f6b33'], bug: ['#2e3d1a', '#35461e', '#11180a', '#5a7a2c'], normal: ['#4a3a2c', '#523f30', '#1c140e', '#8a6a4a'],
  ghost: ['#2a2238', '#30273f', '#110d18', '#4d3f66'], dark: ['#231d26', '#29222d', '#0c0a0e', '#45384d'], poison: ['#33223d', '#3a2745', '#130c17', '#5e3a70'],
  psychic: ['#3d2436', '#45293d', '#1a0f17', '#7a4a6b'], fairy: ['#45293d', '#4d2f45', '#1c1018', '#8a5a7a'], fire: ['#4a2418', '#55291b', '#1f0d08', '#7a3a22'],
  ice: ['#2c4652', '#324e5b', '#101d23', '#7fb3c7'], dragon: ['#2a2440', '#30294a', '#0f0c1a', '#4e4380'], flying: ['#2c3e5a', '#324664', '#0f1724', '#6a8ab8'],
};

const REGIONS = {
  kanto: {
    nome: 'Kanto', sub: 'Gerações I · onde tudo começou', vila: 'Vila Alvorada',
    guia: { nome: 'Professora Alecrim', spr: { h: '#9ca3af', b: '#f1f5f9', d: '#64748b' } },
    artesao: 'Mestre Ferro-Velho',
    zonas: [['Campos de Alvorada', 'campo'], ['Monte Lunar e Bosques', 'floresta'], ['Zona Safári', 'pantano'], ['Terras Assombradas', 'sombrio'], ['Estrada da Vitória', 'montanha']],
    pools: {
      1: [16, 19, 10, 13, 21, 29, 32, 43, 69, 39, 52, 56, 25],
      2: [11, 14, 12, 15, 46, 48, 23, 27, 41, 74, 37, 58, 84, 96],
      3: [66, 75, 95, 104, 111, 77, 22, 24, 28, 57, 64, 67, 105, 20, 35],
      4: [92, 93, 88, 109, 89, 110, 126, 125, 78, 123, 127, 128, 115, 49],
      5: [68, 76, 112, 42, 106, 107, 113, 142, 143, 148, 97, 94, 59, 34],
    },
    water: {
      1: [129, 60, 118, 72, 54, 98, 16], 2: [79, 86, 90, 116, 120, 61, 21], 3: [55, 73, 117, 99, 119, 80, 22],
      4: [87, 91, 121, 130, 62, 138, 140], 5: [130, 131, 139, 141, 134, 91, 148],
    },
    night: [92, 93, 41, 42, 96, 97, 104, 109], rare: [133, 147, 132, 137, 83, 113, 123, 131], migra: [16, 21, 17], lendas: [144, 145, 146],
    vilao: 'Equipe Rubra', grunts: [19, 20, 23, 24, 41, 42, 52, 53, 88, 89, 109, 110],
    gyms: [
      { type: 'rock', nome: 'Ginásio de Pedra', lider: 'Líder Granito', boss: 95, pool: [74, 75, 95, 111, 27, 104, 138, 140] },
      { type: 'water', nome: 'Ginásio das Cascatas', lider: 'Líder Marisa', boss: 121, pool: [120, 118, 54, 60, 90, 98, 116] },
      { type: 'electric', nome: 'Ginásio Relâmpago', lider: 'Tenente Faísca', boss: 26, pool: [100, 81, 25, 125, 82, 101] },
      { type: 'grass', nome: 'Ginásio Estufa', lider: 'Líder Flora', boss: 45, pool: [43, 44, 69, 70, 114, 1, 2, 102] },
      { type: 'poison', nome: 'Ginásio Ninja', lider: 'Ninja Kogen', boss: 110, pool: [109, 88, 89, 48, 49, 23, 24, 42] },
      { type: 'psychic', nome: 'Ginásio Psíquico', lider: 'Médium Sabine', boss: 65, pool: [63, 64, 96, 97, 122, 79, 80] },
      { type: 'fire', nome: 'Ginásio do Vulcão', lider: 'Professor Brasa', boss: 59, pool: [58, 37, 38, 77, 78, 126, 4, 5] },
      { type: 'ground', nome: 'Ginásio da Terra', lider: 'Chefe Terrano', boss: 112, pool: [27, 28, 50, 51, 104, 105, 111, 31, 34] },
    ],
    final: { nome: 'Laboratório Secreto da Equipe Rubra', lider: 'O Clone', boss: 150, type: 'psychic' },
    historia: {
      prologo: `A <b>Equipe Rubra</b> anda roubando Pokémon pelas estradas de Kanto, e ninguém sabe para quê.
        A Professora Alecrim acredita que os oito líderes de ginásio sabem de alguma coisa. Vença cada um, ganhe a confiança deles e descubra o plano da Rubra.`,
      caps: [
        ['Granito, o líder de pedra, desconfia de forasteiros. Prove seu valor na Cidade de Pedra, seguindo a estrada ao norte da vila.', 'Granito conta que a Rubra comprou todas as Pedras-Lua da região. "Para que alguém precisa de tantas?"'],
        ['A Líder Marisa viu barcos da Rubra no rio. Ela só fala com quem vencer suas cascatas.', 'Marisa mostra um mapa molhado: a Rubra leva os Pokémon roubados para o norte, passando pelo Monte Lunar.'],
        ['O Tenente Faísca guarda a usina que abastece Kanto. A Rubra tentou sabotá-la ontem à noite.', 'Faísca prendeu um capanga, que repetia sem parar: "o chefe vai criar o Pokémon mais forte do mundo".'],
        ['Flora cuida da estufa onde se fazem os remédios da região. Agentes da Rubra foram vistos rondando por lá.', 'Flora descobre que a Rubra roubou amostras genéticas da estufa. Eles não querem só roubar Pokémon. Querem criar um.'],
        ['O ninja Kogen conhece todos os segredos do pântano. Dizem que a Rubra tem um esconderijo lá.', 'Kogen derruba uma parede falsa e revela anotações de um laboratório: "Projeto Clone, fase final".'],
        ['A Médium Sabine teve uma visão: um Pokémon nascido da raiva. Ela precisa testar se você está pronto para enfrentá-lo.', 'Sabine sente que o Pokémon criado está acordando. "Ele odeia quem o fez. E vai odiar você também."'],
        ['O Professor Brasa estudou genética antes de virar líder. Ele sabe quem financiou a Rubra.', 'Brasa confessa que trabalhou no projeto e fugiu. O financiador é um líder de ginásio: o Chefe Terrano.'],
        ['O último ginásio pertence ao Chefe Terrano, o próprio chefe da Equipe Rubra. Derrote-o no ginásio dele.', 'Terrano cai e entrega a chave do laboratório: "Eu não consigo mais controlar a criatura. Ninguém consegue."'],
      ],
      final: [`Descendo a Estrada da Vitória fica o <b>Laboratório Secreto da Equipe Rubra</b>. Lá dentro, <b>O Clone</b> despertou de vez. Acabe com isso.`,
        `O Clone foi derrotado e se recolheu nas profundezas da caverna. A Equipe Rubra acabou, os Pokémon roubados voltaram para casa e Kanto tem um novo campeão.`],
    },
  },

  johto: {
    nome: 'Johto', sub: 'Geração II · tradição e lendas', vila: 'Vila dos Ventos',
    guia: { nome: 'Professor Ipê', spr: { h: '#78350f', b: '#fef3c7', d: '#b45309' } },
    artesao: 'Artesã das Bolas',
    zonas: [['Trilhas do Vento', 'campo'], ['Bosque Antigo', 'floresta'], ['Costa Oeste e Monte Mortar', 'montanha'], ['Caminho Gelado', 'neve'], ['Pico Prateado e Redemoinhos', 'sombrio']],
    pools: {
      1: [161, 163, 165, 167, 16, 19, 187, 191, 179, 10, 13, 172, 21],
      2: [162, 164, 166, 168, 41, 74, 204, 190, 203, 209, 206, 69, 43, 48, 214],
      3: [180, 207, 213, 215, 216, 218, 220, 231, 66, 75, 95, 77, 225],
      4: [198, 200, 228, 229, 217, 221, 227, 232, 234, 241, 92, 93, 169, 202],
      5: [246, 247, 248, 212, 208, 181, 237, 210, 199, 197, 196, 130, 105],
    },
    water: {
      1: [129, 60, 118, 194, 183, 72], 2: [116, 223, 195, 98, 170, 54], 3: [171, 224, 222, 226, 211, 117],
      4: [130, 186, 91, 87, 80, 184], 5: [130, 131, 199, 226, 171, 73],
    },
    night: [163, 164, 198, 200, 228, 92, 93, 41, 169, 215], rare: [133, 147, 246, 175, 132, 201, 225, 235], migra: [163, 165, 187], lendas: [243, 244, 245],
    vilao: 'Corvos da Meia-Noite', grunts: [19, 20, 41, 42, 109, 110, 198, 228, 229, 215],
    gyms: [
      { type: 'flying', nome: 'Ginásio das Alturas', lider: 'Líder Plumo', boss: 17, pool: [16, 17, 21, 163, 84, 177] },
      { type: 'bug', nome: 'Ginásio do Casulo', lider: 'Líder Zumbi', boss: 123, pool: [10, 11, 13, 14, 165, 167, 204, 193] },
      { type: 'normal', nome: 'Ginásio do Leite', lider: 'Líder Clarinha', boss: 241, pool: [161, 162, 19, 20, 206, 190, 209, 39, 40] },
      { type: 'ghost', nome: 'Ginásio Assombrado', lider: 'Vidente Morfeu', boss: 94, pool: [92, 93, 200, 92, 93, 200, 201] },
      { type: 'fighting', nome: 'Ginásio do Dojô', lider: 'Mestre Kaio', boss: 62, pool: [56, 57, 66, 67, 236, 106, 107, 237] },
      { type: 'steel', nome: 'Ginásio do Farol', lider: 'Líder Jade', boss: 208, pool: [81, 82, 204, 205, 227, 95] },
      { type: 'ice', nome: 'Ginásio Congelado', lider: 'Vovô Geada', boss: 221, pool: [86, 87, 220, 215, 124, 225, 91] },
      { type: 'dragon', nome: 'Ginásio dos Dragões', lider: 'Mestra Draconia', boss: 230, pool: [147, 148, 116, 117, 130] },
    ],
    final: { nome: 'Ilhas do Redemoinho', lider: 'Guardião dos Mares', boss: 249, type: 'water' },
    historia: {
      prologo: `Os sinos das torres antigas de Johto pararam de tocar. Dizem que os <b>Corvos da Meia-Noite</b> roubaram as plumas sagradas que acalmam o Guardião dos Mares.
        O Professor Ipê pede que você percorra os oito ginásios: cada líder guarda um pedaço da lenda.`,
      caps: [
        ['Plumo, o líder dos pássaros, viu os Corvos voando para o oeste. Ele treina na Cidade Violeta, a noroeste da vila.', 'Plumo mostra uma pena prateada caída no ginásio. "Isso não é de nenhum pássaro comum. É uma pluma sagrada."'],
        ['O Líder Zumbi cuida do bosque onde a pluma foi achada. Os Corvos estão capturando os insetos de lá.', 'Zumbi encontra um bilhete dos Corvos: "Com as plumas, chamaremos o Guardião e controlaremos o mar."'],
        ['Clarinha e sua Miltank seguram as fazendas da região. Os Corvos querem os rebanhos para alimentar seus Pokémon.', 'Clarinha conta que os Corvos usam uma rádio pirata para dar ordens. O sinal vem das ruínas ao norte.'],
        ['Morfeu, o vidente, fala com os espíritos das torres queimadas. Eles sabem onde estão as plumas.', 'Os espíritos sussurram: duas plumas já estão com os Corvos. Falta uma, escondida no farol.'],
        ['O Mestre Kaio treina no dojô da montanha. Os Corvos tentaram recrutar os lutadores dele à força.', 'Kaio expulsa os Corvos do dojô e descobre o nome do chefe deles: <b>o Capitão Sombrio</b>.'],
        ['Jade cuida do farol, e a Ampharos do farol adoeceu. Sem a luz, os barcos dos Corvos navegam sem ser vistos.', 'Com o farol aceso de novo, Jade vê os barcos dos Corvos indo para as Ilhas do Redemoinho.'],
        ['O Vovô Geada mora perto do lago gelado e sabe atravessar as correntezas do mar. Prove que aguenta o frio.', 'Geada ensina o caminho pelas correntezas: "Siga os redemoinhos. O Guardião dorme no centro."'],
        ['A Mestra Draconia protege o santuário dos dragões, e os Corvos querem roubar os ovos de lá.', 'Draconia recupera a última pluma e entrega a você: "Só quem tem as três pode acalmar o Guardião."'],
      ],
      final: [`O Capitão Sombrio usou as plumas e despertou o <b>Guardião dos Mares</b>, furioso, nas <b>Ilhas do Redemoinho</b>. Enfrente-o e devolva a calma ao oceano.`,
        `O Guardião dos Mares se acalmou e voltou a dormir no fundo do mar. Os Corvos da Meia-Noite se dispersaram, e os sinos de Johto voltaram a tocar.`],
    },
  },

  hoenn: {
    nome: 'Hoenn', sub: 'Geração III · mar, vulcões e céu', vila: 'Vila Musgo',
    hmGym: { 1: 'cut', 2: 'flash', 3: 'smash', 4: 'surf' },
    guia: { nome: 'Professora Restinga', spr: { h: '#92400e', b: '#bbf7d0', d: '#15803d' } },
    artesao: 'Ferreiro do Vulcão',
    zonas: [['Litoral Tropical', 'campo'], ['Selva Densa', 'floresta'], ['Deserto e Céu do Norte', 'deserto'], ['Vulcão Rubro', 'vulcao'], ['Ilhas do Alto-Mar', 'montanha']],
    pools: {
      1: [261, 263, 265, 270, 273, 276, 278, 280, 283, 285, 287, 290, 293, 300],
      2: [262, 264, 267, 269, 271, 274, 277, 286, 288, 296, 304, 307, 309, 311, 312, 315],
      3: [299, 302, 303, 305, 322, 327, 328, 331, 333, 335, 336, 343, 27, 74],
      4: [353, 355, 354, 356, 357, 359, 323, 332, 329, 325, 326, 344, 218, 324],
      5: [306, 330, 334, 371, 372, 374, 375, 352, 297, 308, 310, 282, 373, 376],
    },
    water: {
      1: [129, 72, 278, 270, 318, 320, 339], 2: [279, 271, 318, 341, 349, 370, 320], 3: [319, 340, 342, 345, 347, 363, 366],
      4: [321, 364, 367, 368, 369, 73, 130], 5: [130, 365, 321, 369, 367, 368, 230],
    },
    night: [353, 354, 355, 356, 302, 261, 262, 359], rare: [351, 352, 357, 359, 349, 371, 374, 133], migra: [276, 278, 333], lendas: [377, 378, 379, 380, 381],
    vilao: 'Seita das Marés', grunts: [261, 262, 318, 319, 320, 341, 342, 72, 73],
    gyms: [
      { type: 'rock', nome: 'Ginásio das Rochas', lider: 'Líder Rocha', boss: 299, pool: [74, 75, 304, 305, 345, 347] },
      { type: 'fighting', nome: 'Ginásio da Onda', lider: 'Surfista Breno', boss: 297, pool: [66, 67, 296, 307, 308, 286] },
      { type: 'electric', nome: 'Ginásio das Engrenagens', lider: 'Inventor Watts', boss: 310, pool: [81, 82, 100, 101, 309, 311, 312] },
      { type: 'fire', nome: 'Ginásio das Fontes Termais', lider: 'Líder Fumaça', boss: 324, pool: [218, 219, 322, 323, 58, 255, 256] },
      { type: 'normal', nome: 'Ginásio da Força', lider: 'Pai Norberto', boss: 289, pool: [287, 288, 263, 264, 300, 301, 327, 335] },
      { type: 'flying', nome: 'Ginásio das Nuvens', lider: 'Líder Penélope', boss: 334, pool: [276, 277, 278, 279, 333, 227, 357] },
      { type: 'psychic', nome: 'Ginásio dos Gêmeos', lider: 'Gêmeos Sol e Lua', boss: 338, pool: [280, 281, 325, 326, 337, 343, 344, 358] },
      { type: 'water', nome: 'Ginásio do Gelo Fino', lider: 'Mestre Wallace', boss: 350, pool: [320, 318, 319, 341, 342, 340, 370, 364] },
    ],
    final: { nome: 'Caverna do Abismo', lider: 'Titã dos Oceanos', boss: 382, type: 'water' },
    historia: {
      prologo: `A <b>Seita das Marés</b> quer expandir os oceanos e afogar a terra firme. Para isso, procura um orbe antigo capaz de despertar o <b>Titã dos Oceanos</b>.
        A Professora Restinga quer que você siga a trilha dos oito ginásios de Hoenn e chegue antes deles.`,
      caps: [
        ['O Líder Rocha estuda fósseis nas cavernas. A Seita escavou ilegalmente perto do ginásio dele, na Cidade de Rocha, a noroeste.', 'Rocha mostra marcas de escavação: "Eles procuravam uma pedra azul, brilhante. Não era fóssil."'],
        ['Breno, o surfista lutador, conhece cada onda da costa. Os barcos da Seita andam rondando a praia dele.', 'Breno pegou um mapa marítimo da Seita com um X em cima do Vulcão Rubro, ao norte.'],
        ['O Inventor Watts criou um radar de correntes. A Seita roubou as peças para rastrear o Titã.', 'Watts reconstrói o radar e detecta a Seita escavando dentro do Vulcão Rubro.'],
        ['Fumaça cuida das fontes termais do vulcão. A Seita quer esfriar o vulcão com água do mar.', 'Fumaça salvou as fontes, mas a Seita já tirou o <b>Orbe Azul</b> de dentro do vulcão.'],
        ['O Pai Norberto treina a força bruta dos Pokémon. Ele já enfrentou a Seita e sabe onde ficam as bases deles.', 'Norberto aponta a base da Seita no mar e avisa: "O orbe precisa de uma tempestade para funcionar."'],
        ['Penélope voa acima das nuvens. Ela viu a tempestade artificial que a Seita está criando.', 'Do alto, Penélope vê o redemoinho se formando sobre a Caverna do Abismo.'],
        ['Os Gêmeos Sol e Lua leem o céu. Só eles sabem quando o Titã vai despertar.', 'Os gêmeos calculam: o Titã acorda na próxima maré cheia. Falta pouquíssimo tempo.'],
        ['O Mestre Wallace protege a passagem submarina. Sem a confiança dele, ninguém entra na Caverna do Abismo.', 'Wallace abre a passagem: "Leve meu Milotic no coração. O Titã está acordando."'],
      ],
      final: [`A Seita das Marés usou o Orbe Azul. O <b>Titã dos Oceanos</b> despertou na <b>Caverna do Abismo</b> e as chuvas não param. Desça e acalme-o.`,
        `O Titã dos Oceanos voltou a dormir, e o sol abriu de novo sobre Hoenn. A Seita se desfez, e o Orbe Azul foi devolvido ao monte.`],
    },
  },

  sinnoh: {
    nome: 'Sinnoh', sub: 'Geração IV · neve, mitos e o tempo', vila: 'Vila Orvalho',
    guia: { nome: 'Professor Pinheiro', spr: { h: '#e5e7eb', b: '#1f2937', d: '#111827' } },
    artesao: 'Artesão das Placas',
    zonas: [['Planícies Frescas', 'campo'], ['Bosque Eterno', 'floresta'], ['Monte Coronet', 'montanha'], ['Neves do Norte', 'neve'], ['Pilar Lendário', 'sombrio']],
    pools: {
      1: [396, 399, 401, 403, 406, 412, 415, 417, 420, 425, 433, 434, 63, 41],
      2: [397, 400, 402, 404, 315, 427, 431, 436, 446, 455, 453, 95, 74, 66, 413],
      3: [408, 410, 449, 451, 307, 77, 75, 67, 42, 299, 438, 440],
      4: [426, 429, 442, 430, 198, 200, 435, 454, 452, 193, 195, 284],
      5: [459, 460, 215, 220, 221, 361, 362, 478, 461, 473, 445, 444, 448, 475],
    },
    water: {
      1: [129, 418, 422, 456, 72, 54], 2: [419, 423, 457, 60, 118, 183], 3: [61, 458, 226, 223, 224, 55],
      4: [130, 195, 186, 91, 73, 340], 5: [130, 131, 423, 419, 87, 365],
    },
    night: [425, 426, 198, 430, 200, 429, 92, 93, 355, 442], rare: [133, 443, 447, 439, 446, 479, 442, 441], migra: [396, 397, 425], lendas: [480, 481, 482, 485, 486, 488],
    vilao: 'Ordem do Vazio', grunts: [41, 42, 434, 435, 451, 452, 198, 430, 436, 437],
    gyms: [
      { type: 'rock', nome: 'Ginásio da Mina', lider: 'Líder Rocco', boss: 409, pool: [74, 75, 95, 408, 410, 438] },
      { type: 'grass', nome: 'Ginásio do Jardim', lider: 'Líder Gardênia', boss: 407, pool: [406, 315, 420, 421, 455, 387, 388] },
      { type: 'fighting', nome: 'Ginásio da Aura', lider: 'Mestra Maylene', boss: 448, pool: [66, 67, 307, 308, 447, 453, 106, 107] },
      { type: 'water', nome: 'Ginásio das Corredeiras', lider: 'Lutador Correnteza', boss: 419, pool: [418, 419, 422, 423, 60, 61, 129] },
      { type: 'ghost', nome: 'Ginásio do Velório', lider: 'Atriz Fantine', boss: 429, pool: [92, 93, 200, 425, 426, 442, 355] },
      { type: 'steel', nome: 'Ginásio das Muralhas', lider: 'Líder Escudo', boss: 411, pool: [410, 411, 436, 437, 81, 82, 208, 95] },
      { type: 'ice', nome: 'Ginásio da Nevasca', lider: 'Patinadora Candice', boss: 460, pool: [459, 220, 221, 215, 361, 478, 87] },
      { type: 'electric', nome: 'Ginásio da Usina', lider: 'Líder Volkner', boss: 466, pool: [403, 404, 405, 417, 125, 81, 82, 479] },
    ],
    final: { nome: 'Pilar do Tempo', lider: 'Senhor do Tempo', boss: 483, type: 'steel' },
    historia: {
      prologo: `A <b>Ordem do Vazio</b> acredita que o mundo é imperfeito e quer recomeçar o tempo do zero. Para isso, vai capturar os três espíritos dos lagos e invocar o <b>Senhor do Tempo</b>.
        O Professor Pinheiro pede que você visite os oito ginásios de Sinnoh: os líderes guardam pistas dos mitos antigos.`,
      caps: [
        ['Rocco, filho de mineiros, encontrou placas antigas na mina. A Ordem quer essas placas. O ginásio dele fica na Cidade do Carvão, ao norte da vila.', 'As placas falam de um pilar no alto do Monte Coronet, onde o tempo "pode ser reescrito".'],
        ['Gardênia cuida do bosque onde dorme uma árvore milenar. A Ordem anda cortando galhos por lá.', 'Gardênia descobre que a Ordem procura <b>três lagos</b>: o do Saber, o da Emoção e o da Vontade.'],
        ['Maylene medita na montanha e sente a aura dos Pokémon. Ela sentiu algo errado no lago do Saber.', 'O lago do Saber está vazio: a Ordem já capturou o primeiro espírito.'],
        ['O lutador Correnteza vigia o grande pântano. Os barcos da Ordem passam por ali rumo ao segundo lago.', 'Correnteza chegou tarde: o espírito da Emoção também foi levado.'],
        ['Fantine, a atriz, fala com os mortos no velório da cidade. Os fantasmas viram para onde levaram os espíritos.', 'Os fantasmas apontam o caminho: a base da Ordem fica embaixo das muralhas da cidade de ferro.'],
        ['O Líder Escudo protege as muralhas. A Ordem cavou túneis por baixo delas.', 'Escudo derruba os túneis, mas a Ordem já fugiu levando o terceiro espírito.'],
        ['Candice patina no lago gelado ao norte. É de lá que se sobe até o Pilar do Tempo.', 'Candice mostra a trilha na neve: "O chefe da Ordem subiu ontem. Ele vai invocar o Senhor do Tempo."'],
        ['Volkner, o líder entediado, acendeu a cidade inteira para guiar você até o pico. Mas antes quer uma luta de verdade.', 'Volkner finalmente se diverte: "Vai lá. Se alguém pode parar o tempo de acabar, é você."'],
      ],
      final: [`No alto do <b>Pilar do Tempo</b>, a Ordem do Vazio invocou o <b>Senhor do Tempo</b>, e o próprio tempo começou a rachar. Enfrente o lendário e liberte os espíritos.`,
        `Os espíritos voltaram aos lagos, o Senhor do Tempo se acalmou e o tempo voltou a correr normalmente. A Ordem do Vazio acabou. Sinnoh tem um novo campeão.`],
    },
  },

  unova: {
    nome: 'Unova', sub: 'Geração V · verdade e ideais', vila: 'Vila Nuvem',
    guia: { nome: 'Professora Acácia', spr: { h: '#a16207', b: '#e0f2fe', d: '#0369a1' } },
    artesao: 'Engenheira Lírio',
    zonas: [['Planícies do Sul', 'campo'], ['Floresta dos Cata-Ventos', 'floresta'], ['Deserto do Repouso', 'deserto'], ['Norte Gelado', 'neve'], ['Caminho dos Gigantes', 'montanha']],
    pools: {
      1: [504, 506, 509, 511, 513, 515, 519, 527, 531, 532, 540, 543, 546, 548],
      2: [505, 507, 510, 520, 522, 524, 529, 541, 544, 551, 554, 556, 557, 559, 562],
      3: [525, 533, 538, 539, 552, 558, 566, 568, 570, 572, 574, 577, 585, 587, 595, 597],
      4: [563, 569, 571, 596, 598, 600, 602, 605, 607, 608, 610, 615, 619, 622, 624, 627, 629],
      5: [609, 611, 620, 623, 625, 626, 628, 630, 631, 632, 633, 634, 637, 621, 553],
    },
    water: {
      1: [550, 535, 580, 129], 2: [536, 550, 580, 592], 3: [564, 594, 537, 592], 4: [593, 565, 602, 603, 594], 5: [604, 593, 565, 130, 537],
    },
    night: [527, 528, 562, 563, 607, 608, 570, 571, 509, 510], rare: [570, 610, 633, 636, 618, 587, 531, 621], migra: [519, 520, 580], lendas: [638, 639, 640, 641, 642, 645],
    vilao: 'Ordem da Verdade', grunts: [509, 510, 559, 560, 568, 569, 624, 625, 629, 630],
    gyms: [
      { type: 'grass', nome: 'Restaurante dos Trigêmeos', lider: 'Trigêmeos Chef', boss: 512, pool: [511, 513, 515, 514, 516, 506] },
      { type: 'normal', nome: 'Ginásio do Museu', lider: 'Curadora Lenora', boss: 505, pool: [504, 506, 507, 572, 531, 519] },
      { type: 'bug', nome: 'Ginásio da Colmeia', lider: 'Artista Burgh', boss: 542, pool: [540, 541, 543, 544, 545, 588, 557] },
      { type: 'electric', nome: 'Ginásio da Montanha-Russa', lider: 'Modelo Elesa', boss: 523, pool: [522, 587, 595, 602, 603, 527] },
      { type: 'ground', nome: 'Ginásio do Elevador', lider: 'Líder Clay', boss: 530, pool: [529, 551, 552, 622, 618, 524, 525] },
      { type: 'flying', nome: 'Ginásio do Canhão', lider: 'Piloto Skyla', boss: 581, pool: [519, 520, 521, 527, 528, 561, 566, 580] },
      { type: 'ice', nome: 'Ginásio da Pista de Gelo', lider: 'Líder Brycen', boss: 614, pool: [582, 583, 584, 613, 615] },
      { type: 'dragon', nome: 'Ginásio do Dragão', lider: 'Prefeito Drayden', boss: 612, pool: [610, 611, 621, 633, 634] },
    ],
    final: { nome: 'Castelo dos Ideais', lider: 'Dragão da Verdade', boss: 643, type: 'dragon' },
    historia: {
      prologo: `A <b>Ordem da Verdade</b> prega que treinadores devem libertar seus Pokémon, mas por trás dos discursos há um plano para dominar Unova com um dragão lendário.
        A Professora Acácia pede que você enfrente os oito ginásios e descubra o que a Ordem esconde.`,
      caps: [
        ['Os Trigêmeos Chef servem batalhas junto com o almoço na Cidade Estriada, ao norte da vila. Um membro da Ordem discursou lá ontem.', 'Os trigêmeos guardaram o panfleto da Ordem: "A verdade despertará o dragão branco."'],
        ['A Curadora Lenora cuida do museu, onde fica uma pedra escura muito antiga. A Ordem quer roubá-la.', 'A pedra do museu foi trocada por uma falsa. A Ordem já levou a Pedra da Verdade.'],
        ['O artista Burgh pinta no meio da colmeia. Ele viu a Ordem escondendo algo na Mata das Pinheiras.', 'Burgh desenha o rosto do líder da Ordem, um jovem chamado <b>N.</b>, que fala com os Pokémon.'],
        ['Elesa ilumina a cidade dos parques de diversão. A Ordem montou um palanque na frente do ginásio dela.', 'Elesa ouviu N. dizer que vai acordar o dragão "no castelo, quando tiver o apoio do povo".'],
        ['Clay controla as minas do deserto. A Ordem anda cavando atrás de uma passagem para o castelo.', 'Clay fecha as minas, mas confirma: o castelo da Ordem fica além do Caminho dos Gigantes.'],
        ['Skyla dispara pelos céus num canhão. Do alto, ela consegue ver o castelo escondido.', 'Skyla viu a torre do castelo surgindo do chão, no extremo norte.'],
        ['Brycen, ex-ator, treina numa pista de gelo. Ele sabe atravessar a nevasca do norte.', 'Brycen abre o caminho pela nevasca: "O dragão já está despertando. Corra."'],
        ['O Prefeito Drayden e seus dragões guardam a última passagem. Prove que pode enfrentar um dragão de verdade.', 'Drayden entrega a você a escama de um dragão ancestral: "Ela vai te proteger do fogo branco."'],
      ],
      final: [`N. despertou o <b>Dragão da Verdade</b> no <b>Castelo dos Ideais</b>. Entre no castelo e mostre que a amizade entre treinadores e Pokémon também é uma verdade.`,
        `O Dragão da Verdade reconheceu seus ideais e se recolheu. N. libertou os próprios Pokémon e partiu, pensativo. A Ordem da Verdade se desfez, e Unova está em paz.`],
    },
  },
};
const REGION_IDS = Object.keys(REGIONS);
let REGION_ID = 'kanto', REGION = REGIONS.kanto;

// todos os Pokémon que a região usa (para pré-carregar)
function regionIds(R) {
  const s = new Set([...Object.values(R.pools).flat(), ...Object.values(R.water).flat(), ...R.night, ...R.rare, ...R.migra, ...R.lendas, ...R.grunts, R.final.boss]);
  for (const g of R.gyms) { s.add(g.boss); g.pool.forEach(id => s.add(id)); }
  return [...s];
}

const BASE_THEME_KEYS = Object.keys(THEMES);
const BASE_TYPE_THEME = { ...TYPE_THEME };
const BASE_DARK = [...DARK_THEMES];
const replaceArr = (a, b) => { a.length = 0; a.push(...b); };
const replaceObj = (o, b) => { for (const k of Object.keys(o)) delete o[k]; Object.assign(o, b); };

function setRegion(id) {
  const R = REGIONS[id] || REGIONS.kanto;
  REGION_ID = REGIONS[id] ? id : 'kanto'; REGION = R;
  // zonas e Pokémon
  replaceArr(ZONES, [{ nome: R.vila, bio: 'vila', ...BIOMES.vila, lvl: 1 }, ...R.zonas.map(([nome, bio], i) => ({ nome, bio, ...BIOMES[bio], lvl: ZONE_LVL[i + 1], lvlMax: ZONE_LVL_MAX[i + 1] })),
    { nome: 'Arena PvP', bio: 'campo', ...BIOMES.campo, lvl: 1 }]);
  replaceObj(ZONE_POOLS, R.pools); replaceObj(WATER_POOLS, R.water);
  replaceArr(BOSSES, R.lendas); replaceArr(RARE_POOL, R.rare); replaceArr(NIGHT_POOL, R.night); replaceArr(MIGRATION_POOL, R.migra);
  replaceObj(HM_GYM, R.hmGym || HM_GYM_BASE);
  const geo = GEO[REGION_ID];
  setGeo(geo);
  replaceArr(LANDMARKS, [['vila', R.vila, geo.vila[0], geo.vila[1] + 0.12], ...geo.marks.map(([nome, cx, cy], i) => [REGION_ID + '_c' + i, nome, cx, cy])]
    .map(([id, nome, cx, cy]) => { const [x, y] = cellPt(cx, cy); return { id, nome, at: [cx, cy], x, y }; }));
  // a 2ª cidade é um destino de Fly (pouso na praça, ao sul do chafariz)
  const t2 = TOWNS[1], lt = t2 && LANDMARKS.find(l => l.nome === t2.nome);
  if (lt) Object.assign(lt, { id: 'town2', x: t2.x, y: t2.y + 100 });
  // ginásios viram temas de masmorra
  for (const k of Object.keys(THEMES)) if (!BASE_THEME_KEYS.includes(k)) delete THEMES[k];
  replaceObj(TYPE_THEME, BASE_TYPE_THEME); replaceArr(DARK_THEMES, BASE_DARK);
  R.gyms.forEach((g, i) => {
    const st = GYM_STYLE[g.type] || GYM_STYLE.normal, key = 'gym' + (i + 1);
    THEMES[key] = { nome: g.nome, floor: [st[0], st[1]], wall: st[2], top: st[3], accent: TYPE_COLORS[g.type], pool: g.pool, boss: g.boss, story: i + 1, gym: i + 1, zmin: GYM_ZONE[i] };
    if (g.type === 'ghost' || g.type === 'dark') DARK_THEMES.push(key);
  });
  // o esconderijo do vilão é escuro em todas as regiões: o Flash do 2º ginásio volta a importar no clímax
  const fs = GYM_STYLE[R.final.type] || GYM_STYLE.dark;
  THEMES.final = { nome: R.final.nome, floor: [fs[0], fs[1]], wall: fs[2], top: fs[3], accent: '#ef4444', pool: R.grunts, boss: R.final.boss, story: 9, zmin: 5 };
  DARK_THEMES.push('final');
  replaceArr(THEME_IDS, [...new Set(Object.values(THEMES).flatMap(t => [...t.pool, t.boss]))]);
  // história
  const H = R.historia;
  replaceArr(STORY, [{ titulo: 'Prólogo', intro: H.prologo }, ...R.gyms.map((g, i) => ({
    titulo: `${g.nome}`, obj: `Vença ${g.lider} no ${g.nome} (insígnia ${i + 1}/8)`, at: geo.gyms[i], zone: GYM_ZONE[i], lvl: GYM_LVL[i],
    kind: 'dungeon', theme: 'gym' + (i + 1), nome: g.lider, intro: H.caps[i][0], fim: H.caps[i][1],
  })), {
    titulo: R.final.nome, obj: `Entre em ${R.final.nome} e enfrente ${R.final.lider}`, at: geo.gyms[8], zone: GYM_ZONE[8], lvl: GYM_LVL[8],
    kind: 'dungeon', theme: 'final', nome: R.final.lider, intro: H.final[0], fim: H.final[1],
  }]);
  replaceArr(STORY_IDS, [R.final.boss, ...R.gyms.map(g => g.boss)]);
  // NPCs da vila
  const guia = NPCS.find(n => n.id === 'sildo'), art = NPCS.find(n => n.id === 'gundo');
  guia.nome = R.guia.nome; guia.spr = R.guia.spr; art.nome = R.artesao;
  if (typeof buildNPCSprites === 'function') buildNPCSprites();
  rebuildWorld();
  rebuildTownNPCs();
  buildDex();
}
