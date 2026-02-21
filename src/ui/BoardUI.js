// 檔案路徑：src/ui/BoardUI.js
// 4x12 戰場格子 UI（點格子觸發 onTileClick）
export default class BoardUI {
  constructor(scene, x, y, cols, rows, tileSize, onTileClick) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.cols = cols;
    this.rows = rows;
    this.tileSize = tileSize;

    this.onTileClick = onTileClick;

    this.container = scene.add.container(x, y);

    // grid 資料：[{unit|null}]
    this.grid = [];
    for (let r = 0; r < rows; r += 1) {
      const row = [];
      for (let c = 0; c < cols; c += 1) row.push(null);
      this.grid.push(row);
    }

    this.tileRects = [];
    this.unitTexts = [];

    this._drawGrid();
  }

  _drawGrid() {
    const w = this.cols * this.tileSize;
    const h = this.rows * this.tileSize;

    // 背板
    const bg = this.scene.add.rectangle(0, 0, w + 12, h + 12, 0x000000, 0.18).setOrigin(0, 0);
    this.container.add(bg);

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        const px = 6 + x * this.tileSize;
        const py = 6 + y * this.tileSize;

        const rect = this.scene.add.rectangle(px, py, this.tileSize - 2, this.tileSize - 2, 0xffffff, 0.06)
          .setOrigin(0, 0)
          .setStrokeStyle(1, 0xffffff, 0.08)
          .setInteractive({ useHandCursor: true });

        rect.on("pointerover", () => rect.setStrokeStyle(1, 0x9ddcff, 0.6));
        rect.on("pointerout", () => rect.setStrokeStyle(1, 0xffffff, 0.08));
        rect.on("pointerup", () => {
          if (typeof this.onTileClick === "function") this.onTileClick(x, y);
        });

        const txt = this.scene.add.text(px + 6, py + 6, "", {
          fontSize: "12px",
          color: "#ffffff",
          wordWrap: { width: this.tileSize - 12 }
        });

        this.container.add(rect);
        this.container.add(txt);

        this.tileRects.push(rect);
        this.unitTexts.push(txt);
      }
    }

    // 中線提示（分左右半場）
    const midX = 6 + (Math.floor(this.cols / 2) * this.tileSize) - 1;
    const midLine = this.scene.add.rectangle(midX, 6, 2, this.rows * this.tileSize, 0x9ddcff, 0.18).setOrigin(0, 0);
    this.container.add(midLine);
  }

  isEmpty(x, y) {
    return !this.grid[y]?.[x];
  }

  placeUnit(x, y, unit) {
    this.grid[y][x] = unit;
    this.render();
  }

  removeUnit(x, y) {
    this.grid[y][x] = null;
    this.render();
  }

  render() {
    // 更新每格的文字顯示
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.cols; x += 1) {
        const unit = this.grid[y][x];
        const idx = y * this.cols + x;
        const txt = this.unitTexts[idx];
        const rect = this.tileRects[idx];

        if (!unit) {
          txt.setText("");
          rect.setFillStyle(0xffffff, 0.06);
          continue;
        }

        const tag = unit.side === "L" ? "L" : "R";
        txt.setText(`${tag}:${unit.name}\nHP:${unit.hp}`);
        rect.setFillStyle(unit.side === "L" ? 0x4db3ff : 0xff6b6b, 0.12);
      }
    }
  }

  destroy() {
    this.container.destroy(true);
  }
}

