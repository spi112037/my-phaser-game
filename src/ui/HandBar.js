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

    this.container = scene.add.container(0, 0);

    this.bg = scene.add.rectangle(w / 2, h - 95, w, 190, 0x000000, 0.56);
    this.container.add(this.bg);

    const bandTop = h - 178;

    this.logPanelBg = scene.add.rectangle(16, bandTop, 308, 150, 0x0a1628, 0.86).setOrigin(0, 0);
    this.logPanelBg.setStrokeStyle(1, 0x3d5f87, 0.95);
    this.logTitle = scene.add.text(26, bandTop + 8, "訊息欄", { fontSize: "16px", color: "#ffffff" });
    this.logText = scene.add.text(26, bandTop + 30, "", {
      fontSize: "13px",
      color: "#cfe8ff",
      wordWrap: { width: 288, useAdvancedWrap: false },
      lineSpacing: 2
    });
    this.logPanelBg.setInteractive({ useHandCursor: true });

    this.deckPanelBg = scene.add.rectangle(334, bandTop, 92, 150, 0x101b2c, 0.9)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.deckPanelBg.setStrokeStyle(1, 0x6e8db6, 0.95);
    this.deckTitle = scene.add.text(380, bandTop + 12, "牌組", { fontSize: "15px", color: "#ffe3a7" }).setOrigin(0.5, 0);
    this.deckValue = scene.add.text(380, bandTop + 62, "0", { fontSize: "28px", color: "#ffffff" }).setOrigin(0.5, 0);

    this.gravePanelBg = scene.add.rectangle(w - 136, bandTop, 92, 150, 0x101b2c, 0.9)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.gravePanelBg.setStrokeStyle(1, 0x6e8db6, 0.95);
    this.graveTitle = scene.add.text(w - 90, bandTop + 12, "墓地", { fontSize: "15px", color: "#ffe3a7" }).setOrigin(0.5, 0);
    this.graveValue = scene.add.text(w - 90, bandTop + 62, "0", { fontSize: "28px", color: "#ffffff" }).setOrigin(0.5, 0);

    this.readyTitle = scene.add.text(438, bandTop + 8, "準備欄", { fontSize: "16px", color: "#ffdca8" });
    this.hint = scene.add.text(438, bandTop + 28, "", { fontSize: "12px", color: "#9dc4e6" });
    const readyLeft = 430;
    const readyRight = w - 150;
    const readyWidth = Math.max(300, readyRight - readyLeft);
    this.readyBandBg = scene.add.rectangle(readyLeft, bandTop + 42, readyWidth, 126, 0x0b1526, 0.82).setOrigin(0, 0);
    this.readyBandBg.setStrokeStyle(1, 0x5f7da3, 0.68);
    this.readyBandTopLine = scene.add.rectangle(readyLeft + 1, bandTop + 43, readyWidth - 2, 2, 0x8fb8ea, 0.32).setOrigin(0, 0);

    this.cards = [];

    this.endBtnBg = scene.add
      .rectangle(w - 90, bandTop - 20, 140, 40, 0xffffff, 0.12)
      .setInteractive({ useHandCursor: true });
    this.endBtnText = scene.add
      .text(w - 90, bandTop - 20, "結束回合", { fontSize: "17px", color: "#ffffff" })
      .setOrigin(0.5);

    this.endBtnBg.on("pointerup", () => {
      if (!this.canOperate) return;
      if (typeof this.onEndTurn === "function") this.onEndTurn();
    });

    this.removeBtnBg = scene.add
      .rectangle(w - 250, bandTop - 20, 140, 40, 0xffffff, 0.12)
      .setInteractive({ useHandCursor: true });
    this.removeBtnText = scene.add
      .text(w - 250, bandTop - 20, "剷除士兵", { fontSize: "17px", color: "#ffffff" })
      .setOrigin(0.5);

    this.removeBtnBg.on("pointerup", () => {
      if (!this.canOperate) return;
      if (typeof this.onToggleRemoveMode === "function") this.onToggleRemoveMode();
    });

    this.autoBtnBg = scene.add
      .rectangle(w - 410, bandTop - 20, 140, 40, 0xffffff, 0.12)
      .setInteractive({ useHandCursor: true });
    this.autoBtnText = scene.add
      .text(w - 410, bandTop - 20, "我方自動:關", { fontSize: "17px", color: "#ffffff" })
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
      this.logPanelBg,
      this.logTitle,
      this.logText,
      this.deckPanelBg,
      this.deckTitle,
      this.deckValue,
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
      this.endBtnBg,
      this.endBtnText
    ]);
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
    this.logTitle.setText(`訊息欄 ${list.length > 0 ? `(${this.logOffset + 1}-${Math.min(list.length, this.logOffset + this.logVisibleLines)}/${list.length})` : ""}`);
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

    this.endBtnBg.setAlpha(this.canOperate ? 1 : 0.35);
    this.endBtnText.setAlpha(this.canOperate ? 1 : 0.35);
    this.removeBtnBg.setAlpha(this.canOperate ? 1 : 0.35);
    this.removeBtnText.setAlpha(this.canOperate ? 1 : 0.35);
    this.autoBtnBg.setAlpha(this.canOperate ? 1 : 0.35);
    this.autoBtnText.setAlpha(this.canOperate ? 1 : 0.35);
    if (this.removeMode && this.canOperate) {
      this.removeBtnBg.setFillStyle(0xb04040, 0.75);
      this.removeBtnText.setColor("#fff0f0");
    } else {
      this.removeBtnBg.setFillStyle(0xffffff, 0.12);
      this.removeBtnText.setColor("#ffffff");
    }

    if (this.autoPlayerEnabled && this.canOperate) {
      this.autoBtnBg.setFillStyle(0x2f7d4f, 0.75);
      this.autoBtnText.setColor("#e8ffef");
    } else {
      this.autoBtnBg.setFillStyle(0xffffff, 0.12);
      this.autoBtnText.setColor("#ffffff");
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
      const bg = this.scene.add.rectangle(0, 0, cardW, cardH, 0x132236, 0.72).setOrigin(0, 0);
      const border = this.scene.add.rectangle(0, 0, cardW, cardH, 0x000000, 0).setOrigin(0, 0);
      border.setStrokeStyle(1, 0xa9c0df, 0.26);
      container.add([bg, border]);

      if (card) {
        const cost = getCardCost(card);
        const canPlay = this.canOperate && cost === 0;

        const artX = 6;
        const artY = 6;
        const artW = Math.min(52, cardW - 12);
        const artH = 54;

        const textureKey = getTextureKey(card);
        if (this.scene.textures.exists(textureKey)) {
          const art = this.scene.add.image(artX + artW / 2, artY + artH / 2, textureKey);
          art.setDisplaySize(artW, artH);
          container.add(art);
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
          bg.setFillStyle(0x1b314d, 0.9);
          border.setStrokeStyle(2, 0x9ddcff, 0.95);
        } else if (canPlay) {
          bg.setFillStyle(0x1a2c44, 0.84);
          border.setStrokeStyle(1, 0x8fb8ea, 0.5);
        }

        let holdTimer = null;
        let holdTriggered = false;

        bg.setInteractive({ useHandCursor: true });

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

        container.setAlpha(canPlay ? 1 : 0.6);
      } else {
        container.setAlpha(0.36);
      }

      this.container.add(container);
      this.cards.push(container);
    }
  }

  clearSelection() {
    this.selectedId = null;
  }

  destroy() {
    if (this.pileModal) this.pileModal.destroy(true);
    if (this.scene?.input && this._onWheel) this.scene.input.off("wheel", this._onWheel);
    this.container.destroy(true);
  }
}
