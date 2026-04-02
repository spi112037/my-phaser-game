import Phaser from "phaser";

const MENU_BGM_KEY = "menu_bgm_main";
const MENU_BGM_PATH = "mv/我的錄音 8.m4a";
const KEY_ART_CARD_KEYS = {
  saintLead: "menu_card_saint_lead",
  saintSupport: "menu_card_saint_support",
  saintLight: "menu_card_saint_light"
};
const KEY_ART_CARD_PATHS = {
  saintLead: "/cards/custom/f_42__.png",
  saintSupport: "/cards/custom/f_21762_StellaVolt.webp",
  saintLight: "/cards/custom/f_21222_Fran.webp"
};

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

    if (!this.textures.exists(KEY_ART_CARD_KEYS.saintLead)) {
      this.load.image(KEY_ART_CARD_KEYS.saintLead, KEY_ART_CARD_PATHS.saintLead);
    }
    if (!this.textures.exists(KEY_ART_CARD_KEYS.saintSupport)) {
      this.load.image(KEY_ART_CARD_KEYS.saintSupport, KEY_ART_CARD_PATHS.saintSupport);
    }
    if (!this.textures.exists(KEY_ART_CARD_KEYS.saintLight)) {
      this.load.image(KEY_ART_CARD_KEYS.saintLight, KEY_ART_CARD_PATHS.saintLight);
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
    const glow = this.add.rectangle(w / 2, 26, w, 58, 0x67cfff, 0.035).setDepth(10);
    const bar = this.add.rectangle(w / 2, 26, w, 46, 0x081425, 0.54).setDepth(11);
    const topEdge = this.add.rectangle(w / 2, 48, w - 96, 2, 0xecf8ff, 0.1).setDepth(12);
    glow.setAlpha(0.035);
    bar.setStrokeStyle(1, 0x8fd8ff, 0.22);
    this.add.text(28, 26, "玩家：彼羽", {
      fontSize: "16px",
      color: "#dcedff",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setDepth(13).setAlpha(0.9);
    this.add.text(w - 28, 26, "晶焰 1280  |  金幣 54210", {
      fontSize: "16px",
      color: "#ffe3a8",
      fontStyle: "bold"
    }).setOrigin(1, 0.5).setDepth(13).setAlpha(0.88);
    this.add.rectangle(w / 2, 26, 148, 18, 0x78d7ff, 0.028).setDepth(12);
    this.tweens.add({ targets: [glow], alpha: { from: 0.03, to: 0.065 }, duration: 1800, yoyo: true, repeat: -1 });
    topEdge.setAlpha(0.1);
  }

  _drawBackground(w, h) {
    const g = this.add.graphics();
    g.fillGradientStyle(0x86cfff, 0x63b9ff, 0xe4f6ff, 0x8fd2ff, 1);
    g.fillRect(0, 0, w, h);

    this.add.ellipse(w * 0.28, h * 0.16, 300, 82, 0xf8fdff, 0.7).setDepth(1);
    this.add.ellipse(w * 0.5, h * 0.12, 420, 92, 0xf8fdff, 0.64).setDepth(1);
    this.add.ellipse(w * 0.76, h * 0.18, 340, 88, 0xf8fdff, 0.66).setDepth(1);
    this.add.ellipse(w * 0.48, h * 0.28, 720, 280, 0xffffff, 0.12).setDepth(2);
    this.add.ellipse(w * 0.2, h * 0.44, 420, 250, 0x7dd6ff, 0.08).setDepth(2);
    this.add.ellipse(w * 0.82, h * 0.43, 420, 250, 0xffd79b, 0.06).setDepth(2);

    const horizonGlow = this.add.rectangle(w / 2, h * 0.61, w * 0.9, 18, 0xffffff, 0.22).setDepth(3);
    const grassBand = this.add.rectangle(w / 2, h * 0.84, w, h * 0.34, 0x6bc46b, 0.92).setDepth(3);
    const grassLight = this.add.ellipse(w / 2, h * 0.74, w * 0.92, 120, 0xcdf29d, 0.22).setDepth(4);
    const hillLeft = this.add.ellipse(w * 0.22, h * 0.81, 420, 110, 0x56ae58, 0.75).setDepth(4);
    const hillMid = this.add.ellipse(w * 0.5, h * 0.8, 620, 126, 0x5eb85f, 0.78).setDepth(4);
    const hillRight = this.add.ellipse(w * 0.8, h * 0.82, 430, 116, 0x4fa652, 0.74).setDepth(4);
    const flowerMist = this.add.ellipse(w / 2, h * 0.67, w * 0.86, 130, 0xf7fbff, 0.14).setDepth(5);
    const sacredArcL = this.add.ellipse(w * 0.42, h * 0.33, 260, 42, 0x8ee0ff, 0.08).setDepth(6).setAngle(-22);
    const sacredArcR = this.add.ellipse(w * 0.58, h * 0.32, 260, 42, 0xffcc8b, 0.08).setDepth(6).setAngle(22);

    const stars = 36;
    for (let i = 0; i < stars; i += 1) {
      const sx = Phaser.Math.Between(0, w);
      const sy = Phaser.Math.Between(0, Math.floor(h * 0.48));
      const star = this.add.circle(sx, sy, Phaser.Math.Between(1, 2), 0xe3f5ff, Phaser.Math.FloatBetween(0.08, 0.34));
      this.tweens.add({
        targets: star,
        alpha: { from: Phaser.Math.FloatBetween(0.06, 0.18), to: Phaser.Math.FloatBetween(0.18, 0.42) },
        duration: Phaser.Math.Between(1600, 3000),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1500)
      });
    }

    this.tweens.add({
      targets: [horizonGlow, grassLight, flowerMist, sacredArcL, sacredArcR],
      alpha: { from: 0.08, to: 0.2 },
      duration: 2600,
      yoyo: true,
      repeat: -1
    });
  }

  _drawHeroSilhouettes(w, h) {
    const leftAura = this.add.circle(w * 0.14, h * 0.56, 232, 0x8fd9ff, 0.14).setDepth(2);
    const rightAura = this.add.circle(w * 0.84, h * 0.55, 226, 0xffd08d, 0.12).setDepth(2);
    const leftBloom = this.add.ellipse(w * 0.18, h * 0.6, 300, 430, 0x7bd7ff, 0.08).setDepth(3).setAngle(-10);
    const rightBloom = this.add.ellipse(w * 0.82, h * 0.58, 286, 420, 0xffc17d, 0.08).setDepth(3).setAngle(9);
    const leftFrame = this.add.rectangle(w * 0.18, h * 0.63, 210, 360, 0x081625, 0.34).setAngle(-10).setDepth(4);
    const rightFrame = this.add.rectangle(w * 0.82, h * 0.615, 196, 344, 0x26150f, 0.32).setAngle(9).setDepth(4);

    const leftCard = this.textures.exists(KEY_ART_CARD_KEYS.saintLead)
      ? this.add.image(w * 0.21, h * 0.62, KEY_ART_CARD_KEYS.saintLead).setDepth(6)
      : this.add.rectangle(w * 0.21, h * 0.62, 190, 300, 0x103252, 0.9).setDepth(6);
    if (leftCard.setDisplaySize) leftCard.setDisplaySize(218, 330);
    leftCard.setAngle(-10);
    leftCard.setAlpha(0.96);

    const rightCard = this.textures.exists(KEY_ART_CARD_KEYS.saintSupport)
      ? this.add.image(w * 0.81, h * 0.605, KEY_ART_CARD_KEYS.saintSupport).setDepth(6)
      : this.add.rectangle(w * 0.81, h * 0.605, 182, 288, 0x4a2b16, 0.88).setDepth(6);
    if (rightCard.setDisplaySize) rightCard.setDisplaySize(204, 310);
    rightCard.setAngle(8);
    rightCard.setAlpha(0.94);

    const leftEdge = this.add.rectangle(w * 0.265, h * 0.635, 16, 284, 0xa6e7ff, 0.12).setAngle(-10).setDepth(7);
    const rightEdge = this.add.rectangle(w * 0.742, h * 0.62, 16, 270, 0xffd0a2, 0.12).setAngle(9).setDepth(7);
    const leftSummon = this.add.circle(w * 0.34, h * 0.56, 50, 0x79d8ff, 0.09).setDepth(7);
    const rightSummon = this.add.circle(w * 0.67, h * 0.54, 46, 0xffb879, 0.09).setDepth(7);
    const leftRibbon = this.add.ellipse(w * 0.33, h * 0.52, 180, 30, 0x85dcff, 0.08).setDepth(7).setAngle(-32);
    const rightRibbon = this.add.ellipse(w * 0.66, h * 0.5, 180, 30, 0xffc481, 0.08).setDepth(7).setAngle(28);

    this.tweens.add({
      targets: [leftAura, rightAura, leftBloom, rightBloom, leftEdge, rightEdge, leftSummon, rightSummon, leftRibbon, rightRibbon],
      alpha: { from: 0.06, to: 0.17 },
      duration: 2400,
      yoyo: true,
      repeat: -1
    });

    this.tweens.add({
      targets: [leftCard, rightCard],
      y: '-=6',
      duration: 2200,
      yoyo: true,
      repeat: -1
    });
  }

  _drawCenterStage(w, h) {
    const stageGlow = this.add.ellipse(w / 2, h * 0.39, 680, 280, 0x76d2ff, 0.06).setDepth(20);
    const flameHalo = this.add.ellipse(w / 2, h * 0.152, 168, 58, 0xf4c670, 0.14).setDepth(21);
    const flameCore = this.add.ellipse(w / 2, h * 0.13, 104, 60, 0xf6b24f, 0.32).setDepth(22);
    const crestOuter = this.add.circle(w / 2, h * 0.13, 24, 0xf6ca75, 0.86).setStrokeStyle(2, 0xffefbd, 0.95).setDepth(23);
    const crestInner = this.add.circle(w / 2, h * 0.13, 11, 0xfff8de, 0.98).setDepth(24);
    const crestRing = this.add.ellipse(w / 2, h * 0.13, 184, 74, 0xffda92, 0.05).setStrokeStyle(1.5, 0xffe9b2, 0.35).setDepth(22);
    const crestSpireL = this.add.triangle(w / 2 - 28, h * 0.13 + 2, 0, 18, 20, -24, 44, 22, 0xffcf7c, 0.72).setDepth(23).setAngle(-18);
    const crestSpireR = this.add.triangle(w / 2 + 28, h * 0.13 + 2, 0, 18, 20, -24, 44, 22, 0xffcf7c, 0.72).setDepth(23).setAngle(198);

    const logoFar = this.add.text(w / 2, h * 0.168, "火焰征程", {
      fontSize: "92px",
      color: "#61cbff",
      fontStyle: "bold"
    }).setOrigin(0.5).setAlpha(0.08).setDepth(24);

    const logoGlow = this.add.text(w / 2, h * 0.162, "火焰征程", {
      fontSize: "84px",
      color: "#9be2ff",
      fontStyle: "bold"
    }).setOrigin(0.5).setAlpha(0.24).setDepth(25);

    const logo = this.add.text(w / 2, h * 0.156, "火焰征程", {
      fontSize: "74px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#1d2e45",
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(26);

    this.add.text(w / 2, h * 0.225, "Flame Journey", {
      fontSize: "26px",
      color: "#d5ebff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(26);

    this.add.text(w / 2, h * 0.286, "聖火甦醒，命運之戰即將展開", {
      fontSize: "20px",
      color: "#d7eaff",
      stroke: "#09111a",
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(26);

    const centerSupport = this.textures.exists(KEY_ART_CARD_KEYS.saintLight)
      ? this.add.image(w * 0.5, h * 0.392, KEY_ART_CARD_KEYS.saintLight).setDepth(24)
      : this.add.rectangle(w * 0.5, h * 0.392, 76, 108, 0x142844, 0.95).setDepth(24);
    if (centerSupport.setDisplaySize) centerSupport.setDisplaySize(106, 150);
    centerSupport.setAngle(-2).setAlpha(0.78);

    const centerSupportGlow = this.add.ellipse(w * 0.5, h * 0.39, 140, 34, 0xffcc7d, 0.09).setDepth(23);
    const cardTrailLeft = this.add.ellipse(w * 0.42, h * 0.39, 210, 26, 0x84dbff, 0.08).setAngle(-17).setDepth(23);
    const cardTrailRight = this.add.ellipse(w * 0.58, h * 0.38, 210, 26, 0xffbf7a, 0.08).setAngle(17).setDepth(23);

    this._makeButton(w / 2, h * 0.44, "開始冒險", () => this._openBattleModal(), 388, 76, "34px", "primary");

    this.tweens.add({
      targets: [stageGlow, flameHalo, flameCore, crestOuter, crestInner, crestRing, crestSpireL, crestSpireR, logoFar, logoGlow, logo, centerSupport, centerSupportGlow, cardTrailLeft, cardTrailRight],
      alpha: { from: 0.88, to: 1 },
      duration: 1800,
      yoyo: true,
      repeat: -1
    });

    this.tweens.add({
      targets: [centerSupport],
      y: '-=6',
      duration: 1800,
      yoyo: true,
      repeat: -1
    });
  }

  _drawModeCards(w, h) {
    this._makeModeCard(w / 2 - 208, h * 0.602, 230, 104, "副本挑戰", "挑戰關卡、選擇敵人配置", 0x71cfff, () => this.scene.start("ChallengeScene"));
    this._makeModeCard(w / 2 + 198, h * 0.582, 230, 104, "線上對戰", "與其他玩家即時對戰", 0xffbf82, () => this.scene.start("RoomScene"));
  }

  _makeModeCard(cx, cy, w, h, title, desc, glowColor, onClick) {
    const glow = this.add.ellipse(cx, cy, w + 30, h + 24, glowColor, 0.075).setDepth(25);
    const shadow = this.add.rectangle(cx, cy + 6, w, h, 0x000000, 0.28).setDepth(26);
    const panel = this.add.rectangle(cx, cy, w, h, 0x0f2036, 0.8).setDepth(27).setStrokeStyle(1.4, 0xcde8ff, 0.34);
    const topEdge = this.add.rectangle(cx, cy - h / 2 + 10, w - 26, 2, 0xf2fbff, 0.14).setDepth(28);
    const iconRing = this.add.circle(cx - w / 2 + 32, cy - 6, 16, 0x18344f, 0.94).setDepth(28).setStrokeStyle(2, glowColor, 0.6);
    const titleText = this.add.text(cx - w / 2 + 58, cy - 20, title, {
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(28);
    const descText = this.add.text(cx - w / 2 + 58, cy + 6, desc, {
      fontSize: "14px",
      color: "#cae2f7"
    }).setDepth(28);
    const enterText = this.add.text(cx - w / 2 + 58, cy + 28, "進入模式 →", {
      fontSize: "14px",
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

    const y = h * 0.72;
    const startX = w / 2 - 282;
    const gap = 188;
    for (let i = 0; i < items.length; i += 1) {
      this._makeButton(startX + i * gap, y, items[i].label, items[i].onClick, 156, 38, "17px", "secondary");
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
