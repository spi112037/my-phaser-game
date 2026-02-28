(async()=>{
  const prompts=[
    {id:'bg_battlefield_01',name:'戰場01',desc:'anime fantasy battlefield environment only, no human, no character, no people, no portrait, wide battle arena, ruined city wall and torches, clean playable ground, cinematic lighting, background art for game battlefield, ultrawide composition'},
    {id:'bg_battlefield_02',name:'戰場02',desc:'anime fantasy battlefield environment only, no human, no character, no people, no portrait, lava canyon battlefield, wide horizontal arena, clear ground plane for units, dramatic warm lighting, ultrawide background'},
    {id:'bg_battlefield_03',name:'戰場03',desc:'anime fantasy battlefield environment only, no human, no character, no people, no portrait, moonlit temple ruins, wide horizontal arena floor, blue magical atmosphere, ultrawide background for strategy battle'}
  ];
  for(const p of prompts){
    const body={cardId:p.id,cardName:p.name,description:p.desc,abilityText:'',autoStart:false,autoShutdown:false,apiBase:'http://127.0.0.1:8000'};
    const res=await fetch('http://127.0.0.1:8787/api/comfy/generate-from-description',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const j=await res.json();
    console.log(p.id,res.status,j.imagePath||j.error||'fail');
  }
})();
