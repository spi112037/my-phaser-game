import {
  HERO_HP,
  GRID_ROWS,
  GRID_COLS,
  DEPLOY_LEFT_COL_MAX,
  DEPLOY_RIGHT_COL_MIN,
  START_HAND,
  DRAW_PER_TURN,
  HAND_LIMIT
} from "../config/constants";
import flameCardsBest from "../data/flameCardsBest.json";
import effectRulesFromExcel from "../data/effectRulesFromExcel.json";
import abilityProgramLibrary from "../data/abilityProgramLibrary.json";

const EFFECT_RULE_OVERRIDE_KEY = "my-phaser-game.effect-rule-overrides.v1";

function getCardCost(card) {
  return Math.max(0, Number(card?.cost ?? card?.baseCost ?? 0));
}

function safeStr(v) {
  return String(v ?? "").trim();
}

function clampMin(v, minValue) {
  const n = Number(v);
  return Math.max(minValue, Number.isFinite(n) ? n : minValue);
}

function pickTrailingNumber(s, fallback = 1) {
  const m = String(s ?? "").match(/(\d+)/g);
  if (!m || m.length === 0) return fallback;
  return Number(m[m.length - 1]) || fallback;
}

function parsePlusNumber(src, fallback = 1) {
  const m = String(src ?? "").match(/\+\s*(\d+)/);
  return m ? Number(m[1] || fallback) : fallback;
}

function parseLooseIntToken(raw, fallback = 1) {
  const s = safeStr(raw);
  if (!s) return fallback;
  const digit = s.match(/\d+/);
  if (digit) return Math.max(0, Number(digit[0] || fallback));

  const map = {
    "零": 0,
    "〇": 0,
    "一": 1,
    "二": 2,
    "兩": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9
  };
  if (s === "十") return 10;
  if (s.includes("十")) {
    const parts = s.split("十");
    const tens = parts[0] ? (map[parts[0]] ?? 1) : 1;
    const ones = parts[1] ? (map[parts[1]] ?? 0) : 0;
    return tens * 10 + ones;
  }
  if (Object.prototype.hasOwnProperty.call(map, s)) return map[s];
  return fallback;
}

function normalizeEffectName(raw) {
  return safeStr(String(raw ?? "").split(/[・:：]/)[0]);
}

function isAuraEffectText(text) {
  return /光环|光環/.test(String(text || ""));
}

function parseSummonSpecFromText(text) {
  const s = String(text || "");
  if (/召唤者|召喚者/.test(s)) return null;
  if (!/召唤|召喚/.test(s)) return null;

  let count = 1;
  const countMatch = s.match(/每回合.*召唤\s*(\d+)\s*个|每回合.*召喚\s*(\d+)\s*個|每回合.*召唤\s*(\d+)/);
  if (countMatch) {
    const hit = Number(countMatch[1] || countMatch[2] || countMatch[3] || 1);
    if (Number.isFinite(hit) && hit > 0) count = Math.min(4, hit);
  }

  let maxAlive = 0;
  const maxMatch = s.match(/最多\s*(\d+)\s*[个個名头頭]/);
  if (maxMatch) {
    const m = Number(maxMatch[1] || 0);
    if (Number.isFinite(m) && m > 0) maxAlive = Math.min(8, m);
  }

  let hp = 0;
  let atk = 0;
  let hasStatsTuple = false;
  let parsedAbilities = [];
  const tuple = s.match(/[（(]\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)([^）)]*)[）)]/);
  if (tuple) {
    hasStatsTuple = true;
    const h = Number(tuple[2] || 1);
    const a = Number(tuple[3] || 1);
    hp = Math.max(1, Math.min(20, Number.isFinite(h) ? h : 1));
    atk = Math.max(1, Math.min(20, Number.isFinite(a) ? a : 1));

    const tail = String(tuple[4] || "");
    if (tail) {
      const raceWords = new Set(["人类", "人類", "亡灵", "亡靈", "野兽", "野獸", "地精", "巨魔", "精灵", "精靈", "兽人", "獸人", "异界", "異界", "龙", "龍", "天使", "恶魔", "惡魔"]);
      parsedAbilities = tail
        .split("/")
        .map((x) => safeStr(x))
        .filter((x) => x && !/^\d+$/.test(x) && !raceWords.has(x));
    }
  }

  const tupleAlt = s.match(/[（(]\s*(\d+)\s*[,，]\s*(\d+)\s*[,，]\s*(\d+)([^）)]*)[）)]/);
  if (!hasStatsTuple && tupleAlt) {
    hasStatsTuple = true;
    const a = Number(tupleAlt[2] || 1);
    const h = Number(tupleAlt[3] || 1);
    hp = Math.max(1, Math.min(20, Number.isFinite(h) ? h : 1));
    atk = Math.max(1, Math.min(20, Number.isFinite(a) ? a : 1));
  }

  if (!hasStatsTuple) return null;

  let name = "";
  const nameMatch = s.match(/召唤(?:一个|一個|\d+个|\d+個)?([^（(，。]+)|召喚(?:一個|\d+個)?([^（(，。]+)/);
  if (nameMatch && String(nameMatch[1] || nameMatch[2] || "").trim()) {
    name = String(nameMatch[1] || nameMatch[2] || "").trim().slice(0, 14);
  }
  if (!name) return null;

  if (parsedAbilities.length === 0 && /飞剑|飛劍/.test(s)) {
    parsedAbilities = ["疾风步", "飞溅", "骤现"];
  }

  return { count, hp, atk, name, abilities: parsedAbilities, maxAlive };
}

function hasExplicitSummonText(text) {
  const s = String(text || "");
  if (!s) return false;
  if (/召唤者|召喚者/.test(s)) return false;
  return /召唤|召喚/.test(s);
}

function parseReviveChanceFromText(text) {
  const s = String(text || "");
  if (!/死亡后|死亡後|复活|復活|重生/.test(s)) return null;
  const m = s.match(/(\d+)\s*%/);
  if (m) {
    const p = Number(m[1] || 0);
    if (Number.isFinite(p) && p > 0) return Math.max(0, Math.min(1, p / 100));
  }
  if (/仅能复活一次|僅能復活一次|复活一次|復活一次/.test(s)) return 1;
  return 0.5;
}

const RACE_PATTERN_MAP = [
  { re: /人类|人類/, ids: [1] },
  { re: /亡灵|亡靈/, ids: [2] },
  { re: /野兽|野獸/, ids: [3] },
  { re: /地精/, ids: [4] },
  { re: /巨魔/, ids: [5] },
  { re: /精灵|精靈/, ids: [6] },
  { re: /兽人|獸人/, ids: [7] },
  { re: /异界|異界/, ids: [8] },
  { re: /龙|龍/, ids: [9] },
  { re: /天使/, ids: [10] },
  { re: /恶魔|惡魔/, ids: [11] }
];

function parseRaceIdsFromText(text) {
  const s = String(text || "");
  const raceIds = [];
  for (let i = 0; i < RACE_PATTERN_MAP.length; i += 1) {
    const item = RACE_PATTERN_MAP[i];
    if (item.re.test(s)) raceIds.push(...item.ids);
  }
  return [...new Set(raceIds)];
}

function parseAllyCountBuffFromText(text) {
  const s = String(text || "");
  if (!/友方.*士兵|友軍.*士兵/.test(s)) return null;
  if (!/场上|場上|场内|場內|每存在|每有/.test(s)) return null;

  const atkMatch = s.match(/攻擊力?\s*\+\s*(\d+)|攻击力?\s*\+\s*(\d+)|ATK\s*\+\s*(\d+)/i);
  const hpMatch = s.match(/生命值?\s*\+\s*(\d+)|生命\s*\+\s*(\d+)|血量\s*\+\s*(\d+)|HP\s*\+\s*(\d+)/i);
  const atkPer = Number(atkMatch?.[1] || atkMatch?.[2] || atkMatch?.[3] || 0);
  const hpPer = Number(hpMatch?.[1] || hpMatch?.[2] || hpMatch?.[3] || 0);
  if (atkPer <= 0 && hpPer <= 0) return null;

  return {
    atkPer: Math.max(0, atkPer),
    hpPer: Math.max(0, hpPer),
    raceIds: parseRaceIdsFromText(s)
  };
}

function parseAuraGrantFromText(text) {
  const s = String(text || "");
  if (!/友方|友軍/.test(s)) return null;
  if (!/獲得能力|获得能力/.test(s)) return null;
  if (/隨機|随机/.test(s) && /名友方.*士兵/.test(s)) return null;

  const m = s.match(/((?:周[围圍]一格内|周[围圍]一格內)?(?:所有)?友(?:方|軍)(?:所有)?(?:其他)?[^：:。；;\n]{0,30}士兵[^：:。；;\n]{0,30}(?:獲得能力|获得能力))\s*[:：\-]?\s*(.+)$/);
  if (!m) return null;

  const targetText = safeStr(m[1]);
  const grantedText = safeStr(m[2]);
  if (!grantedText) return null;

  const includeSelf = /友方所有士兵|所有友方士兵/.test(targetText) && !/其他/.test(targetText);
  const adjacentOnly = /周[围圍]一格/.test(targetText);

  return {
    targetText,
    grantedText,
    includeSelf,
    adjacentOnly,
    raceIds: parseRaceIdsFromText(targetText)
  };
}

function parseAuraDamageBonusFromText(text) {
  const s = String(text || "");
  if (!/(友方|友軍|己方)/.test(s)) return null;
  if (!/(所有.*士兵|全場|全体|全體)/.test(s)) return null;
  if (!/傷害|伤害/.test(s)) return null;

  const plus = s.match(/傷害\s*\+\s*(\d+)|伤害\s*\+\s*(\d+)/);
  const value = Number(plus?.[1] || plus?.[2] || 0);
  if (!Number.isFinite(value) || value <= 0) return null;

  let damageType = "";
  if (/雷|閃電|闪电|雷擊|雷击/.test(s)) damageType = "lightning";
  else if (/火|燃燒|燃烧/.test(s)) damageType = "fire";
  else if (/冰|寒霜|冰凍|冰冻/.test(s)) damageType = "ice";
  else if (/聖光|圣光|神聖|神圣/.test(s)) damageType = "holy";
  else if (/暗影|黑暗|詛咒|诅咒/.test(s)) damageType = "shadow";
  else if (/毒|中毒/.test(s)) damageType = "poison";
  else if (/物理|普攻|近戰|近战|遠程|远程/.test(s)) damageType = "physical";
  if (!damageType) return null;

  return {
    damageType,
    value,
    includeSelf: /(及自身|和自身|與自身|含自身|包含自身|友方所有士兵及自身)/.test(s)
  };
}

function parseStepDamageRuleFromText(text) {
  const s = String(text || "");
  if (!/每回合/.test(s)) return null;
  if (!/傷害|伤害/.test(s)) return null;

  const dmgMatch = s.match(/造成\s*(\d+)\s*點?.*(?:傷害|伤害)|(\d+)\s*點?.*(?:傷害|伤害)/);
  const damage = Number(dmgMatch?.[1] || dmgMatch?.[2] || 0);
  if (!Number.isFinite(damage) || damage <= 0) return null;

  let damageType = "physical";
  if (/雷|閃電|闪电|雷擊|雷击|落雷/.test(s)) damageType = "lightning";
  else if (/火|燃燒|燃烧|灼/.test(s)) damageType = "fire";
  else if (/冰|寒霜|冰凍|冰冻/.test(s)) damageType = "ice";
  else if (/聖光|圣光|神聖|神圣/.test(s)) damageType = "holy";
  else if (/暗影|黑暗|詛咒|诅咒|怨念|咒怨/.test(s)) damageType = "shadow";
  else if (/毒|中毒/.test(s)) damageType = "poison";

  const canHitHero = /(士兵或英雄|士兵和英雄|士兵及英雄|單位或英雄|单位或英雄|敌方英雄|敵方英雄)/.test(s);
  const targetAllEnemyUnits = /(所有敵方士兵|所有敌方士兵|敵方全場|敌方全场|敵方全體|敌方全体)/.test(s);
  const randomCountMatch = s.match(/隨機\s*([零〇一二兩两三四五六七八九十\d]+)\s*名|随机\s*([零〇一二兩两三四五六七八九十\d]+)\s*名/);
  const randomCount = Math.max(1, parseLooseIntToken(randomCountMatch?.[1] || randomCountMatch?.[2], 1));

  return {
    damage,
    damageType,
    mode: targetAllEnemyUnits ? "all_enemy_units" : "random_enemy",
    canHitHero,
    randomCount
  };
}

function parseOnSummonDamageFromText(text) {
  const s = String(text || "");
  if (!/(進場|进场|登場|登场|召喚時|召唤时|出场时|出場時)/.test(s)) return null;
  if (!/敵方|敌方/.test(s)) return null;
  if (!/((所有)?敵方.*士兵|(所有)?敌方.*士兵|敵方全場|敌方全场|敵方全體|敌方全体)/.test(s)) return null;
  if (!/傷害|伤害/.test(s)) return null;

  const dmgMatch = s.match(/造成\s*(\d+)\s*點?(?:雷|閃電|闪电|火|冰|暗|聖光|圣光)?(?:傷害|伤害)|(\d+)\s*點?(?:雷|閃電|闪电|火|冰|暗|聖光|圣光)?(?:傷害|伤害)/);
  const damage = Number(dmgMatch?.[1] || dmgMatch?.[2] || 0);
  if (!Number.isFinite(damage) || damage <= 0) return null;

  let damageType = "physical";
  if (/雷|閃電|闪电|雷擊|雷击/.test(s)) damageType = "lightning";
  else if (/火|燃燒|燃烧/.test(s)) damageType = "fire";
  else if (/冰|寒霜|冰凍|冰冻/.test(s)) damageType = "ice";
  else if (/聖光|圣光|神聖|神圣/.test(s)) damageType = "holy";
  else if (/暗影|黑暗|詛咒|诅咒/.test(s)) damageType = "shadow";
  else if (/毒|中毒/.test(s)) damageType = "poison";

  return {
    target: "enemy_all_units",
    damage,
    damageType,
    raceIds: parseRaceIdsFromText(s)
  };
}

function parseDurationStepsFromText(text, fallback = 1) {
  const s = String(text || "");
  const m = s.match(/持續\s*([零〇一二兩两三四五六七八九十\d]+)\s*回合|持续\s*([零〇一二兩两三四五六七八九十\d]+)\s*回合/);
  if (!m) return Math.max(1, fallback);
  return Math.max(1, parseLooseIntToken(m[1] || m[2], fallback));
}

function parseOnSummonHealFromText(text) {
  const s = String(text || "");
  if (!/(進場|进场|登場|登场|召喚時|召唤时|出场时|出場時)/.test(s)) return null;
  if (!/(所有友方士兵|所有己方士兵|友方全場|友方全体|友方全體|我方所有士兵|我方全場)/.test(s)) return null;
  if (!/(治療|治疗|恢復|恢复)/.test(s)) return null;

  const m = s.match(/(?:治療|治疗|恢復|恢复)\s*(\d+)\s*點|(\d+)\s*點(?:治療|治疗|恢復|恢复)/);
  const amount = Number(m?.[1] || m?.[2] || 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { target: "ally_all_units", amount };
}

function parseOnSummonControlFromText(text) {
  const s = String(text || "");
  if (!/(進場|进场|登場|登场|召喚時|召唤时|出场时|出場時)/.test(s)) return [];
  if (!/敵方|敌方/.test(s)) return [];
  if (!/(所有敵方士兵|所有敌方士兵|敵方全場|敌方全场|敵方全體|敌方全体)/.test(s)) return [];

  const steps = parseDurationStepsFromText(s, 1);
  const out = [];
  if (/(無法移動|无法移动|不能移動|不能移动|禁止移動|禁止移动)/.test(s)) {
    out.push({ target: "enemy_all_units", effect: "no_move", steps });
  }
  if (/(無法行动|无法行动|無法行動|无法行动|不能行动|不能行動|眩晕|暈眩|擊暈|击晕)/.test(s)) {
    out.push({ target: "enemy_all_units", effect: "no_action", steps });
  }
  if (/(無法攻擊|无法攻击|不能攻擊|不能攻击)/.test(s)) {
    out.push({ target: "enemy_all_units", effect: "no_attack", steps });
  }
  if (/(被魅惑|魅惑)/.test(s)) {
    out.push({ target: "enemy_all_units", effect: "charm", steps });
  }
  if (/(失去.*基础能力|失去.*基礎能力|失去所有基础能力|失去所有基礎能力)/.test(s)) {
    out.push({ target: "enemy_all_units", effect: "silence", steps });
  }
  return out;
}

function parseOnSummonReadyRuleFromText(text) {
  const s = String(text || "");
  if (!/(進場|进场|登場|登场|召喚時|召唤时|出场时|出場時)/.test(s)) return null;

  const drawToReady = s.match(/抽取\s*([零〇一二兩两三四五六七八九十\d]+)\s*張?.*置于自己的準備栏|抽取\s*([零〇一二兩两三四五六七八九十\d]+)\s*張?.*置于自己的準備欄|抽取\s*([零〇一二兩两三四五六七八九十\d]+)\s*張?.*置于自己的准备栏|從自己的牌庫抽取\s*([零〇一二兩两三四五六七八九十\d]+)\s*張?.*準備栏|從自己的牌庫抽取\s*([零〇一二兩两三四五六七八九十\d]+)\s*張?.*準備欄/);
  if (drawToReady) {
    const count = parseLooseIntToken(drawToReady[1] || drawToReady[2] || drawToReady[3] || drawToReady[4] || drawToReady[5], 1);
    const chanceMatch = s.match(/(\d+)\s*%/);
    const chance = chanceMatch ? Math.max(0, Math.min(1, Number(chanceMatch[1] || 100) / 100)) : 1;
    return {
      type: "draw_ready",
      count: Math.max(1, count),
      chance
    };
  }

  const readyDelta = s.match(/準備值\s*-\s*([零〇一二兩两三四五六七八九十\d]+)|准备值\s*-\s*([零〇一二兩两三四五六七八九十\d]+)/);
  if (readyDelta && /(召喚者|召唤者|自身|自己)/.test(s) && /(所有卡牌|所有技能卡牌|所有士兵卡牌|準備栏中所有|準備欄中所有|准备栏中所有)/.test(s)) {
    return {
      type: "ready_delta_all",
      target: "ally",
      delta: -Math.max(1, parseLooseIntToken(readyDelta[1] || readyDelta[2], 1))
    };
  }

  return null;
}

function parseOnSummonSelfLockFromText(text) {
  const s = String(text || "");
  if (!/(進場後第一回合|进场后第一回合|進場後首回合|进场后首回合|進場時|进场时)/.test(s)) return [];
  const steps = 1;
  const out = [];
  if (/(無法移動|无法移动|不能移動|不能移动|禁止移動|禁止移动)/.test(s)) {
    out.push({ effect: "no_move", steps });
  }
  if (/(無法行动|无法行动|無法行動|不能行动|不能行動|眩晕|暈眩|擊暈|击晕)/.test(s)) {
    out.push({ effect: "no_action", steps });
  }
  if (/(無法攻擊|无法攻击|不能攻擊|不能攻击)/.test(s)) {
    out.push({ effect: "no_attack", steps });
  }
  return out;
}

function parseOnEnemySummonedDamageFromText(text) {
  const s = String(text || "");
  if (!/(被敵方英雄召喚進場|被敌方英雄召唤进场|敵方英雄召喚進場|敌方英雄召唤进场)/.test(s)) return null;
  if (!/(造成.*傷害|造成.*伤害|點.*傷害|点.*伤害|每回合.*受到)/.test(s)) return null;

  const m = s.match(/(?:每回合\s*受[到受]\s*|造成\s*)(\d+)\s*點?.*(?:傷害|伤害)|(\d+)\s*點?.*(?:傷害|伤害)/);
  const damage = Number(m?.[1] || m?.[2] || 0);
  if (!Number.isFinite(damage) || damage <= 0) return null;

  let damageType = "physical";
  if (/雷|閃電|闪电|雷擊|雷击/.test(s)) damageType = "lightning";
  else if (/火|燃燒|燃烧/.test(s)) damageType = "fire";
  else if (/冰|寒霜|冰凍|冰冻/.test(s)) damageType = "ice";
  else if (/聖光|圣光|神聖|神圣/.test(s)) damageType = "holy";
  else if (/暗影|黑暗|詛咒|诅咒/.test(s)) damageType = "shadow";
  else if (/毒|中毒/.test(s)) damageType = "poison";

  const isDot = /每回合/.test(s);
  return {
    damage,
    damageType,
    isDot,
    steps: parseDurationStepsFromText(s, isDot ? 1 : 0),
    alsoSelfDamage: /(對自己也造成|对自己也造成)/.test(s),
    raceIds: parseRaceIdsFromText(s)
  };
}

function parseOnSummonedGrantRuleFromText(text) {
  const s = String(text || "");
  const m = s.match(/(?:令|使)(己方|友方|敵方|敌方).*召[喚唤]進場的士兵獲得([^，。,.]+)/);
  if (!m) return null;
  const targetSide = /敵方|敌方/.test(m[1]) ? "enemy_summoned" : "ally_summoned";
  const grantedText = String(m[2] || "").trim();
  if (!grantedText) return null;
  return {
    targetSide,
    grantedText,
    steps: parseDurationStepsFromText(s, 3),
    raceIds: parseRaceIdsFromText(s)
  };
}

function parseAuraNoHealRuleFromText(text) {
  const s = String(text || "");
  if (!/光環|光环/.test(s)) return null;
  if (!/無法被治療|无法被治疗/.test(s)) return null;
  const enemy = /敵方|敌方/.test(s);
  const ally = /友方|己方|我方/.test(s);
  const target = enemy ? "enemy" : (ally ? "ally" : "enemy");
  return {
    target,
    raceIds: parseRaceIdsFromText(s),
    includeHero: /英雄/.test(s)
  };
}

function parseOnStepSelfBuffFromText(text) {
  const s = String(text || "");
  if (!/(行动時|行動時|行动时|行動时)/.test(s)) return null;
  const hasAllyAll = /(所有友方士兵|所有己方士兵|友方全場|友方全体|友方全體|我方所有士兵|我方全場)/.test(s);
  const hasSelfHint = /(自身|自己|召喚者|召唤者)/.test(s);
  if (hasAllyAll && !hasSelfHint) return null;

  const atkMatch = s.match(/攻擊力?\s*\+\s*([零〇一二兩两三四五六七八九十\d]+)|攻击力?\s*\+\s*([零〇一二兩两三四五六七八九十\d]+)|ATK\s*\+\s*(\d+)/i);
  const hpMatch = s.match(/生命值?\s*\+\s*([零〇一二兩两三四五六七八九十\d]+)|生命\s*\+\s*([零〇一二兩两三四五六七八九十\d]+)|HP\s*\+\s*(\d+)/i);

  const atk = Math.max(0, parseLooseIntToken(atkMatch?.[1] || atkMatch?.[2] || atkMatch?.[3], 0));
  const hp = Math.max(0, parseLooseIntToken(hpMatch?.[1] || hpMatch?.[2] || hpMatch?.[3], 0));
  if (atk <= 0 && hp <= 0) return null;

  return { atk, hp };
}

function parseDamageTypeFromText(text) {
  const s = String(text || "");
  if (/雷|閃電|闪电|雷擊|雷击|落雷/.test(s)) return "lightning";
  if (/火|燃燒|燃烧|灼/.test(s)) return "fire";
  if (/冰|寒霜|冰凍|冰冻/.test(s)) return "ice";
  if (/聖光|圣光|神聖|神圣/.test(s)) return "holy";
  if (/暗影|黑暗|詛咒|诅咒|怨念|咒怨/.test(s)) return "shadow";
  if (/毒|中毒/.test(s)) return "poison";
  return "physical";
}

function parseSkillReturnToHandChanceFromText(text) {
  const s = String(text || "");
  if (!/(回手率|回到手牌|返回手牌|回手|回手牌|精通)/.test(s)) return 0;

  const pct = s.match(/(\d+)\s*%/);
  if (pct) {
    const v = Number(pct[1] || 0);
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.max(0, Math.min(1, v / 100));
  }

  const near = s.match(/(?:回手率|回到手牌|返回手牌|回手|回手牌|精通)[^\d]{0,8}([零〇一二兩两三四五六七八九十\d]+)/);
  const n = parseLooseIntToken(near?.[1], 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.min(1, n / 100));
}

function parseOnActionEnemyAoeFromText(text) {
  const s = String(text || "");
  if (!/(行动時|行動時|行动时|行動时)/.test(s)) return null;
  if (!/(所有敵方士兵|所有敌方士兵|敵方全場|敌方全场|敵方全體|敌方全体)/.test(s)) return null;
  if (!/傷害|伤害/.test(s)) return null;
  const rangeMatch = s.match(/(\d+)\s*[-~～到至]\s*(\d+)\s*點?.*(?:傷害|伤害)/);
  if (rangeMatch) {
    const lo = Math.max(1, Number(rangeMatch[1] || 1));
    const hi = Math.max(lo, Number(rangeMatch[2] || lo));
    return {
      minDamage: lo,
      maxDamage: hi,
      damageType: parseDamageTypeFromText(s),
      canHitHero: /(士兵或英雄|士兵和英雄|士兵及英雄|單位或英雄|单位或英雄|敌方英雄|敵方英雄)/.test(s)
    };
  }
  const m = s.match(/造成\s*(\d+)\s*點?.*(?:傷害|伤害)|(\d+)\s*點?.*(?:傷害|伤害)/);
  const damage = Number(m?.[1] || m?.[2] || 0);
  if (!Number.isFinite(damage) || damage <= 0) return null;
  return { damage, damageType: parseDamageTypeFromText(s), canHitHero: /(士兵或英雄|士兵和英雄|士兵及英雄|單位或英雄|单位或英雄|敌方英雄|敵方英雄)/.test(s) };
}

function parseOnActionAllyTeamBuffFromText(text) {
  const s = String(text || "");
  if (!/(行动時|行動時|行动时|行動时)/.test(s)) return null;
  if (!/(所有友方士兵|所有己方士兵|友方全場|友方全体|友方全體|我方所有士兵|我方全場)/.test(s)) return null;
  const atkMatch = s.match(/攻擊力?\s*\+\s*([零〇一二兩两三四五六七八九十\d]+)|攻击力?\s*\+\s*([零〇一二兩两三四五六七八九十\d]+)|ATK\s*\+\s*(\d+)/i);
  const hpMatch = s.match(/生命值?\s*\+\s*([零〇一二兩两三四五六七八九十\d]+)|生命\s*\+\s*([零〇一二兩两三四五六七八九十\d]+)|HP\s*\+\s*(\d+)/i);
  const atk = Math.max(0, parseLooseIntToken(atkMatch?.[1] || atkMatch?.[2] || atkMatch?.[3], 0));
  const hp = Math.max(0, parseLooseIntToken(hpMatch?.[1] || hpMatch?.[2] || hpMatch?.[3], 0));
  if (atk <= 0 && hp <= 0) return null;
  return { atk, hp };
}

function parseOnActionAllyTeamHealFromText(text) {
  const s = String(text || "");
  if (!/(行动時|行動時|行动时|行動时)/.test(s)) return null;
  if (!/(所有友方士兵|所有己方士兵|友方全場|友方全体|友方全體|我方所有士兵|我方全場)/.test(s)) return null;
  if (!/(治療|治疗|恢復|恢复|回復|回复)/.test(s)) return null;
  const m = s.match(/治療\s*([零〇一二兩两三四五六七八九十\d]+)|治疗\s*([零〇一二兩两三四五六七八九十\d]+)|恢復\s*([零〇一二兩两三四五六七八九十\d]+)|恢复\s*([零〇一二兩两三四五六七八九十\d]+)|回復\s*([零〇一二兩两三四五六七八九十\d]+)|回复\s*([零〇一二兩两三四五六七八九十\d]+)/);
  const heal = Math.max(0, parseLooseIntToken(m?.[1] || m?.[2] || m?.[3] || m?.[4] || m?.[5] || m?.[6], 0));
  if (heal <= 0) return null;
  return { heal };
}

function parseOnActionCleanseRuleFromText(text) {
  const s = String(text || "");
  if (!/(行动時|行動時|行动时|行動时)/.test(s)) return null;
  if (!/(清除|移除|净化|淨化|驅散|驱散).*(減益|减益|负面|負面|狀態|状态)/.test(s)) return null;
  const allAllies = /(所有友方士兵|所有己方士兵|友方全場|友方全体|友方全體|我方所有士兵|我方全場)/.test(s);
  return { allAllies };
}

function parseOnActionEnemyDispelRuleFromText(text) {
  const s = String(text || "");
  if (!/(行动時|行動時|行动时|行動时)/.test(s)) return null;
  if (!/(驅散|驱散|移除|清除).*(增益|正面|buff|狀態|状态)/i.test(s)) return null;
  const allEnemies = /(所有敵方士兵|所有敌方士兵|敵方全場|敌方全场|敵方全體|敌方全体)/.test(s);
  return { allEnemies };
}

function parseFirstActionRuleFromText(text) {
  const s = String(text || "");
  if (!/(首次行动時|首次行動時|第一次行动時|第一次行動時|首回行动時|首回行動時)/.test(s)) return null;

  const aoe = parseOnActionEnemyAoeFromText(s);
  if (aoe) return { type: "enemy_aoe_damage", ...aoe };

  const allyBuff = parseOnActionAllyTeamBuffFromText(s);
  if (allyBuff) return { type: "ally_team_buff", ...allyBuff };

  const allyHeal = parseOnActionAllyTeamHealFromText(s);
  if (allyHeal) return { type: "ally_team_heal", ...allyHeal };

  if (/(杀死|殺死|秒杀|秒殺).*(飛行|飞行)|所有飛行類士兵|所有飞行类士兵/.test(s)) {
    return { type: "kill_all_flying_enemies" };
  }

  return null;
}

function parseOnActionStatusTransferRuleFromText(text) {
  const s = String(text || "");
  if (!/(行动時|行動時|行动时|行動时)/.test(s)) return null;
  if (!/轉移|转移/.test(s)) return null;
  if (!/友方.*減益|友方.*减益|敵方.*增益|敌方.*增益/.test(s)) return null;
  return { transferDebuffAllyToEnemy: /友方.*減益|友方.*减益/.test(s), transferBuffEnemyToAlly: /敵方.*增益|敌方.*增益/.test(s) };
}

function parseOnActionTransformRuleFromText(text) {
  const s = String(text || "");
  if (!/(行动時|行動時|行动时|行動时)/.test(s)) return null;
  if (/重组為骷髏|重組為骷髏|重组为骷髅|重組為骷髅/.test(s)) return { type: "to_skeleton" };
  if (/逆位空白/.test(s) && /隨機成為|随机成为|隨機變成|随机变成/.test(s)) {
    return {
      type: "to_random_reverse_tarot",
      sameQuality: /逆天品质|逆天品質|同品質|同品质|相同品質|相同品质/.test(s)
    };
  }
  return null;
}

function parseReadyValueRuleFromText(text) {
  const s = String(text || "");
  if (!/每回合/.test(s)) return null;
  if (!/準備值|准备值/.test(s)) return null;

  const chanceMatch = s.match(/(\d+)\s*%/);
  const chance = chanceMatch ? Math.max(0, Math.min(1, Number(chanceMatch[1] || 100) / 100)) : 1;

  const hasAllyHint = /召喚者|召唤者|自身|自己|手上/.test(s);
  const hasEnemyHint = /敵方英雄|敌方英雄/.test(s);
  const filter = /技能卡牌/.test(s) ? "skill" : (/士兵卡牌/.test(s) ? "summon" : "all");

  const allyTop = s.match(/每回合.*(?:召喚者|召唤者|自身|自己|手上).*(?:準備值|准备值)最高的\s*([零〇一二兩两三四五六七八九十\d]+)?\s*張?.*(?:準備值|准备值)\s*-\s*([零〇一二兩两三四五六七八九十\d]+)/);
  if (allyTop && hasAllyHint) {
    return {
      target: "ally",
      mode: "top",
      count: Math.max(1, parseLooseIntToken(allyTop[1], 1)),
      delta: -Math.max(1, parseLooseIntToken(allyTop[2], 1)),
      chance,
      filter
    };
  }

  const allyTopAlt = s.match(/每回合.*减少.*(?:手上|準備栏|準備欄|准备栏).*(?:準備值|准备值)最高的\s*([零〇一二兩两三四五六七八九十\d]+)?\s*張?.*?([零〇一二兩两三四五六七八九十\d]+)\s*(?:準備值|准备值)/);
  if (allyTopAlt && hasAllyHint) {
    return {
      target: "ally",
      mode: "top",
      count: Math.max(1, parseLooseIntToken(allyTopAlt[1], 1)),
      delta: -Math.max(1, parseLooseIntToken(allyTopAlt[2], 1)),
      chance,
      filter
    };
  }

  const allyTopSetZero = s.match(/每回合.*(?:召喚者|召唤者|自身|自己|手上).*(?:準備值|准备值)最高的\s*([零〇一二兩两三四五六七八九十\d]+)?\s*張?.*(?:準備值|准备值)\s*(?:为|為|=)\s*0/);
  if (allyTopSetZero && hasAllyHint) {
    return {
      target: "ally",
      mode: "top",
      count: Math.max(1, parseLooseIntToken(allyTopSetZero[1], 1)),
      setTo: 0,
      chance,
      filter
    };
  }

  const allyAll = s.match(/每回合.*(?:召喚者|召唤者|自身|自己).*(?:所有卡牌|所有技能卡牌|所有士兵卡牌).*(?:準備值|准备值)\s*-\s*([零〇一二兩两三四五六七八九十\d]+)/);
  if (allyAll && hasAllyHint) {
    return {
      target: "ally",
      mode: "all",
      count: 99,
      delta: -Math.max(1, parseLooseIntToken(allyAll[1], 1)),
      chance,
      filter
    };
  }

  const enemyRandom = s.match(/每回合.*(?:令|使|让|讓).*(?:敵方英雄|敌方英雄).*(?:隨機|随机)的?\s*([零〇一二兩两三四五六七八九十\d]+)?\s*張?.*(?:準備值|准备值)\s*\+\s*([零〇一二兩两三四五六七八九十\d]+)/);
  if (enemyRandom && hasEnemyHint) {
    return {
      target: "enemy",
      mode: "random",
      count: Math.max(1, parseLooseIntToken(enemyRandom[1], 1)),
      delta: Math.max(1, parseLooseIntToken(enemyRandom[2], 1)),
      chance,
      filter
    };
  }

  const enemyAll = s.match(/每回合.*(?:令|使|让|讓).*(?:敵方英雄|敌方英雄).*(?:所有卡牌|所有技能卡牌|所有士兵卡牌).*(?:準備值|准备值)\s*\+\s*([零〇一二兩两三四五六七八九十\d]+)/);
  if (enemyAll && hasEnemyHint) {
    return {
      target: "enemy",
      mode: "all",
      count: 99,
      delta: Math.max(1, parseLooseIntToken(enemyAll[1], 1)),
      chance,
      filter
    };
  }

  return null;
}

function readUserEffectRuleMap() {
  try {
    if (!globalThis?.localStorage) return {};
    const raw = globalThis.localStorage.getItem(EFFECT_RULE_OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function tokenizeEffects(card) {
  const raw = [
    safeStr(card?.ability1),
    safeStr(card?.ability2),
    safeStr(card?.ability3),
    safeStr(card?.ability4),
    safeStr(card?.ability5),
    ...(Array.isArray(card?.abilities) ? card.abilities.map((x) => safeStr(x)) : [])
  ].filter((x) => x);

  const seen = new Set();
  const out = [];

  for (let i = 0; i < raw.length; i += 1) {
    const src = raw[i];
    if (seen.has(src)) continue;
    seen.add(src);

    const parts = src.split(/[・・]/);
    const key = safeStr(parts[0]);
    const detail = safeStr(parts.slice(1).join("・"));
    const value = pickTrailingNumber(key, parsePlusNumber(src, 1));
    out.push({ src, key, detail, value });
  }

  return out.slice(0, 5);
}

function createRuntime() {
  return {
    atkFlat: 0,
    maxHpFlat: 0,
    rangeCells: 1,
    speedSteps: 1,
    passThroughEnemy: false,
    attackPerStep: 1,
    splashBehind: false,
    lifestealPct: 0,
    critChance: 0,
    critMul: 1.5,
    ignoreDefPct: 0,
    blockChance: 0,
    dodgeChance: 0,
    dmgReducePct: 0,
    reflectPct: 0,
    onAttackGainAtk: 0,
    onStepDamage: 0,
    stepDamageRules: [],
    onStepHeal: 0,
    onStepDraw: 0,
    onHitStunChance: 0,
    onHitStunSteps: 1,
    onHitSlowChance: 0,
    onHitSlowSteps: 1,
    onHitSlowAtkDown: 0,
    noMove: false,
    cantActChanceOnDamaged: 0,
    cantActStepsOnDamaged: 1,
    poisonDamage: 0,
    poisonSteps: 0,
    burnDamage: 0,
    burnSteps: 0,
    heroGuard: 0,
    knockbackOnHit: 0,
    transformOnAllyDeath: false,
    auraEnemyTransformCow: false,
    summonPerTurn: 0,
    summonHp: 1,
    summonAtk: 1,
    summonName: "召喚物",
    summonAbilities: [],
    summonMaxAlive: 0,
    reviveChance: 0,
    allyCountBuffs: [],
    auraGrantRules: [],
    auraDamageBonusRules: [],
    auraNoHealRules: [],
    damageTypeBonus: {
      physical: 0,
      fire: 0,
      ice: 0,
      lightning: 0,
      holy: 0,
      shadow: 0,
      poison: 0
    },
    onSummonDamageRules: [],
    onSummonHealRules: [],
    onSummonControlRules: [],
    onSummonReadyRules: [],
    onSummonSelfLockRules: [],
    onEnemySummonedDamageRules: [],
    onSummonedGrantRules: [],
    onStepSelfBuffRules: [],
    onActionEnemyAoeRules: [],
    onActionAllyTeamBuffRules: [],
    onActionAllyTeamHealRules: [],
    onActionStatusTransferRules: [],
    onActionTransformRules: [],
    onActionCleanseRules: [],
    onActionEnemyDispelRules: [],
    firstActionRules: [],
    readyValueRules: []
  };
}

function inferTagsFromText(text) {
  const tags = [];
  const t = String(text || "");

  if (/攻击时|攻擊時|攻击后|攻擊後/.test(t) && /攻击\+|攻擊\+|ATK\+|atk\+/i.test(t)) tags.push("on_attack_gain_atk");
  if (/每回合.*伤害|每回合.*傷害|落雷|雷击|雷擊/.test(t)) tags.push("step_damage");
  if (/每回合.*治疗|每回合.*治療|恢复|恢復/.test(t)) tags.push("step_heal");
  if (/每回合.*抽取.*准备栏|每回合.*抽取.*準備栏|每回合.*抽取.*準備欄|每回合.*牌库.*准备栏|每回合.*牌庫.*準備欄/.test(t)) tags.push("step_draw");

  if (/攻击|攻擊|ATK|atk/i.test(t)) tags.push("atk_up");
  if (/生命|HP|防御|防禦|护甲|護甲|重甲/.test(t)) tags.push("hp_up");
  if (/射程|range/i.test(t)) tags.push("range_up");
  if (/(不能移動|不能移动|無法移動|无法移动|禁止移動|禁止移动)/.test(t)) tags.push("no_move");
  if (!/(不能移動|不能移动|無法移動|无法移动|禁止移動|禁止移动)/.test(t) && /速度|疾风步|疾風步|瞬移|闪现|閃現|移动|移動/.test(t)) tags.push("speed_up");
  if (/吸血|生命偷取/.test(t)) tags.push("lifesteal");
  if (/反射|反伤|反傷/.test(t)) tags.push("reflect");
  if (/破甲|无视防御|無視防禦/.test(t)) tags.push("armor_break");
  if (/闪避|閃避/.test(t)) tags.push("dodge");
  if (/格挡|格擋|招架/.test(t)) tags.push("block");
  if (/眩晕|暈眩|击晕|擊暈|无法行动|無法行動/.test(t)) tags.push("stun");
  if (/减速|減速|缓慢|緩慢/.test(t)) tags.push("slow");
  if (/中毒|毒刃|毒箭|剧毒|劇毒|巫毒|毒/.test(t)) tags.push("poison");
  if (/火焰|燃烧|燃燒|灼烧|灼燒|热风|熱風|火弹|火彈/.test(t)) tags.push("burn");
  if (/击退|擊退|后退|後退/.test(t)) tags.push("hot_wind_knockback");
  if (/飞溅|飛濺|溅射|濺射|2x1|2\*1/.test(t)) tags.push("splash");
  if (/受伤|受傷|被攻击|被攻擊/.test(t) && /无法行动|無法行動|眩晕|暈眩/.test(t)) tags.push("on_damaged_stun");
  if (/婚约|婚約|守护|守護|舍身/.test(t)) tags.push("hero_guard");
  if (/秘剑术|秘劍術|飞剑|飛劍/.test(t) && /友方士兵死亡|友軍.*死亡|转化|轉化/.test(t)) tags.push("ally_death_transform_flying_sword");
  if (/崇拜光环|崇拜光環/.test(t) && /转化|轉化/.test(t) && /乳牛|牛/.test(t)) tags.push("aura_enemy_transform_cow");
  if (/每回合.*召唤|每回合.*召喚|召唤.*最多|召喚.*最多/.test(t)) tags.push("summon_token");
  if (/死亡后.*复活|死亡後.*復活|重生|复活一次|復活一次/.test(t)) tags.push("revive_once");

  return [...new Set(tags)];
}

const EFFECT_RULE_OVERRIDES = {
  落雷4: { tags: ["step_damage"], valueHint: 4 },
  落雷3: { tags: ["step_damage"], valueHint: 3 },
  治疗5: { tags: ["step_heal"], valueHint: 5 },
  治疗4: { tags: ["step_heal"], valueHint: 4 },
  治疗3: { tags: ["step_heal"], valueHint: 3 },
  治疗2: { tags: ["step_heal"], valueHint: 2 },
  治疗1: { tags: ["step_heal"], valueHint: 1 },
  管理光环: { tags: ["step_draw"], valueHint: 1 },
  管理光環: { tags: ["step_draw"], valueHint: 1 },
  婚约2: { tags: ["hero_guard"], valueHint: 2 },
  婚約2: { tags: ["hero_guard"], valueHint: 2 }
};

function buildEffectCatalogFromData() {
  const map = new Map();
  const cards = Array.isArray(flameCardsBest)
    ? flameCardsBest
    : (Array.isArray(flameCardsBest?.cards) ? flameCardsBest.cards : []);

  for (let i = 0; i < cards.length; i += 1) {
    const c = cards[i];
    const arr = [
      safeStr(c?.ability1),
      safeStr(c?.ability2),
      safeStr(c?.ability3),
      safeStr(c?.ability4),
      safeStr(c?.ability5),
      ...(Array.isArray(c?.abilities) ? c.abilities.map((x) => safeStr(x)) : [])
    ].filter((x) => x);

    for (let j = 0; j < arr.length; j += 1) {
      const src = arr[j];
      const key = safeStr(src.split(/[・・]/)[0]);
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, { key, samples: [], tags: [], valueHint: pickTrailingNumber(key, 1) });
      }
      const rec = map.get(key);
      if (rec.samples.length < 5) rec.samples.push(src);
    }
  }

  const excelRules = effectRulesFromExcel?.rules && typeof effectRulesFromExcel.rules === "object"
    ? effectRulesFromExcel.rules
    : {};
  const excelKeys = Object.keys(excelRules);
  for (let i = 0; i < excelKeys.length; i += 1) {
    const key = safeStr(excelKeys[i]);
    if (!key) continue;
    const rec = excelRules[key] || {};
    const tags = Array.isArray(rec.tags)
      ? rec.tags.map((x) => safeStr(x)).filter((x) => x)
      : [];
    const samples = Array.isArray(rec.samples)
      ? rec.samples.map((x) => safeStr(x)).filter((x) => x)
      : [];
    const valueHint = Math.max(1, Number(rec.valueHint || 1));

    if (!map.has(key)) {
      map.set(key, { key, samples: samples.slice(0, 5), tags: tags.slice(0, 8), valueHint });
      continue;
    }

    const prev = map.get(key);
    const mergedTags = [...new Set([...(prev.tags || []), ...tags])];
    const mergedSamples = [...new Set([...(prev.samples || []), ...samples])];
    prev.tags = mergedTags.slice(0, 8);
    prev.samples = mergedSamples.slice(0, 5);
    prev.valueHint = Math.max(Number(prev.valueHint || 1), valueHint);
  }

  for (const [key, rec] of map.entries()) {
    const override = EFFECT_RULE_OVERRIDES[key];
    if (override) {
      rec.tags = [...override.tags];
      rec.valueHint = Number(override.valueHint || rec.valueHint || 1);
      continue;
    }

    const mergedText = `${key} ${rec.samples.join(" ")}`;
    const tags = inferTagsFromText(mergedText);
    rec.tags = tags.length > 0 ? tags : ["fallback"];
    rec.valueHint = pickTrailingNumber(mergedText, rec.valueHint || 1);
  }

  return map;
}

const EFFECT_CATALOG = buildEffectCatalogFromData();
const ABILITY_PROGRAM_RULES = abilityProgramLibrary?.rules && typeof abilityProgramLibrary.rules === "object"
  ? abilityProgramLibrary.rules
  : {};

function resolveEffectRule(token, cardRuleMap = null) {
  if (!token?.key) return { key: "", tags: ["fallback"], valueHint: 1 };

  if (cardRuleMap && typeof cardRuleMap === "object") {
    const direct = cardRuleMap[token.key];
    if (direct && Array.isArray(direct.tags) && direct.tags.length > 0) {
      return {
        key: token.key,
        tags: [...new Set(direct.tags.map((x) => String(x || "").trim()).filter((x) => x))],
        valueHint: Math.max(1, Number(direct.valueHint || token.value || 1))
      };
    }
  }

  const programRule = ABILITY_PROGRAM_RULES[token.key];
  if (programRule && Array.isArray(programRule.tags) && programRule.tags.length > 0) {
    return {
      key: token.key,
      tags: [...new Set(programRule.tags.map((x) => String(x || "").trim()).filter((x) => x))],
      valueHint: Math.max(1, Number(programRule.valueHint || token.value || 1))
    };
  }

  const userMap = readUserEffectRuleMap();
  const userRule = userMap?.[token.key];
  if (userRule && Array.isArray(userRule.tags) && userRule.tags.length > 0) {
    return {
      key: token.key,
      tags: [...new Set(userRule.tags.map((x) => String(x || "").trim()).filter((x) => x))],
      valueHint: Math.max(1, Number(userRule.valueHint || token.value || 1))
    };
  }

  const hit = EFFECT_CATALOG.get(token.key);
  if (hit) return hit;

  const mergedText = `${token.key} ${token.src || ""}`;
  const tags = inferTagsFromText(mergedText);
  return {
    key: token.key,
    tags: tags.length > 0 ? tags : ["fallback"],
    valueHint: pickTrailingNumber(mergedText, 1)
  };
}

function applyRule(runtime, rule, value) {
  const v = Math.max(1, Number(value || rule.valueHint || 1));

  for (let i = 0; i < rule.tags.length; i += 1) {
    const tag = rule.tags[i];

    switch (tag) {
      case "step_damage":
        runtime.onStepDamage += v;
        break;
      case "step_heal":
        runtime.onStepHeal += v;
        break;
      case "step_draw":
        runtime.onStepDraw += Math.max(1, v);
        break;
      case "atk_up":
        runtime.atkFlat += Math.max(1, Math.ceil(v / 2));
        break;
      case "hp_up":
        runtime.maxHpFlat += v * 2;
        runtime.dmgReducePct += 0.03 * v;
        break;
      case "range_up":
        runtime.rangeCells += Math.max(1, Math.floor(v / 2));
        break;
      case "speed_up":
        runtime.speedSteps += Math.min(2, Math.max(1, Math.floor(v / 3)));
        break;
      case "no_move":
        runtime.noMove = true;
        break;
      case "lifesteal":
        runtime.lifestealPct += 0.06 * v;
        break;
      case "reflect":
        runtime.reflectPct += 0.07 * v;
        break;
      case "armor_break":
        runtime.ignoreDefPct += 0.08 * v;
        break;
      case "dodge":
        runtime.dodgeChance += 0.06 * v;
        break;
      case "block":
        runtime.blockChance += 0.05 * v;
        break;
      case "stun":
        runtime.onHitStunChance += 0.05 * v;
        runtime.onHitStunSteps = Math.max(runtime.onHitStunSteps, 1);
        break;
      case "slow":
        runtime.onHitSlowChance += 0.08 * v;
        runtime.onHitSlowSteps = Math.max(runtime.onHitSlowSteps, 1);
        runtime.onHitSlowAtkDown += Math.max(1, Math.floor(v / 2));
        break;
      case "poison":
        runtime.poisonDamage += Math.max(1, Math.floor(v / 2));
        runtime.poisonSteps = Math.max(runtime.poisonSteps, 2);
        break;
      case "burn":
        runtime.burnDamage += Math.max(1, Math.floor(v / 2));
        runtime.burnSteps = Math.max(runtime.burnSteps, 2);
        break;
      case "splash":
        runtime.splashBehind = true;
        break;
      case "on_attack_gain_atk":
        runtime.onAttackGainAtk += Math.max(1, v);
        break;
      case "on_damaged_stun":
        runtime.cantActChanceOnDamaged = Math.max(runtime.cantActChanceOnDamaged, 0.5);
        runtime.cantActStepsOnDamaged = 1;
        break;
      case "hero_guard":
        runtime.heroGuard = Math.max(runtime.heroGuard, v);
        break;
      case "hot_wind_knockback":
        runtime.knockbackOnHit = Math.max(runtime.knockbackOnHit, 2);
        runtime.burnDamage = Math.max(runtime.burnDamage, 1);
        runtime.burnSteps = Math.max(runtime.burnSteps, 1);
        break;
      case "ally_death_transform_flying_sword":
        runtime.transformOnAllyDeath = true;
        break;
      case "aura_enemy_transform_cow":
        runtime.auraEnemyTransformCow = true;
        break;
      case "summon_token":
        runtime.summonPerTurn = Math.max(runtime.summonPerTurn, Math.max(1, Math.min(3, v)));
        break;
      case "revive_once":
        runtime.reviveChance = Math.max(runtime.reviveChance, 0.5);
        break;
      default:
        runtime.atkFlat += Math.max(1, Math.floor(v / 2));
        runtime.maxHpFlat += Math.max(1, v);
        break;
    }
  }
}

function finalizeRuntime(runtime) {
  runtime.rangeCells = Math.max(1, Math.min(6, Math.floor(runtime.rangeCells)));
  runtime.speedSteps = Math.max(1, Math.min(6, Math.floor(runtime.speedSteps)));
  runtime.attackPerStep = Math.max(1, Math.min(2, Math.floor(runtime.attackPerStep)));
  runtime.dmgReducePct = Math.max(0, Math.min(0.75, runtime.dmgReducePct));
  runtime.ignoreDefPct = Math.max(0, Math.min(0.75, runtime.ignoreDefPct));
  runtime.lifestealPct = Math.max(0, Math.min(0.8, runtime.lifestealPct));
  runtime.reflectPct = Math.max(0, Math.min(0.7, runtime.reflectPct));
  runtime.critChance = Math.max(0, Math.min(0.6, runtime.critChance));
  runtime.blockChance = Math.max(0, Math.min(0.45, runtime.blockChance));
  runtime.dodgeChance = Math.max(0, Math.min(0.45, runtime.dodgeChance));
  runtime.onHitStunChance = Math.max(0, Math.min(0.65, runtime.onHitStunChance));
  runtime.onHitSlowChance = Math.max(0, Math.min(0.75, runtime.onHitSlowChance));
  if (runtime.noMove) runtime.speedSteps = 0;
}

export default class GridCombatSystem {
  constructor(scene, cardSystem, boardUI, rng = Math.random) {
    this.scene = scene;
    this.cardSystem = cardSystem;
    this.boardUI = boardUI;
    this.rng = typeof rng === "function" ? rng : Math.random;
    this.autoAi = true;
    this.autoAiSides = { L: false, R: true };

    this.left = null;
    this.right = null;

    this.turnSide = "L";
    this.turnCount = 0;

    this.board = Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => null)
    );

    this.logs = [];
    this.initialHeroHp = { L: HERO_HP, R: HERO_HP };
  }

  setRng(rng) {
    this.rng = typeof rng === "function" ? rng : Math.random;
  }

  setAutoAi(enabled) {
    this.autoAi = Boolean(enabled);
    if (this.autoAi) {
      this.autoAiSides = { L: true, R: true };
    } else {
      this.autoAiSides = { L: false, R: false };
    }
  }

  setAutoAiForSide(side, enabled) {
    const s = side === "R" ? "R" : "L";
    this.autoAiSides[s] = Boolean(enabled);
  }

  getAutoAiForSide(side) {
    const s = side === "R" ? "R" : "L";
    return Boolean(this.autoAiSides?.[s]);
  }

  setCombatants(leftHero, rightHero) {
    this.left = leftHero;
    this.right = rightHero;
  }

  setInitialHeroHp(leftHp, rightHp) {
    const l = Math.max(1, Number.isFinite(Number(leftHp)) ? Number(leftHp) : HERO_HP);
    const r = Math.max(1, Number.isFinite(Number(rightHp)) ? Number(rightHp) : HERO_HP);
    this.initialHeroHp = { L: l, R: r };
  }

  start() {
    this.left.hp = Math.max(1, Number(this.initialHeroHp?.L || HERO_HP));
    this.right.hp = Math.max(1, Number(this.initialHeroHp?.R || HERO_HP));

    this.cardSystem.shuffle(this.left.deck);
    this.cardSystem.shuffle(this.right.deck);

    this.cardSystem.draw(this.left, START_HAND);
    this.cardSystem.draw(this.right, START_HAND);

    this.turnCount = 1;
    this.turnSide = "L";

    this._log("戰鬥開始");
    this._beginTurn(false);
  }

  trySummonByPlayer(card, row, col) {
    if (this.turnSide !== "L") return { ok: false, reason: "not_your_turn" };
    return this._trySummon(this.left, "L", card, row, col);
  }

  trySummonBySide(side, card, row, col) {
    const s = side === "R" ? "R" : "L";
    if (this.turnSide !== s) return { ok: false, reason: "not_this_side_turn" };
    const hero = s === "L" ? this.left : this.right;
    return this._trySummon(hero, s, card, row, col);
  }

  tryCastSkillByPlayer(card, row, col) {
    if (this.turnSide !== "L") return { ok: false, reason: "not_your_turn" };
    return this._tryCastSkill(this.left, "L", card, row, col);
  }

  tryCastSkillBySide(side, card, row, col) {
    const s = side === "R" ? "R" : "L";
    if (this.turnSide !== s) return { ok: false, reason: "not_this_side_turn" };
    const hero = s === "L" ? this.left : this.right;
    return this._tryCastSkill(hero, s, card, row, col);
  }

  removeOwnUnitBySide(side, row, col) {
    const s = side === "R" ? "R" : "L";
    if (this.turnSide !== s) return { ok: false, reason: "not_this_side_turn" };
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return { ok: false, reason: "bad_cell" };
    const unit = this.board[row][col];
    if (!unit) return { ok: false, reason: "no_unit" };
    if (unit.side !== s) return { ok: false, reason: "not_owner" };

    this._pushUnitToGrave(unit);
    this.board[row][col] = null;
    this._log(`${s === "L" ? "我方" : "敵方"}剷除【${unit.name}】@(${row + 1},${col + 1})`);

    this._computeAllyCountAuras();
    this._refreshUnitStatusTags();
    this.boardUI.renderBoard(this.board);
    this._notifyFull();
    return { ok: true };
  }

  _isEliteCard(card) {
    const v = card?.unique;
    return v === true || v === 1 || v === "1";
  }

  _hasEliteOnBoard(side, cardId) {
    if (!cardId) return false;
    const units = this._allUnits();
    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      if (!u || u.side !== side) continue;
      if (u.cardId === cardId) return true;
    }
    return false;
  }

  _cardHasNoMove(card) {
    const lines = [
      safeStr(card?.ability1),
      safeStr(card?.ability2),
      safeStr(card?.ability3),
      safeStr(card?.ability4),
      safeStr(card?.ability5),
      ...(Array.isArray(card?.abilities) ? card.abilities.map((x) => safeStr(x)) : [])
    ].filter((x) => x);
    const text = lines.join(" ");
    return /(不能移動|不能移动|無法移動|无法移动|禁止移動|禁止移动)/.test(text);
  }

  _deployBoundsForCard(side, card) {
    const noMove = this._cardHasNoMove(card);
    if (side === "L") {
      return { minCol: 0, maxCol: noMove ? Math.min(GRID_COLS - 1, DEPLOY_LEFT_COL_MAX + 2) : DEPLOY_LEFT_COL_MAX };
    }
    return { minCol: noMove ? Math.max(0, DEPLOY_RIGHT_COL_MIN - 2) : DEPLOY_RIGHT_COL_MIN, maxCol: GRID_COLS - 1 };
  }

  aiTakeTurn(side = this.turnSide) {
    const s = side === "R" ? "R" : "L";
    if (this.turnSide !== s) return;

    const hero = s === "R" ? this.right : this.left;
    const hand = Array.isArray(hero.ready) ? hero.ready : [];
    const playable = hand.filter((c) => c && c.type === "summon" && c.unit && getCardCost(c) === 0);

    if (playable.length > 0) {
      for (let i = 0; i < playable.length; i += 1) {
        const card = playable[i];
        if (this._isEliteCard(card) && this._hasEliteOnBoard(s, card.id)) continue;
        const bounds = this._deployBoundsForCard(s, card);
        const candidates = [];
        for (let r = 0; r < GRID_ROWS; r += 1) {
          for (let c = bounds.minCol; c <= bounds.maxCol; c += 1) {
            if (!this.board[r][c]) candidates.push({ r, c });
          }
        }
        if (candidates.length <= 0) continue;
        const pick = candidates[Math.floor(this.rng() * candidates.length)];
        const res = this._trySummon(hero, s, card, pick.r, pick.c);
        if (res.ok) break;
      }
    }

    this.endTurn();
  }

  endTurn() {
    this._log(`回合結束：${this.turnSide === "L" ? "我方" : "敵方"}`);
    this._resolveStep();

    if (this.left.hp <= 0 || this.right.hp <= 0) {
      this._log(this.left.hp <= 0 ? "我方英雄倒下（敗北）" : "敵方英雄倒下（勝利）");
      this._notifyFull();
      return;
    }

    this.turnSide = this.turnSide === "L" ? "R" : "L";
    if (this.turnSide === "L") this.turnCount += 1;

    this._beginTurn(true);
  }

  _beginTurn(drawCard) {
    const hero = this.turnSide === "L" ? this.left : this.right;

    if (drawCard) this.cardSystem.draw(hero, DRAW_PER_TURN);

    const changed = this._countdownHandCosts(hero);
    this._log(`回合開始：${this.turnSide === "L" ? "我方" : "敵方"}（手牌費用倒數 -1 變更 ${changed} 張）`);
    this._notifyFull();

    if (this.getAutoAiForSide(this.turnSide)) {
      this.scene.time.delayedCall(450, () => this.aiTakeTurn(this.turnSide));
    }
  }

  _countdownHandCosts(hero) {
    const hand = Array.isArray(hero?.ready) ? hero.ready : [];
    let changed = 0;

    for (let i = 0; i < hand.length; i += 1) {
      const card = hand[i];
      if (!card) continue;
      const current = getCardCost(card);
      const next = Math.max(0, current - 1);
      card.cost = next;
      if (next !== current) changed += 1;
    }

    return changed;
  }

  _createUnitFromCard(side, card, row, col) {
    const tokens = tokenizeEffects(card);
    const runtime = createRuntime();
    const cardRuleMap = card?.effectRuleMap && typeof card.effectRuleMap === "object"
      ? card.effectRuleMap
      : null;
    const mapped = this._applyEffectInstancesFromCard(card, runtime);
    let hasSummonSpec = Boolean(mapped?.hasSummonSpec);
    const specialState = { hasSummonSpec };
    const coveredKeys = mapped?.coveredKeys instanceof Set ? mapped.coveredKeys : new Set();

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (coveredKeys.has(token.key)) continue;
      const rule = resolveEffectRule(token, cardRuleMap);
      const ruleTags = Array.isArray(rule?.tags) ? rule.tags : [];
      const explicitSummon = hasExplicitSummonText(token.src);
      if (!ruleTags.includes("summon_token") && !(ruleTags.includes("summon_token") && !explicitSummon)) {
        applyRule(runtime, rule, token.value);
      }

      this._applySpecialAbilityPrograms(token, runtime, specialState);
      hasSummonSpec = Boolean(specialState.hasSummonSpec);
    }
    if (!hasSummonSpec) {
      runtime.summonPerTurn = 0;
      runtime.summonMaxAlive = 0;
      runtime.summonAbilities = [];
    }
    finalizeRuntime(runtime);

    const baseHp = clampMin(card?.unit?.hp, 1);
    const baseAtk = clampMin(card?.unit?.atk, 1);
    const maxHp = baseHp + runtime.maxHpFlat;
    const atk = baseAtk + runtime.atkFlat;
    const dieAfterAttack = tokens.some((t) => /骤现|驟現/.test(t.src));

    return {
      side,
      cardId: card.id,
      unique: this._isEliteCard(card),
      isElite: this._isEliteCard(card),
      name: card.unit.name || card.name,
      image: card.image || "",
      description: card.description || "",
      phyle: Number(card.phyle ?? 0),
      quality: Number(card.quality ?? 0),
      summonCost: Number(card.baseCost ?? card.cost ?? 0),
      ability1: safeStr(card.ability1),
      ability2: safeStr(card.ability2),
      ability3: safeStr(card.ability3),
      ability4: safeStr(card.ability4),
      ability5: safeStr(card.ability5),
      abilities: tokens.map((t) => t.src),
      effectInstances: Array.isArray(card?.effectInstances) ? [...card.effectInstances] : [],
      effectTokens: tokens,
      runtime,
      baseAtk: atk,
      baseMaxHp: maxHp,
      bonusAtkFlat: 0,
      bonusMaxHpFlat: 0,
      auraAtkFlat: 0,
      auraMaxHpFlat: 0,
      hp: maxHp,
      maxHp,
      atk,
      row,
      col,
      status: {
        skipSteps: 0,
        noMoveSteps: 0,
        noAttackSteps: 0,
        silenceSteps: 0,
        slowSteps: 0,
        atkDebuff: 0,
        poisonSteps: 0,
        poisonDamage: 0,
        burnSteps: 0,
        burnDamage: 0,
        dotSteps: 0,
        dotDamage: 0,
        dotType: "physical",
        cannotCombat: false,
        cowAuraLocked: false,
        firstActionDone: false,
        dieAfterAttack
      },
      reviveUsed: false,
      auraBackup: null,
      activeStatuses: []
    };
  }

  _trySummon(hero, side, card, row, col) {
    if (!card || card.type !== "summon" || !card.unit) return { ok: false, reason: "not_summon" };
    if (getCardCost(card) !== 0) return { ok: false, reason: "cost_not_zero" };
    if (this._isEliteCard(card) && this._hasEliteOnBoard(side, card.id)) {
      this._log(`【${card.name || card.unit?.name || card.id}】為菁英，同陣營場上只能存在 1 張`);
      return { ok: false, reason: "elite_exists" };
    }

    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return { ok: false, reason: "bad_cell" };
    if (this.board[row][col]) return { ok: false, reason: "occupied" };

    const bounds = this._deployBoundsForCard(side, card);
    if (col < bounds.minCol || col > bounds.maxCol) return { ok: false, reason: "bad_deploy_zone" };

    this.cardSystem.removeFromReady(hero, card);

    const unit = this._createUnitFromCard(side, card, row, col);
    this.board[row][col] = unit;

    this._log(`${side === "L" ? "我方" : "敵方"}召喚【${unit.name}${unit.isElite ? "・菁英" : ""}】@(${row + 1},${col + 1})`);
    this._triggerOnSummonEffects(unit);
    this._triggerEnemySummonedReactions(unit);
    this._computeAllyCountAuras();
    this._refreshUnitStatusTags();
    this.boardUI.renderBoard(this.board);
    this._notifyFull();
    return { ok: true };
  }

  _isUnitUntargetableBySingleSkill(unit) {
    if (!unit || unit.hp <= 0) return false;
    const lines = [
      safeStr(unit.ability1),
      safeStr(unit.ability2),
      safeStr(unit.ability3),
      safeStr(unit.ability4),
      safeStr(unit.ability5),
      ...(Array.isArray(unit.abilities) ? unit.abilities.map((x) => safeStr(x)) : [])
    ].filter((x) => x);
    const s = lines.join(" ");
    if (!s) return false;
    if (/(不能被單體技能指定|不能被单体技能指定|無法被單體技能指定|无法被单体技能指定)/.test(s)) return true;
    return /(隱匿|隐匿)/.test(s) && /(單體|单体|指定)/.test(s);
  }

  _collectSkillText(card) {
    const lines = [
      safeStr(card?.ability1),
      safeStr(card?.ability2),
      safeStr(card?.ability3),
      safeStr(card?.ability4),
      safeStr(card?.ability5),
      ...(Array.isArray(card?.abilities) ? card.abilities.map((x) => safeStr(x)) : []),
      safeStr(card?.description)
    ].filter((x) => x);
    return lines.join(" ");
  }

  _applySkillReadyDelta(side, text) {
    if (!/(準備值|准备值)/.test(text)) return 0;
    const m = text.match(/(?:準備值|准备值)\s*-\s*([零〇一二兩两三四五六七八九十\d]+)|([零〇一二兩两三四五六七八九十\d]+)\s*點?.*(?:準備值|准备值)/);
    const delta = Math.max(0, parseLooseIntToken(m?.[1] || m?.[2], 0));
    if (delta <= 0) return 0;

    const isEnemy = /(敵方英雄|敌方英雄|對召喚者|对召唤者)/.test(text);
    const targetHero = isEnemy
      ? (side === "L" ? this.right : this.left)
      : (side === "L" ? this.left : this.right);
    const arr = Array.isArray(targetHero?.ready) ? targetHero.ready : [];
    if (arr.length <= 0) return 0;

    const all = /(所有手牌|所有卡牌|準備欄中所有|准备栏中所有)/.test(text);
    let changed = 0;
    if (all) {
      for (let i = 0; i < arr.length; i += 1) {
        const c = arr[i];
        if (!c) continue;
        const before = getCardCost(c);
        c.cost = Math.max(0, before - delta);
        if (c.cost !== before) changed += 1;
      }
      return changed;
    }

    const sorted = [...arr].sort((a, b) => getCardCost(b) - getCardCost(a));
    const top = sorted[0];
    if (!top) return 0;
    const before = getCardCost(top);
    top.cost = Math.max(0, before - delta);
    return top.cost !== before ? 1 : 0;
  }

  _tryCastSkill(hero, side, card, row, col) {
    if (!card || String(card.type || "") !== "skill") return { ok: false, reason: "not_skill" };
    if (getCardCost(card) !== 0) return { ok: false, reason: "cost_not_zero" };

    const text = this._collectSkillText(card);
    if (!text) return { ok: false, reason: "no_skill_text" };
    const returnChance = parseSkillReturnToHandChanceFromText(text);

    const targetUnit = (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) ? this.board[row][col] : null;

    const enemyOnly = /(敵方士兵|敌方士兵|敵方單體|敌方单体|目標.*敵方|目标.*敌方)/.test(text);
    const allyOnly = /(友方士兵|己方士兵|我方士兵|指定友方士兵|指定己方士兵)/.test(text);
    const allUnits = /(所有士兵|全場士兵|全体士兵|全體士兵)/.test(text);
    const enemyAllUnits = /(所有敵方士兵|所有敌方士兵|敵方全場|敌方全场|敵方全體|敌方全体)/.test(text);
    const allyAllUnits = /(所有友方士兵|所有己方士兵|友方全場|友方全体|友方全體|我方所有士兵|我方全場)/.test(text);
    const targetEnemyHero = /(敵方英雄|敌方英雄|對召喚者|对召唤者)/.test(text);
    const targetAllyHero = /(友方英雄|我方英雄|召喚者|召唤者|自身|自己)/.test(text) && !targetEnemyHero;

    if (!allUnits && !enemyAllUnits && !allyAllUnits && !targetEnemyHero && !targetAllyHero) {
      if (!targetUnit) return { ok: false, reason: "bad_target" };
      if (enemyOnly && targetUnit.side === side) return { ok: false, reason: "wrong_target_side" };
      if (allyOnly && targetUnit.side !== side) return { ok: false, reason: "wrong_target_side" };
      if (this._isUnitUntargetableBySingleSkill(targetUnit)) {
        this._log("此士兵不能被指定");
        return { ok: false, reason: "target_untargetable" };
      }
    }

    this.cardSystem.removeFromReady(hero, card);
    this._log(`${side === "L" ? "我方" : "敵方"}施放技能【${card.name || card.id}】`);

    const dmgMatch = text.match(/造成\s*([零〇一二兩两三四五六七八九十\d]+)\s*點?.*(?:傷害|伤害)|([零〇一二兩两三四五六七八九十\d]+)\s*點?.*(?:傷害|伤害)/);
    const healMatch = text.match(/(?:治療|治疗|恢復|恢复|回復|回复)\s*([零〇一二兩两三四五六七八九十\d]+)/);
    const damage = Math.max(0, parseLooseIntToken(dmgMatch?.[1] || dmgMatch?.[2], 0));
    const heal = Math.max(0, parseLooseIntToken(healMatch?.[1], 0));
    const damageType = parseDamageTypeFromText(text);

    const units = this._allUnits().filter((u) => u && u.hp > 0);
    const enemyUnits = units.filter((u) => u.side !== side);
    const allyUnits = units.filter((u) => u.side === side);

    if (damage > 0) {
      if (enemyAllUnits) {
        for (let i = 0; i < enemyUnits.length; i += 1) this._dealDamageToUnit(enemyUnits[i], damage, null, damageType);
      } else if (allyAllUnits) {
        for (let i = 0; i < allyUnits.length; i += 1) this._dealDamageToUnit(allyUnits[i], damage, null, damageType);
      } else if (allUnits) {
        for (let i = 0; i < units.length; i += 1) this._dealDamageToUnit(units[i], damage, null, damageType);
      } else if (targetEnemyHero) {
        this._applyHeroDamage(side === "L" ? "R" : "L", damage, side, damageType);
      } else if (targetAllyHero) {
        this._applyHeroDamage(side === "L" ? "L" : "R", damage, side, damageType);
      } else if (targetUnit && targetUnit.hp > 0) {
        this._dealDamageToUnit(targetUnit, damage, null, damageType);
      }
    }

    if (heal > 0) {
      if (allyAllUnits || allUnits) {
        const pool = allyAllUnits ? allyUnits : units;
        for (let i = 0; i < pool.length; i += 1) this._healUnit(pool[i], heal);
      } else if (targetAllyHero) {
        const heroRef = side === "L" ? this.left : this.right;
        heroRef.hp = Math.min(HERO_HP, heroRef.hp + heal);
      } else if (targetUnit && targetUnit.hp > 0) {
        this._healUnit(targetUnit, heal);
      }
    }

    this._applySkillReadyDelta(side, text);

    if (returnChance > 0 && this.rng() < returnChance) {
      const hand = Array.isArray(hero?.ready) ? hero.ready : [];
      if (hand.length < HAND_LIMIT) {
        card.cost = Math.max(0, Number(card.baseCost ?? card.cost ?? 0));
        hand.push(card);
        this._log(`【${card.name || card.id}】觸發回手率，返回手牌`);
      } else {
        this._log(`【${card.name || card.id}】觸發回手率，但手牌已滿`);
      }
    }

    this._computeAllyCountAuras();
    this._refreshUnitStatusTags();
    this.boardUI.renderBoard(this.board);
    this._notifyFull();
    return { ok: true };
  }

  _triggerOnSummonEffects(unit) {
    if (!unit || unit.hp <= 0) return;
    const damageRules = Array.isArray(unit.runtime?.onSummonDamageRules) ? unit.runtime.onSummonDamageRules : [];
    const healRules = Array.isArray(unit.runtime?.onSummonHealRules) ? unit.runtime.onSummonHealRules : [];
    const controlRules = Array.isArray(unit.runtime?.onSummonControlRules) ? unit.runtime.onSummonControlRules : [];
    const readyRules = Array.isArray(unit.runtime?.onSummonReadyRules) ? unit.runtime.onSummonReadyRules : [];
    const selfLockRules = Array.isArray(unit.runtime?.onSummonSelfLockRules) ? unit.runtime.onSummonSelfLockRules : [];
    if (damageRules.length === 0 && healRules.length === 0 && controlRules.length === 0 && readyRules.length === 0 && selfLockRules.length === 0) return;

    const events = [];
    for (let i = 0; i < damageRules.length; i += 1) {
      const r = damageRules[i];
      if (!r || r.target !== "enemy_all_units") continue;
      const raceIds = Array.isArray(r.raceIds) ? r.raceIds : [];
      const targets = this._enemyUnits(unit.side).filter((x) => x && x.hp > 0 && (raceIds.length === 0 || raceIds.includes(Number(x.phyle || 0))));
      for (let j = 0; j < targets.length; j += 1) {
        const t = targets[j];
        const dealt = this._dealDamageToUnit(t, Number(r.damage || 0), unit, String(r.damageType || "physical"));
        if (dealt <= 0) continue;
        this._log(`【${unit.name}】進場傷害【${t.name}】-${dealt}`);
        events.push({
          side: unit.side,
          fromRow: unit.row,
          fromCol: unit.col,
          toRow: t.row,
          toCol: t.col,
          damage: dealt,
          targetType: "unit",
          damageType: String(r.damageType || "physical")
        });
      }
    }

    for (let i = 0; i < healRules.length; i += 1) {
      const r = healRules[i];
      if (!r || r.target !== "ally_all_units") continue;
      const targets = this._allyUnits(unit.side).filter((x) => x && x.hp > 0);
      for (let j = 0; j < targets.length; j += 1) {
        const t = targets[j];
        const healed = this._healUnit(t, Number(r.amount || 0));
        if (healed <= 0) continue;
        this._log(`【${unit.name}】進場治療【${t.name}】+${healed}`);
      }
    }

    for (let i = 0; i < controlRules.length; i += 1) {
      const r = controlRules[i];
      if (!r || r.target !== "enemy_all_units") continue;
      const targets = this._enemyUnits(unit.side).filter((x) => x && x.hp > 0);
      for (let j = 0; j < targets.length; j += 1) {
        const t = targets[j];
        const steps = Math.max(1, Number(r.steps || 1));
        if (r.effect === "no_move") {
          t.status.noMoveSteps = Math.max(Number(t.status.noMoveSteps || 0), steps);
          this._log(`【${unit.name}】進場限制【${t.name}】無法移動 ${steps} 回合`);
        } else if (r.effect === "no_action") {
          t.status.skipSteps = Math.max(Number(t.status.skipSteps || 0), steps);
          this._log(`【${unit.name}】進場限制【${t.name}】無法行動 ${steps} 回合`);
        } else if (r.effect === "no_attack") {
          t.status.noAttackSteps = Math.max(Number(t.status.noAttackSteps || 0), steps);
          this._log(`【${unit.name}】進場限制【${t.name}】無法攻擊 ${steps} 回合`);
        } else if (r.effect === "silence") {
          t.status.silenceSteps = Math.max(Number(t.status.silenceSteps || 0), steps);
          this._log(`【${unit.name}】進場沉默【${t.name}】${steps} 回合`);
        } else if (r.effect === "charm") {
          t.status.noMoveSteps = Math.max(Number(t.status.noMoveSteps || 0), steps);
          t.status.noAttackSteps = Math.max(Number(t.status.noAttackSteps || 0), steps);
          this._log(`【${unit.name}】進場魅惑【${t.name}】${steps} 回合`);
        }
      }
    }

    for (let i = 0; i < readyRules.length; i += 1) {
      const r = readyRules[i];
      if (!r) continue;
      if (r.type === "draw_ready") {
        const p = Math.max(0, Math.min(1, Number(r.chance ?? 1)));
        if (p < 1 && this.rng() >= p) continue;
        const hero = unit.side === "L" ? this.left : this.right;
        const before = Array.isArray(hero?.ready) ? hero.ready.length : 0;
        const ret = this.cardSystem.draw(hero, Math.max(1, Number(r.count || 1)));
        const after = Array.isArray(hero?.ready) ? hero.ready.length : before;
        const drawn = Number.isFinite(Number(ret)) ? Number(ret) : Math.max(0, after - before);
        if (drawn > 0) this._log(`【${unit.name}】進場加入準備欄 x${drawn}`);
      } else if (r.type === "ready_delta_all") {
        const targetHero = r.target === "enemy"
          ? (unit.side === "L" ? this.right : this.left)
          : (unit.side === "L" ? this.left : this.right);
        const arr = Array.isArray(targetHero?.ready) ? targetHero.ready : [];
        let changed = 0;
        for (let j = 0; j < arr.length; j += 1) {
          const c = arr[j];
          const cur = Number(c?.cost ?? c?.baseCost ?? 0);
          const next = Math.max(0, cur + Number(r.delta || 0));
          if (next !== cur) {
            c.cost = next;
            changed += 1;
          }
        }
        if (changed > 0) this._log(`【${unit.name}】進場影響準備值 ${r.delta > 0 ? "+" : ""}${r.delta}（${changed}張）`);
      }
    }

    for (let i = 0; i < selfLockRules.length; i += 1) {
      const r = selfLockRules[i];
      if (!r) continue;
      const steps = Math.max(1, Number(r.steps || 1));
      if (r.effect === "no_move") {
        unit.status.noMoveSteps = Math.max(Number(unit.status.noMoveSteps || 0), steps);
        this._log(`【${unit.name}】進場後限制：無法移動 ${steps} 回合`);
      } else if (r.effect === "no_action") {
        unit.status.skipSteps = Math.max(Number(unit.status.skipSteps || 0), steps);
        this._log(`【${unit.name}】進場後限制：無法行動 ${steps} 回合`);
      } else if (r.effect === "no_attack") {
        unit.status.noAttackSteps = Math.max(Number(unit.status.noAttackSteps || 0), steps);
        this._log(`【${unit.name}】進場後限制：無法攻擊 ${steps} 回合`);
      }
    }

    if (events.length > 0 && this.boardUI && typeof this.boardUI.playAttackEffects === "function") {
      this.boardUI.playAttackEffects(events);
    }
  }

  _triggerEnemySummonedReactions(summonedUnit) {
    if (!summonedUnit || summonedUnit.hp <= 0) return;
    const reactors = this._allUnits().filter((u) => u && u.hp > 0 && u !== summonedUnit);
    const events = [];

    for (let i = 0; i < reactors.length; i += 1) {
      const src = reactors[i];
      const rules = Array.isArray(src.runtime?.onEnemySummonedDamageRules) ? src.runtime.onEnemySummonedDamageRules : [];
      for (let j = 0; j < rules.length; j += 1) {
        const r = rules[j];
        if (!r) continue;
        const raceIds = Array.isArray(r.raceIds) ? r.raceIds : [];
        if (raceIds.length > 0 && !raceIds.includes(Number(summonedUnit.phyle || 0))) continue;

        const isEnemySummon = summonedUnit.side !== src.side;
        if (!isEnemySummon) continue;
        if (r.isDot) {
          const steps = Math.max(1, Number(r.steps || 1));
          summonedUnit.status.dotSteps = Math.max(Number(summonedUnit.status.dotSteps || 0), steps);
          summonedUnit.status.dotDamage = Math.max(Number(summonedUnit.status.dotDamage || 0), Number(r.damage || 0));
          summonedUnit.status.dotType = String(r.damageType || "physical");
          this._log(`【${src.name}】對召喚單位施加持續傷害【${summonedUnit.name}】${summonedUnit.status.dotDamage}/回合（${steps}回合）`);
        } else {
          const dealt = this._dealDamageToUnit(summonedUnit, Number(r.damage || 0), src, String(r.damageType || "physical"));
          if (dealt > 0) {
            this._log(`【${src.name}】懲罰召喚【${summonedUnit.name}】-${dealt}`);
            events.push({
              side: src.side,
              fromRow: src.row,
              fromCol: src.col,
              toRow: summonedUnit.row,
              toCol: summonedUnit.col,
              damage: dealt,
              targetType: "unit",
              damageType: String(r.damageType || "physical")
            });
          }
        }

        if (r.alsoSelfDamage) {
          const selfDmg = this._dealDamageToUnit(src, Number(r.damage || 0), null, String(r.damageType || "physical"));
          if (selfDmg > 0) this._log(`【${src.name}】承受反噬 -${selfDmg}`);
        }
      }

      const grantRules = Array.isArray(src.runtime?.onSummonedGrantRules) ? src.runtime.onSummonedGrantRules : [];
      for (let j = 0; j < grantRules.length; j += 1) {
        const r = grantRules[j];
        if (!r || !r.grantedText) continue;
        const raceIds = Array.isArray(r.raceIds) ? r.raceIds : [];
        if (raceIds.length > 0 && !raceIds.includes(Number(summonedUnit.phyle || 0))) continue;
        const shouldApply = (
          (r.targetSide === "enemy_summoned" && summonedUnit.side !== src.side) ||
          (r.targetSide === "ally_summoned" && summonedUnit.side === src.side)
        );
        if (!shouldApply) continue;

        const token = this._buildTokenFromEffectText(r.grantedText);
        const rule = resolveEffectRule(token);
        applyRule(summonedUnit.runtime, rule, token.value);
        finalizeRuntime(summonedUnit.runtime);
        this._log(`【${src.name}】使【${summonedUnit.name}】獲得能力：${r.grantedText}`);
      }
    }

    if (events.length > 0 && this.boardUI && typeof this.boardUI.playAttackEffects === "function") {
      this.boardUI.playAttackEffects(events);
    }
  }

  _resolveStep() {
    this._syncCowAuraEffects();
    this._applyStartStepAuras();
    this._applySummonAuras();
    this._advanceAllUnits();
    this._attackAllUnits();
    this._applyEndStepDots();
    this._cleanupDead();
    this._tickStatus();
    this._computeAllyCountAuras();
    this._refreshUnitStatusTags();
    this.boardUI.renderBoard(this.board);
  }

  _allUnits() {
    const arr = [];
    for (let r = 0; r < GRID_ROWS; r += 1) {
      for (let c = 0; c < GRID_COLS; c += 1) {
        const u = this.board[r][c];
        if (u) arr.push(u);
      }
    }
    return arr;
  }

  _enemyUnits(side) {
    return this._allUnits().filter((u) => u.side !== side);
  }

  _allyUnits(side) {
    return this._allUnits().filter((u) => u.side === side);
  }

  _isStunned(unit) {
    return Number(unit?.status?.skipSteps ?? 0) > 0;
  }

  _cannotCombat(unit) {
    return Boolean(unit?.status?.cannotCombat);
  }

  _calcUnitAtk(unit) {
    const debuff = Number(unit?.status?.atkDebuff ?? 0);
    return Math.max(1, Number(unit.atk ?? 1) - debuff);
  }

  _inferDamageTypeForUnit(unit) {
    const text = Array.isArray(unit?.abilities) ? unit.abilities.join(" ") : "";
    if (/闪电|閃電|雷击|雷擊|落雷|雷/.test(text)) return "lightning";
    if (/火焰|火弹|火彈|燃烧|燃燒|灼烧|灼燒/.test(text)) return "fire";
    if (/冰霜|寒霜|冰冻|冰凍|冰/.test(text)) return "ice";
    if (/暗影|亡灵|亡靈|死咒|巫毒/.test(text)) return "shadow";
    if (/圣光|聖光|神聖|天使/.test(text)) return "holy";
    if (/中毒|毒刃|毒箭|剧毒|劇毒|毒/.test(text)) return "poison";
    return "physical";
  }

  _buildTokenFromEffectText(src) {
    const raw = safeStr(src);
    const parts = raw.split(/[・:：]/);
    const key = safeStr(parts[0]);
    const value = pickTrailingNumber(key, parsePlusNumber(raw, 1));
    return { src: raw, key, detail: safeStr(parts.slice(1).join("・")), value };
  }

  _applySpecialAbilityPrograms(token, runtime, state = null) {
    if (!token || !runtime) return;
    const src = safeStr(token.src);
    this._specialHandleMovementKeywords(src, runtime);
    this._specialHandleSummonSpec(src, runtime, state);
    this._specialHandleRevive(src, runtime);
    this._specialHandleAllyCountBuff(src, runtime);
    this._specialHandleAuraGrant(src, runtime);
    this._specialHandleAuraDamageBonus(src, runtime);
    this._specialHandleOnSummon(src, runtime);
    this._specialHandleOnEnemySummoned(src, runtime);
    this._specialHandleAuraNoHeal(src, runtime);
    this._specialHandleOnStepSelfBuff(src, runtime);
    this._specialHandleOnAction(src, runtime);
    this._specialHandleFirstAction(src, runtime);
    this._specialHandleStepDamage(src, runtime);
    this._specialHandleReadyRule(src, runtime);
  }

  _specialHandleMovementKeywords(src, runtime) {
    if (/飞溅|飛濺|溅射|濺射/.test(src)) runtime.splashBehind = true;
    if (/疾风步|疾風步|瞬移|闪现|閃現/.test(src)) {
      runtime.speedSteps = Math.max(runtime.speedSteps, /瞬移|闪现|閃現/.test(src) ? 6 : 5);
    }
    if (/瞬移|闪现|閃現/.test(src)) runtime.passThroughEnemy = true;
  }

  _specialHandleSummonSpec(src, runtime, state = null) {
    const summonSpec = parseSummonSpecFromText(src);
    if (!summonSpec) return;
    if (state && typeof state === "object") state.hasSummonSpec = true;
    runtime.summonPerTurn = Math.max(runtime.summonPerTurn, summonSpec.count);
    runtime.summonHp = Math.max(runtime.summonHp, summonSpec.hp);
    runtime.summonAtk = Math.max(runtime.summonAtk, summonSpec.atk);
    if (summonSpec.name) runtime.summonName = summonSpec.name;
    if (summonSpec.maxAlive > 0) runtime.summonMaxAlive = Math.max(runtime.summonMaxAlive, summonSpec.maxAlive);
    if (Array.isArray(summonSpec.abilities) && summonSpec.abilities.length > 0) {
      runtime.summonAbilities = [...new Set([...runtime.summonAbilities, ...summonSpec.abilities])];
    }
  }

  _specialHandleRevive(src, runtime) {
    const reviveChance = parseReviveChanceFromText(src);
    if (reviveChance !== null) runtime.reviveChance = Math.max(runtime.reviveChance, reviveChance);
  }

  _specialHandleAllyCountBuff(src, runtime) {
    const allyCountBuff = parseAllyCountBuffFromText(src);
    if (allyCountBuff) runtime.allyCountBuffs.push(allyCountBuff);
  }

  _specialHandleAuraGrant(src, runtime) {
    const auraGrant = parseAuraGrantFromText(src);
    if (auraGrant) runtime.auraGrantRules.push(auraGrant);
  }

  _specialHandleAuraDamageBonus(src, runtime) {
    const auraDmg = parseAuraDamageBonusFromText(src);
    if (auraDmg) runtime.auraDamageBonusRules.push(auraDmg);
  }

  _specialHandleOnSummon(src, runtime) {
    const onSummonDamage = parseOnSummonDamageFromText(src);
    if (onSummonDamage) runtime.onSummonDamageRules.push(onSummonDamage);
    const onSummonHeal = parseOnSummonHealFromText(src);
    if (onSummonHeal) runtime.onSummonHealRules.push(onSummonHeal);
    const onSummonControl = parseOnSummonControlFromText(src);
    if (Array.isArray(onSummonControl) && onSummonControl.length > 0) runtime.onSummonControlRules.push(...onSummonControl);
    const onSummonReady = parseOnSummonReadyRuleFromText(src);
    if (onSummonReady) runtime.onSummonReadyRules.push(onSummonReady);
    const onSummonSelfLock = parseOnSummonSelfLockFromText(src);
    if (Array.isArray(onSummonSelfLock) && onSummonSelfLock.length > 0) runtime.onSummonSelfLockRules.push(...onSummonSelfLock);
  }

  _specialHandleOnEnemySummoned(src, runtime) {
    const onEnemySummonedDamage = parseOnEnemySummonedDamageFromText(src);
    if (onEnemySummonedDamage) runtime.onEnemySummonedDamageRules.push(onEnemySummonedDamage);
    const onSummonedGrant = parseOnSummonedGrantRuleFromText(src);
    if (onSummonedGrant) runtime.onSummonedGrantRules.push(onSummonedGrant);
  }

  _specialHandleAuraNoHeal(src, runtime) {
    const auraNoHeal = parseAuraNoHealRuleFromText(src);
    if (auraNoHeal) runtime.auraNoHealRules.push(auraNoHeal);
  }

  _specialHandleOnStepSelfBuff(src, runtime) {
    const onStepSelfBuff = parseOnStepSelfBuffFromText(src);
    if (onStepSelfBuff) runtime.onStepSelfBuffRules.push(onStepSelfBuff);
  }

  _specialHandleOnAction(src, runtime) {
    const onActionEnemyAoe = parseOnActionEnemyAoeFromText(src);
    if (onActionEnemyAoe) runtime.onActionEnemyAoeRules.push(onActionEnemyAoe);
    const onActionAllyTeamBuff = parseOnActionAllyTeamBuffFromText(src);
    if (onActionAllyTeamBuff) runtime.onActionAllyTeamBuffRules.push(onActionAllyTeamBuff);
    const onActionAllyTeamHeal = parseOnActionAllyTeamHealFromText(src);
    if (onActionAllyTeamHeal) runtime.onActionAllyTeamHealRules.push(onActionAllyTeamHeal);
    const onActionStatusTransfer = parseOnActionStatusTransferRuleFromText(src);
    if (onActionStatusTransfer) runtime.onActionStatusTransferRules.push(onActionStatusTransfer);
    const onActionTransform = parseOnActionTransformRuleFromText(src);
    if (onActionTransform) runtime.onActionTransformRules.push(onActionTransform);
    const onActionCleanse = parseOnActionCleanseRuleFromText(src);
    if (onActionCleanse) runtime.onActionCleanseRules.push(onActionCleanse);
    const onActionEnemyDispel = parseOnActionEnemyDispelRuleFromText(src);
    if (onActionEnemyDispel) runtime.onActionEnemyDispelRules.push(onActionEnemyDispel);
  }

  _specialHandleFirstAction(src, runtime) {
    const firstActionRule = parseFirstActionRuleFromText(src);
    if (firstActionRule) runtime.firstActionRules.push(firstActionRule);
  }

  _specialHandleStepDamage(src, runtime) {
    const stepDamageRule = parseStepDamageRuleFromText(src);
    if (stepDamageRule) runtime.stepDamageRules.push(stepDamageRule);
  }

  _specialHandleReadyRule(src, runtime) {
    const readyRule = parseReadyValueRuleFromText(src);
    if (readyRule) runtime.readyValueRules.push(readyRule);
  }

  _normalizeEffectInstance(inst) {
    if (!inst || typeof inst !== "object") return null;
    const id = safeStr(inst.id || inst.type || inst.key);
    if (!id) return null;
    const value = Math.max(0, Number(inst.value ?? inst.valueHint ?? 0));
    const tags = Array.isArray(inst.tags) ? inst.tags.map((x) => safeStr(x)).filter((x) => x) : [];
    const params = inst.params && typeof inst.params === "object" ? inst.params : {};
    const sourceKey = safeStr(inst.sourceKey || inst.abilityKey || inst.key || "");
    return { id, value, tags, params, sourceKey };
  }

  _applyEffectInstanceToRuntime(runtime, instance) {
    if (!runtime || !instance) return { hasSummonSpec: false };
    const id = safeStr(instance.id).toLowerCase();
    const v = Math.max(1, Number(instance.value || 1));
    let hasSummonSpec = false;

    if (instance.tags.length > 0) {
      applyRule(runtime, { tags: [...instance.tags], valueHint: v }, v);
    }

    switch (id) {
      case "summon_token":
      case "summon_token_spec": {
        hasSummonSpec = true;
        runtime.summonPerTurn = Math.max(runtime.summonPerTurn, Math.max(1, Number(instance.params.count ?? v)));
        runtime.summonHp = Math.max(runtime.summonHp, Math.max(1, Number(instance.params.hp ?? runtime.summonHp)));
        runtime.summonAtk = Math.max(runtime.summonAtk, Math.max(1, Number(instance.params.atk ?? runtime.summonAtk)));
        if (safeStr(instance.params.name)) runtime.summonName = safeStr(instance.params.name);
        if (Number(instance.params.maxAlive || 0) > 0) {
          runtime.summonMaxAlive = Math.max(runtime.summonMaxAlive, Number(instance.params.maxAlive || 0));
        }
        if (Array.isArray(instance.params.abilities)) {
          runtime.summonAbilities = [
            ...new Set([
              ...runtime.summonAbilities,
              ...instance.params.abilities.map((x) => safeStr(x)).filter((x) => x)
            ])
          ];
        }
        break;
      }
      case "revive_chance":
        runtime.reviveChance = Math.max(runtime.reviveChance, Math.max(0, Math.min(1, Number(instance.params.chance ?? (v / 100)))));
        break;
      case "ally_count_buff": {
        const atkPer = Math.max(0, Number(instance.params.atkPer ?? 0));
        const hpPer = Math.max(0, Number(instance.params.hpPer ?? 0));
        if (atkPer > 0 || hpPer > 0) {
          runtime.allyCountBuffs.push({
            atkPer,
            hpPer,
            raceIds: Array.isArray(instance.params.raceIds) ? instance.params.raceIds.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : []
          });
        }
        break;
      }
      case "aura_grant":
        if (safeStr(instance.params.grantedText)) {
          runtime.auraGrantRules.push({
            includeSelf: Boolean(instance.params.includeSelf ?? true),
            adjacentOnly: Boolean(instance.params.adjacentOnly ?? false),
            grantedText: safeStr(instance.params.grantedText),
            raceIds: Array.isArray(instance.params.raceIds) ? instance.params.raceIds.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : []
          });
        }
        break;
      case "aura_damage_bonus":
        runtime.auraDamageBonusRules.push({
          includeSelf: Boolean(instance.params.includeSelf ?? true),
          adjacentOnly: Boolean(instance.params.adjacentOnly ?? false),
          damageType: safeStr(instance.params.damageType || "physical"),
          bonus: Math.max(0, Number(instance.params.bonus ?? v)),
          raceIds: Array.isArray(instance.params.raceIds) ? instance.params.raceIds.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : []
        });
        break;
      default:
        break;
    }

    return { hasSummonSpec };
  }

  _applyEffectInstancesFromCard(card, runtime) {
    const coveredKeys = new Set();
    let hasSummonSpec = false;

    const explicit = Array.isArray(card?.effectInstances) ? card.effectInstances : [];
    for (let i = 0; i < explicit.length; i += 1) {
      const inst = this._normalizeEffectInstance(explicit[i]);
      if (!inst) continue;
      if (inst.sourceKey) coveredKeys.add(inst.sourceKey);
      const res = this._applyEffectInstanceToRuntime(runtime, inst);
      if (res?.hasSummonSpec) hasSummonSpec = true;
    }

    const map = card?.effectRuleMap && typeof card.effectRuleMap === "object" ? card.effectRuleMap : null;
    if (map) {
      const keys = Object.keys(map);
      for (let i = 0; i < keys.length; i += 1) {
        const key = safeStr(keys[i]);
        if (!key) continue;
        const rule = map[key];
        if (!rule || typeof rule !== "object") continue;
        coveredKeys.add(key);
        const tags = Array.isArray(rule.tags) ? rule.tags.map((x) => safeStr(x)).filter((x) => x) : [];
        if (tags.length > 0) {
          applyRule(runtime, { tags, valueHint: Math.max(1, Number(rule.valueHint || 1)) }, Math.max(1, Number(rule.valueHint || 1)));
        }
      }
    }

    return { coveredKeys, hasSummonSpec };
  }

  _isAuraRuleAffectingTarget(source, target, rule) {
    if (!source || !target || !rule) return false;
    if (source.side !== target.side) return false;
    if (!rule.includeSelf && source === target) return false;

    if (rule.adjacentOnly) {
      const dr = Math.abs((source.row ?? 0) - (target.row ?? 0));
      const dc = Math.abs((source.col ?? 0) - (target.col ?? 0));
      if (Math.max(dr, dc) > 1) return false;
      if (!rule.includeSelf && dr === 0 && dc === 0) return false;
    }

    const raceIds = Array.isArray(rule.raceIds) ? rule.raceIds : [];
    if (raceIds.length > 0 && !raceIds.includes(Number(target.phyle || 0))) return false;

    return true;
  }

  _buildEffectiveRuntime(unit) {
    if (!unit) return createRuntime();
    if (Number(unit?.status?.silenceSteps || 0) > 0) return createRuntime();
    const out = { ...(unit.runtime || createRuntime()) };
    const all = this._allUnits();

    for (let i = 0; i < all.length; i += 1) {
      const source = all[i];
      if (!source || source.hp <= 0) continue;
      if (source.side !== unit.side) continue;

      const rules = Array.isArray(source.runtime?.auraGrantRules) ? source.runtime.auraGrantRules : [];
      for (let j = 0; j < rules.length; j += 1) {
        const r = rules[j];
        if (!this._isAuraRuleAffectingTarget(source, unit, r)) continue;
        const token = this._buildTokenFromEffectText(r.grantedText);
        const rule = resolveEffectRule(token);
        applyRule(out, rule, token.value);

        const directStep = parseStepDamageRuleFromText(r.grantedText);
        if (directStep) {
          out.stepDamageRules.push(directStep);
        } else {
          const cat = EFFECT_CATALOG.get(token.key);
          const samples = Array.isArray(cat?.samples) ? cat.samples : [];
          for (let s = 0; s < samples.length; s += 1) {
            const sr = parseStepDamageRuleFromText(samples[s]);
            if (sr) out.stepDamageRules.push(sr);
          }
        }

        const onActionEnemyAoe = parseOnActionEnemyAoeFromText(r.grantedText);
        if (onActionEnemyAoe) out.onActionEnemyAoeRules.push(onActionEnemyAoe);

        const onActionAllyTeamBuff = parseOnActionAllyTeamBuffFromText(r.grantedText);
        if (onActionAllyTeamBuff) out.onActionAllyTeamBuffRules.push(onActionAllyTeamBuff);

        const onActionAllyTeamHeal = parseOnActionAllyTeamHealFromText(r.grantedText);
        if (onActionAllyTeamHeal) out.onActionAllyTeamHealRules.push(onActionAllyTeamHeal);

        const onActionStatusTransfer = parseOnActionStatusTransferRuleFromText(r.grantedText);
        if (onActionStatusTransfer) out.onActionStatusTransferRules.push(onActionStatusTransfer);

        const onActionTransform = parseOnActionTransformRuleFromText(r.grantedText);
        if (onActionTransform) out.onActionTransformRules.push(onActionTransform);

        const onActionCleanse = parseOnActionCleanseRuleFromText(r.grantedText);
        if (onActionCleanse) out.onActionCleanseRules.push(onActionCleanse);

        const onActionEnemyDispel = parseOnActionEnemyDispelRuleFromText(r.grantedText);
        if (onActionEnemyDispel) out.onActionEnemyDispelRules.push(onActionEnemyDispel);

        const firstActionRule = parseFirstActionRuleFromText(r.grantedText);
        if (firstActionRule) out.firstActionRules.push(firstActionRule);
      }

      const dmgRules = Array.isArray(source.runtime?.auraDamageBonusRules) ? source.runtime.auraDamageBonusRules : [];
      for (let j = 0; j < dmgRules.length; j += 1) {
        const r = dmgRules[j];
        if (!r || !r.damageType) continue;
        if (source.side !== unit.side) continue;
        if (!r.includeSelf && source === unit) continue;
        const cur = Number(out.damageTypeBonus?.[r.damageType] || 0);
        out.damageTypeBonus[r.damageType] = cur + Math.max(0, Number(r.value || 0));
      }
    }

    finalizeRuntime(out);
    return out;
  }

  _applyDamageReduction(target, rawDamage, sourceUnit = null) {
    const rt = this._buildEffectiveRuntime(target);
    const sourceRt = sourceUnit ? this._buildEffectiveRuntime(sourceUnit) : null;
    const sourceIgnore = sourceRt?.ignoreDefPct ?? 0;
    const reducePct = Math.max(0, (rt.dmgReducePct || 0) * (1 - sourceIgnore));
    return Math.max(0, Math.floor(rawDamage * (1 - reducePct)));
  }

  _dealDamageToUnit(target, rawDamage, sourceUnit = null, damageTypeHint = "") {
    if (!target || rawDamage <= 0) return 0;
    const targetRt = this._buildEffectiveRuntime(target);
    let damage = Number(rawDamage || 0);

    if (sourceUnit && sourceUnit.hp > 0) {
      const sourceRt = this._buildEffectiveRuntime(sourceUnit);
      const dmgType = String(damageTypeHint || this._inferDamageTypeForUnit(sourceUnit) || "physical");
      const bonus = Number(sourceRt?.damageTypeBonus?.[dmgType] || 0);
      if (bonus > 0) damage += bonus;
    }

    if (this.rng() < (targetRt?.dodgeChance ?? 0)) {
      this._log(`【${target.name}】閃避`);
      return 0;
    }
    if (this.rng() < (targetRt?.blockChance ?? 0)) {
      this._log(`【${target.name}】格?`);
      return 0;
    }

    const finalDamage = this._applyDamageReduction(target, damage, sourceUnit);
    if (finalDamage <= 0) return 0;
    target.hp = Math.max(0, target.hp - finalDamage);

    if (this.rng() < (targetRt?.cantActChanceOnDamaged ?? 0)) {
      target.status.skipSteps = Math.max(target.status.skipSteps, targetRt.cantActStepsOnDamaged ?? 1);
      this._log(`【${target.name}】受傷後陷入無法行動`);
    }

    if (sourceUnit && sourceUnit.hp > 0) {
      const reflectPct = targetRt?.reflectPct ?? 0;
      if (reflectPct > 0) {
        const reflectDmg = Math.max(0, Math.floor(finalDamage * reflectPct));
        if (reflectDmg > 0) {
          sourceUnit.hp = Math.max(0, sourceUnit.hp - reflectDmg);
          this._log(`【${target.name}】反傷【${sourceUnit.name}】${reflectDmg}`);
        }
      }
    }

    return finalDamage;
  }

  _healUnit(unit, amount) {
    if (!unit || amount <= 0) return 0;
    if (this._isHealBlockedForUnit(unit)) return 0;
    const before = unit.hp;
    unit.hp = Math.min(unit.maxHp, unit.hp + amount);
    return unit.hp - before;
  }

  _isHealBlockedForUnit(unit) {
    if (!unit || unit.hp <= 0) return false;
    const all = this._allUnits();
    for (let i = 0; i < all.length; i += 1) {
      const src = all[i];
      if (!src || src.hp <= 0) continue;
      const rules = Array.isArray(src.runtime?.auraNoHealRules) ? src.runtime.auraNoHealRules : [];
      for (let j = 0; j < rules.length; j += 1) {
        const r = rules[j];
        if (!r) continue;
        const targetMatch = (
          (r.target === "enemy" && src.side !== unit.side) ||
          (r.target === "ally" && src.side === unit.side)
        );
        if (!targetMatch) continue;
        const raceIds = Array.isArray(r.raceIds) ? r.raceIds : [];
        if (raceIds.length > 0 && !raceIds.includes(Number(unit.phyle || 0))) continue;
        return true;
      }
    }
    return false;
  }

  _matchReadyCardFilter(card, filter) {
    if (!card) return false;
    if (filter === "all") return true;
    if (filter === "skill") return String(card.type || "") === "skill";
    if (filter === "summon") return String(card.type || "") === "summon";
    return true;
  }

  _pickReadyCardsByRule(hero, rule) {
    const ready = Array.isArray(hero?.ready) ? hero.ready : [];
    const filtered = ready.filter((c) => this._matchReadyCardFilter(c, rule.filter || "all"));
    if (filtered.length === 0) return [];

    if (rule.mode === "all") return filtered;

    if (rule.mode === "top") {
      const sorted = [...filtered].sort((a, b) => {
        const da = Number(a?.cost ?? a?.baseCost ?? 0);
        const db = Number(b?.cost ?? b?.baseCost ?? 0);
        return db - da;
      });
      return sorted.slice(0, Math.max(1, Number(rule.count || 1)));
    }

    if (rule.mode === "random") {
      const pool = [...filtered];
      const out = [];
      const need = Math.max(1, Number(rule.count || 1));
      while (pool.length > 0 && out.length < need) {
        const idx = Math.floor(this.rng() * pool.length);
        out.push(pool[idx]);
        pool.splice(idx, 1);
      }
      return out;
    }

    return [];
  }

  _applyReadyValueRule(unit, rt, rule) {
    if (!rule) return 0;
    const p = Math.max(0, Math.min(1, Number(rule.chance ?? 1)));
    if (p < 1 && this.rng() >= p) return 0;

    const targetHero = rule.target === "enemy"
      ? (unit.side === "L" ? this.right : this.left)
      : (unit.side === "L" ? this.left : this.right);
    if (!targetHero) return 0;

    const chosen = this._pickReadyCardsByRule(targetHero, rule);
    if (chosen.length === 0) return 0;

    const hasSet = Number.isFinite(Number(rule.setTo));
    const setTo = hasSet ? Math.max(0, Number(rule.setTo || 0)) : null;
    const delta = Number(rule.delta || 0);
    if (!hasSet && delta === 0) return 0;

    let changed = 0;
    for (let i = 0; i < chosen.length; i += 1) {
      const card = chosen[i];
      const cur = Number(card?.cost ?? card?.baseCost ?? 0);
      const next = hasSet ? setTo : Math.max(0, cur + delta);
      if (next !== cur) {
        card.cost = next;
        changed += 1;
      }
    }

    if (changed > 0) {
      const sideText = rule.target === "enemy"
        ? (unit.side === "L" ? "敵方" : "我方")
        : (unit.side === "L" ? "我方" : "敵方");
      if (hasSet) {
        this._log(`【${unit.name}】將${sideText}準備值設為${setTo}（${changed}張）`);
      } else {
        const sign = delta > 0 ? "+" : "";
        this._log(`【${unit.name}】影響${sideText}準備值 ${sign}${delta}（${changed}張）`);
      }
    }

    return changed;
  }

  _findAdjacentEmptyCells(row, col) {
    const cells = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const rr = row + dr;
        const cc = col + dc;
        if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS) continue;
        if (this.board[rr][cc]) continue;
        cells.push({ row: rr, col: cc });
      }
    }
    return cells;
  }

  _createTokenUnit(side, row, col, name, hp, atk, abilities = [], sourceUnit = null) {
    const abilityList = Array.isArray(abilities)
      ? abilities.map((x) => safeStr(x)).filter((x) => x)
      : [];
    const runtime = this._runtimeFromAbilities(abilityList);
    const dieAfterAttack = abilityList.some((x) => /骤现|驟現/.test(x));

    const sourceName = safeStr(sourceUnit?.name || "");
    const sourceId = safeStr(sourceUnit?.cardId || "");

    const movableByAbility = abilityList.some((x) => /速度|疾風步|疾风步|移動|移动/.test(String(x || "")));

    return {
      side,
      isToken: true,
      cardId: "",
      name: safeStr(name || "召喚物"),
      image: "",
      description: sourceName
        ? `衍生召喚單位（召喚來源：${sourceName}${sourceId ? ` / ${sourceId}` : ""}）`
        : "衍生召喚單位",
      phyle: 0,
      quality: 0,
      summonCost: 0,
      ability1: abilityList[0] || "",
      ability2: abilityList[1] || "",
      ability3: abilityList[2] || "",
      ability4: abilityList[3] || "",
      ability5: abilityList[4] || "",
      abilities: abilityList,
      effectTokens: [],
      runtime,
      baseAtk: Math.max(1, Number(atk || 1)),
      baseMaxHp: Math.max(1, Number(hp || 1)),
      bonusAtkFlat: 0,
      bonusMaxHpFlat: 0,
      auraAtkFlat: 0,
      auraMaxHpFlat: 0,
      hp: Math.max(1, Number(hp || 1)),
      maxHp: Math.max(1, Number(hp || 1)),
      atk: Math.max(1, Number(atk || 1)),
      row,
      col,
      status: {
        skipSteps: 0,
        slowSteps: 0,
        noMoveSteps: 0,
        noAttackSteps: 0,
        silenceSteps: 0,
        atkDebuff: 0,
        poisonSteps: 0,
        poisonDamage: 0,
        burnSteps: 0,
        burnDamage: 0,
        dotSteps: 0,
        dotDamage: 0,
        dotType: "physical",
        noMove: !movableByAbility,
        cannotCombat: false,
        cowAuraLocked: false,
        firstActionDone: false,
        dieAfterAttack
      },
      reviveUsed: false,
      auraBackup: null,
      activeStatuses: [],
      summonedByName: sourceName || "",
      summonedByCardId: sourceId || ""
    };
  }

  _applyCowAuraToUnit(unit) {
    if (!unit || unit.hp <= 0) return;
    if (unit.status?.cowAuraLocked) return;

    unit.auraBackup = {
      name: unit.name,
      maxHp: unit.maxHp,
      hp: unit.hp,
      atk: unit.atk,
      abilities: Array.isArray(unit.abilities) ? [...unit.abilities] : [],
      ability1: unit.ability1 || "",
      ability2: unit.ability2 || "",
      ability3: unit.ability3 || "",
      ability4: unit.ability4 || "",
      ability5: unit.ability5 || "",
      runtime: { ...(unit.runtime || createRuntime()) },
      baseAtk: unit.baseAtk,
      baseMaxHp: unit.baseMaxHp,
      bonusAtkFlat: unit.bonusAtkFlat,
      bonusMaxHpFlat: unit.bonusMaxHpFlat,
      auraAtkFlat: unit.auraAtkFlat,
      auraMaxHpFlat: unit.auraMaxHpFlat
    };

    unit.name = "乳牛";
    unit.maxHp = 2;
    unit.hp = Math.min(unit.hp, 2);
    unit.atk = 2;
    unit.abilities = ["乳牛化", "不能戰鬥"];
    unit.ability1 = "乳牛化";
    unit.ability2 = "不能戰鬥";
    unit.ability3 = "";
    unit.ability4 = "";
    unit.ability5 = "";
    unit.runtime = createRuntime();
    unit.status.cowAuraLocked = true;
    unit.status.cannotCombat = true;
  }

  _removeCowAuraFromUnit(unit) {
    if (!unit || !unit.status?.cowAuraLocked) return;
    const backup = unit.auraBackup;
    if (backup) {
      unit.name = backup.name;
      unit.maxHp = backup.maxHp;
      unit.hp = Math.min(unit.hp, backup.hp, unit.maxHp);
      unit.atk = backup.atk;
      unit.abilities = Array.isArray(backup.abilities) ? [...backup.abilities] : [];
      unit.ability1 = backup.ability1 || "";
      unit.ability2 = backup.ability2 || "";
      unit.ability3 = backup.ability3 || "";
      unit.ability4 = backup.ability4 || "";
      unit.ability5 = backup.ability5 || "";
      unit.runtime = { ...(backup.runtime || createRuntime()) };
      unit.baseAtk = Number(backup.baseAtk ?? unit.baseAtk ?? unit.atk ?? 1);
      unit.baseMaxHp = Number(backup.baseMaxHp ?? unit.baseMaxHp ?? unit.maxHp ?? 1);
      unit.bonusAtkFlat = Number(backup.bonusAtkFlat ?? unit.bonusAtkFlat ?? 0);
      unit.bonusMaxHpFlat = Number(backup.bonusMaxHpFlat ?? unit.bonusMaxHpFlat ?? 0);
      unit.auraAtkFlat = Number(backup.auraAtkFlat ?? 0);
      unit.auraMaxHpFlat = Number(backup.auraMaxHpFlat ?? 0);
    }
    unit.status.cowAuraLocked = false;
    unit.status.cannotCombat = false;
    unit.auraBackup = null;
  }

  _syncCowAuraEffects() {
    const units = this._allUnits();
    const leftHasAura = units.some((u) => u.side === "L" && u.hp > 0 && u.runtime?.auraEnemyTransformCow);
    const rightHasAura = units.some((u) => u.side === "R" && u.hp > 0 && u.runtime?.auraEnemyTransformCow);

    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      if (u.hp <= 0) continue;

      const affected = (u.side === "L" && rightHasAura) || (u.side === "R" && leftHasAura);
      if (affected) this._applyCowAuraToUnit(u);
      else this._removeCowAuraFromUnit(u);
    }
  }

  _computeAllyCountAuras() {
    const aliveUnits = this._allUnits().filter((u) => u && u.hp > 0);

    for (let i = 0; i < aliveUnits.length; i += 1) {
      const u = aliveUnits[i];
      if (u.status?.cowAuraLocked) {
        u.auraAtkFlat = 0;
        u.auraMaxHpFlat = 0;
        continue;
      }
      const buffs = Array.isArray(u.runtime?.allyCountBuffs) ? u.runtime.allyCountBuffs : [];
      let auraAtk = 0;
      let auraHp = 0;

      for (let j = 0; j < buffs.length; j += 1) {
        const b = buffs[j];
        const raceIds = Array.isArray(b.raceIds) ? b.raceIds : [];
        const allyCount = aliveUnits.filter((x) => (
          x.side === u.side &&
          (raceIds.length === 0 || raceIds.includes(Number(x.phyle || 0)))
        )).length;
        auraAtk += Math.max(0, Number(b.atkPer || 0)) * allyCount;
        auraHp += Math.max(0, Number(b.hpPer || 0)) * allyCount;
      }

      u.auraAtkFlat = auraAtk;
      u.auraMaxHpFlat = auraHp;
    }

    for (let i = 0; i < aliveUnits.length; i += 1) {
      const u = aliveUnits[i];
      if (u.status?.cowAuraLocked) continue;
      const nextMaxHp = Math.max(
        1,
        Number(u.baseMaxHp || u.maxHp || 1) +
        Number(u.bonusMaxHpFlat || 0) +
        Number(u.auraMaxHpFlat || 0)
      );
      const nextAtk = Math.max(
        1,
        Number(u.baseAtk || u.atk || 1) +
        Number(u.bonusAtkFlat || 0) +
        Number(u.auraAtkFlat || 0)
      );
      u.maxHp = nextMaxHp;
      if (u.hp > u.maxHp) u.hp = u.maxHp;
      u.atk = nextAtk;
    }
  }

  _applyStartStepAuras() {
    const events = [];
    const units = this._allUnits();

    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      const rt = this._buildEffectiveRuntime(u);

      const firstActionRules = Array.isArray(rt.firstActionRules) ? rt.firstActionRules : [];
      if (firstActionRules.length > 0 && !u.status?.firstActionDone && u.hp > 0) {
        for (let f = 0; f < firstActionRules.length; f += 1) {
          const rule = firstActionRules[f];
          if (!rule) continue;
          if (rule.type === "enemy_aoe_damage") {
            this._applyActionEnemyAoeRule(u, rule, events, "首次行動");
          } else if (rule.type === "ally_team_buff") {
            this._applyActionAllyTeamBuffRule(u, rule, "首次行動");
          } else if (rule.type === "ally_team_heal") {
            this._applyActionAllyTeamHealRule(u, rule, "首次行動");
          } else if (rule.type === "kill_all_flying_enemies") {
            this._applyFirstActionKillFlyingEnemies(u, events);
          }
        }
        u.status.firstActionDone = true;
      }

      const selfBuffRules = Array.isArray(rt.onStepSelfBuffRules) ? rt.onStepSelfBuffRules : [];
      if (selfBuffRules.length > 0 && u.hp > 0) {
        let addAtk = 0;
        let addHp = 0;
        for (let b = 0; b < selfBuffRules.length; b += 1) {
          const r = selfBuffRules[b];
          if (!r) continue;
          addAtk += Math.max(0, Number(r.atk || 0));
          addHp += Math.max(0, Number(r.hp || 0));
        }
        if (addAtk > 0 || addHp > 0) {
          u.bonusAtkFlat = Number(u.bonusAtkFlat || 0) + addAtk;
          u.bonusMaxHpFlat = Number(u.bonusMaxHpFlat || 0) + addHp;
          this._computeAllyCountAuras();
          if (addHp > 0) u.hp = Math.min(u.maxHp, u.hp + addHp);
          this._log(`【${u.name}】行動時成長 ATK+${addAtk} HP+${addHp}`);
        }
      }

      const onActionEnemyAoeRules = Array.isArray(rt.onActionEnemyAoeRules) ? rt.onActionEnemyAoeRules : [];
      for (let aoeIdx = 0; aoeIdx < onActionEnemyAoeRules.length; aoeIdx += 1) {
        this._applyActionEnemyAoeRule(u, onActionEnemyAoeRules[aoeIdx], events, "行動時");
      }

      const onActionAllyTeamBuffRules = Array.isArray(rt.onActionAllyTeamBuffRules) ? rt.onActionAllyTeamBuffRules : [];
      for (let buffIdx = 0; buffIdx < onActionAllyTeamBuffRules.length; buffIdx += 1) {
        this._applyActionAllyTeamBuffRule(u, onActionAllyTeamBuffRules[buffIdx], "行動時");
      }

      const onActionAllyTeamHealRules = Array.isArray(rt.onActionAllyTeamHealRules) ? rt.onActionAllyTeamHealRules : [];
      for (let healIdx = 0; healIdx < onActionAllyTeamHealRules.length; healIdx += 1) {
        this._applyActionAllyTeamHealRule(u, onActionAllyTeamHealRules[healIdx], "行動時");
      }

      const onActionStatusTransferRules = Array.isArray(rt.onActionStatusTransferRules) ? rt.onActionStatusTransferRules : [];
      for (let trIdx = 0; trIdx < onActionStatusTransferRules.length; trIdx += 1) {
        this._applyActionStatusTransferRule(u, onActionStatusTransferRules[trIdx], "行動時");
      }

      const onActionCleanseRules = Array.isArray(rt.onActionCleanseRules) ? rt.onActionCleanseRules : [];
      for (let clIdx = 0; clIdx < onActionCleanseRules.length; clIdx += 1) {
        this._applyActionCleanseRule(u, onActionCleanseRules[clIdx], "行動時");
      }

      const onActionEnemyDispelRules = Array.isArray(rt.onActionEnemyDispelRules) ? rt.onActionEnemyDispelRules : [];
      for (let dpIdx = 0; dpIdx < onActionEnemyDispelRules.length; dpIdx += 1) {
        this._applyActionEnemyDispelRule(u, onActionEnemyDispelRules[dpIdx], "行動時");
      }

      const onActionTransformRules = Array.isArray(rt.onActionTransformRules) ? rt.onActionTransformRules : [];
      let transformedThisStep = false;
      for (let tfIdx = 0; tfIdx < onActionTransformRules.length; tfIdx += 1) {
        if (this._applyActionTransformRule(u, onActionTransformRules[tfIdx], "行動時")) {
          transformedThisStep = true;
          break;
        }
      }
      if (transformedThisStep) continue;

      const stepRules = Array.isArray(rt.stepDamageRules) ? rt.stepDamageRules : [];
      if (stepRules.length > 0) {
        for (let sr = 0; sr < stepRules.length; sr += 1) {
          const rule = stepRules[sr];
          if (!rule) continue;
          const dmgType = String(rule.damageType || this._inferDamageTypeForUnit(u));
          const dmg = Math.max(1, Number(rule.damage || 0));
          if (rule.mode === "all_enemy_units") {
            const enemies = this._enemyUnits(u.side).filter((x) => x.hp > 0);
            for (let e = 0; e < enemies.length; e += 1) {
              const target = enemies[e];
              const dealt = this._dealDamageToUnit(target, dmg, u, dmgType);
              if (dealt <= 0) continue;
              this._log(`【${u.name}】回合傷害【${target.name}】-${dealt}`);
              events.push({
                side: u.side,
                fromRow: u.row,
                fromCol: u.col,
                toRow: target.row,
                toCol: target.col,
                damage: dealt,
                targetType: "unit",
                damageType: dmgType
              });
            }
          } else {
            const enemies = this._enemyUnits(u.side).filter((x) => x.hp > 0);
            const pool = [...enemies];
            if (rule.canHitHero) {
              const heroSide = u.side === "L" ? "R" : "L";
              pool.push({ __hero__: true, side: heroSide, name: heroSide === "L" ? "我方英雄" : "敵方英雄" });
            }
            const need = Math.max(1, Number(rule.randomCount || 1));
            let hitCount = 0;
            while (pool.length > 0 && hitCount < need) {
              const idx = Math.floor(this.rng() * pool.length);
              const target = pool[idx];
              pool.splice(idx, 1);
              if (target.__hero__) {
                const dealt = this._applyHeroDamage(target.side, dmg, u.side);
                if (dealt > 0) this._log(`【${u.name}】回合傷害【${target.name}】-${dealt}`);
              } else {
                const dealt = this._dealDamageToUnit(target, dmg, u, dmgType);
                if (dealt > 0) {
                  this._log(`【${u.name}】回合傷害【${target.name}】-${dealt}`);
                  events.push({
                    side: u.side,
                    fromRow: u.row,
                    fromCol: u.col,
                    toRow: target.row,
                    toCol: target.col,
                    damage: dealt,
                    targetType: "unit",
                    damageType: dmgType
                  });
                }
              }
              hitCount += 1;
            }
          }
        }
      } else if (rt.onStepDamage > 0) {
        const enemies = this._enemyUnits(u.side);
        if (enemies.length > 0) {
          const target = enemies[Math.floor(this.rng() * enemies.length)];
          const dealt = this._dealDamageToUnit(target, rt.onStepDamage, u);
          if (dealt > 0) {
            this._log(`【${u.name}】回合傷害【${target.name}】-${dealt}`);
            events.push({
              side: u.side,
              fromRow: u.row,
              fromCol: u.col,
              toRow: target.row,
              toCol: target.col,
              damage: dealt,
              targetType: "unit",
              damageType: this._inferDamageTypeForUnit(u)
            });
          }
        }
      }

      if (rt.onStepHeal > 0) {
        const allies = this._allyUnits(u.side).filter((x) => x.hp < x.maxHp);
        if (allies.length > 0) {
          allies.sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp));
          const healed = this._healUnit(allies[0], rt.onStepHeal);
          if (healed > 0) this._log(`【${u.name}】治療【${allies[0].name}】+${healed}`);
        }
      }

      if (rt.onStepDraw > 0) {
        const hero = u.side === "L" ? this.left : this.right;
        const before = Array.isArray(hero?.ready) ? hero.ready.length : 0;
        const ret = this.cardSystem.draw(hero, rt.onStepDraw);
        const after = Array.isArray(hero?.ready) ? hero.ready.length : before;
        const drawn = Number.isFinite(Number(ret)) ? Number(ret) : Math.max(0, after - before);
        if (drawn > 0) this._log(`【${u.name}】為${u.side === "L" ? "我方" : "敵方"}加入準備欄卡牌 x${drawn}`);
      }

      const readyRules = Array.isArray(rt.readyValueRules) ? rt.readyValueRules : [];
      for (let r = 0; r < readyRules.length; r += 1) {
        this._applyReadyValueRule(u, rt, readyRules[r]);
      }
    }

    if (events.length > 0 && this.boardUI && typeof this.boardUI.playAttackEffects === "function") {
      this.boardUI.playAttackEffects(events);
    }
  }

  _applyActionEnemyAoeRule(unit, rule, events, logPrefix = "行動時") {
    if (!unit || !rule || unit.hp <= 0) return 0;
    const dmgType = String(rule.damageType || this._inferDamageTypeForUnit(unit));
    let dmg = Math.max(1, Number(rule.damage || 0));
    if (Number.isFinite(Number(rule.minDamage)) && Number.isFinite(Number(rule.maxDamage))) {
      const lo = Math.max(1, Number(rule.minDamage || 1));
      const hi = Math.max(lo, Number(rule.maxDamage || lo));
      dmg = lo + Math.floor(this.rng() * (hi - lo + 1));
    }
    let totalHits = 0;

    const enemies = this._enemyUnits(unit.side).filter((x) => x.hp > 0);
    for (let i = 0; i < enemies.length; i += 1) {
      const target = enemies[i];
      const dealt = this._dealDamageToUnit(target, dmg, unit, dmgType);
      if (dealt <= 0) continue;
      totalHits += 1;
      this._log(`【${unit.name}】${logPrefix}傷害【${target.name}】-${dealt}`);
      events.push({
        side: unit.side,
        fromRow: unit.row,
        fromCol: unit.col,
        toRow: target.row,
        toCol: target.col,
        damage: dealt,
        targetType: "unit",
        damageType: dmgType
      });
    }

    if (rule.canHitHero) {
      const heroSide = unit.side === "L" ? "R" : "L";
      const dealt = this._applyHeroDamage(heroSide, dmg, unit.side);
      if (dealt > 0) {
        totalHits += 1;
        this._log(`【${unit.name}】${logPrefix}傷害【${heroSide === "L" ? "我方英雄" : "敵方英雄"}】-${dealt}`);
      }
    }

    return totalHits;
  }

  _applyActionAllyTeamBuffRule(unit, rule, logPrefix = "行動時") {
    if (!unit || !rule || unit.hp <= 0) return 0;
    const addAtk = Math.max(0, Number(rule.atk || 0));
    const addHp = Math.max(0, Number(rule.hp || 0));
    if (addAtk <= 0 && addHp <= 0) return 0;

    const allies = this._allyUnits(unit.side).filter((x) => x.hp > 0);
    if (allies.length === 0) return 0;

    for (let i = 0; i < allies.length; i += 1) {
      const target = allies[i];
      target.bonusAtkFlat = Number(target.bonusAtkFlat || 0) + addAtk;
      target.bonusMaxHpFlat = Number(target.bonusMaxHpFlat || 0) + addHp;
    }
    this._computeAllyCountAuras();

    for (let i = 0; i < allies.length; i += 1) {
      const target = allies[i];
      if (addHp > 0) target.hp = Math.min(target.maxHp, target.hp + addHp);
    }

    this._log(`【${unit.name}】${logPrefix}全體增益 ATK+${addAtk} HP+${addHp}`);
    return allies.length;
  }

  _applyActionAllyTeamHealRule(unit, rule, logPrefix = "行動時") {
    if (!unit || !rule || unit.hp <= 0) return 0;
    const heal = Math.max(0, Number(rule.heal || 0));
    if (heal <= 0) return 0;
    const allies = this._allyUnits(unit.side).filter((x) => x.hp > 0 && x.hp < x.maxHp);
    if (allies.length === 0) return 0;
    let affected = 0;
    for (let i = 0; i < allies.length; i += 1) {
      const target = allies[i];
      const v = this._healUnit(target, heal);
      if (v > 0) affected += 1;
    }
    if (affected > 0) this._log(`【${unit.name}】${logPrefix}全體治療 +${heal}`);
    return affected;
  }

  _isFlyingUnit(unit) {
    const text = Array.isArray(unit?.abilities) ? unit.abilities.join(" ") : "";
    return /(飛行|飞行|翱翔|空襲|空袭)/.test(text);
  }

  _applyFirstActionKillFlyingEnemies(unit, events) {
    if (!unit || unit.hp <= 0) return 0;
    const enemies = this._enemyUnits(unit.side).filter((x) => x.hp > 0 && this._isFlyingUnit(x));
    let killed = 0;
    for (let i = 0; i < enemies.length; i += 1) {
      const t = enemies[i];
      t.hp = 0;
      killed += 1;
      this._log(`【${unit.name}】首次行動擊落【${t.name}】`);
      events.push({
        side: unit.side,
        fromRow: unit.row,
        fromCol: unit.col,
        toRow: t.row,
        toCol: t.col,
        damage: 999,
        targetType: "unit",
        damageType: "physical"
      });
    }
    return killed;
  }

  _extractDebuffEntries(unit) {
    const s = unit?.status || {};
    const out = [];
    if (Number(s.noMoveSteps || 0) > 0) out.push({ key: "noMoveSteps", value: Number(s.noMoveSteps || 0) });
    if (Number(s.noAttackSteps || 0) > 0) out.push({ key: "noAttackSteps", value: Number(s.noAttackSteps || 0) });
    if (Number(s.skipSteps || 0) > 0) out.push({ key: "skipSteps", value: Number(s.skipSteps || 0) });
    if (Number(s.silenceSteps || 0) > 0) out.push({ key: "silenceSteps", value: Number(s.silenceSteps || 0) });
    if (Number(s.slowSteps || 0) > 0) out.push({ key: "slowSteps", value: Number(s.slowSteps || 0) });
    if (Number(s.atkDebuff || 0) > 0) out.push({ key: "atkDebuff", value: Number(s.atkDebuff || 0) });
    if (Number(s.poisonSteps || 0) > 0) out.push({ key: "poisonSteps", value: Number(s.poisonSteps || 0), extraKey: "poisonDamage", extraValue: Number(s.poisonDamage || 0) });
    if (Number(s.burnSteps || 0) > 0) out.push({ key: "burnSteps", value: Number(s.burnSteps || 0), extraKey: "burnDamage", extraValue: Number(s.burnDamage || 0) });
    return out;
  }

  _extractBuffEntries(unit) {
    const out = [];
    if (Number(unit?.bonusAtkFlat || 0) > 0) out.push({ key: "bonusAtkFlat", value: Number(unit.bonusAtkFlat || 0) });
    if (Number(unit?.bonusMaxHpFlat || 0) > 0) out.push({ key: "bonusMaxHpFlat", value: Number(unit.bonusMaxHpFlat || 0) });
    if (Number(unit?.auraAtkFlat || 0) > 0) out.push({ key: "auraAtkFlat", value: Number(unit.auraAtkFlat || 0) });
    if (Number(unit?.auraMaxHpFlat || 0) > 0) out.push({ key: "auraMaxHpFlat", value: Number(unit.auraMaxHpFlat || 0) });
    return out;
  }

  _transferOneDebuff(fromUnit, toUnit) {
    const entries = this._extractDebuffEntries(fromUnit);
    if (entries.length === 0 || !toUnit?.status) return false;
    const picked = entries[Math.floor(this.rng() * entries.length)];
    const sFrom = fromUnit.status;
    const sTo = toUnit.status;
    sTo[picked.key] = Math.max(Number(sTo[picked.key] || 0), Number(picked.value || 0));
    sFrom[picked.key] = 0;
    if (picked.extraKey) {
      sTo[picked.extraKey] = Math.max(Number(sTo[picked.extraKey] || 0), Number(picked.extraValue || 0));
      sFrom[picked.extraKey] = 0;
    }
    return true;
  }

  _transferOneBuff(fromUnit, toUnit) {
    const entries = this._extractBuffEntries(fromUnit);
    if (entries.length === 0 || !toUnit) return false;
    const picked = entries[Math.floor(this.rng() * entries.length)];
    fromUnit[picked.key] = 0;
    toUnit[picked.key] = Number(toUnit[picked.key] || 0) + Number(picked.value || 0);
    this._computeAllyCountAuras();
    if (picked.key === "bonusMaxHpFlat" || picked.key === "auraMaxHpFlat") {
      toUnit.hp = Math.min(toUnit.maxHp, toUnit.hp + Number(picked.value || 0));
      fromUnit.hp = Math.min(fromUnit.hp, fromUnit.maxHp);
    }
    return true;
  }

  _applyActionStatusTransferRule(unit, rule, logPrefix = "行動時") {
    if (!unit || !rule || unit.hp <= 0) return 0;
    let changed = 0;
    if (rule.transferDebuffAllyToEnemy) {
      const allies = this._allyUnits(unit.side).filter((x) => x.hp > 0 && this._extractDebuffEntries(x).length > 0);
      const enemies = this._enemyUnits(unit.side).filter((x) => x.hp > 0);
      if (allies.length > 0 && enemies.length > 0) {
        const fromUnit = allies[Math.floor(this.rng() * allies.length)];
        const toUnit = enemies[Math.floor(this.rng() * enemies.length)];
        if (this._transferOneDebuff(fromUnit, toUnit)) {
          changed += 1;
          this._log(`【${unit.name}】${logPrefix}轉移減益【${fromUnit.name}】->【${toUnit.name}】`);
        }
      }
    }
    if (rule.transferBuffEnemyToAlly) {
      const enemies = this._enemyUnits(unit.side).filter((x) => x.hp > 0 && this._extractBuffEntries(x).length > 0);
      const allies = this._allyUnits(unit.side).filter((x) => x.hp > 0);
      if (enemies.length > 0 && allies.length > 0) {
        const fromUnit = enemies[Math.floor(this.rng() * enemies.length)];
        const toUnit = allies[Math.floor(this.rng() * allies.length)];
        if (this._transferOneBuff(fromUnit, toUnit)) {
          changed += 1;
          this._log(`【${unit.name}】${logPrefix}轉移增益【${fromUnit.name}】->【${toUnit.name}】`);
        }
      }
    }
    if (changed > 0) this._refreshUnitStatusTags();
    return changed;
  }

  _clearOneDebuff(unit) {
    const entries = this._extractDebuffEntries(unit);
    if (entries.length === 0 || !unit?.status) return false;
    const picked = entries[Math.floor(this.rng() * entries.length)];
    unit.status[picked.key] = 0;
    if (picked.extraKey) unit.status[picked.extraKey] = 0;
    return true;
  }

  _clearOneBuff(unit) {
    const entries = this._extractBuffEntries(unit);
    if (entries.length === 0 || !unit) return false;
    const picked = entries[Math.floor(this.rng() * entries.length)];
    unit[picked.key] = 0;
    this._computeAllyCountAuras();
    unit.hp = Math.min(unit.hp, unit.maxHp);
    return true;
  }

  _applyActionCleanseRule(unit, rule, logPrefix = "行動時") {
    if (!unit || !rule || unit.hp <= 0) return 0;
    let changed = 0;
    if (rule.allAllies) {
      const allies = this._allyUnits(unit.side).filter((x) => x.hp > 0);
      for (let i = 0; i < allies.length; i += 1) {
        if (this._clearOneDebuff(allies[i])) changed += 1;
      }
    } else {
      const allies = this._allyUnits(unit.side).filter((x) => x.hp > 0 && this._extractDebuffEntries(x).length > 0);
      if (allies.length > 0) {
        const target = allies[Math.floor(this.rng() * allies.length)];
        if (this._clearOneDebuff(target)) changed += 1;
      }
    }
    if (changed > 0) this._log(`【${unit.name}】${logPrefix}淨化減益 x${changed}`);
    if (changed > 0) this._refreshUnitStatusTags();
    return changed;
  }

  _applyActionEnemyDispelRule(unit, rule, logPrefix = "行動時") {
    if (!unit || !rule || unit.hp <= 0) return 0;
    let changed = 0;
    if (rule.allEnemies) {
      const enemies = this._enemyUnits(unit.side).filter((x) => x.hp > 0);
      for (let i = 0; i < enemies.length; i += 1) {
        if (this._clearOneBuff(enemies[i])) changed += 1;
      }
    } else {
      const enemies = this._enemyUnits(unit.side).filter((x) => x.hp > 0 && this._extractBuffEntries(x).length > 0);
      if (enemies.length > 0) {
        const target = enemies[Math.floor(this.rng() * enemies.length)];
        if (this._clearOneBuff(target)) changed += 1;
      }
    }
    if (changed > 0) this._log(`【${unit.name}】${logPrefix}驅散敵方增益 x${changed}`);
    if (changed > 0) this._refreshUnitStatusTags();
    return changed;
  }

  _findSkeletonTemplateCard(unit) {
    const allCards = Array.isArray(flameCardsBest)
      ? flameCardsBest
      : (Array.isArray(flameCardsBest?.cards) ? flameCardsBest.cards : []);
    const targetName = String(unit?.name || "").trim();
    if (!targetName) return null;
    const sameName = allCards.filter((c) => String(c?.name || "").trim() === targetName && c?.type === "summon");
    const normal = sameName.find((c) => /骷髏|骷髅/.test(String(c?.ability1 || "")) && !/骨堆/.test(String(c?.ability1 || "")) && Number(c?.unit?.atk || 0) > 0 && Number(c?.unit?.hp || 0) > 1);
    if (normal) return normal;
    const fallback = allCards.find((c) => c?.type === "summon" && /骷髏|骷髅/.test(String(c?.name || "")) && /骷髏|骷髅/.test(String(c?.ability1 || "")) && !/骨堆/.test(String(c?.ability1 || "")));
    return fallback || null;
  }

  _getReverseTarotPool() {
    if (Array.isArray(this._reverseTarotPool) && this._reverseTarotPool.length > 0) return this._reverseTarotPool;
    const allCards = Array.isArray(flameCardsBest)
      ? flameCardsBest
      : (Array.isArray(flameCardsBest?.cards) ? flameCardsBest.cards : []);
    const tarotKeywords = [
      "皇后", "战车", "戰车", "愚者", "魔術", "魔術师", "皇帝", "力量", "死亡", "恋人", "戀人",
      "黄金黎明", "黃金黎明", "隱者", "正义", "正義", "星星", "节制", "節制", "高塔", "审判", "審判",
      "魔鬼", "太阳", "太陽", "月亮", "世界", "空白", "女祭司", "倒吊人"
    ];
    const pool = allCards.filter((c) => {
      if (c?.type !== "summon") return false;
      const name = String(c?.name || "");
      if (!/逆位/.test(name)) return false;
      if (String(c?.id || "").trim() === "") return false;
      return tarotKeywords.some((k) => name.includes(k));
    });
    this._reverseTarotPool = pool;
    return pool;
  }

  _canonicalReverseTarotName(cardOrName) {
    const raw = typeof cardOrName === "string"
      ? cardOrName
      : String(cardOrName?.name || "");
    return raw
      .replace(/^逆位\s*/g, "")
      .replace(/（[^）]*）/g, "")
      .replace(/\([^)]*\)/g, "")
      .trim();
  }

  _pickOnePerCanonicalTarot(cards) {
    const groups = new Map();
    for (let i = 0; i < cards.length; i += 1) {
      const c = cards[i];
      const key = this._canonicalReverseTarotName(c);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    const out = [];
    for (const arr of groups.values()) {
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const idx = Math.floor(this.rng() * arr.length);
      out.push(arr[idx]);
    }
    return out;
  }

  _applyActionTransformRule(unit, rule, logPrefix = "行動時") {
    if (!unit || !rule || unit.hp <= 0) return false;
    if (rule.type === "to_skeleton") {
      const card = this._findSkeletonTemplateCard(unit);
      if (!card) return false;
      const row = unit.row;
      const col = unit.col;
      const side = unit.side;
      const next = this._createUnitFromCard(side, card, row, col);
      next.status.firstActionDone = true;
      this.board[row][col] = next;
      this._log(`【${unit.name}】${logPrefix}重組為骷髏【${next.name}】`);
      return true;
    }
    if (rule.type === "to_random_reverse_tarot") {
      if (!/逆位空白/.test(String(unit?.name || ""))) return false;
      let pool = this._getReverseTarotPool().filter((c) => String(c?.id || "") !== String(unit.cardId || ""));
      pool = pool.filter((c) => this._canonicalReverseTarotName(c) !== "空白");
      if (rule.sameQuality) {
        const q = Number(unit?.quality ?? 0);
        const sameQ = pool.filter((c) => Number(c?.quality ?? 0) === q);
        if (sameQ.length > 0) pool = sameQ;
      }
      pool = this._pickOnePerCanonicalTarot(pool);
      if (pool.length === 0) return false;
      const card = pool[Math.floor(this.rng() * pool.length)];
      const row = unit.row;
      const col = unit.col;
      const side = unit.side;
      const next = this._createUnitFromCard(side, card, row, col);
      next.status.firstActionDone = true;
      this.board[row][col] = next;
      this._log(`【${unit.name}】${logPrefix}變化為【${next.name}】`);
      return true;
    }
    return false;
  }

  _applySummonAuras() {
    const units = this._allUnits();
    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      const rt = u.runtime || createRuntime();
      if ((rt.summonPerTurn ?? 0) <= 0) continue;

      const empties = this._findAdjacentEmptyCells(u.row, u.col);
      const alliesSameName = this._allyUnits(u.side).filter((x) => x.name === (rt.summonName || "召喚物")).length;
      const remainByMax = rt.summonMaxAlive > 0 ? Math.max(0, rt.summonMaxAlive - alliesSameName) : Number(rt.summonPerTurn || 0);
      const summonCount = Math.min(Number(rt.summonPerTurn || 0), remainByMax, empties.length);
      for (let k = 0; k < summonCount; k += 1) {
        const slot = empties[k];
        const token = this._createTokenUnit(
          u.side,
          slot.row,
          slot.col,
          rt.summonName || `${u.name}召喚物`,
          rt.summonHp || 1,
          rt.summonAtk || 1,
          rt.summonAbilities || [],
          u
        );
        this.board[slot.row][slot.col] = token;
        const ab = Array.isArray(token.abilities) && token.abilities.length > 0 ? token.abilities.join("/") : "無";
        this._log(`【${u.name}】召喚【${token.name}】@(${slot.row + 1},${slot.col + 1}) 能力:${ab}`);
      }
    }
  }

  _advanceAllUnits() {
    const moves = [];

    for (let r = 0; r < GRID_ROWS; r += 1) {
      for (let c = 0; c < GRID_COLS; c += 1) {
        const u = this.board[r][c];
        if (!u || this._isStunned(u) || this._cannotCombat(u)) continue;
        if (u?.isToken && u?.status?.noMove) continue;
        if (Number(u?.status?.noMoveSteps || 0) > 0) continue;

        const effectiveRt = this._buildEffectiveRuntime(u);
        if (effectiveRt?.noMove) continue;
        const moveSteps = Math.max(1, Number(effectiveRt?.speedSteps ?? 1));
        const dir = u.side === "L" ? 1 : -1;
        let nextCol = c;

        for (let step = 0; step < moveSteps; step += 1) {
          const nc = nextCol + dir;
          if (nc < 0 || nc >= GRID_COLS) break;
          const blocker = this.board[r][nc];
          if (blocker) {
            if (blocker.side === u.side) break;
            if (!effectiveRt?.passThroughEnemy) break;
            continue;
          }
          nextCol = nc;
        }

        if (nextCol !== c) moves.push({ u, fr: r, fc: c, tr: r, tc: nextCol });
      }
    }

    for (let i = 0; i < moves.length; i += 1) {
      const m = moves[i];
      if (this.board[m.fr][m.fc] !== m.u) continue;
      if (this.board[m.tr][m.tc]) continue;
      this.board[m.fr][m.fc] = null;
      m.u.row = m.tr;
      m.u.col = m.tc;
      this.board[m.tr][m.tc] = m.u;
    }
  }

  _findFirstEnemyInRange(attacker) {
    const dir = attacker.side === "L" ? 1 : -1;
    const attackerRt = this._buildEffectiveRuntime(attacker);
    const range = Math.max(1, Number(attackerRt?.rangeCells ?? 1));

    for (let d = 1; d <= range; d += 1) {
      const tc = attacker.col + dir * d;
      if (tc < 0 || tc >= GRID_COLS) break;
      const target = this.board[attacker.row][tc];
      if (!target) continue;
      if (target.side === attacker.side) break;
      return target;
    }
    return null;
  }

  _applyOnHitDebuffs(attacker, target) {
    const rt = this._buildEffectiveRuntime(attacker);

    if (this.rng() < (rt.onHitStunChance ?? 0)) {
      target.status.skipSteps = Math.max(target.status.skipSteps, rt.onHitStunSteps ?? 1);
      this._log(`【${target.name}】暈眩`);
    }

    if (this.rng() < (rt.onHitSlowChance ?? 0)) {
      target.status.slowSteps = Math.max(target.status.slowSteps, rt.onHitSlowSteps ?? 1);
      target.status.atkDebuff = Math.max(target.status.atkDebuff, rt.onHitSlowAtkDown ?? 1);
      this._log(`【${target.name}】減速`);
    }

    if ((rt.poisonDamage ?? 0) > 0) {
      target.status.poisonDamage = Math.max(target.status.poisonDamage, rt.poisonDamage);
      target.status.poisonSteps = Math.max(target.status.poisonSteps, rt.poisonSteps || 2);
    }

    if ((rt.burnDamage ?? 0) > 0) {
      target.status.burnDamage = Math.max(target.status.burnDamage, rt.burnDamage);
      target.status.burnSteps = Math.max(target.status.burnSteps, rt.burnSteps || 2);
    }

    if ((rt.knockbackOnHit ?? 0) > 0) {
      this._applyKnockback(target, attacker.side, rt.knockbackOnHit);
    }
  }

  _applyKnockback(target, attackerSide, cells) {
    if (!target || target.hp <= 0) return;
    const dir = attackerSide === "L" ? 1 : -1;
    const steps = Math.max(1, Number(cells || 1));
    let moved = 0;

    for (let i = 0; i < steps; i += 1) {
      const nextCol = target.col + dir;
      if (nextCol < 0 || nextCol >= GRID_COLS) break;
      if (this.board[target.row][nextCol]) break;

      this.board[target.row][target.col] = null;
      target.col = nextCol;
      this.board[target.row][target.col] = target;
      moved += 1;
    }

    if (moved > 0) {
      this._log(`【${target.name}】被?退 ${moved} 格`);
    }
  }

  _runtimeFromAbilities(abilities) {
    const runtime = createRuntime();
    const seen = new Set();
    const specialState = { hasSummonSpec: false };
    for (let i = 0; i < abilities.length; i += 1) {
      const src = safeStr(abilities[i]);
      if (!src || seen.has(src)) continue;
      seen.add(src);

      const parts = src.split(/[・・]/);
      const key = safeStr(parts[0]);
      const value = pickTrailingNumber(key, parsePlusNumber(src, 1));
      const token = { src, key, detail: safeStr(parts.slice(1).join("・")), value };
      const rule = resolveEffectRule(token);
      applyRule(runtime, rule, token.value);
      this._applySpecialAbilityPrograms(token, runtime, specialState);
    }
    if (!specialState.hasSummonSpec) {
      runtime.summonPerTurn = 0;
      runtime.summonMaxAlive = 0;
      runtime.summonAbilities = [];
    }
    finalizeRuntime(runtime);
    return runtime;
  }

  _transformToFlyingSword(unit) {
    if (!unit || unit.hp <= 0) return;
    unit.name = "辟｡迹暮｣帛轄";
    unit.baseMaxHp = 1;
    unit.baseAtk = 3;
    unit.bonusAtkFlat = 0;
    unit.bonusMaxHpFlat = 0;
    unit.auraAtkFlat = 0;
    unit.auraMaxHpFlat = 0;
    unit.maxHp = 1;
    unit.hp = Math.min(unit.hp, 1);
    unit.atk = 3;
    unit.abilities = ["疾风步", "飞溅", "骤现", "无瑕屏障"];
    unit.ability1 = "疾风步";
    unit.ability2 = "飞溅";
    unit.ability3 = "骤现";
    unit.ability4 = "无瑕屏障";
    unit.ability5 = "";
    unit.runtime = this._runtimeFromAbilities(unit.abilities);
    this._computeAllyCountAuras();
  }

  _findHeroGuardian(side) {
    const allies = this._allyUnits(side);
    const guards = allies.filter((u) => Number(this._buildEffectiveRuntime(u)?.heroGuard ?? 0) > 0 && u.hp > 0);
    if (guards.length === 0) return null;
    guards.sort((a, b) => b.hp - a.hp);
    return guards[0];
  }

  _applyHeroDamage(side, rawDamage, attackerSide) {
    const hero = side === "L" ? this.left : this.right;
    const guard = this._findHeroGuardian(side);

    if (guard) {
      const guardRt = this._buildEffectiveRuntime(guard);
      const reduced = Math.max(0, rawDamage - Number(guardRt.heroGuard || 0));
      const dealt = this._dealDamageToUnit(guard, reduced, null);
      this._log(`【${guard.name}】替英雄承傷 ${dealt}`);
      return 0;
    }

    hero.hp = Math.max(0, hero.hp - rawDamage);
    return rawDamage;
  }

  _attackAllUnits() {
    this._computeAllyCountAuras();
    const attackEvents = [];
    let dmgToLeftHero = 0;
    let dmgToRightHero = 0;

    const ordered = this._allUnits();

    for (let i = 0; i < ordered.length; i += 1) {
      const attacker = ordered[i];
      if (!attacker || attacker.hp <= 0 || this._isStunned(attacker) || this._cannotCombat(attacker)) continue;
      if (Number(attacker?.status?.noAttackSteps || 0) > 0) continue;

      const attackerRt = this._buildEffectiveRuntime(attacker);
      const strikes = Math.max(1, Number(attackerRt?.attackPerStep ?? 1));
      let attackedThisStep = false;
      for (let k = 0; k < strikes; k += 1) {
        const target = this._findFirstEnemyInRange(attacker);
        const attackerAtk = this._calcUnitAtk(attacker);

        if (target) {
          attackedThisStep = true;
          let damage = attackerAtk;
          if (this.rng() < (attackerRt?.critChance ?? 0)) {
            damage = Math.floor(damage * (attackerRt?.critMul ?? 1.5));
          }

          const dealt = this._dealDamageToUnit(target, damage, attacker);
          if (dealt > 0) {
            this._log(`【${attacker.name}】攻?【${target.name}】-${dealt}`);
            attackEvents.push({
              side: attacker.side,
              fromRow: attacker.row,
              fromCol: attacker.col,
              toRow: target.row,
              toCol: target.col,
              damage: dealt,
              targetType: "unit",
              damageType: this._inferDamageTypeForUnit(attacker)
            });

            if (attackerRt?.splashBehind) {
              const dir = attacker.side === "L" ? 1 : -1;
              const bc = target.col + dir;
              if (bc >= 0 && bc < GRID_COLS) {
                const behind = this.board[target.row][bc];
                if (behind && behind.side !== attacker.side) {
                  const splashDmg = this._dealDamageToUnit(behind, Math.max(1, Math.floor(dealt * 0.6)), attacker);
                  if (splashDmg > 0) {
                    this._log(`【${attacker.name}】飛濺到【${behind.name}】-${splashDmg}`);
                    attackEvents.push({
                      side: attacker.side,
                      fromRow: attacker.row,
                      fromCol: attacker.col,
                      toRow: behind.row,
                      toCol: behind.col,
                      damage: splashDmg,
                      targetType: "unit",
                      damageType: this._inferDamageTypeForUnit(attacker)
                    });
                  }
                }
              }
            }

            this._applyOnHitDebuffs(attacker, target);

            const ls = attackerRt?.lifestealPct ?? 0;
            if (ls > 0) {
              const heal = Math.max(1, Math.floor(dealt * ls));
              const realHeal = this._healUnit(attacker, heal);
              if (realHeal > 0) this._log(`【${attacker.name}】吸血 +${realHeal}`);
            }

            if ((attackerRt?.onAttackGainAtk ?? 0) > 0) {
              attacker.bonusAtkFlat = Number(attacker.bonusAtkFlat || 0) + Number(attackerRt.onAttackGainAtk || 0);
              this._computeAllyCountAuras();
              this._log(`【${attacker.name}】攻?後成長 ATK+${attackerRt.onAttackGainAtk}`);
            }
          }
        } else {
          const dir = attacker.side === "L" ? 1 : -1;
          const fc = attacker.col + dir;
          if (fc < 0) {
            dmgToLeftHero += attackerAtk;
            attackedThisStep = true;
          }
          if (fc >= GRID_COLS) {
            dmgToRightHero += attackerAtk;
            attackedThisStep = true;
          }
        }
      }

      if (attackedThisStep && attacker.status?.dieAfterAttack && attacker.hp > 0) {
        attacker.hp = 0;
        this._log(`【${attacker.name}】因驟現在攻?後消失`);
      }
    }

    if (dmgToLeftHero > 0) {
      const heroDealt = this._applyHeroDamage("L", dmgToLeftHero, "R");
      if (heroDealt > 0) this._log(`我方英雄受傷 -${heroDealt}（${this.left.hp}/${HERO_HP}）`);
    }
    if (dmgToRightHero > 0) {
      const heroDealt = this._applyHeroDamage("R", dmgToRightHero, "L");
      if (heroDealt > 0) this._log(`敵方英雄受傷 -${heroDealt}（${this.right.hp}/${HERO_HP}）`);
    }

    if (attackEvents.length > 0 && this.boardUI && typeof this.boardUI.playAttackEffects === "function") {
      this.boardUI.playAttackEffects(attackEvents);
    }
  }

  _applyEndStepDots() {
    const units = this._allUnits();
    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      if (u.status.poisonSteps > 0 && u.status.poisonDamage > 0) {
        const dealt = this._dealDamageToUnit(u, u.status.poisonDamage, null);
        if (dealt > 0) this._log(`【${u.name}】中毒傷害 -${dealt}`);
      }
      if (u.status.burnSteps > 0 && u.status.burnDamage > 0) {
        const dealt = this._dealDamageToUnit(u, u.status.burnDamage, null);
        if (dealt > 0) this._log(`【${u.name}】燃燒傷害 -${dealt}`);
      }
      if (u.status.dotSteps > 0 && u.status.dotDamage > 0) {
        const dealt = this._dealDamageToUnit(u, u.status.dotDamage, null, String(u.status.dotType || "physical"));
        if (dealt > 0) this._log(`【${u.name}】持續傷害 -${dealt}`);
      }
    }
  }

  _tickStatus() {
    const units = this._allUnits();
    for (let i = 0; i < units.length; i += 1) {
      const s = units[i].status;
      if (s.skipSteps > 0) s.skipSteps -= 1;
      if (s.noMoveSteps > 0) s.noMoveSteps -= 1;
      if (s.noAttackSteps > 0) s.noAttackSteps -= 1;
      if (s.silenceSteps > 0) s.silenceSteps -= 1;

      if (s.slowSteps > 0) {
        s.slowSteps -= 1;
        if (s.slowSteps === 0) s.atkDebuff = 0;
      }

      if (s.poisonSteps > 0) {
        s.poisonSteps -= 1;
        if (s.poisonSteps === 0) s.poisonDamage = 0;
      }

      if (s.burnSteps > 0) {
        s.burnSteps -= 1;
        if (s.burnSteps === 0) s.burnDamage = 0;
      }
      if (s.dotSteps > 0) {
        s.dotSteps -= 1;
        if (s.dotSteps === 0) {
          s.dotDamage = 0;
          s.dotType = "physical";
        }
      }
    }
  }

  _cleanupDead() {
    const deadUnits = [];
    for (let r = 0; r < GRID_ROWS; r += 1) {
      for (let c = 0; c < GRID_COLS; c += 1) {
        const u = this.board[r][c];
        if (u && u.hp <= 0) {
          const reviveChance = Math.max(0, Number(u?.runtime?.reviveChance ?? 0));
          if (reviveChance > 0 && !u.reviveUsed && this.rng() < reviveChance) {
            u.reviveUsed = true;
            u.hp = Math.max(1, Math.floor(u.maxHp * 0.5));
            this._log(`【${u.name}】復活（${u.hp}/${u.maxHp}）`);
            continue;
          }
          this._log(`【${u.name}】死亡`);
          this._pushUnitToGrave(u);
          deadUnits.push({ side: u.side, row: r, col: c, name: u.name });
          this.board[r][c] = null;
        }
      }
    }

    if (deadUnits.length > 0) {
      const alive = this._allUnits();
      for (let i = 0; i < alive.length; i += 1) {
        const caster = alive[i];
        if (!caster?.runtime?.transformOnAllyDeath) continue;

        const hasAllyDead = deadUnits.some((d) => d.side === caster.side);
        if (!hasAllyDead) continue;

        this._transformToFlyingSword(caster);
        this._log(`【${caster.name}】友軍死亡後轉化為飛劍`);
      }
    }

    this._computeAllyCountAuras();
  }

  _pushUnitToGrave(unit) {
    if (!unit) return;
    const ownerHero = unit.side === "L" ? this.left : this.right;
    if (!ownerHero) return;
    const fallbackId = `token_${safeStr(unit.name || "unit") || "unit"}`;
    ownerHero.grave.push({
      id: String(unit.cardId || fallbackId),
      name: String(unit.name || unit.cardId || "未知卡"),
      type: "summon",
      image: String(unit.image || ""),
      baseCost: Math.max(0, Number(unit.summonCost ?? 0)),
      cost: Math.max(0, Number(unit.summonCost ?? 0)),
      unit: {
        hp: Math.max(1, Number(unit.baseMaxHp ?? unit.maxHp ?? 1)),
        atk: Math.max(1, Number(unit.baseAtk ?? unit.atk ?? 1))
      }
    });
  }

  _buildAuraStatusLinesForUnit(unit) {
    const allies = this._allyUnits(unit.side).filter((u) => u !== unit && u.hp > 0);
    const lines = [];
    const seen = new Set();

    for (let i = 0; i < allies.length; i += 1) {
      const ally = allies[i];
      const effects = Array.isArray(ally.abilities) ? ally.abilities : [];
      for (let j = 0; j < effects.length; j += 1) {
        const raw = safeStr(effects[j]);
        if (!raw || !isAuraEffectText(raw)) continue;

        const key = normalizeEffectName(raw);
        const value = parsePlusNumber(raw, pickTrailingNumber(raw, 1));

        let label = key || "光環";
        if (/恢?|恢復|治?|治療/.test(raw)) label = `恢復光環(+${value})`;
        else if (/攻?|攻?|ATK|atk/.test(raw)) label = `攻?光環(+${value})`;
        else if (/生命|HP|护甲|護甲|防御|防禦/.test(raw)) label = `守護光環(+${value})`;

        const line = `${label}（來源:${ally.name}）`;
        if (!seen.has(line)) {
          seen.add(line);
          lines.push(line);
        }
      }
    }

    return lines;
  }

  _buildDebuffStatusLinesForUnit(unit) {
    const s = unit?.status || {};
    const lines = [];
    if (unit?.summonedByName) lines.push(`召喚來源：${unit.summonedByName}`);
    if (s.dieAfterAttack) lines.push("驟現：攻?後會消失");
    if (s.cowAuraLocked) lines.push("崇拜光環：已乳牛化（2/2，不能戰鬥）");
    if (s.cannotCombat && !s.cowAuraLocked) lines.push("不能戰鬥");
    if ((s.skipSteps ?? 0) > 0) lines.push(`暈眩：${s.skipSteps} 回合`);
    if ((s.noMoveSteps ?? 0) > 0) lines.push(`禁移動：${s.noMoveSteps} 回合`);
    if ((s.noAttackSteps ?? 0) > 0) lines.push(`禁攻擊：${s.noAttackSteps} 回合`);
    if ((s.silenceSteps ?? 0) > 0) lines.push(`沉默：${s.silenceSteps} 回合`);
    if ((s.slowSteps ?? 0) > 0) lines.push(`減速：${s.slowSteps} 回合（ATK-${s.atkDebuff || 0}）`);
    if ((s.poisonSteps ?? 0) > 0) lines.push(`中毒：?回合 ${s.poisonDamage || 0}（剩 ${s.poisonSteps}）`);
    if ((s.burnSteps ?? 0) > 0) lines.push(`燃燒：?回合 ${s.burnDamage || 0}（剩 ${s.burnSteps}）`);
    return lines;
  }

  _refreshUnitStatusTags() {
    const units = this._allUnits();
    for (let i = 0; i < units.length; i += 1) {
      const u = units[i];
      const auraLines = this._buildAuraStatusLinesForUnit(u);
      const debuffLines = this._buildDebuffStatusLinesForUnit(u);
      u.activeStatuses = [...auraLines, ...debuffLines].slice(0, 8);
    }
  }

  _log(line) {
    this.logs.push(line);
    if (this.logs.length > 400) this.logs.shift();
  }

  _notifyFull() {
    this._refreshUnitStatusTags();
    if (this.scene && typeof this.scene.onBattleState === "function") {
      this.scene.onBattleState({
        left: this.left,
        right: this.right,
        turnSide: this.turnSide,
        turnCount: this.turnCount,
        logs: [...this.logs]
      });
    }
  }
}


