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
};
const relic = pid => { const r = RELICS[pid]; return r ? { slot: 'amuleto', tier: 6, name: r.nome, mods: JSON.parse(JSON.stringify(r.mods)), relic: 1 } : genItem(6, 'amuleto'); };

// consumíveis de bolso (não ocupam a mochila)
const CONS = {
  grande: { nome: 'Grande Bola', icon: '🔵', bonus: 3 },
  ultra: { nome: 'Ultra Bola', icon: '🟡', bonus: 6 },
  doce: { nome: 'Doce Raro', icon: '🍬' },
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
    P.attrs[a]++;
    P.hp += Math.max(0, maxHP(P) - old);
    G.toasts.push({ text: `⬆ ${ATTR_NAMES[a]} +1 permanente! (${P.attrs[a]}/${ATTR_MAX})`, color: '#fde047', t: 3.5, big: 1 });
    sfx('lvl');
  }
  G.dirty = true;
  saveGame();
}
const consItem = k => ({ slot: 'cons', k, tier: CONS[k].stat ? 5 : k === 'ultra' || k === 'doce' ? 3 : 1, name: CONS[k].nome });
const potion = () => ({ slot: 'pot', tier: 0, name: 'Poção de Cura' });
const ballItem = () => ({ slot: 'ball', tier: 0, name: 'Pokébola' });
const stone = type => ({ slot: 'pedra', tier: 3, type: TYPE_PT[type] ? type : 'normal', name: `Cristal de ${TYPE_PT[type] || 'Normal'}` });

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
  return it;
}
// arma de outra classe (achada no chão) vira a arma equivalente da sua classe
function adaptWeapon(it, P) {
  if (it.slot !== 'arma' || !it.cls || it.cls === P.cls) return it;
  const c = CLASSES[P.cls];
  return { ...it, cls: P.cls, dice: [WDICE[it.tier][0], WDICE[it.tier][1] + c.dieAdj], name: fullName(c.weapons[it.tier], it) + (it.upg ? '' : '') };
}

const pct = v => `${Math.round(v * 100)}%`;
const tlist = a => a.map(t => TYPE_PT[t]).join('/');
const MOD_TXT = {
  dmg: v => `+${v} dano`, hit: v => `+${v} acerto`, crit: v => `crítico ${v} número(s) mais fácil`, ac: v => `+${v} CA`,
  rate: v => `+${pct(v)} cadência`, speed: v => `+${pct(v)} velocidade`, hp: v => `+${pct(v)} PV`, regen: v => `+${pct(v)} regeneração`,
  cd: v => `-${pct(v)} recarga`, range: v => `+${pct(v)} alcance`, steal: v => `${pct(v)} roubo de vida`, pierce: () => 'tiros perfurantes',
  etype: a => `+1d6 de dano ${tlist(a)}`, resist: a => `resiste a ${tlist(a)}`, gold: v => `+${pct(v)} ouro`, xp: v => `+${pct(v)} XP`,
  cap: v => `+${v} na captura`, pet: v => `+${pct(v)} dano do companheiro`, loot: v => `+${pct(v)} saque`, dodge: v => `${pct(v)} de esquiva`,
};
const modsDesc = m => (m ? Object.keys(m).map(k => MOD_TXT[k] && MOD_TXT[k](m[k])).filter(Boolean).join(' · ') : '');
function itemDesc(it) {
  let s = '';
  if (it.slot === 'arma') s = `${it.dice[0]}d${it.dice[1]}${it.bonus ? ' +' + it.bonus : ''} de dano`;
  else if (it.slot === 'armadura') s = `CA +${it.ac}`;
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
const itemColor = it => (it.slot === 'pedra' ? TYPE_COLORS[it.type] : TIER_COLORS[it.tier]);
const isPocket = it => it.slot === 'pot' || it.slot === 'ball' || it.slot === 'cons';

function rollLoot(m) {
  const P = G.P;
  const tes = hasT(P, 'tesouro');
  const chance = m.kind >= 2 ? 1 : m.kind === 1 ? 0.85 : 0.16 + (tes ? 0.12 : 0) + M(P, 'loot');
  if (Math.random() > chance) return;
  const items = [];
  const zt = (m.zone - 1) * 1.5 + (tes ? 0.5 : 0);
  const tier = () => clamp(Math.round(zt + rand(-0.5, 1.2)), 0, 6);
  const maybe = (p, f) => { if (Math.random() < p) items.push(f()); };
  if (m.kind === 2) {
    for (let i = 0; i < 3; i++) items.push(genItem(randi(4, 6)));
    items.push(relic(m.pid), stone(m.type), potion(), potion(), consItem('ultra'), consItem('ultra'), consItem('doce'), consItem('doce'), statPot(), statPot());
  } else if (m.kind === 3) {
    items.push(genItem(clamp(m.zone + randi(0, 2), 0, 6)), genItem(clamp(m.zone + randi(-1, 1), 0, 6)), stone(m.type), potion(), consItem('grande'), consItem('doce'));
    maybe(0.4, () => consItem('ultra')); maybe(0.35, statPot);
  } else if (m.kind === 4) {
    items.push(genItem(tier() + 1), stone(m.type), ballItem(), consItem('grande'), consItem('doce'));
    maybe(0.25, statPot);
  } else if (m.kind === 1) {
    items.push(genItem(tier() + 1), potion());
    maybe(0.5, ballItem); maybe(0.3, () => stone(m.type)); maybe(0.25, () => consItem('doce')); maybe(0.25, () => consItem('grande')); maybe(0.2, () => consItem('elixir')); maybe(0.06 + (m.st >= 10 ? 0.5 : 0), statPot);
  } else {
    const r = Math.random();
    items.push(r < 0.38 ? potion() : r < 0.48 ? ballItem() : r < 0.52 ? consItem('grande') : r < 0.545 ? consItem('doce') : r < 0.6 ? consItem('elixir')
      : Math.random() < 0.15 ? stone(m.type) : genItem(tier()));
  }
  if (m.kind === 0 && m.zone >= 3 && Math.random() < 0.004) items.push(statPot());
  G.bags.push({ x: m.x + rand(-10, 10), y: m.y + rand(-10, 10), items, life: 90 });
}
