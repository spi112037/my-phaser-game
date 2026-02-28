import requests,time,glob,os,shutil
api='http://127.0.0.1:8000'; pid='a2f202a4-b5b0-4281-8d12-29f1fbcdcd1c'
out=r'D:/pray/my-phaser-game/mv/op_draft/動畫/wan_24f'
os.makedirs(out,exist_ok=True)
for i in range(1200):
    h=requests.get(api+f'/history/{pid}',timeout=30).json()
    item=h.get(pid)
    if item:
      imgs=[]
      for n in item.get('outputs',{}).values(): imgs.extend(n.get('images',[]))
      print('done images',len(imgs))
      for im in imgs:
        src=os.path.join(r'D:/ComfyUI2/resources/ComfyUI/IMG',im.get('subfolder',''),im.get('filename',''))
        if os.path.exists(src): shutil.copy2(src,os.path.join(out,os.path.basename(src)))
      print('copied',len(glob.glob(out+'/*.png')))
      break
    if i%20==0: print('waiting',i)
    time.sleep(2)
else:
    print('timeout')
