const fs = require('fs');
const path = require('path');

const PAGE_URL = 'https://immortalchicks.com/dg/card_viewer/index.php?elite=1&group=new&job=all&card_name=&ability_type=all';
const BASE_URL = 'https://immortalchicks.com/dg/card_viewer/';
const DATA_PATH = 'd:/pray/my-phaser-game/src/data/flameCardsBest.json';
const CUSTOM_DIR = 'd:/pray/my-phaser-game/public/cards/custom';
const REPORT_PATH = 'd:/pray/my-phaser-game/immortalchicks_elite1_new_import_report.txt';

const tradMap = [
  ['猫','貓'],['剑','劍'],['龙','龍'],['兽','獸'],['灵','靈'],['恶','惡'],['圣','聖'],['战','戰'],['护','護'],
  ['飞','飛'],['击','擊'],['术','術'],['风','風'],['云','雲'],['门','門'],['亚','亞'],['丽','麗'],['国','國'],
  ['军','軍'],['万','萬'],['与','與'],['灭','滅'],['疗','療'],['伤','傷'],['复','復'],['体','體'],['罗','羅'],
  ['乌','烏'],['叶','葉'],['玛','瑪'],['贝','貝'],['萨','薩'],['兰','蘭'],['韩','韓'],['乔','喬'],['诺','諾'],['丝','絲'],['维','維'],
  ['骑','騎'],['团','團'],['连','連'],['温','溫'],['银','銀'],['胜','勝'],['华','華'],['阵','陣'],['级','級'],['阶','階'],['觉','覺'],['轮','輪'],['镇','鎮'],['广','廣'],['黄','黃'],['蓝','藍'],['绿','綠'],['红','紅']
];

function toTrad(s) {
  let t = String(s || '');
  for (const [a, b] of tradMap) t = t.split(a).join(b);
  return t;
}

function decodeHtml(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(s) {
  return decodeHtml(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
}

function safeName(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '').slice(0, 40) || 'card';
}

function parseCardsFromPage(html) {
  const tables = html.split('<div class="card_table ').slice(1);
  const out = [];

  for (const t0 of tables) {
    const t = '<div class="card_table ' + t0;
    const sid = (t.match(/<div class="m-1" title="(\d+)\s*-/) || [,''])[1];
    if (!sid) continue;

    const cardLines = t.split('<div class="col mb-3 bg-dark card_line').slice(1);
    let best = null;

    for (const l0 of cardLines) {
      const l = '<div class="col mb-3 bg-dark card_line' + l0;
      const quality = Number((l.match(/qt_(\d+)/) || [,'0'])[1]) || 0;
      const name = stripTags((l.match(/<div class="card_name[^>]*>([\s\S]*?)<\/div>/) || [,''])[1]);
      const bgRel = (l.match(/data-bg="([^"]+)"/) || [,''])[1];
      const atk = Number(stripTags((l.match(/<div class="attack_volume">([\s\S]*?)<\/div>/) || [,'0'])[1])) || 1;
      const hp = Number(stripTags((l.match(/<div class="card_hp">([\s\S]*?)<\/div>/) || [,'1'])[1])) || 1;
      const init = Number(stripTags((l.match(/<div class="init_ready">([\s\S]*?)<\/div>/) || [,'3'])[1])) || 3;
      const phyle = Number((l.match(/img\/rc_(\d+)-\d+\.?png?/) || [,'0'])[1]) || 0;

      const abilityWrap = (l.match(/<div class="card_ability">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/) || [,''])[1];
      const abilities = [];
      if (abilityWrap) {
        const abRx = /<div class="cb"[^>]*>([\s\S]*?)<\/div>/g;
        let am;
        while ((am = abRx.exec(abilityWrap)) !== null) {
          const txt = stripTags(am[1]).replace(/^\[[^\]]+\]\s*/, '').trim();
          if (txt) abilities.push(toTrad(txt));
          if (abilities.length >= 5) break;
        }
      }

      const candidate = {
        sourceId: Number(sid),
        name: toTrad(name || ('卡片' + sid)),
        quality,
        imageUrl: bgRel ? (bgRel.startsWith('http') ? bgRel : BASE_URL + bgRel.replace(/^\/+/, '')) : '',
        atk: Math.max(1, atk),
        hp: Math.max(1, hp),
        initReady: Math.max(0, init),
        phyle,
        abilities
      };

      if (!best || candidate.quality > best.quality) best = candidate;
    }

    if (best) out.push(best);
  }

  const dedup = new Map();
  for (const c of out) {
    const k = String(c.sourceId);
    if (!dedup.has(k) || c.quality > dedup.get(k).quality) dedup.set(k, c);
  }
  return [...dedup.values()];
}

function makeDescription(card) {
  return toTrad(`從 immortalchicks card_viewer 匯入（elite=1, group=new）。原始卡名：${card.name}。`);
}

(async () => {
  const db = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const cards = Array.isArray(db) ? db : (Array.isArray(db.cards) ? db.cards : []);

  const dbSidSet = new Set(cards.map((c) => String(c.sourceId || '').trim()).filter(Boolean));
  const dbIdSet = new Set(cards.map((c) => String(c.id || '').trim()).filter(Boolean));

  const html = await (await fetch(PAGE_URL)).text();
  const parsed = parseCardsFromPage(html);

  const missing = parsed.filter((c) => !dbSidSet.has(String(c.sourceId)));

  let maxIdNum = cards
    .map((c) => {
      const m = String(c.id || '').match(/^f_(\d+)$/);
      return m ? Number(m[1]) : 0;
    })
    .reduce((a, b) => Math.max(a, b), 0);

  let added = 0;
  let downloaded = 0;
  const report = ['sourceId\tnew_id\tname\tquality\timage_file\tstatus'];

  for (const c of missing) {
    let id = `f_${c.sourceId}`;
    if (dbIdSet.has(id)) {
      do { maxIdNum += 1; id = `f_${maxIdNum}`; } while (dbIdSet.has(id));
    }
    dbIdSet.add(id);

    let imageWebPath = '';
    let imageFile = '';
    let status = 'added_no_image';

    if (c.imageUrl) {
      try {
        const res = await fetch(c.imageUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf && buf.length > 1024) {
            let ext = path.extname(c.imageUrl.split('?')[0]).toLowerCase();
            if (!ext || !['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) ext = '.jpg';
            imageFile = `${id}_${safeName(c.name)}${ext}`;
            fs.writeFileSync(path.join(CUSTOM_DIR, imageFile), buf);
            imageWebPath = '/cards/custom/' + imageFile;
            downloaded += 1;
            status = 'added_with_image';
          }
        }
      } catch {
      }
    }

    const abilities = c.abilities.slice(0, 5);
    const newCard = {
      source: 'immortalchicks_card_viewer_new',
      sourceSheet: 'card_viewer_elite1_new',
      sourceId: c.sourceId,
      id,
      name: c.name,
      type: 'summon',
      quality: c.quality || 5,
      cost: Math.max(0, Math.min(10, c.initReady || 3)),
      phyle: c.phyle || 0,
      unique: c.quality >= 6,
      description: makeDescription(c),
      ability1: abilities[0] || '',
      ability2: abilities[1] || '',
      ability3: abilities[2] || '',
      ability4: abilities[3] || '',
      ability5: abilities[4] || '',
      abilities,
      image: imageWebPath,
      unit: {
        name: c.name,
        hp: c.hp,
        atk: c.atk,
        range: 40,
        speed: 35,
        atkCdMs: 1000
      }
    };

    cards.push(newCard);
    added += 1;
    report.push([String(c.sourceId), id, c.name, String(c.quality || 0), imageFile, status].join('\t'));
  }

  if (Array.isArray(db.cards)) {
    db.cards = cards;
    db.count = cards.length;
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(Array.isArray(db) ? cards : db, null, 2), 'utf8');
  fs.writeFileSync(REPORT_PATH, report.join('\n'), 'utf8');

  console.log('page_parsed', parsed.length);
  console.log('missing_in_db', missing.length);
  console.log('added_cards', added);
  console.log('downloaded_images', downloaded);
  console.log('db_total_now', cards.length);
  console.log('report', REPORT_PATH);
})();
