const fs=require('fs');
const path=require('path');
const root='D:/pray/my-phaser-game';
const cards=JSON.parse(fs.readFileSync(path.join(root,'src/data/flameCardsBest.json'),'utf8'));
const ids=['f_12','f_18','f_24','f_41','f_42','f_83','f_84','f_90','f_96','f_102','f_108','f_114','f_120','f_125','f_126','f_132','f_138','f_144','f_150','f_156'];
const marker='\n生圖提示詞：';
async function run(){
  const out=[];
  for (const id of ids){
    const c=cards.find(x=>x.id===id);
    if(!c){ out.push({id,ok:false,error:'card_not_found'}); continue; }
    const d=String(c.description||'');
    const prompt=d.includes(marker)?d.split(marker)[1].trim():d;
    const body={ cardId:id, cardName:c.name||id, description:prompt, abilityText:[c.ability1,c.ability2,c.ability3,c.ability4,c.ability5].filter(Boolean).join('；'), autoStart:false, autoShutdown:false, apiBase:'http://127.0.0.1:8000' };
    try{
      const res=await fetch('http://127.0.0.1:8787/api/comfy/generate-from-description',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const j=await res.json();
      out.push({id,ok:res.ok&&j.ok===true,status:res.status,imagePath:j.imagePath||'',error:j.error||''});
      console.log(id,res.status,j.ok===true?j.imagePath:(j.error||'fail'));
    }catch(e){
      out.push({id,ok:false,error:String(e.message||e)});
      console.log(id,'ERR',String(e.message||e));
    }
  }
  fs.writeFileSync(path.join(root,'tmp_generate20_result.json'),JSON.stringify(out,null,2),'utf8');
  const ok=out.filter(x=>x.ok).length;
  console.log('done',ok,'/',out.length);
}
run();
