// 檔案路徑：src/ui/ReadyBar.js
export default class ReadyBar {
  constructor(scene, x, y, combatant) {
    this.scene = scene;
    this.combatant = combatant;

    this.bg = scene.add.rectangle(x, y, 300, 18, 0x000000, 0.35).setOrigin(0, 0.5);
    this.fill = scene.add.rectangle(x + 2, y, 296, 14, 0x4db3ff, 0.6).setOrigin(0, 0.5);

    this.text = scene.add.text(x, y - 18, "", { fontSize: "12px", color: "#ffffff" });
    this.update();
  }

  update() {
    const c = this.combatant;
    const hpRatio = c.maxHp > 0 ? c.hp / c.maxHp : 0;
    this.fill.width = Math.max(0, 296 * hpRatio);

    this.text.setText(
      `${c.id}  HP:${c.hp}/${c.maxHp}  能量:${c.energy}/${c.maxEnergy}  手:${c.ready.length}  牌庫:${c.deck.length}  墓:${c.grave.length}`
    );

    const alive = c.hp > 0;
    this.text.setAlpha(alive ? 1 : 0.35);
    this.bg.setAlpha(alive ? 0.35 : 0.12);
    this.fill.setAlpha(alive ? 0.6 : 0.18);
  }
}
