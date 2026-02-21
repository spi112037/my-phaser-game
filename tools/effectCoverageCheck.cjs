const fs = require("fs");
const path = require("path");

const dataPath = process.argv[2] || path.join(__dirname, "..", "src", "data", "flameCardsBest.json");
const outPath = process.argv[3] || path.join(__dirname, "..", "effect_coverage_report.txt");

const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const cards = Array.isArray(raw) ? raw : (raw.cards || []);

function normalizeAbilityList(card) {
  return [
    String(card?.ability1 || "").trim(),
    String(card?.ability2 || "").trim(),
    String(card?.ability3 || "").trim(),
    String(card?.ability4 || "").trim(),
    String(card?.ability5 || "").trim(),
    ...(Array.isArray(card?.abilities) ? card.abilities.map((x) => String(x || "").trim()) : [])
  ].filter(Boolean);
}

function abilityKey(src) {
  return String(src || "").split(/[・:：]/)[0].trim();
}

const allMap = new Map();
const explicitMapCovered = new Map();
const explicitInstanceCovered = new Map();

for (const c of cards) {
  const abs = normalizeAbilityList(c);
  const ruleMap = c?.effectRuleMap && typeof c.effectRuleMap === "object" ? c.effectRuleMap : {};
  const effectInstances = Array.isArray(c?.effectInstances) ? c.effectInstances : [];
  const instanceKeys = new Set(
    effectInstances
      .map((x) => String(x?.sourceKey || x?.abilityKey || "").trim())
      .filter(Boolean)
  );

  for (const ab of abs) {
    const k = abilityKey(ab);
    if (!k) continue;
    allMap.set(k, (allMap.get(k) || 0) + 1);
    if (Object.prototype.hasOwnProperty.call(ruleMap, k)) {
      explicitMapCovered.set(k, (explicitMapCovered.get(k) || 0) + 1);
    }
    if (instanceKeys.has(k)) {
      explicitInstanceCovered.set(k, (explicitInstanceCovered.get(k) || 0) + 1);
    }
  }
}

const rows = [];
for (const [key, count] of allMap.entries()) {
  const mapHit = explicitMapCovered.get(key) || 0;
  const instHit = explicitInstanceCovered.get(key) || 0;
  rows.push({
    key,
    count,
    mapHit,
    instHit,
    covered: mapHit > 0 || instHit > 0
  });
}

rows.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "zh-Hant"));

const uncovered = rows.filter((r) => !r.covered);
const covered = rows.filter((r) => r.covered);

const lines = [];
lines.push(`cards=${cards.length}`);
lines.push(`ability_keys_total=${rows.length}`);
lines.push(`ability_keys_covered=${covered.length}`);
lines.push(`ability_keys_uncovered=${uncovered.length}`);
lines.push("");
lines.push("Top uncovered ability keys:");
for (let i = 0; i < Math.min(120, uncovered.length); i += 1) {
  const r = uncovered[i];
  lines.push(`${i + 1}. ${r.key} (${r.count})`);
}
lines.push("");
lines.push("Top covered ability keys:");
for (let i = 0; i < Math.min(60, covered.length); i += 1) {
  const r = covered[i];
  lines.push(`${i + 1}. ${r.key} (${r.count}) map=${r.mapHit} instance=${r.instHit}`);
}

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(JSON.stringify({
  cards: cards.length,
  total: rows.length,
  covered: covered.length,
  uncovered: uncovered.length,
  outPath
}, null, 2));
