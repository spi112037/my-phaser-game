const fs = require('fs');

const PAGE_URL = 'https://immortalchicks.com/dg/card_viewer/index.php?elite=1&group=new&job=all&card_name=&ability_type=all';
const DATA_PATH = 'd:/pray/my-phaser-game/src/data/flameCardsBest.json';
const REPORT_PATH = 'd:/pray/my-phaser-game/immortalchicks_elite1_repair_report.txt';

const baseMap = [
  ['毎ターン', '每回合'], ['ターン', '回合'], ['ランダム', '隨機'],
  ['敵ユニット', '敵方士兵'], ['味方ユニット', '友方士兵'], ['ユニット', '士兵'],
  ['英雄', '英雄'], ['召喚者', '召喚者'], ['待機枠', '準備欄'], ['準備枠', '準備欄'],
  ['デッキ', '牌庫'], ['カード', '卡牌'], ['フィールド', '戰場'], ['マス', '格'],
  ['ダメージ', '傷害'], ['物理ダメージ', '物理傷害'], ['魔法ダメージ', '魔法傷害'],
  ['雷ダメージ', '雷電傷害'], ['火ダメージ', '火焰傷害'], ['闇ダメージ', '闇屬性傷害'], ['光ダメージ', '神聖傷害'],
  ['攻撃力', '攻擊力'], ['攻撃', '攻擊'], ['生命力', '生命值'], ['移動力', '移動力'], ['射程', '射程'],
  ['復活', '復活'], ['蘇生', '復活'], ['無効', '無效'], ['軽減', '減免'], ['確率', '機率'],
  ['行動不能', '無法行動'], ['持続', '持續'], ['後退', '後退'], ['初回', '首次'],
  ['死亡時', '死亡時'], ['進場時', '進場時'], ['行動時', '行動時'], ['攻擊時', '攻擊時'],
  ['及び', '以及'], ['背後', '後方'], ['目標', '目標'],
  ['ステルス', '隱匿'], ['スキル', '技能'], ['ドレイン', '吸血'], ['コントロール', '控制'],
  ['プッシュ', '擊退'], ['スナイパー', '狙擊手'], ['ドラゴンスケイル', '龍鱗'], ['チャリオット', '戰車']
];

const nameMap = [
  ['レヴィアタン', '利維坦'], ['ウリエル', '烏列爾'], ['サマエル', '薩麥爾'], ['アポピス', '阿波菲斯'],
  ['メジェド', '梅傑德'], ['ガウェイン', '高文'], ['チャーリー', '查理'], ['シェイクスピア', '莎士比亞']
];

function stripTags(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function trName(s) {
  let t = String(s || '');
  for (const [a, b] of nameMap) t = t.split(a).join(b);
  return t;
}

function trText(s) {
  let t = String(s || '').replace(/\u3000/g, ' ').trim();
  for (const [a, b] of nameMap) t = t.split(a).join(b);
  for (const [a, b] of baseMap) t = t.split(a).join(b);

  // conservative grammar cleanup (no kana stripping)
  t = t
    .replace(/\s+/g, ' ')
    .replace(/，,/g, '，')
    .replace(/。。+/g, '。')
    .replace(/，，+/g, '，')
    .replace(/\s*：\s*/g, ':')
    .replace(/\s*:\s*/g, ':')
    .replace(/、/g, '，')
    .replace(/\.$/g, '。')
    .trim();

  t = t.replace(/^([^:：\n]{1,26})\s+/, '$1:');
  t = t.replace(/(\d+)\s*回合\s*持續/g, '$1回合持續');
  t = t.replace(/後退\s*(\d+)\s*格/g, '後退$1格');

  return t;
}

function parsePage(html) {
  const tables = html.split('<div class="card_table ').slice(1);
  const bySid = new Map();

  for (const part of tables) {
    const t = '<div class="card_table ' + part;
    const sid = (t.match(/<div class="m-1" title="(\d+)\s*-/) || [,''])[1];
    if (!sid) continue;

    const cardLines = t.split('<div class="col mb-3 bg-dark card_line').slice(1);
    let best = null;

    for (const l0 of cardLines) {
      const l = '<div class="col mb-3 bg-dark card_line' + l0;
      const quality = Number((l.match(/qt_(\d+)/) || [,'0'])[1]) || 0;
      const name = stripTags((l.match(/<div class="card_name[^>]*>([\s\S]*?)<\/div>/) || [,''])[1]);

      const abilityWrap = (l.match(/<div class="card_ability">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/) || [,''])[1];
      const abilities = [];
      if (abilityWrap) {
        const abRx = /<div class="cb"[^>]*>([\s\S]*?)<\/div>/g;
        let am;
        while ((am = abRx.exec(abilityWrap)) !== null) {
          let txt = stripTags(am[1]);
          txt = txt.replace(/^\[[^\]]+\]\s*/, '').trim();
          if (txt) abilities.push(txt);
          if (abilities.length >= 5) break;
        }
      }

      const cand = { sid: String(sid), quality, name, abilities };
      if (!best || cand.quality > best.quality) best = cand;
    }

    if (best) bySid.set(best.sid, best);
  }

  return bySid;
}

(async () => {
  const db = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const cards = Array.isArray(db) ? db : (Array.isArray(db.cards) ? db.cards : []);

  const html = await (await fetch(PAGE_URL)).text();
  const bySid = parsePage(html);

  let repaired = 0;
  let textChanged = 0;
  const report = ['id\tsourceId\tname_before\tname_after\tchanged'];

  for (const c of cards) {
    if (String(c.source || '') !== 'immortalchicks_card_viewer_new') continue;
    const sid = String(c.sourceId || '');
    const src = bySid.get(sid);
    if (!src) continue;

    let changed = [];
    const beforeName = String(c.name || '');
    const afterName = trName(src.name || beforeName);
    if (afterName && afterName !== beforeName) {
      c.name = afterName;
      if (c.unit) c.unit.name = afterName;
      changed.push('name');
    }

    const abil = (src.abilities || []).map(trText).filter(Boolean).slice(0, 5);
    const f = ['ability1', 'ability2', 'ability3', 'ability4', 'ability5'];
    for (let i = 0; i < 5; i += 1) {
      const b = String(c[f[i]] || '');
      const a = abil[i] || '';
      if (a && a !== b) {
        c[f[i]] = a;
        textChanged += 1;
        changed.push(f[i]);
      }
    }

    c.abilities = abil;

    const descBefore = String(c.description || '');
    const descAfter = `從immortalchicks card_viewer匯入（elite=1, group=new）。原始卡名:${trName(src.name || '')}。`;
    if (descAfter !== descBefore) {
      c.description = descAfter;
      changed.push('description');
      textChanged += 1;
    }

    if (changed.length) {
      repaired += 1;
      if (report.length <= 500) {
        report.push([String(c.id||''), sid, beforeName, String(c.name||''), changed.join(',')].join('\t'));
      }
    }
  }

  if (Array.isArray(db.cards)) {
    db.cards = cards;
    db.count = cards.length;
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(Array.isArray(db) ? cards : db, null, 2), 'utf8');
  fs.writeFileSync(REPORT_PATH, report.join('\n'), 'utf8');

  const jap = /[\u3040-\u30ff]/;
  let remain = 0;
  for (const c of cards) {
    if (String(c.source || '') !== 'immortalchicks_card_viewer_new') continue;
    const arr = [c.ability1,c.ability2,c.ability3,c.ability4,c.ability5,c.description];
    for (const x of arr) if (jap.test(String(x||''))) remain += 1;
  }

  console.log('repaired_cards', repaired);
  console.log('text_changed', textChanged);
  console.log('remaining_japanese_fields', remain);
  console.log('report', REPORT_PATH);
})();
