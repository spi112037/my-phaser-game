(async()=>{
  const prompts=[
    {id:'bg_battlefield_01',name:'破曉城牆戰場',desc:'日系奇幻遊戲戰鬥場地背景，破曉時分的古城牆外戰場，前景石磚戰鬥區平整可放置單位，中景有破損旗幟與路障，遠景城門與烽火，光影戲劇化但不雜亂，無角色，無文字，16:9 構圖，適合作為卡牌戰鬥背景。'},
    {id:'bg_battlefield_02',name:'黃昏熔岩峽谷',desc:'日系奇幻戰鬥背景，黃昏熔岩峽谷戰場，前景為可辨識的平坦戰鬥地面與裂紋，中景黑曜岩與古代符文柱，遠景熔岩河與煙霧，色彩熱血橘紅，無角色，無文字，16:9 構圖。'},
    {id:'bg_battlefield_03',name:'月夜神殿遺跡',desc:'日系奇幻遊戲戰鬥場地，月夜神殿遺跡，前景乾淨石板戰鬥區，中景斷裂神像與藍色魔法陣殘痕，遠景高柱與星空，冷色神秘感，無角色，無文字，16:9 構圖。'}
  ];
  for(const p of prompts){
    const body={cardId:p.id,cardName:p.name,description:p.desc,abilityText:'',autoStart:false,autoShutdown:false,apiBase:'http://127.0.0.1:8000'};
    try{
      const res=await fetch('http://127.0.0.1:8787/api/comfy/generate-from-description',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const j=await res.json();
      console.log(p.id,res.status,j.imagePath||j.error||'fail');
    }catch(e){console.log(p.id,'ERR',String(e.message||e));}
  }
})();
