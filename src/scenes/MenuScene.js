import Phaser from "phaser";

const MENU_BGM_KEY = "menu_bgm_main";
const MENU_BGM_PATH = "mv/我的錄音 8.m4a";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");

    this.modal = null;
    this.allies = 1;
    this.enemies = 1;
    this.leftStartHp = 120;
    this.rightStartHp = 120;
    this.autoPlayerEnabled = false;
    this.menuBgm = null;
  }

  preload() {
    if (!this.cache.audio.exists(MENU_BGM_KEY)) {
      this.load.audio(MENU_BGM_KEY, [MENU_BGM_PATH]);
    }
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this._drawBackground(w, h);
    this._drawHeroSilhouettes(w, h);
    this._drawTopBar(w);
    this._drawLogoBlock(w, h);
    this._drawBottomInfo(w, h);

    this.add.text(w / 2, h * 0.29, "聖火甦醒，命運之戰即將展開", {
      fontSize: "20px",
      color: "#d8ebff",
      stroke: "#09101a",
      strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0.92);

    this._makeButton(w / 2, h * 0.56, "開始冒險", () => this._openBattleModal(), 390, 68, "34px", "primary");
    this._makeButton(w / 2, h * 0.63, "副本挑戰", () => this.scene.start("ChallengeScene"), 290, 42, "21px", "secondary");
    this._makeButton(w / 2 + 214, h * 0.63, "線上對戰", () => this.scene.start("RoomScene"), 210, 42, "21px", "secondary");

    const rows = [
      [
        { label: "牌組編輯", onClick: () => this.scene.start("DeckScene") },
        { label: "效果百科", onClick: () => this.scene.start("EffectGlossaryScene") }
      ],
      [
        { label: "卡片編輯器", onClick: () => this.scene.start("CardEditorScene") },
        {
          label: "設定",
          onClick: () => alert("設定功能開發中，之後可加上音量、畫質、語言。\n目前先以戰鬥與卡片系統為主。")
        }
      ]
    ];

    const startY = h * 0.71;
    const gapY = 52;
    for (let r = 0; r < rows.length; r += 1) {
      const y = startY + r * gapY;
      this._makeButton(w / 2 - 132, y, rows[r][0].label, rows[r][0].onClick, 236, 40, "20px", "secondary");
      this._makeButton(w / 2 + 132, y, rows[r][1].label, rows[r][1].onClick, 236, 40, "20px", "secondary");
    }

    this._drawNewsPanel(w, h);

    this._startMenuBgm();
    this.events.once("shutdown", this._stopMenuBgm, this);
    this.events.once("destroy", this._stopMenuBgm, this);
  }

  _drawTopBar(w) {
    const glow = this.add.rectangle(w / 2, 28, w, 60, 0x63c9ff, 0.05);
    const bar = this.add.rectangle(w / 2, 26, w, 52, 0x09152a, 0.66);
    const edge = this.add.rectangle(w / 2, 50, w - 60, 2, 0xd9f1ff, 0.14);
    glow.setDepth(5);
    bar.setDepth(6).setStrokeStyle(1, 0x78bfff, 0.35);
    edge.setDepth(7);
    this.add.text(24, 26, "玩家：彼羽", { fontSize: "18px", color: "#d8ecff", fontStyle: "bold" }).setOrigin(0, 0.5).setDepth(8);
    this.add.text(w - 24, 26, "晶焰 1280  |  金幣 54210", { fontSize: "18px", color: "#ffe6a6", fontStyle: "bold" }).setOrigin(1, 0.5).setDepth(8);
  }

  _drawLogoBlock(w, h) {
    this.add.ellipse(w / 2, h * 0.17, 520, 150, 0x85d6ff, 0.08);
    const crest = this.add.circle(w / 2, h * 0.12, 20, 0xf4c56d, 0.75).setStrokeStyle(2, 0xffefb3, 0.82);

    const logoGlowFar = this.add.text(w / 2, h * 0.158, "火焰征程", {
      fontSize: "88px",
      color: "#5dcaff",
      fontStyle: "bold"
    });
    logoGlowFar.setOrigin(0.5).setAlpha(0.12);

    const logoGlow = this.add.text(w / 2, h * 0.155, "火焰征程", {
      fontSize: "80px",
      color: "#99deff",
      fontStyle: "bold"
    });
    logoGlow.setOrigin(0.5).setAlpha(0.22);

    const logo = this.add.text(w / 2, h * 0.15, "火焰征程", {
      fontSize: "74px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#1f2d47",
      strokeThickness: 6
    });
    logo.setOrigin(0.5);

    this.add.text(w / 2, h * 0.215, "Flame Journey", {
      fontSize: "26px",
      color: "#cdeaff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.tweens.add({
      targets: [logo, crest],
      scaleX: { from: 0.995, to: 1.01 },
      scaleY: { from: 0.995, to: 1.01 },
      yoyo: true,
      repeat: -1,
      duration: 1800
    });
  }

  _drawNewsPanel(w, h) {
    const panelW = Math.min(476, w * 0.35);
    const panelH = 142;
    const x = w - panelW / 2 - 30;
    const y = h - panelH / 2 - 30;

    const glow = this.add.rectangle(x, y, panelW + 18, panelH + 14, 0x7fd2ff, 0.06);
    const shadow = this.add.rectangle(x, y + 6, panelW, panelH, 0x000000, 0.34);
    const panel = this.add.rectangle(x, y, panelW, panelH, 0x0a1d38, 0.8).setStrokeStyle(1.5, 0x9ed7ff, 0.5);
    const topLine = this.add.rectangle(x, y - panelH / 2 + 12, panelW - 34, 2, 0xe7f4ff, 0.2);
    glow.setDepth(4);
    shadow.setDepth(5);
    panel.setDepth(6);
    topLine.setDepth(7);

    this.add.text(x - panelW / 2 + 18, y - 49, "公告 / 活動", {
      fontSize: "20px",
      color: "#e6f4ff",
      fontStyle: "bold"
    }).setDepth(8);

    this.add.text(x - panelW / 2 + 18, y - 16, "• 新章節『灰燼峽谷』已開放", { fontSize: "16px", color: "#cde7ff" }).setDepth(8);
    this.add.text(x - panelW / 2 + 18, y + 12, "• 本日登入獎勵：烈焰石 x120", { fontSize: "16px", color: "#ffd99a" }).setDepth(8);
    this.add.text(x - panelW / 2 + 18, y + 40, "• 週末雙倍掉落進行中", { fontSize: "16px", color: "#9dffc9" }).setDepth(8);
  }

  _drawBottomInfo(w, h) {
    this.add
      .text(w / 2, h - 20, "Tap to Start • Prototype v0.1", {
        fontSize: "16px",
        color: "#a8d5ff"
      })
      .setOrigin(0.5)
      .setAlpha(0.82);
  }

  _drawHeroSilhouettes(w, h) {
    const leftAura = this.add.circle(w * 0.16, h * 0.6, 240, 0x5cc7ff, 0.12);
    const rightAura = this.add.circle(w * 0.84, h * 0.6, 240, 0xffb26d, 0.11);
    const leftBack = this.add.rectangle(w * 0.15, h * 0.67, 198, 388, 0x07192f, 0.48).setAngle(-9);
    const rightBack = this.add.rectangle(w * 0.85, h * 0.67, 198, 388, 0x30140d, 0.46).setAngle(9);
    const leftBody = this.add.rectangle(w * 0.17, h * 0.68, 170, 360, 0x0b1b35, 0.8).setAngle(-6);
    const rightBody = this.add.rectangle(w * 0.83, h * 0.68, 170, 360, 0x2a130b, 0.78).setAngle(6);
    const leftLight = this.add.rectangle(w * 0.2, h * 0.64, 44, 300, 0xa9e8ff, 0.08).setAngle(-10);
    const rightLight = this.add.rectangle(w * 0.8, h * 0.64, 44, 300, 0xffcb99, 0.08).setAngle(10);
    leftBody.setStrokeStyle(1.2, 0x7dd3ff, 0.25);
    rightBody.setStrokeStyle(1.2, 0xffbe86, 0.25);

    this.tweens.add({
      targets: [leftAura, rightAura, leftLight, rightLight],
      alpha: { from: 0.08, to: 0.16 },
      yoyo: true,
      repeat: -1,
      duration: 2200
    });
  }

  _startMenuBgm() {
    if (!this.sound || !this.cache.audio.exists(MENU_BGM_KEY)) return;

    const existing = this.sound.get(MENU_BGM_KEY);
    if (existing) {
      this.menuBgm = existing;
      if (!existing.isPlaying) existing.play({ loop: true, volume: 0.22 });
      return;
    }

    this.menuBgm = this.sound.add(MENU_BGM_KEY, { loop: true, volume: 0 });
    this.menuBgm.play();
    this.tweens.add({
      targets: this.menuBgm,
      volume: 0.22,
      duration: 900,
      ease: "Sine.easeOut"
    });
  }

  _stopMenuBgm() {
    if (!this.menuBgm) return;
    this.menuBgm.stop();
    this.menuBgm.destroy();
    this.menuBgm = null;
  }

  _drawBackground(w, h) {
    const g = this.add.graphics();
    g.fillGradientStyle(0x142d59, 0x1a3f77, 0x07162d, 0x040d1f, 1);
    g.fillRect(0, 0, w, h);

    this.add.ellipse(w * 0.22, h * 0.34, 420, 300, 0x61c7ff, 0.08);
    this.add.ellipse(w * 0.78, h * 0.4, 440, 320, 0xffb16a, 0.07);
    this.add.rectangle(w / 2, h * 0.92, w, 180, 0x071120, 0.46);

    const stars = 90;
    for (let i = 0; i < stars; i += 1) {
      const sx = Phaser.Math.Between(0, w);
      const sy = Phaser.Math.Between(0, h);
      const star = this.add.circle(sx, sy, Phaser.Math.Between(1, 2), 0xdaf0ff, Phaser.Math.FloatBetween(0.2, 0.9));
      this.tweens.add({
        targets: star,
        alpha: { from: Phaser.Math.FloatBetween(0.15, 0.55), to: Phaser.Math.FloatBetween(0.55, 1) },
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(1200, 2600),
        delay: Phaser.Math.Between(0, 1500)
      });
    }

    const mist = this.add.rectangle(w / 2, h - 8, w, 140, 0xb7ddff, 0.08);
    const mist2 = this.add.rectangle(w / 2, h * 0.58, w * 0.9, 120, 0x8ed5ff, 0.035);
    this.tweens.add({
      targets: [mist, mist2],
      alpha: { from: 0.05, to: 0.12 },
      yoyo: true,
      repeat: -1,
      duration: 2600
    });
  }

  _makeButton(cx, cy, text, onClick, w = 300, h = 46, fontSize = "20px", variant = "secondary") {
    const isPrimary = variant === "primary";
    const shadow = this.add.rectangle(cx, cy + 4, w, h, 0x000000, 0.32);
    const glow = this.add.ellipse(cx, cy, w + 34, h + 20, isPrimary ? 0x7fd2ff : 0x8bcfff, isPrimary ? 0.16 : 0.06);
    const bg = this.add.rectangle(cx, cy, w, h, isPrimary ? 0x66caff : 0x10233d, isPrimary ? 0.28 : 0.78);
    const edge = this.add.rectangle(cx, cy - h / 2 + 8, w - 26, 2, 0xf0fbff, isPrimary ? 0.34 : 0.16);
    bg.setStrokeStyle(1.6, isPrimary ? 0xe8f8ff : 0xa8dcff, isPrimary ? 0.88 : 0.4);
    bg.setInteractive({ useHandCursor: true });

    const t = this.add
      .text(cx, cy, text, {
        fontSize,
        color: "#ffffff",
        fontStyle: "bold",
        stroke: isPrimary ? "#29506d" : "#08111b",
        strokeThickness: isPrimary ? 4 : 3
      })
      .setOrigin(0.5);

    bg.on("pointerover", () => {
      bg.setFillStyle(isPrimary ? 0x8ad7ff : 0x163458, isPrimary ? 0.36 : 0.9);
      glow.setFillStyle(isPrimary ? 0x94ddff : 0x9ad4ff, isPrimary ? 0.22 : 0.1);
      this.tweens.add({ targets: [bg, t, edge], scaleX: 1.025, scaleY: 1.025, duration: 100 });
      this.tweens.add({ targets: shadow, alpha: 0.44, duration: 100 });
    });

    bg.on("pointerout", () => {
      bg.setFillStyle(isPrimary ? 0x66caff : 0x10233d, isPrimary ? 0.28 : 0.78);
      glow.setFillStyle(isPrimary ? 0x7fd2ff : 0x8bcfff, isPrimary ? 0.16 : 0.06);
      this.tweens.add({ targets: [bg, t, edge], scaleX: 1, scaleY: 1, duration: 100 });
      this.tweens.add({ targets: shadow, alpha: 0.32, duration: 100 });
    });

    bg.on("pointerup", () => {
      this.tweens.add({ targets: [bg, t], scaleX: 0.98, scaleY: 0.98, yoyo: true, duration: 60 });
      if (typeof onClick === "function") onClick();
    });

    return { bg, t, shadow, glow, edge };
  }

  _openBattleModal() {
    if (this.modal) this.modal.destroy(true);

    const w = this.scale.width;
    const h = this.scale.height;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.52).setInteractive();
    const panelShadow = this.add.rectangle(w / 2, h / 2 + 8, 560, 430, 0x000000, 0.35);
    const panel = this.add.rectangle(w / 2, h / 2, 560, 430, 0x0b1f3f, 0.72).setStrokeStyle(1.5, 0x9ddcff, 0.5);

    const title = this.add.text(w / 2, h / 2 - 146, "戰鬥設定", { fontSize: "26px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);

    const alliesLabel = this.add.text(w / 2 - 170, h / 2 - 56, "我方 AI 數量", { fontSize: "18px", color: "#cfe8ff" }).setOrigin(0, 0.5);
    const enemiesLabel = this.add.text(w / 2 - 170, h / 2 + 4, "敵方 AI 數量", { fontSize: "18px", color: "#ffd7d7" }).setOrigin(0, 0.5);
    const leftHpLabel = this.add.text(w / 2 - 170, h / 2 + 64, "我方起始血量", { fontSize: "18px", color: "#cfe8ff" }).setOrigin(0, 0.5);
    const rightHpLabel = this.add.text(w / 2 - 170, h / 2 + 124, "敵方起始血量", { fontSize: "18px", color: "#ffd7d7" }).setOrigin(0, 0.5);

    const alliesValue = this.add.text(w / 2 + 60, h / 2 - 56, String(this.allies), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5);
    const enemiesValue = this.add.text(w / 2 + 60, h / 2 + 4, String(this.enemies), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5);
    const leftHpValue = this.add.text(w / 2 + 60, h / 2 + 64, String(this.leftStartHp), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5);
    const rightHpValue = this.add.text(w / 2 + 60, h / 2 + 124, String(this.rightStartHp), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5);

    const makeMiniBtn = (x, y, label, fn) => this._makeButton(x, y, label, fn, 44, 34, "18px", "secondary");

    const decA = makeMiniBtn(w / 2 + 10, h / 2 - 56, "-", () => {
      this.allies = Math.max(1, this.allies - 1);
      alliesValue.setText(String(this.allies));
    });
    const incA = makeMiniBtn(w / 2 + 110, h / 2 - 56, "+", () => {
      this.allies = Math.min(4, this.allies + 1);
      alliesValue.setText(String(this.allies));
    });
    const decE = makeMiniBtn(w / 2 + 10, h / 2 + 4, "-", () => {
      this.enemies = Math.max(1, this.enemies - 1);
      enemiesValue.setText(String(this.enemies));
    });
    const incE = makeMiniBtn(w / 2 + 110, h / 2 + 4, "+", () => {
      this.enemies = Math.min(4, this.enemies + 1);
      enemiesValue.setText(String(this.enemies));
    });
    const decLH = makeMiniBtn(w / 2 + 10, h / 2 + 64, "-", () => {
      this.leftStartHp = Math.max(10, this.leftStartHp - 5);
      leftHpValue.setText(String(this.leftStartHp));
    });
    const incLH = makeMiniBtn(w / 2 + 110, h / 2 + 64, "+", () => {
      this.leftStartHp = Math.min(300, this.leftStartHp + 5);
      leftHpValue.setText(String(this.leftStartHp));
    });
    const decRH = makeMiniBtn(w / 2 + 10, h / 2 + 124, "-", () => {
      this.rightStartHp = Math.max(10, this.rightStartHp - 5);
      rightHpValue.setText(String(this.rightStartHp));
    });
    const incRH = makeMiniBtn(w / 2 + 110, h / 2 + 124, "+", () => {
      this.rightStartHp = Math.min(300, this.rightStartHp + 5);
      rightHpValue.setText(String(this.rightStartHp));
    });

    const autoPlayerLabel = this.add.text(w / 2 - 170, h / 2 + 178, "我方自動 AI", { fontSize: "18px", color: "#cfe8ff" }).setOrigin(0, 0.5);
    const autoPlayerValue = this.add.text(w / 2 + 60, h / 2 + 178, this.autoPlayerEnabled ? "開" : "關", {
      fontSize: "22px",
      color: this.autoPlayerEnabled ? "#9dffba" : "#ffffff"
    }).setOrigin(0.5);

    const autoBtn = this._makeButton(w / 2 + 60, h / 2 + 214, "切換", () => {
      this.autoPlayerEnabled = !this.autoPlayerEnabled;
      autoPlayerValue.setText(this.autoPlayerEnabled ? "開" : "關");
      autoPlayerValue.setColor(this.autoPlayerEnabled ? "#9dffba" : "#ffffff");
    }, 110, 34, "18px", "secondary");

    const startBtn = this._makeButton(w / 2, h / 2 + 272, "開始", () => {
      this.scene.start("BattleScene", {
        allies: this.allies,
        enemies: this.enemies,
        leftStartHp: this.leftStartHp,
        rightStartHp: this.rightStartHp,
        autoPlayerEnabled: this.autoPlayerEnabled
      });
    }, 190, 42, "22px", "primary");

    const cancelBtn = this._makeButton(w / 2, h / 2 + 326, "取消", () => {
      if (this.modal) this.modal.destroy(true);
      this.modal = null;
    }, 190, 40, "20px", "secondary");

    this.modal = this.add.container(0, 0, [
      overlay, panelShadow, panel, title,
      alliesLabel, enemiesLabel, leftHpLabel, rightHpLabel,
      alliesValue, enemiesValue, leftHpValue, rightHpValue,
      autoPlayerLabel, autoPlayerValue,
      decA.shadow, decA.bg, decA.t, incA.shadow, incA.bg, incA.t,
      decE.shadow, decE.bg, decE.t, incE.shadow, incE.bg, incE.t,
      decLH.shadow, decLH.bg, decLH.t, incLH.shadow, incLH.bg, incLH.t,
      decRH.shadow, decRH.bg, decRH.t, incRH.shadow, incRH.bg, incRH.t,
      autoBtn.shadow, autoBtn.bg, autoBtn.t,
      startBtn.shadow, startBtn.bg, startBtn.t,
      cancelBtn.shadow, cancelBtn.bg, cancelBtn.t
    ]);
  }
}
