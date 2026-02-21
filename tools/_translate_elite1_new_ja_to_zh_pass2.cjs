const fs = require('fs');

const dataPath = 'd:/pray/my-phaser-game/src/data/flameCardsBest.json';
const reportPath = 'd:/pray/my-phaser-game/immortalchicks_elite1_translate_report_pass2.txt';

const j = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const cards = Array.isArray(j) ? j : (Array.isArray(j.cards) ? j.cards : []);

const nameMap = [
  ['レヴィアタン', '利維坦'],
  ['チャリオットEX', '戰車EX'],
  ['チャリオット', '戰車'],
  ['スナイパー', '狙擊手'],
  ['ドラゴンスケイル', '龍鱗'],
  ['プッシュ', '擊退'],
  ['回帰', '回歸']
];

const terms = [
  ['ターゲット', '目標'],
  ['フィールド', '戰場'],
  ['デッキ', '牌庫'],
  ['カード', '卡牌'],
  ['マス', '格'],
  ['ユニット', '士兵'],
  ['相手', '敵方'],
  ['及び', '以及'],
  ['背後', '後方'],
  ['後方へ', '向後'],
  ['無視', '無視'],
  ['軽減', '減免'],
  ['効果', '效果'],
  ['付與', '賦予'],
  ['初回', '首次'],
  ['終了時', '結束時'],
  ['次の', '下一次'],
  ['先に', '先於'],
  ['以降', '之後'],
  ['受けた時', '受到時'],
  ['受ける', '受到'],
  ['攻撃する', '攻擊'],
  ['攻撃', '攻擊'],
  ['戻す', '返回'],
  ['戻る', '返回'],
  ['引く', '抽取'],
  ['できれば', '若可'],
  ['その', '該'],
  ['一度に', '一次'],
  ['たびに', '時'],
  ['により', '因'],
  ['に対して', '對'],
  ['毎ターン', '每回合'],
  ['ランダム', '隨機'],
  ['機率', '機率'],
  ['持続', '持續'],
  ['回合持續', '回合持續'],
  ['待機枠', '準備欄'],
  ['準備枠', '準備欄']
];

function trName(s) {
  let t = String(s || '');
  for (const [a, b] of nameMap) t = t.split(a).join(b);
  return t;
}

function trText(input) {
  let t = String(input || '');
  for (const [a, b] of nameMap) t = t.split(a).join(b);
  for (const [a, b] of terms) t = t.split(a).join(b);

  t = t
    .replace(/を/g, '')
    .replace(/は/g, '')
    .replace(/に/g, '')
    .replace(/で/g, '')
    .replace(/へ/g, '')
    .replace(/の/g, '')
    .replace(/とき/g, '時');

  t = t
    .replace(/隨機隨機/g, '隨機')
    .replace(/造成時/g, '造成時')
    .replace(/\s+/g, ' ')
    .replace(/: /g, ':')
    .replace(/，,/g, '，')
    .replace(/。。+/g, '。')
    .replace(/，，+/g, '，')
    .replace(/：/g, ':')
    .trim();

  // Normalize common pattern style.
  t = t.replace(/^(\S+)\s+/, '$1:');
  t = t.replace(/(\d+)\s*格後退/g, '後退$1格');
  t = t.replace(/(\d+)\s*回合\s*持續/g, '$1回合持續');

  return t;
}

const fields = ['ability1', 'ability2', 'ability3', 'ability4', 'ability5', 'description'];
let changedCards = 0;
let changedFields = 0;
const report = ['id\tname_before\tname_after\tchanged_fields'];

for (const c of cards) {
  if (String(c.source || '') !== 'immortalchicks_card_viewer_new') continue;

  const beforeName = String(c.name || '');
  const afterName = trName(beforeName);
  const changed = [];

  if (afterName !== beforeName) {
    c.name = afterName;
    if (c.unit && String(c.unit.name || '') === beforeName) c.unit.name = afterName;
    changed.push('name');
  }

  for (const f of fields) {
    const b = String(c[f] || '');
    const a = trText(b);
    if (a !== b) {
      c[f] = a;
      changed.push(f);
      changedFields += 1;
    }
  }

  if (Array.isArray(c.abilities)) {
    let arrChanged = false;
    c.abilities = c.abilities.map((x) => {
      const b = String(x || '');
      const a = trText(b);
      if (a !== b) arrChanged = true;
      return a;
    });
    if (arrChanged) changed.push('abilities[]');
  }

  if (changed.length > 0) {
    changedCards += 1;
    report.push([String(c.id || ''), beforeName, String(c.name || ''), changed.join(',')].join('\t'));
  }
}

if (Array.isArray(j.cards)) {
  j.cards = cards;
  j.count = cards.length;
}

fs.writeFileSync(dataPath, JSON.stringify(Array.isArray(j) ? cards : j, null, 2), 'utf8');
fs.writeFileSync(reportPath, report.join('\n'), 'utf8');

const jap = /[\u3040-\u30ff]/;
let remain = 0;
for (const c of cards) {
  if (String(c.source || '') !== 'immortalchicks_card_viewer_new') continue;
  for (const f of fields) {
    if (jap.test(String(c[f] || ''))) remain += 1;
  }
  if (Array.isArray(c.abilities)) {
    for (const a of c.abilities) if (jap.test(String(a || ''))) remain += 1;
  }
}

console.log('pass2_changed_cards', changedCards);
console.log('pass2_changed_fields', changedFields);
console.log('remaining_japanese_fields', remain);
console.log('report', reportPath);
