const fs=require('fs');
const path=require('path');
const root='D:/pray/my-phaser-game';
const dataPath=path.join(root,'src/data/flameCardsBest.json');
const cards=JSON.parse(fs.readFileSync(dataPath,'utf8'));
const pub=path.join(root,'public');
const limit=100;
function hasImage(c){
  const img=String(c.image||'').trim();
  if(!img) return false;
  return fs.existsSync(path.join(pub,img.replace(/^\//,'')));
}
const targets=cards.filter(c=>String(c.type||'')==='skill' && !hasImage(c)).slice(0,limit);
(async()=>{
  let ok=0;
  for(const c of targets){
    const id=String(c.id||'').trim();
    const name=String(c.name||id);
    const ability=[c.ability1,c.ability2,c.ability3,c.ability4,c.ability5].filter(Boolean).join('；');
    const prompt=`技能卡插畫，日系奇幻TCG技能圖，主題「${name}」，重點呈現技能效果元素，不強制角色臉部特寫，動態能量與符文構圖，無文字。技能描述：${ability||String(c.description||'').slice(0,180)}`;
    const body={cardId:id,cardName:name,description:prompt,abilityText:ability,autoStart:false,autoShutdown:false,apiBase:'http://127.0.0.1:8000'};
    try{
      const res=await fetch('http://127.0.0.1:8787/api/comfy/generate-from-description',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const j=await res.json();
      if(res.ok && j.ok && j.imagePath){ c.image=j.imagePath; ok++; console.log('OK',id,j.imagePath); }
      else console.log('FAIL',id,j.error||res.status);
    }catch(e){
      console.log('ERR',id,String(e.message||e));
    }
  }
  fs.writeFileSync(dataPath,JSON.stringify(cards,null,2),'utf8');
  console.log('done',ok,'/',targets.length);
})();
