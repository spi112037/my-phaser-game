import { HAND_LIMIT } from "../config/constants";

const LONG_PRESS_MS = 420;

function getCardCost(card) {
  return Math.max(0, Number(card?.cost ?? card?.baseCost ?? 0));
}

function getTextureKey(card) {
  return `card_${card?.id ?? ""}`;
}

function safe(v) {
  return String(v || "").trim();
}

export default class HandBar {
  constructor(scene, onSelectCard, onEndTurn, onPreviewCard, onToggleRemoveMode, onToggleAutoPlayer) {
    this.scene = scene;
    this.onSelectCard = onSelectCard;
    this.onEndTurn = onEndTurn;
    this.onPreviewCard = onPreviewCard;
    this.onToggleRemoveMode = onToggleRemoveMode;
    this.onToggleAutoPlayer = onToggleAutoPlayer;

    this.actor = null;
    this.canOperate = false;
    this.selectedId = null;
    this.pileModal = null;
    this.logLines = [];
    this.logOffset = 0;
    this.logVisibleLines = 6;
    this.removeMode = false;
    this.autoPlayerEnabled = false;

    const w = scene.scale.width;
    const h = scene.scale.height;

    this.container = scene.add.container(0, 0).setDepth(2100);

    this.bottomAura = scene.add.ellipse(w / 2, h - 80, w * 0.9, 180, 0x74c9ff, 0.07);
    this.bottomShadow = scene.add.ellipse(w / 2, h - 24, w * 0.94, 96, 0x000000, 0.3);
    this.bgShadow = scene.add.rectangle(w / 2, h - 95, w + 10, 204, 0x000000, 0.42);
    this.bg = scene.add.rectangle(w / 2, h - 98, w, 196, 0x091120, 0.84).setStrokeStyle(2, 0x78bfff, 0.3);
    this.bgInnerGlow = scene.add.rectangle(w / 2, h - 152, w - 140, 56, 0x96d8ff, 0.06);
    this.bgTopEdge = scene.add.rectangle(w / 2, h - 190, w - 80, 2, 0xe7f4ff, 0.24);
    this.container.add([this.bottomAura, this.bottomShadow, this.bgShadow, this.bg, this.bgInnerGlow, this.bgTopEdge]);

    const bandTop = h - 178;

    this.logGlow = scene.add.rectangle(168, bandTop + 74, 322, 154, 0x7bc6ff, 0.05).setOrigin(0.5, 0.5);
    this.logPanelBg = scene.add.rectangle(16, bandTop, 308, 150, 0x0a1628, 0.9).setOrigin(0, 0);
    this.logPanelBg.setStrokeStyle(1, 0x5a88b8, 0.9);
    this.logTopLine = scene.add.rectangle(170, bandTop + 10, 282, 2, 0xcdeaff, 0.26);
    this.logTitle = scene.add.text(26, bandTop + 8, "戰場紀錄", { fontSize: "16px", color: "#ffffff", fontStyle: "bold" });
    this.logText = scene.add.text(26, bandTop + 30, "", {
      fontSize: "13px",
      color: "#cfe8ff",
      wordWrap: { width: 288, useAdvancedWrap: false },
      lineSpacing: 2
    });
    this.logPanelBg.setInteractive({ useHandCursor: true });

    this.deckPanelBg = scene.add.rectangle(334, bandTop, 92, 150, 0x131f33, 0.94)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.deckPanelBg.setStrokeStyle(1.5, 0x88b8ea, 0.8);
    this.deckTitle = scene.add.text(380, bandTop + 12, "牌組", { fontSize: "15px", color: "#ffe3a7", fontStyle: "bold" }).setOrigin(0.5, 0);
    this.deckValue = scene.add.text(380, bandTop + 58, "0", { fontSize: "30px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5, 0);

    this.gravePanelBg = scene.add.rectangle(w - 136, bandTop, 92, 150, 0x201726, 0.94)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.gravePanelBg.setStrokeStyle(1.5, 0xffb0cb, 0.76);
    this.graveTitle = scene.add.text(w - 90, bandTop + 12, "墓地", { fontSize: "15px", color: "#ffd4df", fontStyle: "bold" }).setOrigin(0.5, 0);
    this.graveValue = scene.add.text(w - 90, bandTop + 58, "0", { fontSize: "30px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5, 0);

    this.readyTitle = scene.add.text(438, bandTop + 8, "戰鬥手牌", { fontSize: "18px", color: "#ffdca8", fontStyle: "bold" });
    this.hint = scene.add.text(438, bandTop + 30, "", { fontSize: "12px", color: "#9dc4e6" });
    const readyLeft = 430;
    const readyRight = w - 150;
    const readyWidth = Math.max(300, readyRight - readyLeft);
    this.readyGlow = scene.add.rectangle(readyLeft + readyWidth / 2, bandTop + 103, readyWidth + 12, 132, 0x8cd5ff, 0.05).setOrigin(0.5, 0.5);
    this.readyBandBg = scene.add.rectangle(readyLeft, bandTop + 42, readyWidth, 126, 0x0b1526, 0.88).setOrigin(0, 0);
    this.readyBandBg.setStrokeStyle(1.5, 0x74a7d8, 0.74);
    this.readyBandTopLine = scene.add.rectangle(readyLeft + readyWidth / 2, bandTop + 44, readyWidth - 26, 2, 0xdbf1ff, 0.22);

    this.cards = [];

    this.endBtnShadow = scene.add.rectangle(w - 88, bandTop - 16, 152, 46, 0x000000, 0.36);
    this.endBtnBg = scene.add
      .rectangle(w - 90, bandTop - 20, 148, 42, 0x3e76b1, 0.95)
      .setStrokeStyle(2, 0xf0fbff, 0.86)
      .setInteractive({ useHandCursor: true });
    this.endBtnGlow = scene.add.ellipse(w - 90, bandTop - 20, 180, 58, 0x7ed4ff, 0.15);
    this.endBtnText = scene.add
      .text(w - 90, bandTop - 20, "結束回合", { fontSize: "18px", color: "#ffffff", fontStyle: "bold", stroke: "#16324d", strokeThickness: 3 })
      .setOrigin(0.5);

    this.endBtnBg.on("pointerup", () => {
      if (!this.canOperate) return;
      if (typeof this.onEndTurn === "function") this.onEndTurn();
    });

    this.removeBtnBg = scene.add
      .rectangle(w - 250, bandTop - 20, 140, 40, 0x4b2d34, 0.86)
      .setStrokeStyle(2, 0xffc2cf, 0.62)
      .setInteractive({ useHandCursor: true });
    this.removeBtnText = scene.add
      .text(w - 250, bandTop - 20, "剷除士兵", { fontSize: "17px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0.5);

    this.removeBtnBg.on("pointerup", () => {
      if (!this.canOperate) return;
      if (typeof this.onToggleRemoveMode === "function") this.onToggleRemoveMode();
    });

    this.autoBtnBg = scene.add
      .rectangle(w - 410, bandTop - 20, 140, 40, 0x2d3f5d, 0.86)
      .setStrokeStyle(2, 0xcfe2ff, 0.58)
      .setInteractive({ useHandCursor: true });
    this.autoBtnText = scene.add
      .text(w - 410, bandTop - 20, "我方自動:關", { fontSize: "17px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0.5);

    this.autoBtnBg.on("pointerup", () => {
      if (typeof this.onToggleAutoPlayer === "function") this.onToggleAutoPlayer();
    });

    this.deckPanelBg.on("pointerup", () => {
      const list = Array.isArray(this.actor?.deck) ? this.actor.deck : [];
      this._openPileModal("牌組", list);
    });

    this.gravePanelBg.on("pointerup", () => {
      const list = Array.isArray(this.actor?.grave) ? this.actor.grave : [];
      this._openPileModal("墓地", list);
    });

    this._onWheel = (pointer, _go, _dx, dy) => {
      if (!this.logPanelBg) return;
      if (!pointer) return;
      const b = this.logPanelBg.getBounds();
      const inside = pointer.x >= b.x && pointer.x <= b.x + b.width && pointer.y >= b.y && pointer.y <= b.y + b.height;
      if (!inside) return;
      if (dy > 0) this._scrollLog(1);
      else if (dy < 0) this._scrollLog(-1);
    };
    scene.input.on("wheel", this._onWheel);

    this.container.add([
      this.logGlow,
      this.logPanelBg,
      this.logTopLine,
      this.logTitle,
      this.logText,
      this.deckPanelBg,
      this.deckTitle,
      this.deckValue,
      this.readyGlow,
      this.readyBandBg,
      this.readyBandTopLine,
      this.readyTitle,
      this.hint,
      this.gravePanelBg,
      this.graveTitle,
      this.graveValue,
      this.autoBtnBg,
      this.autoBtnText,
      this.removeBtnBg,
      this.removeBtnText,
      this.endBtnShadow,
      this.endBtnGlow,
      this.endBtnBg,
      this.endBtnText
    ]);

    scene.tweens.add({
      targets: [this.bottomAura, this.readyGlow, this.endBtnGlow],
      alpha: { from: 0.06, to: 0.16 },
      duration: 1800,
      yoyo: true,
      repeat: -1
    });
  }

  setBattleLog(lines) {
    this.logLines = Array.isArray(lines) ? [...lines] : [];
    this.logOffset = Math.max(0, this.logLines.length - this.logVisibleLines);
    this._renderLogWindow();
  }

  _scrollLog(delta) {
    if (!Array.isArray(this.logLines) || this.logLines.length <= this.logVisibleLines) return;
    const maxOffset = Math.max(0, this.logLines.length - this.logVisibleLines);
    const next = Math.max(0, Math.min(maxOffset, this.logOffset + delta));
    if (next === this.logOffset) return;
    this.logOffset = next;
    this._renderLogWindow();
  }

  _renderLogWindow() {
    const list = Array.isArray(this.logLines) ? this.logLines : [];
    const maxOffset = Math.max(0, list.length - this.logVisibleLines);
    this.logOffset = Math.max(0, Math.min(maxOffset, this.logOffset));
    const view = list.slice(this.logOffset, this.logOffset + this.logVisibleLines);
    this.logText.setText(view.join("\n"));
    this.logTitle.setText(`戰場紀錄 ${list.length > 0 ? `(${this.logOffset + 1}-${Math.min(list.length, this.logOffset + this.logVisibleLines)}/${list.length})` : ""}`);
  }

  _openPileModal(title, cards) {
    if (this.pileModal) this.pileModal.destroy(true);

    const scene = this.scene;
    const w = scene.scale.width;
    const h = scene.scale.height;

    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.62).setInteractive();
    const pw = Math.min(980, w - 80);
    const ph = Math.min(680, h - 70);
    const panel = scene.add.rectangle(w / 2, h / 2, pw, ph, 0x0f1828, 0.98).setStrokeStyle(1, 0xffffff, 0.22);
    const titleText = scene.add.text(w / 2, h / 2 - ph / 2 + 16, `${title}（${cards.length}）`, {
      fontSize: "30px",
      color: "#ffffff"
    }).setOrigin(0.5, 0);

    const gridX = w / 2 - pw / 2 + 22;
    const gridY = h / 2 - ph / 2 + 68;
    const gridW = pw - 44;
    const gridH = ph - 126;
    const gridBg = scene.add.rectangle(gridX + gridW / 2, gridY + gridH / 2, gridW, gridH, 0xffffff, 0.03).setOrigin(0.5);

    const cols = 4;
    const rows = 4;
    const pageSize = cols * rows;
    const gap = 10;
    const cellW = Math.floor((gridW - gap * (cols - 1) - 18) / cols);
    const cellH = Math.floor((gridH - gap * (rows - 1) - 18) / rows);
    let page = 0;
    const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));

    const cardsContainer = scene.add.container(0, 0);
    const pageText = scene.add.text(w / 2, h / 2 + ph / 2 - 48, "", { fontSize: "18px", color: "#9dc4e6" }).setOrigin(0.5, 0.5);

    const makeBtn = (cx, cy, label, onClick) => {
      const bg = scene.add.rectangle(cx, cy, 104, 34, 0xffffff, 0.14).setInteractive({ useHandCursor: true });
      const t = scene.add.text(cx, cy, label, { fontSize: "16px", color: "#ffffff" }).setOrigin(0.5);
      bg.on("pointerup", onClick);
      return [bg, t];
    };

    const prevBtn = makeBtn(w / 2 - 140, h / 2 + ph / 2 - 48, "上一頁", () => {
      if (page <= 0) return;
      page -= 1;
      renderPage();
    });
    const nextBtn = makeBtn(w / 2 + 140, h / 2 + ph / 2 - 48, "下一頁", () => {
      if (page >= totalPages - 1) return;
      page += 1;
      renderPage();
    });
    const closeBtn = makeBtn(w / 2, h / 2 + ph / 2 - 16, "關閉", () => {
      if (this.pileModal) this.pileModal.destroy(true);
    });

    const renderPage = () => {
      cardsContainer.removeAll(true);
      const start = page * pageSize;
      const list = cards.slice(start, start + pageSize);

      for (let i = 0; i < list.length; i += 1) {
        const card = list[i];
        const r = Math.floor(i / cols);
        const c = i % cols;
        const x = gridX + 8 + c * (cellW + gap);
        const y = gridY + 8 + r * (cellH + gap);

        const bg = scene.add.rectangle(x + cellW / 2, y + cellH / 2, cellW, cellH, 0xffffff, 0.06)
          .setStrokeStyle(1, 0xffffff, 0.2);
        cardsContainer.add(bg);

        const tex = getTextureKey(card);
        const artH = cellH - 58;
        if (scene.textures.exists(tex)) {
          const img = scene.add.image(x + cellW / 2, y + 8 + artH / 2, tex);
          const scale = Math.min((cellW - 12) / img.width, artH / img.height);
          img.setScale(scale);
          cardsContainer.add(img);
        } else {
          const no = scene.add.rectangle(x + cellW / 2, y + 8 + artH / 2, cellW - 12, artH, 0x223548, 0.9)
            .setStrokeStyle(1, 0xffffff, 0.15);
          const txt = scene.add.text(x + cellW / 2, y + 8 + artH / 2, "NO IMAGE", {
            fontSize: "14px",
            color: "#b9c9d8"
          }).setOrigin(0.5);
          cardsContainer.add([no, txt]);
        }

        const name = scene.add.text(x + 8, y + cellH - 40, safe(card?.name || card?.id || "未知卡"), {
          fontSize: "15px",
          color: "#ffffff",
          wordWrap: { width: cellW - 16 }
        });
        const stat = scene.add.text(x + 8, y + cellH - 20, `費:${getCardCost(card)} HP:${Number(card?.unit?.hp ?? 0)} ATK:${Number(card?.unit?.atk ?? 0)}`, {
          fontSize: "12px",
          color: "#9dc4e6",
          wordWrap: { width: cellW - 16 }
        });
        cardsContainer.add([name, stat]);
      }

      pageText.setText(`第 ${page + 1}/${totalPages} 頁`);
    };

    const onWheel = (_p, _go, _dx, dy) => {
      if (dy > 0 && page < totalPages - 1) {
        page += 1;
        renderPage();
      } else if (dy < 0 && page > 0) {
        page -= 1;
        renderPage();
      }
    };
    scene.input.on("wheel", onWheel);

    this.pileModal = scene.add.container(0, 0, [
      overlay,
      panel,
      titleText,
      gridBg,
      cardsContainer,
      pageText,
      ...prevBtn,
      ...nextBtn,
      ...closeBtn
    ]).setDepth(5000);

    overlay.on("pointerup", () => {
      if (this.pileModal) this.pileModal.destroy(true);
    });

    this.pileModal.on("destroy", () => {
      scene.input.off("wheel", onWheel);
      this.pileModal = null;
    });

    renderPage();
  }

  setState(actor, canOperate, extraHint, removeMode = false, options = {}) {
    this.actor = actor;
    this.canOperate = Boolean(canOperate);
    this.removeMode = Boolean(removeMode);
    this.autoPlayerEnabled = Boolean(options?.autoPlayerEnabled);

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.endBtnBg.setAlpha(this.canOperate ? 1 : 0.45);
    this.endBtnText.setAlpha(this.canOperate ? 1 : 0.45);
    this.endBtnGlow.setAlpha(this.canOperate ? 0.15 : 0.06);
    this.removeBtnBg.setAlpha(this.canOperate ? 1 : 0.35);
    this.removeBtnText.setAlpha(this.canOperate ? 1 : 0.35);
    this.autoBtnBg.setAlpha(1);
    this.autoBtnText.setAlpha(1);
    if (this.removeMode && this.canOperate) {
      this.removeBtnBg.setFillStyle(0xb04040, 0.9);
      this.removeBtnBg.setStrokeStyle(2, 0xffd0d6, 0.88);
      this.removeBtnText.setColor("#fff0f0");
    } else {
      this.removeBtnBg.setFillStyle(0x4b2d34, 0.86);
      this.removeBtnBg.setStrokeStyle(2, 0xffc2cf, 0.62);
      this.removeBtnText.setColor("#ffffff");
    }

    if (this.autoPlayerEnabled) {
      this.autoBtnBg.setFillStyle(0x2f7d4f, 0.9);
      this.autoBtnBg.setStrokeStyle(2, 0xc9ffe0, 0.82);
      this.autoBtnText.setColor("#e8ffef");
    } else {
      this.autoBtnBg.setFillStyle(0x2d3f5d, 0.86);
      this.autoBtnBg.setStrokeStyle(2, 0xcfe2ff, 0.58);
      this.autoBtnText.setColor("#ffffff");
    }

    if (this.canOperate) {
      this.endBtnBg.setFillStyle(0x4da0df, 0.96);
      this.endBtnBg.setStrokeStyle(2, 0xf0fbff, 0.9);
    } else {
      this.endBtnBg.setFillStyle(0x33526f, 0.7);
      this.endBtnBg.setStrokeStyle(2, 0xaed7ff, 0.38);
    }
    this.autoBtnText.setText(`我方自動:${this.autoPlayerEnabled ? "開" : "關"}`);

    const baseHint = "可出牌條件：費用倒數 = 0（長按看詳情）";
    this.hint.setText(`${baseHint}${extraHint ? ` | ${extraHint}` : ""}`);

    this.deckValue.setText(String(Number(actor?.deck?.length ?? 0)));
    this.graveValue.setText(String(Number(actor?.grave?.length ?? 0)));

    for (let i = 0; i < this.cards.length; i += 1) this.cards[i].destroy(true);
    this.cards = [];

    const listAll = Array.isArray(actor?.ready) ? actor.ready : [];
    const list = listAll.filter((c) => c && c.type === "summon" && c.unit).slice(0, HAND_LIMIT);

    if (!list.some((c) => c.id === this.selectedId)) this.selectedId = null;

    const startX = 438;
    const endX = w - 154;
    const totalW = Math.max(280, endX - startX);
    const gap = 8;
    const cardW = Math.max(88, Math.floor((totalW - gap * (HAND_LIMIT - 1)) / HAND_LIMIT));
    const cardH = 112;
    const y = h - 138;

    for (let i = 0; i < HAND_LIMIT; i += 1) {
      const x = startX + i * (cardW + gap);
      const card = list[i] || null;

      const container = this.scene.add.container(x, y);
      const glow = this.scene.add.rectangle(cardW / 2, cardH / 2, cardW + 10, cardH + 10, 0x82d4ff, 0.04);
      const bg = this.scene.add.rectangle(0, 0, cardW, cardH, 0x132236, 0.82).setOrigin(0, 0);
      const topLight = this.scene.add.rectangle(cardW / 2, 10, cardW - 12, 2, 0xe7f4ff, 0.24);
      const border = this.scene.add.rectangle(0, 0, cardW, cardH, 0x000000, 0).setOrigin(0, 0);
      border.setStrokeStyle(1, 0xa9c0df, 0.26);
      container.add([glow, bg, topLight, border]);

      if (card) {
        const cost = getCardCost(card);
        const canPlay = this.canOperate && cost === 0;

        const artX = 6;
        const artY = 6;
        const artW = Math.min(52, cardW - 12);
        const artH = 54;

        const textureKey = getTextureKey(card);
        if (this.scene.textures.exists(textureKey)) {
          const artFrame = this.scene.add.rectangle(artX + artW / 2, artY + artH / 2, artW + 4, artH + 4, 0x0d1624, 0.95)
            .setStrokeStyle(1, 0xdcf0ff, 0.22);
          const art = this.scene.add.image(artX + artW / 2, artY + artH / 2, textureKey);
          art.setDisplaySize(artW, artH);
          container.add([artFrame, art]);
        } else {
          const artBg = this.scene.add.rectangle(artX, artY, artW, artH, 0x223548, 0.9).setOrigin(0, 0);
          const artFallback = this.scene.add
            .text(artX + artW / 2, artY + artH / 2, "No\nImg", {
              fontSize: "11px",
              color: "#9db8ce",
              align: "center"
            })
            .setOrigin(0.5);
          container.add([artBg, artFallback]);
        }

        const textX = artX + artW + 6;
        const nameW = Math.max(26, cardW - textX - 6);
        const txt1 = this.scene.add.text(textX, 7, card.name, {
          fontSize: cardW < 98 ? "10px" : "12px",
          color: "#ffffff",
          fontStyle: "bold",
          wordWrap: { width: nameW }
        });
        const txt2 = this.scene.add.text(textX, 35, `費:${cost}`, {
          fontSize: "11px",
          color: cost === 0 ? "#9dffba" : "#cfe8ff"
        });
        const txt3 = this.scene.add.text(6, cardH - 22, `HP:${card.unit.hp}  ATK:${card.unit.atk}`, {
          fontSize: cardW < 98 ? "10px" : "11px",
          color: "#cfe8ff"
        });
        container.add([txt1, txt2, txt3]);

        const sel = this.selectedId && card.id === this.selectedId;
        if (sel) {
          bg.setFillStyle(0x24476d, 0.92);
          glow.setFillStyle(0x8fd8ff, 0.14);
          border.setStrokeStyle(2, 0xb7ebff, 0.98);
        } else if (canPlay) {
          bg.setFillStyle(0x1a2c44, 0.88);
          glow.setFillStyle(0x88d4ff, 0.08);
          border.setStrokeStyle(1.5, 0x9bd6ff, 0.58);
        }

        let holdTimer = null;
        let holdTriggered = false;

        bg.setInteractive({ useHandCursor: true });

        bg.on("pointerover", () => {
          if (!canPlay) return;
          this.scene.tweens.add({
            targets: container,
            y: y - 8,
            scaleX: 1.03,
            scaleY: 1.03,
            duration: 120,
            ease: "Sine.easeOut"
          });
          glow.setFillStyle(0x95e1ff, 0.16);
          border.setStrokeStyle(2, 0xe5f3ff, 0.95);
        });

        bg.on("pointerout", () => {
          this.scene.tweens.add({
            targets: container,
            y,
            scaleX: 1,
            scaleY: 1,
            duration: 120,
            ease: "Sine.easeOut"
          });
          if (sel) {
            glow.setFillStyle(0x8fd8ff, 0.14);
            border.setStrokeStyle(2, 0xb7ebff, 0.98);
          } else if (canPlay) {
            glow.setFillStyle(0x88d4ff, 0.08);
            border.setStrokeStyle(1.5, 0x9bd6ff, 0.58);
          } else {
            glow.setFillStyle(0x82d4ff, 0.04);
            border.setStrokeStyle(1, 0xa9c0df, 0.26);
          }
        });

        bg.on("pointerdown", (pointer) => {
          if (pointer.rightButtonDown && pointer.rightButtonDown()) {
            if (typeof this.onPreviewCard === "function") this.onPreviewCard(card);
            holdTriggered = true;
            return;
          }

          holdTriggered = false;
          if (holdTimer) holdTimer.remove(false);
          holdTimer = this.scene.time.delayedCall(LONG_PRESS_MS, () => {
            holdTriggered = true;
            if (typeof this.onPreviewCard === "function") this.onPreviewCard(card);
          });
        });

        bg.on("pointerout", () => {
          if (holdTimer) {
            holdTimer.remove(false);
            holdTimer = null;
          }
        });

        bg.on("pointerup", () => {
          if (holdTimer) {
            holdTimer.remove(false);
            holdTimer = null;
          }

          if (holdTriggered) return;
          if (!canPlay) return;

          this.selectedId = card.id;
          if (typeof this.onSelectCard === "function") this.onSelectCard(card);
        });
      } else {
        const emptyText = this.scene.add.text(cardW / 2, cardH / 2, "空位", {
          fontSize: "14px",
          color: "#6f89a5"
        }).setOrigin(0.5);
        container.add(emptyText);
      }

      this.cards.push(container);
      this.container.add(container);
    }
  }

  destroy() {
    if (this.scene?.input && this._onWheel) this.scene.input.off("wheel", this._onWheel);
    if (this.container) this.container.destroy(true);
  }
}
