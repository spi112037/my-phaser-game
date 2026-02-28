from pathlib import Path
p=Path(r'D:/pray/my-phaser-game/src/scenes/BattleScene.js')
s=p.read_text(encoding='utf-8')
s=s.replace('import { DEPLOY_LEFT_COL_MAX, DEPLOY_RIGHT_COL_MIN } from "../config/constants";','import { DEPLOY_LEFT_COL_MAX, DEPLOY_RIGHT_COL_MIN, GRID_X, GRID_Y, GRID_W, GRID_H } from "../config/constants";')
s=s.replace('    const w = this.scale.width;\\n    const h = this.scale.height;','    const w = this.scale.width;')
old='''    const bgIdx = Math.floor(this.rng() * BATTLEFIELD_BG_POOL.length);
    const bg = BATTLEFIELD_BG_POOL[Math.max(0, Math.min(BATTLEFIELD_BG_POOL.length - 1, bgIdx))];
    this.add.image(w / 2, h / 2, bg.key).setDisplaySize(w, h).setDepth(-1000);'''
new='''    const bgIdx = Math.floor(this.rng() * BATTLEFIELD_BG_POOL.length);
    const bg = BATTLEFIELD_BG_POOL[Math.max(0, Math.min(BATTLEFIELD_BG_POOL.length - 1, bgIdx))];
    const bgX = GRID_X + GRID_W / 2;
    const bgY = GRID_Y + GRID_H / 2;
    if (this.textures.exists(bg.key)) {
      this.add.image(bgX, bgY, bg.key).setDisplaySize(GRID_W, GRID_H).setDepth(-1000);
    } else {
      this.add.rectangle(bgX, bgY, GRID_W, GRID_H, 0x0b1935, 1).setDepth(-1000);
    }'''
s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
print('patched')
