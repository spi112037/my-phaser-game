const fs=require('fs');
const path=require('path');
const root='D:/pray/my-phaser-game';
const cards=JSON.parse(fs.readFileSync(path.join(root,'src/data/flameCardsBest.json'),'utf8'));
const pub=path.join(root,'public');
const ciDir=path.join(pub,'cards/immortalchicks_ci');
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

const eliteMissing=cards.filter(c=>Number(c.quality||0)>=6 && !hasImage(c));
const lines=eliteMissing.map(c=>`${c.id}\t${c.name}\tQ${c.quality}\tcost:${c.cost}`);
const outPath=path.join(root,'elite_missing_cards.txt');
fs.writeFileSync(outPath,lines.join('\n'),'utf8');
console.log('elite_missing_count',eliteMissing.length);
console.log('out',outPath);
console.log(lines.slice(0,80).join('\n'));
