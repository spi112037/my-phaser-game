const fs = require('fs');

const dataPath = 'd:/pray/my-phaser-game/src/data/flameCardsBest.json';
const reportPath = 'd:/pray/my-phaser-game/immortalchicks_elite1_translate_report_pass3.txt';

const j = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const cards = Array.isArray(j) ? j : (Array.isArray(j.cards) ? j.cards : []);

const map = [
  ['ステルス', '隱匿'],
  ['スキル', '技能'],
  ['ドレイン', '吸血'],
  ['コントロール', '控制'],
  ['ボス', '首領'],
  ['マヒ', '麻痺'],
  ['ジャンプ', '跳躍'],
  ['ガード', '守護'],
  ['バリア', '護盾'],
  ['ダウン', '下降'],
  ['プラス', '增加'],
  ['マイナス', '減少'],
  ['ポイント', '點數'],
  ['モード', '模式'],
  ['ホークアイ', '鷹眼'],
  ['メディテーション', '冥想'],
  ['ホーリーランス', '聖槍'],
  ['レクイエム', '安魂曲'],
  ['インフェルノ', '煉獄'],
  ['セイレーン', '海妖'],
  ['アポカリプス', '末日'],
  ['チャーリー', '查理'],
  ['ロレン', '洛倫'],
  ['ロキ', '洛基'],
  ['アンジェ', '安潔'],
  ['アルテナ', '阿爾特娜'],
  ['ナオミ', '直美'],
  ['ドルーガ', '德魯迦'],
  ['イブラ', '伊布拉'],
  ['ヘラ', '赫拉'],
  ['レヴィアタン', '利維坦'],
  ['チャリオット', '戰車'],
  ['シェイクスピア', '莎士比亞'],
  ['プリンス', '王子'],
  ['ジョー', '喬'],
  ['サマエル', '薩麥爾'],
  ['ウリエル', '烏列爾'],
  ['アポピス', '阿波菲斯'],
  ['メジェド', '梅傑德'],
  ['サスカッチ', '薩斯奎奇']
];

function cleanText(input) {
  let t = String(input || '');
  for (const [a, b] of map) t = t.split(a).join(b);

  // remove remaining kana blocks after known mapping
  t = t.replace(/[\u3040-\u30ffー]+/g, '');

  // cleanup punctuation / spacing artifacts
  t = t
    .replace(/\s+/g, ' ')
    .replace(/，,/g, '，')
    .replace(/。。+/g, '。')
    .replace(/，，+/g, '，')
    .replace(/::+/g, ':')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/^\s*[:：]\s*/g, '')
    .trim();

  return t;
}

const fields = ['ability1', 'ability2', 'ability3', 'ability4', 'ability5', 'description'];
const jap = /[\u3040-\u30ff]/;

let changedCards = 0;
let changedFields = 0;
const report = ['id\tname\tchanged_fields'];

for (const c of cards) {
  if (String(c.source || '') !== 'immortalchicks_card_viewer_new') continue;

  const changed = [];
  for (const f of fields) {
    const b = String(c[f] || '');
    const a = cleanText(b);
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
      const a = cleanText(b);
      if (a !== b) arrChanged = true;
      return a;
    });
    if (arrChanged) changed.push('abilities[]');
  }

  if (changed.length > 0) {
    changedCards += 1;
    report.push([String(c.id || ''), String(c.name || ''), changed.join(',')].join('\t'));
  }
}

if (Array.isArray(j.cards)) {
  j.cards = cards;
  j.count = cards.length;
}

fs.writeFileSync(dataPath, JSON.stringify(Array.isArray(j) ? cards : j, null, 2), 'utf8');
fs.writeFileSync(reportPath, report.join('\n'), 'utf8');

let remain = 0;
for (const c of cards) {
  if (String(c.source || '') !== 'immortalchicks_card_viewer_new') continue;
  for (const f of fields) {
    if (jap.test(String(c[f] || ''))) remain += 1;
  }
}

console.log('pass3_changed_cards', changedCards);
console.log('pass3_changed_fields', changedFields);
console.log('remaining_japanese_fields_same_scope', remain);
console.log('report', reportPath);
