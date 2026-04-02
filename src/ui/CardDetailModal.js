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

    const panelW = Math.min(980, Math.floor(w * 0.9));
    const panelH = Math.min(560, Math.floor(h * 0.88));
    const leftW = Math.floor(panelW * 0.35);
    const rightW = panelW - leftW - 28;

    this.container = scene.add.container(0, 0).setDepth(3000).setVisible(false);

    this.backdrop = scene.add
      .rectangle(0, 0, w, h, 0x000000, 0.72)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.backdrop.on("pointerup", () => this.hide());

    const panelX = w / 2 - panelW / 2;
    const panelY = h / 2 - panelH / 2;

    this.panelGlow = scene.add.ellipse(w / 2, h / 2, panelW + 60, panelH + 40, 0x89d6ff, 0.08);
    this.panelShadow = scene.add.rectangle(w / 2, h / 2 + 10, panelW, panelH, 0x000000, 0.4);
    this.panel = scene.add
      .rectangle(w / 2, h / 2, panelW, panelH, 0x0b1220, 0.97)
      .setStrokeStyle(1.8, 0x9fdcff, 0.42)
      .setInteractive();
    this.panelTopLine = scene.add.rectangle(w / 2, panelY + 18, panelW - 42, 2, 0xf1fbff, 0.14);

    this.leftCardFrame = scene.add
      .rectangle(panelX + 14 + leftW / 2, h / 2, leftW, panelH - 28, 0x121f35, 0.94)
      .setStrokeStyle(1.8, 0x9ddcff, 0.34);
    this.leftArtGlow = scene.add.ellipse(panelX + 14 + leftW / 2, h / 2 - 14, leftW - 24, panelH - 100, 0x6fcfff, 0.07);

    this.rightPanel = scene.add
      .rectangle(panelX + 14 + leftW + 14 + rightW / 2, h / 2, rightW, panelH - 28, 0x101925, 0.96)
      .setStrokeStyle(1.2, 0xffffff, 0.12);

    this.titleText = scene.add
      .text(panelX + 14 + leftW + 14 + 18, panelY + 26, "", { fontSize: "38px", color: "#ffffff", fontStyle: "bold", wordWrap: { width: rightW - 36 } })
      .setOrigin(0, 0);

    this.typeBadge = scene.add.rectangle(panelX + 14 + leftW + 14 + 64, panelY + 86, 108, 28, 0x214a73, 0.92).setStrokeStyle(1.4, 0xdff3ff, 0.34);
    this.typeText = scene.add
      .text(panelX + 14 + leftW + 14 + 64, panelY + 86, "", { fontSize: "16px", color: "#eff8ff", fontStyle: "bold" })
      .setOrigin(0.5);

    this.raceBadge = scene.add.rectangle(panelX + 14 + leftW + 14 + 196, panelY + 86, 132, 28, 0x274831, 0.92).setStrokeStyle(1.4, 0xe4ffe8, 0.28);
    this.raceText = scene.add
      .text(panelX + 14 + leftW + 14 + 196, panelY + 86, "", { fontSize: "16px", color: "#dcffe4", fontStyle: "bold" })
      .setOrigin(0.5);

    this.statsPanel = scene.add.rectangle(panelX + 14 + leftW / 2, panelY + panelH - 48, leftW - 28, 56, 0x08111c, 0.9).setStrokeStyle(1.4, 0xbfe3ff, 0.22);
    this.statsText = scene.add
      .text(panelX + 28, panelY + panelH - 48, "", { fontSize: "22px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0, 0.5);

    this.effectsTitleText = scene.add
      .text(panelX + 14 + leftW + 28, panelY + 132, "核心效果", { fontSize: "22px", color: "#ffdca8", fontStyle: "bold" })
      .setOrigin(0, 0);
    this.effectsPanel = scene.add.rectangle(panelX + 14 + leftW + 28 + (rightW - 54) / 2, panelY + 215, rightW - 54, 126, 0x0d1a2b, 0.92).setStrokeStyle(1.2, 0x92cfff, 0.16);
    this.effectsText = scene.add
      .text(panelX + 14 + leftW + 44, panelY + 162, "", {
        fontSize: "18px",
        color: "#eef6ff",
        lineSpacing: 8,
        wordWrap: { width: rightW - 86 }
      })
      .setOrigin(0, 0);

    this.descTitleText = scene.add
      .text(panelX + 14 + leftW + 28, panelY + 286, "卡牌描述", { fontSize: "22px", color: "#ffdca8", fontStyle: "bold" })
      .setOrigin(0, 0);
    this.descPanel = scene.add.rectangle(panelX + 14 + leftW + 28 + (rightW - 54) / 2, panelY + 370, rightW - 54, 118, 0x0d1a2b, 0.88).setStrokeStyle(1.2, 0x92cfff, 0.12);
    this.descText = scene.add
      .text(panelX + 14 + leftW + 44, panelY + 316, "", {
        fontSize: "20px",
        color: "#d7e6ff",
        lineSpacing: 8,
        wordWrap: { width: rightW - 86 }
      })
      .setOrigin(0, 0);

    this.statusTitleText = scene.add
      .text(panelX + 14 + leftW + 28, panelY + 428, "目前狀態", { fontSize: "22px", color: "#ffdca8", fontStyle: "bold" })
      .setOrigin(0, 0);
    this.statusPanel = scene.add.rectangle(panelX + 14 + leftW + 28 + (rightW - 54) / 2, panelY + 488, rightW - 54, 72, 0x0d1a2b, 0.88).setStrokeStyle(1.2, 0x92cfff, 0.1);
    this.statusText = scene.add
      .text(panelX + 14 + leftW + 44, panelY + 458, "", {
        fontSize: "17px",
        color: "#bde6ff",
        lineSpacing: 6,
        wordWrap: { width: rightW - 86 }
      })
      .setOrigin(0, 0);

    this.tipText = scene.add
      .text(panelX + 14 + leftW + 14 + rightW / 2, panelY + panelH - 18, "點背景或按 ESC 關閉", {
        fontSize: "16px",
        color: "#8ea4c1"
      })
      .setOrigin(0.5, 1);

    this.artImage = null;
    this.artFallback = scene.add
      .text(panelX + 14 + leftW / 2, h / 2 - 12, "NO IMAGE", {
        fontSize: "28px",
        color: "#9db8ce",
        fontStyle: "bold"
      })
      .setOrigin(0.5);

    this._layout = { panelX, panelY, panelW, panelH, leftW, rightW };

    this.container.add([
      this.backdrop,
      this.panelGlow,
      this.panelShadow,
      this.panel,
      this.panelTopLine,
      this.leftCardFrame,
      this.leftArtGlow,
      this.rightPanel,
      this.titleText,
      this.typeBadge,
      this.typeText,
      this.raceBadge,
      this.raceText,
      this.statsPanel,
      this.statsText,
      this.effectsTitleText,
      this.effectsPanel,
      this.effectsText,
      this.descTitleText,
      this.descPanel,
      this.descText,
      this.statusTitleText,
      this.statusPanel,
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
    this.raceText.setText(PHYLE_LABELS[Number(phyle)] || `未知(${Number(phyle)})`);
    this.statsText.setText(`費用 ${cost}   HP ${hp}/${maxHp}   ATK ${atk}`);

    const effectRows = effects.length > 0 ? effects.map((x, idx) => `${idx + 1}. ${x}`).join("\n") : "無";
    this.effectsText.setText(toLines(effectRows, 24, this.hideDescriptionInBattle ? 7 : 5));

    const statusRows = Array.isArray(statuses) && statuses.length > 0 ? statuses.map((x) => `• ${x}`).join("\n") : "無特殊狀態";
    this.statusText.setText(toLines(statusRows, 26, 3));

    if (this.hideDescriptionInBattle) {
      this.descTitleText.setVisible(false);
      this.descPanel.setVisible(false);
      this.descText.setVisible(false);
      this.descText.setText("");
      this.statusTitleText.setY(panelY + 286);
      this.statusPanel.setY(panelY + 346);
      this.statusText.setY(panelY + 316);
    } else {
      this.descTitleText.setVisible(true);
      this.descPanel.setVisible(true);
      this.descText.setVisible(true);
      this.descTitleText.setY(panelY + 286);
      this.descPanel.setY(panelY + 370);
      this.descText.setY(panelY + 316);
      this.descText.setText(toLines(description || "", 24, 4));
      this.statusTitleText.setY(panelY + 428);
      this.statusPanel.setY(panelY + 488);
      this.statusText.setY(panelY + 458);
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
