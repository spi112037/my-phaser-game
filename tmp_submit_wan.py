import json, requests
api='http://127.0.0.1:8000'
wf=json.load(open(r'D:/pray/my-phaser-game/workflows/wan_i2v_prompt_24f_api.json','r',encoding='utf-8-sig'))
r=requests.post(api+'/prompt',json={'prompt':wf},timeout=30)
print(r.status_code)
print(r.text[:2000])
