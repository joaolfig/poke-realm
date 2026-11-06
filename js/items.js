'use strict';
/* ============ Itens: afixos mágicos, amuletos, relíquias e consumíveis ============
 * Todo equipamento pode ter `mods` (modificadores somados por M()).
 *   dmg hit crit ac cap pierce -> inteiros | rate speed hp regen cd range steal gold xp pet loot dodge -> frações
 *   etype resist -> listas de tipos
 */
const EQ_SLOTS = ['arma', 'armadura', 'anel', 'amuleto'];
const INT_MODS = new Set(['dmg', 'hit', 'crit', 'ac', 'cap', 'pierce']);
function M(P, k) {
  let s = 0;
  for (const sl of EQ_SLOTS) { const it = P.equip[sl]; if (it && it.mods && it.mods[k]) s += it.mods[k]; }
  const lm = P === (G && G.P) && typeof leaderMods === 'function' && leaderMods(P); // traço do companheiro líder
  if (lm && lm[k]) s += lm[k];
  return s;
}
function MA(P, k) {
  const a = [];
  for (const sl of EQ_SLOTS) { const it = P.equip[sl]; if (it && it.mods && it.mods[k]) a.push(...it.mods[k]); }
  return a;
}

const AFFIX = {
  arma: [
    { nome: 'do Gume', mod: { crit: 1 } },
    { nome: 'da Pressa', mod: { rate: 0.15 } },
    { nome: 'do Vampiro', mod: { steal: 0.06 } },
    { nome: 'do Alcance', mod: { range: 0.2 } },
    { nome: 'da Brutalidade', mod: { dmg: 2 } },
    { nome: 'Perfurante', mod: { pierce: 1 } },
    { nome: 'da Precisão', mod: { hit: 2 } },
    { nome: 'elem', mod: {} },
  ],
  armadura: [
    { nome: 'do Vigor', mod: { hp: 0.12 } },
    { nome: 'do Vento', mod: { speed: 0.1 } },
    { nome: 'da Regeneração', mod: { regen: 0.6 } },
    { nome: 'resist', mod: {} },
    { nome: 'da Esquiva', mod: { dodge: 0.07 } },
    { nome: 'do Baluarte', mod: { ac: 1 } },
  ],
  anel: [
    { nome: 'da Fortuna', mod: { gold: 0.3 } },
    { nome: 'do Treinador', mod: { cap: 2, pet: 0.15 } },
    { nome: 'do Foco', mod: { cd: 0.1 } },
    { nome: 'do Sábio', mod: { xp: 0.1 } },
    { nome: 'da Sorte', mod: { crit: 1 } },
  ],
};
const AMULETS = [
  { nome: 'Amuleto Vital', mod: { hp: 0.15 } },
  { nome: 'Amuleto do Foco', mod: { cd: 0.15 } },
  { nome: 'Amuleto do Treinador', mod: { cap: 3, pet: 0.3 } },
  { nome: 'Amuleto da Fortuna', mod: { gold: 0.4, loot: 0.1 } },
  { nome: 'Amuleto do Sábio', mod: { xp: 0.15 } },
  { nome: 'Amuleto do Caçador', mod: { dmg: 1, range: 0.1 } },
  { nome: 'elem', mod: {} },
];
// relíquias únicas dos lendários
const RELICS = {
  150: { nome: 'Gema Psíquica de Mewtwo', mods: { cd: 0.3, dmg: 2, etype: ['psychic'] } },
  384: { nome: 'Escama Celeste de Rayquaza', mods: { speed: 0.2, rate: 0.15, etype: ['dragon'] } },
  383: { nome: 'Orbe Vermelho de Groudon', mods: { ac: 3, hp: 0.1, resist: ['fire', 'ground'] } },
  382: { nome: 'Orbe Azul de Kyogre', mods: { regen: 1.5, hp: 0.1, resist: ['water', 'ice'] } },
  145: { nome: 'Pena do Trovão de Zapdos', mods: { rate: 0.25, etype: ['electric'] } },
  146: { nome: 'Pena da Chama de Moltres', mods: { dmg: 3, etype: ['fire'] } },
  144: { nome: 'Pena Gélida de Articuno', mods: { ac: 2, resist: ['ice', 'water'], etype: ['ice'] } },
  487: { nome: 'Orbe Grísea de Giratina', mods: { steal: 0.08, resist: ['ghost'], etype: ['ghost'] } },
  249: { nome: 'Pena Prateada de Lugia', mods: { hp: 0.2, regen: 1 } },
  250: { nome: 'Pena Arco-Íris de Ho-Oh', mods: { xp: 0.25, gold: 0.5, regen: 0.5 } },
  483: { nome: 'Diamante de Dialga', mods: { cd: 0.25, ac: 2 } },
  484: { nome: 'Pérola de Palkia', mods: { range: 0.3, pierce: 1 } },
  // Kanto a Sinnoh (os que faltavam)
  151: { nome: 'Pelo Rosa de Mew', mods: { xp: 0.15, cd: 0.15, crit: 1 } },
  243: { nome: 'Presa Trovejante de Raikou', mods: { rate: 0.15, speed: 0.1, etype: ['electric'] } },
  244: { nome: 'Cinza Vulcânica de Entei', mods: { dmg: 2, hp: 0.1, etype: ['fire'] } },
  245: { nome: 'Cristal Aurora de Suicune', mods: { regen: 1, stcut: 0.4, etype: ['water'] } },
  251: { nome: 'Folha do Tempo de Celebi', mods: { cd: 0.2, regen: 0.8, etype: ['grass'] } },
  377: { nome: 'Núcleo de Regirock', mods: { ac: 3, resist: ['rock', 'normal'] } },
  378: { nome: 'Núcleo de Regice', mods: { ac: 2, resist: ['ice', 'water'], etype: ['ice'] } },
  379: { nome: 'Núcleo de Registeel', mods: { ac: 3, resist: ['steel', 'poison'] } },
  380: { nome: 'Plumagem de Latias', mods: { regen: 1, dodge: 0.04, etype: ['dragon'] } },
  381: { nome: 'Plumagem de Latios', mods: { rate: 0.15, range: 0.15, etype: ['dragon'] } },
  385: { nome: 'Estrela dos Desejos de Jirachi', mods: { loot: 0.03, gold: 0.3, xp: 0.15 } },
  386: { nome: 'Cristal de DNA de Deoxys', mods: { dmg: 2, rate: 0.1, speed: 0.1 } },
  480: { nome: 'Gema do Saber de Uxie', mods: { xp: 0.2, cd: 0.1 } },
  481: { nome: 'Gema da Emoção de Mesprit', mods: { regen: 1, pet: 0.15 } },
  482: { nome: 'Gema da Vontade de Azelf', mods: { dmg: 2, crit: 1 } },
  485: { nome: 'Magma de Heatran', mods: { dmg: 2, resist: ['fire', 'steel'], etype: ['fire'] } },
  486: { nome: 'Gelo Antigo de Regigigas', mods: { hp: 0.2, ac: 2 } },
  488: { nome: 'Pena Lunar de Cresselia', mods: { regen: 1.2, stimm: ['6'] } },
  490: { nome: 'Gota do Mar de Manaphy', mods: { regen: 1, pet: 0.15, resist: ['water'] } },
  491: { nome: 'Pesadelo de Darkrai', mods: { steal: 0.06, etype: ['dark'], resist: ['dark'] } },
  492: { nome: 'Flor Gracídea de Shaymin', mods: { regen: 1.2, stcut: 0.4, etype: ['grass'] } },
  493: { nome: 'Placa Original de Arceus', mods: { dmg: 3, hp: 0.15, ac: 2 } },
  // Unova
  494: { nome: 'Chama da Vitória de Victini', mods: { crit: 2, xp: 0.1, etype: ['fire'] } },
  638: { nome: 'Chifre de Aço de Cobalion', mods: { ac: 2, resist: ['steel'], etype: ['steel'] } },
  639: { nome: 'Chifre de Pedra de Terrakion', mods: { dmg: 2, resist: ['rock'], etype: ['rock'] } },
  640: { nome: 'Chifre de Folha de Virizion', mods: { speed: 0.15, dodge: 0.03, etype: ['grass'] } },
  641: { nome: 'Nuvem de Tornadus', mods: { speed: 0.2, rate: 0.1, etype: ['flying'] } },
  642: { nome: 'Nuvem de Thundurus', mods: { rate: 0.2, etype: ['electric'] } },
  643: { nome: 'Pedra da Verdade de Reshiram', mods: { dmg: 3, etype: ['fire', 'dragon'] } },
  644: { nome: 'Pedra dos Ideais de Zekrom', mods: { rate: 0.2, etype: ['electric', 'dragon'] } },
  645: { nome: 'Nuvem de Landorus', mods: { hp: 0.1, gold: 0.25, etype: ['ground'] } },
  646: { nome: 'DNA Gélido de Kyurem', mods: { ac: 2, resist: ['ice', 'dragon'], etype: ['ice'] } },
  647: { nome: 'Espada de Keldeo', mods: { crit: 1, speed: 0.1, etype: ['water'] } },
  648: { nome: 'Partitura de Meloetta', mods: { cd: 0.15, pet: 0.15, stimm: ['6'] } },
  649: { nome: 'Canhão de Genesect', mods: { range: 0.25, pierce: 1, etype: ['bug'] } },
  // Kalos
  716: { nome: 'Galho da Vida de Xerneas', mods: { regen: 1.5, hp: 0.1, etype: ['fairy'] } },
  717: { nome: 'Asa Sombria de Yveltal', mods: { steal: 0.08, etype: ['dark'] } },
  718: { nome: 'Núcleo de Zygarde', mods: { hp: 0.15, ac: 2, etype: ['dragon'] } },
  719: { nome: 'Diamante Rosa de Diancie', mods: { ac: 2, gold: 0.3, etype: ['rock'] } },
  720: { nome: 'Anel Prisão de Hoopa', mods: { range: 0.2, cd: 0.15, loot: 0.02 } },
  721: { nome: 'Válvula de Vapor de Volcanion', mods: { dmg: 2, resist: ['fire', 'water'], etype: ['water'] } },
  // Galar
  888: { nome: 'Espada Enferrujada de Zacian', mods: { dmg: 3, crit: 1, etype: ['fairy'] } },
  889: { nome: 'Escudo Enferrujado de Zamazenta', mods: { ac: 3, hp: 0.15, resist: ['fighting'] } },
  890: { nome: 'Estrela Eterna de Eternatus', mods: { hp: 0.2, dmg: 2, etype: ['dragon', 'poison'] } },
  892: { nome: 'Pergaminho de Urshifu', mods: { crit: 2, etype: ['fighting'] } },
  893: { nome: 'Cipó de Zarude', mods: { steal: 0.05, regen: 0.8, etype: ['grass'] } },
  894: { nome: 'Núcleo de Regieleki', mods: { rate: 0.25, speed: 0.1 } },
  895: { nome: 'Núcleo de Regidrago', mods: { dmg: 3, etype: ['dragon'] } },
  896: { nome: 'Crina de Gelo de Glastrier', mods: { ac: 3, resist: ['ice'], etype: ['ice'] } },
  897: { nome: 'Crina Sombria de Spectrier', mods: { speed: 0.2, etype: ['ghost'] } },
  898: { nome: 'Coroa de Calyrex', mods: { cd: 0.2, xp: 0.15, etype: ['psychic'] } },
  // Paldea
  1001: { nome: 'Tábua Ruinosa de Wo-Chien', mods: { regen: 1, resist: ['grass', 'dark'] } },
  1002: { nome: 'Espada Ruinosa de Chien-Pao', mods: { crit: 1, rate: 0.1, etype: ['ice'] } },
  1003: { nome: 'Vaso Ruinoso de Ting-Lu', mods: { hp: 0.15, ac: 2, resist: ['ground'] } },
  1004: { nome: 'Contas Ruinosas de Chi-Yu', mods: { dmg: 2, etype: ['fire', 'dark'] } },
  1007: { nome: 'Escama Antiga de Koraidon', mods: { dmg: 2, speed: 0.15, etype: ['fighting', 'dragon'] } },
  1008: { nome: 'Núcleo Futurista de Miraidon', mods: { rate: 0.15, speed: 0.15, etype: ['electric', 'dragon'] } },
  1014: { nome: 'Corrente de Okidogi', mods: { hp: 0.15, stimm: ['4'], etype: ['fighting'] } },
  1015: { nome: 'Corrente de Munkidori', mods: { cd: 0.15, stimm: ['4'], etype: ['psychic'] } },
  1016: { nome: 'Corrente de Fezandipiti', mods: { dodge: 0.04, stimm: ['4'], etype: ['fairy'] } },
  1017: { nome: 'Máscara Turquesa de Ogerpon', mods: { dmg: 2, crit: 1, etype: ['grass'] } },
  1024: { nome: 'Cristal Tera de Terapagos', mods: { ac: 2, hp: 0.1, resist: ['normal', 'fighting'] } },
  1025: { nome: 'Corrente Tóxica de Pecharunt', mods: { steal: 0.05, etype: ['poison'], stimm: ['4'] } },
};
const relic = pid => { const r = RELICS[pid]; return r ? { slot: 'amuleto', tier: 6, name: r.nome, mods: JSON.parse(JSON.stringify(r.mods)), relic: 1 } : genItem(6, 'amuleto'); };

// consumíveis de bolso (não ocupam a mochila)
const CONS = {
  grande: { nome: 'Great Ball', icon: '🔵', bonus: 3 },
  ultra: { nome: 'Ultra Ball', icon: '🟡', bonus: 6 },
  doce: { nome: 'Doce Raro', icon: '🍬' },
  abra: { nome: 'Talismã de Abra', icon: '🌀' }, // fuga de emergência ([Z])
  elixir: { nome: 'Elixir de Poder', icon: '🧪' },
  pPOD: { nome: 'Poção de Poder', icon: '🟥', stat: 'POD' },
  pAGI: { nome: 'Poção de Agilidade', icon: '🟩', stat: 'AGI' },
  pVIG: { nome: 'Poção de Vigor', icon: '🟦', stat: 'VIG' },
};
// Poções de atributo (como no Realm of the Mad God): +1 permanente, até o máximo
const statPot = () => consItem('p' + pick(ATTRS));
function drinkStat(P, a) {
  const old = maxHP(P);
  if (P.attrs[a] >= ATTR_MAX) {
    P.gold += 80;
    G.toasts.push({ text: `${ATTR_NAMES[a]} já está no máximo: a poção virou +80 🪙`, color: '#fde68a', t: 3 });
  } else {
    P.attrs[a] = Math.min(ATTR_MAX, P.attrs[a] + 2);
    P.hp += Math.max(0, maxHP(P) - old);
    G.toasts.push({ text: `⬆ ${ATTR_NAMES[a]} +2 permanente! (${P.attrs[a]}/${ATTR_MAX})`, color: '#fde047', t: 3.5, big: 1 });
    sfx('lvl');
  }
  G.dirty = true;
  saveGame();
}
const consItem = k => ({ slot: 'cons', k, tier: CONS[k].stat ? 5 : k === 'ultra' || k === 'doce' ? 3 : 1, name: CONS[k].nome });
const potion = () => ({ slot: 'pot', tier: 0, name: 'Poção de Cura' });
const ballItem = () => ({ slot: 'ball', tier: 0, name: 'Poké Ball' });
const stone = type => ({ slot: 'pedra', tier: 3, type: TYPE_PT[type] ? type : 'normal', name: `Cristal de ${TYPE_PT[type] || 'Normal'}` });
// cristal que um Pokémon derrubou: de um dos tipos dele (sorteado quando tem dois)
const monStone = m => { const ts = ((POKE[m.pid] || {}).types || []).filter(t => TYPE_PT[t]); return stone(ts.length ? pick(ts) : m.type); };

function scaleMods(mod, k) {
  const o = {};
  for (const key in mod) {
    const v = mod[key];
    if (Array.isArray(v)) o[key] = v.slice();
    else if (key === 'pierce') o[key] = 1;
    else o[key] = INT_MODS.has(key) ? Math.max(1, Math.round(v * k)) : +(v * k).toFixed(2);
  }
  return o;
}
function mergeMods(dst, src) {
  for (const k in src) {
    if (Array.isArray(src[k])) dst[k] = [...new Set([...(dst[k] || []), ...src[k]])];
    else if (k === 'pierce') dst[k] = 1;
    else dst[k] = +((dst[k] || 0) + src[k]).toFixed(2);
  }
}
// sorteia os afixos de um item conforme a raridade
function rollAffixes(it) {
  const t = it.tier, pool = AFFIX[it.slot];
  it.mods = {}; it.sfx = '';
  if (!pool) return it;
  let n = t <= 0 ? 0 : t === 1 ? (Math.random() < 0.35 ? 1 : 0) : t <= 3 ? 1 : t <= 5 ? (Math.random() < 0.5 ? 2 : 1) : 2;
  if (it.slot === 'anel') n = t >= 2 ? 1 : 0;
  const names = [];
  for (const a of [...pool].sort(() => Math.random() - 0.5).slice(0, n)) {
    let mod = a.mod, nome = a.nome;
    if (nome === 'elem') { const ty = pick(TYPES); mod = { etype: [ty] }; nome = `de ${TYPE_PT[ty]}`; }
    if (nome === 'resist') { const ty = pick(TYPES); mod = { resist: [ty] }; nome = `contra ${TYPE_PT[ty]}`; }
    mergeMods(it.mods, scaleMods(mod, 1 + t * 0.15));
    names.push(nome);
  }
  it.sfx = names.join(' e ');
  return it;
}
const fullName = (base, it) => (it.sfx ? `${base} ${it.sfx}` : base);
// Encantamentos de clima e de status: podem vir em anéis e amuletos (30% de chance), somados aos afixos normais
const ENCHANTS = [
  { nome: '✧ da Tempestade', mod: { wxchuva: 0.2 } }, { nome: '✧ Solar', mod: { wxsol: 0.2 } },
  { nome: '✧ das Areias', mod: { wxareia: 0.2 } }, { nome: '✧ Glacial', mod: { wxneve: 0.2 } },
  { nome: '✧ do Viajante', mod: { wxcapa: 0.5 } },
  { nome: '✧ Isolante', mod: { stimm: ['2'] } }, { nome: '✧ Refratário', mod: { stimm: ['3'] } },
  { nome: '✧ Antídoto', mod: { stimm: ['4'] } }, { nome: '✧ da Mente Clara', mod: { stimm: ['6'] } },
  { nome: '✧ da Recuperação', mod: { stcut: 0.5 } },
];
function enchant(it, en = pick(ENCHANTS)) {
  it.mods = it.mods || {};
  mergeMods(it.mods, scaleMods(en.mod, 1 + Math.max(0, it.tier - 2) * 0.1));
  it.name = `${it.name} ${en.nome}`;
  return it;
}

// raridade dos prêmios compatível com a zona e com o nível do herói (inimigos comuns):
// zona 1 ≈ Comum/Incomum, 2 ≈ Incomum/Raro, 3 ≈ Raro/Muito Raro, 4 ≈ Muito Raro/Épico, 5 ≈ Épico/Lendário.
// Alfas, baús e chefes (bonus) ficam um degrau acima; Artefato só deles na zona 5 (e dos lendários).
// Limitada pelo nível: quem corre cedo para uma zona alta não pega item de fim de jogo.
function zoneTier(z, bonus = 0) {
  const P = G && G.P, byZone = (clamp(z || 1, 1, 5) - 1) * 1.25, byLvl = P ? (P.lvl - 1) / 29 * 5 + 1 : 5;
  return clamp(Math.round(Math.min(byZone, byLvl) + bonus - 0.45 + rand(-0.6, 0.6)), 0, 6); // -0,45: prêmios um pouco mais modestos
}
function genItem(tier, slot) {
  const P = G.P;
  tier = clamp(tier, 0, 6);
  if (!slot) { const r = Math.random(); slot = r < 0.36 ? 'arma' : r < 0.66 ? 'armadura' : r < 0.84 ? 'anel' : 'amuleto'; }
  let it;
  if (slot === 'arma') {
    const c = CLASSES[P.cls];
    it = rollAffixes({ slot, tier, cls: P.cls, dice: [WDICE[tier][0], WDICE[tier][1] + c.dieAdj], bonus: WBONUS[tier] });
    it.name = fullName(c.weapons[tier], it);
  } else if (slot === 'armadura') {
    it = rollAffixes({ slot, tier, ac: tier + 1 });
    it.name = fullName(ARMORS[tier], it);
  } else if (slot === 'anel') {
    const a = pick(ATTRS), b = tier < 2 ? 1 : tier < 5 ? 2 : 3;
    it = rollAffixes({ slot, tier, attr: a, bonus: b });
    it.name = fullName(`Anel de ${ATTR_NAMES[a]} +${b}`, it);
  } else {
    const am = pick(AMULETS);
    let mod = am.mod, nome = am.nome;
    if (nome === 'elem') { const ty = pick(TYPES); mod = { etype: [ty], resist: [ty] }; nome = `Amuleto de ${TYPE_PT[ty]}`; }
    it = { slot: 'amuleto', tier, name: nome, mods: scaleMods(mod, 0.6 + tier * 0.2) };
  }
  if ((it.slot === 'anel' || it.slot === 'amuleto') && tier >= 1 && Math.random() < 0.3) enchant(it);
  return it;
}
// Itens míticos: só caem na Torre Infinita. Partem de um Artefato e ficam mais fortes quanto mais alto o andar.
const MYTH_MODS = [
  f => ({ dmg: 2 + Math.floor(f / 5) }), f => ({ rate: +(0.1 + f * 0.005).toFixed(3) }), f => ({ hp: +(0.1 + f * 0.005).toFixed(3) }),
  f => ({ steal: +(0.03 + f * 0.002).toFixed(3) }), () => ({ cd: 0.12 }), () => ({ crit: 1 }), f => ({ regen: +(0.3 + f * 0.02).toFixed(2) }),
];
function mythItem(f, slot) {
  const it = genItem(6, slot);
  it.myth = f;
  if (it.slot === 'arma') { it.mythDice = 1 + Math.floor(f / 15); it.dice = [it.dice[0] + it.mythDice, it.dice[1]]; it.bonus += 8 + Math.floor(f / 2); }
  else if (it.slot === 'armadura') it.ac += 6 + Math.floor(f / 3);
  else if (it.slot === 'anel') it.bonus += 2 + Math.floor(f / 10);
  else it.mods = scaleMods(it.mods, 1.3 + f * 0.03);
  it.mods = Object.assign({}, it.mods || {}, pick(MYTH_MODS)(f));
  it.name = `✦ ${it.name} Mítico · andar ${f}`;
  return it;
}
// arma de outra classe (achada no chão) vira a arma equivalente da sua classe
function adaptWeapon(it, P) {
  if (it.slot !== 'arma' || !it.cls || it.cls === P.cls) return it;
  const c = CLASSES[P.cls];
  return { ...it, cls: P.cls, dice: [WDICE[it.tier][0] + (it.mythDice || 0), WDICE[it.tier][1] + c.dieAdj], name: fullName(c.weapons[it.tier], it) + (it.upg ? '' : '') };
}

const pct = v => `${Math.round(v * 100)}%`;
const tlist = a => a.map(t => TYPE_PT[t]).join('/');
const MOD_TXT = {
  dmg: v => `+${v} dano`, hit: v => `+${v} acerto`, crit: v => `crítico ${v} número(s) mais fácil`, ac: v => `+${v} CA`,
  rate: v => `+${pct(v)} cadência`, speed: v => `+${pct(v)} velocidade`, hp: v => `+${pct(v)} PV`, regen: v => `+${pct(v)} regeneração`,
  cd: v => `-${pct(v)} recarga`, range: v => `+${pct(v)} alcance`, steal: v => `${pct(v)} roubo de vida`, pierce: () => 'tiros perfurantes',
  etype: a => `+1d6 de dano ${tlist(a)}`, resist: a => `resiste a ${tlist(a)}`, gold: v => `+${pct(v)} ouro`, xp: v => `+${pct(v)} XP`,
  cap: v => `+${v} na captura`,
  wxchuva: v => `na chuva: +${pct(v)} de dano e sem penalidade`, wxsol: v => `no sol forte: +${pct(v)} de dano e sem penalidade`,
  wxareia: v => `na areia: +${pct(v)} de dano e não perde vida`, wxneve: v => `na nevasca: +${pct(v)} de dano, sem lentidão nem perda de vida`,
  wxcapa: v => `efeitos ruins do clima −${pct(v)}`, stimm: a => `imune a ${a.map(s => ({ 2: 'paralisia', 3: 'queimadura', 4: 'veneno', 6: 'confusão' })[s]).join(' e ')}`,
  stcut: v => `status duram −${pct(v)}`, pet: v => `+${pct(v)} dano do companheiro`, loot: v => `+${pct(v)} saque`, dodge: v => `${pct(v)} de esquiva`,
};
const modsDesc = m => (m ? Object.keys(m).map(k => MOD_TXT[k] && MOD_TXT[k](m[k])).filter(Boolean).join(' · ') : '');
function itemDesc(it) {
  let s = '';
  if (it.slot === 'arma') s = `${it.dice[0]}d${it.dice[1]}${it.bonus ? ' +' + it.bonus : ''} de dano`;
  else if (it.slot === 'armadura') s = `CA +${it.ac}`;
  else if (it.slot === 'anel' && it.starter) return 'Barreira dos iniciantes: absorve 40% da vida no Nv 1 e 25% no Nv 2, recarregando após 3 s sem levar dano. Para de funcionar no Nv 3.';
  else if (it.slot === 'anel') s = `+${it.bonus} ${ATTR_NAMES[it.attr]}`;
  else if (it.slot === 'pedra') return `Você vira tipo ${TYPE_PT[it.type]} por 30s (ataque e defesa) e causa +1d4 de dano`;
  else if (it.slot === 'cons') return CONS[it.k].nome;
  const m = modsDesc(it.mods);
  return s && m ? `${s} · ${m}` : s || m;
}
function itemScore(it) {
  if (!it) return -1;
  const nm = it.mods ? Object.keys(it.mods).length * 1.5 : 0;
  if (it.slot === 'arma') return it.dice[0] * (it.dice[1] + 1) / 2 + it.bonus + nm;
  if (it.slot === 'armadura') return it.ac + nm;
  if (it.slot === 'amuleto') return it.tier + nm;
  return (it.bonus || 0) + nm;
}
function itemIcon(it) {
  if (it.slot === 'arma') return CLASSES[G.P.cls].wicon;
  if (it.slot === 'armadura') return '🛡️';
  if (it.slot === 'anel') return '💍';
  if (it.slot === 'amuleto') return it.relic ? '🌟' : '📿';
  if (it.slot === 'pedra') return `<span class="gem" style="background:${TYPE_COLORS[it.type]}"></span>`;
  if (it.slot === 'cons') return CONS[it.k].icon;
  return it.slot === 'ball' ? '⚪' : '❤️';
}
const itemColor = it => (it.slot === 'pedra' ? TYPE_COLORS[it.type] : it.myth ? '#e879f9' : TIER_COLORS[it.tier]);
const isPocket = it => it.slot === 'pot' || it.slot === 'ball' || it.slot === 'cons';

function rollLoot(m) {
  const P = G.P;
  const tdg = inDungeonArea(m.x) && dungeonAt(m.x);
  if (tdg && tdg.floor) {
    const f = tdg.floor, ch = m.kind === 3 ? 1 : m.kind === 1 ? 0.35 : 0.06 + f * 0.003;
    if (Math.random() < ch) G.bags.push({ x: m.x + rand(-10, 10), y: m.y + rand(-10, 10), items: [mythItem(f)], life: 120 });
  }
  const tes = hasT(P, 'tesouro');
  // frequência: comuns 11% (20% com Caçador de Tesouros), Alfas 60%, chefes e raros sempre (os extras deles são sorteados)
  const chance = m.kind >= 2 ? 1 : m.kind === 1 ? 0.6 : 0.112 + (tes ? 0.084 : 0) + M(P, 'loot') * 0.7;
  if (Math.random() > chance) return;
  const items = [];
  const z = m.zone || 1;
  const great = () => (z >= 2 ? consItem('grande') : ballItem()), ultra = () => (z >= 3 ? consItem('ultra') : consItem('grande'));
  const tier = () => zoneTier(m.zone, 0.35 + (tes ? 0.5 : 0));
  const maybe = (p, f) => { if (Math.random() < p) items.push(f()); };
  if (m.kind === 2) {
    for (let i = 0; i < 3; i++) items.push(genItem(randi(4, 6)));
    items.push(relic(m.pid), monStone(m), potion(), potion(), consItem('ultra'), consItem('ultra'), consItem('doce'), consItem('doce'), statPot(), statPot());
  } else if (m.kind === 3) {
    items.push(genItem(zoneTier(m.zone, 1.75)), genItem(zoneTier(m.zone, 0.75)));
    maybe(0.3, () => monStone(m)); maybe(0.7, potion); maybe(0.7, great); maybe(0.7, () => consItem('doce'));
    maybe(0.28, ultra); maybe(z >= 2 ? 0.245 : 0.1, statPot);
  } else if (m.kind === 4) {
    items.push(genItem(zoneTier(z, 0.9 + (tes ? 0.5 : 0)))); // raro: no nível do Alfa
    maybe(0.3, () => monStone(m)); maybe(0.7, ballItem); maybe(0.7, great); maybe(0.7, () => consItem('doce')); maybe(0.175, statPot);
  } else if (m.kind === 1) {
    items.push(genItem(zoneTier(z, 0.9 + (tes ? 0.5 : 0))), potion()); // Alfa: meio degrau acima dos comuns, abaixo dos chefes (tem muitos pelo mapa)
    maybe(0.5, ballItem); maybe(0.1, () => monStone(m)); maybe(0.25, () => consItem('doce')); maybe(0.25, great); maybe((z >= 2 ? 0.06 : 0.02) + (m.st >= 10 && m.st < 40 ? 0.5 : 0), statPot); // Procurados (recompensa de contrato) dão mais; mini-chefes do ginásio não
  } else {
    const r = Math.random();
    let it = r < 0.38 ? potion() : r < 0.48 ? ballItem() : r < 0.52 ? great() : r < (z >= 2 ? 0.545 : 0.53) ? consItem('doce') : null;
    // cristal 4%, equipamento 92% (a parte que era do cristal antes fica vazia: nada mais cai no lugar dele)
    if (!it) { const q = Math.random(); it = q < 0.04 ? monStone(m) : q < 0.08 ? null : genItem(tier()); }
    if (it) items.push(it);
  }
  if (m.kind === 0 && m.zone >= 3 && Math.random() < 0.003) items.push(statPot());
  if (!items.length) return;
  G.bags.push({ x: m.x + rand(-10, 10), y: m.y + rand(-10, 10), items, life: 90 });
}

// anel com que todo herói começa: barreira só nos níveis 1 e 2 (substitui a redução de dano escondida do começo)
const starterRing = () => ({ slot: 'anel', tier: 0, name: 'Anel Protetor dos Iniciantes', starter: 1, attr: 'VIG', bonus: 0, mods: {} });
