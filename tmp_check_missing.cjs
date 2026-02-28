const fs=require('fs');
const path=require('path');
const root='D:/pray/my-phaser-game';
const cards=JSON.parse(fs.readFileSync(path.join(root,'src/data/flameCardsBest.json'),'utf8'));
const pub=path.join(root,'public');
const ciDir=path.join(pub,'cards/immortalchicks_ci');
const ciSet=new Set(fs.existsSync(ciDir)?fs.readdirSync(ciDir).map(f=>f.toLowerCase()):[]);
let missing=[];
for(const c of cards){
  const img=(c.image||'').trim();
  const id=(c.id||'').trim();
  if(!id) continue;
  let exists=false;
  if(img){
    const p=path.join(pub,img.replace(/^\//,''));
    exists=fs.existsSync(p);
  }
  if(!exists){
    const ex=['.png','.jpg','.jpeg','.webp'];
    const hasCI=ex.some(ext=>ciSet.has((id+ext).toLowerCase()));
    if(hasCI) continue;
    missing.push({id,name:c.name||'',image:img,description:c.description||''});
  }
}
console.log('cards',cards.length,'missing_need_generate',missing.length);
console.log(JSON.stringify(missing.slice(0,20),null,2));
