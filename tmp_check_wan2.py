import requests, time, json
api='http://127.0.0.1:8000'; pid='bb4e683c-b23d-4aa6-af8a-e4f93e3c65b6'
for i in range(120):
  item=requests.get(api+f'/history/{pid}',timeout=30).json().get(pid)
  if item:
    s=item.get('status',{}).get('status_str')
    print('status',s)
    if s=='error':
      print(json.dumps(item.get('status',{}),ensure_ascii=False,indent=2)[:2000])
    else:
      outs=item.get('outputs',{})
      cnt=sum(len(v.get('images',[])) for v in outs.values() if isinstance(v,dict))
      print('images',cnt)
    break
  time.sleep(2)
else:
  print('pending')
