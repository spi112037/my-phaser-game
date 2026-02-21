const fs = require('fs');
const path = require('path');

const dataPath = 'd:/pray/my-phaser-game/src/data/flameCardsBest.json';
const customDir = 'd:/pray/my-phaser-game/public/cards/custom';
const reportPath = 'd:/pray/my-phaser-game/immortalchicks_cardviewer_download_report.txt';
const listUrl = 'https://immortalchicks.com/dg/card_viewer/index.php?elite=0&group=all&job=all&card_name=&ability_type=all';
const baseUrl = 'https://immortalchicks.com/dg/card_viewer/';

const sharedImageBasenames = new Set([
  'JP_Richarda.jpg','kuloudui.jpg','baer.jpg','jinhua_baer.jpg','shixianggui2.jpg','jinhua_qimeila.jpg','testcard.png.jpg'
]);

const simpMap = [
  ['猫','貓'],['剑','劍'],['龙','龍'],['兽','獸'],['灵','靈'],['恶','惡'],['圣','聖'],['战','戰'],['护','護'],
  ['飞','飛'],['击','擊'],['术','術'],['风','風'],['云','雲'],['门','門'],['亚','亞'],['丽','麗'],['国','國'],
  ['军','軍'],['万','萬'],['与','與'],['灭','滅'],['疗','療'],['伤','傷'],['复','復'],['体','體'],['罗','羅'],
  ['乌','烏'],['叶','葉'],['玛','瑪'],['贝','貝'],['萨','薩'],['兰','蘭'],['韩','韓'],['乔','喬'],['诺','諾'],['丝','絲'],['维','維'],
  ['骑','騎'],['团','團'],['连','連'],['温','溫'],['银','銀'],['胜','勝']
];

function norm(input) {
  let s = String(input || '').trim().toLowerCase().normalize('NFKC');
  for (const [a, b] of simpMap) s = s.split(a).join(b);
  s = s.replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, '');
  s = s.split('之').join('').split('的').join('');
  return s;
}

function safeName(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 40) || 'unnamed';
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
  const b = baseName(s);
  if (sharedImageBasenames.has(b)) return true;
  return false;
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
  const nameToUrls = new Map();
  let m;
  while ((m = rx.exec(html)) !== null) {
    const rel = String(m[1] || '').trim();
    const name = String(m[2] || '').trim();
    if (!rel || !name) continue;
    const key = norm(name);
    if (!key) continue;
    const url = rel.startsWith('http') ? rel : (baseUrl + rel.replace(/^\/+/, ''));
    if (!nameToUrls.has(key)) nameToUrls.set(key, []);
    const arr = nameToUrls.get(key);
    if (!arr.includes(url)) arr.push(url);
  }

  let checked = 0;
  let matched = 0;
  let downloaded = 0;
  let updated = 0;
  const report = [];
  report.push('id\tname\tchosen_url\toutput_file\tstatus');

  for (const c of cards) {
    const id = String(c.id || '').trim();
    const name = String(c.name || '').trim();
    if (!id || !name) continue;
    if (customIds.has(id)) continue;
    if (!imageNeedsReplace(c.image)) continue;

    checked += 1;
    const key = norm(name);
    const urls = nameToUrls.get(key) || [];
    if (!urls.length) {
      report.push([id, name, '', '', 'no_name_match'].join('\t'));
      continue;
    }

    matched += 1;
    let ok = false;
    for (const u of urls) {
      try {
        const res = await fetch(u);
        if (!res.ok) continue;
        const ab = await res.arrayBuffer();
        const buf = Buffer.from(ab);
        if (!buf || buf.length < 1024) continue;

        let ext = path.extname(baseName(u)).toLowerCase();
        if (!ext || ext.length > 6) ext = '.jpg';
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) ext = '.jpg';

        const outName = `${id}_${safeName(name)}${ext}`;
        const outFsPath = path.join(customDir, outName);
        fs.writeFileSync(outFsPath, buf);

        downloaded += 1;
        const webPath = '/cards/custom/' + outName;
        if (String(c.image || '') !== webPath) {
          c.image = webPath;
          updated += 1;
        }

        report.push([id, name, u, outName, 'downloaded'].join('\t'));
        ok = true;
        break;
      } catch {
        // try next url
      }
    }

    if (!ok) {
      report.push([id, name, urls[0], '', 'download_failed'].join('\t'));
    }
  }

  if (Array.isArray(json.cards)) json.cards = cards;
  const outJson = Array.isArray(json) ? cards : json;
  fs.writeFileSync(dataPath, JSON.stringify(outJson, null, 2), 'utf8');
  fs.writeFileSync(reportPath, report.join('\n'), 'utf8');

  console.log('card_viewer_names', nameToUrls.size);
  console.log('checked_cards', checked);
  console.log('matched_by_name', matched);
  console.log('downloaded', downloaded);
  console.log('updated_json', updated);
  console.log('report', reportPath);
}

main().catch((e) => {
  console.error('ERR', e && e.message ? e.message : e);
  process.exit(1);
});
