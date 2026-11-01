# Poké Realm — plano: comandos simples, interfaces descomplicadas e versão mobile

Decisões já tomadas: só paisagem no celular · mesma dificuldade para todos (dá para jogar junto) ·
tiro sempre ligado no celular, com mira e captura mais fáceis que no controle · sem PWA ·
poção e fuga automáticas só no celular (ligadas por padrão; podem ser desligadas no painel, em Opções; no PC e no controle não existem).

---

## Fase 1 — Automáticos (só no celular, desde v218)

| Situação | O que acontece |
|---|---|
| Vida entre 35% e 15% | Poção automática (recarga de 5 s entre poções automáticas) |
| Vida abaixo de 15% e Talismã de Abra pronto | Talismã primeiro: foge para a cidade, intocável |
| Vida abaixo de 15% sem Talismã | Poção automática, se houver |

- Nada disso na arena PvP. Limites (35% / 15%) ajustáveis nas opções.
- Opções no painel (PC, controle e celular): poção automática e fuga automática (FEITO, v216); mira automática entra na fase 4.
- Pronto antes: botão "Equipar o melhor" (aparece só quando há item melhor; [B]; aviso ao pegar item melhor).

## Fase 2 — Descomplicar telas e menus (todas as plataformas)

### HUD mínimo
- Fica: vida (com escudo e status colados), XP fino com nível, especial com contorno de recarga,
  uma linha de objetivo (a missão escolhida) com seta, minimapa.
- Sai da tela: CA, Acerto, Insígnias, Lendários (vão para o painel). Ouro aparece só ao mudar e nas lojas.
- Avisos: só os importantes viram caixa; o resto vai para o histórico do chat.

### Painel do herói em 4 abas
- **Herói**: nível, vida, atributos ("Distribuir pontos" pela classe), talentos e subclasse.
- **Mochila**: "Equipar o melhor", organizar, toque longo = detalhes + comparação.
- **Companheiros**: cartões grandes, líder com um toque, HMs ensinadas automaticamente, evoluir.
- **Missões**: diário único (história + contrato individual + contrato de grupo), escolhe qual aparece no HUD.

### Escolhas em uma tela só
- Talento, subclasse e pontos de atributo: aviso pequeno ao subir de nível → janela com cartões grandes.

### NPCs — interações simplificadas
Princípio: **cada NPC abre direto no que você mais faz com ele**, com no máximo 3 abas e uma ação principal em destaque.

| NPC | Abre em | Ação principal | Outras abas |
|---|---|---|---|
| Mercador | Comprar | "Encher poções" (até 5) | Vender (com "Vender lixo"), Contratos |
| Vendedora de Poké Balls | Comprar bolas | "Comprar a bola recomendada" | Cinto (vagas), Contratos |
| Ferreira | Aprimorar | "Aprimorar ao máximo que o ouro dá" | — |
| Guilda | Contratos | contrato recomendado em destaque | — |
| Pesquisadora | Contratos | recompensa disponível em destaque | Pokédex |
| Banco Pokémon | Equipe/PC | trocar com um toque | — |
| Templo | Bênçãos/maldições | a escolha atual em destaque | — |
| Mural de Grupo | Contratos de grupo | aceitar para todos | — |

- Fala do NPC em uma linha no topo (o resto da conversa em "Conversar").
- Cabeçalho fixo: nome, ouro, fechar. Rolagem nunca necessária em telas comuns (2 colunas no PC).
- Item recomendado para o seu nível marcado ("▲ melhor que o seu").
- Etapa da história sempre no topo de quem a dá.
- Fechar: Esc / B / toque fora / botão grande.

## Fase 3 — Base responsiva (celular e telas pequenas) — FEITO (v217, js/touch.js)
- Detectar toque e tamanho de tela; classe `mobile` no body.
- Paisagem obrigatória (tela "gire o aparelho" em retrato).
- Painel vira gaveta (botão ☰), com as 4 abas.
- Janelas (NPC, Pokédex, Banco, ajuda) em tela cheia, botões ≥ 44 px.
- HUD do canvas em escala (textos legíveis), sem gestos do navegador (zoom, puxar para atualizar).

## Fase 4 — Toque — FEITO (v217; ?mobile=1 força no PC, ?mobile=0 desliga)
- **Analógico esquerdo** (aparece onde o polegar encosta): andar.
- **Tiro sempre ligado** com mira automática (prioridade: quem está mais perto, com Alfas/chefes
  preferidos quando estão a distância parecida).
- **Analógico direito** (área livre do lado direito): escolher direção/alvo; a mira gruda no Pokémon
  naquela direção (cone ~25°) e fica travada até ele cair. Tocar num Pokémon também trava.
- **Botões** (arrastar para mirar): ⭐ Especial (toque = automático; arrastar = mostra onde cai; voltar ao
  centro cancela) · 💨 Rolamento (toque = direção do movimento; arrastar = escolhe) · ⚪ Capturar
  (toque = Pokémon mais capturável com a bola certa, anel mostra alvo e chance; arrastar = escolhe) ·
  💬 Interagir (só aparece quando há algo perto).
- **Menu "…"**: Fly, voltar à cidade, montar, cristal, trocar Pokémon, mapa, Pokédex, chat, opções.
- O toque reaproveita a lógica do controle (o que o controle já faz com analógicos e mira assistida).
- Jogar junto: o toque só gera as mesmas ações do teclado/controle; a rede não muda, então PC + celular + controle jogam na mesma sala.
- Segurando ⚪ o tiro automático pausa (para não derrubar o Pokémon que se quer capturar). Botão 🧪 de poção manual além da automática.

## Fase 5 — Ajuste e testes
- Resolução adaptativa (desenhar menor em telas muito densas; menos partículas se cair FPS).
- Testar Android (Chrome) e iPhone (Safari), celular e tablet; ajustar cone da mira, tamanho dos botões.

## Ordem
1 → 2 (melhoram o jogo para todos já no PC) → 3 + 4 (versão jogável no celular) → 5.
