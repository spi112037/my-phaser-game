const fs = require('fs');

(async () => {
  const db = JSON.parse(fs.readFileSync('d:/pray/my-phaser-game/src/data/flameCardsBest.json', 'utf8'));
  const cards = Array.isArray(db) ? db : (Array.isArray(db.cards) ? db.cards : []);
  const dbSids = new Set(cards.map((c) => String(c.sourceId || '').trim()).filter(Boolean));

  const html = await (await fetch('https://immortalchicks.com/dg/card_viewer/index.php?elite=1&group=new&job=all&card_name=&ability_type=all')).text();

  const tableRx = /<div class="card_table[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g;
  const tables = html.match(tableRx) || [];

  const pageSids = new Set();
  for (const t of tables) {
    const sid = (t.match(/<div class="m-1" title="(\d+)\s*-/) || [,''])[1];
    if (sid) pageSids.add(String(sid));
  }

  const missing = [...pageSids].filter((sid) => !dbSids.has(sid));
  console.log('tables', tables.length);
  console.log('page_sourceIds', pageSids.size);
  console.log('missing_in_db', missing.length);
  console.log('sample_missing', missing.slice(0, 30).join(','));
})();
