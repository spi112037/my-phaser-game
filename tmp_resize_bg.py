from PIL import Image
from pathlib import Path
base=Path(r'D:/pray/my-phaser-game/public/cards/custom')
files=[('bg_battlefield_01__01.png','bg_battlefield_01__.png'),('bg_battlefield_02__02.png','bg_battlefield_02__.png'),('bg_battlefield_03__03.png','bg_battlefield_03__.png')]
for srcn,dstn in files:
    src=base/srcn
    if not src.exists():
        continue
    im=Image.open(src).convert('RGB')
    tw,th=1400,500
    sw,sh=im.size
    scale=max(tw/sw,th/sh)
    nw,nh=int(sw*scale),int(sh*scale)
    im2=im.resize((nw,nh),Image.Resampling.LANCZOS)
    left=(nw-tw)//2; top=(nh-th)//2
    out=im2.crop((left,top,left+tw,top+th))
    out.save(base/dstn,quality=95)
    print(dstn,out.size)
