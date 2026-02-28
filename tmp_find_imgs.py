from PIL import Image
from pathlib import Path
import time
roots=[Path(r'D:/Downloads'),Path(r'D:/pray/my-phaser-game')]
now=time.time()
for root in roots:
    if not root.exists():
        continue
    print('\n#',root)
    c=0
    for p in sorted(root.rglob('*'), key=lambda x: x.stat().st_mtime if x.exists() else 0, reverse=True):
        if p.suffix.lower() not in ['.png','.jpg','.jpeg','.webp']:
            continue
        try:
            sz=Image.open(p).size
        except Exception:
            continue
        age=now-p.stat().st_mtime
        if age<3600*12 and sz[0]>=1400 and sz[1]>=500:
            print(p,sz)
            c+=1
            if c>=20:
                break
