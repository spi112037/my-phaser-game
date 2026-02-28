import json, requests, time, os, glob, shutil
api='http://127.0.0.1:8000'
wf_path=r'D:/pray/my-phaser-game/workflows/wan_i2v_imageonly_24f_api.json'
out=r'D:/pray/my-phaser-game/mv/op_draft/動畫/wan_24f_imgonly'
log=r'D:/pray/my-phaser-game/mv/op_draft/動畫/wan_24f_imgonly/run.log'
os.makedirs(out,exist_ok=True)
open(log,'w',encoding='utf-8').write('start\n')
wf=json.load(open(wf_path,'r',encoding='utf-8-sig'))
r=requests.post(api+'/prompt',json={'prompt':wf},timeout=30); r.raise_for_status(); pid=r.json()['prompt_id']
with open(log,'a',encoding='utf-8') as f: f.write(f'PID {pid}\n')
for i in range(3600):
  item=requests.get(api+f'/history/{pid}',timeout=30).json().get(pid)
  if item:
    s=item.get('status',{}).get('status_str')
    with open(log,'a',encoding='utf-8') as f: f.write(f'STATUS {s}\n')
    if s!='success':
      import json as _j
      with open(log,'a',encoding='utf-8') as f: f.write(_j.dumps(item.get('status',{}),ensure_ascii=False)[:8000]+'\n')
      break
    imgs=[]
    for n in (item.get('outputs') or {}).values(): imgs.extend(n.get('images',[]))
    with open(log,'a',encoding='utf-8') as f: f.write(f'IMAGES {len(imgs)}\n')
    for im in imgs:
      src=os.path.join(r'D:/ComfyUI2/resources/ComfyUI/IMG',im.get('subfolder',''),im.get('filename',''))
      if os.path.exists(src): shutil.copy2(src, os.path.join(out, os.path.basename(src)))
    with open(log,'a',encoding='utf-8') as f: f.write(f'COPIED {len(glob.glob(out+"/*.png"))}\n')
    break
  if i%60==0:
    with open(log,'a',encoding='utf-8') as f: f.write(f'waiting {i}\n')
  time.sleep(2)
else:
  with open(log,'a',encoding='utf-8') as f: f.write('TIMEOUT\n')
