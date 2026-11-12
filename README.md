# Poké Realm

Jogo de tiro frenético no estilo Realm of the Mad God, com regras inspiradas em D&D (simplificado) e Pokémon como inimigos e companheiros (dados e sprites da PokeAPI). Roda no navegador, no PC, no celular (paisagem) e no controle, sozinho ou em grupo.

**Jogar:** abra a página publicada no GitHub Pages (https://joaolfig.github.io/poke-realm/), ou rode `node server.js` (ou `jogar.bat`) e acesse http://localhost:8080.

## O que tem no jogo

- **8 regiões**: Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Galar e Paldea. Cada uma tem os Pokémon de lá, 8 ginásios, uma história própria, cidade inicial com a cara da região e música.
- **Mapas variáveis**: cada personagem ganha uma semente por região, que espelha ou gira o mapa, troca ginásios de lugar e muda a vila inicial, sem quebrar a ordem das HMs. No multiplayer vale o mapa do host.
- **Chefe final variável** nas regiões com dois lendários principais. O outro lendário vira um lendário solto depois da história.
- **Classes**: Guerreiro, Mago, Ladino, Clérigo, Patrulheiro e Druida. Cada uma tem duas subclasses no nível 16 (que trocam o especial do [Espaço]) e talentos a cada 4 níveis. Nível máximo: 30.
- **Companheiros**: capture com a Poké Ball. Eles lutam ao seu lado, sobem de nível com 80% do seu XP, evoluem, servem de montaria e usam HMs (Cut, Rock Smash, Surf, Flash, Fly).
- **Chefes com golpes de assinatura**: líderes de ginásio, chefes de masmorra e lendários usam golpes do próprio repertório, sempre avisados no chão. O Druida transformado também usa os golpes do Pokémon em que virou.
- **Pós-história**: Megaevolução (Kanto, Hoenn e Kalos), Dynamax (Galar), fósseis (cientista na 2ª cidade), lendários e míticos soltos, masmorras com andares.
- **Sprites animados (opção)**: no menu, quem joga sozinho ou cria a sala pode ligar os sprites do PMDCollab. Os Pokémon andam, atiram e levam dano animados em 8 direções; os que não têm sprite lá (51 de 1025) saem dos sorteios. Os convidados seguem a escolha do anfitrião.
- **Multiplayer**: um jogador escolhe o mapa e "Criar sala" e passa o código de 5 letras; os amigos escolhem "Entrar". XP dividido (70% igual, 30% pelo dano), efeitos de grupo e PvP opcional.

## Controles (PC)

| Tecla | Ação | Tecla | Ação |
|---|---|---|---|
| WASD | mover | Mouse | mirar / atirar |
| Espaço | especial | Shift | rolamento (talento) |
| E | falar / portal / HM | F / G | Poké Ball / trocar bola |
| C | trocar Pokémon | U | Mega / Dynamax |
| Q | poção | Z | Talismã de Abra (fuga) |
| B | equipar o melhor | K | vender tudo (na loja) |
| X | montar | V | voar (Fly) |
| R | voltar à última cidade | T | tiro automático |
| M | mapa | P | Pokédex |
| H | ajuda | Enter | chat |
| Ctrl+S | salvar em arquivo | N | música / som |

No controle: LB troca o Pokémon (segurar: Mega / Dynamax) e R3 liga o tiro automático. No celular há botões na tela e ajudas automáticas (poção, fuga e mira), que só existem lá.

## Estrutura do código

Sem build e sem dependências: `index.html` carrega os scripts de `js/` em ordem (são globais). Para publicar uma versão, aumente o `?v=` de todos os scripts no `index.html`.

| Arquivo | Conteúdo |
|---|---|
| `pokedex.js` | carrega dados e sprites da PokeAPI (ícones da Geração VIII e IX em `img/icones-g8-g9.png`) |
| `data.js`, `rules.js`, `items.js` | classes, subclasses, talentos, dados de D&D e itens |
| `regions.js`, `geo.js` | as 8 regiões (Pokémon, ginásios, história) e o relevo de cada uma; variações de mapa |
| `map.js`, `world.js`, `town.js` | geração do mundo, névoa do mapa, cidades, NPCs, lojas e missões |
| `story.js`, `hm.js` | capítulos da história, HMs e guia de caminhos |
| `dungeon.js` | masmorras e ginásios por salas |
| `allies.js` | companheiros, montarias e a Forma Selvagem do Druida |
| `sigs.js` | golpes de assinatura dos chefes (por espécie e por tipo) |
| `pmd.js` | opção de sprites animados do PMDCollab (lista de quem tem sprite, animação e direção) |
| `extras.js` | fósseis, Megaevolução e Dynamax |
| `net.js`, `pvp.js` | multiplayer (PeerJS/WebRTC; o host repassa os eventos) e PvP |
| `game.js` | laço principal, combate, desenho e interface |
| `audio.js`, `pad.js`, `touch.js` | música, controle e celular |

Saves ficam no `localStorage` (`pkr_save_v2`) e podem ser exportados com Ctrl+S.

Projeto de fã, sem fins comerciais. Pokémon © Nintendo/Game Freak. Dados e sprites: [PokeAPI](https://pokeapi.co), ícones do [Pokémon Showdown](https://play.pokemonshowdown.com) e sprites animados do [PMDCollab](https://github.com/PMDCollab/SpriteCollab).
