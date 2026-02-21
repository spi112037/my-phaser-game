const fs = require('fs');

const data = JSON.parse(fs.readFileSync('d:/pray/my-phaser-game/src/data/flameCardsBest.json', 'utf8'));
const cards = Array.isArray(data) ? data : (Array.isArray(data.cards) ? data.cards : []);
const sourceSet = new Set(cards.map((c) => String(c.sourceId || '')).filter(Boolean));

(async () => {
  const t = await (await fetch('https://immortalchicks.com/dg/card_viewer/index.php?elite=0&group=all&job=all&card_name=&ability_type=all')).text();
  const rx = /<div class="m-1" title="(\d+)\s*-\s*[^"]*">[\s\S]{0,1400}?<div class="card_l lazyload"[^>]*data-bg="([^"]+)"[\s\S]{0,800}?<div class="card_name[^>]*>([^<]+)<\/div>/g;
  let m;
  let blocks = 0;
  let hits = 0;
  while ((m = rx.exec(t)) !== null) {
    blocks += 1;
    if (sourceSet.has(String(m[1]))) hits += 1;
  }
  console.log('parsed_blocks', blocks);
  console.log('sourceId_hits', hits);
})();
