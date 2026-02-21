const fs = require('fs');

const dataPath = 'd:/pray/my-phaser-game/src/data/flameCardsBest.json';
const reportPath = 'd:/pray/my-phaser-game/immortalchicks_elite1_translate_report.txt';

const j = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const cards = Array.isArray(j) ? j : (Array.isArray(j.cards) ? j.cards : []);

const nameMap = [
  ['レヴィアタン', '利維坦'],
  ['アーサー', '亞瑟'],
  ['ジャンヌ', '貞德'],
  ['ミカエル', '米迦勒'],
  ['ラファエル', '拉斐爾'],
  ['ガブリエル', '加百列'],
  ['ルシファー', '路西法'],
  ['ベルゼブブ', '別西卜'],
  ['サタン', '撒旦']
];

const dict = [
  ['毎ターン', '每回合'],
  ['ランダムに', '隨機'],
  ['ランダム', '隨機'],
  ['敵ユニットか英雄', '敵方士兵或英雄'],
  ['敵1名のユニットか英雄', '隨機1名敵方士兵或英雄'],
  ['敵1名のユニット', '隨機1名敵方士兵'],
  ['敵全体のユニット', '敵方全體士兵'],
  ['敵のユニット', '敵方士兵'],
  ['味方ユニット', '友方士兵'],
  ['召喚者', '召喚者'],
  ['待機枠', '準備欄'],
  ['準備枠', '準備欄'],
  ['戻る', '返回'],
  ['死亡時', '死亡時'],
  ['進場時', '進場時'],
  ['行動時', '行動時'],
  ['攻撃時', '攻擊時'],
  ['攻撃力', '攻擊力'],
  ['生命力', '生命值'],
  ['与える', '造成'],
  ['受ける', '受到'],
  ['ダメージ', '傷害'],
  ['物理ダメージ', '物理傷害'],
  ['魔法ダメージ', '魔法傷害'],
  ['雷ダメージ', '雷電傷害'],
  ['火ダメージ', '火焰傷害'],
  ['闇ダメージ', '闇屬性傷害'],
  ['光ダメージ', '神聖傷害'],
  ['軽減する', '減免'],
  ['無効', '無效'],
  ['確率で', '機率'],
  ['確率', '機率'],
  ['行動不能', '無法行動'],
  ['持続', '持續'],
  ['射程', '射程'],
  ['後退', '後退'],
  ['マス', '格'],
  ['ターン', '回合'],
  ['ユニット', '士兵'],
  ['英雄', '英雄'],
  ['復活', '復活'],
  ['蘇生', '復活'],
  ['吸血', '吸血'],
  ['毒', '毒'],
  ['貫通', '貫通'],
  ['免疫', '免疫']
];

function trName(s) {
  let t = String(s || '');
  for (const [a, b] of nameMap) t = t.split(a).join(b);
  return t;
}

function trText(input) {
  let t = String(input || '');
  t = t.replace(/\u3000/g, ' ');
  for (const [a, b] of dict) t = t.split(a).join(b);
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/(\d+)\s*回合\s*持續/g, '$1回合持續');
  t = t.replace(/(\d+)\s*格\s*後退/g, '後退$1格');
  if (/^[^:：\s]+\s+/.test(t)) {
    t = t.replace(/^([^:：\s]+)\s+/, '$1:');
  }
  return t;
}

let touchedCards = 0;
let touchedName = 0;
let touchedAbilities = 0;
const report = ['id\tname_before\tname_after\tchanged_fields'];

for (const c of cards) {
  if (String(c.source || '') !== 'immortalchicks_card_viewer_new') continue;

  const beforeName = String(c.name || '');
  const afterName = trName(beforeName);
  const changed = [];

  if (afterName !== beforeName) {
    c.name = afterName;
    if (c.unit && String(c.unit.name || '') === beforeName) c.unit.name = afterName;
    touchedName += 1;
    changed.push('name');
  }

  const fields = ['ability1', 'ability2', 'ability3', 'ability4', 'ability5', 'description'];
  for (const f of fields) {
    const b = String(c[f] || '');
    const a = trText(b);
    if (a !== b) {
      c[f] = a;
      touchedAbilities += 1;
      changed.push(f);
    }
  }

  if (Array.isArray(c.abilities)) {
    let changedArr = false;
    const next = c.abilities.map((x) => {
      const a = trText(String(x || ''));
      if (a !== String(x || '')) changedArr = true;
      return a;
    });
    if (changedArr) {
      c.abilities = next;
      changed.push('abilities[]');
    }
  }

  if (changed.length > 0) {
    touchedCards += 1;
    report.push([String(c.id || ''), beforeName, String(c.name || ''), changed.join(',')].join('\t'));
  }
}

if (Array.isArray(j.cards)) {
  j.cards = cards;
  j.count = cards.length;
}

fs.writeFileSync(dataPath, JSON.stringify(Array.isArray(j) ? cards : j, null, 2), 'utf8');
fs.writeFileSync(reportPath, report.join('\n'), 'utf8');

console.log('translated_cards', touchedCards);
console.log('name_changed', touchedName);
console.log('text_fields_changed', touchedAbilities);
console.log('report', reportPath);
