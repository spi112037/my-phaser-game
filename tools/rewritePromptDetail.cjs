const fs = require("fs");

const filePath = process.argv[2] || "D:/pray/my-phaser-game/src/data/flameCardsBest.json";
const raw = fs.readFileSync(filePath, "utf8");
const json = JSON.parse(raw);
const cards = Array.isArray(json) ? json : json.cards || [];

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

const commonBackgrounds = [
  "晨光玫瑰花園步道，拱形藤架與露珠花叢",
  "王城中庭花園，噴泉雕像與修剪樹牆",
  "玻璃溫室長廊，熱帶植物與金色陽光斑駁",
  "白石修道院庭院，常春藤石柱與彩窗倒影",
  "山城露台花圃，遠景群山與飄動花旗",
  "櫻花神社前庭，木燈籠與落英鋪地",
  "竹林茶庭，石燈與苔庭曲徑",
  "古典圖書館中庭，環形書廊與攀藤欄杆",
  "月色湖畔花圃，水面倒影與睡蓮",
  "歐式城堡花廊，拱窗與藤蔓吊花",
  "山谷花田木橋，小溪與遠方風車",
  "雨後庭園石階，濕潤石板與反光葉面",
  "海岸懸崖花園，白欄杆與藍海天際線",
  "古神殿回廊花壇，浮雕牆與香草植栽",
  "王都廣場綠蔭道，噴泉與長椅、飛鳥",
  "精靈樹庭，巨大古樹與螢光藤蔓",
  "白金宮殿露台，垂幕、花盆與雲海",
  "秋季楓庭，紅葉與木質長廊",
  "雪中溫室外庭，暖光玻璃屋與積雪灌木",
  "港都花園碼頭，花箱步道與帆船背景",
  "鐘塔學院中庭，石像、花壇與迴廊陰影",
  "瀑布花園祭壇，水霧與虹光草坪",
  "夜間慶典花街，紙燈與攤棚花飾",
  "晨霧丘陵花園，層次樹林與遠景古堡"
];

const commonCameras = [
  "近景胸像，角色佔畫面65%",
  "中景全身，角色佔畫面55%",
  "低機位仰拍，強化壓迫感",
  "高機位俯拍，呈現戰場脈絡",
  "35mm電影感中景，背景有景深",
  "廣角透視前景誇張，武器伸出畫面",
  "長焦壓縮空間，背景層次清晰",
  "三分構圖，角色偏左留出技能方向"
];

const commonActions = [
  "持武器前衝，身體重心壓低",
  "側身迴斬，披風與髮絲大幅甩動",
  "高位蓄力下劈，武器帶光弧",
  "躍起突刺，腳下碎石飛散",
  "反手格擋後反擊，姿態緊繃",
  "滑步閃避後回身射擊",
  "雙手施法，法陣在掌前展開",
  "單手指向前方，能量束集中",
  "旋身連擊，殘影連續拖尾",
  "落地瞬間半蹲，塵埃外擴",
  "弓弦滿拉，箭頭凝聚元素",
  "投擲姿勢定格，武器即將離手",
  "召喚姿態，周圍浮現召喚陣",
  "防禦姿態，護盾半透明展開",
  "追擊步伐，視線鎖定遠端目標",
  "爆發瞬間仰角特寫，能量外溢",
  "低身疾跑穿越火線",
  "空中翻身後斬擊",
  "雙武器交錯格擋",
  "步步逼近，武器拖地火花"
];

const commonLights = [
  "逆光輪廓光強，邊緣高光明顯",
  "側逆光，半臉明暗對比",
  "頂光灑落，盔甲反射點明顯",
  "地面反光補光，潮濕質感突出",
  "冷暖對撞光，主體與背景分離",
  "體積光穿霧，光束可見"
];

const commonPalettes = [
  "藍金高對比",
  "青綠冷調",
  "赤金暖調",
  "紫黑夜戰調",
  "琥珀黃昏調",
  "銀白月光調",
  "墨綠森林調",
  "青紫雷暴調"
];

const commonCompositions = [
  "前景可加入枝葉/欄杆/花束作遮擋，增加景深",
  "中景主體清晰，後景建築與植栽必須可辨識",
  "地面保留接觸陰影與環境反射",
  "背景需有完整空間層次（前中後景）",
  "不可純特效鋪滿，必須是可敘事的場景"
];

const outfitStyles = [
  "花園貴族禮服（收腰剪裁、蕾絲袖口、寶石胸針）",
  "學院星紋制服（高領上衣、短披肩、絲帶裝飾）",
  "祭典舞姬裝束（分層裙襬、珠鍊腰飾、半透明披紗）",
  "夜宴歌伶服（露肩設計、長手套、垂墜耳飾）",
  "神官儀式服（刺繡長袍、金線邊飾、飄帶）",
  "花都名媛套裝（短外套、百褶裙、細節腰封）",
  "精靈林地洋裝（葉紋披肩、藤蔓飾件、輕盈裙甲）",
  "冬季毛領禮裝（短斗篷、厚布束腰、長靴）",
  "海港航海時裝（短斗篷、絲巾、長靴）",
  "星象占術服（披肩長袍、環形飾件、細鏈腰封）",
  "月光晚禮裙（開衩裙擺、層疊薄紗、水晶飾扣）",
  "舞台偶像戰鬥服（貼身上衣、亮片裙襬、髮飾）",
  "櫻庭和風改良服（寬袖短外衣、綁帶、花紋裙）",
  "異界都會風套裝（短版外套、褲襪、腰間吊飾）",
  "花神祭司服（花紋織帶、流蘇披巾、腰間花飾）",
  "暗夜情報員時裝（貼身上衣、短披風、長靴）"
];

const fabricDetails = [
  "天鵝絨與霧面皮革對比",
  "絲綢光澤與珠飾高光並存",
  "亞麻布紋理與琺瑯飾邊",
  "緞面褶皺與細密車縫線",
  "刺繡花紋與半透明薄紗層次",
  "磨砂皮革與晶石飾扣",
  "霧面布料與珠光飾片點綴",
  "厚織布與細鏈條配件混搭"
];

const accessorySets = [
  "耳飾、頸鍊、手環三件組",
  "胸針、戒指、腰鍊三件組",
  "髮飾、披肩扣、臂環三件組",
  "肩飾、袖扣、髮夾三件組",
  "絲帶髮結、寶石項墜、細鏈腰飾",
  "徽章、指套、珍珠髮夾三件組"
];

const keywordRules = [
  {
    key: "heal",
    re: /治療|恩赐|恩賜|恢復|回复|生命回復|信仰|祝福|聖光/,
    backgrounds: ["白石修道院庭院，常春藤石柱與彩窗倒影", "王城中庭花園，噴泉雕像與修剪樹牆", "白金宮殿露台，垂幕、花盆與雲海"],
    outfits: ["神官儀式服（刺繡長袍、金線邊飾、飄帶）", "花神祭司服（花紋織帶、流蘇披巾、腰間花飾）"],
    lights: ["頂光灑落，盔甲反射點明顯", "銀白柔光包裹，邊緣微亮"],
    palettes: ["銀白月光調", "琥珀黃昏調"],
    actions: ["單手向前施放治癒光束，另一手守護姿態", "半跪施術，掌心浮現治療符文"]
  },
  {
    key: "thunder",
    re: /雷|電|落雷|閃電|麻痺|擊昏|击晕/,
    backgrounds: ["鐘塔學院中庭，石像、花壇與迴廊陰影", "海岸懸崖花園，白欄杆與藍海天際線", "晨霧丘陵花園，層次樹林與遠景古堡"],
    outfits: ["星象占術服（披肩長袍、環形飾件、細鏈腰封）", "學院法術制服（高領外套、胸前徽章、長手套）"],
    lights: ["側逆光，半臉明暗對比", "冷暖對撞光，主體與背景分離"],
    palettes: ["青紫雷暴調", "紫黑夜戰調"],
    actions: ["抬手引雷，髮絲被靜電微微抬起", "短暫前傾衝刺後釋放電弧"]
  },
  {
    key: "poison",
    re: /毒|劇毒|剧毒|中毒|巫毒/,
    backgrounds: ["玻璃溫室長廊，熱帶植物與金色陽光斑駁", "竹林茶庭，石燈與苔庭曲徑", "古神殿回廊花壇，浮雕牆與香草植栽"],
    outfits: ["暗影情報員服（短披風、貼身上衣、飾品配件）", "獵手野外套裝（短披肩、箭囊、腕帶與腿環）"],
    lights: ["地面反光補光，潮濕質感突出", "體積光穿霧，光束可見"],
    palettes: ["墨綠森林調", "青綠冷調"],
    actions: ["低姿態繞步，手中短刃抹毒準備突刺", "側身投擲毒針，另一手維持平衡"]
  },
  {
    key: "summon",
    re: /召喚|召唤|降臨|化身|飛劍|飞剑|轉化|转化/,
    backgrounds: ["古典圖書館中庭，環形書廊與攀藤欄杆", "精靈樹庭，巨大古樹與螢光藤蔓", "瀑布花園祭壇，水霧與虹光草坪"],
    outfits: ["學院法術制服（高領外套、胸前徽章、長手套）", "神官儀式服（刺繡長袍、金線邊飾、飄帶）"],
    lights: ["體積光穿霧，光束可見", "頂光灑落，盔甲反射點明顯"],
    palettes: ["藍金高對比", "銀白月光調"],
    actions: ["雙手向外展開，召喚陣自腳邊層層展開", "單膝落地觸地施術，召喚符文沿地面擴散"]
  },
  {
    key: "archer",
    re: /弓|箭|射程|狙擊|狙击|炮擊|炮击/,
    backgrounds: ["山城露台花圃，遠景群山與飄動花旗", "海岸懸崖花園，白欄杆與藍海天際線", "王都廣場綠蔭道，噴泉與長椅、飛鳥"],
    outfits: ["獵手野外套裝（短披肩、箭囊、腕帶與腿環）", "旅團戰鬥服（分層裙裝、裝飾腰封、長襪飾片）"],
    lights: ["逆光輪廓光強，邊緣高光明顯", "冷暖對撞光，主體與背景分離"],
    palettes: ["藍金高對比", "琥珀黃昏調"],
    actions: ["弓弦滿拉，箭頭微發光，視線鎖定遠端目標", "側步拉弓，裙擺與披風沿動作方向甩動"]
  }
];

function hash32(s) {
  let x = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

function pick(arr, seed, off) {
  return arr[(seed + off) % arr.length];
}

function collectAbilities(card) {
  const arr = [];
  if (card.ability1) arr.push(card.ability1);
  if (card.ability2) arr.push(card.ability2);
  if (card.ability3) arr.push(card.ability3);
  if (card.ability4) arr.push(card.ability4);
  if (card.ability5) arr.push(card.ability5);
  if (Array.isArray(card.abilities)) {
    for (const v of card.abilities) {
      if (v && !arr.includes(v)) arr.push(v);
    }
  }
  return arr.slice(0, 5);
}

function gatherContext(card, abilities) {
  const text = `${card.name || ""} ${abilities.join("；")}`;
  const ctx = { backgrounds: [], outfits: [], lights: [], palettes: [], actions: [] };
  for (const r of keywordRules) {
    if (!r.re.test(text)) continue;
    if (r.backgrounds) ctx.backgrounds.push(...r.backgrounds);
    if (r.outfits) ctx.outfits.push(...r.outfits);
    if (r.lights) ctx.lights.push(...r.lights);
    if (r.palettes) ctx.palettes.push(...r.palettes);
    if (r.actions) ctx.actions.push(...r.actions);
  }
  return {
    backgrounds: [...new Set(ctx.backgrounds)],
    outfits: [...new Set(ctx.outfits)],
    lights: [...new Set(ctx.lights)],
    palettes: [...new Set(ctx.palettes)],
    actions: [...new Set(ctx.actions)]
  };
}

function chooseWithPreference(preferred, fallback, seed, off) {
  if (preferred && preferred.length) return pick(preferred, seed, off);
  return pick(fallback, seed, off);
}

const usedSignatures = new Set();

for (let i = 0; i < cards.length; i += 1) {
  const card = cards[i];
  const seedBase = hash32(String(card.id || `${card.name || ""}_${i}`));
  const race = raceMap[Number(card.phyle)] || "未知";
  const ab = collectAbilities(card);
  const ctx = gatherContext(card, ab);

  let env = "";
  let act = "";
  let cam = "";
  let light = "";
  let pal = "";
  let outfit = "";
  let fabric = "";
  let acc = "";
  let sig = "";

  for (let retry = 0; retry < 12; retry += 1) {
    const seed = seedBase + retry * 17;
    env = chooseWithPreference(ctx.backgrounds, commonBackgrounds, seed, 1);
    act = chooseWithPreference(ctx.actions, commonActions, seed, 7);
    cam = pick(commonCameras, seed, 13);
    light = chooseWithPreference(ctx.lights, commonLights, seed, 19);
    pal = chooseWithPreference(ctx.palettes, commonPalettes, seed, 23);
    outfit = chooseWithPreference(ctx.outfits, outfitStyles, seed, 31);
    fabric = pick(fabricDetails, seed, 37);
    acc = pick(accessorySets, seed, 41);
    sig = `${env}|${act}|${cam}|${outfit}|${fabric}|${acc}|${pal}`;
    if (!usedSignatures.has(sig)) {
      usedSignatures.add(sig);
      break;
    }
  }

  const fx1 = pick(["微量粒子光塵", "輕薄霧氣", "少量花瓣旋流", "柔和符文微光", "細小光點拖尾"], seedBase, 43);
  const fx2 = pick(["微量粒子光塵", "輕薄霧氣", "少量花瓣旋流", "柔和符文微光", "細小光點拖尾"], seedBase, 47);
  const c1 = pick(commonCompositions, seedBase, 53);
  const c2 = pick(commonCompositions, seedBase, 59);
  const hasTactical = /刺客|assassin|弓|射|法|術|召喚|毒|雷|聖|盾|守衛|騎士/i.test(`${card.name} ${ab.join(" ")}`);
  const role = hasTactical ? "戰鬥型角色" : "敘事型角色";
  const mobilityHint = hasTactical ? "偏機動剪裁" : "偏儀式與時裝剪裁";

  card.description = [
    "【AI產圖提示詞｜純視覺版】",
    `主題：${card.name}（女性原創角色），種族：${race}，風格定位：${role}。`,
    "畫風：日系動漫幻想卡牌插畫，非寫實，線條乾淨，五官精緻，臉型與髮型不得與其他卡同質化。",
    `角色服裝：${outfit}，${mobilityHint}。材質主題為${fabric}。配件指定：${acc}。`,
    "服裝刻畫：袖口、領口、腰線、裙襬（或下擺）都需有結構差異，請明確畫出褶皺方向、縫線、布料層次、飾扣與珠飾高光。",
    `動作設計：${act}。`,
    `鏡位：${cam}。`,
    `場景：${env}。`,
    `光影：${light}。`,
    `色彩：${pal}，主體與背景必須分層。`,
    "背景要求：背景需出現可辨識的植物與建築元素，不可只用抽象光效或煙霧填滿；前景、中景、後景要有空間層次。",
    `特效：僅以${fx1}與${fx2}做輔助，強度低於角色服裝與場景細節。`,
    `構圖要求：${c1}；${c2}。`,
    "出圖限制：無文字、無Logo、無浮水印、無UI框、單一卡面主角、背景可敘事且清晰可辨。"
  ].join("\n");
}

if (Array.isArray(json)) {
  fs.writeFileSync(filePath, JSON.stringify(cards, null, 2), "utf8");
} else {
  json.cards = cards;
  json.count = cards.length;
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf8");
}

console.log("updated cards", cards.length);
