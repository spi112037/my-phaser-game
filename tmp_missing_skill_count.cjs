const fs=require('fs');
const path=require('path');
const root='D:/pray/my-phaser-game';
const cards=JSON.parse(fs.readFileSync(path.join(root,'src/data/flameCardsBest.json'),'utf8'));
const pub=path.join(root,'public');
function hasImage(c){
  const img=String(c.image||'').trim();
  if(!img) return false;
  return fs.existsSync(path.join(pub,img.replace(/^\//,'')));
}
const missingSkill=cards.filter(c=>String(c.type||'')==='skill' && !hasImage(c));
console.log('missing_skill_count',missingSkill.length);
console.log(missingSkill.slice(0,30).map(c=>`${c.id}\t${c.name}\tQ${c.quality}\tcost:${c.cost}`).join('\n'));
