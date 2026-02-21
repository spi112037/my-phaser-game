// 檔案路徑：src/core/GameState.js
import { STORAGE_KEY_DECKS, ROLES } from "../config/constants";

export default class GameState {
  static _readAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DECKS);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return {};
      return obj;
    } catch {
      return {};
    }
  }

  static _writeAll(obj) {
    try {
      localStorage.setItem(STORAGE_KEY_DECKS, JSON.stringify(obj));
    } catch {
      // ignore
    }
  }

  static getDeckIds(roleKey) {
    const all = this._readAll();
    const list = all[roleKey];
    if (!Array.isArray(list)) return [];
    return list.map((x) => String(x));
  }

  static setDeckIds(roleKey, ids) {
    const all = this._readAll();
    all[roleKey] = Array.isArray(ids) ? ids.map((x) => String(x)) : [];
    this._writeAll(all);
  }

  static ensureDefaults(defaultDeckIds) {
    const all = this._readAll();
    let changed = false;

    for (let i = 0; i < ROLES.length; i += 1) {
      const k = ROLES[i];
      if (!Array.isArray(all[k]) || all[k].length === 0) {
        all[k] = defaultDeckIds.slice();
        changed = true;
      }
    }

    if (changed) this._writeAll(all);
  }

  static clearAllDecks() {
    try {
      localStorage.removeItem(STORAGE_KEY_DECKS);
    } catch {
      // ignore
    }
  }
}
