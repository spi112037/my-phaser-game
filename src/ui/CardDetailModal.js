const PHYLE_LABELS = {
  0: "未知",
  1: "人類",
  2: "亡靈",
  3: "野獸",
  4: "地精",
  5: "巨魔",
  6: "精靈",
  7: "獸人",
  8: "異界",
  9: "龍",
  10: "天使",
  11: "惡魔",
  100: "戰士",
  101: "遊俠",
  102: "法師",
  103: "牧師"
};

function toLines(text, maxCharsPerLine, maxLines) {
  const src = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const hard = src.split("\n");
  const rows = [];

  for (let i = 0; i < hard.length; i += 1) {
    const s = hard[i].trim();
    if (!s) {
      rows.push("");
      if (rows.length >= maxLines) break;
      continue;
    }

    let chunk = "";
    for (let j = 0; j < s.length; j += 1) {
      chunk += s[j];
      if (chunk.length >= maxCharsPerLine) {
        rows.push(chunk);
        chunk = "";
        if (rows.length >= maxLines) break;
      }
    }
    if (rows.length >= maxLines) break;
    if (chunk) rows.push(chunk);
    if (rows.length >= maxLines) break;
  }

  if (rows.length === maxLines) {
    const last = rows[maxLines - 1];
    rows[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : "…";
  }

  return rows.join("\n");
}

export default class CardDetailModal {
  constructor(scene) {
    this.scene = scene;
    this.hideDescriptionInBattle = String(scene?.sys?.settings?.key || "") === "BattleScene";

    const w = scene.scale.width;
    const h = scene.scale.height;

    const panelW = Math.min(900, Math.floor(w * 0.9));
    const panelH = Math.min(520, Math.floor(h * 0.85));
    const leftW = Math.floor(panelW * 0.36);
    const rightW = panelW - leftW - 24;

    this.container = scene.add.container(0, 0).setDepth(3000).setVisible(false);

    this.backdrop = scene.add
      .rectangle(0, 0, w, h, 0x000000, 0.66)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.backdrop.on("pointerup", () => this.hide());

    this.panel = scene.add
      .rectangle(w / 2, h / 2, panelW, panelH, 0x0b1220, 0.96)
      .setStrokeStyle(2, 0xffffff, 0.24)
      .setInteractive();

    const panelX = w / 2 - panelW / 2;
    const panelY = h / 2 - panelH / 2;

    this.leftCardFrame = scene.add
      .rectangle(panelX + 12 + leftW / 2, h / 2, leftW, panelH - 24, 0x131f34, 1)
      .setStrokeStyle(2, 0x9ddcff, 0.32);

    this.rightPanel = scene.add
      .rectangle(panelX + 12 + leftW + 12 + rightW / 2, h / 2, rightW, panelH - 24, 0x101925, 1)
      .setStrokeStyle(1, 0xffffff, 0.15);

    this.titleText = scene.add
      .text(panelX + 12 + leftW + 12 + rightW / 2, panelY + 22, "", { fontSize: "44px", color: "#ffffff" })
      .setOrigin(0.5, 0);

    this.typeText = scene.add
      .text(panelX + 12 + leftW + 12 + rightW / 2, panelY + 72, "", { fontSize: "24px", color: "#9ddcff" })
      .setOrigin(0.5, 0);

    this.raceText = scene.add
      .text(panelX + 12 + leftW + 12 + rightW / 2, panelY + 104, "", { fontSize: "22px", color: "#aee9b7" })
      .setOrigin(0.5, 0);

    this.statsText = scene.add
      .text(panelX + 20, panelY + panelH - 22, "", { fontSize: "28px", color: "#ffffff" })
      .setOrigin(0, 1);

    this.effectsTitleText = scene.add
      .text(panelX + 12 + leftW + 24, panelY + 150, "效果", { fontSize: "24px", color: "#ffdca8" })
      .setOrigin(0, 0);

    this.effectsText = scene.add
      .text(panelX + 12 + leftW + 24, panelY + 182, "", {
        fontSize: "14px",
        color: "#e8f2ff",
        lineSpacing: 1
      })
      .setOrigin(0, 0);

    this.descTitleText = scene.add
      .text(panelX + 12 + leftW + 24, panelY + 318, "描述", { fontSize: "24px", color: "#ffdca8" })
      .setOrigin(0, 0);

    this.descText = scene.add
      .text(panelX + 12 + leftW + 24, panelY + 350, "", {
        fontSize: "21px",
        color: "#d7e6ff",
        lineSpacing: 6
      })
      .setOrigin(0, 0);

    this.statusTitleText = scene.add
      .text(panelX + 12 + leftW + 24, panelY + 428, "目前狀態", { fontSize: "23px", color: "#ffdca8" })
      .setOrigin(0, 0);

    this.statusText = scene.add
      .text(panelX + 12 + leftW + 24, panelY + 458, "", {
        fontSize: "14px",
        color: "#bde6ff",
        lineSpacing: 1
      })
      .setOrigin(0, 0);

    this.tipText = scene.add
      .text(panelX + 12 + leftW + 12 + rightW / 2, panelY + panelH - 18, "點背景或按 ESC 關閉", {
        fontSize: "20px",
        color: "#8ea4c1"
      })
      .setOrigin(0.5, 1);

    this.artImage = null;
    this.artFallback = scene.add
      .text(panelX + 12 + leftW / 2, h / 2, "NO IMAGE", {
        fontSize: "28px",
        color: "#9db8ce"
      })
      .setOrigin(0.5);

    this._layout = { panelX, panelY, panelW, panelH, leftW, rightW };

    this.container.add([
      this.backdrop,
      this.panel,
      this.leftCardFrame,
      this.rightPanel,
      this.titleText,
      this.typeText,
      this.raceText,
      this.statsText,
      this.effectsTitleText,
      this.effectsText,
      this.descTitleText,
      this.descText,
      this.statusTitleText,
      this.statusText,
      this.tipText,
      this.artFallback
    ]);

    if (scene.input?.keyboard) {
      this.escKey = scene.input.keyboard.addKey("ESC");
      this.escKey.on("down", () => {
        if (this.container.visible) this.hide();
      });
    }
  }

  _normalizeEffects(rawEffects) {
    if (!Array.isArray(rawEffects)) return [];
    const seen = new Set();
    const out = [];

    for (let i = 0; i < rawEffects.length; i += 1) {
      const s = String(rawEffects[i] ?? "").trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
      if (out.length >= 5) break;
    }
    return out;
  }

  showFromCard(card) {
    if (!card) return;

    const effects = this._normalizeEffects([
      card.ability1,
      card.ability2,
      card.ability3,
      card.ability4,
      card.ability5,
      ...(Array.isArray(card.abilities) ? card.abilities : [])
    ]);

    this._show({
      name: card.name || card.id || "未知卡片",
      type: "手牌",
      phyle: Number(card.phyle ?? 0),
      description: card.description || "",
      effects,
      imageKey: `card_${card.id || ""}`,
      cost: Number(card.cost ?? card.baseCost ?? 0),
      hp: Number(card.unit?.hp ?? 0),
      atk: Number(card.unit?.atk ?? 0),
      maxHp: Number(card.unit?.hp ?? 0),
      statuses: []
    });
  }

  showFromUnit(unit) {
    if (!unit) return;

    const sideText = unit.side === "L" ? "我方場上單位" : "敵方場上單位";
    const effects = this._normalizeEffects([
      unit.ability1,
      unit.ability2,
      unit.ability3,
      unit.ability4,
      unit.ability5,
      ...(Array.isArray(unit.abilities) ? unit.abilities : [])
    ]);

    this._show({
      name: unit.name || "未知單位",
      type: sideText,
      phyle: Number(unit.phyle ?? 0),
      description: unit.description || "",
      effects,
      imageKey: `card_${unit.cardId || ""}`,
      cost: Number(unit.summonCost ?? 0),
      hp: Number(unit.hp ?? 0),
      atk: Number(unit.atk ?? 0),
      maxHp: Number(unit.maxHp ?? unit.hp ?? 0),
      statuses: Array.isArray(unit.activeStatuses) ? unit.activeStatuses : []
    });
  }

  _show(data) {
    const { name, type, phyle, description, effects, imageKey, cost, hp, atk, maxHp, statuses } = data;
    const { panelX, panelY, panelH, leftW, rightW } = this._layout;

    this.titleText.setText(String(name || "未知"));
    this.typeText.setText(String(type || ""));
    this.raceText.setText(`種族：${PHYLE_LABELS[Number(phyle)] || `未知(${Number(phyle)})`}`);
    this.statsText.setText(`費用:${cost}    HP:${hp}/${maxHp}    ATK:${atk}`);

    const rightBaseX = panelX + 12 + leftW + 24;
    const colGap = 18;
    const colW = Math.max(180, Math.floor((rightW - 24 - 24 - colGap) / 2));
    const effectsX = rightBaseX;
    const statusX = rightBaseX + colW + colGap;
    const sectionY = panelY + 150;

    this.statusTitleText.setX(statusX);
    this.statusTitleText.setY(sectionY);
    this.statusText.setX(statusX);
    this.statusText.setY(sectionY + 30);
    this.statusTitleText.setVisible(true);
    this.statusText.setVisible(true);

    this.effectsTitleText.setX(effectsX);
    this.effectsTitleText.setY(sectionY);
    this.effectsText.setX(effectsX);
    this.effectsText.setY(sectionY + 32);

    const effectRows = effects.length > 0 ? effects.map((x, idx) => `${idx + 1}. ${x}`).join("\n") : "無";
    this.effectsText.setText(toLines(effectRows, 20, this.hideDescriptionInBattle ? 26 : 14));

    const statusRows =
      Array.isArray(statuses) && statuses.length > 0 ? statuses.map((x) => `• ${x}`).join("\n") : "無";
    this.statusText.setText(toLines(statusRows, 20, this.hideDescriptionInBattle ? 26 : 14));

    if (this.hideDescriptionInBattle) {
      this.descTitleText.setVisible(false);
      this.descText.setVisible(false);
      this.descText.setText("");
    } else {
      this.descTitleText.setVisible(true);
      this.descText.setVisible(true);
      const descY = Math.max(
        panelY + 318,
        Math.max(this.effectsText.y + this.effectsText.height, this.statusText.y + this.statusText.height) + 14
      );
      this.descTitleText.setY(descY);
      this.descText.setY(descY + 32);
      this.descText.setText(toLines(description || "", 22, 5));

      if (this.descText.y + this.descText.height > panelY + panelH - 56) {
        this.descText.setText(toLines(description || "", 22, 3));
      }
    }

    if (this.artImage) {
      this.artImage.destroy();
      this.artImage = null;
    }

    if (imageKey && this.scene.textures.exists(imageKey)) {
      this.artFallback.setVisible(false);
      this.artImage = this.scene.add.image(panelX + 12 + leftW / 2, panelY + panelH / 2 - 12, imageKey);
      this.artImage.setDisplaySize(leftW - 24, panelH - 96);
      this.artImage.setDepth(this.container.depth + 1);
      this.container.add(this.artImage);
    } else {
      this.artFallback.setVisible(true);
    }

    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }

  destroy() {
    if (this.escKey) this.escKey.destroy();
    this.container.destroy(true);
  }
}
