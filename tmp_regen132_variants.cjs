const variants=[
  {
    id:'f_132_v1',
    name:'重弩手V1',
    prompt:'日系奇幻卡牌插畫，male adult heavy crossbow soldier，雙手握持超大型重弩，重弩主體在畫面中央且佔比高，弩臂、弦、機械結構清楚可見；半蹲瞄準姿勢，城牆防線背景，深藍與鋼灰軍甲。能力元素：長射程重弩壓制。禁止：no sword, no spear, no staff, no wand, no idol stage, no bouquet, no pink pastel.'
  },
  {
    id:'f_132_v2',
    name:'重弩手V2',
    prompt:'anime fantasy card art, male arbalest ranger, giant arbalest weapon clearly visible front-center, both hands operating heavy crossbow trigger, kneeling aim pose, bolts loaded, siege-defense battlement scene, steel gray + dark navy palette, military armor, hard combat vibe, no cute idol style, no sword, no spear, no staff.'
  },
  {
    id:'f_132_v3',
    name:'重弩手V3',
    prompt:'男性重弩守軍，重型連動弩炮（heavy crossbow）必須完整入鏡且為主視覺，角色雙手持弩瞄準，弩箭發射瞬間，後座力明顯；黑金與鋼灰裝甲，戰場木柵與城牆夜戰背景。嚴禁劍、槍、法杖、弓。畫風統一日系奇幻戰鬥卡圖。'
  }
];
(async()=>{
 for(const v of variants){
  const body={cardId:v.id,cardName:v.name,description:v.prompt,abilityText:'重弩:射程+2。移動過的回合內無法攻擊。遠程類。',autoStart:false,autoShutdown:false,apiBase:'http://127.0.0.1:8000'};
  const res=await fetch('http://127.0.0.1:8787/api/comfy/generate-from-description',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const j=await res.json();
  console.log(v.id,res.status,j.imagePath||j.error||'fail');
 }
})();
