import requests, json
j=requests.get('http://127.0.0.1:8000/object_info',timeout=30).json()
for k in ['LoadImage','ImageOnlyCheckpointLoader','SVD_img2vid_Conditioning','VideoLinearCFGGuidance','KSampler','VAEDecode','SaveImage']:
    if k in j:
        print('\n##',k)
        info=j[k]
        inp=info.get('input',{})
        print(json.dumps(inp,ensure_ascii=False,indent=2)[:4000])
    else:
        print('MISSING',k)
