import http from "node:http";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 8787);
const HOST = String(process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";
const CORS_ALLOW_ORIGINS = String(process.env.CORS_ALLOW_ORIGINS || "*")
  .split(",")
  .map((s) => String(s || "").trim())
  .filter(Boolean);
const rooms = new Map();
const SERVER_STARTED_AT = Date.now();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PUBLIC_ROOT = path.join(PROJECT_ROOT, "public");
const CARD_CUSTOM_DIR = path.join(PUBLIC_ROOT, "cards", "custom");
const GENERATED_OUTPUT_DIR = path.join(PROJECT_ROOT, "outputs");
const GENERATED_SPRITE_DIR = path.join(PROJECT_ROOT, "sprites");
const LOCKED_IMAGE_STYLE_MODE = "bright";
const LOCKED_IMAGE_STYLE_REF_WEB_PATH = "/cards/style/style_reference.png";

const COMFY_API_CANDIDATES = [
  String(process.env.COMFY_API_BASE || "").trim(),
  "http://127.0.0.1:8001",
  "http://127.0.0.1:8188"
].filter(Boolean);

const COMFY_APP_DIR_CANDIDATES = [
  String(process.env.COMFY_APP_DIR || "").trim(),
  "D:\\ComfyUI2\\resources\\ComfyUI",
  "C:\\Users\\user\\Documents\\ComfyUI"
].filter(Boolean);

const PYTHON_CANDIDATES = [
  String(process.env.PYTHON_EXE || "").trim(),
  "C:\\Users\\user\\Documents\\ComfyUI\\.venv\\Scripts\\python.exe",
  "python"
].filter(Boolean);
const COMFY_AUTO_START_DEFAULT = /^(1|true|yes|on)$/i.test(String(process.env.COMFY_AUTO_START || "false"));

let managedComfyProcess = null;
let managedComfyApiBase = "";

function resolveCorsOrigin(req) {
  if (CORS_ALLOW_ORIGINS.includes("*")) return "*";
  const reqOrigin = String(req?.headers?.origin || "").trim();
  if (!reqOrigin) return CORS_ALLOW_ORIGINS[0] || "*";
  if (CORS_ALLOW_ORIGINS.includes(reqOrigin)) return reqOrigin;
  return CORS_ALLOW_ORIGINS[0] || "*";
}

function buildCorsHeaders(req) {
  const origin = resolveCorsOrigin(req);
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    Vary: "Origin"
  };
  if (origin !== "*") headers["Access-Control-Allow-Credentials"] = "true";
  return headers;
}

function sendJson(reqOrRes, resOrStatus, statusOrData, maybeData) {
  let req = null;
  let res = null;
  let statusCode = 200;
  let data = {};

  if (typeof reqOrRes?.writeHead === "function") {
    res = reqOrRes;
    statusCode = Number(resOrStatus || 200);
    data = statusOrData ?? {};
  } else {
    req = reqOrRes;
    res = resOrStatus;
    statusCode = Number(statusOrData || 200);
    data = maybeData ?? {};
  }

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...buildCorsHeaders(req)
  });
  res.end(JSON.stringify(data));
}

function getPublicBase(req) {
  const proto = String(req?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim()
    || (req?.socket?.encrypted ? "https" : "http");
  const host = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "").split(",")[0].trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString("utf8");
      if (raw.length > 4 * 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function genSeed() {
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function getRoom(code) {
  return rooms.get(String(code || "").toUpperCase());
}

function roomState(room) {
  const turnEntries = Array.from(room.turns.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
  const turns = {};
  for (let i = 0; i < turnEntries.length; i += 1) {
    const [idx, action] = turnEntries[i];
    turns[String(idx)] = action;
  }

  return {
    status: room.status,
    currentTurn: room.currentTurn,
    lastTurnAction: room.turns.get(room.currentTurn) || null,
    turns
  };
}

function sanitizePart(v) {
  return String(v || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
}

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || "");
  const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const base64 = m[2];
  const extByMime = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif"
  };
  const ext = extByMime[mime];
  if (!ext) return null;
  return { mime, base64, ext };
}

async function saveCardImageFromDataUrl({ cardId, cardName, dataUrl }) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return { ok: false, error: "invalid_image_data_url" };

  const idSafe = sanitizePart(cardId || "custom_card");
  const fileName = `${idSafe}${parsed.ext}`;
  const abs = path.join(CARD_CUSTOM_DIR, fileName);

  await fs.mkdir(CARD_CUSTOM_DIR, { recursive: true });
  await fs.writeFile(abs, Buffer.from(parsed.base64, "base64"));

  return { ok: true, imagePath: `/cards/custom/${fileName}` };
}

function filePathToWebPath(absPath) {
  const rel = path.relative(PUBLIC_ROOT, absPath);
  if (!rel || rel.startsWith("..")) return "";
  return `/${rel.split(path.sep).join("/")}`;
}

function getMimeByExt(absPath) {
  const ext = String(path.extname(absPath || "")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

async function sendPublicFile(req, res, reqPath) {
  const rel = String(reqPath || "").replace(/^\/+/, "");
  const abs = path.resolve(PUBLIC_ROOT, rel);
  const relCheck = path.relative(PUBLIC_ROOT, abs);
  if (relCheck.startsWith("..")) {
    return sendJson(req, res, 403, { error: "forbidden_path" });
  }

  if (!fsSync.existsSync(abs) || !fsSync.statSync(abs).isFile()) {
    const trySendAbs = async (candidateAbs) => {
      if (!candidateAbs) return false;
      if (!fsSync.existsSync(candidateAbs) || !fsSync.statSync(candidateAbs).isFile()) return false;
      const fbMime = getMimeByExt(candidateAbs);
      const fbBuf = await fs.readFile(candidateAbs);
      res.writeHead(200, {
        "Content-Type": fbMime,
        "Cache-Control": "public, max-age=60",
        ...buildCorsHeaders(req)
      });
      res.end(fbBuf);
      return true;
    };

    // 1) Legacy named path: /cards/custom/f_12_xxx.jpg -> /cards/custom/f_12.jpg
    const legacy = String(reqPath || "").match(/^\/cards\/custom\/(f_\d+)_.*(\.[a-zA-Z0-9]+)$/);
    if (legacy) {
      const fallbackPath = `/cards/custom/${legacy[1]}${String(legacy[2] || "").toLowerCase()}`;
      const fallbackAbs = path.resolve(PUBLIC_ROOT, fallbackPath.replace(/^\/+/, ""));
      // eslint-disable-next-line no-await-in-loop
      if (await trySendAbs(fallbackAbs)) return null;
    }

    // 2) Cross-extension fallback: /cards/custom/f_12*.ext -> try f_12.png/jpg/jpeg/webp/gif
    const idHit = String(reqPath || "").match(/^\/cards\/custom\/(f_\d+)(?:_[^\/]+)?(?:\.[a-zA-Z0-9]+)?$/);
    if (idHit?.[1]) {
      const idOnly = String(idHit[1]);
      const exts = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
      for (let i = 0; i < exts.length; i += 1) {
        const p = `/cards/custom/${idOnly}${exts[i]}`;
        const candidateAbs = path.resolve(PUBLIC_ROOT, p.replace(/^\/+/, ""));
        // eslint-disable-next-line no-await-in-loop
        if (await trySendAbs(candidateAbs)) return null;
      }
    }
    return sendJson(req, res, 404, { error: "file_not_found" });
  }

  const mime = getMimeByExt(abs);
  const buf = await fs.readFile(abs);
  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": "public, max-age=60",
    ...buildCorsHeaders(req)
  });
  res.end(buf);
  return null;
}

function detectComfyApiBase(preferred) {
  const preferredBase = String(preferred || "").trim();
  if (preferredBase) return preferredBase;
  return COMFY_API_CANDIDATES[0] || "http://127.0.0.1:8001";
}

function parseApiPort(apiBase) {
  try {
    const u = new URL(apiBase);
    return Number(u.port || "80");
  } catch {
    return 8001;
  }
}

function firstExistingDir(paths) {
  for (let i = 0; i < paths.length; i += 1) {
    const p = String(paths[i] || "").trim();
    if (p && fsSync.existsSync(p) && fsSync.statSync(p).isDirectory()) return p;
  }
  return "";
}

function resolveExistingPath(candidate) {
  if (!candidate) return "";
  const raw = String(candidate || "").trim().replace(/^-\s*/, "");
  if (!raw) return "";

  const direct = path.resolve(raw);
  if (fsSync.existsSync(direct)) return direct;

  const underProject = path.resolve(PROJECT_ROOT, raw);
  if (fsSync.existsSync(underProject)) return underProject;
  return "";
}

function resolveStyleRefFile(candidate) {
  const raw = String(candidate || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return "";
  if (raw.startsWith("/")) {
    const fromPublic = path.join(PUBLIC_ROOT, raw.replace(/^\/+/, ""));
    if (fsSync.existsSync(fromPublic) && fsSync.statSync(fromPublic).isFile()) return fromPublic;
  }
  return resolveExistingPath(raw);
}

function buildVisualPrompt({ cardName, description }) {
  const name = String(cardName || "").trim() || "unknown heroine";
  const story = String(description || "").trim();
  const storyText = story
    .split(/\r?\n/)
    .map((x) => String(x || "").trim())
    .filter((x) => x)
    .join(" ");

  const template = [
    "1girl",
    "anime fantasy card illustration",
    "full body",
    "clear face",
    "detailed eyes",
    "detailed hair",
    "clean lineart",
    "high detail",
    "no text",
    "no logo",
    "no watermark"
  ].join(", ");

  if (!storyText) {
    return `${name}, ${template}, keep visual style consistent`;
  }
  return `${name}, ${storyText}, ${template}, follow the story description strictly`;
}

function collectGeneratedImagePathsFromOutput(outputText) {
  const lines = String(outputText || "").split(/\r?\n/);
  const found = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || "").trim();
    if (!line) continue;

    const candidates = line.match(/[A-Za-z]:\\[^<>:"|?*\r\n]+?\.(png|jpg|jpeg|webp)/gi) || [];
    if (candidates.length === 0) {
      const tail = line.match(/([^\s]+?\.(png|jpg|jpeg|webp))$/i);
      if (tail?.[1]) candidates.push(tail[1]);
    }

    for (let j = 0; j < candidates.length; j += 1) {
      const p = resolveExistingPath(candidates[j]);
      if (p) found.push(p);
    }
  }
  return Array.from(new Set(found));
}

function isComfyOnline(apiBase, timeoutMs = 2500) {
  return new Promise((resolve) => {
    let settled = false;
    const url = `${String(apiBase || "").replace(/\/+$/, "")}/object_info`;
    const req = http.get(url, (res) => {
      res.resume();
      settled = true;
      resolve(Number(res.statusCode || 0) >= 200 && Number(res.statusCode || 0) < 300);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
    });
    req.on("error", () => {
      if (!settled) resolve(false);
    });
    req.on("close", () => {
      if (!settled) resolve(false);
    });
  });
}

async function waitForComfyOnline(apiBase, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isComfyOnline(apiBase, 2500);
    if (ok) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function choosePythonCommand() {
  for (let i = 0; i < PYTHON_CANDIDATES.length; i += 1) {
    const p = String(PYTHON_CANDIDATES[i] || "").trim();
    if (!p) continue;
    if (p.endsWith(".exe") && !fsSync.existsSync(p)) continue;
    return p;
  }
  return "python";
}

async function startManagedComfy(apiBase) {
  if (managedComfyProcess && !managedComfyProcess.killed) {
    const online = await isComfyOnline(managedComfyApiBase || apiBase);
    if (online) return { ok: true, started: false };
  }

  const appDir = firstExistingDir(COMFY_APP_DIR_CANDIDATES);
  if (!appDir) return { ok: false, error: "comfy_app_dir_not_found" };

  const python = choosePythonCommand();
  const port = parseApiPort(apiBase);
  const args = ["main.py", "--listen", "127.0.0.1", "--port", String(port)];
  const cmdArgs = python.toLowerCase() === "py" ? ["-3", ...args] : args;

  const child = spawn(python, cmdArgs, {
    cwd: appDir,
    windowsHide: true
  });

  managedComfyProcess = child;
  managedComfyApiBase = apiBase;

  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  child.on("close", () => {
    if (managedComfyProcess === child) {
      managedComfyProcess = null;
      managedComfyApiBase = "";
    }
  });

  const online = await waitForComfyOnline(apiBase, 65000);
  if (!online) return { ok: false, error: "comfy_start_timeout" };
  return { ok: true, started: true };
}

async function stopManagedComfy() {
  const child = managedComfyProcess;
  if (!child || child.killed) return { ok: true, stopped: false };
  try {
    child.kill("SIGTERM");
  } catch {}

  const start = Date.now();
  while (Date.now() - start < 4000) {
    if (!managedComfyProcess || managedComfyProcess.killed) break;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 250));
  }

  if (managedComfyProcess && !managedComfyProcess.killed) {
    try {
      managedComfyProcess.kill("SIGKILL");
    } catch {}
  }
  managedComfyProcess = null;
  managedComfyApiBase = "";
  return { ok: true, stopped: true };
}

async function ensureComfyReady({ apiBase, autoStart }) {
  const online = await isComfyOnline(apiBase);
  if (online) return { ok: true, startedByServer: false };
  if (!autoStart) return { ok: false, error: "comfy_offline" };
  const started = await startManagedComfy(apiBase);
  if (!started.ok) return { ok: false, error: started.error || "comfy_start_failed" };
  return { ok: true, startedByServer: true };
}

async function runPythonScript({ scriptName, args = [], extraEnv = {} }) {
  const tryRun = (cmd, cmdArgs) =>
    new Promise((resolve) => {
      const child = spawn(cmd, cmdArgs, {
        cwd: PROJECT_ROOT,
        windowsHide: true,
        env: { ...process.env, ...extraEnv }
      });

      let stdout = "";
      let stderr = "";
      let spawned = true;

      child.stdout.on("data", (d) => {
        stdout += String(d || "");
      });
      child.stderr.on("data", (d) => {
        stderr += String(d || "");
      });
      child.on("error", (err) => {
        spawned = false;
        resolve({ ok: false, spawned, code: -1, stdout, stderr: `${stderr}\n${String(err?.message || err)}` });
      });
      child.on("close", (code) => {
        resolve({ ok: Number(code) === 0, spawned, code: Number(code || 0), stdout, stderr });
      });
    });

  const candidates = [];
  for (let i = 0; i < PYTHON_CANDIDATES.length; i += 1) {
    const py = String(PYTHON_CANDIDATES[i] || "").trim();
    if (!py) continue;
    if (py.endsWith(".exe") && !fsSync.existsSync(py)) continue;
    candidates.push({ cmd: py, cmdArgs: [scriptName, ...args] });
  }

  let last = { ok: false, spawned: false, code: -1, stdout: "", stderr: "python_not_found", attempts: [] };
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    // eslint-disable-next-line no-await-in-loop
    const r = await tryRun(c.cmd, c.cmdArgs);
    const attempt = {
      cmd: c.cmd,
      args: c.cmdArgs,
      spawned: Boolean(r.spawned),
      code: Number(r.code || 0),
      stderr: String(r.stderr || "")
    };
    if (r.ok) return { ...r, attempts: [attempt] };

    if (!Array.isArray(last.attempts)) last.attempts = [];
    last.attempts.push(attempt);
    last = { ...last, ...r };

    if (r.spawned) {
      // A real python process ran but failed: stop here to expose the real root cause.
      return { ...r, attempts: last.attempts };
    }
  }
  return { ...last, attempts: last.attempts || [] };
}

async function runGenerateImageScript({ prompt, apiBase, styleMode, styleRefPath }) {
  const promptText = String(prompt || "").trim();
  if (!promptText) return { ok: false, error: "empty_prompt", code: -1, stdout: "", stderr: "" };
  const styleModeText = ["bright", "neutral", "dark"].includes(String(styleMode || "").trim().toLowerCase())
    ? String(styleMode).trim().toLowerCase()
    : "bright";
  const args = ["--prompt", promptText, "--style-mode", styleModeText];
  if (styleRefPath) args.push("--style-ref", styleRefPath);

  const appDir = firstExistingDir(COMFY_APP_DIR_CANDIDATES);
  const comfyInputDir = appDir ? path.join(appDir, "input") : "";
  const extraEnv = { COMFY_API_BASE: String(apiBase || "").trim() };
  if (comfyInputDir) extraEnv.COMFY_INPUT_DIR = comfyInputDir;

  return runPythonScript({
    scriptName: "generate_image.py",
    args,
    extraEnv
  });
}

async function runGenerateAttackScript({ prompt, apiBase, frames, size, workflow }) {
  const promptText = String(prompt || "").trim();
  if (!promptText) return { ok: false, error: "empty_prompt", code: -1, stdout: "", stderr: "" };
  const args = [
    "--api",
    apiBase,
    "--prompt",
    promptText,
    "--frames",
    String(Math.max(1, Number(frames || 16))),
    "--size",
    String(Math.max(128, Number(size || 512))),
    "--output-dir",
    GENERATED_SPRITE_DIR
  ];
  if (workflow) args.push("--workflow", String(workflow));
  return runPythonScript({
    scriptName: "generate_attack_sprites.py",
    args,
    extraEnv: { COMFY_API_BASE: String(apiBase || "").trim() }
  });
}

async function moveGeneratedImageToCustom({ cardId, cardName, generatedPath }) {
  const src = resolveExistingPath(generatedPath);
  if (!src) return { ok: false, error: "generated_file_not_found" };

  const ext = path.extname(src).toLowerCase();
  const finalExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".png";
  const idSafe = sanitizePart(cardId || "custom_card");
  const nameSafe = sanitizePart(cardName || "card");
  const fileName = `${idSafe}_${nameSafe}${finalExt}`;

  await fs.mkdir(CARD_CUSTOM_DIR, { recursive: true });
  const dest = path.join(CARD_CUSTOM_DIR, fileName);
  await fs.copyFile(src, dest);

  const webPath = filePathToWebPath(dest);
  if (!webPath) return { ok: false, error: "path_to_web_failed" };
  return { ok: true, imagePath: webPath, fileName };
}

async function moveGeneratedSpritesToCustom({ cardId, cardName, imagePaths }) {
  const idSafe = sanitizePart(cardId || "custom_card");
  const nameSafe = sanitizePart(cardName || "card");
  const dirName = `${idSafe}_${nameSafe}`;
  const destDir = path.join(CARD_CUSTOM_DIR, "animations", dirName);

  await fs.mkdir(destDir, { recursive: true });
  const ordered = imagePaths.slice().sort();
  const webPaths = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const src = resolveExistingPath(ordered[i]);
    if (!src) continue;
    const outName = `attack_${String(i + 1).padStart(4, "0")}.png`;
    const dest = path.join(destDir, outName);
    // eslint-disable-next-line no-await-in-loop
    await fs.copyFile(src, dest);
    const webPath = filePathToWebPath(dest);
    if (webPath) webPaths.push(webPath);
  }

  if (webPaths.length === 0) return { ok: false, error: "no_sprite_saved" };
  return {
    ok: true,
    frameCount: webPaths.length,
    previewFramePath: webPaths[0],
    frames: webPaths,
    sequenceDir: `/cards/custom/animations/${dirName}`
  };
}

async function pickNewestImageFrom(dir) {
  if (!fsSync.existsSync(dir)) return "";
  const list = fsSync
    .readdirSync(dir)
    .map((n) => path.join(dir, n))
    .filter((p) => fsSync.existsSync(p) && fsSync.statSync(p).isFile())
    .filter((p) => /\.(png|jpg|jpeg|webp)$/i.test(p))
    .sort((a, b) => fsSync.statSync(b).mtimeMs - fsSync.statSync(a).mtimeMs);
  return list[0] || "";
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let reqPath = url.pathname;
  try { reqPath = decodeURIComponent(reqPath); } catch {}

  if (req.method === "OPTIONS") return sendJson(req, res, 204, {});

  try {
    if (req.method === "GET" && reqPath.startsWith("/cards/")) {
      return sendPublicFile(req, res, reqPath);
    }

    if (req.method === "GET" && reqPath === "/api/health") {
      return sendJson(req, res, 200, {
        ok: true,
        service: "mock-api",
        uptimeSec: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
        host: HOST,
        port: PORT,
        managedComfyAlive: Boolean(managedComfyProcess && !managedComfyProcess.killed),
        managedComfyApiBase: managedComfyApiBase || ""
      });
    }

    if (req.method === "GET" && reqPath === "/api/comfy/health") {
      const apiBase = detectComfyApiBase(url.searchParams.get("apiBase"));
      const online = await isComfyOnline(apiBase);
      return sendJson(req, res, online ? 200 : 503, {
        ok: online,
        apiBase,
        managedComfyAlive: Boolean(managedComfyProcess && !managedComfyProcess.killed),
        managedComfyApiBase: managedComfyApiBase || ""
      });
    }

    if (req.method === "POST" && reqPath === "/api/rooms") {
      let code = genRoomCode();
      while (rooms.has(code)) code = genRoomCode();
      const room = {
        code,
        seed: genSeed(),
        status: "waiting",
        players: { A: randomUUID(), B: null },
        currentTurn: 0,
        turns: new Map()
      };
      rooms.set(code, room);
      return sendJson(res, 200, { roomCode: code, seed: room.seed, playerId: "A" });
    }

    const joinMatch = reqPath.match(/^\/api\/rooms\/([^/]+)\/join$/);
    if (req.method === "POST" && joinMatch) {
      const code = decodeURIComponent(joinMatch[1]).toUpperCase();
      const room = getRoom(code);
      if (!room) return sendJson(res, 404, { error: "room_not_found" });
      if (room.players.B) return sendJson(res, 409, { error: "room_full" });
      room.players.B = randomUUID();
      room.status = "ready";
      return sendJson(res, 200, { seed: room.seed, playerId: "B", status: room.status });
    }

    const turnMatch = reqPath.match(/^\/api\/rooms\/([^/]+)\/turn$/);
    if (req.method === "POST" && turnMatch) {
      const code = decodeURIComponent(turnMatch[1]).toUpperCase();
      const room = getRoom(code);
      if (!room) return sendJson(res, 404, { error: "room_not_found" });

      const body = await parseBody(req);
      const playerId = String(body?.playerId || "");
      const turnIndex = Number(body?.turnIndex);
      const turnAction = body?.turnAction;

      if (playerId !== "A" && playerId !== "B") return sendJson(res, 400, { error: "invalid_player_id" });
      if (!Number.isInteger(turnIndex) || turnIndex <= 0) return sendJson(res, 400, { error: "invalid_turn_index" });
      if (!turnAction || typeof turnAction !== "object") return sendJson(res, 400, { error: "invalid_turn_action" });
      if (turnIndex !== room.currentTurn + 1) return sendJson(res, 409, { error: "turn_conflict", currentTurn: room.currentTurn });

      room.turns.set(turnIndex, turnAction);
      room.currentTurn = turnIndex;
      if (room.status === "ready") room.status = "playing";
      return sendJson(res, 200, { ok: true, currentTurn: room.currentTurn });
    }

    const stateMatch = reqPath.match(/^\/api\/rooms\/([^/]+)\/state$/);
    if (req.method === "GET" && stateMatch) {
      const code = decodeURIComponent(stateMatch[1]).toUpperCase();
      const room = getRoom(code);
      if (!room) return sendJson(res, 404, { error: "room_not_found" });
      return sendJson(res, 200, roomState(room));
    }

    if (req.method === "POST" && reqPath === "/api/assets/save-card-image") {
      const body = await parseBody(req);
      const cardId = String(body?.cardId || "").trim();
      const cardName = String(body?.cardName || "").trim();
      const dataUrl = String(body?.dataUrl || "");

      if (!cardId) return sendJson(res, 400, { error: "invalid_card_id" });
      if (!dataUrl.startsWith("data:image/")) return sendJson(res, 400, { error: "invalid_data_url" });
      const saved = await saveCardImageFromDataUrl({ cardId, cardName, dataUrl });
      if (!saved.ok) return sendJson(req, res, 400, { error: saved.error || "save_failed" });
      const publicBase = getPublicBase(req);
      return sendJson(req, res, 200, {
        ok: true,
        imagePath: saved.imagePath,
        imageUrl: publicBase ? `${publicBase}${saved.imagePath}` : saved.imagePath
      });
    }

    if (req.method === "POST" && reqPath === "/api/comfy/generate-from-description") {
      const body = await parseBody(req);
      const cardId = String(body?.cardId || "").trim();
      const cardName = String(body?.cardName || "").trim();
      const description = String(body?.description || "").trim();
      const abilityText = String(body?.abilityText || "").trim();
      const styleMode = LOCKED_IMAGE_STYLE_MODE;
      const styleRefPath = resolveStyleRefFile(LOCKED_IMAGE_STYLE_REF_WEB_PATH);
      const autoStart = body?.autoStart === undefined ? COMFY_AUTO_START_DEFAULT : body?.autoStart !== false;
      const autoShutdown = body?.autoShutdown !== false;
      const apiBase = detectComfyApiBase(body?.apiBase);

      if (!cardId) return sendJson(res, 400, { error: "invalid_card_id" });
      if (!description && !abilityText) return sendJson(res, 400, { error: "empty_description" });

      const comfy = await ensureComfyReady({ apiBase, autoStart });
      if (!comfy.ok) return sendJson(res, 503, { error: comfy.error || "comfy_unavailable", apiBase });

      try {
        const prompt = buildVisualPrompt({ cardName, description });
        const runResult = await runGenerateImageScript({ prompt, apiBase, styleMode, styleRefPath });
        if (!runResult.ok) {
          const attempts = Array.isArray(runResult.attempts) ? runResult.attempts : [];
          return sendJson(res, 500, {
            error: "python_generate_failed",
            code: runResult.code,
            stdout: runResult.stdout || "",
            stderr: runResult.stderr || "",
            attempts,
            attemptedCommand: attempts[0]
              ? `${String(attempts[0].cmd || "")} ${Array.isArray(attempts[0].args) ? attempts[0].args.join(" ") : ""}`.trim()
              : "",
            apiBase
          });
        }

        const candidates = collectGeneratedImagePathsFromOutput(runResult.stdout);
        let chosen = "";
        for (let i = candidates.length - 1; i >= 0; i -= 1) {
          const p = resolveExistingPath(candidates[i]);
          if (p) {
            chosen = p;
            break;
          }
        }
        if (!chosen) chosen = await pickNewestImageFrom(GENERATED_OUTPUT_DIR);
        if (!chosen) return sendJson(res, 500, { error: "generated_image_not_found", apiBase });

        const saved = await moveGeneratedImageToCustom({ cardId, cardName, generatedPath: chosen });
        if (!saved.ok) return sendJson(req, res, 500, { error: saved.error || "save_custom_failed" });
        const publicBase = getPublicBase(req);
        return sendJson(req, res, 200, {
          ok: true,
          imagePath: saved.imagePath,
          imageUrl: publicBase ? `${publicBase}${saved.imagePath}` : saved.imagePath,
          sourcePath: chosen,
          usedPrompt: prompt,
          styleMode,
          styleRefPath,
          apiBase,
          autoStarted: comfy.startedByServer
        });
      } finally {
        if (comfy.startedByServer && autoShutdown) await stopManagedComfy();
      }
    }

    if (req.method === "POST" && reqPath === "/api/comfy/generate-attack-from-description") {
      const body = await parseBody(req);
      const cardId = String(body?.cardId || "").trim();
      const cardName = String(body?.cardName || "").trim();
      const description = String(body?.description || "").trim();
      const abilityText = String(body?.abilityText || "").trim();
      const frames = Number(body?.frames || 16);
      const size = Number(body?.size || 512);
      const workflow = String(body?.workflow || "").trim();
      const autoStart = body?.autoStart === undefined ? COMFY_AUTO_START_DEFAULT : body?.autoStart !== false;
      const autoShutdown = body?.autoShutdown !== false;
      const apiBase = detectComfyApiBase(body?.apiBase);

      if (!cardId) return sendJson(res, 400, { error: "invalid_card_id" });
      if (!description && !abilityText) return sendJson(res, 400, { error: "empty_description" });

      const comfy = await ensureComfyReady({ apiBase, autoStart });
      if (!comfy.ok) return sendJson(res, 503, { error: comfy.error || "comfy_unavailable", apiBase });

      try {
        const attackHint = "chibi battle attack animation, startup strike recovery, consistent position";
        const prompt = [description, abilityText, attackHint].filter(Boolean).join("；");
        const runResult = await runGenerateAttackScript({ prompt, apiBase, frames, size, workflow });
        if (!runResult.ok) {
          const attempts = Array.isArray(runResult.attempts) ? runResult.attempts : [];
          return sendJson(res, 500, {
            error: "python_generate_attack_failed",
            code: runResult.code,
            stdout: runResult.stdout || "",
            stderr: runResult.stderr || "",
            attempts,
            attemptedCommand: attempts[0]
              ? `${String(attempts[0].cmd || "")} ${Array.isArray(attempts[0].args) ? attempts[0].args.join(" ") : ""}`.trim()
              : "",
            apiBase
          });
        }

        let paths = collectGeneratedImagePathsFromOutput(runResult.stdout)
          .filter((p) => /attack_\d+\.(png|jpg|jpeg|webp)$/i.test(p))
          .sort();

        if (paths.length === 0 && fsSync.existsSync(GENERATED_SPRITE_DIR)) {
          paths = fsSync
            .readdirSync(GENERATED_SPRITE_DIR)
            .map((n) => path.join(GENERATED_SPRITE_DIR, n))
            .filter((p) => /\.(png|jpg|jpeg|webp)$/i.test(p))
            .sort((a, b) => fsSync.statSync(b).mtimeMs - fsSync.statSync(a).mtimeMs)
            .slice(0, Math.max(1, Math.floor(frames)))
            .reverse();
        }

        if (paths.length === 0) return sendJson(res, 500, { error: "generated_sprite_not_found", apiBase });

        const saved = await moveGeneratedSpritesToCustom({ cardId, cardName, imagePaths: paths });
        if (!saved.ok) return sendJson(req, res, 500, { error: saved.error || "save_sprite_failed" });

        const publicBase = getPublicBase(req);
        return sendJson(req, res, 200, {
          ok: true,
          ...saved,
          previewFrameUrl: publicBase && saved.previewFramePath ? `${publicBase}${saved.previewFramePath}` : saved.previewFramePath,
          frameUrls: publicBase ? (Array.isArray(saved.frames) ? saved.frames.map((p) => `${publicBase}${p}`) : []) : saved.frames,
          apiBase,
          autoStarted: comfy.startedByServer
        });
      } finally {
        if (comfy.startedByServer && autoShutdown) await stopManagedComfy();
      }
    }

    return sendJson(res, 404, { error: "not_found" });
  } catch (err) {
    return sendJson(res, 500, { error: "server_error", message: String(err?.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  const corsText = CORS_ALLOW_ORIGINS.join(", ");
  console.log(`[mock-api] listening on http://${HOST}:${PORT}`);
  console.log(`[mock-api] cors allow origins: ${corsText}`);
});



