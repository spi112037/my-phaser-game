const fs=require('fs');
const path=require('path');
const root='D:/pray/my-phaser-game';
const result=JSON.parse(fs.readFileSync(path.join(root,'tmp_generate20_result.json'),'utf8'));
const p=path.join(root,'src/data/flameCardsBest.json');
const cards=JSON.parse(fs.readFileSync(p,'utf8'));
let n=0;
for(const r of result){
 if(!r.ok||!r.imagePath) continue;
 const c=cards.find(x=>x.id===r.id);
 if(!c) continue;
 c.image=r.imagePath;
 n++;
}
fs.writeFileSync(p,JSON.stringify(cards,null,2),'utf8');
console.log('updated image path',n);
