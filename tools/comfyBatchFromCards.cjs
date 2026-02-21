/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

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

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "1";
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function safeFileName(input) {
  return String(input || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    const cause = err && typeof err === "object" && "cause" in err ? err.cause : null;
    const causeMsg = cause && cause.message ? ` | cause: ${cause.message}` : "";
    throw new Error(`request failed: ${url}${causeMsg}`);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${txt}`.trim());
  }
  return res.json();
}

async function preflightComfy(apiBase) {
  try {
    await fetchJson(`${apiBase}/object_info`);
    return true;
  } catch {
    return false;
  }
}

function setNodeInput(promptObj, nodeId, field, value) {
  const node = promptObj[String(nodeId)];
  if (!node || typeof node !== "object") {
    throw new Error(`workflow node not found: ${nodeId}`);
  }
  if (!node.inputs || typeof node.inputs !== "object") {
    node.inputs = {};
  }
  node.inputs[field] = value;
}

function raceFolder(card) {
  const p = Number(card?.phyle ?? 0);
  const label = PHYLE_LABELS[p] || PHYLE_LABELS[String(card?.phyle ?? 0)] || "未知";
  return safeFileName(label);
}

function makePrompt(card) {
  const base = String(card?.description || "").trim();
  const body = base.replace(/^【AI產圖提示詞】\s*/g, "");
  return body || `主題：${String(card?.name || "未命名")}，日系動漫風卡牌插畫，女性原創角色。`;
}

function getImagesFromHistory(history) {
  if (!history || typeof history !== "object") return [];
  const out = [];
  const outputs = history.outputs && typeof history.outputs === "object" ? history.outputs : {};
  const nodes = Object.keys(outputs);
  for (let i = 0; i < nodes.length; i += 1) {
    const nodeOut = outputs[nodes[i]];
    const imgs = Array.isArray(nodeOut?.images) ? nodeOut.images : [];
    for (let j = 0; j < imgs.length; j += 1) out.push(imgs[j]);
  }
  return out;
}

async function waitPromptDone(apiBase, promptId, pollMs) {
  while (true) {
    const historyAll = await fetchJson(`${apiBase}/history/${encodeURIComponent(promptId)}`);
    const item = historyAll?.[promptId];
    if (item) return item;
    await sleep(pollMs);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const cwd = process.cwd();

  const apiBase = String(args.api || "http://127.0.0.1:8188");
  const workflowPath = path.resolve(cwd, String(args.workflow || "tools/comfy_api_workflow.json"));
  const cardsPath = path.resolve(cwd, String(args.cards || "src/data/flameCardsBest.json"));
  const outRoot = path.resolve(cwd, String(args.out || "public/cards/comfy"));
  const limit = Math.max(0, Number(args.limit || 0));
  const pollMs = Math.max(300, Number(args.poll || 1200));
  const writeImageField = String(args.writeImage || "1") === "1";
  const overwrite = String(args.overwrite || "0") === "1";
  const groupByRace = String(args.groupByRace || "1") === "1";

  const positiveNode = String(args.positiveNode || "6");
  const positiveField = String(args.positiveField || "text");
  const negativeNode = String(args.negativeNode || "7");
  const negativeField = String(args.negativeField || "text");
  const negativePrompt = String(
    args.negative ||
      "lowres, blurry, watermark, text, logo, ui, deformed hands, bad anatomy, nsfw"
  );
  const seedNode = String(args.seedNode || "3");
  const seedField = String(args.seedField || "seed");
  const sizeNode = String(args.sizeNode || "");
  const widthField = String(args.widthField || "width");
  const heightField = String(args.heightField || "height");
  const targetWidth = Number(args.width || 768);
  const targetHeight = Number(args.height || 1152);
  const saveNode = String(args.saveNode || "");
  const saveField = String(args.saveField || "filename_prefix");

  if (!fs.existsSync(workflowPath)) {
    throw new Error(`workflow file not found: ${workflowPath}`);
  }
  if (!fs.existsSync(cardsPath)) {
    throw new Error(`cards file not found: ${cardsPath}`);
  }

  const okApi = await preflightComfy(apiBase);
  if (!okApi) {
    throw new Error(
      `cannot connect to ComfyUI API at ${apiBase}. ` +
        `Please ensure ComfyUI is running and API endpoint is reachable (ex: ${apiBase}/object_info).`
    );
  }

  const workflowRaw = fs.readFileSync(workflowPath, "utf8").replace(/^\uFEFF/, "");
  const workflow = JSON.parse(workflowRaw);
  const cardsRaw = fs.readFileSync(cardsPath, "utf8").replace(/^\uFEFF/, "");
  const cardsDb = JSON.parse(cardsRaw);
  const cards = Array.isArray(cardsDb.cards) ? cardsDb.cards : [];

  ensureDir(outRoot);

  const targetCount = limit > 0 ? Math.min(limit, cards.length) : cards.length;
  const manifest = [];
  let ok = 0;
  let fail = 0;

  const detectSizeNode = () => {
    if (sizeNode) return sizeNode;
    const ids = Object.keys(workflow);
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      const node = workflow[id];
      const inputs = node?.inputs || {};
      if (Object.prototype.hasOwnProperty.call(inputs, "width") && Object.prototype.hasOwnProperty.call(inputs, "height")) {
        return id;
      }
    }
    return "";
  };
  const resolvedSizeNode = detectSizeNode();

  for (let i = 0; i < targetCount; i += 1) {
    const card = cards[i];
    const cardId = String(card?.id || `card_${i + 1}`);
    const cardName = String(card?.name || cardId);
    const folder = groupByRace ? raceFolder(card) : "all";
    const fileBase = safeFileName(`${cardId}_${cardName}`);
    const outDir = path.join(outRoot, folder);
    const outPath = path.join(outDir, `${fileBase}.png`);
    ensureDir(outDir);

    if (!overwrite && fs.existsSync(outPath)) {
      manifest.push({ id: cardId, name: cardName, status: "skip_exists", file: outPath });
      continue;
    }

    const promptObj = deepClone(workflow);
    const promptText = makePrompt(card);

    try {
      setNodeInput(promptObj, positiveNode, positiveField, promptText);
      setNodeInput(promptObj, negativeNode, negativeField, negativePrompt);
      setNodeInput(promptObj, seedNode, seedField, 100000 + i);
      if (resolvedSizeNode) {
        setNodeInput(promptObj, resolvedSizeNode, widthField, targetWidth);
        setNodeInput(promptObj, resolvedSizeNode, heightField, targetHeight);
      }
      if (saveNode) {
        setNodeInput(promptObj, saveNode, saveField, `cards/${folder}/${fileBase}`);
      }

      const enqueue = await fetchJson(`${apiBase}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptObj })
      });
      const promptId = String(enqueue?.prompt_id || "");
      if (!promptId) throw new Error("no prompt_id returned");

      const done = await waitPromptDone(apiBase, promptId, pollMs);
      const images = getImagesFromHistory(done);
      if (!images.length) throw new Error("no images in history output");

      const img = images[0];
      const query = new URLSearchParams({
        filename: String(img.filename || ""),
        subfolder: String(img.subfolder || ""),
        type: String(img.type || "output")
      });
      const res = await fetch(`${apiBase}/view?${query.toString()}`);
      if (!res.ok) throw new Error(`view failed: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(outPath, buf);

      const webPath = `/cards/comfy/${folder}/${path.basename(outPath)}`;
      if (writeImageField) card.image = webPath;

      manifest.push({ id: cardId, name: cardName, status: "ok", file: outPath, webPath });
      ok += 1;
      if (ok % 10 === 0) console.log(`generated ${ok}/${targetCount}`);
    } catch (err) {
      manifest.push({ id: cardId, name: cardName, status: "fail", error: String(err.message || err) });
      fail += 1;
      console.log(`fail ${cardId}: ${String(err.message || err)}`);
    }
  }

  if (writeImageField) {
    fs.writeFileSync(cardsPath, JSON.stringify(cardsDb, null, 2) + "\n", "utf8");
  }

  const manifestPath = path.join(outRoot, "_manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log(`done. ok=${ok}, fail=${fail}, total=${targetCount}`);
  console.log(`manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
