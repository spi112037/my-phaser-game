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
    this.nameInputGlow = null;
    this.codeInputGlow = null;

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

    this._drawBackground(w, h);
    this._drawTopBar(w);
    this._drawHeroSilhouettes(w, h);
    this._drawMainPanels(w, h);

    this._makeButton(w - 108, 42, "返回", () => this.scene.start("MenuScene"), 128, 42, "18px", "secondary");

    this.add.text(w / 2, 92, "線上對戰大廳", {
      fontSize: "42px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#132036",
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(40);

    this.add.text(w / 2, 130, "建立房間、加入對戰，或直接觀戰目前正在進行的戰局", {
      fontSize: "18px",
      color: "#d4e9ff"
    }).setOrigin(0.5).setDepth(40);

    this._makeButton(w / 2 - 250, 192, "建立房間", () => this._createRoom(), 210, 54, "22px", "primary");
    this._makeButton(w / 2, 192, "加入房間", () => this._joinRoom(), 210, 54, "22px", "secondary");
    this._makeButton(w / 2 + 250, 192, "觀戰房間", () => this._spectateRoom(), 210, 54, "22px", "accent");

    this.add.text(w / 2, 250, "使用者名稱（建立 / 加入房間都會使用）", {
      fontSize: "18px",
      color: "#d4e8ff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(40);

    this.nameInputGlow = this.add.ellipse(w / 2, 286, 420, 66, 0x7fd5ff, 0.08).setDepth(34);
    this.nameInputBg = this.add
      .rectangle(w / 2, 286, 360, 44, 0x0d2238, 0.92)
      .setStrokeStyle(1.6, 0x9ddcff, 0.55)
      .setInteractive({ useHandCursor: true })
      .setDepth(35);
    this.nameInputBg.on("pointerup", () => {
      this._setInputFocus("name");
      this._openNamePrompt();
    });

    this.displayName = this._loadLocalName();
    this.nameText = this.add.text(w / 2, 286, "", { fontSize: "21px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setDepth(36);
    this._renderNameText();

    this.add.text(w / 2, 332, "輸入房間碼", {
      fontSize: "18px",
      color: "#d4e8ff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(40);

    this.codeInputGlow = this.add.ellipse(w / 2, 370, 344, 70, 0xffbe86, 0.06).setDepth(34);
    this.codeInputBg = this.add
      .rectangle(w / 2, 370, 300, 48, 0x151f34, 0.92)
      .setStrokeStyle(1.6, 0xffcf9d, 0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(35);
    this.codeInputBg.on("pointerup", () => this._setInputFocus("code"));
    this.codeText = this.add.text(w / 2, 370, "------", { fontSize: "24px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5).setDepth(36);

    this.add.text(w / 2, 410, "先輸入名稱再建立 / 加入。名稱欄可點擊或按 Enter 輸入中文", {
      fontSize: "15px",
      color: "#9fc8ea"
    }).setOrigin(0.5).setDepth(40);

    this.roomInfoText = this.add.text(w / 2, 448, "", {
      fontSize: "19px",
      color: "#ffe0a6",
      align: "center",
      lineSpacing: 4
    }).setOrigin(0.5).setDepth(40);
    this.statusText = this.add.text(w / 2, 490, "尚未配對", {
      fontSize: "20px",
      color: "#ffffff",
      align: "center",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(40);

    this._buildOnlineRoomList(w / 2, 560);
    this._buildDeckPicker(w / 2, 792);
    this._setInputFocus("code");

    this.input.keyboard.on("keydown", (evt) => {
      if (this.roomCode) return;

      if (evt.key === "Tab") {
        this._setInputFocus(this.activeInput === "name" ? "code" : "name");
        return;
      }

      if (evt.key === "Enter" && this.activeInput === "name") {
        this._openNamePrompt();
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

      if (this.activeInput === "name") return;
    });
  }

  shutdown() {
    if (this.pollTimer) this.pollTimer.remove(false);
    this.pollTimer = null;
    if (this.roomListRefreshTimer) this.roomListRefreshTimer.remove(false);
    this.roomListRefreshTimer = null;
    this._clearRoomListButtons();
  }

  _drawBackground(w, h) {
    const g = this.add.graphics();
    g.fillGradientStyle(0x12284a, 0x183966, 0x060d18, 0x040913, 1);
    g.fillRect(0, 0, w, h);

    this.add.ellipse(w * 0.5, h * 0.28, 720, 280, 0x6fd2ff, 0.07).setDepth(1);
    this.add.ellipse(w * 0.18, h * 0.54, 460, 340, 0x60c7ff, 0.05).setDepth(1);
    this.add.ellipse(w * 0.82, h * 0.54, 460, 340, 0xffbc80, 0.05).setDepth(1);
    this.add.rectangle(w / 2, h - 90, w, 260, 0x07101c, 0.42).setDepth(1);

    for (let i = 0; i < 80; i += 1) {
      const sx = Phaser.Math.Between(0, w);
      const sy = Phaser.Math.Between(0, Math.floor(h * 0.72));
      const star = this.add.circle(sx, sy, Phaser.Math.Between(1, 2), 0xe4f5ff, Phaser.Math.FloatBetween(0.12, 0.72)).setDepth(2);
      this.tweens.add({
        targets: star,
        alpha: { from: Phaser.Math.FloatBetween(0.08, 0.35), to: Phaser.Math.FloatBetween(0.45, 0.9) },
        duration: Phaser.Math.Between(1400, 2800),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1500)
      });
    }
  }

  _drawTopBar(w) {
    const glow = this.add.rectangle(w / 2, 30, w, 64, 0x6fd2ff, 0.04).setDepth(10);
    const bar = this.add.rectangle(w / 2, 30, w, 54, 0x081424, 0.78).setDepth(11).setStrokeStyle(1.2, 0x8fd8ff, 0.34);
    this.add.rectangle(w / 2, 54, w - 60, 2, 0xf0fbff, 0.12).setDepth(12);
    this.add.text(26, 30, "火焰征程・線上大廳", {
      fontSize: "18px",
      color: "#e4f4ff",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setDepth(13);
    this.add.text(w - 210, 30, "即時對戰 / 觀戰 / 牌組", {
      fontSize: "16px",
      color: "#ffdba6",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setDepth(13);
    this.tweens.add({ targets: glow, alpha: { from: 0.04, to: 0.09 }, duration: 1800, yoyo: true, repeat: -1 });
  }

  _drawHeroSilhouettes(w, h) {
    const leftAura = this.add.circle(w * 0.12, h * 0.64, 190, 0x5dc8ff, 0.08).setDepth(3);
    const rightAura = this.add.circle(w * 0.88, h * 0.64, 190, 0xffba7a, 0.08).setDepth(3);
    const leftBody = this.add.rectangle(w * 0.13, h * 0.7, 130, 320, 0x081a2f, 0.5).setAngle(-10).setDepth(4);
    const rightBody = this.add.rectangle(w * 0.87, h * 0.7, 130, 320, 0x30170d, 0.5).setAngle(10).setDepth(4);
    const leftEdge = this.add.rectangle(w * 0.16, h * 0.67, 26, 240, 0xb0ebff, 0.06).setAngle(-10).setDepth(5);
    const rightEdge = this.add.rectangle(w * 0.84, h * 0.67, 26, 240, 0xffd1a3, 0.06).setAngle(10).setDepth(5);
    this.tweens.add({
      targets: [leftAura, rightAura, leftEdge, rightEdge],
      alpha: { from: 0.05, to: 0.12 },
      duration: 2200,
      yoyo: true,
      repeat: -1
    });
  }

  _drawMainPanels(w, h) {
    const hallShadow = this.add.rectangle(w / 2, 686, 856, 232, 0x000000, 0.28).setDepth(18);
    const hallGlow = this.add.ellipse(w / 2, 680, 890, 244, 0x89d8ff, 0.06).setDepth(19);
    const hallPanel = this.add.rectangle(w / 2, 680, 840, 216, 0x0a192d, 0.82).setDepth(20).setStrokeStyle(1.6, 0xa8ddff, 0.42);
    this.add.rectangle(w / 2, 580, 770, 2, 0xe9f7ff, 0.14).setDepth(21);

    const deckShadow = this.add.rectangle(w / 2, 866, 676, 148, 0x000000, 0.24).setDepth(18);
    const deckGlow = this.add.ellipse(w / 2, 860, 708, 166, 0xffc58f, 0.05).setDepth(19);
    const deckPanel = this.add.rectangle(w / 2, 860, 660, 136, 0x101e33, 0.84).setDepth(20).setStrokeStyle(1.6, 0xffd3a8, 0.35);
    this.add.rectangle(w / 2, 802, 602, 2, 0xffe7ca, 0.12).setDepth(21);

    this.tweens.add({
      targets: [hallGlow, deckGlow],
      alpha: { from: 0.04, to: 0.1 },
      duration: 1700,
      yoyo: true,
      repeat: -1
    });

    hallShadow.setAlpha(0.28);
    hallPanel.setAlpha(0.82);
    deckShadow.setAlpha(0.24);
    deckPanel.setAlpha(0.84);
  }

  _buildOnlineRoomList(cx, topY) {
    this.add.text(cx - 366, topY - 28, "線上對戰大廳（等待中 / 進行中）", {
      fontSize: "20px",
      color: "#e5f4ff",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setDepth(40);

    this._makeButton(cx + 304, topY - 28, "刷新列表", () => this._refreshOnlineRoomList(), 128, 34, "15px", "secondary");
    this._makeButton(cx + 168, topY - 28, "上一頁", () => this._changeRoomListPage(-1), 96, 34, "15px", "secondary");
    this._makeButton(cx + 64, topY - 28, "下一頁", () => this._changeRoomListPage(1), 96, 34, "15px", "secondary");

    this.roomListText = this.add.text(cx - 364, topY + 2, "載入中...", {
      fontSize: "15px",
      color: "#d7ecff",
      wordWrap: { width: 560, useAdvancedWrap: true },
      lineSpacing: 7
    }).setDepth(40);

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
      item?.shadow?.destroy?.();
      item?.glow?.destroy?.();
      item?.backPlate?.destroy?.();
      item?.bg?.destroy?.();
      item?.topLight?.destroy?.();
      item?.innerLight?.destroy?.();
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

      const y = 580 + i * 32;

      const fillBtn = this._makeButton(904, y, "帶入", () => this._applyRoomCode(code), 58, 26, "13px", "secondary");
      this.roomListButtons.push(fillBtn);

      if (status === "waiting" || status === "ready") {
        const joinBtn = this._makeButton(968, y, "加入", () => this._quickJoinRoom(code), 58, 26, "13px", "primary");
        this.roomListButtons.push(joinBtn);
      }

      if (status === "playing" || status === "ready" || status === "finished") {
        const spectateBtn = this._makeButton(1038, y, "觀戰", () => {
          this._applyRoomCode(code);
          this._spectateRoom();
        }, 66, 26, "13px", "accent");
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
    lines.push(`\n第 ${this.roomListPage + 1}/${pageMax + 1} 頁 ｜ 右側可帶入 / 加入 / 觀戰`);
    this.roomListText.setText(lines.join("\n"));
    this._renderRoomListButtons(pageRooms);
  }

  async _refreshOnlineRoomList() {
    if (!this.roomListText) return;
    try {
      const res = await ApiClient.listRooms({ status: "waiting,ready,playing" });
      this.roomListAll = Array.isArray(res?.rooms) ? res.rooms : [];
      this._renderCurrentRoomListPage();
    } catch (err) {
      this._clearRoomListButtons();
      this.roomListText.setText(`列表載入失敗：${String(err?.message || err)}`);
    }
  }

  _buildDeckPicker(cx, topY) {
    this.add.text(cx - 322, topY - 38, "選擇牌組（L1 ~ L4）", {
      fontSize: "19px",
      color: "#fff0d5",
      fontStyle: "bold"
    }).setDepth(40);

    this._makeButton(cx + 286, topY - 38, "編輯牌組", () => {
      this.scene.start("DeckScene", { role: this.selectedRole });
    }, 150, 36, "16px", "accent");

    const startX = cx - 330;
    this.roleButtons = [];
    for (let i = 0; i < LEFT_ROLES.length; i += 1) {
      const role = LEFT_ROLES[i];
      const x = startX + i * 94;
      const y = topY + 4;
      const btn = this._makeButton(x, y, role, () => {
        this.selectedRole = role;
        this._refreshDeckPreview();
      }, 82, 34, "16px", "secondary");
      this.roleButtons.push({ role, ...btn });
    }

    this.deckPreviewText = this.add.text(cx - 242, topY + 34, "", {
      fontSize: "16px",
      color: "#d7ecff",
      wordWrap: { width: 520, useAdvancedWrap: true },
      lineSpacing: 6
    }).setDepth(40);

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

  _openNamePrompt() {
    const current = String(this.displayName || "");
    const input = window.prompt("請輸入使用者名稱（可輸入中文）", current);
    if (input === null) return;
    this.displayName = String(input || "").trim().slice(0, 24);
    this._saveLocalName(this.displayName);
    this._renderNameText();
  }

  _renderNameText() {
    if (!this.nameText) return;
    const v = String(this.displayName || "").trim();
    this.nameText.setText(v || "請輸入名稱");
    this.nameText.setColor(v ? "#ffffff" : "#9dc4e6");
  }

  _setInputFocus(target) {
    this.activeInput = target === "name" ? "name" : "code";
    if (this.nameInputBg) this.nameInputBg.setStrokeStyle(2, this.activeInput === "name" ? 0x5cd3ff : 0x9ddcff, this.activeInput === "name" ? 0.95 : 0.55);
    if (this.codeInputBg) this.codeInputBg.setStrokeStyle(2, this.activeInput === "code" ? 0xffc88f : 0xffcf9d, this.activeInput === "code" ? 0.95 : 0.5);
    if (this.nameInputGlow) this.nameInputGlow.setFillStyle(0x7fd5ff, this.activeInput === "name" ? 0.14 : 0.08);
    if (this.codeInputGlow) this.codeInputGlow.setFillStyle(0xffbe86, this.activeInput === "code" ? 0.12 : 0.06);
  }

  _getSelectedDeckIds() {
    const ids = GameState.getDeckIds(this.selectedRole).filter((id) => !!CardFactory.getCardDef(id));
    return ids.length > 0 ? ids : [...FALLBACK_DECK_IDS];
  }

  _refreshDeckPreview() {
    for (let i = 0; i < this.roleButtons.length; i += 1) {
      const item = this.roleButtons[i];
      const active = item.role === this.selectedRole;
      item.bg.setFillStyle(active ? 0x4fa6df : 0x11233b, active ? 0.98 : 0.9);
      item.bg.setStrokeStyle(active ? 2 : 1.4, active ? 0xf1fbff : 0xa7d9ff, active ? 0.92 : 0.42);
      item.glow?.setFillStyle(0x8cdcff, active ? 0.18 : 0.06);
      item.t?.setColor(active ? "#ffffff" : "#e6f3ff");
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
      const displayName = String(this.displayName || "").trim();
      if (!displayName) {
        this.statusText.setText("請先輸入你的名稱，再建立房間");
        return;
      }
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
      const displayName = String(this.displayName || "").trim();
      if (!displayName) {
        this.statusText.setText("請先輸入你的名稱，再加入房間");
        return;
      }
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

  _makeButton(cx, cy, text, onClick, width = 300, height = 46, fontSize = "20px", variant = "secondary") {
    const isPrimary = variant === "primary";
    const isAccent = variant === "accent";
    const baseColor = isPrimary ? 0x55b8f0 : (isAccent ? 0x5f4db0 : 0x11233b);
    const backColor = isPrimary ? 0x2b6290 : (isAccent ? 0x33286a : 0x09131f);
    const glowColor = isPrimary ? 0x8cdcff : (isAccent ? 0xd0b6ff : 0x7ecfff);
    const strokeColor = isPrimary ? 0xf1fbff : (isAccent ? 0xf0ddff : 0xa7d9ff);

    const shadow = this.add.rectangle(cx, cy + 6, width, height, 0x000000, 0.34).setDepth(60);
    const glow = this.add.ellipse(cx, cy, width + 34, height + 20, glowColor, isPrimary || isAccent ? 0.16 : 0.06).setDepth(61);
    const backPlate = this.add.rectangle(cx, cy + 3, width, height, backColor, 0.95).setDepth(62);
    const bg = this.add.rectangle(cx, cy, width, height, baseColor, isPrimary || isAccent ? 0.96 : 0.9).setDepth(63);
    const topLight = this.add.rectangle(cx, cy - height / 2 + 10, width - 22, 3, 0xf4fbff, isPrimary || isAccent ? 0.36 : 0.16).setDepth(64);
    const innerLight = this.add.rectangle(cx, cy - 6, width - 24, height * 0.38, 0xffffff, isPrimary || isAccent ? 0.08 : 0.03).setDepth(64);
    bg.setStrokeStyle(1.8, strokeColor, isPrimary || isAccent ? 0.88 : 0.42);
    bg.setInteractive({ useHandCursor: true });

    const t = this.add.text(cx, cy - 1, text, {
      fontSize,
      color: "#ffffff",
      fontStyle: "bold",
      stroke: isPrimary || isAccent ? "#20354e" : "#08111b",
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(65);

    bg.on("pointerover", () => {
      bg.setFillStyle(isPrimary ? 0x81d4ff : (isAccent ? 0x7b6ad6 : 0x18304f), 1);
      glow.setFillStyle(glowColor, isPrimary || isAccent ? 0.24 : 0.1);
      this.tweens.add({ targets: [bg, backPlate, t, topLight, innerLight], scaleX: 1.025, scaleY: 1.025, duration: 100 });
      this.tweens.add({ targets: shadow, alpha: 0.44, duration: 100 });
    });

    bg.on("pointerout", () => {
      bg.setFillStyle(baseColor, isPrimary || isAccent ? 0.96 : 0.9);
      glow.setFillStyle(glowColor, isPrimary || isAccent ? 0.16 : 0.06);
      this.tweens.add({ targets: [bg, backPlate, t, topLight, innerLight], scaleX: 1, scaleY: 1, duration: 100 });
      this.tweens.add({ targets: shadow, alpha: 0.34, duration: 100 });
    });

    bg.on("pointerup", () => {
      this.tweens.add({ targets: [bg, backPlate, t], scaleX: 0.985, scaleY: 0.985, duration: 65, yoyo: true });
      onClick?.();
    });

    return { shadow, glow, backPlate, bg, topLight, innerLight, t };
  }
}
