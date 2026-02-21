function resolveApiBase() {
  const envBase = String(import.meta.env.VITE_API_BASE || "").trim();
  if (envBase) return envBase.replace(/\/$/, "");

  const host = String(globalThis?.location?.hostname || "").toLowerCase();
  const proto = String(globalThis?.location?.protocol || "https:");
  if (!host || host === "localhost" || host === "127.0.0.1") return "http://localhost:8787";

  if (host.startsWith("www.")) return `${proto}//api.${host.slice(4)}`;
  if (host.startsWith("api.")) return `${proto}//${host}`;
  return `${proto}//api.${host}`;
}

const API_BASE = resolveApiBase();

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${text}`.trim());
  }
  return res.json();
}

export default class ApiClient {
  static createRoom() {
    return request("/api/rooms", { method: "POST" });
  }

  static joinRoom(roomCode) {
    return request(`/api/rooms/${encodeURIComponent(roomCode)}/join`, { method: "POST" });
  }

  static postTurn(roomCode, playerId, turnIndex, turnAction) {
    return request(`/api/rooms/${encodeURIComponent(roomCode)}/turn`, {
      method: "POST",
      body: JSON.stringify({ playerId, turnIndex, turnAction })
    });
  }

  static getState(roomCode) {
    return request(`/api/rooms/${encodeURIComponent(roomCode)}/state`, { method: "GET" });
  }
}
