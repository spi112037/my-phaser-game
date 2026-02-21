import Phaser from "phaser";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");

    this.modal = null;
    this.allies = 1;
    this.enemies = 1;
    this.leftStartHp = 30;
    this.rightStartHp = 30;
    this.autoPlayerEnabled = false;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this._drawBackground(w, h);

    this.add.text(w / 2, 108, "火焰征程", { fontSize: "48px", color: "#ffffff" }).setOrigin(0.5);
    this.add.text(w / 2, 156, "主選單", { fontSize: "34px", color: "#d8edff" }).setOrigin(0.5);

    const buttons = [
      { label: "開始戰鬥", onClick: () => this._openBattleModal() },
      { label: "副本挑戰", onClick: () => this.scene.start("ChallengeScene") },
      { label: "線上對戰", onClick: () => this.scene.start("RoomScene") },
      { label: "牌組編輯", onClick: () => this.scene.start("DeckScene") },
      { label: "效果百科", onClick: () => this.scene.start("EffectGlossaryScene") },
      { label: "卡片編輯器", onClick: () => this.scene.start("CardEditorScene") },
      {
        label: "設定",
        onClick: () => {
          alert("設定功能開發中，之後可加上音量、畫質、語言。\n目前先以戰鬥與卡片系統為主。");
        }
      }
    ];

    const gap = 56;
    const totalHeight = (buttons.length - 1) * gap;
    const startY = Math.max(220, Math.min(h - 70 - totalHeight, h * 0.58 - totalHeight / 2));

    for (let i = 0; i < buttons.length; i += 1) {
      const b = buttons[i];
      this._makeButton(w / 2, startY + i * gap, b.label, b.onClick, 320, 44, "28px");
    }
  }

  _drawBackground(w, h) {
    const g = this.add.graphics();
    g.fillGradientStyle(0x245ea8, 0x2b68b2, 0x14376e, 0x0e2a58, 1);
    g.fillRect(0, 0, w, h);

    const halo1 = this.add.circle(w * 0.18, h * 0.2, Math.min(w, h) * 0.34, 0x9bd8ff, 0.17);
    const halo2 = this.add.circle(w * 0.82, h * 0.74, Math.min(w, h) * 0.28, 0x7ef0ff, 0.14);
    const halo3 = this.add.circle(w * 0.52, h * 0.09, Math.min(w, h) * 0.2, 0xffe8aa, 0.13);

    this.tweens.add({ targets: [halo1, halo2, halo3], alpha: { from: 0.05, to: 0.14 }, yoyo: true, repeat: -1, duration: 3200 });

    const nebula = this.add.graphics();
    nebula.fillStyle(0xbee7ff, 0.14);
    nebula.fillEllipse(w * 0.65, h * 0.32, w * 0.48, h * 0.2);
    nebula.fillStyle(0xa8c8ff, 0.1);
    nebula.fillEllipse(w * 0.35, h * 0.78, w * 0.52, h * 0.24);

    // 主選單上方加一條流動光帶，讓首頁視覺更有主題感。
    const ribbon = this.add.rectangle(w * 0.5, h * 0.3, w * 0.78, 54, 0xc1ecff, 0.08).setAngle(-4);
    this.tweens.add({
      targets: ribbon,
      x: { from: w * 0.45, to: w * 0.55 },
      alpha: { from: 0.05, to: 0.12 },
      yoyo: true,
      repeat: -1,
      duration: 3400
    });

    for (let i = 0; i < 70; i += 1) {
      const sx = Phaser.Math.Between(0, w);
      const sy = Phaser.Math.Between(0, h);
      const star = this.add.circle(sx, sy, Phaser.Math.Between(1, 2), 0xdaf0ff, Phaser.Math.FloatBetween(0.3, 0.9));
      this.tweens.add({
        targets: star,
        alpha: { from: Phaser.Math.FloatBetween(0.2, 0.6), to: Phaser.Math.FloatBetween(0.6, 1) },
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(1400, 2800),
        delay: Phaser.Math.Between(0, 1500)
      });
    }
  }

  _makeButton(cx, cy, text, onClick, w = 300, h = 46, fontSize = "20px") {
    const bg = this.add.rectangle(cx, cy, w, h, 0xffffff, 0.12).setInteractive({ useHandCursor: true });
    const t = this.add.text(cx, cy, text, { fontSize, color: "#ffffff" }).setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x9ddcff, 0.18));
    bg.on("pointerout", () => bg.setFillStyle(0xffffff, 0.12));
    bg.on("pointerup", () => {
      if (typeof onClick === "function") onClick();
    });

    return { bg, t };
  }

  _openBattleModal() {
    if (this.modal) this.modal.destroy(true);

    const w = this.scale.width;
    const h = this.scale.height;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.45).setInteractive();
    const panel = this.add.rectangle(w / 2, h / 2, 560, 420, 0x000000, 0.55).setStrokeStyle(1, 0x9ddcff, 0.35);

    const title = this.add.text(w / 2, h / 2 - 130, "戰鬥設定", { fontSize: "24px", color: "#ffffff" }).setOrigin(0.5);

    const alliesLabel = this.add.text(w / 2 - 170, h / 2 - 50, "我方 AI 數量", { fontSize: "18px", color: "#cfe8ff" }).setOrigin(0, 0.5);
    const enemiesLabel = this.add.text(w / 2 - 170, h / 2 + 10, "敵方 AI 數量", { fontSize: "18px", color: "#ffd7d7" }).setOrigin(0, 0.5);
    const leftHpLabel = this.add.text(w / 2 - 170, h / 2 + 70, "我方起始血量", { fontSize: "18px", color: "#cfe8ff" }).setOrigin(0, 0.5);
    const rightHpLabel = this.add.text(w / 2 - 170, h / 2 + 130, "敵方起始血量", { fontSize: "18px", color: "#ffd7d7" }).setOrigin(0, 0.5);

    const alliesValue = this.add.text(w / 2 + 60, h / 2 - 50, String(this.allies), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5);
    const enemiesValue = this.add.text(w / 2 + 60, h / 2 + 10, String(this.enemies), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5);
    const leftHpValue = this.add.text(w / 2 + 60, h / 2 + 70, String(this.leftStartHp), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5);
    const rightHpValue = this.add.text(w / 2 + 60, h / 2 + 130, String(this.rightStartHp), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5);

    const decA = this._makeButton(w / 2 + 10, h / 2 - 50, "-", () => {
      this.allies = Math.max(1, this.allies - 1);
      alliesValue.setText(String(this.allies));
    });
    decA.bg.width = 44;
    decA.t.setFontSize(20);

    const incA = this._makeButton(w / 2 + 110, h / 2 - 50, "+", () => {
      this.allies = Math.min(4, this.allies + 1);
      alliesValue.setText(String(this.allies));
    });
    incA.bg.width = 44;
    incA.t.setFontSize(20);

    const decE = this._makeButton(w / 2 + 10, h / 2 + 10, "-", () => {
      this.enemies = Math.max(1, this.enemies - 1);
      enemiesValue.setText(String(this.enemies));
    });
    decE.bg.width = 44;
    decE.t.setFontSize(20);

    const incE = this._makeButton(w / 2 + 110, h / 2 + 10, "+", () => {
      this.enemies = Math.min(4, this.enemies + 1);
      enemiesValue.setText(String(this.enemies));
    });
    incE.bg.width = 44;
    incE.t.setFontSize(20);

    const decLH = this._makeButton(w / 2 + 10, h / 2 + 70, "-", () => {
      this.leftStartHp = Math.max(10, this.leftStartHp - 5);
      leftHpValue.setText(String(this.leftStartHp));
    });
    decLH.bg.width = 44;
    decLH.t.setFontSize(20);

    const incLH = this._makeButton(w / 2 + 110, h / 2 + 70, "+", () => {
      this.leftStartHp = Math.min(300, this.leftStartHp + 5);
      leftHpValue.setText(String(this.leftStartHp));
    });
    incLH.bg.width = 44;
    incLH.t.setFontSize(20);

    const decRH = this._makeButton(w / 2 + 10, h / 2 + 130, "-", () => {
      this.rightStartHp = Math.max(10, this.rightStartHp - 5);
      rightHpValue.setText(String(this.rightStartHp));
    });
    decRH.bg.width = 44;
    decRH.t.setFontSize(20);

    const incRH = this._makeButton(w / 2 + 110, h / 2 + 130, "+", () => {
      this.rightStartHp = Math.min(300, this.rightStartHp + 5);
      rightHpValue.setText(String(this.rightStartHp));
    });
    incRH.bg.width = 44;
    incRH.t.setFontSize(20);

    const autoPlayerLabel = this.add.text(w / 2 - 170, h / 2 + 185, "我方自動 AI", { fontSize: "18px", color: "#cfe8ff" }).setOrigin(0, 0.5);
    const autoPlayerValue = this.add.text(w / 2 + 60, h / 2 + 185, this.autoPlayerEnabled ? "開" : "關", {
      fontSize: "22px",
      color: this.autoPlayerEnabled ? "#9dffba" : "#ffffff"
    }).setOrigin(0.5);
    const autoBtn = this._makeButton(w / 2 + 60, h / 2 + 222, "切換", () => {
      this.autoPlayerEnabled = !this.autoPlayerEnabled;
      autoPlayerValue.setText(this.autoPlayerEnabled ? "開" : "關");
      autoPlayerValue.setColor(this.autoPlayerEnabled ? "#9dffba" : "#ffffff");
    }, 110, 34, "18px");

    const startBtn = this._makeButton(w / 2, h / 2 + 278, "開始", () => {
      this.scene.start("BattleScene", {
        allies: this.allies,
        enemies: this.enemies,
        leftStartHp: this.leftStartHp,
        rightStartHp: this.rightStartHp,
        autoPlayerEnabled: this.autoPlayerEnabled
      });
    });

    const cancelBtn = this._makeButton(w / 2, h / 2 + 336, "取消", () => {
      if (this.modal) this.modal.destroy(true);
      this.modal = null;
    });

    this.modal = this.add.container(0, 0, [
      overlay,
      panel,
      title,
      alliesLabel,
      enemiesLabel,
      leftHpLabel,
      rightHpLabel,
      alliesValue,
      enemiesValue,
      leftHpValue,
      rightHpValue,
      autoPlayerLabel,
      autoPlayerValue,
      decA.bg,
      decA.t,
      incA.bg,
      incA.t,
      decE.bg,
      decE.t,
      incE.bg,
      incE.t,
      decLH.bg,
      decLH.t,
      incLH.bg,
      incLH.t,
      decRH.bg,
      decRH.t,
      incRH.bg,
      incRH.t,
      autoBtn.bg,
      autoBtn.t,
      startBtn.bg,
      startBtn.t,
      cancelBtn.bg,
      cancelBtn.t
    ]);
  }
}
