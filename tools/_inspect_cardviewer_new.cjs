(async () => {
  const url = 'https://immortalchicks.com/dg/card_viewer/index.php?elite=1&group=new&job=all&card_name=&ability_type=all';
  const html = await (await fetch(url)).text();

  const blocks = html.split('<div class="col mb-3 bg-dark card_line').slice(1);
  console.log('blocks', blocks.length);

  for (let i = 0; i < Math.min(3, blocks.length); i += 1) {
    const b = blocks[i];
    const sid = (b.match(/title="(\d+)\s*-\s*[^"]*"/) || [,''])[1];
    const name = (b.match(/<div class="card_name[^>]*>([^<]+)<\/div>/) || [,''])[1].trim();
    const bg = (b.match(/data-bg="([^"]+)"/) || [,''])[1];
    const atk = (b.match(/<div class="attack_volume">([^<]+)<\/div>/) || [,''])[1].trim();
    const hp = (b.match(/<div class="card_hp">([^<]+)<\/div>/) || [,''])[1].trim();
    const init = (b.match(/<div class="init_ready">([^<]+)<\/div>/) || [,''])[1].trim();
    const quality = (b.match(/alt="★(\d+)"/) || [,''])[1];

    const abText = (b.match(/<div class="ability_text card_text"[^>]*>([\s\S]*?)<\/div>/) || [,''])[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();

    console.log('---');
    console.log({ sid, name, bg, atk, hp, init, quality });
    console.log('ability_preview', abText.slice(0, 220));
  }
})();
