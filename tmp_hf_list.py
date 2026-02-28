from huggingface_hub import list_repo_files
repos=[
 'guoyww/animatediff',
 'stabilityai/stable-video-diffusion-img2vid-xt',
 'stabilityai/stable-video-diffusion-img2vid-xt-1-1',
 'Kijai/ComfyUI-AnimateDiff-Evolved'
]
for r in repos:
    print(f"\n## {r}")
    try:
        files=list_repo_files(r)
        hits=[f for f in files if any(x in f.lower() for x in ['mm_sd','svd','safetensors','ckpt','rife'])]
        for f in hits[:50]:
            print(f)
        print('hits',len(hits),'total',len(files))
    except Exception as e:
        print('ERR',e)
