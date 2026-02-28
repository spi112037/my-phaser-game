import json, requests, time, os, glob, shutil
api='http://127.0.0.1:8000'
wf=json.load(open(r'D:/pray/my-phaser-game/workflows/wan_i2v_imageonly_24f_api.json','r',encoding='utf-8-sig'))
r=requests.post(api+'/prompt',json={'prompt':wf},timeout=30); r.raise_for_status(); pid=r.json()['prompt_id']; print('PID',pid)
out=r'D:/pray/my-phaser-game/mv/op_draft/動畫/wan_24f_imgonly'; os.makedirs(out,exist_ok=True)
for i in range(1800):
  item=requests.get(api+f'/history/{pid}',timeout=30).json().get(pid)
  if item:
    s=item.get('status',{}).get('status_str'); print('STATUS',s)
    if s!='success':
      import json as _j
      print(_j.dumps(item.get('status',{}),ensure_ascii=False,indent=2)[:2500])
      break
    imgs=[]
    for n in (item.get('outputs') or {}).values(): imgs.extend(n.get('images',[]))
    print('IMAGES',len(imgs))
    for im in imgs:
      src=os.path.join(r'D:/ComfyUI2/resources/ComfyUI/IMG',im.get('subfolder',''),im.get('filename',''))
      if os.path.exists(src): shutil.copy2(src, os.path.join(out, os.path.basename(src)))
    print('COPIED',len(glob.glob(out+'/wan_mage_ref_imgonly_*.png')))
    break
  if i%30==0: print('waiting',i)
  time.sleep(2)
else:
  print('TIMEOUT')
