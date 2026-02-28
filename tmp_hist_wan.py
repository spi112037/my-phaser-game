import requests, json
pid='a2f202a4-b5b0-4281-8d12-29f1fbcdcd1c'
api='http://127.0.0.1:8000'
h=requests.get(api+f'/history/{pid}',timeout=30).json().get(pid,{})
print('keys',h.keys())
print(json.dumps(h.get('status',{}),ensure_ascii=False,indent=2)[:4000])
print('outputs keys',list((h.get('outputs') or {}).keys()))
