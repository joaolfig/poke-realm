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
    babies: [172, 173, 174], // Pichu (Floresta de Viridian), Cleffa e Igglybuff (perto do Mt. Moon)
    // contratos: o que esta região pede mais e quem pede (além dos personagens de sempre)
    side: { peso: { pesquisa: 2, pegar: 1, caca: 1 }, pessoas: {
      pesquisa: [['Assistente do Prof. Carvalho', 'a Pokédex de Kanto ainda tem páginas em branco']],
      caca: [['Policial Jenny', 'um Pokémon furioso está atacando quem passa pela rota']],
      pegar: [['Garoto do Safari', 'nunca consegui pegar um desses na Zona Safari']],
      coleta: [['Vendedor do Monte Lunar', 'vendo lembrancinhas feitas com isso']] } },
    // etapas da história dadas por outros NPCs (antes do ginásio do capítulo ch); a 1ª captura vale em todas as regiões
    interludes: [
      { ch: 3, npc: 'dex', kind: 'dexn', n: 8, titulo: 'Páginas da Pokédex', fala: 'O Professor Carvalho quer dados de campo antes de você seguir. A Pokédex de Kanto ainda tem páginas demais em branco: registre pelo menos 8 espécies capturadas e volte à estrada.', obj: 'Tenha 8 espécies capturadas na Pokédex de Kanto' },
      { ch: 7, npc: 'cura', kind: 'capball', n: 1, z: 4, titulo: 'A prova do treinador', fala: 'Os últimos líderes não recebem qualquer um. Eles querem ver se você sabe lidar com os Pokémon da {Z4}... e esses não se entregam fácil. Traga a prova: capture um deles com uma Great Ball ou uma Ultra Ball.', obj: 'Capture um Pokémon na {Z4} com Great Ball ou Ultra Ball' },
    ],
    // Alfas da Lua: Pokémon noturnos de verdade (pela lore e pelos jogos)
    moon: [94, 93, 42, 97, 36, 49, 53], // Gengar, Haunter, Golbat, Hypno, Clefable (a lua), Venomoth (mariposa da noite), Persian
    nome: 'Kanto', sub: 'Gerações I · onde tudo começou', vila: 'Cidade de Pallet',
    guia: { nome: 'Professor Carvalho', spr: { h: '#9ca3af', b: '#f1f5f9', d: '#64748b' } },
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
    night: [92, 93, 41, 42, 96, 97, 104, 109], rare: [133, 147, 132, 137, 83, 113, 123, 131], migra: [16, 21, 17], lendas: [144, 145, 146, 151], // + Mew
    vilao: 'Equipe Rocket', grunts: [19, 20, 23, 24, 41, 42, 52, 53, 88, 89, 109, 110],
    gyms: [
      { type: 'rock', nome: 'Ginásio de Pedra', lider: 'Líder Brock', boss: 95, pool: [74, 75, 95, 111, 27, 104, 138, 140] },
      { type: 'water', nome: 'Ginásio das Cascatas', lider: 'Líder Misty', boss: 121, pool: [120, 118, 54, 60, 90, 98, 116] },
      { type: 'electric', nome: 'Ginásio Relâmpago', lider: 'Tenente Surge', boss: 26, pool: [100, 81, 25, 125, 82, 101] },
      { type: 'grass', nome: 'Ginásio Estufa', lider: 'Líder Erika', boss: 45, pool: [43, 44, 69, 70, 114, 1, 2, 102] },
      { type: 'poison', nome: 'Ginásio Ninja', lider: 'Ninja Koga', boss: 110, pool: [109, 88, 89, 48, 49, 23, 24, 42] },
      { type: 'psychic', nome: 'Ginásio Psíquico', lider: 'Médium Sabrina', boss: 65, pool: [63, 64, 96, 97, 122, 79, 80] },
      { type: 'fire', nome: 'Ginásio do Vulcão', lider: 'Líder Blaine', boss: 59, pool: [58, 37, 38, 77, 78, 126, 4, 5] },
      { type: 'ground', nome: 'Ginásio da Terra', lider: 'Chefe Giovanni', boss: 112, pool: [27, 28, 50, 51, 104, 105, 111, 31, 34] },
    ],
    final: { nome: 'Laboratório Secreto da Equipe Rocket', lider: 'Mewtwo', boss: 150, type: 'psychic' },
    historia: {
      prologo: `A <b>Equipe Rocket</b> anda roubando Pokémon pelas estradas de Kanto, e ninguém sabe para quê.
        O Professor Carvalho acredita que os oito líderes de ginásio sabem de alguma coisa. Vença cada um, ganhe a confiança deles e descubra o plano da Equipe Rocket.`,
      caps: [
        ['Brock, o líder de pedra, desconfia de forasteiros. Prove seu valor na Cidade de Pewter, seguindo a estrada {d:v>g1} da vila.', 'Brock conta que a Equipe Rocket comprou todas as Pedras-Lua da região. "Para que alguém precisa de tantas?"'],
        ['A Líder Misty viu barcos da Equipe Rocket no rio. Ela só fala com quem vencer suas cascatas.', 'Misty mostra um mapa molhado: a Equipe Rocket leva os Pokémon roubados para o sul, passando pelo Monte Lunar.'],
        ['O Tenente Surge guarda a usina que abastece Kanto. A Equipe Rocket tentou sabotá-la ontem à noite.', 'Surge prendeu um capanga, que repetia sem parar: "o chefe vai criar o Pokémon mais forte do mundo".'],
        ['Erika cuida da estufa onde se fazem os remédios da região. Agentes da Equipe Rocket foram vistos rondando por lá.', 'Erika descobre que a Equipe Rocket roubou amostras genéticas da estufa. Eles não querem só roubar Pokémon. Querem criar um.'],
        ['O ninja Koga conhece todos os segredos do pântano. Dizem que a Equipe Rocket tem um esconderijo lá.', 'Koga derruba uma parede falsa e revela anotações de um laboratório: "Projeto Mewtwo, fase final".'],
        ['A Médium Sabrina teve uma visão: um Pokémon nascido da raiva. Ela precisa testar se você está pronto para enfrentá-lo.', 'Sabrina sente que o Pokémon criado está acordando. "Ele odeia quem o fez. E vai odiar você também."'],
        ['O Líder Blaine estudou genética antes de virar líder. Ele sabe quem financiou a Equipe Rocket.', 'Blaine confessa que trabalhou no projeto e fugiu. O financiador é um líder de ginásio: o Chefe Giovanni.'],
        ['O último ginásio pertence ao Chefe Giovanni, o próprio chefe da Equipe Rocket. Derrote-o no ginásio dele.', 'Giovanni cai e entrega a chave do laboratório: "Eu não consigo mais controlar a criatura. Ninguém consegue."'],
      ],
      final: [`Descendo a Estrada da Vitória fica o <b>Laboratório Secreto da Equipe Rocket</b>. Lá dentro, <b>Mewtwo</b> despertou de vez. Acabe com isso.`,
        `Mewtwo foi derrotado e partiu para viver longe dos humanos. A Equipe Rocket acabou, os Pokémon roubados voltaram para casa e Kanto tem um novo campeão.`],
    },
  },

  johto: {
    babies: [172, 173, 174, 175], // os bebês da Geração II: Pichu, Cleffa, Igglybuff e Togepi
    side: { peso: { bolaboa: 2, pegar: 1 }, pessoas: {
      bolaboa: [['Kurt, o artesão de bolas', 'quero saber se as bolas novas seguram Pokémon de verdade']],
      especie: [['Fazendeiro da Moomoo', 'eles estão assustando as Miltank']],
      pesquisa: [['Professor Elm', 'quero entender por que alguns Pokémon só existem em Johto']] } },
    interludes: [
      { ch: 3, npc: 'cura', kind: 'capball', n: 1, z: 2, titulo: 'As bolas do Kurt', fala: 'O velho Kurt mandou bolas novas e quer saber se elas aguentam Pokémon de verdade. Antes do próximo ginásio, capture um Pokémon da {Z2} com uma Great Ball ou uma Ultra Ball.', obj: 'Capture um Pokémon na {Z2} com Great Ball ou Ultra Ball' },
      { ch: 7, npc: 'ferreiro', kind: 'forja', n: 4, titulo: 'Aço para dragões', fala: 'Depois do gelo do Pryce vêm os dragões da Mestra Clair, e eles quebram arma comum como se fosse graveto. Traga a sua para a minha bigorna e deixe ela pelo menos +4 antes de seguir.', obj: 'Aprimore sua arma até +4 na Ferreira' },
    ],
    // Alfas da Lua: Pokémon noturnos de verdade (pela lore e pelos jogos)
    moon: [164, 198, 197, 229, 200, 215, 169, 168], // Noctowl, Murkrow, Umbreon, Houndoom, Misdreavus, Sneasel, Crobat, Ariados
    nome: 'Johto', sub: 'Geração II · tradição e lendas', vila: 'Cidade de New Bark',
    guia: { nome: 'Professor Elm', spr: { h: '#78350f', b: '#fef3c7', d: '#b45309' } },
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
    night: [163, 164, 198, 200, 228, 92, 93, 41, 169, 215], rare: [133, 147, 246, 175, 132, 201, 225, 235], migra: [163, 165, 187], lendas: [243, 244, 245, 250, 251], // + Ho-Oh e Celebi
    vilao: 'Equipe Rocket', grunts: [19, 20, 41, 42, 109, 110, 198, 228, 229, 215],
    gyms: [
      { type: 'flying', nome: 'Ginásio das Alturas', lider: 'Líder Falkner', boss: 17, pool: [16, 17, 21, 163, 84, 177] },
      { type: 'bug', nome: 'Ginásio do Casulo', lider: 'Líder Bugsy', boss: 123, pool: [10, 11, 13, 14, 165, 167, 204, 193] },
      { type: 'normal', nome: 'Ginásio do Leite', lider: 'Líder Whitney', boss: 241, pool: [161, 162, 19, 20, 206, 190, 209, 39, 40] },
      { type: 'ghost', nome: 'Ginásio Assombrado', lider: 'Vidente Morty', boss: 94, pool: [92, 93, 200, 92, 93, 200, 201] },
      { type: 'fighting', nome: 'Ginásio do Dojô', lider: 'Mestre Chuck', boss: 62, pool: [56, 57, 66, 67, 106, 107, 237] },
      { type: 'steel', nome: 'Ginásio do Farol', lider: 'Líder Jasmine', boss: 208, pool: [81, 82, 204, 205, 227, 95] },
      { type: 'ice', nome: 'Ginásio Congelado', lider: 'Líder Pryce', boss: 221, pool: [86, 87, 220, 215, 124, 225, 91] },
      { type: 'dragon', nome: 'Ginásio dos Dragões', lider: 'Mestra Clair', boss: 230, pool: [147, 148, 116, 117, 130] },
    ],
    final: { nome: 'Ilhas Whirl', lider: 'Lugia', boss: 249, type: 'water' },
    historia: {
      prologo: `Os sinos das torres antigas de Johto pararam de tocar. Dizem que os capangas da <b>Equipe Rocket</b> roubaram as plumas sagradas que acalmam Lugia.
        O Professor Elm pede que você percorra os oito ginásios: cada líder guarda um pedaço da lenda.`,
      caps: [
        ['Falkner, o líder dos pássaros, viu os capangas da Equipe Rocket voando para longe. Ele treina na Cidade de Violet, {d:v>g1} da vila.', 'Falkner mostra uma pena prateada caída no ginásio. "Isso não é de nenhum pássaro comum. É uma pluma sagrada."'],
        ['O Líder Bugsy cuida do bosque onde a pluma foi achada. Os capangas da Equipe Rocket estão capturando os insetos de lá.', 'Bugsy encontra um bilhete da Equipe Rocket: "Com as plumas, chamaremos Lugia e controlaremos o mar."'],
        ['Whitney e sua Miltank seguram as fazendas da região. Os capangas da Equipe Rocket querem os rebanhos para alimentar seus Pokémon.', 'Whitney conta que os capangas da Equipe Rocket usam uma rádio pirata para dar ordens. O sinal vem das ruínas {d:g3>g4}.'],
        ['Morty, o vidente, fala com os espíritos das torres queimadas. Eles sabem onde estão as plumas.', 'Os espíritos sussurram: duas plumas já estão com os capangas da Equipe Rocket. Falta uma, escondida no farol.'],
        ['O Mestre Chuck treina no dojô da montanha. Os capangas da Equipe Rocket tentaram recrutar os lutadores dele à força.', 'Chuck expulsa os capangas da Equipe Rocket do dojô e descobre o nome do chefe deles: <b>o Executivo Archer</b>.'],
        ['Jasmine cuida do farol, e a Ampharos do farol adoeceu. Sem a luz, os barcos da Equipe Rocket navegam sem ser vistos.', 'Com o farol aceso de novo, Jasmine acha a terceira pluma escondida no alto da torre e a entrega a você. Lá do alto, ela vê os barcos da Equipe Rocket indo para as Ilhas Whirl.'],
        ['O Líder Pryce mora perto do lago gelado e sabe atravessar as correntezas do mar. Prove que aguenta o frio.', 'Pryce ensina o caminho pelas correntezas: "Siga os redemoinhos. Lugia dorme no centro."'],
        ['A Mestra Clair protege o santuário dos dragões, e os capangas da Equipe Rocket querem roubar os ovos de lá.', 'Clair toma dos capangas as duas plumas roubadas e entrega a você: "Agora você tem as três. Só quem tem as três pode acalmar Lugia."'],
      ],
      final: [`Sem as plumas, o Executivo Archer acordou <b>Lugia</b> à força, e ele despertou furioso nas <b>Ilhas Whirl</b>. Leve as três plumas, enfrente-o e devolva a calma ao oceano.`,
        `Lugia se acalmou e voltou a dormir no fundo do mar. Os capangas da Equipe Rocket se dispersaram, e os sinos de Johto voltaram a tocar.`],
    },
  },

  hoenn: {
    babies: [298, 360], // Azurill (rios do começo) e Wynaut
    side: { peso: { coleta: 2, especie: 1, explorar: 1 }, pessoas: {
      coleta: [['Pescador de Slateport', 'faço iscas com isso'], ['Devon S.A.', 'nossos laboratórios precisam de amostras']],
      especie: [['Marinheiro Briney', 'um bando deles tomou o caminho até o meu barco']],
      explorar: [['Mergulhadora de Mossdeep', 'quero saber o que existe além das correntes']] } },
    interludes: [
      { ch: 3, npc: 'dex', kind: 'explore', n: 25, titulo: 'O mapa de Hoenn', fala: 'Hoenn é mar, vulcão e floresta, e metade dos mapas está errada. Antes de seguir, explore pelo menos 25% da região para eu corrigir as rotas.', obj: 'Explore 25% de Hoenn (o mapa revela por onde você passa)' },
      { ch: 7, npc: 'cura', kind: 'capball', n: 1, z: 4, titulo: 'A prova do treinador', fala: 'Os últimos líderes querem ver se você sabe lidar com os Pokémon da {Z4}. Traga a prova: capture um deles com uma Great Ball ou uma Ultra Ball.', obj: 'Capture um Pokémon na {Z4} com Great Ball ou Ultra Ball' },
    ],
    // Alfas da Lua: Pokémon noturnos de verdade (pela lore e pelos jogos)
    moon: [354, 356, 302, 262, 359, 337, 269], // Banette, Dusclops, Sableye, Mightyena, Absol, Lunatone, Dustox
    nome: 'Hoenn', sub: 'Geração III · mar, vulcões e céu', vila: 'Cidade de Littleroot',
    hmGym: { 1: 'cut', 2: 'flash', 3: 'smash', 4: 'surf' },
    guia: { nome: 'Professor Birch', spr: { h: '#92400e', b: '#bbf7d0', d: '#15803d' } },
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
    night: [353, 354, 355, 356, 302, 261, 262, 359], rare: [351, 352, 357, 359, 349, 371, 374, 133], migra: [276, 278, 333], lendas: [377, 378, 379, 380, 381, 383, 384, 385, 386], // + Groudon, Rayquaza, Jirachi e Deoxys
    vilao: 'Equipe Aqua', grunts: [261, 262, 318, 319, 320, 341, 342, 72, 73],
    gyms: [
      { type: 'rock', nome: 'Ginásio das Rochas', lider: 'Líder Roxanne', boss: 299, pool: [74, 75, 304, 305, 345, 347] },
      { type: 'fighting', nome: 'Ginásio da Onda', lider: 'Surfista Brawly', boss: 297, pool: [66, 67, 296, 307, 308, 286] },
      { type: 'electric', nome: 'Ginásio das Engrenagens', lider: 'Inventor Wattson', boss: 310, pool: [81, 82, 100, 101, 309, 311, 312] },
      { type: 'fire', nome: 'Ginásio das Fontes Termais', lider: 'Líder Flannery', boss: 324, pool: [218, 219, 322, 323, 58, 255, 256] },
      { type: 'normal', nome: 'Ginásio da Força', lider: 'Líder Norman', boss: 289, pool: [287, 288, 263, 264, 300, 301, 327, 335] },
      { type: 'flying', nome: 'Ginásio das Nuvens', lider: 'Líder Winona', boss: 334, pool: [276, 277, 278, 279, 333, 227, 357] },
      { type: 'psychic', nome: 'Ginásio dos Gêmeos', lider: 'Gêmeos Tate e Liza', boss: 338, pool: [280, 281, 325, 326, 337, 343, 344, 358] },
      { type: 'water', nome: 'Ginásio do Gelo Fino', lider: 'Mestre Wallace', boss: 350, pool: [320, 318, 319, 341, 342, 340, 370, 364] },
    ],
    final: { nome: 'Seafloor Cavern', lider: 'Kyogre', boss: 382, type: 'water' },
    historia: {
      prologo: `A <b>Equipe Aqua</b> quer expandir os oceanos e afogar a terra firme. Para isso, procura um orbe antigo capaz de despertar <b>Kyogre</b>.
        O Professor Birch quer que você siga a trilha dos oito ginásios de Hoenn e chegue antes deles.`,
      caps: [
        ['A Líder Roxanne estuda fósseis nas cavernas. A Equipe Aqua escavou ilegalmente perto do ginásio dela, na Cidade de Rustboro, {d:v>g1} da vila.', 'Roxanne mostra marcas de escavação: "Eles procuravam uma pedra azul, brilhante. Não era fóssil."'],
        ['Brawly, o surfista lutador, conhece cada onda da costa. Os barcos da Equipe Aqua andam rondando a praia dele.', 'Brawly pegou um mapa marítimo da Equipe Aqua com um X em cima do Vulcão Rubro, {d:g2>z4}.'],
        ['O Inventor Wattson criou um radar de correntes. A Equipe Aqua roubou as peças para rastrear Kyogre.', 'Wattson reconstrói o radar e detecta a Equipe Aqua escavando dentro do Vulcão Rubro.'],
        ['Flannery cuida das fontes termais do vulcão. A Equipe Aqua quer esfriar o vulcão com água do mar.', 'Flannery salvou as fontes, mas a Equipe Aqua já tirou o <b>Orbe Azul</b> de dentro do vulcão.'],
        ['O Líder Norman treina a força bruta dos Pokémon. Ele já enfrentou a Equipe Aqua e sabe onde ficam as bases deles.', 'Norman aponta a base da Equipe Aqua no mar e avisa: "O orbe precisa de uma tempestade para funcionar."'],
        ['Winona voa acima das nuvens. Ela viu a tempestade artificial que a Equipe Aqua está criando.', 'Do alto, Winona vê o redemoinho se formando sobre a Seafloor Cavern.'],
        ['Os Gêmeos Tate e Liza leem o céu. Só eles sabem quando Kyogre vai despertar.', 'Os gêmeos calculam: Kyogre acorda na próxima maré cheia. Falta pouquíssimo tempo.'],
        ['O Mestre Wallace protege a passagem submarina. Sem a confiança dele, ninguém entra na Seafloor Cavern.', 'Wallace abre a passagem: "Leve meu Milotic no coração. Kyogre está acordando."'],
      ],
      final: [`A Equipe Aqua usou o Orbe Azul. <b>Kyogre</b> despertou na <b>Seafloor Cavern</b> e as chuvas não param. Desça e acalme-o.`,
        `Kyogre voltou a dormir, e o sol abriu de novo sobre Hoenn. A Equipe Aqua se desfez, e o Orbe Azul voltou para o fundo do vulcão.`],
    },
  },

  sinnoh: {
    babies: [406, 440, 433], // Budew (Rota 204), Happiny e Chingling
    side: { peso: { pesquisa: 2, explorar: 2, captura: 1 }, pessoas: {
      pesquisa: [['Assistente do Prof. Rowan', 'a evolução dos Pokémon de Sinnoh ainda é um mistério']],
      explorar: [['Alpinista do Monte Coronet', 'as trilhas mudam depois de cada nevasca']],
      captura: [['Guarda das Ruínas', 'quero saber se esses Pokémon confiam em treinadores como nas lendas antigas']] } },
    interludes: [
      { ch: 3, npc: 'dex', kind: 'dexn', n: 10, titulo: 'A pesquisa do Prof. Rowan', fala: 'O Professor Rowan estuda a evolução dos Pokémon de Sinnoh e precisa de exemplares. Registre pelo menos 10 espécies capturadas na Pokédex antes do próximo ginásio.', obj: 'Tenha 10 espécies capturadas na Pokédex de Sinnoh' },
      { ch: 7, npc: 'guilda', kind: 'alfa', n: 3, z: 4, titulo: 'Os líderes da nevasca', fala: 'Os bandos da {Z4} estão descendo para as cidades, puxados pelos Alfas. A Liga não abre o caminho enquanto eles estiverem soltos: derrote 3 Alfas lá.', obj: 'Derrote 3 Pokémon Alfa na {Z4} ou além' },
    ],
    // Alfas da Lua: Pokémon noturnos de verdade (pela lore e pelos jogos)
    moon: [430, 429, 426, 442, 405, 477], // Honchkrow, Mismagius, Drifblim, Spiritomb, Luxray (enxerga no escuro), Dusknoir
    nome: 'Sinnoh', sub: 'Geração IV · neve, mitos e o tempo', vila: 'Cidade de Twinleaf',
    guia: { nome: 'Professor Rowan', spr: { h: '#e5e7eb', b: '#1f2937', d: '#111827' } },
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
    night: [425, 426, 198, 430, 200, 429, 92, 93, 355, 442], rare: [133, 443, 447, 439, 446, 479, 442, 441], migra: [396, 397, 425], lendas: [480, 481, 482, 485, 486, 488, 484, 487, 490, 491, 492, 493], // + Palkia, Giratina, Manaphy, Darkrai, Shaymin e Arceus
    vilao: 'Equipe Galáctica', grunts: [41, 42, 434, 435, 451, 452, 198, 430, 436, 437],
    gyms: [
      { type: 'rock', nome: 'Ginásio da Mina', lider: 'Líder Roark', boss: 409, pool: [74, 75, 95, 408, 410, 185] },
      { type: 'grass', nome: 'Ginásio do Jardim', lider: 'Líder Gardenia', boss: 407, pool: [315, 420, 421, 455, 387, 388] },
      { type: 'fighting', nome: 'Ginásio da Aura', lider: 'Mestra Maylene', boss: 448, pool: [66, 67, 307, 308, 453, 454, 106, 107] },
      { type: 'water', nome: 'Ginásio das Corredeiras', lider: 'Lutador Crasher Wake', boss: 419, pool: [418, 419, 422, 423, 60, 61, 129] },
      { type: 'ghost', nome: 'Ginásio do Velório', lider: 'Atriz Fantina', boss: 429, pool: [92, 93, 200, 425, 426, 442, 355] },
      { type: 'steel', nome: 'Ginásio das Muralhas', lider: 'Líder Byron', boss: 411, pool: [410, 411, 436, 437, 81, 82, 208, 95] },
      { type: 'ice', nome: 'Ginásio da Nevasca', lider: 'Patinadora Candice', boss: 460, pool: [459, 220, 221, 215, 361, 478, 87] },
      { type: 'electric', nome: 'Ginásio da Usina', lider: 'Líder Volkner', boss: 466, pool: [403, 404, 405, 417, 125, 81, 82, 479] },
    ],
    final: { nome: 'Spear Pillar', lider: 'Dialga', boss: 483, type: 'steel' },
    historia: {
      prologo: `A <b>Equipe Galáctica</b> acredita que o mundo é imperfeito e quer recomeçar o tempo do zero. Para isso, vai capturar os três espíritos dos lagos e invocar <b>Dialga</b>.
        O Professor Rowan pede que você visite os oito ginásios de Sinnoh: os líderes guardam pistas dos mitos antigos.`,
      caps: [
        ['Roark, filho de mineiros, encontrou placas antigas na mina. A Equipe Galáctica quer essas placas. O ginásio dele fica na Cidade de Oreburgh, {d:v>g1} da vila.', 'As placas falam de um pilar no alto do Monte Coronet, onde o tempo "pode ser reescrito".'],
        ['Gardenia cuida do bosque onde dorme uma árvore milenar. A Equipe Galáctica anda cortando galhos por lá.', 'Gardenia descobre que a Equipe Galáctica procura <b>três lagos</b>: Acuity, Verity e Valor.'],
        ['Maylene medita na montanha e sente a aura dos Pokémon. Ela sentiu algo errado no Lago Acuity.', 'O Lago Acuity está vazio: a Equipe Galáctica já capturou o primeiro espírito.'],
        ['O lutador Crasher Wake vigia o grande pântano. Os barcos da Equipe Galáctica passam por ali rumo ao segundo lago.', 'Crasher Wake chegou tarde: o espírito do Lago Verity também foi levado.'],
        ['Fantina, a atriz, fala com os mortos no velório da cidade. Os fantasmas viram para onde levaram os espíritos.', 'Os fantasmas apontam o caminho: a base da Equipe Galáctica fica embaixo das muralhas da cidade de ferro.'],
        ['O Líder Byron protege as muralhas. A Equipe Galáctica cavou túneis por baixo delas.', 'Byron derruba os túneis, mas a Equipe Galáctica já fugiu levando o terceiro espírito.'],
        ['Candice patina no lago gelado {d:v>g7} da vila. É de lá que se sobe até o Spear Pillar.', 'Candice mostra a trilha na neve: "O chefe da Equipe Galáctica subiu ontem. Ele vai invocar Dialga."'],
        ['Volkner, o líder entediado, acendeu a cidade inteira para guiar você até o pico. Mas antes quer uma luta de verdade.', 'Volkner finalmente se diverte: "Vai lá. Se alguém pode parar o tempo de acabar, é você."'],
      ],
      final: [`No alto do <b>Spear Pillar</b>, a Equipe Galáctica invocou <b>Dialga</b>, e o próprio tempo começou a rachar. Enfrente o lendário e liberte os espíritos.`,
        `Os espíritos voltaram aos lagos, Dialga se acalmou e o tempo voltou a correr normalmente. A Equipe Galáctica acabou. Sinnoh tem um novo campeão.`],
    },
  },

  unova: {
    side: { peso: { alfa: 2, evento: 1, caca: 1 }, pessoas: {
      caca: [['Detetive Looker', 'esse Pokémon foi visto perto de um esconderijo da Equipe Plasma']],
      alfa: [['Treinadora do Metrô de Batalha', 'só os Alfas dão um treino de verdade']],
      evento: [['Repórter de Castelia', 'preciso de imagens no meio da confusão']],
      pegar: [['Libertadora arrependida', 'quero ver um treinador cuidando de um desses do jeito certo']] } },
    interludes: [
      { ch: 3, npc: 'guilda', kind: 'alfa', n: 2, z: 2, titulo: 'Parceiros de verdade', fala: 'A Equipe Plasma diz que treinadores só usam os Pokémon e que eles seriam mais felizes soltos. Mostre a parceria entre vocês: lute lado a lado com seus companheiros, cuidando deles, e vençam juntos 2 Alfas da {Z2}.', obj: 'Vença 2 Pokémon Alfa com seus companheiros na {Z2} ou além' },
      { ch: 7, npc: 'ferreiro', kind: 'forja', n: 4, titulo: 'Lâmina para o lendário', fala: 'Se o que dizem do Reshiram for verdade, você vai precisar de mais que coragem. Deixe sua arma pelo menos +4 na minha bigorna.', obj: 'Aprimore sua arma até +4 na Ferreira' },
    ],
    // Alfas da Lua: Pokémon noturnos de verdade (pela lore e pelos jogos)
    moon: [510, 571, 609, 528, 563, 608], // Liepard, Zoroark, Chandelure, Swoobat, Cofagrigus, Lampent
    nome: 'Unova', sub: 'Geração V · verdade e ideais', vila: 'Cidade de Nuvema',
    guia: { nome: 'Professora Juniper', spr: { h: '#a16207', b: '#e0f2fe', d: '#0369a1' } },
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
    night: [527, 528, 562, 563, 607, 608, 570, 571, 509, 510], rare: [570, 610, 633, 636, 618, 587, 531, 621], migra: [519, 520, 580], lendas: [638, 639, 640, 641, 642, 645, 644, 646, 494, 647, 648, 649], // + Zekrom, Kyurem, Victini, Keldeo, Meloetta e Genesect
    vilao: 'Equipe Plasma', grunts: [509, 510, 559, 560, 568, 569, 624, 625, 629, 630],
    gyms: [
      { type: 'grass', nome: 'Restaurante dos Trigêmeos', lider: 'Cilan, Chili e Cress', boss: 512, pool: [511, 513, 515, 514, 516, 506] },
      { type: 'normal', nome: 'Ginásio do Museu', lider: 'Curadora Lenora', boss: 505, pool: [504, 506, 507, 572, 531, 519] },
      { type: 'bug', nome: 'Ginásio da Colmeia', lider: 'Artista Burgh', boss: 542, pool: [540, 541, 543, 544, 545, 588, 557] },
      { type: 'electric', nome: 'Ginásio da Montanha-Russa', lider: 'Modelo Elesa', boss: 523, pool: [522, 587, 595, 602, 603, 527] },
      { type: 'ground', nome: 'Ginásio do Elevador', lider: 'Líder Clay', boss: 530, pool: [529, 551, 552, 622, 618, 524, 525] },
      { type: 'flying', nome: 'Ginásio do Canhão', lider: 'Piloto Skyla', boss: 581, pool: [519, 520, 521, 527, 528, 561, 566, 580] },
      { type: 'ice', nome: 'Ginásio da Pista de Gelo', lider: 'Líder Brycen', boss: 614, pool: [582, 583, 584, 613, 615] },
      { type: 'dragon', nome: 'Ginásio do Dragão', lider: 'Prefeito Drayden', boss: 612, pool: [610, 611, 621, 633, 634] },
    ],
    final: { nome: 'Castelo de N', lider: 'Reshiram', boss: 643, type: 'dragon' },
    historia: {
      prologo: `A <b>Equipe Plasma</b> prega que treinadores devem libertar seus Pokémon, mas por trás dos discursos há um plano para dominar Unova com um dragão lendário.
        A Professora Juniper pede que você enfrente os oito ginásios e descubra o que a Equipe Plasma esconde.`,
      caps: [
        ['Cilan, Chili e Cress servem batalhas junto com o almoço na Cidade de Striaton, {d:v>g1} da vila. Um membro da Equipe Plasma discursou lá ontem.', 'Os trigêmeos guardaram o panfleto da Equipe Plasma: "A verdade despertará o dragão branco."'],
        ['A Curadora Lenora cuida do museu, onde fica uma pedra clara, quase branca, muito antiga. A Equipe Plasma quer roubá-la.', 'A pedra do museu foi trocada por uma falsa. A Equipe Plasma já levou a Pedra da Verdade.'],
        ['O artista Burgh pinta no meio da colmeia. Ele viu a Equipe Plasma escondendo algo na Pinwheel Forest.', 'Burgh desenha o rosto do líder da Equipe Plasma, um jovem chamado <b>N.</b>, que fala com os Pokémon.'],
        ['Elesa ilumina a cidade dos parques de diversão. A Equipe Plasma montou um palanque na frente do ginásio dela.', 'Elesa ouviu N. dizer que vai acordar o dragão "no castelo, quando tiver o apoio do povo".'],
        ['Clay controla as minas do deserto. A Equipe Plasma anda cavando atrás de uma passagem para o castelo.', 'Clay fecha as minas, mas confirma: o castelo da Equipe Plasma fica além do Caminho dos Gigantes.'],
        ['Skyla dispara pelos céus num canhão. Do alto, ela consegue ver o castelo escondido.', 'Skyla viu a torre do castelo surgindo do chão, no extremo {w:v>g9} da região.'],
        ['Brycen, ex-ator, treina numa pista de gelo. Ele sabe atravessar a nevasca do sul.', 'Brycen abre o caminho pela nevasca: "O dragão já está despertando. Corra."'],
        ['O Prefeito Drayden e seus dragões guardam a última passagem. Prove que pode enfrentar um dragão de verdade.', 'Drayden entrega a você a escama de um dragão ancestral: "Ela vai te proteger do fogo branco."'],
      ],
      final: [`N. despertou <b>Reshiram</b> no <b>Castelo de N</b>. Entre no castelo e mostre que a amizade entre treinadores e Pokémon também é uma verdade.`,
        `Reshiram reconheceu seus ideais e se recolheu. N. libertou os próprios Pokémon e partiu, pensativo. A Equipe Plasma se desfez, e Unova está em paz.`],
    },
  },
  kalos: {
    babies: [298, 172, 173], // Azurill (Rota 3), Pichu e Cleffa
    side: { peso: { pesquisa: 1, captura: 1, bolaboa: 1 }, pessoas: {
      pesquisa: [['Assistente do Prof. Sycamore', 'estudo a Megaevolução e preciso de dados de campo']],
      pegar: [['Fotógrafa de Lumiose', 'quero uma foto de um desses ao lado de um treinador']],
      caca: [['Agente Looker', 'esse Pokémon foi visto perto de um esconderijo da Equipe Flare']] } },
    interludes: [
      { ch: 3, npc: 'dex', kind: 'dexn', n: 9, titulo: 'O álbum do Prof. Sycamore', fala: 'O Professor Sycamore estuda como os Pokémon de Kalos mudam com a Megaevolução e precisa de exemplares. Registre pelo menos 9 espécies capturadas na Pokédex antes do próximo ginásio.', obj: 'Tenha 9 espécies capturadas na Pokédex de Kalos' },
      { ch: 7, npc: 'ferreiro', kind: 'forja', n: 4, titulo: 'Aço contra o frio', fala: 'Os Pokémon das montanhas geladas trincam arma comum como vidro. Traga a sua para a minha bigorna e deixe ela pelo menos +4 antes de seguir.', obj: 'Aprimore sua arma até +4 na Ferreira' },
    ],
    // Alfas da Lua: Pokémon noturnos de verdade (pela lore e pelos jogos)
    moon: [711, 709, 715, 687, 94, 229], // Gourgeist, Trevenant, Noivern, Malamar, Gengar, Houndoom
    nome: 'Kalos', sub: 'Geração VI · beleza e Megaevolução', vila: 'Cidade de Vaniville',
    guia: { nome: 'Professor Sycamore', spr: { h: '#1f2937', b: '#f8fafc', d: '#1e3a8a' } },
    artesao: 'Artesã de Lumiose',
    zonas: [['Campos de Santalune', 'campo'], ['Costa e Bosques do Oeste', 'floresta'], ['Avenidas de Lumiose e Laverre', 'campo'], ['Montanhas Geladas do Leste', 'neve'], ['Estrada da Vitória', 'montanha']],
    pools: {
      1: [661, 659, 664, 16, 263, 13, 10, 25, 511, 513, 515, 399, 669, 280],
      2: [665, 672, 667, 674, 677, 580, 406, 415, 165, 187, 83, 84, 676, 679, 352],
      3: [688, 690, 692, 694, 557, 299, 95, 66, 701, 529, 527, 686, 551, 328, 449, 619],
      4: [707, 708, 710, 712, 459, 615, 220, 613, 714, 704, 670, 215, 124, 164],
      5: [706, 715, 533, 75, 621, 634, 247, 681, 697, 699, 693, 691, 675, 632],
    },
    water: {
      1: [129, 118, 60, 183, 283, 278], 2: [341, 72, 370, 318, 580, 222], 3: [690, 692, 688, 320, 223, 366],
      4: [87, 131, 320, 90, 594, 171], 5: [130, 131, 691, 693, 226, 369],
    },
    night: [92, 93, 708, 710, 714, 41, 355, 198], rare: [133, 703, 443, 447, 704, 123, 142, 131], migra: [661, 662, 16], lendas: [716, 718, 719, 720, 721], // Xerneas, Zygarde, Diancie, Hoopa e Volcanion (os pássaros e Mewtwo são de Kanto)
    vilao: 'Equipe Flare', grunts: [228, 229, 453, 454, 559, 560, 41, 42, 262, 510],
    gyms: [
      { type: 'bug', nome: 'Ginásio do Ateliê', lider: 'Fotógrafa Viola', boss: 666, pool: [10, 11, 12, 13, 14, 15, 664, 665, 666, 283, 284, 412, 413] },
      { type: 'rock', nome: 'Ginásio da Escalada', lider: 'Alpinista Grant', boss: 696, pool: [95, 299, 557, 558, 688, 689, 696, 698, 74, 524] },
      { type: 'fighting', nome: 'Ginásio da Torre do Domínio', lider: 'Líder Korrina', boss: 448, pool: [66, 67, 619, 620, 701, 538, 539, 56, 447, 236] },
      { type: 'grass', nome: 'Ginásio do Jardim Suspenso', lider: 'Jardineiro Ramos', boss: 673, pool: [672, 673, 187, 188, 189, 406, 315, 70, 1, 2, 43] },
      { type: 'electric', nome: 'Ginásio da Torre Prisma', lider: 'Inventor Clemont', boss: 695, pool: [694, 695, 25, 26, 81, 82, 587, 309, 310, 125] },
      { type: 'fairy', nome: 'Ginásio do Ateliê de Moda', lider: 'Estilista Valerie', boss: 700, pool: [669, 670, 671, 682, 683, 684, 685, 35, 36, 280, 281] },
      { type: 'psychic', nome: 'Ginásio do Relógio de Sol', lider: 'Vidente Olympia', boss: 678, pool: [677, 678, 686, 687, 79, 80, 96, 97, 122, 280, 281] },
      { type: 'ice', nome: 'Ginásio da Neve Eterna', lider: 'Líder Wulfric', boss: 713, pool: [712, 713, 459, 460, 613, 614, 615, 220, 221, 87, 124] },
    ],
    final: { nome: 'Laboratório da Equipe Flare', lider: 'Yveltal', boss: 717, type: 'dark' },
    historia: {
      prologo: `A <b>Equipe Flare</b> promete um mundo bonito, mas só para quem pode pagar. Por trás dos ternos vermelhos, ela procura uma arma de três mil anos escondida sob Kalos.
        O Professor Sycamore pede que você enfrente os oito ginásios: cada líder sabe um pedaço dessa história.`,
      caps: [
        ['A fotógrafa Viola registra Pokémon nos campos de Santalune, {d:v>g1} da vila. Ela viu homens de terno vermelho rondando por lá.', 'Viola mostra uma foto: agentes da Equipe Flare carregando pedras que brilham no escuro.'],
        ['Grant escala os penhascos de Cyllage. A Equipe Flare anda escavando fósseis na costa dele.', 'Grant achou anotações perdidas: a Equipe Flare procura Pedras-Chave e Megapedras.'],
        ['Korrina guarda a Torre do Domínio, onde se ensina o segredo da Megaevolução. A Equipe Flare quer roubar esse segredo.', 'Korrina descobre quem manda na Equipe Flare: um empresário famoso chamado <b>Lysandre</b>.'],
        ['O velho Ramos cuida do jardim de Coumarine. A Equipe Flare quer a energia da usina que fica perto dali.', 'Ramos conta que a Equipe Flare roubou energia da usina para religar uma "arma de três mil anos".'],
        ['Clemont, o inventor, guarda a Torre Prisma no centro de Lumiose. As luzes da cidade estão piscando sem parar.', 'Clemont rastreia a energia roubada: ela segue para a Vila de Geosenge, onde a arma está enterrada.'],
        ['Valerie, estilista e treinadora de fadas, conhece a lenda do rei que construiu a arma.', 'Valerie conta a lenda: um rei usou a arma para trazer seu Pokémon de volta à vida, acabou com uma guerra... e quase com o mundo.'],
        ['Olympia lê o futuro no relógio de sol de Anistar. Ela viu Kalos coberta de cinzas.', 'Olympia avisa: "A Equipe Flare vai acordar o Pokémon da destruição. Falta muito pouco."'],
        ['Wulfric guarda a passagem gelada de Snowbelle, a última antes da Estrada da Vitória.', 'Wulfric aponta para o horizonte: "A arma está saindo do chão em Geosenge. Vá agora."'],
      ],
      final: [`Lysandre ligou a arma ancestral e despertou <b>Yveltal</b> sob Geosenge. Desça ao <b>Laboratório da Equipe Flare</b> e impeça a destruição.`,
        `Yveltal se fechou num casulo e voltou a dormir. A arma ruiu, a Equipe Flare acabou, e Kalos tem um novo campeão.`],
    },
  },

  galar: {
    babies: [848, 172, 173, 175], // Toxel, Pichu, Cleffa e Togepi
    side: { peso: { captura: 1, alfa: 1, evento: 1 }, pessoas: {
      alfa: [['Treinador da Liga', 'os Pokémon da Área Selvagem estão gigantes e bravos']],
      evento: [['Repórter do Estádio', 'preciso de imagens no meio da confusão']],
      captura: [['Professora Sonia', 'quero estudar como esses Pokémon reagem à energia Dynamax']] } },
    interludes: [
      { ch: 3, npc: 'cura', kind: 'capball', n: 1, z: 2, titulo: 'A prova da Copa', fala: 'Os desafiantes da Copa dos Ginásios mostram que sabem lidar com os Pokémon da {Z2}. Antes do próximo estádio, capture um deles com uma Great Ball ou uma Ultra Ball.', obj: 'Capture um Pokémon na {Z2} com Great Ball ou Ultra Ball' },
      { ch: 7, npc: 'guilda', kind: 'alfa', n: 3, z: 4, titulo: 'A energia descontrolada', fala: 'A energia que vaza das minas deixou os Alfas da {Z4} enormes e agressivos, e eles estão descendo para as cidades. Derrote 3 deles lá antes de seguir.', obj: 'Derrote 3 Pokémon Alfa na {Z4} ou além' },
    ],
    // Alfas da Lua: Pokémon noturnos de verdade (pela lore e pelos jogos)
    moon: [855, 861, 828, 609, 778, 94], // Polteageist, Grimmsnarl, Thievul, Chandelure, Mimikyu, Gengar
    nome: 'Galar', sub: 'Geração VIII · estádios e Dynamax', vila: 'Cidade de Postwick',
    guia: { nome: 'Professora Magnolia', spr: { h: '#e5e7eb', b: '#7c3aed', d: '#4c1d95' } },
    artesao: 'Ferreiro de Motostoke',
    zonas: [['Campos de Postwick', 'campo'], ['Área Selvagem', 'floresta'], ['Florestas Brilhantes do Oeste', 'sombrio'], ['Litoral de Spikemuth', 'pantano'], ['Estrada Nevada de Wyndon', 'neve']],
    pools: {
      1: [819, 821, 824, 831, 827, 829, 833, 835, 163, 509, 263, 10, 659, 273, 270],
      2: [837, 850, 309, 37, 58, 674, 66, 524, 557, 527, 50, 95, 840, 843, 868],
      3: [852, 854, 856, 859, 755, 328, 449, 844, 610, 302, 303, 632, 631, 607],
      4: [872, 878, 875, 874, 876, 877, 361, 582, 613, 215, 848, 870, 871, 866],
      5: [884, 823, 861, 858, 879, 873, 849, 842, 841, 851, 839, 867, 863],
    },
    water: {
      1: [129, 833, 118, 341, 846], 2: [846, 834, 72, 120, 226, 592], 3: [847, 592, 120, 456, 223, 318],
      4: [131, 320, 87, 594, 746, 90], 5: [130, 321, 882, 883, 121, 131],
    },
    night: [854, 859, 710, 607, 163, 302, 828, 92], rare: [133, 885, 848, 874, 875, 877, 880, 610], migra: [821, 822, 163], lendas: [888, 889, 894, 895, 896, 897, 892, 893, 898], // + Urshifu, Zarude e Calyrex
    vilao: 'Macro Cosmos', grunts: [827, 828, 263, 559, 509, 599, 600, 863, 879, 589],
    gyms: [
      { type: 'grass', nome: 'Estádio de Turffield', lider: 'Fazendeiro Milo', boss: 830, pool: [829, 830, 831, 832, 270, 271, 273, 274, 406, 315, 840] },
      { type: 'water', nome: 'Estádio de Hulbury', lider: 'Modelo Nessa', boss: 834, pool: [833, 834, 846, 847, 118, 119, 341, 342, 72, 73] },
      { type: 'fire', nome: 'Estádio de Motostoke', lider: 'Veterano Kabu', boss: 851, pool: [850, 851, 37, 38, 58, 59, 554, 555, 631, 837, 838] },
      { type: 'fighting', nome: 'Estádio de Stow-on-Side', lider: 'Lutadora Bea', boss: 68, pool: [66, 67, 68, 852, 853, 870, 236, 106, 107, 538, 539, 619] },
      { type: 'fairy', nome: 'Estádio de Ballonlea', lider: 'Veterana Opal', boss: 869, pool: [868, 869, 856, 857, 858, 859, 860, 35, 36, 303, 280] },
      { type: 'rock', nome: 'Estádio de Circhester', lider: 'Líder Gordie', boss: 839, pool: [837, 838, 839, 524, 525, 526, 95, 213, 874, 688, 689] },
      { type: 'dark', nome: 'Estádio de Spikemuth', lider: 'Cantor Piers', boss: 862, pool: [263, 264, 862, 827, 828, 509, 510, 559, 560, 215, 861] },
      { type: 'dragon', nome: 'Estádio de Hammerlocke', lider: 'Líder Raihan', boss: 884, pool: [840, 841, 842, 843, 844, 610, 611, 612, 885, 886, 330] },
    ],
    final: { nome: 'Torre Rose', lider: 'Eternatus', boss: 890, type: 'poison' },
    historia: {
      prologo: `Em Galar, as batalhas de ginásio são shows de estádio lotado. Mas o presidente da <b>Macro Cosmos</b>, Rose, quer resolver a falta de energia do futuro custe o que custar, e anda mexendo com algo que dormia sob a terra.
        A Professora Magnolia pede que você vença os oito estádios da Copa e descubra o que a Macro Cosmos esconde.`,
      caps: [
        ['Milo, o fazendeiro de Turffield, abre a Copa no estádio {d:v>g1} da vila. A Macro Cosmos anda medindo a energia dos campos dele.', 'Milo conta que os Pokémon da fazenda ficaram agitados: uma luz vermelha sobe do chão à noite.'],
        ['Nessa, a modelo de Hulbury, treina Pokémon de Água no porto. Barcos da Macro Cosmos carregam cristais estranhos por lá.', 'Nessa mostra um cristal vermelho: "Eles estão juntando isso aos montes. Para quê?"'],
        ['Kabu, o veterano do fogo, guarda o estádio de Motostoke. As máquinas da Macro Cosmos esquentam a cidade inteira.', 'Kabu ouviu que o presidente Rose tem um plano chamado "Escuridão Eterna".'],
        ['Bea treina lutadores em Stow-on-Side. Gente da Macro Cosmos rachou um mural antigo da cidade.', 'Atrás do mural, Bea encontra a história de dois heróis e de um "céu negro" que quase acabou com Galar.'],
        ['A veterana Opal, das fadas, vive na floresta brilhante de Ballonlea. Ela testa quem vai sucedê-la.', 'Opal avisa: "O céu negro dos murais vai voltar. E quem o chama tem muito dinheiro."'],
        ['Gordie, das rochas, comanda o estádio gelado de Circhester. Os mineiros da Macro Cosmos cavam fundo demais por lá.', 'Gordie mostra um mapa das minas: todas as escavações levam para baixo de Hammerlocke.'],
        ['Piers, o cantor de Spikemuth, recusou o dinheiro da Macro Cosmos. Seus fãs barulhentos bloqueiam a cidade.', 'Piers deixa você passar: "Rose já abriu a porta. Corre para a Torre."'],
        ['Raihan, o rival do campeão, guarda o último estádio em Hammerlocke, em cima da usina de energia.', 'Raihan sente o chão tremer: "Isso não é Dynamax. É outra coisa acordando."'],
      ],
      final: [`Rose despertou <b>Eternatus</b> no alto da <b>Torre Rose</b>, e o céu de Galar ficou vermelho. Suba e acabe com a Escuridão Eterna.`,
        `Eternatus foi contido e dormiu de novo. A Macro Cosmos parou, o céu clareou, e Galar tem um novo campeão.`],
    },
  },

  paldea: {
    babies: [172, 174, 298, 440], // Pichu, Igglybuff, Azurill e Happiny
    side: { peso: { explorar: 2, pesquisa: 1, pegar: 1 }, pessoas: {
      explorar: [['Aluna da Academia', 'meu "tesouro" é conhecer cada canto de Paldea']],
      pesquisa: [['Professora da Academia', 'preciso de dados de campo para a aula de biologia']],
      pegar: [['Chef de Cascarrafa', 'quero ver um desses de perto, ao lado de um treinador']] } },
    interludes: [
      { ch: 3, npc: 'dex', kind: 'explore', n: 25, titulo: 'O tesouro do mapa', fala: 'Na Academia, cada aluno sai em busca do próprio tesouro. O seu pode começar pelo mapa: explore pelo menos 25% de Paldea antes do próximo ginásio.', obj: 'Explore 25% de Paldea (o mapa revela por onde você passa)' },
      { ch: 7, npc: 'cura', kind: 'capball', n: 1, z: 4, titulo: 'A prova do treinador', fala: 'Os últimos líderes querem ver se você sabe lidar com os Pokémon da {Z4}. Traga a prova: capture um deles com uma Great Ball ou uma Ultra Ball.', obj: 'Capture um Pokémon na {Z4} com Great Ball ou Ultra Ball' },
    ],
    // Alfas da Lua: Pokémon noturnos de verdade (pela lore e pelos jogos)
    moon: [972, 979, 429, 430, 94, 571], // Houndstone, Annihilape, Mismagius, Honchkrow, Gengar, Zoroark
    nome: 'Paldea', sub: 'Geração IX · aventura e a Grande Cratera', vila: 'Vila de Cabo Poco',
    guia: { nome: 'Diretor Clavell', spr: { h: '#6b7280', b: '#f1f5f9', d: '#334155' } },
    artesao: 'Artesã de Mesagoza',
    zonas: [['Campos do Sul', 'campo'], ['Planícies do Leste', 'floresta'], ['Deserto de Asado', 'deserto'], ['Picos Gelados do Norte', 'neve'], ['Grande Cratera', 'sombrio']],
    pools: {
      1: [915, 917, 919, 921, 661, 187, 194, 819, 928, 664, 427, 191, 396, 403, 280],
      2: [924, 926, 931, 932, 940, 942, 946, 948, 951, 953, 955, 957, 179, 833],
      3: [843, 449, 551, 962, 968, 969, 950, 443, 322, 324, 331, 228, 757, 206],
      4: [974, 996, 459, 215, 220, 361, 615, 712, 971, 353, 574, 585, 225],
      5: [970, 625, 966, 959, 979, 980, 981, 982, 972, 973, 936, 937, 983],
    },
    water: {
      1: [129, 194, 60, 118, 963, 183], 2: [960, 963, 72, 341, 846, 418], 3: [961, 976, 90, 226, 592, 170],
      4: [977, 964, 73, 171, 91], 5: [130, 977, 964, 976, 961],
    },
    night: [971, 353, 92, 198, 570, 999, 215, 302], rare: [133, 999, 996, 147, 443, 371, 978, 984], migra: [940, 941, 661], lendas: [1001, 1002, 1003, 1004, 1008, 1014, 1015, 1016, 1017, 1024, 1025], // + Okidogi, Munkidori, Fezandipiti, Ogerpon, Terapagos e Pecharunt
    vilao: 'Equipe Star', grunts: [944, 945, 965, 966, 434, 435, 198, 453, 551, 552],
    gyms: [
      { type: 'bug', nome: 'Ginásio da Confeitaria', lider: 'Confeiteira Katy', boss: 920, pool: [917, 918, 919, 920, 10, 11, 12, 664, 665, 412, 413] },
      { type: 'grass', nome: 'Ginásio das Esculturas', lider: 'Artista Brassius', boss: 930, pool: [928, 929, 930, 946, 947, 948, 949, 187, 188, 189, 191, 192] },
      { type: 'electric', nome: 'Ginásio da Transmissão', lider: 'Streamer Iono', boss: 939, pool: [921, 922, 923, 938, 939, 940, 941, 179, 180, 181, 403, 404] },
      { type: 'water', nome: 'Ginásio do Mercado', lider: 'Chef Kofu', boss: 976, pool: [960, 961, 963, 964, 976, 977, 118, 119, 60, 61, 194] },
      { type: 'normal', nome: 'Ginásio do Escritório', lider: 'Funcionário Larry', boss: 982, pool: [915, 916, 924, 925, 926, 931, 206, 982, 427, 428, 396, 397] },
      { type: 'ghost', nome: 'Ginásio do Palco Gelado', lider: 'Rapper Ryme', boss: 972, pool: [971, 972, 353, 354, 92, 93, 429, 200, 999] },
      { type: 'psychic', nome: 'Ginásio do Estúdio', lider: 'Maquiadora Tulip', boss: 956, pool: [955, 956, 280, 281, 282, 574, 575, 576, 203, 981, 79, 80] },
      { type: 'ice', nome: 'Ginásio da Pista de Neve', lider: 'Snowboarder Grusha', boss: 975, pool: [974, 975, 996, 997, 998, 459, 460, 361, 362, 215, 712, 713] },
    ],
    final: { nome: 'Área Zero', lider: 'Koraidon', boss: 1007, type: 'dragon' },
    historia: {
      prologo: `Em Paldea, cada aluno da Academia de Mesagoza sai pelo mundo atrás do seu "tesouro". Mas Pokémon estranhos, de outras épocas, começaram a sair da <b>Grande Cratera</b>, e a <b>Equipe Star</b> parece saber mais do que diz.
        O Diretor Clavell pede que você vença os oito ginásios e descubra o que está acontecendo na cratera.`,
      caps: [
        ['Katy faz doces e treina Pokémon Inseto em Cortondo, {d:v>g1} da vila. Membros da Equipe Star andam assustando os alunos na estrada.', 'Katy ouviu que a Equipe Star tem bases espalhadas por Paldea, e que alguns alunos largaram a escola com medo.'],
        ['Brassius, o artista de Artazon, faz esculturas de Pokémon Planta. Uma delas foi derrubada por um Pokémon que ninguém conhece.', 'Brassius desenha o Pokémon misterioso: parece um Pokémon de milhões de anos atrás.'],
        ['Iono transmite batalhas ao vivo de Levincia. Na live dela, alguém filmou luzes saindo da Grande Cratera.', 'Iono mostra o vídeo: Pokémon com formas antigas e outros com formas de robô, todos vindos da cratera.'],
        ['Kofu, o chef de Cascarrafa, compra peixe no porto. Os pescadores dizem que o rio ficou estranho.', 'Kofu descobre que a Equipe Star foi criada por alunos que se protegiam de valentões. Não são vilões: estão fugindo de algo.'],
        ['Larry, um funcionário sempre cansado, comanda o ginásio de Medali. Ele lê os relatórios da Liga sobre a cratera.', 'Larry deixa escapar: "Tem um laboratório lá embaixo. A professora que trabalhava nele nunca voltou."'],
        ['Ryme rima e batalha no frio de Montenevera. A cidade sente tremores vindos do chão.', 'Ryme rima um aviso: "Quem desce para a cratera não volta igual."'],
        ['Tulip, maquiadora e treinadora, guarda Alfornada. A Equipe Star se desfez e entregou a ela tudo o que sabia.', 'Tulip passa a última pista: a entrada da Área Zero fica bem no fundo da cratera.'],
        ['Grusha, o snowboarder, guarda o Monte Glaseado, de onde se vê a cratera inteira.', 'Grusha abre o caminho: "O Pokémon do laboratório escapou e está furioso. Vai precisar de coragem."'],
      ],
      final: [`No fundo da <b>Área Zero</b>, a máquina do tempo da professora trouxe <b>Koraidon</b> furioso do passado. Desça e devolva a calma à cratera.`,
        `A máquina do tempo foi desligada, Koraidon se acalmou, e a Equipe Star voltou para a escola. Paldea tem um novo campeão.`],
    },
  },
};
const REGION_IDS = Object.keys(REGIONS);

/* ============ Mapa variável (cada partida tem o seu) ============
 * Uma semente por personagem e por região (P.layout) escolhe a variação do mapa. 0 = mapa original.
 * No multiplayer vale a semente do anfitrião (vai junto com a região quando alguém entra na sala).
 * Etapa C: a região inteira é espelhada e/ou girada (8 versões); as barreiras de HM são recalculadas
 * pelas divisas de zona, então a progressão continua a mesma.
 */
const LAYOUT = { seed: 0, built: -1 };
// copia a geografia aplicando f a todos os pontos (coordenadas de célula)
const mapGeo = (g, f, macro) => ({
  ...g, macro, vila: f(g.vila), routes: g.routes.map(r => r.map(f)), gyms: g.gyms.map(f),
  marks: g.marks.map(([n, x, y]) => [n, ...f([x, y])]), secrets: g.secrets.map(([k, x, y]) => [k, ...f([x, y])]),
  town2: g.town2 && [...f(g.town2), g.town2[2]], vilas: g.vilas && g.vilas.map(f),
});
const flipGeo = g => { const W = g.macro[0].length; return mapGeo(g, ([x, y]) => [W - x, y], g.macro.map(r => [...r].reverse().join(''))); };
// gira 90° no sentido horário
const rotGeo = g => {
  const W = g.macro[0].length, H = g.macro.length, m = [];
  for (let c = 0; c < W; c++) { let s = ''; for (let r = H - 1; r >= 0; r--) s += g.macro[r][c]; m.push(s); }
  return mapGeo(g, ([x, y]) => [H - y, x], m);
};
// pares de ginásios que podem trocar de lugar: o validador conferiu que o ginásio de antes alcança o lugar do
// de depois com as HMs que o jogador tem naquele capítulo; ficam de fora trocas que mudariam a história
// (a batalha final, a Flannery longe do vulcão) e as que envolvem a 2ª cidade
const LAYOUT_SWAPS = { kanto: [[2, 3]], johto: [[2, 3]], hoenn: [[2, 3], [6, 7]], sinnoh: [[2, 3], [4, 5]], unova: [[2, 3]], kalos: [[2, 3]], galar: [[2, 3]], paldea: [[2, 3]] };
// troca os ginásios a e b (1-8) de lugar, levando junto a cidade de cada um (o nome segue o líder, como nas falas)
function swapGyms(g, a, b) {
  const gyms = g.gyms.map(p => [...p]), marks = g.marks.map(m => [...m]);
  const markOf = p => { let k = -1, bd = 1.0; marks.forEach((m, i) => { const d = Math.hypot(m[1] - p[0], m[2] - p[1]); if (d < bd) { bd = d; k = i; } }); return k; };
  const ma = markOf(gyms[a - 1]), mb = markOf(gyms[b - 1]);
  [gyms[a - 1], gyms[b - 1]] = [gyms[b - 1], gyms[a - 1]];
  if (ma >= 0 && mb >= 0) { const [xa, ya] = [marks[ma][1], marks[ma][2]]; marks[ma][1] = marks[mb][1]; marks[ma][2] = marks[mb][2]; marks[mb][1] = xa; marks[mb][2] = ya; }
  return { ...g, gyms, marks };
}
// Etapa A: a vila muda para outro ponto da zona 1 (os 4 quadradinhos "V" vão junto) e uma estrada curta a liga à rota
// mais próxima; o lugar antigo vira uma encruzilhada (ponto de voo)
function moveVila(g, p) {
  const macro = g.macro.map(r => r.replace(/V/g, '1').split(''));
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) macro[p[1] + dy][p[0] + dx] = 'V';
  let best = null, bd = 1e9;
  for (const r of g.routes) for (let i = 0; i < r.length - 1; i++) {
    const [ax, ay] = r[i], [bx, by] = r[i + 1], l = (bx - ax) ** 2 + (by - ay) ** 2, t = l ? clamp(((p[0] - ax) * (bx - ax) + (p[1] - ay) * (by - ay)) / l, 0, 1) : 0;
    const q = [ax + (bx - ax) * t, ay + (by - ay) * t], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < bd) { bd = d; best = q; }
  }
  return { ...g, macro: macro.map(r => r.join('')), vila: [...p], routes: [...g.routes, [[...p], best]], marks: [...g.marks, ['Encruzilhada', g.vila[0], g.vila[1] + 0.12]] };
}
// lugares aprovados para a vila (zona 1, perto de uma rota, longe de cidades e ginásios; o validador conferiu
// que o 1º ginásio continua a pé e que nenhuma zona abre antes da HM dela)
const LAYOUT_VILAS = { kanto: [[15, 5], [16, 12], [13, 6]], johto: [[11, 17]], hoenn: [[4, 9]], sinnoh: [[19, 13], [19, 21], [17, 14]], unova: [[5, 4]],
  kalos: [[6, 14]], galar: [[4, 19], [7, 19], [4, 21]], paldea: [[5, 17], [11, 17]] };
// versões aprovadas pelo validador (alcance de cada zona e ginásio com as HMs de cada capítulo); as outras ficam fora do sorteio
const LAYOUT_T = { kanto: [0, 1, 3, 5, 6, 7] };
function layoutGeo(id, seed, forceT) {
  let g = GEO[id];
  if (!seed && forceT === undefined) return g;
  const Rn = rng32(seed ^ 0x5bd1e995), okT = LAYOUT_T[id] || [0, 1, 2, 3, 4, 5, 6, 7];
  const t = forceT !== undefined ? forceT : okT[Math.floor(Rn() * okT.length)];
  // Etapa B: ginásios vizinhos trocam de lugar (cada par com 50%); a ordem da história e das HMs não muda
  const sw = forceT === undefined ? (LAYOUT_SWAPS[id] || []).filter(() => Rn() < 0.5) : [];
  // Etapa A (só sementes novas, acima de 1e9: quem ganhou mapa antes não vê a vila mudar): vila no lugar original ou num dos aprovados
  const vs = LAYOUT_VILAS[id] || [], vi = forceT === undefined && seed > 1e9 ? Math.floor(Rn() * (vs.length + 1)) : 0;
  if (vi) g = moveVila(g, vs[vi - 1]);
  for (const [a, b] of sw) g = swapGyms(g, a, b);
  if (t & 4) g = flipGeo(g);
  for (let k = 0; k < (t & 3); k++) g = rotGeo(g);
  return g;
}
// direções nas falas da história: {d:v>g1} = "a noroeste" (da vila até o 1º ginásio), {w:...} = só a palavra.
// Pontos: v = vila, g1..g8 = ginásios, g9 = final, z4 = meio da zona 4. Calculadas no mapa da partida.
const DIRW = ['leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste', 'norte', 'nordeste'];
const dirWord = (a, b) => DIRW[(Math.round(Math.atan2(b[1] - a[1], b[0] - a[0]) / (Math.PI / 4)) + 8) % 8];
function geoPoint(geo, k) {
  if (k === 'v') return geo.vila;
  if (k[0] === 'g') return geo.gyms[+k.slice(1) - 1];
  let sx = 0, sy = 0, n = 0; // z<n>: centro das células da zona
  geo.macro.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === k[1]) { sx += c + 0.5; sy += r + 0.5; n++; } });
  return n ? [sx / n, sy / n] : geo.vila;
}
const fillDirs = (s, geo) => s.replace(/\{([dw]):(\w+)>(\w+)\}/g, (m, f, a, b) => {
  const w = dirWord(geoPoint(geo, a), geoPoint(geo, b));
  return f === 'w' ? w : (w === 'norte' || w === 'sul' ? 'ao ' : 'a ') + w;
});
// semente da partida: a do personagem nessa região; quem já jogava a região antes das variações fica com o mapa original
function pickLayout(saved, rid) {
  if (saved) {
    if (saved.layout && saved.layout[rid] !== undefined) return saved.layout[rid];
    if (saved.stories && saved.stories[rid]) return 0;
  }
  return randi(1e9 + 1, 2e9); // acima de 1e9: inclui a vila em lugar sorteado
}
let REGION_ID = 'kanto', REGION = REGIONS.kanto;

// todos os Pokémon que a região usa (para pré-carregar)
// todos os bebês (fora os aquáticos): os que não combinam com a região aparecem na zona 1, raríssimos
const ALL_BABIES = [172, 173, 174, 175, 236, 238, 239, 240, 298, 360, 406, 433, 438, 439, 440, 446, 447];
const otherBabies = R => ALL_BABIES.filter(id => !(R.babies || []).includes(id));
function regionIds(R) {
  const s = new Set([...Object.values(R.pools).flat(), ...Object.values(R.water).flat(), ...R.night, ...(R.moon || []), ...R.rare, ...R.migra, ...R.lendas, ...R.grunts, ...ALL_BABIES, R.final.boss]);
  for (const g of R.gyms) { s.add(g.boss); g.pool.forEach(id => s.add(id)); }
  if (typeof FOSSILS !== 'undefined') for (const f of Object.values(FOSSILS)) if (REGIONS[f.reg] && REGIONS[f.reg].nome === R.nome) s.add(f.pid); // Pokémon dos fósseis da região
  return [...s];
}

const BASE_THEME_KEYS = Object.keys(THEMES);
const BASE_TYPE_THEME = { ...TYPE_THEME };
const BASE_DARK = [...DARK_THEMES];
const replaceArr = (a, b) => { a.length = 0; a.push(...b); };
const replaceObj = (o, b) => { for (const k of Object.keys(o)) delete o[k]; Object.assign(o, b); };

/* ---------- Chefe final variável ----------
 * Nas regiões em que o jogo tinha dois lendários principais, cada partida sorteia qual deles é o chefe final
 * (pela semente do mapa; o mapa original, semente 0, fica com o da história de sempre). O outro vira lendário solto
 * depois da história. As falas trocam o que muda (lendário, vilão, objetos e lugares).
 */
const STORY_ALT = {
  johto: { final: { nome: 'Torre do Sino', lider: 'Ho-Oh', boss: 250, type: 'fire' }, lenda: [250, 249], swap: [
    ['uma pena prateada caída', 'uma pena com as cores do arco-íris caída'], ['chamaremos Lugia e controlaremos o mar', 'chamaremos Ho-Oh e controlaremos o céu'],
    ['"Siga os redemoinhos. Lugia dorme no centro."', '"A torre antiga fica nas ilhas. Ho-Oh pousa no topo dela."'],
    ['acordou <b>Lugia</b> à força, e ele despertou furioso nas <b>Ilhas Whirl</b>', 'acordou <b>Ho-Oh</b> à força, e ele pousou furioso na <b>Torre do Sino</b>'],
    ['devolva a calma ao oceano', 'devolva a calma ao céu'], ['Lugia se acalmou e voltou a dormir no fundo do mar', 'Ho-Oh se acalmou e voou para longe, deixando um arco-íris'],
    ['Lugia', 'Ho-Oh']] },
  hoenn: { final: { nome: 'Caverna da Origem', lider: 'Groudon', boss: 383, type: 'ground' }, lenda: [383, 382], vilao: 'Equipe Magma', grunts: [261, 262, 322, 323, 41, 42, 218, 219, 109, 324], swap: [
    ['quer expandir os oceanos e afogar a terra firme', 'quer expandir os continentes e secar os mares'], ['uma pedra azul, brilhante', 'uma pedra vermelha, brilhante'],
    ['A Equipe Aqua quer esfriar o vulcão com água do mar.', 'A Equipe Magma quer aquecer o vulcão até ele acordar.'], ['O orbe precisa de uma tempestade para funcionar.', 'O orbe precisa de uma seca para funcionar.'],
    ['a tempestade artificial', 'a seca artificial'], ['vê o redemoinho se formando sobre a Seafloor Cavern', 'vê o mar secando em volta da Caverna da Origem'],
    ['na próxima maré cheia', 'no próximo sol a pino'], ['e as chuvas não param', 'e o sol não para de queimar'], ['e o sol abriu de novo sobre Hoenn', 'e a chuva voltou a cair sobre Hoenn'],
    ['a base da Equipe Aqua no mar', 'a base da Equipe Magma no vulcão'], ['Orbe Azul', 'Orbe Vermelho'], ['Seafloor Cavern', 'Caverna da Origem'], ['Equipe Aqua', 'Equipe Magma'], ['Kyogre', 'Groudon']] },
  sinnoh: { final: { nome: 'Spear Pillar', lider: 'Palkia', boss: 484, type: 'water' }, lenda: [484, 483], swap: [
    ['quer recomeçar o tempo do zero', 'quer rasgar o espaço e recomeçar o mundo do zero'], ['onde o tempo "pode ser reescrito"', 'onde o espaço "pode ser rasgado"'],
    ['parar o tempo de acabar', 'impedir o mundo de se rasgar'], ['e o próprio tempo começou a rachar', 'e o próprio espaço começou a se rasgar'],
    ['Dialga se acalmou e o tempo voltou a correr normalmente', 'Palkia se acalmou e o espaço voltou ao lugar'], ['Dialga', 'Palkia']] },
  unova: { final: { nome: 'Castelo de N', lider: 'Zekrom', boss: 644, type: 'electric' }, lenda: [644, 643], swap: [
    ['"A verdade despertará o dragão branco."', '"Os ideais despertarão o dragão negro."'], ['uma pedra clara, quase branca, muito antiga', 'uma pedra escura, quase negra, muito antiga'],
    ['a Pedra da Verdade', 'a Pedra dos Ideais'], ['"Ela vai te proteger do fogo branco."', '"Ela vai te proteger do raio negro."'],
    ['também é uma verdade', 'também é um ideal'], ['Reshiram reconheceu seus ideais', 'Zekrom reconheceu sua verdade'], ['Reshiram', 'Zekrom']] },
  kalos: { final: { nome: 'Laboratório da Equipe Flare', lider: 'Xerneas', boss: 716, type: 'fairy' }, lenda: [716, 717], swap: [
    ['acordar o Pokémon da destruição', 'acordar o Pokémon da vida e usar a força dele na arma'],
    ['ligou a arma ancestral e despertou <b>Yveltal</b> sob Geosenge', 'ligou a arma ancestral com a força de <b>Xerneas</b>, que despertou descontrolado sob Geosenge'],
    ['e impeça a destruição', 'e acalme-o antes que a arma dispare'], ['Yveltal se fechou num casulo e voltou a dormir', 'Xerneas virou uma árvore e voltou a dormir']] },
  paldea: { final: { nome: 'Área Zero', lider: 'Miraidon', boss: 1008, type: 'electric' }, lenda: [1008, 1007], swap: [
    ['parece um Pokémon de milhões de anos atrás', 'parece um Pokémon vindo do futuro'], ['trouxe <b>Koraidon</b> furioso do passado', 'trouxe <b>Miraidon</b> furioso do futuro'],
    ['Koraidon', 'Miraidon']] },
};
function regionVariant(id, seed) {
  const R = REGIONS[id], A = STORY_ALT[id];
  if (!R || !A || !seed || rng32(seed ^ 0x2545f491)() >= 0.5) return R;
  const sw = s => A.swap.reduce((t, [a, b]) => t.split(a).join(b), s), H = R.historia;
  return {
    ...R, final: A.final, vilao: A.vilao || R.vilao, grunts: A.grunts || R.grunts, lendas: R.lendas.map(x => (x === A.lenda[0] ? A.lenda[1] : x)),
    historia: { prologo: sw(H.prologo), caps: H.caps.map(c => c.map(sw)), final: H.final.map(sw) },
    interludes: (R.interludes || []).map(i => ({ ...i, fala: sw(i.fala) })),
  };
}
function setRegion(id) {
  const R = regionVariant(REGIONS[id] ? id : 'kanto', LAYOUT.seed) || REGIONS.kanto;
  REGION_ID = REGIONS[id] ? id : 'kanto'; REGION = R;
  // zonas e Pokémon
  replaceArr(ZONES, [{ nome: R.vila, bio: 'vila', ...BIOMES.vila, lvl: 1 }, ...R.zonas.map(([nome, bio], i) => ({ nome, bio, ...BIOMES[bio], lvl: ZONE_LVL[i + 1], lvlMax: ZONE_LVL_MAX[i + 1] })),
    { nome: 'Arena PvP', bio: 'campo', ...BIOMES.campo, lvl: 1 }]);
  replaceObj(ZONE_POOLS, R.pools); replaceObj(WATER_POOLS, R.water);
  replaceArr(BOSSES, R.lendas); replaceArr(RARE_POOL, R.rare); replaceArr(NIGHT_POOL, R.night); replaceArr(MIGRATION_POOL, R.migra);
  replaceObj(HM_GYM, R.hmGym || HM_GYM_BASE);
  const geo = layoutGeo(REGION_ID, LAYOUT.seed);
  LAYOUT.built = LAYOUT.seed;
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
  THEMES.torre = { nome: 'Torre Infinita', floor: ['#26252e', '#2c2b36'], wall: '#0b0a10', top: '#3b3950', accent: '#a78bfa', pool: [...new Set([...R.pools[4], ...R.pools[5]])], boss: R.pools[5][0], zmin: 5 };
  replaceArr(THEME_IDS, [...new Set(Object.values(THEMES).flatMap(t => [...t.pool, t.boss]))]);
  // história
  const H = R.historia;
  replaceArr(STORY, [{ titulo: 'Prólogo', intro: H.prologo }, ...R.gyms.map((g, i) => ({
    titulo: `${g.nome}`, obj: `Vença ${g.lider} no ${g.nome} (insígnia ${i + 1}/8)`, at: geo.gyms[i], zone: GYM_ZONE[i], lvl: GYM_LVL[i],
    kind: 'dungeon', theme: 'gym' + (i + 1), nome: g.lider, intro: fillDirs(H.caps[i][0], geo), fim: fillDirs(H.caps[i][1], geo),
  })), {
    titulo: R.final.nome, obj: `Entre em ${R.final.nome} e enfrente ${R.final.lider}`, at: geo.gyms[8], zone: GYM_ZONE[8], lvl: GYM_LVL[8],
    kind: 'dungeon', theme: 'final', nome: R.final.lider, intro: fillDirs(H.final[0], geo), fim: fillDirs(H.final[1], geo),
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
