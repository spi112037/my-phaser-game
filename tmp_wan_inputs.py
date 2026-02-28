import requests, json
j=requests.get('http://127.0.0.1:8000/object_info',timeout=30).json()
for k in ['WanImageToVideo','WanImageToVideoApi','HunyuanVideo15ImageToVideo','HunyuanImageToVideo','WanVideoImageToVideoEncode','WanVideoModelLoader','WanVideoSampler','WanVideoDecode']:
    print('\n###',k)
    info=j.get(k)
    if not info:
        print('MISSING')
        continue
    inp=info.get('input',{})
    print(json.dumps(inp,ensure_ascii=False,indent=2)[:8000])
