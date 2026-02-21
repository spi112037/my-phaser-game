import Phaser from "phaser";
import CardFactory from "../models/CardFactory";

const STORAGE_KEY = "my-phaser-game.card-editor.draft.v1";
const OVERRIDE_KEY = "my-phaser-game.card-overrides.v1";
const EFFECT_RULE_OVERRIDE_KEY = "my-phaser-game.effect-rule-overrides.v1";
const IMAGE_STORE_MAX_BYTES = 160 * 1024;
const LOCKED_IMAGE_STYLE_MODE = "bright";
const LOCKED_IMAGE_STYLE_REF = "/cards/style/style_reference.png";
const EDITOR_API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8787").replace(/\/$/, "");

function resolveEditorAssetUrl(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.startsWith("data:image/")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/cards/custom/")) return `${EDITOR_API_BASE}${s}`;
  return s;
}

function escHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
function dedupeEffects(items, limit = 5) {
  const seen = new Set();
  const out = [];

  for (let i = 0; i < items.length; i += 1) {
    const v = String(items[i] || "").trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= limit) break;
  }

  return out;
}

function parseEffectKey(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.split(/[:：]/)[0].trim();
}

function parseHintValue(raw, fallback = 1) {
  const text = String(raw || "");
  const plus = text.match(/\+\s*(\d+)/);
  if (plus) return Math.max(1, Number(plus[1] || fallback));
  const nums = text.match(/\d+/g);
  if (!nums || nums.length === 0) return fallback;
  return Math.max(1, Number(nums[nums.length - 1] || fallback));
}

function inferTagsFromEffectText(raw) {
  const text = String(raw || "");
  const tags = [];

  if (/崇拜光环|崇拜光環/.test(text) && /转化|轉化/.test(text) && /乳牛|牛/.test(text)) {
    tags.push("aura_enemy_transform_cow");
  }
  if (/每回合.*召唤|每回合.*召喚|召唤.*最多|召喚.*最多/.test(text)) tags.push("summon_token");
  if (/死亡后.*复活|死亡後.*復活|重生|复活一次|復活一次/.test(text)) tags.push("revive_once");
  if (/婚约|婚約/.test(text)) tags.push("hero_guard");
  if (/秘剑术|秘劍術|飞剑|飛劍|转化|轉化/.test(text)) tags.push("ally_death_transform_flying_sword");
  if (/击退|擊退|后退|後退/.test(text)) tags.push("hot_wind_knockback");
  if (/中毒|毒刃|毒箭|剧毒|劇毒|巫毒|毒/.test(text)) tags.push("poison");
  if (/火焰|燃烧|燃燒|灼烧|灼燒|热风|熱風|火弹|火彈/.test(text)) tags.push("burn");
  if (/眩晕|暈眩|击晕|擊暈|无法行动|無法行動/.test(text)) tags.push("stun");
  if (/减速|減速|缓慢|緩慢/.test(text)) tags.push("slow");
  if (/吸血|生命偷取/.test(text)) tags.push("lifesteal");
  if (/反射|反伤|反傷/.test(text)) tags.push("reflect");
  if (/破甲|无视防御|無視防禦/.test(text)) tags.push("armor_break");
  if (/闪避|閃避/.test(text)) tags.push("dodge");
  if (/格挡|格擋|招架/.test(text)) tags.push("block");
  if (/光环|光環|每回合.*治疗|每回合.*治療/.test(text)) tags.push("step_heal");
  if (/每回合.*伤害|每回合.*傷害|落雷|雷击|雷擊/.test(text)) tags.push("step_damage");
  if (/攻击时|攻擊時|攻击后|攻擊後/.test(text) && /攻击\+|攻擊\+|ATK\+|atk\+/.test(text)) tags.push("on_attack_gain_atk");
  if (/受伤|受傷|被攻击|被攻擊/.test(text) && /无法行动|無法行動|眩晕|暈眩/.test(text)) tags.push("on_damaged_stun");
  if (/溅射|濺射|范围伤害|範圍傷害|2x1|2\*1/.test(text)) tags.push("splash");
  if (/射程|range/.test(text)) tags.push("range_up");
  if (/速度|疾风步|疾風步|移动|移動/.test(text)) tags.push("speed_up");
  if (/生命|HP|防御|防禦|护甲|護甲|重甲/.test(text)) tags.push("hp_up");
  if (/攻击|攻擊|ATK|atk/.test(text)) tags.push("atk_up");

  if (tags.length === 0) tags.push("fallback");
  return Array.from(new Set(tags));
}

function inferRuleFromEffect(raw) {
  return {
    key: parseEffectKey(raw),
    tags: inferTagsFromEffectText(raw),
    valueHint: parseHintValue(raw, 1),
    source: "editor-ai"
  };
}

function dataUrlSizeBytes(dataUrl) {
  const s = String(dataUrl || "");
  const i = s.indexOf(",");
  if (i < 0) return s.length;
  const b64 = s.slice(i + 1);
  return Math.floor((b64.length * 3) / 4);
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_decode_failed"));
    img.src = dataUrl;
  });
}

async function optimizeImageDataUrlForStorage(dataUrl) {
  const src = String(dataUrl || "");
  if (!src.startsWith("data:image/")) return src;
  if (dataUrlSizeBytes(src) <= IMAGE_STORE_MAX_BYTES) return src;

  const img = await loadImageFromDataUrl(src);
  let w = img.naturalWidth || 0;
  let h = img.naturalHeight || 0;
  if (!w || !h) return src;

  const MAX_W = 768;
  const MAX_H = 1152;
  const baseScale = Math.min(1, MAX_W / w, MAX_H / h);
  w = Math.max(64, Math.floor(w * baseScale));
  h = Math.max(64, Math.floor(h * baseScale));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;

  let best = src;
  const tryEncode = (type, q) => {
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL(type, q);
  };

  const qualities = [0.88, 0.8, 0.72, 0.64, 0.56];
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 0; i < qualities.length; i += 1) {
      const q = qualities[i];
      const webp = tryEncode("image/webp", q);
      if (dataUrlSizeBytes(webp) <= IMAGE_STORE_MAX_BYTES) return webp;
      if (dataUrlSizeBytes(webp) < dataUrlSizeBytes(best)) best = webp;

      const jpg = tryEncode("image/jpeg", q);
      if (dataUrlSizeBytes(jpg) <= IMAGE_STORE_MAX_BYTES) return jpg;
      if (dataUrlSizeBytes(jpg) < dataUrlSizeBytes(best)) best = jpg;
    }
    w = Math.max(64, Math.floor(w * 0.85));
    h = Math.max(64, Math.floor(h * 0.85));
  }

  return best;
}

async function persistCardImageToDisk(cardId, cardName, imageValue) {
  const src = String(imageValue || "");
  if (!src.startsWith("data:image/")) return src;

  const resp = await fetch(`${EDITOR_API_BASE}/api/assets/save-card-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cardId: String(cardId || "custom_card"),
      cardName: String(cardName || "card"),
      dataUrl: src
    })
  });

  if (!resp.ok) {
    let reason = "";
    try {
      const j = await resp.json();
      reason = String(j?.error || "");
    } catch {
      reason = "";
    }
    throw new Error(reason || `http_${resp.status}`);
  }

  const data = await resp.json();
  const imagePath = String(data?.imagePath || "");
  if (!imagePath.startsWith("/cards/")) throw new Error("invalid_image_path");
  return imagePath;
}

async function generateImageFromDescription(cardId, cardName, description, abilityText, options = {}) {
  const styleMode = String(options?.styleMode || "bright").trim().toLowerCase();
  const styleRefPath = String(options?.styleRefPath || "").trim();
  const cost = Number(options?.cost || 0);
  const atk = Number(options?.atk || 0);
  const hp = Number(options?.hp || 0);
  const resp = await fetch(`${EDITOR_API_BASE}/api/comfy/generate-from-description`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cardId: String(cardId || "custom_card"),
      cardName: String(cardName || "card"),
      description: String(description || ""),
      abilityText: String(abilityText || ""),
      cost,
      atk,
      hp,
      styleMode,
      styleRefPath
    })
  });

  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const reason = String(data?.error || data?.hint || `http_${resp.status}`);
    const stderr = String(data?.stderr || "");
    const stdout = String(data?.stdout || "");
    const attemptedCommand = String(data?.attemptedCommand || "");
    const attempts = Array.isArray(data?.attempts) ? data.attempts : [];
    const tried = attempts
      .map((a) => String(a?.cmd || "").trim())
      .filter((x) => x)
      .join(" -> ");
    const detail = [
      attemptedCommand ? `cmd: ${attemptedCommand}` : "",
      stderr ? `stderr: ${stderr}` : "",
      stdout ? `stdout: ${stdout}` : "",
      tried ? `tried: ${tried}` : ""
    ].filter((x) => x).join(" | ");
    throw new Error(detail ? `${reason} | ${detail}` : reason);
  }

  const imagePath = String(data?.imagePath || "");
  const usedPrompt = String(data?.usedPrompt || "");
  if (!imagePath.startsWith("/cards/")) throw new Error("invalid_image_path");
  return { imagePath, usedPrompt };
}

async function generateAttackFromDescription(cardId, cardName, description, abilityText, options = {}) {
  const frames = Math.max(1, Number(options?.frames || 16));
  const size = Math.max(128, Number(options?.size || 512));
  const resp = await fetch(`${EDITOR_API_BASE}/api/comfy/generate-attack-from-description`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cardId: String(cardId || "custom_card"),
      cardName: String(cardName || "card"),
      description: String(description || ""),
      abilityText: String(abilityText || ""),
      frames,
      size,
      autoStart: true,
      autoShutdown: true
    })
  });

  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const reason = String(data?.error || data?.hint || `http_${resp.status}`);
    const stderr = String(data?.stderr || "");
    const stdout = String(data?.stdout || "");
    const attemptedCommand = String(data?.attemptedCommand || "");
    const attempts = Array.isArray(data?.attempts) ? data.attempts : [];
    const tried = attempts
      .map((a) => String(a?.cmd || "").trim())
      .filter((x) => x)
      .join(" -> ");
    const detail = [
      attemptedCommand ? `cmd: ${attemptedCommand}` : "",
      stderr ? `stderr: ${stderr}` : "",
      stdout ? `stdout: ${stdout}` : "",
      tried ? `tried: ${tried}` : ""
    ].filter((x) => x).join(" | ");
    throw new Error(detail ? `${reason} | ${detail}` : reason);
  }

  const previewFramePath = String(data?.previewFramePath || "");
  const frameCount = Number(data?.frameCount || 0);
  const sequenceDir = String(data?.sequenceDir || "");
  if (!previewFramePath.startsWith("/cards/")) throw new Error("invalid_preview_frame_path");
  return { previewFramePath, frameCount, sequenceDir };
}

export default class CardEditorScene extends Phaser.Scene {
  constructor() {
    super("CardEditorScene");

    this.root = null;
    this.imageDataUrl = "";
    this.cardPool = [];
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0x0b1422);
    this.add.text(28, 20, "卡片編輯器", { fontSize: "34px", color: "#ffffff" });
    this.add.text(28, 62, "可查詢既有卡片並修改。可上傳圖片、設定攻擊/生命、填寫最多五條效果。", {
      fontSize: "14px",
      color: "#9db8ce"
    });

    this.add
      .text(w - 150, 20, "返回首頁", { fontSize: "22px", color: "#9ddcff" })
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.scene.start("MenuScene"));

    this.cardPool = CardFactory.getAllCardDefs();
    this._mountEditor();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._unmountEditor());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this._unmountEditor());
  }

  _defaultData() {
    const now = Date.now();
    return {
      id: `f_custom_${now}`,
      name: "新卡片",
      cost: 1,
      atk: 1,
      hp: 1,
      ability1: "",
      ability2: "",
      ability3: "",
      ability4: "",
      ability5: "",
      description: "",
      image: ""
    };
  }

  _nextCardId() {
    const pool = Array.isArray(this.cardPool) ? this.cardPool : [];
    let maxN = 70000;

    for (let i = 0; i < pool.length; i += 1) {
      const id = String(pool[i]?.id || "");
      const m = id.match(/^f_(\d+)$/i);
      if (!m) continue;
      const n = Number(m[1] || 0);
      if (Number.isFinite(n) && n > maxN) maxN = n;
    }
    return `f_${maxN + 1}`;
  }

  _loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this._defaultData();
      const parsed = JSON.parse(raw);
      return { ...this._defaultData(), ...parsed };
    } catch {
      return this._defaultData();
    }
  }

  _saveDraft(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return { ok: true };
    } catch {
      // Retry once without image payload when storage is full.
      try {
        const slim = { ...data, image: "" };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
        return { ok: true, downgraded: true };
      } catch {
        return { ok: false };
      }
    }
  }

  _readOverrides() {
    try {
      const raw = localStorage.getItem(OVERRIDE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  _writeOverrides(map, keepId = "") {
    try {
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map));
      return { ok: true };
    } catch {
      // If quota exceeded, drop image payloads from other cards and keep current one first.
      try {
        const next = { ...map };
        const keys = Object.keys(next);
        for (let i = 0; i < keys.length; i += 1) {
          const id = keys[i];
          if (id === keepId) continue;
          if (!next[id] || typeof next[id] !== "object") continue;
          if (next[id].image) next[id] = { ...next[id], image: "" };
        }
        localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next));
        return { ok: true, compacted: true };
      } catch {
        // Last retry: also strip current card image.
        try {
          const next = { ...map };
          if (keepId && next[keepId] && typeof next[keepId] === "object") {
            next[keepId] = { ...next[keepId], image: "" };
          }
          localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next));
          return { ok: true, downgraded: true };
        } catch {
          return { ok: false };
        }
      }
    }
  }

  _readEffectRuleOverrides() {
    try {
      const raw = localStorage.getItem(EFFECT_RULE_OVERRIDE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  _writeEffectRuleOverrides(map) {
    try {
      localStorage.setItem(EFFECT_RULE_OVERRIDE_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }

  _collectKnownEffectKeys() {
    const known = new Set();
    const pool = Array.isArray(this.cardPool) ? this.cardPool : [];
    for (let i = 0; i < pool.length; i += 1) {
      const c = pool[i];
      const effects = dedupeEffects([
        c?.ability1,
        c?.ability2,
        c?.ability3,
        c?.ability4,
        c?.ability5,
        ...(Array.isArray(c?.abilities) ? c.abilities : [])
      ]);
      for (let j = 0; j < effects.length; j += 1) {
        const key = parseEffectKey(effects[j]);
        if (key) known.add(key);
      }
    }
    return known;
  }

  _autoRegisterMissingEffectRules(cardData) {
    const effects = Array.isArray(cardData?.abilities) ? cardData.abilities : [];
    if (effects.length === 0) return { added: 0, updated: 0 };

    const knownKeys = this._collectKnownEffectKeys();
    const existingMap = this._readEffectRuleOverrides();
    let added = 0;
    let updated = 0;

    for (let i = 0; i < effects.length; i += 1) {
      const raw = String(effects[i] || "").trim();
      if (!raw) continue;

      const key = parseEffectKey(raw);
      if (!key) continue;
      if (knownKeys.has(key)) continue;
      if (existingMap[key]) continue;

      const inferred = inferRuleFromEffect(raw);
      if (!inferred.tags || inferred.tags.length === 0) continue;

      existingMap[key] = {
        key,
        tags: inferred.tags,
        valueHint: Math.max(1, Number(inferred.valueHint || 1)),
        samples: [raw],
        source: inferred.source
      };
      added += 1;
    }

    if (added > 0 || updated > 0) this._writeEffectRuleOverrides(existingMap);
    return { added, updated };
  }

  _mountEditor() {
    this._unmountEditor();

    const host = document.getElementById("app") || document.body;
    const draft = this._loadDraft();
    this.imageDataUrl = resolveEditorAssetUrl(draft.image || "");

    const wrap = document.createElement("div");
    wrap.id = "card-editor-root";
    wrap.style.position = "absolute";
    wrap.style.left = "24px";
    wrap.style.top = "100px";
    wrap.style.right = "24px";
    wrap.style.bottom = "20px";
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "minmax(500px, 1fr) minmax(360px, 460px)";
    wrap.style.gap = "16px";
    wrap.style.fontFamily = "Segoe UI, Noto Sans TC, sans-serif";
    wrap.style.pointerEvents = "auto";
    wrap.style.zIndex = "50";

    const formBox = document.createElement("div");
    formBox.style.background = "rgba(10,18,30,0.92)";
    formBox.style.border = "1px solid rgba(157,220,255,0.3)";
    formBox.style.borderRadius = "12px";
    formBox.style.padding = "14px";
    formBox.style.overflowY = "auto";

    const previewBox = document.createElement("div");
    previewBox.style.background = "rgba(10,18,30,0.92)";
    previewBox.style.border = "1px solid rgba(157,220,255,0.3)";
    previewBox.style.borderRadius = "12px";
    previewBox.style.padding = "14px";
    previewBox.style.overflow = "hidden";

    const previewToolRow = document.createElement("div");
    previewToolRow.style.display = "flex";
    previewToolRow.style.gap = "8px";
    previewToolRow.style.marginBottom = "10px";

    const previewSaveBtn = document.createElement("button");
    previewSaveBtn.textContent = "儲存草稿";
    previewSaveBtn.style.padding = "7px 10px";
    previewSaveBtn.style.borderRadius = "8px";
    previewSaveBtn.style.border = "1px solid #35577a";
    previewSaveBtn.style.background = "#173452";
    previewSaveBtn.style.color = "#eaf4ff";
    previewSaveBtn.style.cursor = "pointer";

    const previewApplyBtn = document.createElement("button");
    previewApplyBtn.textContent = "套用覆蓋";
    previewApplyBtn.style.padding = "7px 10px";
    previewApplyBtn.style.borderRadius = "8px";
    previewApplyBtn.style.border = "1px solid #35577a";
    previewApplyBtn.style.background = "#173452";
    previewApplyBtn.style.color = "#eaf4ff";
    previewApplyBtn.style.cursor = "pointer";

    const previewGenerateBtn = document.createElement("button");
    previewGenerateBtn.textContent = "依照描述生產適合的圖片";
    previewGenerateBtn.style.padding = "7px 10px";
    previewGenerateBtn.style.borderRadius = "8px";
    previewGenerateBtn.style.border = "1px solid #35577a";
    previewGenerateBtn.style.background = "#173452";
    previewGenerateBtn.style.color = "#eaf4ff";
    previewGenerateBtn.style.cursor = "pointer";

    const previewGenerateAttackBtn = document.createElement("button");
    previewGenerateAttackBtn.textContent = "依照描述生產攻擊動畫";
    previewGenerateAttackBtn.style.padding = "7px 10px";
    previewGenerateAttackBtn.style.borderRadius = "8px";
    previewGenerateAttackBtn.style.border = "1px solid #35577a";
    previewGenerateAttackBtn.style.background = "#173452";
    previewGenerateAttackBtn.style.color = "#eaf4ff";
    previewGenerateAttackBtn.style.cursor = "pointer";

    const previewAutoPipelineBtn = document.createElement("button");
    previewAutoPipelineBtn.textContent = "一鍵造卡（全自動）";
    previewAutoPipelineBtn.style.padding = "7px 10px";
    previewAutoPipelineBtn.style.borderRadius = "8px";
    previewAutoPipelineBtn.style.border = "1px solid #35577a";
    previewAutoPipelineBtn.style.background = "#1d3f63";
    previewAutoPipelineBtn.style.color = "#eaf4ff";
    previewAutoPipelineBtn.style.cursor = "pointer";

    const previewBackBtn = document.createElement("button");
    previewBackBtn.textContent = "返回首頁";
    previewBackBtn.style.padding = "7px 10px";
    previewBackBtn.style.borderRadius = "8px";
    previewBackBtn.style.border = "1px solid #35577a";
    previewBackBtn.style.background = "#173452";
    previewBackBtn.style.color = "#eaf4ff";
    previewBackBtn.style.cursor = "pointer";
    previewBackBtn.style.marginLeft = "auto";

    previewToolRow.appendChild(previewSaveBtn);
    previewToolRow.appendChild(previewApplyBtn);
    previewToolRow.appendChild(previewGenerateBtn);
    previewToolRow.appendChild(previewGenerateAttackBtn);
    previewToolRow.appendChild(previewAutoPipelineBtn);
    previewToolRow.appendChild(previewBackBtn);

    const previewContent = document.createElement("div");
    previewContent.style.height = "calc(100% - 40px)";
    previewContent.style.minHeight = "260px";

    previewBox.appendChild(previewToolRow);
    previewBox.appendChild(previewContent);

    wrap.appendChild(formBox);
    wrap.appendChild(previewBox);
    host.appendChild(wrap);
    this.root = wrap;

    const mkField = (label, htmlInput) => {
      const row = document.createElement("div");
      row.style.marginBottom = "10px";

      const lab = document.createElement("div");
      lab.textContent = label;
      lab.style.color = "#9ddcff";
      lab.style.fontSize = "13px";
      lab.style.marginBottom = "4px";

      row.appendChild(lab);
      row.appendChild(htmlInput);
      return row;
    };

    const styleInput = (el) => {
      el.style.width = "100%";
      el.style.boxSizing = "border-box";
      el.style.background = "#111a2a";
      el.style.color = "#eaf4ff";
      el.style.border = "1px solid #2d415f";
      el.style.borderRadius = "8px";
      el.style.padding = "8px";
      el.style.fontSize = "14px";
      return el;
    };

    const searchInput = styleInput(document.createElement("input"));
    searchInput.placeholder = "輸入名稱 / ID / sourceId 查詢既有卡片";

    const searchList = styleInput(document.createElement("select"));
    searchList.size = 6;

    const loadBtn = document.createElement("button");
    loadBtn.textContent = "載入此卡到編輯器";
    loadBtn.style.padding = "8px 12px";
    loadBtn.style.borderRadius = "8px";
    loadBtn.style.border = "1px solid #35577a";
    loadBtn.style.background = "#173452";
    loadBtn.style.color = "#eaf4ff";
    loadBtn.style.cursor = "pointer";

    const nameInput = styleInput(document.createElement("input"));
    nameInput.value = draft.name;

    const idInput = styleInput(document.createElement("input"));
    idInput.value = draft.id;

    const costInput = styleInput(document.createElement("input"));
    costInput.type = "number";
    costInput.min = "0";
    costInput.value = String(draft.cost);

    const atkInput = styleInput(document.createElement("input"));
    atkInput.type = "number";
    atkInput.min = "0";
    atkInput.value = String(draft.atk);

    const hpInput = styleInput(document.createElement("input"));
    hpInput.type = "number";
    hpInput.min = "1";
    hpInput.value = String(draft.hp);

    const abilityInputs = [];
    for (let i = 1; i <= 5; i += 1) {
      const t = styleInput(document.createElement("textarea"));
      t.rows = 2;
      t.value = String(draft[`ability${i}`] || "");
      abilityInputs.push(t);
    }

    const descInput = styleInput(document.createElement("textarea"));
    descInput.rows = 4;
    descInput.value = draft.description;

    const fileInput = styleInput(document.createElement("input"));
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.padding = "6px";
    const pasteHint = document.createElement("div");
    pasteHint.textContent = "可直接按 Ctrl+V 貼上剪貼簿圖片（如截圖）。";
    pasteHint.style.marginTop = "4px";
    pasteHint.style.fontSize = "12px";
    pasteHint.style.color = "#9db8ce";

    const searchWrap = document.createElement("div");
    searchWrap.style.border = "1px solid #2d415f";
    searchWrap.style.borderRadius = "10px";
    searchWrap.style.padding = "10px";
    searchWrap.style.marginBottom = "12px";
    searchWrap.style.background = "#0f1828";

    searchWrap.appendChild(mkField("查詢既有卡片", searchInput));
    searchWrap.appendChild(mkField("查詢結果（雙擊或按按鈕載入）", searchList));
    searchWrap.appendChild(loadBtn);
    formBox.appendChild(searchWrap);

    const topGrid = document.createElement("div");
    topGrid.style.display = "grid";
    topGrid.style.gridTemplateColumns = "1fr 1fr";
    topGrid.style.gap = "10px";

    topGrid.appendChild(mkField("卡片 ID", idInput));
    topGrid.appendChild(mkField("卡片名稱", nameInput));
    topGrid.appendChild(mkField("費用", costInput));
    topGrid.appendChild(mkField("攻擊", atkInput));
    topGrid.appendChild(mkField("生命", hpInput));

    formBox.appendChild(topGrid);

    for (let i = 1; i <= 5; i += 1) {
      formBox.appendChild(mkField(`效果 ${i}`, abilityInputs[i - 1]));
    }

    formBox.appendChild(mkField("描述", descInput));
    formBox.appendChild(mkField("上傳圖片", fileInput));
    formBox.appendChild(pasteHint);

    const animOptWrap = document.createElement("div");
    animOptWrap.style.display = "grid";
    animOptWrap.style.gridTemplateColumns = "1fr 1fr";
    animOptWrap.style.gap = "10px";
    animOptWrap.style.marginTop = "8px";

    const animFramesSelect = styleInput(document.createElement("select"));
    [12, 16, 20, 24].forEach((n) => {
      const op = document.createElement("option");
      op.value = String(n);
      op.textContent = `${n} 幀`;
      if (n === 16) op.selected = true;
      animFramesSelect.appendChild(op);
    });

    const animSizeSelect = styleInput(document.createElement("select"));
    [384, 512].forEach((n) => {
      const op = document.createElement("option");
      op.value = String(n);
      op.textContent = `${n} x ${n}`;
      if (n === 512) op.selected = true;
      animSizeSelect.appendChild(op);
    });

    animOptWrap.appendChild(mkField("攻擊動畫幀數", animFramesSelect));
    animOptWrap.appendChild(mkField("攻擊動畫尺寸", animSizeSelect));
    formBox.appendChild(animOptWrap);

    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.flexWrap = "wrap";
    btnRow.style.gap = "10px";
    btnRow.style.marginTop = "8px";

    const mkBtn = (text) => {
      const b = document.createElement("button");
      b.textContent = text;
      b.style.padding = "10px 14px";
      b.style.borderRadius = "8px";
      b.style.border = "1px solid #35577a";
      b.style.background = "#173452";
      b.style.color = "#eaf4ff";
      b.style.cursor = "pointer";
      return b;
    };

    const saveBtn = mkBtn("儲存草稿");
    const createBtn = mkBtn("新增卡片");
    const exportBtn = mkBtn("下載 JSON");
    const comfyGenerateBtn = mkBtn("依照描述生產適合的圖片");
    const comfyGenerateAttackBtn = mkBtn("依照描述生產攻擊動畫");
    const autoPipelineBtn = mkBtn("一鍵造卡（全自動）");
    autoPipelineBtn.style.background = "#1d3f63";
    const applyBtn = mkBtn("套用為本機覆蓋");
    const clearOverrideBtn = mkBtn("清除此卡覆蓋");
    const clearBtn = mkBtn("清空重填");

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(createBtn);
    btnRow.appendChild(exportBtn);
    btnRow.appendChild(comfyGenerateBtn);
    btnRow.appendChild(comfyGenerateAttackBtn);
    btnRow.appendChild(autoPipelineBtn);
    btnRow.appendChild(applyBtn);
    btnRow.appendChild(clearOverrideBtn);
    btnRow.appendChild(clearBtn);
    formBox.appendChild(btnRow);

    const msg = document.createElement("div");
    msg.style.marginTop = "10px";
    msg.style.color = "#9db8ce";
    msg.style.fontSize = "13px";
    formBox.appendChild(msg);

    const eventModal = document.createElement("div");
    eventModal.style.position = "fixed";
    eventModal.style.left = "0";
    eventModal.style.top = "0";
    eventModal.style.right = "0";
    eventModal.style.bottom = "0";
    eventModal.style.background = "rgba(0,0,0,0.55)";
    eventModal.style.display = "none";
    eventModal.style.alignItems = "center";
    eventModal.style.justifyContent = "center";
    eventModal.style.zIndex = "9999";

    const eventCard = document.createElement("div");
    eventCard.style.width = "min(860px, 92vw)";
    eventCard.style.maxHeight = "78vh";
    eventCard.style.background = "#0e1b2e";
    eventCard.style.border = "1px solid #3b5e82";
    eventCard.style.borderRadius = "12px";
    eventCard.style.padding = "12px";
    eventCard.style.display = "flex";
    eventCard.style.flexDirection = "column";
    eventCard.style.gap = "8px";

    const eventHead = document.createElement("div");
    eventHead.style.display = "flex";
    eventHead.style.alignItems = "center";
    eventHead.style.justifyContent = "space-between";
    const eventTitle = document.createElement("div");
    eventTitle.textContent = "執行事件";
    eventTitle.style.color = "#eaf4ff";
    eventTitle.style.fontSize = "18px";
    eventTitle.style.fontWeight = "700";
    const eventClose = document.createElement("button");
    eventClose.textContent = "關閉";
    eventClose.style.padding = "6px 10px";
    eventClose.style.borderRadius = "8px";
    eventClose.style.border = "1px solid #35577a";
    eventClose.style.background = "#173452";
    eventClose.style.color = "#eaf4ff";
    eventClose.style.cursor = "pointer";
    eventHead.appendChild(eventTitle);
    eventHead.appendChild(eventClose);

    const eventLog = document.createElement("div");
    eventLog.style.border = "1px solid #2d415f";
    eventLog.style.borderRadius = "8px";
    eventLog.style.padding = "10px";
    eventLog.style.background = "#101a2a";
    eventLog.style.color = "#d8ebff";
    eventLog.style.fontFamily = "Consolas, Menlo, monospace";
    eventLog.style.fontSize = "13px";
    eventLog.style.lineHeight = "1.5";
    eventLog.style.whiteSpace = "pre-wrap";
    eventLog.style.overflowY = "auto";
    eventLog.style.minHeight = "220px";
    eventLog.style.maxHeight = "62vh";

    const progressWrap = document.createElement("div");
    progressWrap.style.border = "1px solid #2d415f";
    progressWrap.style.borderRadius = "999px";
    progressWrap.style.height = "10px";
    progressWrap.style.overflow = "hidden";
    progressWrap.style.background = "#0a1320";
    progressWrap.style.display = "none";
    progressWrap.style.position = "relative";

    const progressBar = document.createElement("div");
    progressBar.style.height = "100%";
    progressBar.style.width = "0%";
    progressBar.style.background = "linear-gradient(90deg,#3aa0ff,#7ad3ff)";
    progressBar.style.transition = "width 0.28s ease";
    progressWrap.appendChild(progressBar);

    eventCard.appendChild(eventHead);
    eventCard.appendChild(progressWrap);
    eventCard.appendChild(eventLog);
    eventModal.appendChild(eventCard);
    wrap.appendChild(eventModal);

    const nowStamp = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    };
    const openEventLog = (title = "執行事件") => {
      eventTitle.textContent = title;
      eventLog.textContent = "";
      eventModal.style.display = "flex";
    };
    const appendEventLog = (line) => {
      eventLog.textContent += `[${nowStamp()}] ${String(line || "")}\n`;
      eventLog.scrollTop = eventLog.scrollHeight;
    };
    let progressTimer = null;
    const clearProgressTimer = () => {
      if (progressTimer) {
        window.clearInterval(progressTimer);
        progressTimer = null;
      }
    };
    const setProgress = (pct) => {
      const v = Math.max(0, Math.min(100, Number(pct || 0)));
      progressBar.style.width = `${v.toFixed(0)}%`;
    };
    const startProgress = (mode = "image") => {
      clearProgressTimer();
      progressWrap.style.display = "block";
      const startedAt = Date.now();
      setProgress(5);
      const expectedMs = mode === "attack" ? 70000 : 50000;
      progressTimer = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const t = Math.max(0, elapsed);
        let target = 5;

        // 0%~35%: warmup, slow and stable
        if (t <= expectedMs * 0.35) {
          target = 5 + (t / (expectedMs * 0.35)) * 30;
        } else if (t <= expectedMs * 0.8) {
          // 35%~75%: middle stage
          const p = (t - expectedMs * 0.35) / (expectedMs * 0.45);
          target = 35 + p * 40;
        } else {
          // 75%~93%: tail stage, very slow
          const p = Math.min(1, (t - expectedMs * 0.8) / (expectedMs * 1.2));
          target = 75 + p * 18;
        }

        const current = Number(progressBar.style.width.replace("%", "")) || 0;
        const next = Math.max(current, Math.min(93, target));
        setProgress(next);
      }, 250);
    };
    const finishProgress = (ok = true) => {
      clearProgressTimer();
      progressBar.style.background = ok
        ? "linear-gradient(90deg,#3aa0ff,#7ad3ff)"
        : "linear-gradient(90deg,#bf445f,#e35d6a)";
      setProgress(100);
      window.setTimeout(() => {
        progressWrap.style.display = "none";
        progressBar.style.background = "linear-gradient(90deg,#3aa0ff,#7ad3ff)";
        setProgress(0);
      }, 500);
    };
    const closeEventLog = () => {
      eventModal.style.display = "none";
      clearProgressTimer();
      progressWrap.style.display = "none";
      setProgress(0);
    };
    eventClose.addEventListener("click", closeEventLog);
    eventModal.addEventListener("click", (ev) => {
      if (ev.target === eventModal) closeEventLog();
    });

    const setFormFromCard = (card) => {
      if (!card) return;
      idInput.value = String(card.id || "");
      nameInput.value = String(card.name || "");
      costInput.value = String(Number(card.cost ?? card.baseCost ?? 0));
      atkInput.value = String(Number(card.unit?.atk ?? 1));
      hpInput.value = String(Number(card.unit?.hp ?? 1));
      descInput.value = String(card.description || "");      const effects = dedupeEffects([
        card.ability1,
        card.ability2,
        card.ability3,
        card.ability4,
        card.ability5,
        ...(Array.isArray(card.abilities) ? card.abilities : [])
      ]);

      for (let i = 0; i < 5; i += 1) {
        abilityInputs[i].value = effects[i] || "";
      }

      this.imageDataUrl = resolveEditorAssetUrl(card.image || "");
      renderPreview();
    };

    const runSearch = () => {
      const qRaw = String(searchInput.value || "").trim();
      const q = foldSearchText(qRaw);
      const filtered = q
        ? this.cardPool.filter((c) => {
            const a = foldSearchText(String(c.id || ""));
            const b = foldSearchText(String(c.name || ""));
            const d = foldSearchText(String(c.sourceId || ""));
            return a.includes(q) || b.includes(q) || d.includes(q);
          })
        : this.cardPool.slice();

      const max = 200;
      const show = filtered.slice(0, max);

      searchList.innerHTML = "";
      for (let i = 0; i < show.length; i += 1) {
        const c = show[i];
        const op = document.createElement("option");
        op.value = c.id;
        op.textContent = `${c.name} [${c.id}] 費:${c.cost} HP:${c.unit.hp} ATK:${c.unit.atk}`;
        searchList.appendChild(op);
      }

      msg.textContent = `查詢結果：${filtered.length} 筆${filtered.length > max ? `（僅顯示前 ${max} 筆）` : ""}`;
    };

    const loadSelected = () => {
      const id = String(searchList.value || "").trim();
      if (!id) return;
      const card = this.cardPool.find((x) => x.id === id);
      if (!card) return;
      setFormFromCard(card);
      msg.textContent = `已載入卡片：${card.name} (${card.id})`;
    };

    const renderPreview = () => {
      const data = this._collectData({
        idInput,
        nameInput,
        costInput,
        atkInput,
        hpInput,
        abilityInputs,
        descInput
      });

      const effects = data.abilities.length > 0
        ? data.abilities.map((e, i) => `<li>${i + 1}. ${escHtml(e)}</li>`).join("")
        : "<li>（尚未填寫效果）</li>";

      const previewTags = Array.from(
        data.abilities.reduce((set, ab) => {
          const r = inferRuleFromEffect(ab);
          const tags = Array.isArray(r?.tags) ? r.tags : [];
          for (let i = 0; i < tags.length; i += 1) {
            const t = String(tags[i] || "").trim();
            if (t) set.add(t);
          }
          return set;
        }, new Set())
      );
      const tagHtml = previewTags.length > 0
        ? previewTags.map((t) => `<span style="display:inline-block;padding:2px 8px;border:1px solid #3a5a7f;border-radius:999px;background:#12263f;color:#9ddcff;font-size:11px;line-height:1.4;">${escHtml(t)}</span>`).join("")
        : `<span style="display:inline-block;padding:2px 8px;border:1px solid #38475b;border-radius:999px;background:#152135;color:#9db8ce;font-size:11px;line-height:1.4;">無</span>`;

      const imgHtml = this.imageDataUrl
        ? `<img src="${this.imageDataUrl}" style="width:100%;height:100%;object-fit:cover;" />`
        : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#9db8ce;">No Image</div>`;

      previewContent.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;gap:10px;">
          <div style="font-size:20px;color:#fff;font-weight:700;">即時預覽</div>
          <div style="display:grid;grid-template-columns:170px 1fr;gap:12px;min-height:320px;">
            <div style="border:1px solid #466a90;border-radius:8px;padding:6px;background:#0f1828;display:flex;flex-direction:column;">
              <div style="height:220px;border:1px solid #2d415f;border-radius:6px;overflow:hidden;background:#111a2a;">
                ${imgHtml}
              </div>
              <div style="margin-top:8px;color:#eaf4ff;font-size:14px;line-height:1.6;">
                費用: ${data.cost}<br/>
                HP: ${data.hp}<br/>
                ATK: ${data.atk}
                <div style="margin-top:8px;">
                  <div style="color:#ffdca8;font-size:12px;font-weight:700;">能力標籤</div>
                  <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px;">
                    ${tagHtml}
                  </div>
                </div>
              </div>
            </div>
            <div style="border:1px solid #2d415f;border-radius:8px;padding:10px;background:#0f1828;color:#eaf4ff;overflow:auto;">
              <div style="font-size:24px;font-weight:700;margin-bottom:6px;">${escHtml(data.name)}</div>
              <div style="color:#9ddcff;font-size:12px;margin-bottom:8px;">ID: ${escHtml(data.id)}</div>
              <div style="color:#ffdca8;font-weight:700;margin-bottom:4px;">效果</div>
              <ul style="margin:0 0 10px 18px;padding:0;line-height:1.5;">${effects}</ul>
              <div style="color:#ffdca8;font-weight:700;margin-bottom:4px;">描述</div>
              <div style="line-height:1.5;white-space:pre-wrap;">${escHtml(data.description || "（尚未填寫）")}</div>
            </div>
          </div>
        </div>
      `;
    };

    const doSaveDraft = async () => {
      openEventLog("儲存卡片");
      appendEventLog("開始儲存流程");
      const data = this._collectData({ idInput, nameInput, costInput, atkInput, hpInput, abilityInputs, descInput });
      data.image = await optimizeImageDataUrlForStorage(this.imageDataUrl || "");
      appendEventLog("圖片壓縮/最佳化完成");
      let diskWriteFailed = false;
      try {
        appendEventLog("寫入圖片到本機硬碟");
        data.image = await persistCardImageToDisk(data.id, data.name, data.image);
        appendEventLog(`圖片寫入成功：${data.image}`);
      } catch (err) {
        appendEventLog(`失敗：圖片寫入失敗 -> ${String(err?.message || err)}`);
        diskWriteFailed = true;
        // no backend mode: keep local image payload and continue saving draft/override.
      }
      this.imageDataUrl = resolveEditorAssetUrl(data.image);
      const saveResult = this._saveDraft(data);
      const aiResult = this._autoRegisterMissingEffectRules(data);
      appendEventLog(`草稿儲存：${saveResult.ok ? "成功" : "失敗"}，新增規則 ${aiResult.added} 條`);
      if (!saveResult.ok) {
        msg.textContent = "儲存失敗：本機容量不足。請減少圖片大小或清理部分本機卡片覆蓋。";
        appendEventLog("失敗：localStorage 容量不足");
        return false;
      }

      const map = this._readOverrides();
      map[data.id] = {
        id: data.id,
        name: data.name,
        cost: data.cost,
        image: data.image,
        description: data.description,
        ability1: data.ability1,
        ability2: data.ability2,
        ability3: data.ability3,
        ability4: data.ability4,
        ability5: data.ability5,
        abilities: data.abilities,
        unit: {
          name: data.name,
          hp: data.hp,
          atk: data.atk
        }
      };
      const writeResult = this._writeOverrides(map, data.id);
      if (!writeResult.ok) {
        msg.textContent = "儲存失敗：本機覆蓋寫入失敗（容量不足）。";
        appendEventLog("失敗：覆蓋資料寫入失敗");
        return false;
      }

      if (saveResult.downgraded || writeResult.downgraded) {
        msg.textContent = `已儲存並套用新卡，但圖片因容量限制未保存；AI 新增 ${aiResult.added} 條效果規則。`;
      } else if (writeResult.compacted) {
        msg.textContent = `已儲存並套用新卡，且清理其他卡片舊圖片以騰出容量；AI 新增 ${aiResult.added} 條效果規則。`;
      } else if (diskWriteFailed) {
        msg.textContent = `已儲存草稿與覆蓋（本機模式，圖片未寫入伺服器硬碟）；AI 新增 ${aiResult.added} 條效果規則。`;
      } else {
        msg.textContent = `已儲存並套用新卡：${data.id}；AI 新增 ${aiResult.added} 條效果規則。`;
      }

      this.cardPool = CardFactory.getAllCardDefs();
      runSearch();
      renderPreview();
      appendEventLog("完成：卡片已加入卡池並更新預覽");
      return true;
    };

    const doApplyOverride = async () => {
      const data = this._collectData({ idInput, nameInput, costInput, atkInput, hpInput, abilityInputs, descInput });
      data.image = await optimizeImageDataUrlForStorage(this.imageDataUrl || "");
      let diskWriteFailed = false;
      try {
        data.image = await persistCardImageToDisk(data.id, data.name, data.image);
      } catch (err) {
        diskWriteFailed = true;
      }
      this.imageDataUrl = resolveEditorAssetUrl(data.image);
      const aiResult = this._autoRegisterMissingEffectRules(data);

      const map = this._readOverrides();
      map[data.id] = {
        id: data.id,
        name: data.name,
        cost: data.cost,
        image: data.image,
        description: data.description,
        ability1: data.ability1,
        ability2: data.ability2,
        ability3: data.ability3,
        ability4: data.ability4,
        ability5: data.ability5,
        abilities: data.abilities,
        unit: {
          name: data.name,
          hp: data.hp,
          atk: data.atk
        }
      };
      const writeResult = this._writeOverrides(map, data.id);
      if (!writeResult.ok) {
        msg.textContent = "套用失敗：本機容量不足。請減少圖片大小或清理部分本機卡片覆蓋。";
        return;
      }
      if (writeResult.downgraded) {
        msg.textContent = `已套用本機覆蓋：${data.id}，但圖片因容量限制未保存；AI 新增 ${aiResult.added} 條效果規則。`;
      } else if (writeResult.compacted) {
        msg.textContent = `已套用本機覆蓋：${data.id}，並清理其他卡片舊圖片以騰出容量；AI 新增 ${aiResult.added} 條效果規則。`;
      } else if (diskWriteFailed) {
        msg.textContent = `已套用本機覆蓋：${data.id}（本機模式，圖片未寫入伺服器硬碟）；AI 新增 ${aiResult.added} 條效果規則。`;
      } else {
        msg.textContent = `已套用本機覆蓋：${data.id}（返回戰鬥/牌組頁會讀到新值），AI 新增 ${aiResult.added} 條效果規則。`;
      }

      this.cardPool = CardFactory.getAllCardDefs();
      runSearch();
      renderPreview();
    };

    const handleChange = () => renderPreview();
    [nameInput, idInput, costInput, atkInput, hpInput, descInput, ...abilityInputs].forEach((el) => {
      el.addEventListener("input", handleChange);
    });

    searchInput.addEventListener("input", runSearch);
    loadBtn.addEventListener("click", loadSelected);
    searchList.addEventListener("dblclick", loadSelected);

    fileInput.addEventListener("change", (ev) => {
      const f = ev.target?.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.imageDataUrl = String(reader.result || "");
        renderPreview();
      };
      reader.readAsDataURL(f);
    });

    const handlePasteImage = (ev) => {
      const data = ev?.clipboardData;
      if (!data?.items) return;

      for (let i = 0; i < data.items.length; i += 1) {
        const item = data.items[i];
        if (!item || item.kind !== "file") continue;
        if (!String(item.type || "").startsWith("image/")) continue;

        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = () => {
          this.imageDataUrl = String(reader.result || "");
          renderPreview();
          msg.textContent = "已貼上剪貼簿圖片。";
        };
        reader.readAsDataURL(file);
        ev.preventDefault();
        return;
      }
    };

    window.addEventListener("paste", handlePasteImage);

    saveBtn.addEventListener("click", doSaveDraft);
    previewSaveBtn.addEventListener("click", doSaveDraft);

    createBtn.addEventListener("click", () => {
      const d = this._defaultData();
      d.id = this._nextCardId();
      d.name = "新卡片";
      idInput.value = d.id;
      nameInput.value = d.name;
      costInput.value = String(d.cost);
      atkInput.value = String(d.atk);
      hpInput.value = String(d.hp);
      descInput.value = "";
      abilityInputs.forEach((el) => {
        el.value = "";
      });
      this.imageDataUrl = "";
      renderPreview();
      msg.textContent = `已建立新卡草稿：${d.id}。填寫後按「儲存草稿」即可直接加入卡池。`;
    });

    exportBtn.addEventListener("click", () => {
      const data = this._collectData({ idInput, nameInput, costInput, atkInput, hpInput, abilityInputs, descInput });
      data.image = this.imageDataUrl || "";

      const payload = {
        id: data.id,
        name: data.name,
        type: "summon",
        cost: data.cost,
        image: data.image,
        description: data.description,
        ability1: data.ability1,
        ability2: data.ability2,
        ability3: data.ability3,
        ability4: data.ability4,
        ability5: data.ability5,
        abilities: data.abilities,
        unit: {
          name: data.name,
          hp: data.hp,
          atk: data.atk,
          range: 40,
          speed: 35,
          atkCdMs: 1000
        }
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${data.id || "custom_card"}.json`;
      a.click();
      URL.revokeObjectURL(a.href);

      msg.textContent = "已下載 JSON，可再整合到卡池資料。";
    });

    const doGenerateFromDescription = async () => {
      openEventLog("依描述產生插圖");
      startProgress("image");
      const data = this._collectData({ idInput, nameInput, costInput, atkInput, hpInput, abilityInputs, descInput });
      const effectText = data.abilities.join("；");
      const desc = String(data.description || "").trim();
      const styleMode = LOCKED_IMAGE_STYLE_MODE;
      const styleRefPath = LOCKED_IMAGE_STYLE_REF;

      if (!desc && !effectText) {
        appendEventLog("中止：描述與效果都空白");
        msg.textContent = "請先填寫描述或效果，再使用依照描述生產適合的圖片。";
        return false;
      }
      appendEventLog("開始呼叫後端 API /api/comfy/generate-from-description");
      appendEventLog(`生圖風格（鎖定）：${styleMode} | 基底圖（鎖定）：${styleRefPath}`);

      const oldMainLabel = comfyGenerateBtn.textContent;
      const oldPreviewLabel = previewGenerateBtn.textContent;
      comfyGenerateBtn.disabled = true;
      previewGenerateBtn.disabled = true;
      comfyGenerateAttackBtn.disabled = true;
      previewGenerateAttackBtn.disabled = true;
      autoPipelineBtn.disabled = true;
      previewAutoPipelineBtn.disabled = true;
      comfyGenerateBtn.textContent = "生成中…";
      previewGenerateBtn.textContent = "生成中…";
      comfyGenerateBtn.style.opacity = "0.75";
      previewGenerateBtn.style.opacity = "0.75";
      comfyGenerateAttackBtn.style.opacity = "0.75";
      previewGenerateAttackBtn.style.opacity = "0.75";
      autoPipelineBtn.style.opacity = "0.75";
      previewAutoPipelineBtn.style.opacity = "0.75";

      try {
        const result = await generateImageFromDescription(data.id, data.name, desc, effectText, {
          styleMode,
          styleRefPath,
          cost: data.cost,
          atk: data.atk,
          hp: data.hp
        });
        const imagePath = String(result?.imageUrl || result?.imagePath || "");
        this.imageDataUrl = `${encodeURI(resolveEditorAssetUrl(imagePath))}?v=${Date.now()}`;
        renderPreview();
        msg.textContent = `生成成功：${imagePath}`;
        appendEventLog(`成功：插圖生成完成 -> ${imagePath}`);
        if (result?.usedPrompt) appendEventLog(`本次使用提示詞：${result.usedPrompt}`);
        finishProgress(true);
        return true;
      } catch (err) {
        appendEventLog(`失敗：${String(err?.message || err)}`);
        msg.textContent = `生成失敗：${String(err?.message || err)}。請確認 npm run dev:all、ComfyUI(:8188)、Python requests 已就緒。`;
        finishProgress(false);
        return false;
      } finally {
        comfyGenerateBtn.disabled = false;
        previewGenerateBtn.disabled = false;
        comfyGenerateAttackBtn.disabled = false;
        previewGenerateAttackBtn.disabled = false;
        autoPipelineBtn.disabled = false;
        previewAutoPipelineBtn.disabled = false;
        comfyGenerateBtn.textContent = oldMainLabel;
        previewGenerateBtn.textContent = oldPreviewLabel;
        comfyGenerateBtn.style.opacity = "1";
        previewGenerateBtn.style.opacity = "1";
        comfyGenerateAttackBtn.style.opacity = "1";
        previewGenerateAttackBtn.style.opacity = "1";
        autoPipelineBtn.style.opacity = "1";
        previewAutoPipelineBtn.style.opacity = "1";
      }
    };

    const doGenerateAttackFromDescription = async () => {
      openEventLog("依描述產生攻擊動畫");
      startProgress("attack");
      const data = this._collectData({ idInput, nameInput, costInput, atkInput, hpInput, abilityInputs, descInput });
      const effectText = data.abilities.join("；");
      const desc = String(data.description || "").trim();
      const animFrames = Number(animFramesSelect.value || 16);
      const animSize = Number(animSizeSelect.value || 512);

      if (!desc && !effectText) {
        appendEventLog("中止：描述與效果都空白");
        msg.textContent = "請先填寫描述或效果，再使用依照描述生產攻擊動畫。";
        return false;
      }
      appendEventLog(`開始呼叫攻擊動畫 API，幀數=${animFrames}，尺寸=${animSize}`);

      const oldMainLabel = comfyGenerateAttackBtn.textContent;
      const oldPreviewLabel = previewGenerateAttackBtn.textContent;
      comfyGenerateBtn.disabled = true;
      previewGenerateBtn.disabled = true;
      comfyGenerateAttackBtn.disabled = true;
      previewGenerateAttackBtn.disabled = true;
      autoPipelineBtn.disabled = true;
      previewAutoPipelineBtn.disabled = true;
      comfyGenerateAttackBtn.textContent = "動畫生成中…";
      previewGenerateAttackBtn.textContent = "動畫生成中…";
      comfyGenerateBtn.style.opacity = "0.75";
      previewGenerateBtn.style.opacity = "0.75";
      comfyGenerateAttackBtn.style.opacity = "0.75";
      previewGenerateAttackBtn.style.opacity = "0.75";
      autoPipelineBtn.style.opacity = "0.75";
      previewAutoPipelineBtn.style.opacity = "0.75";

      try {
        const result = await generateAttackFromDescription(data.id, data.name, desc, effectText, {
          frames: animFrames,
          size: animSize
        });
        const previewFramePath = String(result?.previewFrameUrl || result?.previewFramePath || "");
        this.imageDataUrl = `${encodeURI(resolveEditorAssetUrl(previewFramePath))}?v=${Date.now()}`;
        renderPreview();
        msg.textContent = `攻擊動畫生成成功：${result.sequenceDir}（${result.frameCount} 幀）`;
        appendEventLog(`成功：動畫輸出 -> ${result.sequenceDir}，幀數=${result.frameCount}`);
        finishProgress(true);
        return true;
      } catch (err) {
        appendEventLog(`失敗：${String(err?.message || err)}`);
        msg.textContent = `攻擊動畫生成失敗：${String(err?.message || err)}。`;
        finishProgress(false);
        return false;
      } finally {
        comfyGenerateBtn.disabled = false;
        previewGenerateBtn.disabled = false;
        comfyGenerateAttackBtn.disabled = false;
        previewGenerateAttackBtn.disabled = false;
        autoPipelineBtn.disabled = false;
        previewAutoPipelineBtn.disabled = false;
        comfyGenerateAttackBtn.textContent = oldMainLabel;
        previewGenerateAttackBtn.textContent = oldPreviewLabel;
        comfyGenerateBtn.style.opacity = "1";
        previewGenerateBtn.style.opacity = "1";
        comfyGenerateAttackBtn.style.opacity = "1";
        previewGenerateAttackBtn.style.opacity = "1";
        autoPipelineBtn.style.opacity = "1";
        previewAutoPipelineBtn.style.opacity = "1";
      }
    };

    const doAutoPipeline = async () => {
      openEventLog("一鍵造卡（全自動）");
      appendEventLog("步驟1/3：儲存卡片");
      const oldMainLabel = autoPipelineBtn.textContent;
      const oldPreviewLabel = previewAutoPipelineBtn.textContent;
      autoPipelineBtn.textContent = "一鍵流程執行中…";
      previewAutoPipelineBtn.textContent = "一鍵流程執行中…";

      const saved = await doSaveDraft();
      if (!saved) {
        appendEventLog("流程中止：步驟1失敗");
        autoPipelineBtn.textContent = oldMainLabel;
        previewAutoPipelineBtn.textContent = oldPreviewLabel;
        return;
      }

      appendEventLog("步驟2/3：依描述產生插圖");
      const drew = await doGenerateFromDescription();
      if (!drew) {
        appendEventLog("流程中止：步驟2失敗");
        autoPipelineBtn.textContent = oldMainLabel;
        previewAutoPipelineBtn.textContent = oldPreviewLabel;
        return;
      }

      appendEventLog("步驟3/3：依描述產生攻擊動畫");
      const animated = await doGenerateAttackFromDescription();
      if (!animated) {
        appendEventLog("流程中止：步驟3失敗");
        autoPipelineBtn.textContent = oldMainLabel;
        previewAutoPipelineBtn.textContent = oldPreviewLabel;
        return;
      }

      appendEventLog("流程完成：三步皆成功");
      msg.textContent = "一鍵流程完成：已儲存卡片、產生插圖、產生攻擊動畫。";
      autoPipelineBtn.textContent = oldMainLabel;
      previewAutoPipelineBtn.textContent = oldPreviewLabel;
    };

    comfyGenerateBtn.addEventListener("click", doGenerateFromDescription);
    previewGenerateBtn.addEventListener("click", doGenerateFromDescription);
    comfyGenerateAttackBtn.addEventListener("click", doGenerateAttackFromDescription);
    previewGenerateAttackBtn.addEventListener("click", doGenerateAttackFromDescription);
    autoPipelineBtn.addEventListener("click", doAutoPipeline);
    previewAutoPipelineBtn.addEventListener("click", doAutoPipeline);
    previewBackBtn.addEventListener("click", () => this.scene.start("MenuScene"));

    applyBtn.addEventListener("click", doApplyOverride);
    previewApplyBtn.addEventListener("click", doApplyOverride);

    clearOverrideBtn.addEventListener("click", () => {
      const id = String(idInput.value || "").trim();
      if (!id) return;

      const map = this._readOverrides();
      if (map[id]) {
        delete map[id];
        this._writeOverrides(map);
        msg.textContent = `已清除此卡覆蓋：${id}`;
      } else {
        msg.textContent = `此卡沒有覆蓋資料：${id}`;
      }

      this.cardPool = CardFactory.getAllCardDefs();
      runSearch();
    });

    clearBtn.addEventListener("click", () => {
      const d = this._defaultData();
      idInput.value = d.id;
      nameInput.value = d.name;
      costInput.value = String(d.cost);
      atkInput.value = String(d.atk);
      hpInput.value = String(d.hp);
      descInput.value = d.description;
      abilityInputs.forEach((el) => {
        el.value = "";
      });
      this.imageDataUrl = "";
      renderPreview();
      msg.textContent = "已清空。";
    });

    runSearch();
    renderPreview();

    const originalUnmount = this._unmountEditor.bind(this);
    this._unmountEditor = () => {
      window.removeEventListener("paste", handlePasteImage);
      this._unmountEditor = originalUnmount;
      originalUnmount();
    };
  }

  _collectData(refs) {
    const toInt = (v, d = 0) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return d;
      return Math.floor(n);
    };

        const abilities = dedupeEffects(refs.abilityInputs.map((el) => el.value));

    return {
      id: String(refs.idInput.value || "custom_card").trim(),
      name: String(refs.nameInput.value || "未命名卡片").trim(),
      cost: Math.max(0, toInt(refs.costInput.value, 0)),
      atk: Math.max(0, toInt(refs.atkInput.value, 0)),
      hp: Math.max(1, toInt(refs.hpInput.value, 1)),
      description: String(refs.descInput.value || "").trim(),
      ability1: abilities[0] || "",
      ability2: abilities[1] || "",
      ability3: abilities[2] || "",
      ability4: abilities[3] || "",
      ability5: abilities[4] || "",
      abilities
    };
  }

  _unmountEditor() {
    if (this.root && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
    this.root = null;
  }
}

