import CardFactory from "../models/CardFactory";

export const PHYLE_LABELS = {
  1: "人類",
  2: "亡靈",
  3: "野獸",
  4: "地精",
  5: "巨魔",
  6: "精靈",
  7: "獸人",
  8: "異界",
  9: "龍",
  10: "天使",
  11: "惡魔"
};

const CHALLENGE_PHYLE_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const DECK_SIZE = 30;

function abilityCount(def) {
  const list = [];
  if (def?.ability1) list.push(String(def.ability1).trim());
  if (def?.ability2) list.push(String(def.ability2).trim());
  if (def?.ability3) list.push(String(def.ability3).trim());
  if (def?.ability4) list.push(String(def.ability4).trim());
  if (def?.ability5) list.push(String(def.ability5).trim());
  if (Array.isArray(def?.abilities)) {
    for (let i = 0; i < def.abilities.length; i += 1) {
      const s = String(def.abilities[i] || "").trim();
      if (s) list.push(s);
    }
  }
  return new Set(list).size;
}

function scoreDef(def) {
  const quality = Number(def?.quality ?? 0);
  const hp = Number(def?.unit?.hp ?? 1);
  const atk = Number(def?.unit?.atk ?? 0);
  const cost = Number(def?.cost ?? def?.baseCost ?? 0);
  const effects = abilityCount(def);
  const ruleTags = Object.keys(def?.effectRuleMap || {}).length;
  const instances = Array.isArray(def?.effectInstances) ? def.effectInstances.length : 0;

  return effects * 100 + ruleTags * 30 + instances * 20 + quality * 12 + hp + atk * 2 - cost;
}

function isUsableSummon(def) {
  if (!def || def.type !== "summon") return false;
  if (!def.unit) return false;
  return Number(def.unit.hp || 0) > 0;
}

function makeDeckFromPool(pool, size = DECK_SIZE) {
  if (!pool.length) return [];
  const ids = pool.map((x) => String(x.id));
  if (ids.length >= size) return ids.slice(0, size);

  const out = [];
  let idx = 0;
  while (out.length < size) {
    out.push(ids[idx % ids.length]);
    idx += 1;
  }
  return out;
}

export function buildAllRaceChallengeDecks() {
  const defs = CardFactory.getImportedCardDefs().filter((d) => isUsableSummon(d));
  const allUsable = defs
    .slice()
    .sort((a, b) => scoreDef(b) - scoreDef(a))
    .slice(0, Math.max(30, Math.min(120, defs.length)));

  const result = [];

  for (let i = 0; i < CHALLENGE_PHYLE_ORDER.length; i += 1) {
    const phyle = CHALLENGE_PHYLE_ORDER[i];
    const label = PHYLE_LABELS[phyle] || `種族${phyle}`;
    const pool = defs
      .filter((d) => Number(d.phyle || 0) === phyle)
      .sort((a, b) => scoreDef(b) - scoreDef(a));

    let deckPool = pool;
    if (deckPool.length < 10) {
      // 種族卡過少時，用高分中立卡補位，確保能組滿30張。
      const fallback = allUsable.filter((d) => Number(d.phyle || 0) !== phyle);
      deckPool = [...pool, ...fallback].slice(0, Math.max(30, pool.length + 20));
    }

    const deckIds = makeDeckFromPool(deckPool, DECK_SIZE);
    const avgPower = deckPool.length
      ? Math.round(deckPool.slice(0, 30).reduce((sum, d) => sum + scoreDef(d), 0) / Math.min(30, deckPool.length))
      : 0;

    result.push({
      phyle,
      label,
      poolCount: pool.length,
      deckIds,
      avgPower
    });
  }

  return result;
}

