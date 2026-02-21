// 檔案路徑：src/ui/LaneBoardUI.js
import { LANES, FIELD_TOP_Y, FIELD_BOTTOM_Y, FIELD_LEFT_X, FIELD_RIGHT_X } from "../config/constants";

export default class LaneBoardUI {
  constructor(scene, onLaneClick) {
    this.scene = scene;
    this.onLaneClick = onLaneClick;

    this.container = scene.add.container(0, 0);
    this.laneRects = [];
    this.laneMidY = [];
    this.deployEnabled = false;

    this._draw();
  }

  _draw() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    // 背景
    this.container.add(this.scene.add.rectangle(w / 2, h / 2, w, h, 0x0b1422, 1));

    // 戰場框
    const fieldX = FIELD_LEFT_X;
    const fieldW = FIELD_RIGHT_X - FIELD_LEFT_X;
    const fieldY = FIELD_TOP_Y;
    const fieldH = FIELD_BOTTOM_Y - FIELD_TOP_Y;

    const frame = this.scene.add.rectangle(fieldX, fieldY, fieldW, fieldH, 0x000000, 0.18).setOrigin(0, 0);
    this.container.add(frame);

    for (let i = 0; i < LANES; i += 1) {
      const y0 = fieldY + (fieldH / LANES) * i;
      const laneH = fieldH / LANES;
      const midY = y0 + laneH / 2;
      this.laneMidY.push(midY);

      const rect = this.scene.add.rectangle(fieldX, y0, fieldW, laneH, 0xffffff, 0.04)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0xffffff, 0.06)
        .setInteractive({ useHandCursor: true });

      rect.on("pointerover", () => {
        if (!this.deployEnabled) return;
        rect.setFillStyle(0x9ddcff, 0.10);
      });

      rect.on("pointerout", () => rect.setFillStyle(0xffffff, 0.04));

      rect.on("pointerup", () => {
        if (!this.deployEnabled) return;
        if (typeof this.onLaneClick === "function") this.onLaneClick(i);
      });

      this.container.add(rect);
      this.laneRects.push(rect);
    }

    const midLine = this.scene.add.rectangle((FIELD_LEFT_X + FIELD_RIGHT_X) / 2, fieldY, 2, fieldH, 0x9ddcff, 0.14).setOrigin(0.5, 0);
    this.container.add(midLine);
  }

  setDeployEnabled(enabled) {
    this.deployEnabled = Boolean(enabled);
    for (let i = 0; i < this.laneRects.length; i += 1) {
      this.laneRects[i].setAlpha(this.deployEnabled ? 1 : 0.65);
    }
  }

  getLaneY(laneIndex) {
    return this.laneMidY[laneIndex] ?? this.laneMidY[0] ?? 250;
  }

  destroy() {
    this.container.destroy(true);
  }
}
