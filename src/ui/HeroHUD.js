export default class HeroHUD {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(2200);

    const w = scene.scale.width;

    this.leftGlow = scene.add.ellipse(206, 42, 360, 72, 0x56c6ff, 0.12);
    this.rightGlow = scene.add.ellipse(w - 206, 42, 360, 72, 0xff7ca8, 0.11);
    this.turnGlow = scene.add.ellipse(w / 2, 44, 320, 86, 0xf7cf74, 0.12);

    this.leftShadow = scene.add.rectangle(214, 42, 388, 56, 0x000000, 0.28);
    this.rightShadow = scene.add.rectangle(w - 214, 42, 388, 56, 0x000000, 0.28);
    this.turnShadow = scene.add.rectangle(w / 2, 42, 268, 60, 0x000000, 0.3);

    this.leftPanel = scene.add.rectangle(214, 38, 388, 56, 0x091627, 0.86).setStrokeStyle(2, 0x8fd8ff, 0.5);
    this.rightPanel = scene.add.rectangle(w - 214, 38, 388, 56, 0x25121b, 0.86).setStrokeStyle(2, 0xffacc0, 0.52);
    this.turnPanel = scene.add.rectangle(w / 2, 38, 268, 60, 0x181624, 0.92).setStrokeStyle(2, 0xffe8a3, 0.65);

    this.leftEdge = scene.add.rectangle(214, 15, 340, 2, 0xe7f6ff, 0.3);
    this.rightEdge = scene.add.rectangle(w - 214, 15, 340, 2, 0xffdbe6, 0.3);
    this.turnEdge = scene.add.rectangle(w / 2, 11, 206, 2, 0xfff0ba, 0.38);

    this.leftBadge = scene.add.circle(52, 38, 18, 0x163652, 0.96).setStrokeStyle(2, 0xa7e5ff, 0.68);
    this.rightBadge = scene.add.circle(w - 52, 38, 18, 0x4a2031, 0.96).setStrokeStyle(2, 0xffc4d4, 0.68);
    this.leftBadgeText = scene.add.text(52, 38, "L", { fontSize: "18px", color: "#eff9ff", fontStyle: "bold" }).setOrigin(0.5);
    this.rightBadgeText = scene.add.text(w - 52, 38, "R", { fontSize: "18px", color: "#fff2f6", fontStyle: "bold" }).setOrigin(0.5);

    this.leftText = scene.add.text(82, 24, "", { fontSize: "17px", color: "#e0f3ff", fontStyle: "bold" });
    this.rightText = scene.add
      .text(w - 82, 24, "", { fontSize: "17px", color: "#ffe3ea", fontStyle: "bold" })
      .setOrigin(1, 0);
    this.turnText = scene.add
      .text(w / 2, 22, "", { fontSize: "20px", color: "#fff6d6", fontStyle: "bold", stroke: "#2d1900", strokeThickness: 4 })
      .setOrigin(0.5, 0);

    this.container.add([
      this.leftGlow,
      this.rightGlow,
      this.turnGlow,
      this.leftShadow,
      this.rightShadow,
      this.turnShadow,
      this.leftPanel,
      this.rightPanel,
      this.turnPanel,
      this.leftEdge,
      this.rightEdge,
      this.turnEdge,
      this.leftBadge,
      this.rightBadge,
      this.leftBadgeText,
      this.rightBadgeText,
      this.leftText,
      this.rightText,
      this.turnText
    ]);

    scene.tweens.add({
      targets: [this.leftGlow, this.rightGlow, this.turnGlow],
      alpha: { from: 0.08, to: 0.18 },
      duration: 1800,
      yoyo: true,
      repeat: -1
    });

    this.lastLogs = [];
    this.prevLeftHp = null;
    this.prevRightHp = null;
  }

  _extractHp(text) {
    const m = String(text || "").match(/HP:(\d+)/);
    return m ? Number(m[1]) : null;
  }

  _pulsePanel(panel, glow, color = 0xff8a8a, baseStroke = 0xffffff) {
    if (!panel) return;
    panel.setStrokeStyle(3, color, 1);
    if (glow) glow.setFillStyle(color, 0.24);
    this.scene.tweens.add({
      targets: [panel, glow].filter(Boolean),
      alpha: { from: 0.9, to: 1 },
      duration: 120,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        panel.setStrokeStyle(2, baseStroke, 0.52);
        if (glow === this.leftGlow) glow.setFillStyle(0x56c6ff, 0.12);
        if (glow === this.rightGlow) glow.setFillStyle(0xff7ca8, 0.11);
      }
    });
  }

  setTop(leftStr, rightStr, turnStr) {
    const leftHp = this._extractHp(leftStr);
    const rightHp = this._extractHp(rightStr);

    if (this.prevLeftHp != null && leftHp != null && leftHp < this.prevLeftHp) {
      this._pulsePanel(this.leftPanel, this.leftGlow, 0x81d1ff, 0x8fd8ff);
    }
    if (this.prevRightHp != null && rightHp != null && rightHp < this.prevRightHp) {
      this._pulsePanel(this.rightPanel, this.rightGlow, 0xff93b3, 0xffacc0);
    }

    this.prevLeftHp = leftHp;
    this.prevRightHp = rightHp;

    this.leftText.setText(leftStr);
    this.rightText.setText(rightStr);
    this.turnText.setText(turnStr);
  }

  setLog(lines) {
    this.lastLogs = Array.isArray(lines) ? [...lines] : [];
  }

  destroy() {
    this.container.destroy(true);
  }
}
