import Phaser from "phaser";
import flameCardsBest from "../data/flameCardsBest.json";

function safe(v) {
  return String(v || "").trim();
}

function normalizeEffectText(text) {
  return safe(text).replace(/\s+/g, " ");
}

function effectKey(text) {
  const s = normalizeEffectText(text);
  if (!s) return "";
  return safe(s.split(/[：:]/)[0]);
}

function effectFamilyKey(key) {
  const k = safe(key);
  if (!k) return "";
  return k.replace(/\d+$/g, "").trim() || k;
}

function collectEffects(card) {
  const out = [
    safe(card?.ability1),
    safe(card?.ability2),
    safe(card?.ability3),
    safe(card?.ability4),
    safe(card?.ability5)
  ].filter(Boolean);

  if (Array.isArray(card?.abilities)) {
    for (let i = 0; i < card.abilities.length; i += 1) {
      const s = safe(card.abilities[i]);
      if (s) out.push(s);
    }
  }
  return out;
}

function classifyEffect(raw) {
  const s = normalizeEffectText(raw);
  const tags = new Set();
  const sNoSummoner = s.replace(/召唤者|召喚者/g, "");

  const isSummonByAround =
    /在周围.*召唤/.test(s) ||
    /在周圍.*召喚/.test(s) ||
    /在.*周围.*召唤/.test(s) ||
    /在.*周圍.*召喚/.test(s) ||
    /周围.*召唤/.test(s) ||
    /周圍.*召喚/.test(s);

  const isSummonByTransform =
    /(我方|敌方|友方|我方其他|敌方其他).*(死亡|阵亡|死亡時|陣亡時).*(转化|轉化|召唤|召喚|变成|變成|生成)/.test(sNoSummoner) ||
    /(死亡|阵亡|死亡時|陣亡時).*(转化|轉化|召唤|召喚|变成|變成|生成).*(我方|敌方|友方|我方其他|敌方其他)/.test(sNoSummoner);

  const isGeneralSummon =
    /(召唤|召喚|生成|衍生|召出|喚出|變成|变成|分身|幻影|傀儡|token)/i.test(sNoSummoner) &&
    !/(仅召唤者|僅召喚者|召唤者抽取|召喚者抽取|召唤者准备|召喚者準備)/.test(s);

  if (isSummonByAround || isSummonByTransform || isGeneralSummon) tags.add("type_summon");

  if (/光环|在场上存在|场上每有|全体友方|其他友方士兵获得/.test(s)) tags.add("type_aura");

  if (/造成.*伤害|攻击造成|受到.*伤害|伤害\+|伤害-/.test(s)) tags.add("type_damage");

  if (/治疗|恢复|回复|免疫|无法|加速|减速|护盾|守护|复活|抽取|准备值|控制/.test(s)) {
    tags.add("type_support");
  }

  if (/火焰|燃烧|灼烧/.test(s)) tags.add("dmg_fire");
  if (/冰霜|寒冰|冰冻/.test(s)) tags.add("dmg_frost");
  if (/闪电|雷电|雷击/.test(s)) tags.add("dmg_lightning");
  if (/神圣|圣光|圣焰/.test(s)) tags.add("dmg_holy");
  if (/暗影|黑暗|诅咒|幽冥/.test(s)) tags.add("dmg_shadow");
  if (/毒|中毒/.test(s)) tags.add("dmg_poison");

  if (/物理|普攻|近战|远程/.test(s) || (tags.has("type_damage") && !["dmg_fire", "dmg_frost", "dmg_lightning", "dmg_holy", "dmg_shadow", "dmg_poison"].some((x) => tags.has(x)))) {
    tags.add("dmg_physical");
  }

  if (/召唤者|我方英雄|我方牌库|自己牌库|自己准备栏|抽取|返回牌库/.test(s)) tags.add("assist_player");
  if (/敌方|敌方英雄|敌方牌库|敌方准备栏/.test(s)) tags.add("assist_enemy");
  if (/士兵|单位|友方其他士兵|敌方士兵/.test(s)) tags.add("assist_soldier");
  if (/准备栏|准备值/.test(s)) tags.add("assist_ready");

  if (/(攻击\+|生命\+|治疗|恢复|回复|免疫|守护|护盾|加速|抽取|复活)/.test(s)) tags.add("polarity_positive");
  if (/(攻击-|生命-|无法行动|眩晕|减速|中毒|沉默|禁疗|控制敌方)/.test(s)) tags.add("polarity_negative");

  return [...tags];
}

function buildIndex() {
  const cards = Array.isArray(flameCardsBest) ? flameCardsBest : (flameCardsBest.cards || []);
  const byKey = new Map();

  for (let i = 0; i < cards.length; i += 1) {
    const c = cards[i];
    const effects = collectEffects(c);
    for (let j = 0; j < effects.length; j += 1) {
      const raw = effects[j];
      const key = effectKey(raw);
      if (!key) continue;

      const hit = byKey.get(key) || {
        key,
        familyKey: effectFamilyKey(key),
        count: 0,
        sample: normalizeEffectText(raw),
        tags: new Set(),
        members: []
      };

      hit.count += 1;
      const effectTags = classifyEffect(raw);
      for (let k = 0; k < effectTags.length; k += 1) hit.tags.add(effectTags[k]);

      hit.members.push({
        cardId: safe(c.id),
        cardName: safe(c.name),
        image: safe(c.image),
        effect: normalizeEffectText(raw)
      });
      byKey.set(key, hit);
    }
  }

  return [...byKey.values()]
    .map((x) => ({ ...x, tags: [...x.tags] }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

const CHIP_GROUPS = [
  {
    key: "type",
    title: "类型",
    options: [
      { id: "all", label: "全部" },
      { id: "type_damage", label: "伤害" },
      { id: "type_support", label: "辅助" },
      { id: "type_summon", label: "召唤" },
      { id: "type_aura", label: "光环" }
    ]
  },
  {
    key: "damage",
    title: "伤害属性",
    options: [
      { id: "all", label: "全部" },
      { id: "dmg_physical", label: "物理" },
      { id: "dmg_fire", label: "火焰" },
      { id: "dmg_frost", label: "冰霜" },
      { id: "dmg_lightning", label: "闪电" },
      { id: "dmg_holy", label: "神圣" },
      { id: "dmg_shadow", label: "暗影" },
      { id: "dmg_poison", label: "毒" }
    ]
  },
  {
    key: "assist",
    title: "辅助对象",
    options: [
      { id: "all", label: "全部" },
      { id: "assist_player", label: "对玩家" },
      { id: "assist_enemy", label: "对敌方" },
      { id: "assist_soldier", label: "对士兵" },
      { id: "assist_ready", label: "对准备栏" }
    ]
  },
  {
    key: "polarity",
    title: "效果极性",
    options: [
      { id: "all", label: "全部" },
      { id: "polarity_positive", label: "正面" },
      { id: "polarity_negative", label: "负面" }
    ]
  }
];

export default class EffectGlossaryScene extends Phaser.Scene {
  constructor() {
    super("EffectGlossaryScene");

    this.index = [];
    this.filtered = [];
    this.page = 0;
    this.pageSize = 8;
    this.rowViews = [];

    this.searchQuery = "";
    this.appliedSearchQuery = "";
    this.searchInputEl = null;
    this._searchDomRect = null;

    this.selected = { type: "all", damage: "all", assist: "all", polarity: "all" };
    this._textureLoading = false;
    this.chipViews = [];
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0x0b1422);
    this.add.text(36, 24, "效果百科", { fontSize: "42px", color: "#ffffff" });
    this.add.text(36, 72, "可用标签筛选，并可搜效果名称。点列表项目可查看士兵清单。", {
      fontSize: "16px",
      color: "#9dc4e6"
    });

    this._makeButton(w - 100, 52, "返回", () => this.scene.start("MenuScene"), 130, 44, "16px");

    this.index = buildIndex();

    this._mountSearchInputDom(36, 104, 500, 36);
    this._makeButton(590, 122, "搜索", () => this._applySearch(), 84, 34, "16px");
    this._makeButton(688, 122, "清除", () => {
      this.searchQuery = "";
      this.appliedSearchQuery = "";
      if (this.searchInputEl) this.searchInputEl.value = "";
      this.page = 0;
      this._refresh();
    }, 84, 34, "16px");

    let chipY = 156;
    for (let i = 0; i < CHIP_GROUPS.length; i += 1) {
      chipY = this._createChipGroup(36, chipY, CHIP_GROUPS[i]) + 12;
    }

    this.panelY = chipY;
    this.panelH = h - this.panelY - 24;
    this.panelX = 36;
    this.panelW = w - 72;

    this.add.rectangle(
      this.panelX + this.panelW / 2,
      this.panelY + this.panelH / 2,
      this.panelW,
      this.panelH,
      0x101925,
      0.96
    ).setStrokeStyle(1, 0xffffff, 0.16);

    this.summaryText = this.add.text(this.panelX + 14, this.panelY + 12, "", { fontSize: "22px", color: "#cfe8ff" });

    const pagerY = this.panelY + this.panelH - 24;
    this.prevBtn = this._makeButton(this.panelX + this.panelW - 220, pagerY, "上一页", () => this._turnPage(-1), 110, 34, "16px");
    this.nextBtn = this._makeButton(this.panelX + this.panelW - 90, pagerY, "下一页", () => this._turnPage(1), 110, 34, "16px");
    this.pageText = this.add.text(this.panelX + this.panelW - 320, pagerY - 10, "", { fontSize: "16px", color: "#9dc4e6" });

    this.listTop = this.panelY + 50;
    this.listBottom = pagerY - 16;

    this.input.on("wheel", (_p, _go, _dx, dy) => {
      if (dy > 0) this._turnPage(1);
      else if (dy < 0) this._turnPage(-1);
    });

    this.events.once("shutdown", () => this._unmountSearchInputDom());
    this.events.once("destroy", () => this._unmountSearchInputDom());

    this._refresh();
  }

  _mountSearchInputDom(x, y, w, h) {
    this._unmountSearchInputDom();

    const oldInputs = Array.from(document.querySelectorAll("input[data-effect-glossary='1']"));
    oldInputs.forEach((el) => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });

    const el = document.createElement("input");
    el.type = "text";
    el.value = this.searchQuery;
    el.placeholder = "输入效果名称后按 搜索";
    el.setAttribute("data-effect-glossary", "1");

    el.style.position = "fixed";
    el.style.boxSizing = "border-box";
    el.style.padding = "6px 12px";
    el.style.border = "1px solid rgba(255,255,255,0.3)";
    el.style.borderRadius = "4px";
    el.style.background = "rgba(10,20,34,0.45)";
    el.style.color = "#e8f2ff";
    el.style.fontSize = "16px";
    el.style.zIndex = "70";
    el.style.outline = "none";

    el.addEventListener("input", () => {
      this.searchQuery = String(el.value || "");
    });

    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") this._applySearch();
      if (ev.key === "Escape") el.blur();
    });

    document.body.appendChild(el);
    this.searchInputEl = el;
    this._searchDomRect = { x, y, w, h };
    this._positionSearchInputDom();
    this.scale.on("resize", this._positionSearchInputDom, this);
  }

  _positionSearchInputDom() {
    if (!this.searchInputEl || !this._searchDomRect) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const sx = rect.width / this.scale.width;
    const sy = rect.height / this.scale.height;
    const { x, y, w, h } = this._searchDomRect;

    this.searchInputEl.style.left = `${rect.left + x * sx}px`;
    this.searchInputEl.style.top = `${rect.top + y * sy}px`;
    this.searchInputEl.style.width = `${w * sx}px`;
    this.searchInputEl.style.height = `${h * sy}px`;
  }

  _unmountSearchInputDom() {
    this.scale.off("resize", this._positionSearchInputDom, this);
    if (this.searchInputEl && this.searchInputEl.parentNode) {
      this.searchInputEl.parentNode.removeChild(this.searchInputEl);
    }
    this.searchInputEl = null;
    this._searchDomRect = null;
  }

  _applySearch() {
    if (this.searchInputEl) this.searchQuery = String(this.searchInputEl.value || "");
    this.appliedSearchQuery = this.searchQuery;
    this.page = 0;
    this._refresh();
  }

  _createChipGroup(x, y, group) {
    this.add.text(x, y, `${group.title}：`, { fontSize: "26px", color: "#ffdca8" });

    let cx = x + 108;
    let cy = y + 12;
    const maxW = this.scale.width - 56;

    for (let i = 0; i < group.options.length; i += 1) {
      const op = group.options[i];
      const bw = Math.max(74, 24 + op.label.length * 16);
      if (cx + bw > maxW) {
        cx = x + 108;
        cy += 40;
      }

      const bg = this.add.rectangle(cx + bw / 2, cy, bw, 30, 0xffffff, 0.14)
        .setStrokeStyle(1, 0xffffff, 0.25)
        .setInteractive({ useHandCursor: true });
      const t = this.add.text(cx + bw / 2, cy, op.label, { fontSize: "18px", color: "#ffffff" }).setOrigin(0.5);
      const chip = { groupKey: group.key, optionId: op.id, bg, t };
      this.chipViews.push(chip);
      this._applyChipStyle(chip, false);

      bg.on("pointerup", () => {
        this.selected[group.key] = op.id;
        this.page = 0;
        this._refresh();
      });

      bg.on("pointerover", () => this._applyChipStyle(chip, true));
      bg.on("pointerout", () => this._applyChipStyle(chip, false));

      this.rowViews.push(bg, t);
      cx += bw + 10;
    }

    return cy + 18;
  }

  _applyChipStyle(chip, hover = false) {
    const isOn = this.selected[chip.groupKey] === chip.optionId;
    if (isOn) {
      chip.bg.setFillStyle(0x2d7dd2, hover ? 0.75 : 0.62);
      chip.bg.setStrokeStyle(2, 0x9ddcff, 0.95);
      chip.t.setColor("#ffffff");
      return;
    }
    chip.bg.setFillStyle(hover ? 0x9ddcff : 0xffffff, hover ? 0.24 : 0.14);
    chip.bg.setStrokeStyle(1, 0xffffff, 0.25);
    chip.t.setColor("#d9e7f8");
  }

  _refreshChipStyles() {
    for (let i = 0; i < this.chipViews.length; i += 1) {
      this._applyChipStyle(this.chipViews[i], false);
    }
  }

  _match(item) {
    const checks = [this.selected.type, this.selected.damage, this.selected.assist, this.selected.polarity];
    for (let i = 0; i < checks.length; i += 1) {
      const c = checks[i];
      if (c === "all") continue;
      if (!item.tags.includes(c)) return false;
    }

    const q = this.appliedSearchQuery.toLowerCase().trim();
    if (q) {
      const hit =
        item.key.toLowerCase().includes(q) ||
        item.familyKey.toLowerCase().includes(q) ||
        item.sample.toLowerCase().includes(q);
      if (!hit) return false;
    }

    return true;
  }

  _clearListRows() {
    if (!this.listRowViews) this.listRowViews = [];
    for (let i = 0; i < this.listRowViews.length; i += 1) this.listRowViews[i].destroy(true);
    this.listRowViews = [];
  }

  _renderRows(rows, startIndex) {
    this._clearListRows();

    const x = this.panelX + 10;
    const w = this.panelW - 20;
    const rowH = 54;
    let y = this.listTop;

    if (rows.length === 0) {
      const t = this.add.text(x, y, "没有符合条件的效果。", { fontSize: "22px", color: "#e8f2ff" });
      this.listRowViews.push(t);
      return;
    }

    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const idx = startIndex + i + 1;

      const bg = this.add.rectangle(x + w / 2, y + rowH / 2, w, rowH, 0xffffff, 0.06)
        .setStrokeStyle(1, 0xffffff, 0.12)
        .setInteractive({ useHandCursor: true });

      const tagsText = r.tags.join(", ");
      const line = `${idx}. ${r.key} (${r.count}) [${tagsText}]`;
      const sample = `例：${r.sample}`;

      const t1 = this.add.text(x + 12, y + 4, line, {
        fontSize: "20px",
        color: "#ffffff",
        wordWrap: { width: w - 24 }
      });

      const t2 = this.add.text(x + 12, y + 28, sample, {
        fontSize: "16px",
        color: "#bcd6f1",
        wordWrap: { width: w - 24 }
      });

      bg.on("pointerover", () => bg.setFillStyle(0x2d7dd2, 0.2));
      bg.on("pointerout", () => bg.setFillStyle(0xffffff, 0.06));
      bg.on("pointerup", () => this._openEffectFamilyPanel(r));

      this.listRowViews.push(bg, t1, t2);
      y += rowH + 8;
    }
  }

  _loadCardTextures(entries, onComplete) {
    if (this._textureLoading) return;

    let queued = 0;
    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i];
      const key = `card_${e.cardId}`;
      if (!e.image || this.textures.exists(key)) continue;
      this.load.image(key, e.image);
      queued += 1;
    }

    if (queued <= 0) return;

    this._textureLoading = true;
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this._textureLoading = false;
      if (typeof onComplete === "function") onComplete();
    });
    this.load.start();
  }

  _openEffectFamilyPanel(item) {
    const family = item.familyKey;
    const matched = this.index.filter((x) => x.familyKey === family);

    const map = new Map();
    for (let i = 0; i < matched.length; i += 1) {
      const m = matched[i];
      for (let j = 0; j < m.members.length; j += 1) {
        const mem = m.members[j];
        const uniq = `${mem.cardId}|${m.key}`;
        if (!map.has(uniq)) {
          map.set(uniq, {
            cardId: mem.cardId,
            cardName: mem.cardName,
            image: mem.image,
            key: m.key
          });
        }
      }
    }

    const entries = [...map.values()].sort((a, b) => a.key.localeCompare(b.key) || a.cardName.localeCompare(b.cardName));

    const w = this.scale.width;
    const h = this.scale.height;

    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.62).setInteractive();

    const pw = Math.min(1180, w - 60);
    const ph = Math.min(760, h - 50);
    const panel = this.add.rectangle(w / 2, h / 2, pw, ph, 0x0f1828, 0.98).setStrokeStyle(1, 0xffffff, 0.22);

    const title = this.add.text(w / 2, h / 2 - ph / 2 + 14, `效果家族：${family}`, {
      fontSize: "34px",
      color: "#ffffff"
    }).setOrigin(0.5, 0);

    const sub = this.add.text(
      w / 2,
      h / 2 - ph / 2 + 58,
      `雷前词条：${item.key} ｜ 家族词条：${matched.length} ｜ 士兵数：${entries.length}`,
      { fontSize: "20px", color: "#9dc4e6" }
    ).setOrigin(0.5, 0);

    const gridX = w / 2 - pw / 2 + 20;
    const gridY = h / 2 - ph / 2 + 98;
    const gridW = pw - 64;
    const gridH = ph - 168;
    const gridBg = this.add.rectangle(gridX + gridW / 2, gridY + gridH / 2, gridW, gridH, 0xffffff, 0.03).setOrigin(0.5);

    const cardsContainer = this.add.container(0, 0);
    const cols = 4;
    const rowsPerPage = 4;
    const gap = 10;
    const cellW = Math.floor((gridW - gap * (cols - 1) - 16) / cols);
    const cellH = Math.floor((gridH - gap * (rowsPerPage - 1) - 16) / rowsPerPage);

    const totalRows = Math.ceil(entries.length / cols);
    const maxRowOffset = Math.max(0, totalRows - rowsPerPage);
    const state = { rowOffset: 0, dragging: false };

    const trackX = gridX + gridW - 8;
    const track = this.add.rectangle(trackX, gridY + gridH / 2, 12, gridH - 16, 0xffffff, 0.14)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const thumbMinH = 32;
    const thumbH = Math.max(thumbMinH, Math.floor((gridH - 16) * Math.min(1, rowsPerPage / Math.max(1, totalRows))));
    const thumb = this.add.rectangle(trackX, gridY + 8 + thumbH / 2, 12, thumbH, 0x9ddcff, 0.8)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const updateThumb = () => {
      if (maxRowOffset <= 0) {
        thumb.y = gridY + 8 + thumbH / 2;
        return;
      }
      const t = state.rowOffset / maxRowOffset;
      thumb.y = gridY + 8 + thumbH / 2 + t * ((gridH - 16) - thumbH);
    };

    const renderGrid = () => {
      cardsContainer.removeAll(true);
      const start = state.rowOffset * cols;
      const visible = entries.slice(start, start + cols * rowsPerPage);
      this._loadCardTextures(visible, renderGrid);

      for (let i = 0; i < visible.length; i += 1) {
        const e = visible[i];
        const r = Math.floor(i / cols);
        const c = i % cols;

        const x = gridX + 8 + c * (cellW + gap);
        const y = gridY + 8 + r * (cellH + gap);

        const bg = this.add.rectangle(x + cellW / 2, y + cellH / 2, cellW, cellH, 0xffffff, 0.06)
          .setStrokeStyle(1, 0xffffff, 0.2);

        const artH = cellH - 66;
        const artY = y + 8;
        const tex = `card_${e.cardId}`;

        cardsContainer.add(bg);

        if (this.textures.exists(tex)) {
          const img = this.add.image(x + cellW / 2, artY + artH / 2, tex);
          const scale = Math.min((cellW - 12) / img.width, artH / img.height);
          img.setScale(scale);
          cardsContainer.add(img);
        } else {
          const no = this.add.rectangle(x + cellW / 2, artY + artH / 2, cellW - 12, artH, 0x223548, 0.9)
            .setStrokeStyle(1, 0xffffff, 0.15);
          const txt = this.add.text(x + cellW / 2, artY + artH / 2, "NO IMAGE", {
            fontSize: "16px",
            color: "#b9c9d8"
          }).setOrigin(0.5);
          cardsContainer.add([no, txt]);
        }

        const name = this.add.text(x + 8, y + cellH - 42, e.cardName, {
          fontSize: "18px",
          color: "#ffffff",
          wordWrap: { width: cellW - 16 }
        });

        const code = this.add.text(x + 8, y + cellH - 18, `${e.cardId} [${e.key}]`, {
          fontSize: "14px",
          color: "#9dc4e6",
          wordWrap: { width: cellW - 16 }
        });

        cardsContainer.add([name, code]);
      }

      updateThumb();
    };

    const scrollRows = (delta) => {
      if (maxRowOffset <= 0) return;
      const next = Math.max(0, Math.min(maxRowOffset, state.rowOffset + delta));
      if (next === state.rowOffset) return;
      state.rowOffset = next;
      renderGrid();
    };

    const onPointerUp = () => { state.dragging = false; };
    const onPointerMove = (p) => {
      if (!state.dragging) return;
      const minY = gridY + 8 + thumbH / 2;
      const maxY = gridY + 8 + (gridH - 16) - thumbH / 2;
      const yClamped = Math.max(minY, Math.min(maxY, p.y));
      thumb.y = yClamped;

      if (maxRowOffset > 0) {
        const t = (yClamped - minY) / (maxY - minY || 1);
        const next = Math.round(t * maxRowOffset);
        if (next !== state.rowOffset) {
          state.rowOffset = next;
          renderGrid();
        }
      }
    };

    const onWheel = (_p, _go, _dx, dy) => {
      if (dy > 0) scrollRows(1);
      else if (dy < 0) scrollRows(-1);
    };

    thumb.on("pointerdown", () => { state.dragging = true; });

    track.on("pointerdown", (p) => {
      const minY = gridY + 8 + thumbH / 2;
      const maxY = gridY + 8 + (gridH - 16) - thumbH / 2;
      const yClamped = Math.max(minY, Math.min(maxY, p.y));
      thumb.y = yClamped;

      if (maxRowOffset > 0) {
        const t = (yClamped - minY) / (maxY - minY || 1);
        state.rowOffset = Math.round(t * maxRowOffset);
        renderGrid();
      }
    });

    this.input.on("pointerup", onPointerUp);
    this.input.on("pointermove", onPointerMove);
    this.input.on("wheel", onWheel);

    const modal = this.add.container(0, 0);
    const close = this._makeButton(w / 2, h / 2 + ph / 2 - 24, "关闭", () => modal.destroy(true), 130, 38, "18px");

    modal.add([
      overlay,
      panel,
      title,
      sub,
      gridBg,
      cardsContainer,
      track,
      thumb,
      close.bg,
      close.t
    ]);

    overlay.on("pointerup", () => modal.destroy(true));

    modal.on("destroy", () => {
      this.input.off("pointerup", onPointerUp);
      this.input.off("pointermove", onPointerMove);
      this.input.off("wheel", onWheel);
    });

    renderGrid();
  }

  _refresh() {
    this._refreshChipStyles();
    this.filtered = this.index.filter((x) => this._match(x));

    const rowStep = 62;
    this.pageSize = Math.max(1, Math.floor((this.listBottom - this.listTop) / rowStep));

    const totalPages = Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
    this.page = Math.max(0, Math.min(this.page, totalPages - 1));

    const start = this.page * this.pageSize;
    const rows = this.filtered.slice(start, start + this.pageSize);

    this.summaryText.setText(`效果词条：${this.index.length} ｜ 筛选结果：${this.filtered.length}（点项目看士兵）`);
    this.pageText.setText(`第 ${this.page + 1}/${totalPages} 页`);

    this._renderRows(rows, start);
  }

  _turnPage(delta) {
    const totalPages = Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
    const next = Math.max(0, Math.min(totalPages - 1, this.page + delta));
    if (next === this.page) return;
    this.page = next;
    this._refresh();
  }

  _makeButton(cx, cy, text, onClick, w = 280, h = 46, fontSize = "18px") {
    const bg = this.add.rectangle(cx, cy, w, h, 0xffffff, 0.12).setInteractive({ useHandCursor: true });
    const t = this.add.text(cx, cy, text, { fontSize, color: "#ffffff" }).setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x9ddcff, 0.2));
    bg.on("pointerout", () => bg.setFillStyle(0xffffff, 0.12));
    bg.on("pointerup", () => {
      if (typeof onClick === "function") onClick();
    });

    return { bg, t };
  }
}
