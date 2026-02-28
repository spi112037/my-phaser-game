import requests, json
j=requests.get('http://127.0.0.1:8000/object_info',timeout=30).json()
for k in ['LoadWanVideoT5TextEncoder','WanVideoTextEncode','WanVideoTextEncodeSingle','WanVideoVAELoader','WanVideoImageToVideoEncode','WanVideoModelLoader','WanVideoSampler','WanVideoDecode','LoadImage','SaveImage']:
    print('\n###',k)
    info=j.get(k)
    if not info:
        print('MISSING'); continue
    print(json.dumps(info.get('input',{}),ensure_ascii=False,indent=2)[:6000])
