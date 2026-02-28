import json, requests, time, os, shutil, glob
api='http://127.0.0.1:8000'
wf=json.load(open(r'D:/pray/my-phaser-game/workflows/wan_i2v_prompt_24f_api.json','r',encoding='utf-8-sig'))
r=requests.post(api+'/prompt',json={'prompt':wf},timeout=30)
r.raise_for_status()
pid=r.json()['prompt_id']
print('PROMPT_ID',pid)
out=r'D:/pray/my-phaser-game/mv/op_draft/動畫/wan_24f'
os.makedirs(out,exist_ok=True)
for i in range(2400):
    item=requests.get(api+f'/history/{pid}',timeout=30).json().get(pid)
    if item:
      status=item.get('status',{}).get('status_str')
      print('STATUS',status)
      imgs=[]
      for n in (item.get('outputs') or {}).values(): imgs.extend(n.get('images',[]))
      print('IMAGES',len(imgs))
      for im in imgs:
        src=os.path.join(r'D:/ComfyUI2/resources/ComfyUI/IMG',im.get('subfolder',''),im.get('filename',''))
        if os.path.exists(src): shutil.copy2(src,os.path.join(out,os.path.basename(src)))
      print('COPIED',len(glob.glob(out+'/wan_mage_ref_*.png')))
      break
    if i%30==0: print('waiting',i)
    time.sleep(2)
else:
    print('TIMEOUT')
