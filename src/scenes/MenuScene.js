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
    this._drawCenterStage(w, h);
    this._drawModeCards(w, h);
    this._drawBottomUtility(w, h);
    this._drawBottomInfo(w, h);

    this._startMenuBgm();
    this.events.once("shutdown", this._stopMenuBgm, this);
    this.events.once("destroy", this._stopMenuBgm, this);
  }

  _drawTopBar(w) {
    const glow = this.add.rectangle(w / 2, 28, w, 64, 0x67cfff, 0.05).setDepth(10);
    const bar = this.add.rectangle(w / 2, 28, w, 54, 0x081425, 0.76).setDepth(11);
    const topEdge = this.add.rectangle(w / 2, 52, w - 60, 2, 0xecf8ff, 0.14).setDepth(12);
    glow.setAlpha(0.05);
    bar.setStrokeStyle(1.2, 0x8fd8ff, 0.34);
    this.add.text(26, 28, "玩家：彼羽", {
      fontSize: "18px",
      color: "#e4f4ff",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setDepth(13);
    this.add.text(w - 26, 28, "晶焰 1280  |  金幣 54210", {
      fontSize: "18px",
      color: "#ffe3a8",
      fontStyle: "bold"
    }).setOrigin(1, 0.5).setDepth(13);
    this.add.rectangle(w / 2, 28, 160, 22, 0x78d7ff, 0.04).setDepth(12);
    this.tweens.add({ targets: [glow], alpha: { from: 0.04, to: 0.09 }, duration: 1800, yoyo: true, repeat: -1 });
    topEdge.setAlpha(0.14);
  }

  _drawBackground(w, h) {
    const g = this.add.graphics();
    g.fillGradientStyle(0x11264b, 0x214b7d, 0x09101f, 0x040913, 1);
    g.fillRect(0, 0, w, h);

    this.add.ellipse(w * 0.47, h * 0.24, 560, 250, 0x72d6ff, 0.08);
    this.add.ellipse(w * 0.22, h * 0.5, 460, 340, 0x59c7ff, 0.07);
    this.add.ellipse(w * 0.82, h * 0.48, 470, 330, 0xffb16a, 0.07);
    this.add.ellipse(w * 0.53, h * 0.42, 780, 320, 0xa8dcff, 0.03);
    this.add.rectangle(w / 2, h * 0.9, w, 190, 0x07101d, 0.48);

    const horizonGlow = this.add.rectangle(w / 2, h * 0.62, w * 0.9, 18, 0xe8f7ff, 0.05).setDepth(6);
    const battlefieldMist = this.add.ellipse(w / 2, h * 0.68, w * 0.86, 150, 0xd2eeff, 0.06).setDepth(7);
    const laneLeft = this.add.triangle(w * 0.37, h * 0.76, 0, 54, 180, 0, 210, 108, 0x61cfff, 0.08).setDepth(7).setAngle(-6);
    const laneRight = this.add.triangle(w * 0.68, h * 0.76, 0, 54, 180, 0, 210, 108, 0xffb574, 0.08).setDepth(7).setAngle(174);

    const stars = 85;
    for (let i = 0; i < stars; i += 1) {
      const sx = Phaser.Math.Between(0, w);
      const sy = Phaser.Math.Between(0, Math.floor(h * 0.72));
      const star = this.add.circle(sx, sy, Phaser.Math.Between(1, 2), 0xe3f5ff, Phaser.Math.FloatBetween(0.12, 0.8));
      this.tweens.add({
        targets: star,
        alpha: { from: Phaser.Math.FloatBetween(0.1, 0.4), to: Phaser.Math.FloatBetween(0.45, 0.9) },
        duration: Phaser.Math.Between(1400, 2800),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1500)
      });
    }

    const mistA = this.add.rectangle(w / 2, h * 0.62, w * 0.9, 110, 0xa9dcff, 0.03).setDepth(8);
    const mistB = this.add.rectangle(w / 2, h - 18, w, 150, 0xc3e6ff, 0.08).setDepth(8);
    this.tweens.add({
      targets: [mistA, mistB, battlefieldMist, horizonGlow, laneLeft, laneRight],
      alpha: { from: 0.04, to: 0.12 },
      duration: 2600,
      yoyo: true,
      repeat: -1
    });
  }

  _drawHeroSilhouettes(w, h) {
    const leftAura = this.add.circle(w * 0.11, h * 0.58, 224, 0x5cc7ff, 0.13).setDepth(2);
    const rightAura = this.add.circle(w * 0.89, h * 0.57, 214, 0xffb26d, 0.12).setDepth(2);
    const leftBack = this.add.rectangle(w * 0.11, h * 0.69, 170, 360, 0x071a31, 0.42).setAngle(-15).setDepth(3);
    const rightBack = this.add.rectangle(w * 0.89, h * 0.67, 164, 344, 0x35170f, 0.4).setAngle(15).setDepth(3);
    const leftBody = this.add.rectangle(w * 0.145, h * 0.675, 146, 338, 0x0a1b33, 0.76).setAngle(-9).setDepth(4);
    const rightBody = this.add.rectangle(w * 0.855, h * 0.665, 134, 320, 0x2f170f, 0.76).setAngle(9).setDepth(4);
    const leftEdge = this.add.rectangle(w * 0.175, h * 0.64, 30, 270, 0xa6e7ff, 0.11).setAngle(-10).setDepth(5);
    const rightEdge = this.add.rectangle(w * 0.822, h * 0.64, 28, 248, 0xffcd9b, 0.11).setAngle(10).setDepth(5);
    const leftWeapon = this.add.rectangle(w * 0.22, h * 0.62, 18, 260, 0x8fd8ff, 0.12).setAngle(22).setDepth(5);
    const rightWeapon = this.add.rectangle(w * 0.78, h * 0.625, 18, 240, 0xffc996, 0.12).setAngle(-20).setDepth(5);
    const leftSummon = this.add.circle(w * 0.295, h * 0.58, 46, 0x79d8ff, 0.08).setDepth(6);
    const rightSummon = this.add.circle(w * 0.705, h * 0.56, 42, 0xffb879, 0.08).setDepth(6);
    leftBody.setStrokeStyle(1, 0x87d7ff, 0.18);
    rightBody.setStrokeStyle(1, 0xffc08f, 0.18);

    this.tweens.add({
      targets: [leftAura, rightAura, leftEdge, rightEdge, leftWeapon, rightWeapon, leftSummon, rightSummon],
      alpha: { from: 0.06, to: 0.16 },
      duration: 2400,
      yoyo: true,
      repeat: -1
    });
  }

  _drawCenterStage(w, h) {
    const stageGlow = this.add.ellipse(w / 2, h * 0.39, 660, 270, 0x76d2ff, 0.06).setDepth(20);
    const flameCore = this.add.ellipse(w / 2, h * 0.13, 94, 56, 0xf6b24f, 0.28).setDepth(21);
    const crestOuter = this.add.circle(w / 2, h * 0.13, 24, 0xf6ca75, 0.86).setStrokeStyle(2, 0xffefbd, 0.95).setDepth(22);
    const crestInner = this.add.circle(w / 2, h * 0.13, 11, 0xfff8de, 0.98).setDepth(23);
    const crestSpireL = this.add.triangle(w / 2 - 28, h * 0.13 + 2, 0, 18, 20, -24, 44, 22, 0xffcf7c, 0.72).setDepth(22).setAngle(-18);
    const crestSpireR = this.add.triangle(w / 2 + 28, h * 0.13 + 2, 0, 18, 20, -24, 44, 22, 0xffcf7c, 0.72).setDepth(22).setAngle(198);

    const logoFar = this.add.text(w / 2, h * 0.168, "火焰征程", {
      fontSize: "92px",
      color: "#61cbff",
      fontStyle: "bold"
    }).setOrigin(0.5).setAlpha(0.1).setDepth(21);

    const logoGlow = this.add.text(w / 2, h * 0.162, "火焰征程", {
      fontSize: "84px",
      color: "#9be2ff",
      fontStyle: "bold"
    }).setOrigin(0.5).setAlpha(0.26).setDepth(22);

    const logo = this.add.text(w / 2, h * 0.156, "火焰征程", {
      fontSize: "74px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#1d2e45",
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(23);

    this.add.text(w / 2, h * 0.225, "Flame Journey", {
      fontSize: "26px",
      color: "#d5ebff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(23);

    this.add.text(w / 2, h * 0.29, "聖火甦醒，命運之戰即將展開", {
      fontSize: "20px",
      color: "#d7eaff",
      stroke: "#09111a",
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(23);

    const leftCardBack = this.add.rectangle(w * 0.38, h * 0.37, 78, 110, 0x0f2741, 0.9)
      .setStrokeStyle(2, 0x8fd8ff, 0.6)
      .setAngle(-24)
      .setDepth(24);
    const leftCardCore = this.add.rectangle(w * 0.38, h * 0.37, 54, 68, 0x77d7ff, 0.16)
      .setAngle(-24)
      .setDepth(25);
    const centerCardBack = this.add.rectangle(w * 0.495, h * 0.392, 84, 118, 0x142844, 0.95)
      .setStrokeStyle(2, 0xf4d08b, 0.68)
      .setAngle(-8)
      .setDepth(26);
    const centerCardCore = this.add.rectangle(w * 0.495, h * 0.392, 56, 72, 0xffc46d, 0.18)
      .setAngle(-8)
      .setDepth(27);
    const rightCardBack = this.add.rectangle(w * 0.615, h * 0.365, 80, 112, 0x2b1f1a, 0.92)
      .setStrokeStyle(2, 0xffc892, 0.62)
      .setAngle(21)
      .setDepth(24);
    const rightCardCore = this.add.rectangle(w * 0.615, h * 0.365, 52, 66, 0xffc07a, 0.16)
      .setAngle(21)
      .setDepth(25);
    const cardTrailLeft = this.add.ellipse(w * 0.43, h * 0.37, 170, 22, 0x84dbff, 0.08).setAngle(-17).setDepth(23);
    const cardTrailRight = this.add.ellipse(w * 0.57, h * 0.37, 170, 22, 0xffbf7a, 0.08).setAngle(17).setDepth(23);

    this._makeButton(w / 2, h * 0.432, "開始冒險", () => this._openBattleModal(), 388, 76, "34px", "primary");

    this.tweens.add({
      targets: [stageGlow, flameCore, crestOuter, crestInner, crestSpireL, crestSpireR, logoFar, logoGlow, logo, leftCardBack, rightCardBack, centerCardBack, cardTrailLeft, cardTrailRight],
      alpha: { from: 0.88, to: 1 },
      duration: 1800,
      yoyo: true,
      repeat: -1
    });

    this.tweens.add({
      targets: [leftCardBack, leftCardCore, rightCardBack, rightCardCore, centerCardBack, centerCardCore],
      y: '-=6',
      duration: 1800,
      yoyo: true,
      repeat: -1
    });
  }

  _drawModeCards(w, h) {
    this._makeModeCard(w / 2 - 188, h * 0.57, 272, 122, "副本挑戰", "挑戰關卡、選擇敵人配置", 0x71cfff, () => this.scene.start("ChallengeScene"));
    this._makeModeCard(w / 2 + 164, h * 0.545, 272, 122, "線上對戰", "與其他玩家即時對戰", 0xffbf82, () => this.scene.start("RoomScene"));
  }

  _makeModeCard(cx, cy, w, h, title, desc, glowColor, onClick) {
    const glow = this.add.ellipse(cx, cy, w + 36, h + 30, glowColor, 0.09).setDepth(25);
    const shadow = this.add.rectangle(cx, cy + 7, w, h, 0x000000, 0.34).setDepth(26);
    const panel = this.add.rectangle(cx, cy, w, h, 0x0f2036, 0.88).setDepth(27).setStrokeStyle(1.8, 0xcde8ff, 0.46);
    const topEdge = this.add.rectangle(cx, cy - h / 2 + 12, w - 30, 2, 0xf2fbff, 0.18).setDepth(28);
    const iconRing = this.add.circle(cx - w / 2 + 38, cy - 8, 18, 0x18344f, 0.98).setDepth(28).setStrokeStyle(2, glowColor, 0.72);
    const titleText = this.add.text(cx - w / 2 + 68, cy - 24, title, {
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(28);
    const descText = this.add.text(cx - w / 2 + 68, cy + 8, desc, {
      fontSize: "15px",
      color: "#cae2f7"
    }).setDepth(28);
    const enterText = this.add.text(cx - w / 2 + 68, cy + 34, "進入模式 →", {
      fontSize: "15px",
      color: Phaser.Display.Color.IntegerToColor(glowColor).rgba,
      fontStyle: "bold"
    }).setDepth(28);

    panel.setInteractive({ useHandCursor: true });
    panel.on("pointerover", () => {
      panel.setFillStyle(0x152a44, 0.94);
      glow.setFillStyle(glowColor, 0.16);
      this.tweens.add({ targets: [panel, titleText, descText, enterText, iconRing, topEdge], scaleX: 1.02, scaleY: 1.02, duration: 100 });
    });
    panel.on("pointerout", () => {
      panel.setFillStyle(0x0f2036, 0.88);
      glow.setFillStyle(glowColor, 0.09);
      this.tweens.add({ targets: [panel, titleText, descText, enterText, iconRing, topEdge], scaleX: 1, scaleY: 1, duration: 100 });
    });
    panel.on("pointerup", () => {
      this.tweens.add({ targets: [panel, titleText], scaleX: 0.985, scaleY: 0.985, duration: 60, yoyo: true });
      if (typeof onClick === "function") onClick();
    });
  }

  _drawBottomUtility(w, h) {
    const items = [
      { label: "牌組編輯", onClick: () => this.scene.start("DeckScene") },
      { label: "效果百科", onClick: () => this.scene.start("EffectGlossaryScene") },
      { label: "卡片編輯器", onClick: () => this.scene.start("CardEditorScene") },
      {
        label: "設定",
        onClick: () => alert("設定功能開發中，之後可加上音量、畫質、語言。\n目前先以戰鬥與卡片系統為主。")
      }
    ];

    const y = h * 0.7;
    const startX = w / 2 - 294;
    const gap = 196;
    for (let i = 0; i < items.length; i += 1) {
      this._makeButton(startX + i * gap, y, items[i].label, items[i].onClick, 170, 42, "19px", "secondary");
    }
  }

  _drawBottomInfo(w, h) {
    this.add.text(w / 2, h - 18, "Tap to Start • Prototype v0.1", {
      fontSize: "16px",
      color: "#b8dbff"
    }).setOrigin(0.5).setAlpha(0.82).setDepth(40);
  }

  _makeButton(cx, cy, text, onClick, w = 300, h = 46, fontSize = "20px", variant = "secondary") {
    const isPrimary = variant === "primary";
    const baseColor = isPrimary ? 0x5dc7ff : 0x11233b;
    const glowColor = isPrimary ? 0x8cdcff : 0x7ecfff;

    const shadow = this.add.rectangle(cx, cy + 6, w, h, 0x000000, 0.34).setDepth(50);
    const glow = this.add.ellipse(cx, cy, w + 38, h + 24, glowColor, isPrimary ? 0.18 : 0.06).setDepth(51);
    const backPlate = this.add.rectangle(cx, cy + 3, w, h, isPrimary ? 0x285f8e : 0x09131f, 0.95).setDepth(52);
    const bg = this.add.rectangle(cx, cy, w, h, baseColor, isPrimary ? 0.96 : 0.9).setDepth(53);
    const topLight = this.add.rectangle(cx, cy - h / 2 + 10, w - 22, 3, 0xf4fbff, isPrimary ? 0.4 : 0.16).setDepth(54);
    const innerLight = this.add.rectangle(cx, cy - 6, w - 24, h * 0.38, 0xffffff, isPrimary ? 0.08 : 0.03).setDepth(54);
    bg.setStrokeStyle(1.8, isPrimary ? 0xf1fbff : 0xa7d9ff, isPrimary ? 0.9 : 0.42);
    bg.setInteractive({ useHandCursor: true });

    const t = this.add.text(cx, cy - 1, text, {
      fontSize,
      color: "#ffffff",
      fontStyle: "bold",
      stroke: isPrimary ? "#244d70" : "#08111b",
      strokeThickness: isPrimary ? 4 : 3
    }).setOrigin(0.5).setDepth(55);

    bg.on("pointerover", () => {
      bg.setFillStyle(isPrimary ? 0x83d8ff : 0x18304f, 1);
      glow.setFillStyle(glowColor, isPrimary ? 0.24 : 0.1);
      this.tweens.add({ targets: [bg, backPlate, t, topLight, innerLight], scaleX: 1.025, scaleY: 1.025, duration: 100 });
      this.tweens.add({ targets: shadow, alpha: 0.44, duration: 100 });
    });

    bg.on("pointerout", () => {
      bg.setFillStyle(baseColor, isPrimary ? 0.96 : 0.9);
      glow.setFillStyle(glowColor, isPrimary ? 0.18 : 0.06);
      this.tweens.add({ targets: [bg, backPlate, t, topLight, innerLight], scaleX: 1, scaleY: 1, duration: 100 });
      this.tweens.add({ targets: shadow, alpha: 0.34, duration: 100 });
    });

    bg.on("pointerup", () => {
      this.tweens.add({ targets: [bg, backPlate, t], scaleX: 0.985, scaleY: 0.985, duration: 65, yoyo: true });
      if (typeof onClick === "function") onClick();
    });

    return { shadow, glow, backPlate, bg, topLight, innerLight, t };
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

  _openBattleModal() {
    if (this.modal) this.modal.destroy(true);

    const w = this.scale.width;
    const h = this.scale.height;

    const modalDepth = 5000;
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.58).setInteractive().setDepth(modalDepth);
    const glow = this.add.ellipse(w / 2, h / 2, 620, 470, 0x7dcfff, 0.08).setDepth(modalDepth + 1);
    const panelShadow = this.add.rectangle(w / 2, h / 2 + 10, 560, 430, 0x000000, 0.38).setDepth(modalDepth + 2);
    const panel = this.add.rectangle(w / 2, h / 2, 560, 430, 0x0b1f3f, 0.84).setStrokeStyle(1.8, 0x9ddcff, 0.56).setDepth(modalDepth + 3);
    const panelTopLine = this.add.rectangle(w / 2, h / 2 - 196, 492, 2, 0xe8f7ff, 0.18).setDepth(modalDepth + 4);

    const title = this.add.text(w / 2, h / 2 - 150, "戰鬥設定", { fontSize: "28px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setDepth(modalDepth + 5);

    const alliesLabel = this.add.text(w / 2 - 170, h / 2 - 56, "我方 AI 數量", { fontSize: "18px", color: "#cfe8ff" }).setOrigin(0, 0.5).setDepth(modalDepth + 5);
    const enemiesLabel = this.add.text(w / 2 - 170, h / 2 + 4, "敵方 AI 數量", { fontSize: "18px", color: "#ffd7d7" }).setOrigin(0, 0.5).setDepth(modalDepth + 5);
    const leftHpLabel = this.add.text(w / 2 - 170, h / 2 + 64, "我方起始血量", { fontSize: "18px", color: "#cfe8ff" }).setOrigin(0, 0.5).setDepth(modalDepth + 5);
    const rightHpLabel = this.add.text(w / 2 - 170, h / 2 + 124, "敵方起始血量", { fontSize: "18px", color: "#ffd7d7" }).setOrigin(0, 0.5).setDepth(modalDepth + 5);

    const alliesValue = this.add.text(w / 2 + 60, h / 2 - 56, String(this.allies), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5).setDepth(modalDepth + 5);
    const enemiesValue = this.add.text(w / 2 + 60, h / 2 + 4, String(this.enemies), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5).setDepth(modalDepth + 5);
    const leftHpValue = this.add.text(w / 2 + 60, h / 2 + 64, String(this.leftStartHp), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5).setDepth(modalDepth + 5);
    const rightHpValue = this.add.text(w / 2 + 60, h / 2 + 124, String(this.rightStartHp), { fontSize: "22px", color: "#ffffff" }).setOrigin(0.5).setDepth(modalDepth + 5);

    const makeMiniBtn = (x, y, label, fn) => this._makeButton(x, y, label, fn, 48, 36, "19px", "secondary");

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
    }, 120, 38, "18px", "secondary");

    const startBtn = this._makeButton(w / 2, h / 2 + 274, "開始", () => {
      this.scene.start("BattleScene", {
        allies: this.allies,
        enemies: this.enemies,
        leftStartHp: this.leftStartHp,
        rightStartHp: this.rightStartHp,
        autoPlayerEnabled: this.autoPlayerEnabled
      });
    }, 210, 48, "24px", "primary");

    const cancelBtn = this._makeButton(w / 2, h / 2 + 330, "取消", () => {
      if (this.modal) this.modal.destroy(true);
      this.modal = null;
    }, 210, 42, "21px", "secondary");

    autoPlayerLabel.setDepth(modalDepth + 5);
    autoPlayerValue.setDepth(modalDepth + 5);

    const modalNodes = [
      overlay, glow, panelShadow, panel, panelTopLine, title,
      alliesLabel, enemiesLabel, leftHpLabel, rightHpLabel,
      alliesValue, enemiesValue, leftHpValue, rightHpValue,
      autoPlayerLabel, autoPlayerValue,
      decA.shadow, decA.glow, decA.backPlate, decA.bg, decA.topLight, decA.innerLight, decA.t,
      incA.shadow, incA.glow, incA.backPlate, incA.bg, incA.topLight, incA.innerLight, incA.t,
      decE.shadow, decE.glow, decE.backPlate, decE.bg, decE.topLight, decE.innerLight, decE.t,
      incE.shadow, incE.glow, incE.backPlate, incE.bg, incE.topLight, incE.innerLight, incE.t,
      decLH.shadow, decLH.glow, decLH.backPlate, decLH.bg, decLH.topLight, decLH.innerLight, decLH.t,
      incLH.shadow, incLH.glow, incLH.backPlate, incLH.bg, incLH.topLight, incLH.innerLight, incLH.t,
      decRH.shadow, decRH.glow, decRH.backPlate, decRH.bg, decRH.topLight, decRH.innerLight, decRH.t,
      incRH.shadow, incRH.glow, incRH.backPlate, incRH.bg, incRH.topLight, incRH.innerLight, incRH.t,
      autoBtn.shadow, autoBtn.glow, autoBtn.backPlate, autoBtn.bg, autoBtn.topLight, autoBtn.innerLight, autoBtn.t,
      startBtn.shadow, startBtn.glow, startBtn.backPlate, startBtn.bg, startBtn.topLight, startBtn.innerLight, startBtn.t,
      cancelBtn.shadow, cancelBtn.glow, cancelBtn.backPlate, cancelBtn.bg, cancelBtn.topLight, cancelBtn.innerLight, cancelBtn.t
    ];

    for (let i = 0; i < modalNodes.length; i += 1) {
      if (modalNodes[i]?.setDepth && i >= 16) modalNodes[i].setDepth(modalDepth + 6 + Math.floor(i / 7));
    }

    this.modal = this.add.container(0, 0, modalNodes).setDepth(modalDepth);
  }
}
