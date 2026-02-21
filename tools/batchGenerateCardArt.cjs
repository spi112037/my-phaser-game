/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(PROJECT_ROOT, "src", "data", "flameCardsBest.json");
const OUT_DIR = path.join(PROJECT_ROOT, "public", "cards", "generated");

const SD_API = process.env.SD_API || "http://127.0.0.1:7860";
const MODEL_NAME = process.env.SD_MODEL || "";
const BATCH_LIMIT = Number(process.env.BATCH_LIMIT || "0");
const WRITE_IMAGE_FIELD = String(process.env.WRITE_IMAGE_FIELD || "1") === "1";

const STYLE_PREFIX =
  "原創角色設計，日系動漫幻想卡牌插畫，乾淨線稿，精緻臉部與眼神，細緻髮絲，動態構圖，華麗特效，high detail, anime style, original character";
const NEGATIVE_PROMPT =
  "lowres, blurry, watermark, logo, text, ui, frame, extra fingers, bad hands, deformed, nsfw, nude";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toPrompt(card) {
  const base = String(card.description || "").trim();
  const trimmed = base.replace(/^【AI產圖提示詞】\s*/g, "");
  return `${STYLE_PREFIX}\n${trimmed}\n角色要求：女性角色，服裝完整，原創，不對應任何既有IP。`;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${text}`.trim());
  }
  return res.json();
}

async function setModelIfNeeded() {
  if (!MODEL_NAME) return;
  await fetchJson(`${SD_API}/sdapi/v1/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sd_model_checkpoint: MODEL_NAME })
  });
  await sleep(1200);
}

async function txt2img(prompt, seed) {
  return fetchJson(`${SD_API}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      steps: 30,
      sampler_name: "DPM++ 2M Karras",
      cfg_scale: 7,
      width: 768,
      height: 1152,
      seed,
      batch_size: 1,
      n_iter: 1
    })
  });
}

function writeBase64Png(base64, outPath) {
  const bin = Buffer.from(base64, "base64");
  fs.writeFileSync(outPath, bin);
}

async function main() {
  ensureDir(OUT_DIR);

  const raw = fs.readFileSync(DATA_FILE, "utf8").replace(/^\uFEFF/, "");
  const db = JSON.parse(raw);
  const cards = Array.isArray(db.cards) ? db.cards : [];

  if (cards.length === 0) {
    console.log("no cards found");
    return;
  }

  await setModelIfNeeded();

  let done = 0;
  const limit = BATCH_LIMIT > 0 ? Math.min(BATCH_LIMIT, cards.length) : cards.length;

  for (let i = 0; i < limit; i += 1) {
    const card = cards[i];
    const id = String(card.id || `card_${i + 1}`);
    const outName = `${id}.png`;
    const outPath = path.join(OUT_DIR, outName);
    const prompt = toPrompt(card);
    const seed = 100000 + i;

    try {
      const data = await txt2img(prompt, seed);
      const img = Array.isArray(data.images) ? data.images[0] : null;
      if (!img) throw new Error("no image returned");
      writeBase64Png(img, outPath);

      if (WRITE_IMAGE_FIELD) card.image = `/cards/generated/${outName}`;

      done += 1;
      if (done % 20 === 0) console.log(`generated ${done}/${limit}`);
    } catch (err) {
      console.log(`failed ${id}: ${String(err.message || err)}`);
    }
  }

  if (WRITE_IMAGE_FIELD) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
    console.log("updated image fields in flameCardsBest.json");
  }

  console.log(`done: ${done}/${limit}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
