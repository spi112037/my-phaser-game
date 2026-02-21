const fs = require("fs");
const path = require("path");

const filePath =
  process.argv[2] || path.resolve("d:/pray/my-phaser-game/src/data/flameCardsBest.json");

const raceMap = {
  0: "未知",
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
  11: "惡魔",
  100: "戰士",
  101: "遊俠",
  102: "法師",
  103: "牧師"
};

const roleTokens = [
  { k: ["團長", "隊長", "統帥", "將軍"], v: "指揮官型" },
  { k: ["騎士", "衛兵", "哨衛", "守衛", "盾"], v: "守備前線型" },
  { k: ["刺客", "暗殺", "影", "闇"], v: "潛襲獵殺型" },
  { k: ["弓", "槍", "狙", "射手", "遊俠"], v: "遠程壓制型" },
  { k: ["法", "術", "咒", "祭司", "巫"], v: "術式操控型" },
  { k: ["僧", "拳", "武"], v: "近戰鬥技型" },
  { k: ["醫", "牧", "聖"], v: "支援守護型" },
  { k: ["龍"], v: "高壓主導型" },
  { k: ["獸", "狼", "虎", "豹", "熊"], v: "野性突擊型" }
];

const styleTokens = [
  { k: ["聖", "光", "耀"], v: "聖潔明亮" },
  { k: ["闇", "暗", "影", "夜"], v: "深影冷調" },
  { k: ["火", "炎", "焰"], v: "熾熱鋒利" },
  { k: ["冰", "霜", "雪"], v: "冷冽清透" },
  { k: ["雷", "電"], v: "高能躍動" },
  { k: ["毒"], v: "危險妖冶" },
  { k: ["花", "薔", "櫻", "月"], v: "華麗優雅" },
  { k: ["鋼", "鐵", "岩"], v: "硬派厚重" }
];

const racePersona = {
  人類: "重視秩序、任務與協同，戰術執行力強。",
  亡靈: "氣質冷寂，節奏隱忍，擅長製造心理壓迫。",
  野獸: "行動依賴本能與速度，擅長追擊與切入。",
  地精: "思路靈巧多變，偏好用奇襲打亂對手節奏。",
  巨魔: "力量與耐性並重，擅長正面壓進與持續對抗。",
  精靈: "節奏精準，動作流暢，善於掌控距離與時機。",
  獸人: "剛猛果斷，交戰意圖明確，偏向強勢推進。",
  異界: "行動軌跡難以預測，常以反差出手改變局勢。",
  龍: "存在感強烈，戰場主導意志鮮明。",
  天使: "守護與制裁並存，氣質沉著而堅定。",
  惡魔: "風格銳利，擅長放大對手破綻並連續施壓。",
  戰士: "攻守切換直接明快，重視交戰節奏。",
  遊俠: "跑位靈活，視角敏銳，擅長角度壓制。",
  法師: "重視術式節點與局面控制，打法精密。",
  牧師: "穩定隊伍士氣，擅長維持戰線完整。",
  未知: "來歷難辨，常在關鍵時刻展露不尋常判斷。"
};

const hairColors = [
  "霧銀", "晨金", "夜藍", "櫻粉", "月白", "墨黑", "青綠", "葡紫", "琥珀", "珊瑚紅",
  "灰藍", "金棕", "冰藍", "深紅", "茶褐", "薄荷綠", "星灰", "海藍", "玫瑰金", "白金"
];
const hairStyles = [
  "高馬尾", "低馬尾", "雙馬尾", "側馬尾", "長直髮", "微捲長髮", "及肩短髮", "鮑伯短髮", "中分長髮", "斜瀏海長髮",
  "公主頭", "半束髮", "編髮盤髮", "鬆散辮髮", "短狼尾", "羽層短髮", "長辮", "雙辮", "披肩直髮", "層次中長髮"
];
const eyeStyles = [
  "眼神沉穩", "眼神銳利", "眼神清澈", "眼神冷靜", "眼神堅定",
  "眼神自信", "眼神凌厲", "眼神溫和", "眼神神祕", "眼神靈動",
  "眼神專注", "眼神果決", "眼神俐落", "眼神高傲", "眼神堅毅"
];
const faceDetails = [
  "五官立體", "輪廓精緻", "鼻樑俐落", "下顎線清晰", "笑意克制",
  "神情內斂", "表情帶壓迫感", "唇線俐落", "妝容乾淨", "氣場鮮明",
  "神態冷靜", "神情沉著", "表情淡定", "面部光影乾淨", "臉部辨識度高"
];
const bodyPostures = [
  "站姿挺拔", "重心前壓", "側身備戰", "微蹲蓄力", "半轉身警戒",
  "步伐輕快", "雙肩展開", "單手前指", "持武器待發", "姿態平衡",
  "動作乾淨俐落", "軀幹穩定", "起手俐落", "收勢沉穩", "發力線條清楚"
];

const outfitBase = [
  "軍系短外套", "聖職長袍", "輕甲戰裙", "貼身戰衣", "機能外套",
  "禮甲胸衣", "層次披肩", "戰術馬甲", "法袍內襯", "高領戰服",
  "短版披風", "長版披風", "肩甲外衣", "儀式套裝", "護身風衣",
  "束腰長衣", "短斗篷", "旅行戰袍", "修身戰服", "流線式護衣"
];
const outfitMaterials = [
  "霧面皮革", "絲緞面料", "啞光金屬", "軟甲纖維", "織紋布料",
  "浮雕金屬", "鱗片質感", "半透明紗層", "壓紋皮革", "亮面金屬"
];
const accessories = [
  "胸針", "肩扣", "護腕", "腕甲", "頸飾",
  "耳飾", "腰封", "腰鏈", "腿環", "指環",
  "披肩扣件", "臂帶", "符紋吊墜", "髮飾", "絲帶",
  "徽章", "護膝", "長手套", "短手套", "腰包"
];
const footwear = [
  "長靴", "及膝靴", "短靴", "繫帶戰靴", "裝甲戰靴",
  "軟底靴", "高筒靴", "旅行靴", "機動靴", "護踝短靴"
];

const scenePlaces = [
  "王都石板大道", "古堡露台", "林間木橋", "雪夜城門", "港口棧道",
  "修道院中庭", "高塔迴廊", "河岸步道", "鐘樓廣場", "花園長廊",
  "神殿前庭", "學院回廊", "荒野營地", "山城觀景台", "石橋隘口",
  "地下遺跡", "月下湖畔", "庭院回字廊", "海崖步道", "森林祭壇",
  "白牆街區", "市場拱廊", "舊都巷道", "邊境哨站", "浮空平台",
  "熔岩邊城", "冰霜關隘", "草原驛站", "溪谷石階", "雨後中庭",
  "宮殿走廊", "圖書館穹頂下", "堡壘牆邊", "林海觀景台", "古道岔口",
  "深谷木棧道", "祭典街道", "石造競技場", "工坊露台", "雲海邊廊"
];
const sceneTime = [
  "黎明前", "清晨", "日出時分", "午后", "黃昏",
  "夜幕初臨", "深夜", "雨後", "薄霧中", "月光下"
];
const sceneMood = [
  "氣氛安靜卻緊繃", "人群尚未散去", "風聲在牆間回響", "遠處燈火搖曳", "空氣帶著金屬與雨氣",
  "石地仍留著舊戰痕", "旗幟在高處獵獵作響", "腳步聲在迴廊裡放大", "視野開闊但壓力逼近", "四周安靜得能聽見呼吸"
];
const storyActs = [
  "她長期在任務現場扛住最先到來的壓力，逐步磨出穩定而果決的判斷。",
  "她習慣先觀察對手節奏，再在最短窗口把主動權奪回手中。",
  "她不追求浮誇動作，而是把每一次移步與出手都落在關鍵點上。",
  "她在混戰中仍能保持清楚的決策邏輯，是隊伍最可靠的核心之一。",
  "她擅長在局勢混亂時維持隊形完整，讓同伴有餘裕重新組織反擊。",
  "她把過往戰線經驗轉成冷靜本能，越到關鍵回合越能穩定發揮。",
  "她總能在壓力最大時維持節奏，讓局面朝對己方有利方向推進。",
  "她的戰場信念很單純：先站穩，再推進，最後由自己結束僵局。",
  "她行事果斷而克制，對局勢的閱讀速度始終比多數人快一步。",
  "她的存在讓前線不容易崩潰，這份穩定本身就是隊伍最大的價值。"
];

function hash32(s) {
  let x = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

function pick(arr, seed, off = 0) {
  return arr[(seed + off) % arr.length];
}

function tokenValue(name, rules, fallback) {
  const n = String(name || "");
  for (let i = 0; i < rules.length; i += 1) {
    const r = rules[i];
    for (let j = 0; j < r.k.length; j += 1) {
      if (n.includes(r.k[j])) return r.v;
    }
  }
  return fallback;
}

function buildAppearancePool(limit = 1200) {
  const out = [];
  for (let a = 0; a < hairColors.length; a += 1) {
    for (let b = 0; b < hairStyles.length; b += 1) {
      for (let c = 0; c < eyeStyles.length; c += 1) {
        for (let d = 0; d < faceDetails.length; d += 1) {
          for (let e = 0; e < bodyPostures.length; e += 1) {
            out.push(`${hairColors[a]}${hairStyles[b]}，${eyeStyles[c]}、${faceDetails[d]}，${bodyPostures[e]}。`);
            if (out.length >= limit) return out;
          }
        }
      }
    }
  }
  return out;
}

function buildOutfitPool(limit = 700) {
  const out = [];
  for (let a = 0; a < outfitBase.length; a += 1) {
    for (let b = 0; b < outfitMaterials.length; b += 1) {
      for (let c = 0; c < accessories.length; c += 1) {
        for (let d = 0; d < accessories.length; d += 1) {
          if (c === d) continue;
          for (let e = 0; e < footwear.length; e += 1) {
            out.push(`${outfitBase[a]}結合${outfitMaterials[b]}質感，配有${accessories[c]}與${accessories[d]}，下身搭配${footwear[e]}。`);
            if (out.length >= limit) return out;
          }
        }
      }
    }
  }
  return out;
}

function buildStoryScenePool(limit = 1400) {
  const out = [];
  for (let a = 0; a < scenePlaces.length; a += 1) {
    for (let b = 0; b < sceneTime.length; b += 1) {
      for (let c = 0; c < sceneMood.length; c += 1) {
        out.push(`${sceneTime[b]}的${scenePlaces[a]}，${sceneMood[c]}。`);
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

function containsDigits(text) {
  return /[0-9\uff10-\uff19]/.test(String(text || ""));
}

const raw = fs.readFileSync(filePath, "utf8");
const json = JSON.parse(raw);
const cards = Array.isArray(json) ? json : json.cards || [];

const appearancePool = buildAppearancePool(1200);
const outfitPool = buildOutfitPool(700);
const storyScenePool = buildStoryScenePool(1400);

const backupPath = filePath.replace(".json", `.before_rich_persona_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(backupPath, raw, "utf8");

for (let i = 0; i < cards.length; i += 1) {
  const c = cards[i];
  const id = String(c.id || c.sourceId || i);
  const name = String(c.name || "未命名角色").trim();
  const race = raceMap[Number(c.phyle)] || "未知";
  const seed = hash32(`${id}|${name}|${race}`);

  const roleType = tokenValue(name, roleTokens, "戰術實戰型");
  const styleType = tokenValue(name, styleTokens, "穩定厚實");
  const personaRace = racePersona[race] || racePersona["未知"];

  const appearance = pick(appearancePool, seed, 11);
  const outfit = pick(outfitPool, seed, 97);
  const scene = pick(storyScenePool, seed, 131);
  const act = pick(storyActs, seed, 197);

  const d1 = `人設定位：${name}屬於${race}陣營，定位為${roleType}，整體氣質偏${styleType}，${personaRace}`;
  const d2 = `外觀特徵：${appearance}`;
  const d3 = `服裝與配件：${outfit}`;
  const d4 = `背景故事：${scene}${act}`;

  const full = [d1, d2, d3, d4].join("\n");
  c.description = containsDigits(full) ? full.replace(/[0-9\uff10-\uff19]/g, "") : full;
}

if (Array.isArray(json)) {
  fs.writeFileSync(filePath, JSON.stringify(cards, null, 2), "utf8");
} else {
  json.cards = cards;
  json.count = cards.length;
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf8");
}

console.log(JSON.stringify({
  updated: cards.length,
  backupPath,
  appearancePool: appearancePool.length,
  outfitPool: outfitPool.length,
  storyScenePool: storyScenePool.length
}, null, 2));
