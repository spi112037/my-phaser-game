import Phaser from "phaser";

const MENU_BGM_KEY = "menu_bgm_main";
const MENU_BGM_PATH = "mv/我的錄音 8.m4a";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");

    this.modal = null;
    this.allies = 1;
    this.enemies = 1;
    this.leftStartHp = 30;
    this.rightStartHp = 30;
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
    this._drawLogoBlock(w, h);
    this._drawTopBar(w);
    this._drawBottomInfo(w, h);

    // 主 CTA（像遊戲首頁的「開始冒險」）
    this._makeButton(w / 2, h * 0.56, "開始冒險", () => this._openBattleModal(), 360, 60, "32px", "primary");

    // 次要功能區（兩列）
    const rows = [
      [
        { label: "副本挑戰", onClick: () => this.scene.start("ChallengeScene") },
        { label: "線上對戰", onClick: () => this.scene.start("RoomScene") }
      ],
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

    const startY = h * 0.65;
    const gapY = 54;
    for (let r = 0; r < rows.length; r += 1) {
      const y = startY + r * gapY;
      this._makeButton(w / 2 - 155, y, rows[r][0].label, rows[r][0].onClick, 280, 42, "22px", "secondary");
      this._makeButton(w / 2 + 155, y, rows[r][1].label, rows[r][1].onClick, 280, 42, "22px", "secondary");
    }

    this._drawNewsPanel(w, h);

    this._startMenuBgm();
    this.events.once("shutdown", this._stopMenuBgm, this);
    this.events.once("destroy", this._stopMenuBgm, this);
  }

  _drawTopBar(w) {
    const bar = this.add.rectangle(w / 2, 26, w, 52, 0x09152a, 0.55);
    bar.setStrokeStyle(1, 0x78bfff, 0.35);
    this.add.text(24, 26, "玩家：彼羽", { fontSize: "18px", color: "#d8ecff" }).setOrigin(0, 0.5);
    this.add.text(w - 24, 26, "晶焰 1280  |  金幣 54210", { fontSize: "18px", color: "#ffe6a6" }).setOrigin(1, 0.5);
  }

  _drawLogoBlock(w, h) {
    const logoGlow = this.add.text(w / 2, h * 0.16, "火焰征程", {
      fontSize: "78px",
      color: "#8fd3ff",
      fontStyle: "bold"
    });
    logoGlow.setOrigin(0.5).setAlpha(0.2);

    const logo = this.add.text(w / 2, h * 0.15, "火焰征程", {
      fontSize: "72px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    logo.setOrigin(0.5);

    this.add.text(w / 2, h * 0.215, "Flame Journey", {
      fontSize: "24px",
      color: "#b8ddff"
    }).setOrigin(0.5);

    this.tweens.add({
      targets: logo,
      scaleX: { from: 0.995, to: 1.005 },
      scaleY: { from: 0.995, to: 1.005 },
      yoyo: true,
      repeat: -1,
      duration: 1800
    });
  }

  _drawNewsPanel(w, h) {
    const panelW = Math.min(460, w * 0.34);
    const panelH = 130;
    const x = w - panelW / 2 - 28;
    const y = h - panelH / 2 - 30;

    const shadow = this.add.rectangle(x, y + 4, panelW, panelH, 0x000000, 0.28);
    const panel = this.add.rectangle(x, y, panelW, panelH, 0x0a1d38, 0.72).setStrokeStyle(1, 0x88c8ff, 0.4);
    shadow.setDepth(4);
    panel.setDepth(5);

    this.add.text(x - panelW / 2 + 16, y - 44, "公告 / 活動", {
      fontSize: "20px",
      color: "#e6f4ff",
      fontStyle: "bold"
    }).setDepth(6);

    this.add.text(x - panelW / 2 + 16, y - 12, "• 新章節『灰燼峽谷』已開放", { fontSize: "16px", color: "#cde7ff" }).setDepth(6);
    this.add.text(x - panelW / 2 + 16, y + 14, "• 本日登入獎勵：烈焰石 x120", { fontSize: "16px", color: "#ffd99a" }).setDepth(6);
    this.add.text(x - panelW / 2 + 16, y + 40, "• 週末雙倍掉落進行中", { fontSize: "16px", color: "#9dffc9" }).setDepth(6);
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
    // 左右角色剪影（無素材版，用漸層塊與光圈代替）
    const leftAura = this.add.circle(w * 0.17, h * 0.63, 210, 0x5cc7ff, 0.12);
    const rightAura = this.add.circle(w * 0.83, h * 0.63, 210, 0xffb26d, 0.11);

    const leftBody = this.add.rectangle(w * 0.17, h * 0.68, 170, 360, 0x0b1b35, 0.75).setAngle(-6);
    const rightBody = this.add.rectangle(w * 0.83, h * 0.68, 170, 360, 0x2a130b, 0.72).setAngle(6);
    leftBody.setStrokeStyle(1.2, 0x7dd3ff, 0.25);
    rightBody.setStrokeStyle(1.2, 0xffbe86, 0.25);

    this.tweens.add({
      targets: [leftAura, rightAura],
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
    this.tweens.add({
      targets: mist,
      alpha: { from: 0.05, to: 0.12 },
      yoyo: true,
      repeat: -1,
      duration: 2600
    });
  }

  _makeButton(cx, cy, text, onClick, w = 300, h = 46, fontSize = "20px", variant = "secondary") {
    const isPrimary = variant === "primary";
    const shadow = this.add.rectangle(cx, cy + 3, w, h, 0x000000, 0.28);
    const bg = this.add.rectangle(cx, cy, w, h, isPrimary ? 0x62c7ff : 0xffffff, isPrimary ? 0.24 : 0.11);
    bg.setStrokeStyle(1.3, isPrimary ? 0xd1f2ff : 0xa8dcff, isPrimary ? 0.8 : 0.35);
    bg.setInteractive({ useHandCursor: true });

    const t = this.add
      .text(cx, cy, text, {
        fontSize,
        color: "#ffffff",
        fontStyle: isPrimary ? "bold" : "normal"
      })
      .setOrigin(0.5);

    bg.on("pointerover", () => {
      bg.setFillStyle(isPrimary ? 0x80d7ff : 0x9ddcff, isPrimary ? 0.35 : 0.2);
      this.tweens.add({ targets: [bg, t], scaleX: 1.02, scaleY: 1.02, duration: 90 });
      this.tweens.add({ targets: shadow, alpha: 0.4, duration: 90 });
    });

    bg.on("pointerout", () => {
      bg.setFillStyle(isPrimary ? 0x62c7ff : 0xffffff, isPrimary ? 0.24 : 0.11);
      this.tweens.add({ targets: [bg, t], scaleX: 1, scaleY: 1, duration: 90 });
      this.tweens.add({ targets: shadow, alpha: 0.28, duration: 90 });
    });

    bg.on("pointerup", () => {
      this.tweens.add({ targets: [bg, t], scaleX: 0.98, scaleY: 0.98, yoyo: true, duration: 60 });
      if (typeof onClick === "function") onClick();
    });

    return { bg, t, shadow };
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
