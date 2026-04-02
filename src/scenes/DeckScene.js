import Phaser from "phaser";
import GameState from "../core/GameState";
import CardFactory from "../models/CardFactory";
import { ROLES } from "../config/constants";
import CardDetailModal from "../ui/CardDetailModal";

const DECK_MAX = 30;
const DECK_MIN = 15;
const GRID_COLS = 3;
const GRID_ROWS = 4;
const GRID_PAGE_SIZE = GRID_COLS * GRID_ROWS;
const TILE_W = 178;
const TILE_H = 112;
const GRID_GAP_X = 10;
const GRID_GAP_Y = 10;
const LONG_PRESS_MS = 400;

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

const SKILL_CLASS_CODES = [100, 101, 102, 103];
const BASE_RACE_CODES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function deriveSkillClassCode(def) {
  if (!def || String(def.type || "") !== "skill") return null;
  const phyle = Number(def.phyle ?? 0);
  if (SKILL_CLASS_CODES.includes(phyle)) return phyle;

  const sid = Number(def.sourceId ?? 0);
  const pre = Math.floor(sid / 100);
  if (pre === 410 || pre === 411 || pre === 510) return 100; // 戰士
  if (pre === 420 || pre === 421 || pre === 520) return 101; // 遊俠
  if (pre === 430 || pre === 431 || pre === 530) return 102; // 法師
  if (pre === 440 || pre === 441 || pre === 540) return 103; // 牧師
  return null;
}

function isSpecialSummon(def) {
  if (!def || String(def.type || "") !== "summon") return false;
  return Number(def.quality || 0) >= 5;
}

function matchTypeFilter(def, typeFilter) {
  const tp = String(def?.type || "").trim().toLowerCase();
  if (typeFilter === "all") return true;
  if (typeFilter === "skill") return tp === "skill";
  if (typeFilter === "summon") return tp === "summon";
  if (typeFilter === "special") return tp === "summon" && isSpecialSummon(def);
  return tp === typeFilter;
}

function trimText(v, max = 18) {
  const s = String(v || "");
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function escHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function raceLabelByCode(code) {
  const key = String(code ?? 0);
  return PHYLE_LABELS[key] || `代碼${key}`;
}

const SEARCH_VARIANT_PAIRS = [
  ["貓", "猫"], ["劍", "剑"], ["龍", "龙"], ["獸", "兽"], ["靈", "灵"], ["惡", "恶"],
  ["聖", "圣"], ["戰", "战"], ["護", "护"], ["飛", "飞"], ["擊", "击"], ["術", "术"],
  ["風", "风"], ["雲", "云"], ["門", "门"], ["羅", "罗"], ["亞", "亚"], ["麗", "丽"],
  ["國", "国"], ["軍", "军"], ["萬", "万"], ["與", "与"], ["無", "无"], ["滅", "灭"],
  ["準", "准"], ["備", "备"], ["療", "疗"], ["傷", "伤"], ["復", "复"], ["體", "体"]
];

function foldSearchText(input) {
  let s = String(input || "").normalize("NFKC").toLowerCase();
  s = s.replace(/\s+/g, "");
  for (let i = 0; i < SEARCH_VARIANT_PAIRS.length; i += 1) {
    const [trad, simp] = SEARCH_VARIANT_PAIRS[i];
    s = s.replaceAll(trad.toLowerCase(), simp.toLowerCase());
  }
  return s;
}

export default class DeckScene extends Phaser.Scene {
  constructor() {
    super("DeckScene");

    this.roleIndex = 0;
    this.roleKey = "L1";

    this.deckIds = [];
    this.allDefs = [];
    this.filteredDefs = [];

    this.searchText = "";
    this.typeFilter = "skill";
    this.raceFilter = "all";
    this.effectFilter = "all";

    this.poolPage = 0;
    this.deckPage = 0;

    this.uiStatic = [];
    this.deckItems = [];
    this.poolItems = [];

    this.poolPageLabel = null;
    this.searchLabel = null;
    this.deckTitleLabel = null;
    this.roleLabel = null;

    this._keyDownHandler = null;
    this._wheelHandler = null;
    this._wheelCooldownUntil = 0;
    this.pendingTextureKeys = new Set();
    this.cardModal = null;

    this.filterRoot = null;
    this.searchInputEl = null;
    this.typeSelectEl = null;
    this.raceSelectEl = null;
    this.effectSelectEl = null;
    this.typeTagsRootEl = null;
    this.raceTagsRootEl = null;
    this._renderTypeTags = null;
    this._renderRaceTags = null;
    this._resizeHandler = null;
    this.pendingRoleKey = "";
  }

  init(data) {
    const role = String(data?.role || "").trim();
    this.pendingRoleKey = ROLES.includes(role) ? role : "";
  }

  create() {
    this._drawWoodBackground();

    this._buildHeader();
    this._buildPanels();
    this._buildBottomButtons();

    this.allDefs = CardFactory.getAllCardDefs();
    this._mountFilterUI();
    this._layoutFilterUI();

    if (this.pendingRoleKey) {
      this.roleIndex = Math.max(0, ROLES.indexOf(this.pendingRoleKey));
    }
    this._loadRole();
    this._applySearch();

    this.cardModal = new CardDetailModal(this);

    this._keyDownHandler = (ev) => this._onKeyDown(ev);
    this.input.keyboard.on("keydown", this._keyDownHandler);
    this._wheelHandler = (pointer, _currentlyOver, _dx, dy) => this._onMouseWheel(pointer, dy);
    this.input.on("wheel", this._wheelHandler);

    this.load.on(Phaser.Loader.Events.COMPLETE, this._onLoaderComplete, this);
    this._resizeHandler = () => this._layoutFilterUI();
    this.scale.on(Phaser.Scale.Events.RESIZE, this._resizeHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this._keyDownHandler) this.input.keyboard.off("keydown", this._keyDownHandler);
      if (this._wheelHandler) this.input.off("wheel", this._wheelHandler);
      this.load.off(Phaser.Loader.Events.COMPLETE, this._onLoaderComplete, this);
      if (this._resizeHandler) this.scale.off(Phaser.Scale.Events.RESIZE, this._resizeHandler);
      this._resizeHandler = null;
      if (this.cardModal) this.cardModal.destroy();
      this.cardModal = null;
      this._unmountFilterUI();
    });

    this._renderAll();
  }

  _drawWoodBackground() {
    const w = this.scale.width;
    const h = this.scale.height;

    const g = this.add.graphics();
    g.fillGradientStyle(0x11284a, 0x1d4677, 0x08111d, 0x050913, 1);
    g.fillRect(0, 0, w, h);

    this.add.ellipse(w * 0.52, h * 0.18, 760, 260, 0x76d8ff, 0.1);
    this.add.ellipse(w * 0.18, h * 0.52, 460, 340, 0x63cbff, 0.08);
    this.add.ellipse(w * 0.84, h * 0.5, 450, 320, 0xffc98b, 0.07);
    this.add.ellipse(w * 0.5, h * 0.82, 980, 220, 0x0c1930, 0.34);
    this.add.rectangle(w / 2, h * 0.92, w, 220, 0x06101a, 0.46);

    const vignetteL = this.add.rectangle(0, h / 2, 120, h, 0x03070d, 0.24).setOrigin(0, 0.5);
    const vignetteR = this.add.rectangle(w, h / 2, 120, h, 0x08050b, 0.24).setOrigin(1, 0.5);
    const centerGlow = this.add.ellipse(w * 0.5, h * 0.4, 860, 420, 0x8bdcff, 0.04);
    const leftFloor = this.add.ellipse(w * 0.25, h * 0.82, 500, 90, 0x294968, 0.2);
    const rightFloor = this.add.ellipse(w * 0.75, h * 0.82, 500, 90, 0x483921, 0.16);

    for (let i = 0; i < 72; i += 1) {
      const sx = Phaser.Math.Between(0, w);
      const sy = Phaser.Math.Between(0, Math.floor(h * 0.72));
      const star = this.add.circle(sx, sy, Phaser.Math.Between(1, 2), 0xe3f5ff, Phaser.Math.FloatBetween(0.1, 0.8));
      this.tweens.add({
        targets: star,
        alpha: { from: Phaser.Math.FloatBetween(0.1, 0.35), to: Phaser.Math.FloatBetween(0.45, 0.9) },
        duration: Phaser.Math.Between(1400, 2600),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1400)
      });
    }

    const mistA = this.add.rectangle(w / 2, h * 0.58, w * 0.92, 120, 0xa6dcff, 0.03);
    const mistB = this.add.rectangle(w / 2, h - 20, w, 150, 0xd2ebff, 0.08);
    this.tweens.add({
      targets: [mistA, mistB, centerGlow, leftFloor, rightFloor, vignetteL, vignetteR],
      alpha: { from: 0.04, to: 0.1 },
      duration: 2400,
      yoyo: true,
      repeat: -1
    });
  }

  _buildHeader() {
    const w = this.scale.width;

    const topGlow = this.add.rectangle(w / 2, 30, w, 64, 0x6fd2ff, 0.04);
    const topBar = this.add.rectangle(w / 2, 30, w, 54, 0x081424, 0.78).setStrokeStyle(1.2, 0x8fd8ff, 0.34);
    const topLine = this.add.rectangle(w / 2, 54, w - 60, 2, 0xf0fbff, 0.12);
    this.uiStatic.push(topGlow, topBar, topLine);

    this.uiStatic.push(
      this.add.text(24, 14, "牌組編輯", {
        fontSize: "30px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#112034",
        strokeThickness: 5
      })
    );

    this.uiStatic.push(
      this.add.text(24, 46, "調整你的主力牌組、職系與卡牌組合", {
        fontSize: "15px",
        color: "#cfe7ff"
      })
    );

    const backBtn = this._makeBtn(w - 154, 16, 130, 32, "返回選單", () => this.scene.start("MenuScene"), "secondary");
    this.uiStatic.push(backBtn.shadow, backBtn.glow, backBtn.back, backBtn.bg, backBtn.edge, backBtn.t);

    this.uiStatic.push(
      this.add.text(26, 84, "角色", {
        fontSize: "18px",
        color: "#d8e8ff",
        fontStyle: "bold"
      })
    );

    this.roleLabel = this.add.text(78, 82, "L1", {
      fontSize: "28px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#18324f",
      strokeThickness: 4
    });
    this.uiStatic.push(this.roleLabel);

    const prevBtn = this._makeBtn(132, 80, 42, 30, "<", () => {
      this.roleIndex = (this.roleIndex - 1 + ROLES.length) % ROLES.length;
      this._loadRole();
      this._renderAll();
    }, "secondary");
    const nextBtn = this._makeBtn(182, 80, 42, 30, ">", () => {
      this.roleIndex = (this.roleIndex + 1) % ROLES.length;
      this._loadRole();
      this._renderAll();
    }, "secondary");
    this.uiStatic.push(prevBtn.shadow, prevBtn.glow, prevBtn.back, prevBtn.bg, prevBtn.edge, prevBtn.t);
    this.uiStatic.push(nextBtn.shadow, nextBtn.glow, nextBtn.back, nextBtn.bg, nextBtn.edge, nextBtn.t);

    this.searchLabel = this.add.text(360, 86, "搜尋：(全部) | 類型:技能 | 種族:全部 | 效果:全部", {
      fontSize: "14px",
      color: "#9ddcff"
    });
    this.uiStatic.push(this.searchLabel);

    this.poolPageLabel = this.add.text(w - 250, 86, "", {
      fontSize: "16px",
      color: "#d8e8ff",
      fontStyle: "bold"
    });
    this.uiStatic.push(this.poolPageLabel);

    this.tweens.add({ targets: topGlow, alpha: { from: 0.04, to: 0.09 }, duration: 1800, yoyo: true, repeat: -1 });
  }

  _mountFilterUI() {
    this._unmountFilterUI();

    const host = document.getElementById("app") || document.body;

    const root = document.createElement("div");
    root.id = "deck-filter-root";
    root.style.position = "absolute";
    root.style.left = "674px";
    root.style.top = "44px";
    root.style.display = "flex";
    root.style.gap = "10px";
    root.style.alignItems = "center";
    root.style.flexWrap = "nowrap";
    root.style.justifyContent = "space-between";
    root.style.zIndex = "60";
    root.style.pointerEvents = "auto";
    root.style.position = "absolute";

    const makeInputBase = (el) => {
      el.style.height = "34px";
      el.style.boxSizing = "border-box";
      el.style.border = "1px solid rgba(143, 216, 255, 0.4)";
      el.style.background = "linear-gradient(180deg, rgba(13,28,46,0.96), rgba(8,20,35,0.9))";
      el.style.color = "#eef7ff";
      el.style.borderRadius = "10px";
      el.style.fontSize = "13px";
      el.style.padding = "4px 10px";
      el.style.fontFamily = "Segoe UI, Microsoft JhengHei, sans-serif";
      el.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.04) inset, 0 6px 18px rgba(0,0,0,0.18)";
      return el;
    };

    const searchInput = makeInputBase(document.createElement("input"));
    searchInput.type = "text";
    searchInput.placeholder = "搜尋 名稱 / ID / sourceId";
    searchInput.style.width = "220px";
    searchInput.style.minWidth = "140px";
    searchInput.value = this.searchText;

    const typeSel = makeInputBase(document.createElement("select"));
    typeSel.style.width = "110px";

    const raceSel = makeInputBase(document.createElement("select"));
    raceSel.style.width = "140px";

    const effectSel = makeInputBase(document.createElement("select"));
    effectSel.style.width = "170px";

    const typeOptions = this._buildTypeOptions();
    for (let i = 0; i < typeOptions.length; i += 1) {
      const op = document.createElement("option");
      op.value = typeOptions[i].value;
      op.textContent = typeOptions[i].label;
      typeSel.appendChild(op);
    }

    const raceOptions = this._buildRaceOptions(this.typeFilter);
    for (let i = 0; i < raceOptions.length; i += 1) {
      const op = document.createElement("option");
      op.value = raceOptions[i].value;
      op.textContent = raceOptions[i].label;
      raceSel.appendChild(op);
    }

    const effectOptions = this._buildEffectOptions();
    for (let i = 0; i < effectOptions.length; i += 1) {
      const op = document.createElement("option");
      op.value = effectOptions[i].value;
      op.textContent = effectOptions[i].label;
      effectSel.appendChild(op);
    }

    typeSel.value = this.typeFilter;
    raceSel.value = this.raceFilter;
    effectSel.value = this.effectFilter;

    searchInput.addEventListener("input", () => {
      this.searchText = String(searchInput.value || "");
      this.poolPage = 0;
      this._applySearch();
      this._renderPoolGrid();
      this._updateTopLabels();
    });

    typeSel.addEventListener("change", () => {
      this.typeFilter = String(typeSel.value || "all");
      this.raceFilter = "all";
      this._rebuildRaceOptions();
      this.poolPage = 0;
      this._applySearch();
      this._renderPoolGrid();
      this._updateTopLabels();
    });

    raceSel.addEventListener("change", () => {
      this.raceFilter = String(raceSel.value || "all");
      this.poolPage = 0;
      this._applySearch();
      this._renderPoolGrid();
      this._updateTopLabels();
      if (typeof this._renderRaceTags === "function") this._renderRaceTags();
    });

    effectSel.addEventListener("change", () => {
      this.effectFilter = String(effectSel.value || "all");
      this.poolPage = 0;
      this._applySearch();
      this._renderPoolGrid();
      this._updateTopLabels();
    });

    const typeTags = document.createElement("div");
    typeTags.style.display = "flex";
    typeTags.style.gap = "6px";
    typeTags.style.alignItems = "center";
    typeTags.style.marginLeft = "8px";
    typeTags.style.padding = "5px 8px";
    typeTags.style.borderRadius = "12px";
    typeTags.style.background = "linear-gradient(180deg, rgba(12,26,43,0.84), rgba(9,22,38,0.7))";
    typeTags.style.border = "1px solid rgba(114,160,207,0.44)";
    typeTags.style.boxShadow = "0 10px 24px rgba(0,0,0,0.14)";

    const typeTagDefs = [
      { value: "special", label: "特殊士兵" },
      { value: "summon", label: "士兵" },
      { value: "skill", label: "技能" }
    ];
    const renderTypeTags = () => {
      typeTags.innerHTML = "";
      for (let i = 0; i < typeTagDefs.length; i += 1) {
        const it = typeTagDefs[i];
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = it.label;
        b.style.height = "34px";
        b.style.padding = "0 12px";
        b.style.border = this.typeFilter === it.value ? "1px solid rgba(182,229,255,0.72)" : "1px solid rgba(107,136,173,0.72)";
        b.style.borderRadius = "10px";
        b.style.cursor = "pointer";
        b.style.color = "#e8f3ff";
        b.style.fontWeight = "700";
        b.style.background = this.typeFilter === it.value ? "linear-gradient(180deg, #4371aa, #29507e)" : "rgba(16,36,61,0.85)";
        b.style.boxShadow = this.typeFilter === it.value ? "0 8px 18px rgba(104,184,255,0.18)" : "none";
        b.addEventListener("click", () => {
          this.typeFilter = it.value;
          if (this.typeSelectEl) this.typeSelectEl.value = it.value;
          this.raceFilter = "all";
          this._rebuildRaceOptions();
          this.poolPage = 0;
          this._applySearch();
          this._renderPoolGrid();
          this._updateTopLabels();
        });
        typeTags.appendChild(b);
      }
    };

    const raceTags = document.createElement("div");
    raceTags.style.position = "relative";
    raceTags.style.display = "flex";
    raceTags.style.flexDirection = "row";
    raceTags.style.flexWrap = "wrap";
    raceTags.style.gap = "6px";
    raceTags.style.alignItems = "center";
    raceTags.style.flexShrink = "0";
    raceTags.style.minWidth = "0";
    raceTags.style.maxWidth = "320px";
    raceTags.style.maxHeight = "none";
    raceTags.style.overflowX = "auto";
    raceTags.style.overflowY = "hidden";
    raceTags.style.padding = "5px 8px";
    raceTags.style.background = "linear-gradient(180deg, rgba(12,26,43,0.84), rgba(9,22,38,0.72))";
    raceTags.style.border = "1px solid rgba(86,124,165,0.5)";
    raceTags.style.borderRadius = "12px";
    raceTags.style.boxShadow = "0 10px 24px rgba(0,0,0,0.14)";

    const renderRaceTags = () => {
      raceTags.innerHTML = "";
      const options = this._buildRaceOptions(this.typeFilter);
      for (let i = 0; i < options.length; i += 1) {
        const it = options[i];
        if (it.value === "all") continue;
        const b = document.createElement("button");
        b.type = "button";
        const full = it.label.replace(/^種族:\s*/, "");
        b.textContent = full;
        b.title = full;
        b.style.height = "28px";
        b.style.minWidth = "0";
        b.style.padding = "0 8px";
        b.style.border = this.raceFilter === it.value ? "1px solid rgba(181,230,255,0.68)" : "1px solid #5f7fa6";
        b.style.borderRadius = "8px";
        b.style.cursor = "pointer";
        b.style.color = "#d6ebff";
        b.style.fontSize = "12px";
        b.style.fontWeight = "700";
        b.style.letterSpacing = "0.5px";
        b.style.background = this.raceFilter === it.value ? "linear-gradient(180deg, #3d6da4, #2c5683)" : "rgba(18,40,68,0.82)";
        b.style.boxShadow = this.raceFilter === it.value ? "0 8px 16px rgba(97,170,255,0.16)" : "none";
        b.addEventListener("click", () => {
          this.raceFilter = this.raceFilter === it.value ? "all" : it.value;
          if (this.raceSelectEl) this.raceSelectEl.value = this.raceFilter;
          this.poolPage = 0;
          this._applySearch();
          this._renderPoolGrid();
          this._updateTopLabels();
          renderRaceTags();
        });
        raceTags.appendChild(b);
      }
    };

    const leftWrap = document.createElement("div");
    leftWrap.style.display = "flex";
    leftWrap.style.alignItems = "center";
    leftWrap.style.gap = "8px";
    leftWrap.style.flex = "1 1 auto";
    leftWrap.style.minWidth = "0";
    leftWrap.appendChild(searchInput);
    leftWrap.appendChild(effectSel);
    leftWrap.appendChild(typeTags);

    root.appendChild(leftWrap);
    root.appendChild(raceTags);

    host.appendChild(root);

    this.filterRoot = root;
    this.searchInputEl = searchInput;
    this.typeSelectEl = typeSel;
    this.raceSelectEl = raceSel;
    this.effectSelectEl = effectSel;
    this.typeTagsRootEl = typeTags;
    this.raceTagsRootEl = raceTags;
    this._renderTypeTags = renderTypeTags;
    this._renderRaceTags = renderRaceTags;
    renderTypeTags();
    renderRaceTags();
    this._layoutFilterUI();
  }

  _unmountFilterUI() {
    if (this.filterRoot && this.filterRoot.parentNode) {
      this.filterRoot.parentNode.removeChild(this.filterRoot);
    }
    this.filterRoot = null;
    this.searchInputEl = null;
    this.typeSelectEl = null;
    this.raceSelectEl = null;
    this.effectSelectEl = null;
    this.typeTagsRootEl = null;
    this.raceTagsRootEl = null;
    this._renderTypeTags = null;
    this._renderRaceTags = null;
  }

  _buildTypeOptions() {
    const set = new Set(["all", "special", "summon", "skill"]);
    for (let i = 0; i < this.allDefs.length; i += 1) {
      const t = String(this.allDefs[i]?.type || "").trim().toLowerCase();
      if (t) set.add(t);
    }
    const labels = {
      all: "類型: 全部",
      special: "類型: 特殊士兵",
      summon: "類型: 士兵",
      skill: "類型: 技能"
    };
    return Array.from(set).map((value) => ({
      value,
      label: labels[value] || `類型: ${value}`
    }));
  }

  _layoutFilterUI() {
    if (!this.filterRoot) return;
    const w = Number(this.scale?.width || 1280);
    const left = 360;
    const rightReserve = 140;
    const avail = Math.max(420, w - left - rightReserve);

    this.filterRoot.style.left = `${left}px`;
    this.filterRoot.style.top = "14px";
    this.filterRoot.style.width = `${avail}px`;
    this.filterRoot.style.maxWidth = `${avail}px`;
    this.filterRoot.style.overflow = "visible";

    if (this.searchInputEl) {
      const searchW = Math.max(140, Math.floor(avail * 0.34));
      this.searchInputEl.style.width = `${searchW}px`;
    }
    
    if (this.effectSelectEl) {
      const effectW = Math.max(110, Math.min(170, avail - 300));
      this.effectSelectEl.style.width = `${effectW}px`;
    }
    if (this.raceTagsRootEl) {
      const tagsW = Math.max(160, Math.min(420, Math.floor(avail * 0.4)));
      this.raceTagsRootEl.style.maxWidth = `${tagsW}px`;
    }
  }

  _buildRaceOptions(typeFilter = this.typeFilter) {
    const map = new Map();
    map.set("all", "種族: 全部");

    if (typeFilter === "skill") {
      for (let i = 0; i < SKILL_CLASS_CODES.length; i += 1) {
        const code = String(SKILL_CLASS_CODES[i]);
        map.set(code, `種族: ${raceLabelByCode(code)}`);
      }
      return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
    }

    const allowed = new Set(BASE_RACE_CODES.map((x) => String(x)));
    for (let i = 0; i < this.allDefs.length; i += 1) {
      const d = this.allDefs[i];
      if (!matchTypeFilter(d, typeFilter === "all" ? "summon" : typeFilter)) continue;
      const raw = d?.phyle;
      if (raw === undefined || raw === null || raw === "") continue;
      const key = String(raw);
      if (!allowed.has(key)) continue;
      if (!map.has(key)) {
        const label = raceLabelByCode(key);
        map.set(key, `種族: ${label}`);
      }
    }

    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }

  _rebuildRaceOptions() {
    if (!this.raceSelectEl) return;
    this.raceSelectEl.innerHTML = "";
    const options = this._buildRaceOptions(this.typeFilter);
    for (let i = 0; i < options.length; i += 1) {
      const item = options[i];
      const op = document.createElement("option");
      op.value = item.value;
      op.textContent = item.label;
      this.raceSelectEl.appendChild(op);
    }
    if (!options.some((x) => x.value === this.raceFilter)) this.raceFilter = "all";
    this.raceSelectEl.value = this.raceFilter;
    if (typeof this._renderRaceTags === "function") this._renderRaceTags();
    if (typeof this._renderTypeTags === "function") this._renderTypeTags();
  }

  _buildEffectOptions() {
    const map = new Map();
    map.set("all", "效果: 全部");

    for (let i = 0; i < this.allDefs.length; i += 1) {
      const d = this.allDefs[i];
      const list = [
        d?.ability1,
        d?.ability2,
        d?.ability3,
        d?.ability4,
        d?.ability5,
        ...(Array.isArray(d?.abilities) ? d.abilities : [])
      ];

      for (let j = 0; j < list.length; j += 1) {
        const src = String(list[j] || "").trim();
        if (!src) continue;

        const token = src.split(":")[0].split("：")[0].trim();
        const key = token || src;
        if (!key) continue;
        if (!map.has(key)) map.set(key, `效果: ${key}`);
      }
    }

    const arr = Array.from(map.entries()).map(([value, label]) => ({ value, label }));
    return arr.slice(0, 160);
  }

  _buildPanels() {
    const leftX = 24;
    const topY = 124;
    const panelW = 600;
    const panelH = 508;
    const rightX = 656;

    const buildPanel = (x, title, glowColor, titleColor, variant = "left") => {
      const cx = x + panelW / 2;
      const cy = topY + panelH / 2;
      const isLeft = variant === "left";
      this.uiStatic.push(this.add.ellipse(cx, cy, panelW + 54, panelH + 42, glowColor, isLeft ? 0.09 : 0.065));
      this.uiStatic.push(this.add.rectangle(cx, cy + 10, panelW, panelH, 0x000000, 0.26));
      this.uiStatic.push(this.add.rectangle(cx, cy, panelW, panelH, isLeft ? 0x0b1b31 : 0x101b2e, isLeft ? 0.9 : 0.82).setStrokeStyle(1.8, isLeft ? 0xb6e5ff : 0xd3e9ff, isLeft ? 0.44 : 0.26));
      this.uiStatic.push(this.add.rectangle(cx, topY + 16, panelW - 28, 2, 0xf0fbff, isLeft ? 0.16 : 0.08));
      this.uiStatic.push(this.add.rectangle(cx, topY + 30, panelW - 52, 28, isLeft ? 0x74d4ff : 0xffc58f, isLeft ? 0.05 : 0.04));
      this.uiStatic.push(this.add.text(x + 18, topY - 38, title, {
        fontSize: isLeft ? "28px" : "24px",
        color: titleColor,
        fontStyle: "bold",
        stroke: "#132036",
        strokeThickness: 4
      }));
    };

    buildPanel(leftX, "目前牌組", 0x7ad4ff, "#ffffff", "left");
    buildPanel(rightX, "我的卡牌", 0xffc58f, "#fff0d8", "right");

    this.uiStatic.push(this.add.ellipse(640, topY + panelH / 2, 16, panelH + 12, 0x7fd6ff, 0.16));
    this.uiStatic.push(this.add.rectangle(640, topY + panelH / 2, 8, panelH + 12, 0x113458, 0.46));
    this.uiStatic.push(this.add.rectangle(640, topY + panelH / 2, 2, panelH + 12, 0xe6f4ff, 0.22));

    this.deckTitleLabel = this.add.text(leftX + 18, topY - 2, "目前牌組", {
      fontSize: "19px",
      color: "#d5ebff",
      fontStyle: "bold"
    });
    this.uiStatic.push(this.deckTitleLabel);
  }

  _buildBottomButtons() {
    const h = this.scale.height;
    const addBtn = (btn) => this.uiStatic.push(btn.shadow, btn.glow, btn.back, btn.bg, btn.edge, btn.t);

    addBtn(this._makeBtn(24, h - 40, 182, 34, "儲存套牌", () => this._save(), "primary"));
    addBtn(this._makeBtn(216, h - 40, 154, 34, "重設此角色", () => {
      this._resetRole();
      this._renderAll();
    }, "secondary"));
    addBtn(this._makeBtn(380, h - 40, 206, 34, "清空所有牌組設定", () => {
      GameState.clearAllDecks();
      this._loadRole();
      this._renderAll();
    }, "danger"));

    addBtn(this._makeBtn(656, h - 40, 96, 30, "套牌上頁", () => {
      this.deckPage = Math.max(0, this.deckPage - 1);
      this._renderDeckGrid();
    }, "secondary"));
    addBtn(this._makeBtn(760, h - 40, 96, 30, "套牌下頁", () => {
      const maxPage = Math.max(0, Math.ceil(this.deckIds.length / GRID_PAGE_SIZE) - 1);
      this.deckPage = Math.min(maxPage, this.deckPage + 1);
      this._renderDeckGrid();
    }, "secondary"));

    addBtn(this._makeBtn(920, h - 40, 100, 30, "上一頁", () => {
      this.poolPage = Math.max(0, this.poolPage - 1);
      this._renderPoolGrid();
    }, "secondary"));
    addBtn(this._makeBtn(1028, h - 40, 100, 30, "下一頁", () => {
      const maxPage = Math.max(0, Math.ceil(this.filteredDefs.length / GRID_PAGE_SIZE) - 1);
      this.poolPage = Math.min(maxPage, this.poolPage + 1);
      this._renderPoolGrid();
    }, "secondary"));
    addBtn(this._makeBtn(1136, h - 40, 64, 30, "清搜", () => {
      this.searchText = "";
      this.typeFilter = "skill";
      this.raceFilter = "all";
      this.effectFilter = "all";
      if (this.searchInputEl) this.searchInputEl.value = "";
      if (this.typeSelectEl) this.typeSelectEl.value = this.typeFilter;
      this._rebuildRaceOptions();
      if (this.raceSelectEl) this.raceSelectEl.value = this.raceFilter;
      if (this.effectSelectEl) this.effectSelectEl.value = "all";
      if (typeof this._renderTypeTags === "function") this._renderTypeTags();
      if (typeof this._renderRaceTags === "function") this._renderRaceTags();

      this.poolPage = 0;
      this._applySearch();
      this._renderPoolGrid();
      this._updateTopLabels();
    }, "secondary"));
  }

  _makeBtn(x, y, w, h, text, onClick, variant = "secondary") {
    const isPrimary = variant === "primary";
    const isAccent = variant === "accent";
    const isDanger = variant === "danger";
    const baseColor = isPrimary ? 0x58baf0 : (isAccent ? 0x6f5ad1 : (isDanger ? 0xb04956 : 0x11233b));
    const backColor = isPrimary ? 0x2b6290 : (isAccent ? 0x382d73 : (isDanger ? 0x5f2431 : 0x09131f));
    const glowColor = isPrimary ? 0x8cdcff : (isAccent ? 0xd5c0ff : (isDanger ? 0xffadb7 : 0x7ecfff));
    const strokeColor = isPrimary ? 0xf1fbff : (isAccent ? 0xf3e4ff : (isDanger ? 0xffd6dc : 0xa7d9ff));

    const cx = x + w / 2;
    const cy = y + h / 2;
    const shadow = this.add.rectangle(cx, cy + 5, w, h, 0x000000, 0.34);
    const glow = this.add.ellipse(cx, cy, w + 26, h + 18, glowColor, isPrimary || isAccent || isDanger ? 0.16 : 0.06);
    const back = this.add.rectangle(cx, cy + 2, w, h, backColor, 0.95);
    const bg = this.add.rectangle(cx, cy, w, h, baseColor, isPrimary || isAccent || isDanger ? 0.96 : 0.9)
      .setStrokeStyle(1.6, strokeColor, isPrimary || isAccent || isDanger ? 0.88 : 0.42)
      .setInteractive({ useHandCursor: true });
    const edge = this.add.rectangle(cx, cy - h / 2 + 9, w - 18, 2, 0xf4fbff, isPrimary || isAccent || isDanger ? 0.3 : 0.14);
    const t = this.add.text(cx, cy, text, {
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#132036",
      strokeThickness: 3
    }).setOrigin(0.5);

    bg.on("pointerover", () => {
      bg.setFillStyle(isPrimary ? 0x7fd5ff : (isAccent ? 0x8471e6 : (isDanger ? 0xc35c69 : 0x18304f)), 1);
      glow.setFillStyle(glowColor, isPrimary || isAccent || isDanger ? 0.22 : 0.1);
      this.tweens.add({ targets: [bg, back, t, edge], scaleX: 1.025, scaleY: 1.025, duration: 100 });
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(baseColor, isPrimary || isAccent || isDanger ? 0.96 : 0.9);
      glow.setFillStyle(glowColor, isPrimary || isAccent || isDanger ? 0.16 : 0.06);
      this.tweens.add({ targets: [bg, back, t, edge], scaleX: 1, scaleY: 1, duration: 100 });
    });
    bg.on("pointerup", () => {
      this.tweens.add({ targets: [bg, back, t], scaleX: 0.985, scaleY: 0.985, duration: 65, yoyo: true });
      if (typeof onClick === "function") onClick();
    });

    return { shadow, glow, back, bg, edge, t };
  }

  _onKeyDown(ev) {
    if (!ev || this.scene.key !== "DeckScene") return;

    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "SELECT" || active.tagName === "TEXTAREA")) {
      return;
    }

    if (ev.keyCode === 8) {
      if (this.searchText.length > 0) {
        this.searchText = this.searchText.slice(0, -1);
        if (this.searchInputEl) this.searchInputEl.value = this.searchText;
        this.poolPage = 0;
        this._applySearch();
        this._renderPoolGrid();
        this._updateTopLabels();
      }
      return;
    }

    if (ev.keyCode === 27) return;

    if (ev.key && ev.key.length === 1) {
      this.searchText += ev.key;
      if (this.searchInputEl) this.searchInputEl.value = this.searchText;
      this.poolPage = 0;
      this._applySearch();
      this._renderPoolGrid();
      this._updateTopLabels();
    }
  }

  _onMouseWheel(pointer, dy) {
    if (!pointer || !Number.isFinite(dy)) return;

    const now = this.time.now;
    if (now < this._wheelCooldownUntil) return;
    this._wheelCooldownUntil = now + 120;

    const dir = dy > 0 ? 1 : -1;
    if (dir === 0) return;

    const x = Number(pointer.x ?? 0);
    const leftPanel = x < 640;

    if (leftPanel) {
      const maxDeckPage = Math.max(0, Math.ceil(this.deckIds.length / GRID_PAGE_SIZE) - 1);
      const next = Phaser.Math.Clamp(this.deckPage + dir, 0, maxDeckPage);
      if (next !== this.deckPage) {
        this.deckPage = next;
        this._renderDeckGrid();
      }
      return;
    }

    const maxPoolPage = Math.max(0, Math.ceil(this.filteredDefs.length / GRID_PAGE_SIZE) - 1);
    const next = Phaser.Math.Clamp(this.poolPage + dir, 0, maxPoolPage);
    if (next !== this.poolPage) {
      this.poolPage = next;
      this._renderPoolGrid();
    }
  }

  _onLoaderComplete() {
    this.pendingTextureKeys.clear();
    this._renderDeckGrid();
    this._renderPoolGrid();
  }

  _ensureCardTexture(def) {
    if (!def?.id || !def?.image) return;
    const key = `card_${def.id}`;
    if (this.textures.exists(key)) return;
    if (this.pendingTextureKeys.has(key)) return;

    this.pendingTextureKeys.add(key);
    this.load.image(key, def.image);

    const loading = typeof this.load.isLoading === "function"
      ? this.load.isLoading()
      : !!this.load.isLoading;
    if (!loading) this.load.start();
  }

  _applySearch() {
    const q = foldSearchText(this.searchText.trim());
    const type = this.typeFilter;
    const race = this.raceFilter;
    const effect = foldSearchText(this.effectFilter.trim());

    this.filteredDefs = this.allDefs.filter((d) => {
      if (q) {
        const a = foldSearchText(String(d.id || ""));
        const b = foldSearchText(String(d.name || ""));
        const c = foldSearchText(String(d.sourceId || ""));
        if (!a.includes(q) && !b.includes(q) && !c.includes(q)) return false;
      }

      if (!matchTypeFilter(d, type)) return false;

      if (race !== "all") {
        const rp = String(d.phyle ?? "");
        if (rp !== race) return false;
      }

      if (effect !== "all") {
        const src = [
          d.ability1,
          d.ability2,
          d.ability3,
          d.ability4,
          d.ability5,
          ...(Array.isArray(d.abilities) ? d.abilities : [])
        ]
          .map((x) => foldSearchText(String(x || "")))
          .join(" | ");
        if (!src.includes(effect)) return false;
      }

      return true;
    });
  }

  _loadRole() {
    this.roleKey = ROLES[this.roleIndex];
    const list = GameState.getDeckIds(this.roleKey);
    this.deckIds = list.filter((id) => !!CardFactory.getCardDef(id));

    if (this.roleLabel) this.roleLabel.setText(this.roleKey);
    this.deckPage = 0;
  }

  _save() {
    if (String(this.roleKey || "").startsWith("L")) {
      const classes = new Set();
      for (let i = 0; i < this.deckIds.length; i += 1) {
        const def = CardFactory.getCardDef(this.deckIds[i]);
        const cls = deriveSkillClassCode(def);
        if (cls !== null) classes.add(cls);
      }
      if (classes.size > 1) {
        const list = [...classes].map((x) => raceLabelByCode(x)).join(" / ");
        this._toast(`玩家牌組技能卡僅能單一職系（目前：${list}）`);
        return;
      }
    }
    GameState.setDeckIds(this.roleKey, this.deckIds);
    this._toast(`已儲存 ${this.roleKey} 套牌`);
  }

  _resetRole() {
    this.deckIds = this._demoDeckIds();
    this.deckPage = 0;
    this._toast("已重設為預設牌組");
  }

  _demoDeckIds() {
    return [
      "s_swordsman",
      "s_swordsman",
      "s_archer",
      "s_archer",
      "s_guard",
      "s_mage",
      "s_guard"
    ];
  }

  _renderAll() {
    this._updateTopLabels();
    this._renderDeckGrid();
    this._renderPoolGrid();
  }

  _updateTopLabels() {
    if (this.deckTitleLabel) {
      this.deckTitleLabel.setText(`目前牌組 (${this.deckIds.length}/${DECK_MAX})`);
    }

    if (this.searchLabel) {
      const q = this.searchText || "(全部)";
      const tp = this.typeFilter === "all"
        ? "全部"
        : (this.typeFilter === "special"
          ? "特殊士兵"
          : (this.typeFilter === "summon" ? "士兵" : this.typeFilter === "skill" ? "技能" : this.typeFilter));
      const r = this.raceFilter === "all"
        ? "全部"
        : raceLabelByCode(this.raceFilter);
      const e = this.effectFilter === "all" ? "全部" : this.effectFilter;
      this.searchLabel.setText(`搜尋:${q} | 類型:${tp} | 種族:${r} | 效果:${trimText(e, 8)}`);
    }

    if (this.poolPageLabel) {
      const total = this.filteredDefs.length;
      const maxPage = Math.max(0, Math.ceil(total / GRID_PAGE_SIZE) - 1);
      this.poolPage = Math.min(this.poolPage, maxPage);
      this.poolPageLabel.setText(`第 ${this.poolPage + 1}/${maxPage + 1} 頁 | 共 ${total} 張`);
    }
  }

  _clearDeckItems() {
    for (let i = 0; i < this.deckItems.length; i += 1) this.deckItems[i].destroy(true);
    this.deckItems = [];
  }

  _clearPoolItems() {
    for (let i = 0; i < this.poolItems.length; i += 1) this.poolItems[i].destroy(true);
    this.poolItems = [];
  }

  _renderDeckGrid() {
    this._clearDeckItems();

    const panelX = 24;
    const panelY = 104;
    const startX = panelX + 10;
    const startY = panelY + 10;

    const maxPage = Math.max(0, Math.ceil(this.deckIds.length / GRID_PAGE_SIZE) - 1);
    this.deckPage = Math.min(this.deckPage, maxPage);

    const begin = this.deckPage * GRID_PAGE_SIZE;
    const ids = this.deckIds.slice(begin, begin + GRID_PAGE_SIZE);

    const copyMap = {};
    for (let i = 0; i < this.deckIds.length; i += 1) {
      const id = this.deckIds[i];
      copyMap[id] = (copyMap[id] || 0) + 1;
    }

    for (let i = 0; i < GRID_PAGE_SIZE; i += 1) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = startX + col * (TILE_W + GRID_GAP_X);
      const y = startY + row * (TILE_H + GRID_GAP_Y);

      const id = ids[i];
      if (!id) {
        this.deckItems.push(this._makeEmptyTile(x, y));
        continue;
      }

      const def = CardFactory.getCardDef(id);
      if (!def) {
        this.deckItems.push(this._makeEmptyTile(x, y, "無效卡"));
        continue;
      }

      this._ensureCardTexture(def);
      const tile = this._makeCardTile(x, y, def, {
        action: "remove",
        copy: copyMap[id] || 1,
        onClick: () => {
          const idx = this.deckIds.indexOf(id);
          if (idx >= 0) {
            this.deckIds.splice(idx, 1);
            this._updateTopLabels();
            this._renderDeckGrid();
            this._renderPoolGrid();
          }
        }
      });
      this.deckItems.push(tile);
    }

    const pageText = this.add.text(24, 676, `套牌頁：${this.deckPage + 1}/${maxPage + 1} | 最少 ${DECK_MIN} 張`, {
      fontSize: "16px",
      color: this.deckIds.length >= DECK_MIN ? "#9fe2a8" : "#ffb3a8",
      fontFamily: "Georgia, Times New Roman, serif"
    });
    this.deckItems.push(pageText);
  }

  _renderPoolGrid() {
    this._clearPoolItems();

    const panelX = 656;
    const panelY = 104;
    const startX = panelX + 10;
    const startY = panelY + 10;

    const total = this.filteredDefs.length;
    const maxPage = Math.max(0, Math.ceil(total / GRID_PAGE_SIZE) - 1);
    this.poolPage = Math.min(this.poolPage, maxPage);

    const begin = this.poolPage * GRID_PAGE_SIZE;
    const defs = this.filteredDefs.slice(begin, begin + GRID_PAGE_SIZE);

    for (let i = 0; i < GRID_PAGE_SIZE; i += 1) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const x = startX + col * (TILE_W + GRID_GAP_X);
      const y = startY + row * (TILE_H + GRID_GAP_Y);

      const def = defs[i];
      if (!def) {
        this.poolItems.push(this._makeEmptyTile(x, y));
        continue;
      }

      this._ensureCardTexture(def);
      const tile = this._makeCardTile(x, y, def, {
        action: "add",
        copy: this.deckIds.filter((id) => id === def.id).length,
        onClick: () => {
          if (this.deckIds.length >= DECK_MAX) {
            this._toast(`套牌上限 ${DECK_MAX} 張`);
            return;
          }

          if (String(this.roleKey || "").startsWith("L")) {
            const incomingClass = deriveSkillClassCode(def);
            if (incomingClass !== null) {
              for (let k = 0; k < this.deckIds.length; k += 1) {
                const inDeck = CardFactory.getCardDef(this.deckIds[k]);
                const deckClass = deriveSkillClassCode(inDeck);
                if (deckClass === null) continue;
                if (deckClass !== incomingClass) {
                  this._toast(`玩家牌組技能卡僅能單一職系（目前：${raceLabelByCode(deckClass)}，欲加入：${raceLabelByCode(incomingClass)}）`);
                  return;
                }
              }
            }
          }

          this.deckIds.push(def.id);
          this._updateTopLabels();
          this._renderDeckGrid();
          this._renderPoolGrid();
        }
      });
      this.poolItems.push(tile);
    }

    this._updateTopLabels();
  }

  _makeEmptyTile(x, y, text = "空") {
    const c = this.add.container(0, 0);

    const shadow = this.add.rectangle(x + TILE_W / 2, y + TILE_H / 2 + 5, TILE_W, TILE_H, 0x000000, 0.2);
    const bg = this.add.rectangle(x + TILE_W / 2, y + TILE_H / 2, TILE_W, TILE_H, 0x0f1f34, 0.58);
    bg.setStrokeStyle(1.2, 0x91cfff, 0.14);
    const edge = this.add.rectangle(x + TILE_W / 2, y + 10, TILE_W - 14, 2, 0xe7f4ff, 0.08);
    const inner = this.add.rectangle(x + TILE_W / 2, y + TILE_H / 2, TILE_W - 18, TILE_H - 18, 0xffffff, 0.015);

    const t = this.add.text(x + TILE_W / 2, y + TILE_H / 2, text, {
      fontSize: "18px",
      color: "#6f9abb",
      fontStyle: "bold"
    }).setOrigin(0.5);

    c.add([shadow, bg, edge, inner, t]);
    return c;
  }

  _makeCardTile(x, y, def, options) {
    const c = this.add.container(0, 0);
    const isSkill = (def.type || "summon") === "skill";
    const actionGlow = options.action === "add" ? 0x82d4ff : 0xffba86;
    const baseTint = isSkill ? 0x182347 : 0x16293d;

    const shadow = this.add.rectangle(x + TILE_W / 2, y + TILE_H / 2 + 5, TILE_W, TILE_H, 0x000000, 0.24);
    const glow = this.add.ellipse(x + TILE_W / 2, y + TILE_H / 2, TILE_W + 18, TILE_H + 12, actionGlow, 0.08);
    const base = this.add
      .rectangle(x + TILE_W / 2, y + TILE_H / 2, TILE_W, TILE_H, baseTint, 0.92)
      .setStrokeStyle(1.8, actionGlow, 0.82)
      .setInteractive({ useHandCursor: true });
    const edge = this.add.rectangle(x + TILE_W / 2, y + 9, TILE_W - 18, 2, 0xf3fbff, 0.16);

    let pressTimer = null;
    let isPressing = false;
    let longPressed = false;

    const cancelPress = () => {
      isPressing = false;
      if (pressTimer) {
        pressTimer.remove(false);
        pressTimer = null;
      }
    };

    base.on("pointerover", () => {
      base.setFillStyle(0x1b3350, 0.98);
      glow.setFillStyle(options.action === "add" ? 0x82d4ff : 0xffba86, 0.15);
      this.tweens.add({ targets: [base, edge], scaleX: 1.02, scaleY: 1.02, duration: 100 });
    });
    base.on("pointerout", () => {
      base.setFillStyle(0x12243a, 0.92);
      glow.setFillStyle(options.action === "add" ? 0x82d4ff : 0xffba86, 0.08);
      this.tweens.add({ targets: [base, edge], scaleX: 1, scaleY: 1, duration: 100 });
      cancelPress();
    });

    base.on("pointerdown", () => {
      cancelPress();
      isPressing = true;
      longPressed = false;
      pressTimer = this.time.delayedCall(LONG_PRESS_MS, () => {
        if (!isPressing) return;
        longPressed = true;
        this._showCardDetail(def);
      });
    });

    base.on("pointerup", () => {
      const shouldClick = isPressing && !longPressed;
      cancelPress();
      if (shouldClick && typeof options.onClick === "function") {
        options.onClick();
      }
    });

    const imageBox = this.add.rectangle(x + 37, y + TILE_H / 2, 60, 88, 0x0b1728, 0.98);
    imageBox.setStrokeStyle(1, 0xd8edff, 0.22);

    const infoPanel = this.add.rectangle(x + 122, y + TILE_H / 2, 102, 88, 0xffffff, 0.03);
    infoPanel.setStrokeStyle(1, 0xffffff, 0.04);

    c.add([shadow, glow, base, edge, imageBox, infoPanel]);

    const texKey = `card_${def.id}`;
    if (this.textures.exists(texKey)) {
      const img = this.add.image(x + 37, y + TILE_H / 2, texKey);
      img.setDisplaySize(58, 86);
      c.add(img);
    } else {
      const noImg = this.add.text(x + 37, y + TILE_H / 2, isSkill ? "Skill\nCard" : "No\nArt", {
        fontSize: "11px",
        color: "#8ea7c8",
        align: "center",
        fontStyle: "bold"
      }).setOrigin(0.5);
      c.add(noImg);
    }

    const name = trimText(def.name, 9);
    const nameText = this.add.text(x + 72, y + 10, name, {
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "bold"
    });

    const manaBadge = this.add.text(x + TILE_W - 12, y + 10, `費 ${def.cost ?? 0}`, {
      fontSize: "12px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: isSkill ? "#6a54c9dd" : "#2f6db6dd",
      padding: { left: 7, right: 7, top: 3, bottom: 3 }
    }).setOrigin(1, 0);

    const idText = this.add.text(x + 72, y + 31, `#${def.sourceId || def.id}`, {
      fontSize: "10px",
      color: "#9ec0f0"
    });

    const typeTag = this.add.text(x + TILE_W - 12, y + 34, isSkill ? "技能" : "士兵", {
      fontSize: "10px",
      color: "#eef6ff",
      fontStyle: "bold",
      backgroundColor: isSkill ? "#5f4db0cc" : "#244a70cc",
      padding: { left: 5, right: 5, top: 2, bottom: 2 }
    }).setOrigin(1, 0);

    const statBg = this.add.rectangle(x + 121, y + 60, 102, 20, 0x0d1a2a, 0.74);
    statBg.setStrokeStyle(1, 0xffffff, 0.04);
    const stats = this.add.text(x + 76, y + 52, `HP ${def.unit?.hp ?? 0}   ATK ${def.unit?.atk ?? 0}`, {
      fontSize: "11px",
      color: "#f3fbff",
      fontStyle: "bold"
    });

    const race = this.add.text(x + 76, y + 71, raceLabelByCode(def.phyle), {
      fontSize: "10px",
      color: "#aee7ff",
      fontStyle: "bold"
    });

    const hint = this.add.text(x + 76, y + 89, options.action === "add" ? "加入套牌" : "移出套牌", {
      fontSize: "10px",
      color: options.action === "add" ? "#9fe2ff" : "#ffd0a8",
      fontStyle: "bold"
    });

    const copy = this.add.text(x + TILE_W - 12, y + TILE_H - 24, `x${options.copy || 0}`, {
      fontSize: "12px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "#00000088",
      padding: { left: 6, right: 6, top: 2, bottom: 2 }
    }).setOrigin(1, 0);

    c.add([nameText, manaBadge, idText, typeTag, statBg, stats, race, hint, copy]);
    return c;
  }

  _showCardDetail(def) {
    if (!def || !this.cardModal) return;
    const card = CardFactory.create(def.id);
    this.cardModal.showFromCard(card);
  }

  _toast(msg) {
    const w = this.scale.width;
    const t = this.add.text(w / 2, 20, msg, {
      fontSize: "16px",
      color: "#ffffff",
      backgroundColor: "#000000aa",
      padding: { left: 8, right: 8, top: 4, bottom: 4 },
      fontFamily: "Georgia, Times New Roman, serif"
    }).setOrigin(0.5, 0);

    this.tweens.add({
      targets: t,
      alpha: 0,
      duration: 1100,
      onComplete: () => t.destroy()
    });
  }
}



