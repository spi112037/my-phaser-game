import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const HOST = String(process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";
const SERVER_STARTED_AT = Date.now();

const CORS_ALLOW_ORIGINS = String(process.env.CORS_ALLOW_ORIGINS || "*")
  .split(",")
  .map((s) => String(s || "").trim())
  .filter(Boolean);

const API_VERSION = "battle-only-v1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const PUBLIC_ROOT = path.join(PROJECT_ROOT, "public");

const rooms = new Map();

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

function sendJson(req, res, statusCode = 200, data = {}) {
  res.writeHead(Number(statusCode || 200), {
    "Content-Type": "application/json; charset=utf-8",
    ...buildCorsHeaders(req)
  });
  res.end(JSON.stringify(data));
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

function normalizeDeckIds(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => String(x || "").trim())
    .filter((x) => x)
    .slice(0, 30);
}

function normalizeDisplayName(input, fallback = "玩家") {
  const raw = String(input || "").replace(/\s+/g, " ").trim();
  if (!raw) return fallback;
  return raw.slice(0, 24);
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
    seed: String(room.seed || ""),
    currentTurn: room.currentTurn,
    lastTurnAction: room.turns.get(room.currentTurn) || null,
    turns,
    liveActionSeq: Number(room.liveActionSeq || 0),
    liveActions: Array.isArray(room.liveActions) ? room.liveActions.map((x) => ({ ...x })) : [],
    decks: {
      A: Array.isArray(room?.decks?.A) ? [...room.decks.A] : [],
      B: Array.isArray(room?.decks?.B) ? [...room.decks.B] : []
    },
    names: {
      A: String(room?.names?.A || "玩家A"),
      B: String(room?.names?.B || "玩家B")
    }
  };
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
  if (relCheck.startsWith("..")) return sendJson(req, res, 403, { error: "forbidden_path" });
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return sendJson(req, res, 404, { error: "file_not_found" });

  const mime = getMimeByExt(abs);
  const buf = await fsp.readFile(abs);
  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": "public, max-age=60",
    ...buildCorsHeaders(req)
  });
  res.end(buf);
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
        service: "battle-api",
        mode: "battle-only",
        version: API_VERSION,
        uptimeSec: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
        host: HOST,
        port: PORT,
        cors: CORS_ALLOW_ORIGINS
      });
    }

    if (req.method === "GET" && reqPath === "/api/rooms") {
      const statusFilter = String(url.searchParams.get("status") || "").trim().toLowerCase();
      const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
      const include = new Set(["waiting", "ready", "playing", "finished"]);

      if (statusFilter) {
        const requested = statusFilter
          .split(",")
          .map((s) => String(s || "").trim().toLowerCase())
          .filter(Boolean);
        const matched = requested.filter((s) => include.has(s));
        if (matched.length > 0) {
          include.clear();
          for (let i = 0; i < matched.length; i += 1) include.add(matched[i]);
        }
      }

      const list = [];
      const now = Date.now();
      for (const room of rooms.values()) {
        if (!room) continue;

        if (String(room.status || "") === "finished") {
          const finAt = Number(room.finishedAt || room.updatedAt || 0);
          if (finAt > 0 && now - finAt > 3 * 60 * 1000) {
            rooms.delete(String(room.code || ""));
            continue;
          }
        }

        if (!include.has(String(room.status || "waiting"))) continue;

        const code = String(room.code || "");
        const a = String(room?.names?.A || "玩家A");
        const b = String(room?.names?.B || "玩家B");
        const searchText = `${code} ${a} ${b}`.toLowerCase();
        if (q && !searchText.includes(q)) continue;

        list.push({
          roomCode: code,
          status: String(room.status || "waiting"),
          currentTurn: Number(room.currentTurn || 0),
          names: { A: a, B: b },
          hasPlayerB: Boolean(room?.players?.B),
          createdAt: Number(room.createdAt || 0),
          updatedAt: Number(room.updatedAt || room.createdAt || 0)
        });
      }

      list.sort((x, y) => Number(y.updatedAt || 0) - Number(x.updatedAt || 0));
      return sendJson(req, res, 200, { rooms: list.slice(0, 200) });
    }

    if (req.method === "POST" && reqPath === "/api/rooms") {
      const body = await parseBody(req).catch(() => ({}));
      const deckIds = normalizeDeckIds(body?.deckIds);
      const displayName = normalizeDisplayName(body?.displayName, "玩家A");

      let code = genRoomCode();
      while (rooms.has(code)) code = genRoomCode();

      const room = {
        code,
        seed: genSeed(),
        status: "waiting",
        players: { A: randomUUID(), B: null },
        decks: { A: deckIds, B: [] },
        names: { A: displayName, B: "玩家B" },
        currentTurn: 0,
        turns: new Map(),
        liveActionSeq: 0,
        liveActions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        finishedAt: 0
      };

      rooms.set(code, room);
      return sendJson(req, res, 200, {
        roomCode: code,
        seed: room.seed,
        playerId: "A",
        decks: { A: [...room.decks.A], B: [] },
        names: { A: room.names.A, B: room.names.B }
      });
    }

    const joinMatch = reqPath.match(/^\/api\/rooms\/([^/]+)\/join$/);
    if (req.method === "POST" && joinMatch) {
      const code = decodeURIComponent(joinMatch[1]).toUpperCase();
      const room = getRoom(code);
      if (!room) return sendJson(req, res, 404, { error: "room_not_found" });
      if (room.players.B) return sendJson(req, res, 409, { error: "room_full" });

      const body = await parseBody(req).catch(() => ({}));
      const displayName = normalizeDisplayName(body?.displayName, "玩家B");
      room.decks.B = normalizeDeckIds(body?.deckIds);
      room.players.B = randomUUID();
      room.names.B = displayName;
      room.status = "ready";
      room.updatedAt = Date.now();

      return sendJson(req, res, 200, {
        seed: room.seed,
        playerId: "B",
        status: room.status,
        decks: {
          A: Array.isArray(room?.decks?.A) ? [...room.decks.A] : [],
          B: Array.isArray(room?.decks?.B) ? [...room.decks.B] : []
        },
        names: { A: room.names.A, B: room.names.B }
      });
    }

    const turnMatch = reqPath.match(/^\/api\/rooms\/([^/]+)\/turn$/);
    if (req.method === "POST" && turnMatch) {
      const code = decodeURIComponent(turnMatch[1]).toUpperCase();
      const room = getRoom(code);
      if (!room) return sendJson(req, res, 404, { error: "room_not_found" });

      const body = await parseBody(req);
      const playerId = String(body?.playerId || "");
      const turnIndex = Number(body?.turnIndex);
      const turnAction = body?.turnAction;

      if (playerId !== "A" && playerId !== "B") return sendJson(req, res, 400, { error: "invalid_player_id" });
      if (!Number.isInteger(turnIndex) || turnIndex <= 0) return sendJson(req, res, 400, { error: "invalid_turn_index" });
      if (!turnAction || typeof turnAction !== "object") return sendJson(req, res, 400, { error: "invalid_turn_action" });
      if (turnIndex !== room.currentTurn + 1) return sendJson(req, res, 409, { error: "turn_conflict", currentTurn: room.currentTurn });

      const expectedPlayerId = room.currentTurn % 2 === 0 ? "A" : "B";
      if (playerId !== expectedPlayerId) {
        return sendJson(req, res, 409, { error: "turn_player_conflict", currentTurn: room.currentTurn, expectedPlayerId });
      }

      room.turns.set(turnIndex, turnAction);
      room.currentTurn = turnIndex;
      if (room.status === "ready") room.status = "playing";
      room.updatedAt = Date.now();

      const acts = Array.isArray(turnAction?.actions) ? turnAction.actions : [];
      const hasGameOver = acts.some((a) => String(a?.type || "") === "gameOver");
      if (hasGameOver) {
        room.status = "finished";
        room.finishedAt = Date.now();
      }

      return sendJson(req, res, 200, { ok: true, currentTurn: room.currentTurn, status: room.status });
    }

    const actionMatch = reqPath.match(/^\/api\/rooms\/([^/]+)\/action$/);
    if (req.method === "POST" && actionMatch) {
      const code = decodeURIComponent(actionMatch[1]).toUpperCase();
      const room = getRoom(code);
      if (!room) return sendJson(req, res, 404, { error: "room_not_found" });

      const body = await parseBody(req);
      const playerId = String(body?.playerId || "");
      const action = body?.action;

      if (playerId !== "A" && playerId !== "B") return sendJson(req, res, 400, { error: "invalid_player_id" });
      if (!action || typeof action !== "object" || !String(action.type || "").trim()) {
        return sendJson(req, res, 400, { error: "invalid_action" });
      }

      const actionType = String(action?.type || "");

      if (actionType === "leaveRoom") {
        room.players[playerId] = null;

        const hasA = Boolean(room?.players?.A);
        const hasB = Boolean(room?.players?.B);
        if (!hasA && !hasB) {
          rooms.delete(code);
          return sendJson(req, res, 200, { ok: true, deleted: true, status: "deleted" });
        }

        if (room.status !== "finished") {
          room.status = hasA && hasB ? "ready" : "waiting";
        }

        room.updatedAt = Date.now();
        return sendJson(req, res, 200, { ok: true, status: room.status });
      }

      // 即時動作視為事件流，不在此處強卡回合，避免同步抖動造成對端漏事件。
      room.liveActionSeq = Number(room.liveActionSeq || 0) + 1;
      room.liveActions.push({ seq: room.liveActionSeq, playerId, action, at: Date.now() });
      if (room.liveActions.length > 300) room.liveActions = room.liveActions.slice(room.liveActions.length - 300);

      if (actionType === "gameOver") {
        room.status = "finished";
        room.finishedAt = Date.now();
      } else if (room.status === "ready") {
        room.status = "playing";
      }

      room.updatedAt = Date.now();
      return sendJson(req, res, 200, { ok: true, seq: room.liveActionSeq, status: room.status });
    }

    const stateMatch = reqPath.match(/^\/api\/rooms\/([^/]+)\/state$/);
    if (req.method === "GET" && stateMatch) {
      const code = decodeURIComponent(stateMatch[1]).toUpperCase();
      const room = getRoom(code);
      if (!room) return sendJson(req, res, 404, { error: "room_not_found" });
      return sendJson(req, res, 200, roomState(room));
    }

    return sendJson(req, res, 404, { error: "not_found" });
  } catch (err) {
    return sendJson(req, res, 500, { error: "server_error", message: String(err?.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  const corsText = CORS_ALLOW_ORIGINS.join(", ");
  console.log(`[battle-api] listening on http://${HOST}:${PORT}`);
  console.log(`[battle-api] cors allow origins: ${corsText}`);
});
