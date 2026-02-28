(async()=>{
  const prompt='日系奇幻卡牌插畫，男性重弩手，參考中世紀弩兵：紅色兜帽披風、白灰輕甲、皮革護腕，雙手持一把大型木鋼混合重弩（heavy crossbow）且武器完整清楚入鏡，弩臂與弩弦可見；姿態為站姿警戒準備射擊，不拿任何劍槍法杖。配色以深紅、褐色、鋼灰為主，避免粉彩。背景簡潔戰場或城牆。no sword, no spear, no staff, no idol, no bouquet.';
  const body={cardId:'f_132',cardName:'重弩手',description:prompt,abilityText:'重弩:射程+2。移動過的回合內無法攻擊。遠程類。',autoStart:false,autoShutdown:false,apiBase:'http://127.0.0.1:8000'};
  const res=await fetch('http://127.0.0.1:8787/api/comfy/generate-from-description',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const j=await res.json();
  console.log(res.status,j.imagePath||j.error||'fail');
})();
