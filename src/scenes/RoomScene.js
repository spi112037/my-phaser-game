import Phaser from "phaser";
import ApiClient from "../net/ApiClient";
import GameState from "../core/GameState";
import CardFactory from "../models/CardFactory";
import { LEFT_ROLES } from "../config/constants";

const FALLBACK_DECK_IDS = [
  "s_swordsman",
  "s_swordsman",
  "s_archer",
  "s_archer",
  "s_guard",
  "s_mage",
  "s_guard"
];

const LOCAL_NAME_KEY = "flame_player_name";

export default class RoomScene extends Phaser.Scene {
  constructor() {
    super("RoomScene");

    this.inputCode = "";
    this.roomCode = "";
    this.playerId = "";
    this.seed = "";
    this.pollTimer = null;

    this.statusText = null;
    this.roomInfoText = null;
    this.codeText = null;
    this.nameText = null;
    this.deckPreviewText = null;

    this.selectedRole = LEFT_ROLES[0] || "L1";
    this.roleButtons = [];

    this.roomDecks = { A: [], B: [] };
    this.roomNames = { A: "玩家A", B: "玩家B" };

    this.displayName = "";
    this.activeInput = "code";
    this.codeInputBg = null;
    this.nameInputBg = null;

    this.roomListText = null;
    this.roomListRefreshTimer = null;
    this.roomListButtons = [];
    this.roomListAll = [];
    this.roomListPage = 0;
    this.roomListPageSize = 6;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0x0b1422);
    this.add.text(w / 2, 68, "線上對戰（房間碼）", { fontSize: "34px", color: "#ffffff" }).setOrigin(0.5);

    this._makeButton(w - 110, 40, "返回", () => this.scene.start("MenuScene"), 120, 40);

    this._makeButton(w / 2 - 250, 160, "建立房間", () => this._createRoom(), 200, 50);
    this._makeButton(w / 2, 160, "加入房間", () => this._joinRoom(), 200, 50);
    this._makeButton(w / 2 + 250, 160, "觀戰房間", () => this._spectateRoom(), 200, 50);

    this.add.text(w / 2, 218, "使用者名稱", { fontSize: "18px", color: "#cfe8ff" }).setOrigin(0.5);
    this.nameInputBg = this.add
      .rectangle(w / 2, 254, 360, 42, 0xffffff, 0.08)
      .setStrokeStyle(1, 0x9ddcff, 0.55)
      .setInteractive({ useHandCursor: true });
    this.nameInputBg.on("pointerup", () => this._setInputFocus("name"));

    this.displayName = this._loadLocalName();
    this.nameText = this.add.text(w / 2, 254, "", { fontSize: "20px", color: "#ffffff" }).setOrigin(0.5);
    this._renderNameText();

    this.add.text(w / 2, 298, "輸入房間碼", { fontSize: "20px", color: "#cfe8ff" }).setOrigin(0.5);
    this.codeInputBg = this.add
      .rectangle(w / 2, 338, 300, 48, 0xffffff, 0.08)
      .setStrokeStyle(1, 0x9ddcff, 0.55)
      .setInteractive({ useHandCursor: true });
    this.codeInputBg.on("pointerup", () => this._setInputFocus("code"));
    this.codeText = this.add.text(w / 2, 338, "------", { fontSize: "24px", color: "#ffffff" }).setOrigin(0.5);

    this.add.text(w / 2, 378, "Tab 切換輸入欄，Backspace 刪除", { fontSize: "16px", color: "#9dc4e6" }).setOrigin(0.5);

    this.roomInfoText = this.add.text(w / 2, 418, "", { fontSize: "20px", color: "#ffdca8", align: "center" }).setOrigin(0.5);
    this.statusText = this.add.text(w / 2, 456, "尚未配對", { fontSize: "20px", color: "#ffffff", align: "center" }).setOrigin(0.5);

    this._buildOnlineRoomList(w / 2, 522);

    this._buildDeckPicker(w / 2, 700);
    this._setInputFocus("code");

    this.input.keyboard.on("keydown", (evt) => {
      if (this.roomCode) return;

      if (evt.key === "Tab") {
        this._setInputFocus(this.activeInput === "name" ? "code" : "name");
        return;
      }

      if (evt.key === "Backspace") {
        if (this.activeInput === "name") {
          this.displayName = this.displayName.slice(0, -1);
          this._saveLocalName(this.displayName);
          this._renderNameText();
        } else {
          this.inputCode = this.inputCode.slice(0, -1);
          this.codeText.setText(this.inputCode || "------");
        }
        return;
      }

      if (this.activeInput === "code") {
        if (/^[a-zA-Z0-9]$/.test(evt.key) && this.inputCode.length < 8) {
          this.inputCode += evt.key.toUpperCase();
          this.codeText.setText(this.inputCode || "------");
        }
        return;
      }

      if (!evt.ctrlKey && !evt.metaKey && evt.key.length === 1 && this.displayName.length < 24) {
        this.displayName += evt.key;
        this._saveLocalName(this.displayName);
        this._renderNameText();
      }
    });
  }

  shutdown() {
    if (this.pollTimer) this.pollTimer.remove(false);
    this.pollTimer = null;
    if (this.roomListRefreshTimer) this.roomListRefreshTimer.remove(false);
    this.roomListRefreshTimer = null;
    this._clearRoomListButtons();
  }

  _buildOnlineRoomList(cx, topY) {
    this.add.rectangle(cx, topY + 92, 760, 210, 0xffffff, 0.05).setStrokeStyle(1, 0x9ddcff, 0.35);
    this.add.text(cx - 364, topY - 12, "線上對戰大廳（等待中 / 進行中）", {
      fontSize: "18px",
      color: "#cfe8ff"
    }).setOrigin(0, 0.5);

    this._makeButton(cx + 300, topY - 12, "刷新列表", () => this._refreshOnlineRoomList(), 120, 32);
    this._makeButton(cx + 170, topY - 12, "上一頁", () => this._changeRoomListPage(-1), 90, 32);
    this._makeButton(cx + 70, topY - 12, "下一頁", () => this._changeRoomListPage(1), 90, 32);

    this.roomListText = this.add.text(cx - 364, topY + 12, "載入中...", {
      fontSize: "15px",
      color: "#d7ecff",
      wordWrap: { width: 560, useAdvancedWrap: true },
      lineSpacing: 4
    });

    this._refreshOnlineRoomList();
    this.roomListRefreshTimer = this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => this._refreshOnlineRoomList()
    });
  }

  _clearRoomListButtons() {
    if (!Array.isArray(this.roomListButtons)) {
      this.roomListButtons = [];
      return;
    }
    for (let i = 0; i < this.roomListButtons.length; i += 1) {
      const item = this.roomListButtons[i];
      item?.bg?.destroy?.();
      item?.t?.destroy?.();
    }
    this.roomListButtons = [];
  }

  _statusBadge(status) {
    const s = String(status || "").toLowerCase();
    if (s === "playing") return "[進行中]";
    if (s === "ready") return "[可開始]";
    if (s === "finished") return "[已結束]";
    return "[等待中]";
  }

  _applyRoomCode(code) {
    this.inputCode = String(code || "").toUpperCase();
    this.codeText?.setText?.(this.inputCode || "------");
  }

  _quickJoinRoom(code) {
    this._applyRoomCode(code);
    this._joinRoom();
  }

  _changeRoomListPage(delta) {
    const total = Array.isArray(this.roomListAll) ? this.roomListAll.length : 0;
    const pageMax = Math.max(0, Math.ceil(total / this.roomListPageSize) - 1);
    const next = Math.max(0, Math.min(pageMax, Number(this.roomListPage || 0) + Number(delta || 0)));
    if (next === this.roomListPage) return;
    this.roomListPage = next;
    this._renderCurrentRoomListPage();
  }

  _renderRoomListButtons(rooms) {
    this._clearRoomListButtons();
    const max = Math.min(this.roomListPageSize, rooms.length);
    for (let i = 0; i < max; i += 1) {
      const room = rooms[i];
      const code = String(room?.roomCode || "");
      const status = String(room?.status || "waiting").toLowerCase();
      if (!code) continue;

      const y = 540 + i * 32;

      const fillBtn = this._makeButton(900, y, "帶入", () => this._applyRoomCode(code), 56, 26);
      this.roomListButtons.push(fillBtn);

      if (status === "waiting" || status === "ready") {
        const joinBtn = this._makeButton(962, y, "加入", () => this._quickJoinRoom(code), 56, 26);
        this.roomListButtons.push(joinBtn);
      }

      if (status === "playing" || status === "ready" || status === "finished") {
        const spectateBtn = this._makeButton(1030, y, "觀戰", () => {
          this._applyRoomCode(code);
          this._spectateRoom();
        }, 64, 26);
        this.roomListButtons.push(spectateBtn);
      }
    }
  }

  _renderCurrentRoomListPage() {
    if (!this.roomListText) return;
    const rooms = Array.isArray(this.roomListAll) ? this.roomListAll : [];
    if (rooms.length <= 0) {
      this._clearRoomListButtons();
      this.roomListText.setText("目前沒有可顯示的房間");
      return;
    }

    const pageMax = Math.max(0, Math.ceil(rooms.length / this.roomListPageSize) - 1);
    if (this.roomListPage > pageMax) this.roomListPage = pageMax;
    const start = this.roomListPage * this.roomListPageSize;
    const pageRooms = rooms.slice(start, start + this.roomListPageSize);

    const lines = pageRooms.map((r, idx) => {
      const code = String(r?.roomCode || "------");
      const a = String(r?.names?.A || "玩家A");
      const b = String(r?.names?.B || "玩家B");
      const turn = Number(r?.currentTurn || 0);
      const badge = this._statusBadge(r?.status);
      return `${start + idx + 1}. ${badge} [${code}] ${a} vs ${b} ｜ 回合 ${turn}`;
    });
    lines.push(`\n第 ${this.roomListPage + 1}/${pageMax + 1} 頁 ｜ 右側可帶入/加入/觀戰`);
    this.roomListText.setText(lines.join("\n"));
    this._renderRoomListButtons(pageRooms);
  }

  async _refreshOnlineRoomList() {
    if (!this.roomListText) return;
    try {
      const res = await ApiClient.listRooms({ status: "waiting,ready,playing,finished" });
      this.roomListAll = Array.isArray(res?.rooms) ? res.rooms : [];
      this._renderCurrentRoomListPage();
    } catch (err) {
      this._clearRoomListButtons();
      this.roomListText.setText(`列表載入失敗：${String(err?.message || err)}`);
    }
  }

  _buildDeckPicker(cx, topY) {
    this.add.text(cx - 340, topY - 26, "選擇牌組（L1~L4）", {
      fontSize: "18px",
      color: "#cfe8ff"
    });

    this._makeButton(cx + 290, topY - 26, "編輯牌組", () => {
      this.scene.start("DeckScene", { role: this.selectedRole });
    }, 140, 34);

    const startX = cx - 336;
    this.roleButtons = [];
    for (let i = 0; i < LEFT_ROLES.length; i += 1) {
      const role = LEFT_ROLES[i];
      const x = startX + i * 92;
      const y = topY + 10;
      const btn = this._makeButton(x, y, role, () => {
        this.selectedRole = role;
        this._refreshDeckPreview();
      }, 80, 34);
      this.roleButtons.push({ role, ...btn });
    }

    this.add.rectangle(cx + 82, topY + 78, 540, 130, 0xffffff, 0.05).setStrokeStyle(1, 0x9ddcff, 0.35);
    this.deckPreviewText = this.add.text(cx - 176, topY + 28, "", {
      fontSize: "16px",
      color: "#d7ecff",
      wordWrap: { width: 500, useAdvancedWrap: true },
      lineSpacing: 4
    });

    this._refreshDeckPreview();
  }

  _loadLocalName() {
    try {
      const v = localStorage.getItem(LOCAL_NAME_KEY);
      return String(v || "").trim().slice(0, 24);
    } catch {
      return "";
    }
  }

  _saveLocalName(v) {
    try {
      localStorage.setItem(LOCAL_NAME_KEY, String(v || "").slice(0, 24));
    } catch {}
  }

  _renderNameText() {
    if (!this.nameText) return;
    const v = String(this.displayName || "").trim();
    this.nameText.setText(v || "請輸入名稱");
    this.nameText.setColor(v ? "#ffffff" : "#9dc4e6");
  }

  _setInputFocus(target) {
    this.activeInput = target === "name" ? "name" : "code";
    if (this.nameInputBg) this.nameInputBg.setStrokeStyle(2, this.activeInput === "name" ? 0x5cd3ff : 0x9ddcff, 0.95);
    if (this.codeInputBg) this.codeInputBg.setStrokeStyle(2, this.activeInput === "code" ? 0x5cd3ff : 0x9ddcff, 0.95);
  }

  _getSelectedDeckIds() {
    const ids = GameState.getDeckIds(this.selectedRole).filter((id) => !!CardFactory.getCardDef(id));
    return ids.length > 0 ? ids : [...FALLBACK_DECK_IDS];
  }

  _refreshDeckPreview() {
    for (let i = 0; i < this.roleButtons.length; i += 1) {
      const item = this.roleButtons[i];
      const active = item.role === this.selectedRole;
      item.bg.setFillStyle(active ? 0x3a7cc8 : 0xffffff, active ? 0.42 : 0.12);
      item.bg.setStrokeStyle(active ? 2 : 1, active ? 0x9ddcff : 0xffffff, active ? 0.95 : 0.25);
    }

    const ids = this._getSelectedDeckIds();
    const names = ids.map((id) => CardFactory.getCardDef(id)?.name || id);
    const grouped = {};
    for (let i = 0; i < names.length; i += 1) {
      const n = String(names[i] || "").trim() || "未知";
      grouped[n] = (grouped[n] || 0) + 1;
    }
    const summary = Object.keys(grouped).map((k) => `${k} x${grouped[k]}`).join("、");

    this.deckPreviewText?.setText(
      `目前牌組：${this.selectedRole}\n卡片數：${ids.length}\n內容：${summary || "（空）"}`
    );
  }

  async _createRoom() {
    try {
      this.statusText.setText("建立房間中...");
      const deckIds = this._getSelectedDeckIds();
      const displayName = String(this.displayName || "").trim() || "玩家A";
      this._saveLocalName(displayName);

      const res = await ApiClient.createRoom({ deckIds, displayName });
      this.roomCode = String(res.roomCode || "");
      this.seed = String(res.seed || "");
      this.playerId = String(res.playerId || "A");

      this.roomDecks = {
        A: Array.isArray(res?.decks?.A) ? res.decks.A.map((x) => String(x)) : deckIds,
        B: Array.isArray(res?.decks?.B) ? res.decks.B.map((x) => String(x)) : []
      };
      this.roomNames = {
        A: String(res?.names?.A || "玩家A"),
        B: String(res?.names?.B || "玩家B")
      };

      this.roomInfoText.setText(`房間碼：${this.roomCode}\n名稱：${this.roomNames.A}`);
      this.statusText.setText("房間已建立，等待另一位玩家加入...");
      this._startWaiting();
    } catch (err) {
      this.statusText.setText(`建立失敗：${String(err?.message || err)}`);
    }
  }

  async _joinRoom() {
    const code = this.inputCode.trim().toUpperCase();
    if (!code) {
      this.statusText.setText("請輸入房間碼");
      return;
    }

    try {
      this.statusText.setText("加入房間中...");
      const deckIds = this._getSelectedDeckIds();
      const displayName = String(this.displayName || "").trim() || "玩家B";
      this._saveLocalName(displayName);

      const res = await ApiClient.joinRoom(code, { deckIds, displayName });
      this.roomCode = code;
      this.seed = String(res.seed || "");
      this.playerId = String(res.playerId || "B");

      this.roomDecks = {
        A: Array.isArray(res?.decks?.A) ? res.decks.A.map((x) => String(x)) : [],
        B: Array.isArray(res?.decks?.B) ? res.decks.B.map((x) => String(x)) : deckIds
      };
      this.roomNames = {
        A: String(res?.names?.A || "玩家A"),
        B: String(res?.names?.B || "玩家B")
      };

      this.roomInfoText.setText(`房間碼：${this.roomCode}\n名稱：${this.roomNames.B}`);
      this.statusText.setText("配對成功，準備進入戰場...");
      this._enterBattle();
    } catch (err) {
      this.statusText.setText(`加入失敗：${String(err?.message || err)}`);
    }
  }

  async _spectateRoom() {
    const code = this.inputCode.trim().toUpperCase();
    if (!code) {
      this.statusText.setText("請輸入房間碼");
      return;
    }

    try {
      this.statusText.setText("進入觀戰中...");
      const state = await ApiClient.getState(code);
      const seed = String(state?.seed || "");
      const decks = state?.decks && typeof state.decks === "object" ? state.decks : { A: [], B: [] };
      const names = state?.names && typeof state.names === "object" ? state.names : { A: "玩家A", B: "玩家B" };

      this.scene.start("BattleScene", {
        mode: "spectator",
        roomCode: code,
        seed,
        playerId: "",
        leftDeckIds: Array.isArray(decks?.A) ? decks.A.map((x) => String(x)) : [],
        rightDeckIds: Array.isArray(decks?.B) ? decks.B.map((x) => String(x)) : [],
        leftPlayerName: String(names?.A || "玩家A"),
        rightPlayerName: String(names?.B || "玩家B")
      });
    } catch (err) {
      this.statusText.setText(`觀戰失敗：${String(err?.message || err)}`);
    }
  }

  _startWaiting() {
    if (this.pollTimer) this.pollTimer.remove(false);
    this.pollTimer = this.time.addEvent({
      delay: 1800,
      loop: true,
      callback: async () => {
        if (!this.roomCode) return;
        try {
          const state = await ApiClient.getState(this.roomCode);
          this.roomDecks = {
            A: Array.isArray(state?.decks?.A) ? state.decks.A.map((x) => String(x)) : this.roomDecks.A,
            B: Array.isArray(state?.decks?.B) ? state.decks.B.map((x) => String(x)) : this.roomDecks.B
          };
          this.roomNames = {
            A: String(state?.names?.A || this.roomNames.A || "玩家A"),
            B: String(state?.names?.B || this.roomNames.B || "玩家B")
          };

          if (state?.status === "ready" || state?.status === "playing") {
            this.statusText.setText("對手已加入，準備進入戰場...");
            this._enterBattle();
          }
        } catch {
          this.statusText.setText("連線中斷，重試中...");
        }
      }
    });
  }

  _enterBattle() {
    if (!this.roomCode || !this.seed || !this.playerId) return;
    if (this.pollTimer) this.pollTimer.remove(false);
    this.pollTimer = null;

    this.scene.start("BattleScene", {
      mode: "online",
      roomCode: this.roomCode,
      seed: this.seed,
      playerId: this.playerId,
      leftDeckIds: Array.isArray(this.roomDecks?.A) ? this.roomDecks.A : [],
      rightDeckIds: Array.isArray(this.roomDecks?.B) ? this.roomDecks.B : [],
      leftPlayerName: String(this.roomNames?.A || "玩家A"),
      rightPlayerName: String(this.roomNames?.B || "玩家B")
    });
  }

  _makeButton(cx, cy, text, onClick, width = 300, height = 46) {
    const bg = this.add.rectangle(cx, cy, width, height, 0xffffff, 0.12).setInteractive({ useHandCursor: true });
    const t = this.add.text(cx, cy, text, { fontSize: "20px", color: "#ffffff" }).setOrigin(0.5);
    bg.on("pointerover", () => bg.setFillStyle(0x9ddcff, 0.18));
    bg.on("pointerout", () => bg.setFillStyle(0xffffff, 0.12));
    bg.on("pointerup", () => onClick?.());
    return { bg, t };
  }
}
