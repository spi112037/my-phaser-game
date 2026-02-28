import json,requests,time,os,shutil,glob
api='http://127.0.0.1:8000'
wf_path=r'D:/pray/my-phaser-game/workflows/HunyuanVideo 1.5 I2V 720P.json'
wf=json.load(open(wf_path,'r',encoding='utf-8-sig'))
# patch inputs
wf['80']['inputs']['image']='mage_ref.png'
wf['78']['inputs']['length']=24
wf['78']['inputs']['width']=512
wf['78']['inputs']['height']=768
wf['101']['inputs']['fps']=24
wf['44']['inputs']['text']=(
'熱血動畫OP分鏡，魔法少女戰鬥段：鏡頭先中景，角色抬手施法，'
'手杖與掌心亮起藍白魔法，半透明護盾快速展開，符文環繞，'
'衣角與頭髮受能量風壓擺動，最後定格在戰鬥姿勢，'
'角色外觀保持與參考圖一致，臉部一致，服裝一致，單一角色。')
wf['93']['inputs']['text']='low quality, blurry, deformed, extra fingers, extra limbs, text, watermark, logo, bad anatomy, identity drift'
wf['142']['inputs']['filename_prefix']='mv/Hunyuan_i2v_mage_story_24f'

r=requests.post(api+'/prompt',json={'prompt':wf},timeout=30)
r.raise_for_status(); pid=r.json()['prompt_id']
print('PROMPT_ID',pid)
out_dir=r'D:/pray/my-phaser-game/mv/op_draft/動畫/hunyuan_24f_story'
os.makedirs(out_dir,exist_ok=True)
for i in range(3600):
    item=requests.get(api+f'/history/{pid}',timeout=30).json().get(pid)
    if item:
        status=item.get('status',{}).get('status_str')
        print('STATUS',status)
        outputs=item.get('outputs',{})
        # copy image frames if available
        copied=0
        for node in outputs.values():
            for im in node.get('images',[]) or []:
                src=os.path.join(r'D:/ComfyUI2/resources/ComfyUI/IMG',im.get('subfolder',''),im.get('filename',''))
                if os.path.exists(src):
                    shutil.copy2(src, os.path.join(out_dir, os.path.basename(src))); copied+=1
            for v in node.get('videos',[]) or []:
                src=os.path.join(r'D:/ComfyUI2/resources/ComfyUI/IMG',v.get('subfolder',''),v.get('filename',''))
                if os.path.exists(src):
                    shutil.copy2(src, os.path.join(out_dir, os.path.basename(src))); copied+=1
        print('COPIED',copied)
        print('FILES',len(glob.glob(out_dir+'/*')))
        break
    if i%60==0: print('waiting',i)
    time.sleep(2)
else:
    print('TIMEOUT')
