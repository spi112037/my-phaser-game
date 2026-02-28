const fs=require('fs');
const p='D:/pray/my-phaser-game/src/data/flameCardsBest.json';
const cards=JSON.parse(fs.readFileSync(p,'utf8'));
const ids=['f_12','f_18','f_24','f_41','f_42','f_83','f_84','f_90','f_96','f_102','f_108','f_114','f_120','f_125','f_126','f_132','f_138','f_144','f_150','f_156'];
for(const id of ids){
 const c=cards.find(x=>x.id===id);
 if(!c){console.log(id,'NOT_FOUND');continue;}
 console.log('\n'+id,c.name);
 console.log('ability1:',c.ability1||'');
 console.log('ability2:',c.ability2||'');
 console.log('ability3:',c.ability3||'');
}
