from PIL import Image
from pathlib import Path
base=Path(r'D:/pray/my-phaser-game/public/cards/custom')
for n in ['bg_battlefield_01__.png','bg_battlefield_02__.png','bg_battlefield_03__.png']:
 p=base/n
 if p.exists():
  print(n, Image.open(p).size)
 else:
  print(n,'MISSING')
