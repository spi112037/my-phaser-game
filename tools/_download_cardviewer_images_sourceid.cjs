const fs = require('fs');
const path = require('path');

const dataPath = 'd:/pray/my-phaser-game/src/data/flameCardsBest.json';
const customDir = 'd:/pray/my-phaser-game/public/cards/custom';
const reportPath = 'd:/pray/my-phaser-game/immortalchicks_cardviewer_download_report_sourceid.txt';
const listUrl = 'https://immortalchicks.com/dg/card_viewer/index.php?elite=0&group=all&job=all&card_name=&ability_type=all';
const baseUrl = 'https://immortalchicks.com/dg/card_viewer/';

const sharedImageBasenames = new Set([
  'JP_Richarda.jpg','kuloudui.jpg','baer.jpg','jinhua_baer.jpg','shixianggui2.jpg','jinhua_qimeila.jpg','testcard.png.jpg'
]);

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

async function main() {
  const raw = fs.readFileSync(dataPath, 'utf8');
  const json = JSON.parse(raw);
  const cards = Array.isArray(json) ? json : (Array.isArray(json.cards) ? json.cards : []);

  const customIds = new Set();
  for (const f of (fs.existsSync(customDir) ? fs.readdirSync(customDir) : [])) {
    const m = String(f).match(/^(f_\d+)/i);
    if (m) customIds.add(m[1]);
  }

  const bySourceId = new Map();
  for (const c of cards) {
    const sid = String(c.sourceId || '').trim();
    if (!sid) continue;
    if (!bySourceId.has(sid)) bySourceId.set(sid, []);
    bySourceId.get(sid).push(c);
  }

  const html = await (await fetch(listUrl)).text();
  const rx = /<div class="m-1" title="(\d+)\s*-\s*[^"]*">[\s\S]{0,1400}?<div class="card_l lazyload"[^>]*data-bg="([^"]+)"[\s\S]{0,800}?<div class="card_name[^>]*>([^<]+)<\/div>/g;

  const sidToImage = new Map();
  let m;
  while ((m = rx.exec(html)) !== null) {
    const sid = String(m[1] || '').trim();
    const rel = String(m[2] || '').trim();
    if (!sid || !rel) continue;
    const url = rel.startsWith('http') ? rel : (baseUrl + rel.replace(/^\/+/, ''));
    if (!sidToImage.has(sid)) sidToImage.set(sid, []);
    const arr = sidToImage.get(sid);
    if (!arr.includes(url)) arr.push(url);
  }

  let checked = 0;
  let matched = 0;
  let downloaded = 0;
  let updated = 0;
  const report = ['sourceId\tid\tname\turl\toutput_file\tstatus'];

  for (const [sid, cardList] of bySourceId.entries()) {
    const urls = sidToImage.get(sid) || [];
    if (!urls.length) continue;

    for (const c of cardList) {
      const id = String(c.id || '').trim();
      const name = String(c.name || '').trim();
      if (!id || !name) continue;
      if (customIds.has(id)) continue;
      if (!imageNeedsReplace(c.image)) continue;

      checked += 1;
      matched += 1;
      let ok = false;

      for (const u of urls) {
        try {
          const res = await fetch(u);
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          if (!buf || buf.length < 1024) continue;

          let ext = path.extname(baseName(u)).toLowerCase();
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

          report.push([sid, id, name, u, outName, 'downloaded'].join('\t'));
          ok = true;
          break;
        } catch {
        }
      }

      if (!ok) report.push([sid, id, name, urls[0], '', 'download_failed'].join('\t'));
    }
  }

  if (Array.isArray(json.cards)) json.cards = cards;
  fs.writeFileSync(dataPath, JSON.stringify(Array.isArray(json) ? cards : json, null, 2), 'utf8');
  fs.writeFileSync(reportPath, report.join('\n'), 'utf8');

  console.log('checked_cards', checked);
  console.log('matched_by_sourceId', matched);
  console.log('downloaded', downloaded);
  console.log('updated_json', updated);
  console.log('report', reportPath);
}

main().catch((e) => {
  console.error('ERR', e && e.message ? e.message : e);
  process.exit(1);
});
