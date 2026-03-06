import Phaser from "phaser";
import GameState from "../core/GameState";
import CardFactory from "../models/CardFactory";
import { buildAllRaceChallengeDecks } from "../systems/ChallengeDeckBuilder";
import { HERO_HP } from "../config/constants";

function validDeckIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => !!CardFactory.getCardDef(id)).map((id) => String(id));
}

export default class ChallengeScene extends Phaser.Scene {
  constructor() {
    super("ChallengeScene");
    this.challengeDecks = [];
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this._drawBackground(w, h);

    this.add.text(40, 28, "副本挑戰", { fontSize: "44px", color: "#ffffff" });
    this.add.text(42, 82, "選擇種族副本，系統會以該種族效果核心組出 30 張挑戰牌組", {
      fontSize: "20px",
      color: "#d8f3ff"
    });

    this.add
      .text(w - 140, 26, "返回選單", { fontSize: "20px", color: "#d3ecff" })
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.scene.start("MenuScene"));

    this.challengeDecks = buildAllRaceChallengeDecks();
    this._renderRaceButtons(w, h);
  }

  _drawBackground(w, h) {
    const g = this.add.graphics();
    g.fillGradientStyle(0x103772, 0x153f80, 0x081f47, 0x07173a, 1);
    g.fillRect(0, 0, w, h);

    this.add.circle(w * 0.82, h * 0.23, 180, 0xffd98f, 0.18);
    this.add.circle(w * 0.12, h * 0.78, 220, 0x7dd6ff, 0.14);

    for (let i = 0; i < 52; i += 1) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, h);
      const s = this.add.circle(x, y, Phaser.Math.Between(1, 2), 0xe3f5ff, Phaser.Math.FloatBetween(0.25, 0.8));
      this.tweens.add({
        targets: s,
        alpha: { from: 0.2, to: 1 },
        yoyo: true,
        repeat: -1,
        duration: Phaser.Math.Between(900, 2100),
        delay: Phaser.Math.Between(0, 1200)
      });
    }
  }

  _renderRaceButtons(w, h) {
    const cols = 3;
    const tileW = 360;
    const tileH = 112;
    const gapX = 24;
    const gapY = 18;
    const totalW = cols * tileW + (cols - 1) * gapX;
    const startX = Math.floor((w - totalW) / 2) + tileW / 2;
    const startY = 162;

    for (let i = 0; i < this.challengeDecks.length; i += 1) {
      const d = this.challengeDecks[i];
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * (tileW + gapX);
      const y = startY + row * (tileH + gapY);

      const bg = this.add
        .rectangle(x, y, tileW, tileH, 0xffffff, 0.1)
        .setStrokeStyle(1, 0x9edbff, 0.45)
        .setInteractive({ useHandCursor: true });

      const title = this.add.text(x - tileW / 2 + 16, y - 34, `${d.label} 副本`, {
        fontSize: "30px",
        color: "#ffffff"
      });
      const sub = this.add.text(x - tileW / 2 + 16, y + 6, `卡池 ${d.poolCount} | 挑戰牌組 30 | 強度 ${d.avgPower}`, {
        fontSize: "18px",
        color: "#d9efff"
      });

      bg.on("pointerover", () => bg.setFillStyle(0x9bd7ff, 0.18));
      bg.on("pointerout", () => bg.setFillStyle(0xffffff, 0.1));
      bg.on("pointerup", () => this._startChallenge(d));

      this.add.container(0, 0, [bg, title, sub]);
    }
  }

  _startChallenge(challenge) {
    const leftSaved = validDeckIds(GameState.getDeckIds("L1"));
    const leftDeck = leftSaved.length > 0 ? leftSaved.slice(0, 30) : challenge.deckIds.slice(0, 30);
    const rightDeck = validDeckIds(challenge.deckIds).slice(0, 30);

    this.scene.start("BattleScene", {
      mode: "local",
      allies: 1,
      enemies: 1,
      autoPlayerEnabled: false,
      leftStartHp: HERO_HP,
      rightStartHp: HERO_HP,
      leftDeckIds: leftDeck,
      rightDeckIds: rightDeck,
      challengeLabel: `${challenge.label}副本`
    });
  }
}

