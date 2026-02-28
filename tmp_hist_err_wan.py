import requests, json
pid='6c6f6ac3-8578-482a-84ad-6944aa214a29'
api='http://127.0.0.1:8000'
item=requests.get(api+f'/history/{pid}',timeout=30).json().get(pid,{})
print(json.dumps(item.get('status',{}),ensure_ascii=False,indent=2)[:7000])
