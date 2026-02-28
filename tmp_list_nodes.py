import requests
j=requests.get('http://127.0.0.1:8000/object_info',timeout=20).json()
keys=list(j.keys())
for k in sorted(keys):
    if any(x in k.lower() for x in ['svd','video','animate','img2vid','imageonly','wan','hunyuan','vhs']):
        print(k)
