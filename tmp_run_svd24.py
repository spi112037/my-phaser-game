import json, time, requests, os, shutil, glob
api='http://127.0.0.1:8000'
wf_path=r'D:/pray/my-phaser-game/workflows/svd_i2v_24f_api.json'
out_copy=r'D:/pray/my-phaser-game/mv/op_draft/動畫/svd_24f'
os.makedirs(out_copy,exist_ok=True)
wf=json.load(open(wf_path,'r',encoding='utf-8-sig'))
r=requests.post(api+'/prompt',json={'prompt':wf},timeout=30)
r.raise_for_status()
pid=r.json()['prompt_id']
print('PROMPT_ID',pid)
for _ in range(900):
    h=requests.get(api+f'/history/{pid}',timeout=30).json()
    item=h.get(pid)
    if item:
        outputs=item.get('outputs',{})
        imgs=[]
        for n in outputs.values():
            imgs.extend(n.get('images',[]))
        print('IMAGES',len(imgs))
        for im in imgs:
            fname=im.get('filename'); sub=im.get('subfolder',''); typ=im.get('type','output')
            src=os.path.join(r'C:/Users/user/Documents/ComfyUI/output',sub,fname)
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(out_copy, os.path.basename(src)))
        print('COPIED',len(glob.glob(out_copy+'/*.png')))
        break
    time.sleep(1.5)
else:
    print('TIMEOUT')
