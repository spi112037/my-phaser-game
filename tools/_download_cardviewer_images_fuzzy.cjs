const fs = require('fs');
const path = require('path');

const dataPath = 'd:/pray/my-phaser-game/src/data/flameCardsBest.json';
const customDir = 'd:/pray/my-phaser-game/public/cards/custom';
const reportPath = 'd:/pray/my-phaser-game/immortalchicks_cardviewer_download_report_fuzzy.txt';
const defaultListUrl = 'https://immortalchicks.com/dg/card_viewer/index.php?elite=0&group=all&job=all&card_name=&ability_type=all';
const listUrl = process.argv[2] || defaultListUrl;
const baseUrl = 'https://immortalchicks.com/dg/card_viewer/';

const sharedImageBasenames = new Set([
  'JP_Richarda.jpg','kuloudui.jpg','baer.jpg','jinhua_baer.jpg','shixianggui2.jpg','jinhua_qimeila.jpg','testcard.png.jpg'
]);

const simpMap = [
  ['猫','貓'],['剑','劍'],['龙','龍'],['兽','獸'],['灵','靈'],['恶','惡'],['圣','聖'],['战','戰'],['护','護'],['飞','飛'],['击','擊'],['术','術'],['风','風'],['云','雲'],['门','門'],['亚','亞'],['丽','麗'],['国','國'],['军','軍'],['万','萬'],['与','與'],['灭','滅'],['疗','療'],['伤','傷'],['复','復'],['体','體'],['罗','羅'],['乌','烏'],['叶','葉'],['玛','瑪'],['贝','貝'],['萨','薩'],['兰','蘭'],['韩','韓'],['乔','喬'],['诺','諾'],['丝','絲'],['维','維'],['骑','騎'],['团','團'],['连','連'],['温','溫'],['银','銀'],['胜','勝'],['华','華']
];

// 針對卡名常見近義詞做柔性配對，避免「衛哨/警衛」這類翻譯差異配不到。
const synonymFamilies = [
  ['衛哨', '警衛', '守衛', '哨兵', '衛兵'],
  ['劍士', '劍客', '劍鬥士'],
  ['弓手', '射手', '弓兵'],
  ['槍兵', '長槍兵'],
  ['戰士', '鬥士', '武士'],
  ['祭司', '牧師', '神官'],
  ['法師', '術士', '魔導士'],
  ['刺客', '暗殺者'],
  ['騎士', '騎兵'],
  ['巨斧兵', '斧兵'],
  ['聖騎士', '聖武士']
];

function norm(input) {
  let s = String(input || '').trim().toLowerCase().normalize('NFKC');
  for (const [a, b] of simpMap) s = s.split(a).join(b);
  s = s.replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, '');
  s = s.split('之').join('').split('的').join('');
  return s;
}

function safeName(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '').slice(0, 40) || 'unnamed';
}

function baseName(u) {
  const s = String(u || '').split('?')[0].split('#')[0];
  const i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}

function imageNeedsReplace(image) {
  const s = String(image || '').trim();
  const l = s.toLowerCase();
  if (!s) return true;
  if (l.includes('no-image') || l.includes('no_image') || l.includes('placeholder')) return true;
  return sharedImageBasenames.has(baseName(s));
}

function scoreRaw(cardKey, siteKey) {
  if (cardKey === siteKey) return 100;
  if (siteKey.includes(cardKey)) return 70 + Math.min(20, cardKey.length);
  if (cardKey.includes(siteKey)) return 60 + Math.min(20, siteKey.length);
  let samePrefix = 0;
  const n = Math.min(cardKey.length, siteKey.length);
  while (samePrefix < n && cardKey[samePrefix] === siteKey[samePrefix]) samePrefix += 1;
  return samePrefix;
}

function expandBySynonym(key) {
  const out = new Set([key]);
  for (const fam of synonymFamilies) {
    const hit = fam.filter((w) => key.includes(w));
    if (!hit.length) continue;
    for (const from of hit) {
      for (const to of fam) {
        if (from === to) continue;
        out.add(key.replace(from, to));
      }
    }
  }
  return Array.from(out);
}

function score(cardKey, siteKey) {
  const candsA = expandBySynonym(cardKey);
  const candsB = expandBySynonym(siteKey);
  let best = -1;
  for (const a of candsA) {
    for (const b of candsB) {
      const s = scoreRaw(a, b);
      if (s > best) best = s;
    }
  }
  return best;
}

async function main() {
  const raw = fs.readFileSync(dataPath, 'utf8');
  const json = JSON.parse(raw);
  const cards = Array.isArray(json) ? json : (Array.isArray(json.cards) ? json.cards : []);

  const customFiles = fs.existsSync(customDir) ? fs.readdirSync(customDir) : [];
  const customIds = new Set();
  for (const f of customFiles) {
    const m = String(f).match(/^(f_\d+)/i);
    if (m) customIds.add(m[1]);
  }

  const htmlResp = await fetch(listUrl);
  if (!htmlResp.ok) throw new Error('card_viewer_fetch_' + htmlResp.status);
  const html = await htmlResp.text();

  const rx = /<div class="card_l lazyload"[^>]*data-bg="([^"]+)"[\s\S]{0,1200}?<div class="card_name[^>]*>([^<]+)<\/div>/g;
  const entries = [];
  let m;
  while ((m = rx.exec(html)) !== null) {
    const rel = String(m[1] || '').trim();
    const name = String(m[2] || '').trim();
    if (!rel || !name) continue;
    const key = norm(name);
    if (!key) continue;
    const url = rel.startsWith('http') ? rel : (baseUrl + rel.replace(/^\/+/, ''));
    entries.push({ key, name, url });
  }

  const byKey = new Map();
  for (const e of entries) {
    if (!byKey.has(e.key)) byKey.set(e.key, []);
    const arr = byKey.get(e.key);
    if (!arr.find((x) => x.url === e.url)) arr.push(e);
  }

  const keyList = Array.from(byKey.keys());

  let checked = 0;
  let fuzzyMatched = 0;
  let downloaded = 0;
  let updated = 0;
  const report = ['id\tname\tcard_key\tsite_key\tchosen_url\toutput_file\tstatus'];

  for (const c of cards) {
    const id = String(c.id || '').trim();
    const name = String(c.name || '').trim();
    if (!id || !name) continue;
    if (customIds.has(id)) continue;
    if (!imageNeedsReplace(c.image)) continue;

    checked += 1;
    const ck = norm(name);
    if (!ck || ck.length < 2) continue;

    const exact = byKey.get(ck);
    if (exact && exact.length) continue;

    let bestKey = '';
    let bestScore = -1;
    let tie = false;
    for (const sk of keyList) {
      const sc = score(ck, sk);
      if (sc > bestScore) {
        bestScore = sc;
        bestKey = sk;
        tie = false;
      } else if (sc === bestScore) {
        tie = true;
      }
    }

    if (bestScore < 76 || tie || !bestKey) {
      report.push([id, name, ck, '', '', '', 'no_safe_match'].join('\t'));
      continue;
    }

    const candidates = byKey.get(bestKey) || [];
    if (!candidates.length) {
      report.push([id, name, ck, bestKey, '', '', 'empty_candidate'].join('\t'));
      continue;
    }

    fuzzyMatched += 1;

    let ok = false;
    for (const cand of candidates) {
      try {
        const res = await fetch(cand.url);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf || buf.length < 1024) continue;

        let ext = path.extname(baseName(cand.url)).toLowerCase();
        if (!ext || ext.length > 6) ext = '.jpg';
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) ext = '.jpg';

        const outName = `${id}_${safeName(name)}${ext}`;
        fs.writeFileSync(path.join(customDir, outName), buf);
        downloaded += 1;

        const webPath = '/cards/custom/' + outName;
        if (String(c.image || '') !== webPath) {
          c.image = webPath;
          updated += 1;
        }

        report.push([id, name, ck, bestKey, cand.url, outName, 'downloaded'].join('\t'));
        ok = true;
        break;
      } catch {
      }
    }

    if (!ok) report.push([id, name, ck, bestKey, candidates[0].url, '', 'download_failed'].join('\t'));
  }

  if (Array.isArray(json.cards)) json.cards = cards;
  fs.writeFileSync(dataPath, JSON.stringify(Array.isArray(json) ? cards : json, null, 2), 'utf8');
  fs.writeFileSync(reportPath, report.join('\n'), 'utf8');

  console.log('checked_cards', checked);
  console.log('fuzzy_matched', fuzzyMatched);
  console.log('downloaded', downloaded);
  console.log('updated_json', updated);
  console.log('report', reportPath);
}

main().catch((e) => {
  console.error('ERR', e && e.message ? e.message : e);
  process.exit(1);
});


