import flameCardsBest from "../data/flameCardsBest.json";
import skillsFromExcelQ56 from "../data/skills_from_excel_q56.json";

const OVERRIDE_KEY = "my-phaser-game.card-overrides.v1";
const SKILL_TEXT_BY_SOURCE_ID = new Map();
const SKILL_TEXT_BY_ID = new Map();

{
  const source = Array.isArray(skillsFromExcelQ56) ? skillsFromExcelQ56 : [];
  for (let i = 0; i < source.length; i += 1) {
    const it = source[i];
    if (!it || String(it.type || "") !== "skill") continue;
    const sid = Number(it.sourceId ?? 0);
    const id = String(it.id || "");
    const text = String(it.description || "").trim();
    if (sid > 0 && text && !SKILL_TEXT_BY_SOURCE_ID.has(sid)) SKILL_TEXT_BY_SOURCE_ID.set(sid, text);
    if (id && text && !SKILL_TEXT_BY_ID.has(id)) SKILL_TEXT_BY_ID.set(id, text);
  }
}

function deriveSkillClassCode(defLike) {
  if (!defLike || String(defLike.type || "") !== "skill") return 0;
  const ph = Number(defLike.phyle ?? 0);
  if (ph >= 100 && ph <= 103) return ph;
  const sid = Number(defLike.sourceId ?? 0);
  const pre = Math.floor(sid / 100);
  if (pre === 410 || pre === 411 || pre === 510) return 100;
  if (pre === 420 || pre === 421 || pre === 520) return 101;
  if (pre === 430 || pre === 431 || pre === 530) return 102;
  if (pre === 440 || pre === 441 || pre === 540) return 103;
  return 0;
}

const STARTER_CARD_DEFS = [
  {
    id: "s_swordsman",
    name: "劍士",
    type: "summon",
    cost: 2,
    image: "/cards/s_swordsman.png",
    description: "前排近戰單位。每次回合推進後向前壓進，對正前方敵人造成穩定傷害。",
    ability1: "",
    ability2: "",
    ability3: "",
    ability4: "",
    ability5: "",
    abilities: [],
    unit: { name: "劍士", hp: 12, atk: 3, range: 40, speed: 40, atkCdMs: 900 }
  },
  {
    id: "s_guard",
    name: "衛兵",
    type: "summon",
    cost: 3,
    image: "/cards/s_guard.png",
    description: "高生命防線單位。適合卡位吸收傷害，拖住敵方推線節奏。",
    ability1: "",
    ability2: "",
    ability3: "",
    ability4: "",
    ability5: "",
    abilities: [],
    unit: { name: "衛兵", hp: 18, atk: 2, range: 40, speed: 28, atkCdMs: 950 }
  },
  {
    id: "s_archer",
    name: "弓手",
    type: "summon",
    cost: 2,
    image: "/cards/s_archer.png",
    description: "後排輸出單位。攻擊力中等、可在推線中提供穩定遠程火力。",
    ability1: "",
    ability2: "",
    ability3: "",
    ability4: "",
    ability5: "",
    abilities: [],
    unit: { name: "弓手", hp: 9, atk: 2, range: 220, speed: 35, atkCdMs: 1000 }
  },
  {
    id: "s_mage",
    name: "法師",
    type: "summon",
    cost: 4,
    image: "/cards/s_mage.png",
    description: "高爆發法術單位。生命較低，但能在接戰時打出高額傷害。",
    ability1: "",
    ability2: "",
    ability3: "",
    ability4: "",
    ability5: "",
    abilities: [],
    unit: { name: "法師", hp: 8, atk: 4, range: 180, speed: 32, atkCdMs: 1100 }
  }
];

function readOverrides() {
  try {
    if (!globalThis?.localStorage) return {};
    const raw = globalThis.localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getOverrideOnlyCards() {
  const overrides = readOverrides();
  if (!overrides || typeof overrides !== "object") return [];

  const keys = Object.keys(overrides);
  const out = [];
  for (let i = 0; i < keys.length; i += 1) {
    const id = String(keys[i] || "");
    if (!id) continue;
    if (BY_ID.has(id)) continue;
    const raw = overrides[id];
    if (!raw || typeof raw !== "object") continue;
    const normalized = normalizeCard({
      id,
      type: "summon",
      source: "override",
      ...raw
    });
    if (!normalized.id || !normalized.name) continue;
    out.push(normalized);
  }
  return out;
}

function toTraditionalLite(input) {
  let s = String(input ?? "");
  const replacements = [
    ["召唤", "召喚"], ["准备", "準備"], ["伤害", "傷害"], ["治疗", "治療"], ["复活", "復活"],
    ["攻击", "攻擊"], ["无法", "無法"], ["减免", "減免"], ["减速", "減速"], ["闪避", "閃避"],
    ["双", "雙"], ["龙", "龍"], ["后", "後"], ["术", "術"], ["飞", "飛"], ["击", "擊"],
    ["护", "護"], ["战", "戰"], ["灵", "靈"], ["恶", "惡"], ["兽", "獸"], ["异", "異"],
    ["圣", "聖"], ["剑", "劍"], ["猫", "貓"], ["风", "風"], ["云", "雲"], ["门", "門"],
    ["亚", "亞"], ["丽", "麗"], ["国", "國"], ["军", "軍"], ["万", "萬"], ["与", "與"],
    ["灭", "滅"], ["准", "準"], ["备", "備"], ["疗", "療"], ["伤", "傷"], ["复", "復"],
    ["体", "體"], ["阵", "陣"], ["阶", "階"], ["觉", "覺"], ["轮", "輪"], ["镇", "鎮"],
    ["罗", "羅"], ["乌", "烏"], ["叶", "葉"], ["玛", "瑪"], ["贝", "貝"], ["萨", "薩"],
    ["兰", "蘭"], ["韩", "韓"], ["乔", "喬"], ["诺", "諾"], ["丝", "絲"], ["维", "維"],
    ["来", "來"], ["这", "這"], ["个", "個"], ["为", "為"], ["时", "時"], ["会", "會"],
    ["们", "們"], ["发", "發"], ["级", "級"], ["觉醒", "覺醒"], ["范围", "範圍"], ["几率", "機率"],
    ["女娲", "女媧"], ["场时", "在場時"]
  ];
  for (let i = 0; i < replacements.length; i += 1) {
    const [from, to] = replacements[i];
    s = s.replaceAll(from, to);
  }
  return s;
}

function normalizeAbilities(def) {
  const slots = [
    toTraditionalLite(String(def?.ability1 ?? "").trim()),
    toTraditionalLite(String(def?.ability2 ?? "").trim()),
    toTraditionalLite(String(def?.ability3 ?? "").trim()),
    toTraditionalLite(String(def?.ability4 ?? "").trim()),
    toTraditionalLite(String(def?.ability5 ?? "").trim())
  ];

  const fromArray = Array.isArray(def?.abilities)
    ? def.abilities.map((x) => toTraditionalLite(String(x ?? "").trim())).filter((x) => x)
    : [];

  for (let i = 0; i < fromArray.length && i < 5; i += 1) {
    if (!slots[i]) slots[i] = fromArray[i];
  }

    const merged = [];
  const seen = new Set();
  for (let i = 0; i < slots.length; i += 1) {
    const v = slots[i];
    if (!v || seen.has(v)) continue;
    seen.add(v);
    merged.push(v);
  }
    return {
    ability1: merged[0] || "",
    ability2: merged[1] || "",
    ability3: merged[2] || "",
    ability4: merged[3] || "",
    ability5: merged[4] || "",
    abilities: merged
  };
}

function normalizeEffectRuleMap(def) {
  const out = {};
  const rawMap = def?.effectRuleMap;
  const rawTags = def?.effectTags;
  const raw = (rawMap && typeof rawMap === "object") ? rawMap : ((rawTags && typeof rawTags === "object") ? rawTags : null);
  if (!raw || typeof raw !== "object") return out;

  const keys = Object.keys(raw);
  for (let i = 0; i < keys.length; i += 1) {
    const key = toTraditionalLite(String(keys[i] || "").trim());
    if (!key) continue;
    const rule = raw[key];

    if (Array.isArray(rule)) {
      const tags = rule.map((x) => String(x || "").trim()).filter((x) => x);
      if (tags.length > 0) out[key] = { tags: [...new Set(tags)], valueHint: 1 };
      continue;
    }

    if (!rule || typeof rule !== "object") continue;
    const tags = Array.isArray(rule.tags)
      ? rule.tags.map((x) => String(x || "").trim()).filter((x) => x)
      : [];
    if (tags.length <= 0) continue;
    out[key] = {
      tags: [...new Set(tags)],
      valueHint: Math.max(1, Number(rule.valueHint || 1))
    };
  }

  return out;
}

function normalizeEffectInstances(def) {
  if (!Array.isArray(def?.effectInstances)) return [];
  const out = [];
  for (let i = 0; i < def.effectInstances.length; i += 1) {
    const it = def.effectInstances[i];
    if (!it || typeof it !== "object") continue;
    const id = String(it.id ?? it.type ?? "").trim();
    if (!id) continue;
    out.push({
      id,
      value: Number(it.value ?? it.valueHint ?? 0),
      sourceKey: String(it.sourceKey ?? it.abilityKey ?? "").trim(),
      tags: Array.isArray(it.tags) ? it.tags.map((x) => String(x ?? "").trim()).filter((x) => x) : [],
      params: it.params && typeof it.params === "object" ? { ...it.params } : {}
    });
  }
  return out;
}

function normalizeCard(def) {
  const baseCost = Math.max(0, Number(def?.cost ?? 0));
  const sourceId = Number(def?.sourceId ?? 0);
  const cardId = String(def?.id ?? "");
  const isSkill = String(def?.type ?? "summon") === "skill";
  const skillDescFromMap = SKILL_TEXT_BY_SOURCE_ID.get(sourceId) || SKILL_TEXT_BY_ID.get(cardId) || "";
  const normalizedSkillDesc = toTraditionalLite(String(skillDescFromMap || "").trim());
  const ability = normalizeAbilities({
    ...def,
    ability1: String(def?.ability1 ?? "").trim() || (isSkill ? normalizedSkillDesc : "")
  });
  const rawPhyle = def?.phyle;
  const phyle = rawPhyle === undefined || rawPhyle === null || rawPhyle === ""
    ? 0
    : Number(rawPhyle);
  const skillClass = deriveSkillClassCode(def);

  return {
    id: cardId,
    name: toTraditionalLite(String(def?.name ?? "")),
    type: String(def?.type ?? "summon"),
    quality: Number(def?.quality ?? 0),
    source: String(def?.source ?? "local"),
    sourceId,
    phyle: Number.isFinite(phyle) ? phyle : 0,
    skillClass,
    description: toTraditionalLite(String(def?.description ?? "")),
    image: String(def?.image ?? ""),
    effectRuleMap: normalizeEffectRuleMap(def),
    effectInstances: normalizeEffectInstances(def),
    baseCost,
    cost: baseCost,
    ...ability,
    unit: {
      name: toTraditionalLite(String(def?.unit?.name ?? def?.name ?? "")),
      hp: Math.max(1, Number(def?.unit?.hp ?? 1)),
      atk: Math.max(1, Number(def?.unit?.atk ?? 0)),
      range: Math.max(40, Number(def?.unit?.range ?? 40)),
      speed: Math.max(20, Number(def?.unit?.speed ?? 35)),
      atkCdMs: Math.max(400, Number(def?.unit?.atkCdMs ?? 1000))
    }
  };
}

function applyOverride(base) {
  const overrides = readOverrides();
  const ov = overrides[String(base.id)];
  if (!ov || typeof ov !== "object") return base;

  return normalizeCard({
    ...base,
    ...ov,
    unit: { ...base.unit, ...(ov.unit || {}) }
  });
}

const STARTER = STARTER_CARD_DEFS.map((d) => normalizeCard(d));

const importedSource = Array.isArray(flameCardsBest)
  ? flameCardsBest
  : (Array.isArray(flameCardsBest?.cards) ? flameCardsBest.cards : []);

const IMPORTED = importedSource.length > 0
  ? importedSource
      .map((d) => normalizeCard(d))
      .filter((d) => d.id && d.name)
  : [];

const ALL_BASE = [...STARTER, ...IMPORTED];
const BY_ID = new Map(ALL_BASE.map((c) => [c.id, c]));

function cloneCard(card) {
  return {
    ...card,
    unit: { ...card.unit },
    abilities: [...card.abilities],
    effectRuleMap: { ...(card.effectRuleMap || {}) },
    effectInstances: Array.isArray(card.effectInstances) ? card.effectInstances.map((x) => ({ ...x, params: { ...(x?.params || {}) } })) : []
  };
}

export default class CardFactory {
  static getStarterCardDefs() {
    return STARTER.map((x) => cloneCard(applyOverride(x)));
  }

  static getImportedCardDefs() {
    return IMPORTED.map((x) => cloneCard(applyOverride(x)));
  }

  static getAllCardDefs() {
    const merged = ALL_BASE.map((x) => cloneCard(applyOverride(x)));
    const extra = getOverrideOnlyCards();
    for (let i = 0; i < extra.length; i += 1) {
      merged.push(cloneCard(extra[i]));
    }
    return merged;
  }

  static getCardDef(id) {
    const card = BY_ID.get(String(id));
    if (card) return cloneCard(applyOverride(card));

    const overrides = readOverrides();
    const ov = overrides[String(id)];
    if (!ov || typeof ov !== "object") return null;
    const normalized = normalizeCard({
      id: String(id),
      type: "summon",
      source: "override",
      ...ov
    });
    if (!normalized.id || !normalized.name) return null;
    return cloneCard(normalized);
  }

  static create(id) {
    const def = this.getCardDef(id);
    if (!def) {
      return {
        id: String(id),
        name: String(id),
        type: "unknown",
        quality: 0,
        source: "unknown",
        sourceId: 0,
        phyle: 0,
        baseCost: 99,
        cost: 99,
        image: "",
        effectRuleMap: {},
        effectInstances: [],
        description: "",
        ability1: "",
        ability2: "",
        ability3: "",
        ability4: "",
        ability5: "",
        abilities: [],
        unit: { name: String(id), hp: 1, atk: 1, range: 40, speed: 35, atkCdMs: 1000 }
      };
    }

    return {
      ...def,
      unit: { ...def.unit },
      abilities: [...def.abilities],
      effectRuleMap: { ...(def.effectRuleMap || {}) },
      effectInstances: Array.isArray(def.effectInstances) ? def.effectInstances.map((x) => ({ ...x, params: { ...(x?.params || {}) } })) : [],
      baseCost: Number(def.baseCost ?? def.cost ?? 0),
      cost: Number(def.baseCost ?? def.cost ?? 0)
    };
  }
}



