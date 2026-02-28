const fs=require('fs');
const path=require('path');
const root='D:/pray/my-phaser-game';
const cards=JSON.parse(fs.readFileSync(path.join(root,'src/data/flameCardsBest.json'),'utf8'));
const ids=['f_12','f_18','f_24','f_90','f_108','f_132','f_150','f_156'];
const marker='\n生圖提示詞：';
async function run(){
  for (const id of ids){
    const c=cards.find(x=>x.id===id);
    if(!c){ console.log(id,'not found'); continue; }
    const d=String(c.description||'');
    const prompt=d.includes(marker)?d.split(marker)[1].trim():d;
    const body={ cardId:id, cardName:c.name||id, description:prompt, abilityText:[c.ability1,c.ability2,c.ability3,c.ability4,c.ability5].filter(Boolean).join('；'), autoStart:false, autoShutdown:false, apiBase:'http://127.0.0.1:8000' };
    const res=await fetch('http://127.0.0.1:8787/api/comfy/generate-from-description',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const j=await res.json();
    console.log(id,res.status,j.imagePath||j.error||'fail');
  }
}
run();
