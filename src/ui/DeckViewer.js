// 檔案路徑：src/ui/DeckViewer.js
export default class DeckViewer {
  constructor(scene, x, y, combatant) {
    this.scene = scene;
    this.combatant = combatant;

    this.btn = scene.add.text(x, y, "[出牌]", {
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "rgba(255,255,255,0.10)",
      padding: { x: 8, y: 4 }
    }).setInteractive({ useHandCursor: true });

    this.btn.on("pointerup", () => {
      // 玩家（L1）才允許手動出牌
      if (combatant.controller !== "PLAYER") return;

      const card = combatant.ready[0];
      if (!card) return;
      scene.combatSystem.playCard(combatant, card);
      this.update();
    });

    this.update();
  }

  update() {
    const c = this.combatant;
    this.btn.setAlpha(c.hp > 0 ? 1 : 0.35);
    this.btn.setText(c.controller === "PLAYER" ? "[出牌]" : "[AI]");
  }
}
