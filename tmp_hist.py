import requests, json
pid='a5c87081-0369-4d00-a0c5-14fce3ba26c5'
api='http://127.0.0.1:8000'
h=requests.get(api+f'/history/{pid}',timeout=30).json()
item=h.get(pid,{})
outs=item.get('outputs',{})
for nid,node in outs.items():
    imgs=node.get('images',[])
    if imgs:
        print('node',nid,'count',len(imgs))
        for im in imgs[:5]:
            print(im)
