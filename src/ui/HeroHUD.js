export default class HeroHUD {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(2200);

    this.leftText = scene.add.text(20, 20, "", { fontSize: "16px", color: "#cfe8ff" });
    this.rightText = scene.add
      .text(scene.scale.width - 20, 20, "", { fontSize: "16px", color: "#ffd7d7" })
      .setOrigin(1, 0);
    this.turnText = scene.add
      .text(scene.scale.width / 2, 20, "", { fontSize: "16px", color: "#ffffff" })
      .setOrigin(0.5, 0);

    this.container.add([this.leftText, this.rightText, this.turnText]);
    this.lastLogs = [];
  }

  setTop(leftStr, rightStr, turnStr) {
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
