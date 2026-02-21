const fs = require('fs');

const inPath = 'd:/pray/my-phaser-game/pixiv_pending_cards.txt';
const outPath = 'd:/pray/my-phaser-game/grok_prompts_batch_01.txt';

const rows = fs.readFileSync(inPath, 'utf8')
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map((l) => {
    const t = l.split('\t');
    return { id: t[0], name: t[1], phyle: Number(t[2] || 0), quality: Number(t[3] || 0) };
  });

const race = {
  0: '未知', 1: '人類', 2: '亡靈', 3: '野獸', 4: '地精', 5: '巨魔',
  6: '精靈', 7: '獸人', 8: '異界', 9: '龍', 10: '天使', 11: '惡魔'
};

const scenes = [
  '晨光玻璃溫室與藤蔓拱廊，花床層次清楚，遠處水景噴泉',
  '山城露台花園，石階與花牆交錯，遠景雲海與白塔',
  '古典圖書館中庭，環形書廊、盆栽與雕像噴泉同框',
  '雨後歐式花街，石板地反光，花箱與拱窗商舖延伸',
  '精靈樹庭，巨樹根系、螢光花叢與木橋小徑',
  '海岸懸崖花園，白欄杆、風車與藍海天際線',
  '白石修道院庭院，彩窗光斑、常春藤石柱與花壇',
  '王城內苑，修剪樹牆、玫瑰花圃與大理石步道'
];

const cameras = [
  '中近景3/4身，角色佔畫面60%，保留完整場景透視',
  '全身中景，角色佔畫面55%，前景花枝遮擋形成景深',
  '低機位仰拍，武器與肢體有透視張力，背景建築可辨識',
  '高機位俯視斜角，帶出步道與花壇幾何結構'
];

const lights = [
  '金色側逆光，髮絲與布料邊緣高光明確',
  '冷暖對撞光，主體暖色、背景冷色，層次清楚',
  '薄霧體積光穿過樹葉，地面有柔和反射',
  '黃昏琥珀光搭配藍紫陰影，角色輪廓乾淨'
];

const outfits = [
  '絲質短披肩與分層裙襬，細緻刺繡、珠鍊與皮革腰封',
  '輕盈禮裝風戰衣，荷葉邊、蕾絲袖口與金線滾邊',
  '旅團風機能服，軟皮手套、束腰短外套與細扣件',
  '舞者風戰鬥服，流蘇、薄紗外層與寶石胸飾'
];

const actions = [
  '前踏蓄力揮擊，重心壓低，動作方向明確',
  '側身迴旋斬，裙擺與髮絲形成弧線',
  '疾跑後急停出手，地面碎葉被帶起',
  '防守反擊瞬間，手臂與武器角度清晰'
];

const fx = [
  '僅少量粒子光塵點綴，不遮擋臉部與服裝',
  '極輕薄光帶沿武器邊緣，不覆蓋背景細節',
  '少量花瓣旋流與微光，保持場景可辨識',
  '僅保留弱強度環境魔法紋，不可鋪滿畫面'
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

function roleByName(name) {
  if (/牆|壁|要塞|城門/.test(name)) return 'wall';
  if (/弩|弓|射手|炮|槍/.test(name)) return 'ranged';
  if (/祭司|修女|牧|神官/.test(name)) return 'support';
  if (/刺客|影|忍|斬/.test(name)) return 'assassin';
  if (/劍|騎|衛|戰士|佣兵|武士/.test(name)) return 'melee';
  return 'melee';
}

function subject(card) {
  const r = race[card.phyle] || '未知';
  if (card.phyle === 3) {
    return `主角：${card.name}，${r}陣營的獸形戰士，非人類少女，保留野性肌理與獠牙特徵`;
  }
  if (/牆|壁|要塞|城門/.test(card.name)) {
    return `主角：${card.name}，擬人化防線單位，核心視覺是「移動堡壘/城牆守衛」`;
  }
  return `主角：${card.name}，${r}陣營女性角色，五官精緻但臉型避免同模`;
}

function extraByRole(role) {
  if (role === 'wall') return '造型重點：厚重石質、金屬鉚釘、符文加固結構，必須看起來不可移動且高防禦。';
  if (role === 'ranged') return '造型重點：遠程武器結構清楚（弓弦/機弩/槍管），手部姿勢符合發射前後邏輯。';
  if (role === 'support') return '造型重點：儀式感配件（聖印、經卷、杖飾），氣質沉穩，不走暴力特效。';
  if (role === 'assassin') return '造型重點：輕裝高機動，短刃與暗器細節明確，動作俐落。';
  return '造型重點：近戰武器與站姿有壓迫感，肢體力量線清晰。';
}

const batch = rows.slice(0, 100);
const out = [];
out.push('【Grok Imagine 批次提示詞 #01｜100張】');
out.push('通用負面詞（每張可共用）：lowres, blurry, extra fingers, bad hands, text, logo, watermark, UI, frame, duplicate face, deformed anatomy, overexposed, oversaturated background');
out.push('');

for (const c of batch) {
  const seed = hash32(`${c.id}|${c.name}`);
  const scene = pick(scenes, seed, 1);
  const camera = pick(cameras, seed, 3);
  const light = pick(lights, seed, 5);
  const outfit = pick(outfits, seed, 7);
  const action = pick(actions, seed, 11);
  const effect = pick(fx, seed, 13);
  const role = roleByName(c.name);

  out.push(`[${c.id}] ${c.name}`);
  out.push('Prompt:');
  out.push(`日系幻想卡牌插畫，2:3 直幅，超高細節。${subject(c)}。`);
  out.push(`服裝：${outfit}，材質需呈現布料紋理、縫線、金屬反光與飾品切面，不可簡化為色塊。`);
  out.push(extraByRole(role));
  out.push(`動作：${action}。`);
  out.push(`鏡位：${camera}。`);
  out.push(`場景：${scene}。`);
  out.push(`光影：${light}。`);
  out.push(`特效：${effect}。`);
  out.push('構圖要求：前景/中景/後景完整，背景中至少同時可見「植物+建築」兩種元素；角色臉部、手部、武器必須清晰。');
  out.push('禁止：純色背景、滿版技能特效、文字浮水印、UI邊框、多人同框。');
  out.push('Negative: lowres, blurry, bad hands, extra digits, watermark, text, logo, UI, jpeg artifacts');
  out.push('---');
}

fs.writeFileSync(outPath, out.join('\n'), 'utf8');
console.log('written', outPath);
console.log('count', batch.length);
