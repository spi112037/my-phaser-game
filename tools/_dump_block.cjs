(async () => {
  const url = 'https://immortalchicks.com/dg/card_viewer/index.php?elite=1&group=new&job=all&card_name=&ability_type=all';
  const html = await (await fetch(url)).text();
  const i = html.indexOf('建御雷神');
  console.log('idx', i);
  console.log(html.slice(i - 1200, i + 2200));
})();
