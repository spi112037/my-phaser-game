const fs=require('fs');
const path=require('path');

const root='D:/pray/my-phaser-game';
const dataPath=path.join(root,'src/data/flameCardsBest.json');
const pub=path.join(root,'public');
const ciDir=path.join(pub,'cards/immortalchicks_ci');
const logPath=path.join(root,'elite_generate_progress.log');

const cards=JSON.parse(fs.readFileSync(dataPath,'utf8'));
const ciSet=new Set(fs.existsSync(ciDir)?fs.readdirSync(ciDir).map(f=>f.toLowerCase()):[]);
const exts=['.png','.jpg','.jpeg','.webp'];

function hasImage(c){
  const img=String(c.image||'').trim();
  if(img){
    const p=path.join(pub,img.replace(/^\//,''));
    if(fs.existsSync(p)) return true;
  }
  const id=String(c.id||'').trim();
  if(!id) return false;
  return exts.some(ext=>ciSet.has((id+ext).toLowerCase()));
}

function append(line){ fs.appendFileSync(logPath, line+'\n', 'utf8'); }

const targets=cards.filter(c=>Number(c.quality||0)>=6 && !hasImage(c));
append(`START ${new Date().toISOString()} total=${targets.length}`);

(async()=>{
  let ok=0, fail=0;
  for(let i=0;i<targets.length;i++){
    const c=targets[i];
    const id=String(c.id||'').trim();
    const name=String(c.name||id);
    const desc=String(c.description||'').trim();
    const ability=[c.ability1,c.ability2,c.ability3,c.ability4,c.ability5].filter(Boolean).join('；');
    const marker='\n生圖提示詞：';
    const prompt = desc.includes(marker) ? desc.split(marker)[1].trim() : `日系奇幻卡牌插畫，主題「${name}」，${desc.slice(0,260)}`;
    const body={cardId:id,cardName:name,description:prompt,abilityText:ability,autoStart:false,autoShutdown:false,apiBase:'http://127.0.0.1:8000'};
    try{
      const res=await fetch('http://127.0.0.1:8787/api/comfy/generate-from-description',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)
      });
      const j=await res.json();
      if(res.ok && j.ok && j.imagePath){
        c.image=j.imagePath;
        ok++;
        append(`OK ${i+1}/${targets.length} ${id} ${j.imagePath}`);
      } else {
        fail++;
        append(`FAIL ${i+1}/${targets.length} ${id} ${j.error||res.status}`);
      }
    }catch(e){
      fail++;
      append(`ERR ${i+1}/${targets.length} ${id} ${String(e.message||e)}`);
    }

    if((i+1)%10===0){
      fs.writeFileSync(dataPath, JSON.stringify(cards,null,2),'utf8');
      append(`CHECKPOINT ${i+1}/${targets.length} ok=${ok} fail=${fail}`);
    }
  }

  fs.writeFileSync(dataPath, JSON.stringify(cards,null,2),'utf8');
  append(`DONE ${new Date().toISOString()} ok=${ok} fail=${fail} total=${targets.length}`);
})();
