// 檔案路徑：src/ui/HandUI.js
// 召喚士兵版手牌 UI：點卡 -> 進入放置模式（由 BattleScene 控制）
export default class HandUI {
  constructor(scene, x, y, width, height, onSelectCard, onEndTurn) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.onSelectCard = onSelectCard;
    this.onEndTurn = onEndTurn;

    this.actor = null;
    this.isPlayerTurn = false;
    this.selectedCardId = null;

    this.container = scene.add.container(x, y);

    this.bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.22).setOrigin(0, 0);
    this.container.add(this.bg);

    this.title = scene.add.text(12, 10, "手牌（點卡後點格子召喚）", { fontSize: "16px", color: "#ffffff" });
    this.container.add(this.title);

    this.turnText = scene.add.text(width - 360, 10, "", { fontSize: "16px", color: "#9ddcff" });
    this.container.add(this.turnText);

    this.endTurnBtnBg = scene.add.rectangle(width - 110, height - 30, 180, 36, 0xffffff, 0.12)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.endTurnBtnText = scene.add.text(width - 110, height - 30, "結束回合", {
      fontSize: "16px",
      color: "#ffffff"
    }).setOrigin(0.5, 0.5);

    this.endTurnBtnBg.on("pointerup", () => {
      if (!this.isPlayerTurn) return;
      if (typeof this.onEndTurn === "function") this.onEndTurn();
    });

    this.container.add(this.endTurnBtnBg);
    this.container.add(this.endTurnBtnText);

    this.cardItems = [];
    this.hintText = scene.add.text(12, height - 34, "", { fontSize: "14px", color: "#ffdca8" });
    this.container.add(this.hintText);
  }

  setActor(actor, isPlayerTurn) {
    this.actor = actor;
    this.isPlayerTurn = Boolean(isPlayerTurn);
    this.render();
  }

  setSelectedCard(card) {
    this.selectedCardId = card ? card.id : null;
    this.render();
  }

  render() {
    for (let i = 0; i < this.cardItems.length; i += 1) this.cardItems[i].destroy(true);
    this.cardItems = [];

    if (!this.actor) {
      this.turnText.setText("");
      this.hintText.setText("");
      this.endTurnBtnBg.setAlpha(0.2);
      this.endTurnBtnText.setAlpha(0.2);
      return;
    }

    const a = this.actor;
    this.turnText.setText(`${this.isPlayerTurn ? "你的回合" : "對手回合"} | 能量 ${a.energy}/${a.maxEnergy}`);

    const activeAlpha = this.isPlayerTurn ? 1 : 0.25;
    this.endTurnBtnBg.setAlpha(activeAlpha);
    this.endTurnBtnText.setAlpha(activeAlpha);

    if (!this.isPlayerTurn) {
      this.hintText.setText("等待對手行動…");
    } else if (this.selectedCardId) {
      this.hintText.setText(`已選擇：${this.selectedCardId}（請點選戰場格子放置）`);
    } else {
      this.hintText.setText("請先點選一張召喚卡，再點戰場格子。");
    }

    const cards = Array.isArray(a.ready) ? a.ready : [];

    const padding = 12;
    const cardW = 170;
    const cardH = 78;
    const gap = 10;

    let cx = padding;
    let cy = 42;

    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      const cost = Number(card.cost ?? 1);
      const affordable = a.energy >= cost;

      const isSelected = this.selectedCardId && card.id === this.selectedCardId;

      const item = this._createCardButton(cx, cy, cardW, cardH, card, affordable, isSelected);
      this.container.add(item);
      this.cardItems.push(item);

      cx += cardW + gap;
      if (cx + cardW + padding > this.width - 220) {
        cx = padding;
        cy += cardH + gap;
      }

      if (cy + cardH > this.height - 50) break;
    }
  }

  _createCardButton(x, y, w, h, card, affordable, isSelected) {
    const scene = this.scene;
    const cost = Number(card.cost ?? 1);

    const container = scene.add.container(x, y);

    const bgAlpha = isSelected ? 0.22 : 0.10;
    const bg = scene.add.rectangle(0, 0, w, h, 0xffffff, bgAlpha).setOrigin(0, 0);
    const border = scene.add.rectangle(0, 0, w, h, 0x000000, 0).setOrigin(0, 0);
    border.setStrokeStyle(1, isSelected ? 0x9ddcff : 0xffffff, isSelected ? 0.9 : 0.18);

    const name = scene.add.text(10, 8, String(card.name || card.id), {
      fontSize: "14px",
      color: "#ffffff"
    });

    const typeText = scene.add.text(10, 30, `類型: ${card.type}`, {
      fontSize: "12px",
      color: "#cfe8ff"
    });

    const costText = scene.add.text(w - 10, 8, `費用 ${cost}`, {
      fontSize: "12px",
      color: "#ffdca8"
    }).setOrigin(1, 0);

    let desc = "";
    if (card.type === "summon" && card.unit) {
      desc = `HP:${card.unit.hp} ATK:${card.unit.atk} RNG:${card.unit.range}`;
    } else {
      desc = `POWER:${Number(card.power ?? 0)}`;
    }

    const descText = scene.add.text(10, 50, desc, { fontSize: "12px", color: "#ffffff" });

    container.add(bg);
    container.add(border);
    container.add(name);
    container.add(typeText);
    container.add(costText);
    container.add(descText);

    const canClick = this.isPlayerTurn && affordable;

    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => border.setStrokeStyle(1, 0x9ddcff, 0.85));
    bg.on("pointerout", () => border.setStrokeStyle(1, isSelected ? 0x9ddcff : 0xffffff, isSelected ? 0.9 : 0.18));
    bg.on("pointerup", () => {
      if (!canClick) return;
      if (typeof this.onSelectCard === "function") this.onSelectCard(card);
    });

    container.setAlpha(canClick ? 1 : 0.35);

    return container;
  }

  destroy() {
    this.container.destroy(true);
  }
}
