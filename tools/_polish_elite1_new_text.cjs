const fs = require('fs');

const dataPath = 'd:/pray/my-phaser-game/src/data/flameCardsBest.json';
const reportPath = 'd:/pray/my-phaser-game/immortalchicks_elite1_polish_report.txt';

const j = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const cards = Array.isArray(j) ? j : (Array.isArray(j.cards) ? j.cards : []);

const fields = ['ability1', 'ability2', 'ability3', 'ability4', 'ability5', 'description'];

const hardMap = [
  ['対象', '目標'],
  ['對象', '目標'],
  ['賦予', '獲得'],
  ['返回。', '返回。'],
  ['每回合、', '每回合，'],
  ['隨機隨機', '隨機'],
  ['傷害目標士兵', '受傷士兵'],
  ['受到時', '受傷時'],
  ['攻擊力+1。', '攻擊+1。'],
  ['攻擊力+2。', '攻擊+2。'],
  ['攻擊力+3。', '攻擊+3。'],
  ['生命值+1。', '生命+1。'],
  ['生命值+2。', '生命+2。'],
  ['生命值+3。', '生命+3。'],
  ['首領', 'Boss'],
  ['造成時，', '造成傷害時，'],
  ['造成時', '造成傷害時'],
  ['若可', '若可'],
  ['後退目標', '使目標後退'],
  ['返回準備欄', '返回召喚者準備欄'],
  ['牌庫中抽取卡牌', '從牌庫抽取卡牌'],
  ['以及其後方1格', '以及其後方1格單位'],
  ['攻擊敵方士兵或英雄', '對敵方士兵或英雄造成傷害'],
  ['無法行動。1回合持續。', '無法行動，持續1回合。'],
  ['無法行動。2回合持續。', '無法行動，持續2回合。'],
  ['無法行動。3回合持續。', '無法行動，持續3回合。']
];

function polishText(input) {
  let t = String(input || '').trim();
  if (!t) return t;

  for (const [a, b] of hardMap) t = t.split(a).join(b);

  t = t
    .replace(/\s+/g, ' ')
    .replace(/，,/g, '，')
    .replace(/。。+/g, '。')
    .replace(/，，+/g, '，')
    .replace(/：/g, ':')
    .replace(/\s*:\s*/g, ':')
    .replace(/,\s*/g, '，')
    .replace(/\.(?=\D|$)/g, '。')
    .replace(/；\s*；/g, '；')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .trim();

  // normalize common skill-head format "技能名:內容"
  if (/^[^:]{1,24}:/.test(t)) {
    const i = t.indexOf(':');
    const head = t.slice(0, i).trim();
    const body = t.slice(i + 1).trim();
    t = `${head}:${body}`;
  }

  // duplicate token cleanup
  t = t.replace(/(隨機){2,}/g, '隨機');
  t = t.replace(/(每回合){2,}/g, '每回合');
  t = t.replace(/(造成傷害時){2,}/g, '造成傷害時');

  return t;
}

let changedCards = 0;
let changedFields = 0;
const report = ['id\tname\tfield\tbefore\tafter'];

for (const c of cards) {
  if (String(c.source || '') !== 'immortalchicks_card_viewer_new') continue;
  let cardChanged = false;

  for (const f of fields) {
    const before = String(c[f] || '');
    const after = polishText(before);
    if (after !== before) {
      c[f] = after;
      changedFields += 1;
      cardChanged = true;
      if (report.length <= 400) {
        report.push([String(c.id || ''), String(c.name || ''), f, before.slice(0, 120), after.slice(0, 120)].join('\t'));
      }
    }
  }

  if (Array.isArray(c.abilities)) {
    let arrChanged = false;
    c.abilities = c.abilities.map((x) => {
      const before = String(x || '');
      const after = polishText(before);
      if (after !== before) arrChanged = true;
      return after;
    });
    if (arrChanged) cardChanged = true;
  }

  if (cardChanged) changedCards += 1;
}

if (Array.isArray(j.cards)) {
  j.cards = cards;
  j.count = cards.length;
}

fs.writeFileSync(dataPath, JSON.stringify(Array.isArray(j) ? cards : j, null, 2), 'utf8');
fs.writeFileSync(reportPath, report.join('\n'), 'utf8');

const sample = cards
  .filter((c) => String(c.source || '') === 'immortalchicks_card_viewer_new')
  .slice(0, 20)
  .map((c) => ({ id: c.id, name: c.name, ab1: c.ability1, ab2: c.ability2 }));

console.log('polish_changed_cards', changedCards);
console.log('polish_changed_fields', changedFields);
console.log('report', reportPath);
console.log('sample', JSON.stringify(sample));
