from huggingface_hub import hf_hub_download
from pathlib import Path
import shutil

targets=[
  ("guoyww/animatediff","mm_sd_v15_v2.ckpt",r"C:\Users\user\Documents\ComfyUI\models\animatediff_models\mm_sd_v15_v2.ckpt"),
  ("stabilityai/stable-video-diffusion-img2vid-xt-1-1","svd_xt_1_1.safetensors",r"C:\Users\user\Documents\ComfyUI\models\checkpoints\svd_xt_1_1.safetensors")
]
for repo,file,dst in targets:
    dstp=Path(dst)
    dstp.parent.mkdir(parents=True,exist_ok=True)
    print(f"DOWNLOADING {repo}:{file}")
    p=hf_hub_download(repo_id=repo,filename=file,resume_download=True)
    shutil.copy2(p,dstp)
    print(f"SAVED {dstp}")
print('DONE')
