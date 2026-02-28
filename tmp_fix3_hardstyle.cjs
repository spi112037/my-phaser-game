const fs=require('fs');
const p='D:/pray/my-phaser-game/src/data/flameCardsBest.json';
const cards=JSON.parse(fs.readFileSync(p,'utf8'));
const marker='\n生圖提示詞：';
const fix={
'f_132':'日系奇幻卡牌插畫，男性角色「重弩手」，成年男性、堅毅五官、短深色髮，穿深藍與鋼灰軍用護甲（非禮服），雙手操作大型重弩，重弩必須完整清楚入鏡，弩臂厚重金屬結構可見；戰鬥姿態為半蹲穩定瞄準。能力元素「重弩+長射程」：遠距離瞄準線、沉重後座力、粗重弩箭。色彩規則：主色深藍/鋼灰/黑金，禁止粉紅與糖果色，禁止偶像舞台感，背景為城牆防線夜戰。',
'f_150':'日系奇幻卡牌插畫，男性角色「連弩手」，成年男性軍士、冷靜表情、短髮，穿黑灰軍裝與護臂，手持雙連發機械弩，武器細節清晰且在畫面中心；能力元素「連弩雙發」：同時射出兩支弩箭、雙光軌平行飛行命中。色彩規則：深灰、暗紅點綴、鋼鐵色，禁止粉色系與少女飾品，背景為戰場木柵與防禦工事，整體硬派軍武感。',
'f_156':'日系奇幻卡牌插畫，男性角色「禁衛連弩手」，成年男性皇家禁衛、嚴肅氣質，黑金禁衛甲冑與深色披肩，手持連發弩，回身警戒並射擊後方目標；能力元素「連弩雙發+警戒」：一邊警戒一邊雙箭連射，後方敵影被鎖定。色彩規則：黑金、深藍、鋼灰為主，禁止粉彩與少女化配色，禁止偶像風；背景宮廷城門防線，畫風統一日系奇幻戰鬥卡圖。'
};
for(const c of cards){
 if(!fix[c.id]) continue;
 const base=String(c.description||'').split(marker)[0];
 c.description=base+marker+fix[c.id];
}
fs.writeFileSync(p,JSON.stringify(cards,null,2),'utf8');
console.log('updated',Object.keys(fix).length);
