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

export default class RoomScene extends Phaser.Scene {
  constructor() {
    super("RoomScene");
    this.inputCode = "";
    this.roomCode = "";
    this.playerId = "";
    this.seed = "";
    this.pollTimer = null;
    this.statusText = null;
    this.roleButtons = [];
    this.deckPreviewText = null;
    this.selectedRole = LEFT_ROLES[0] || "L1";
    this.roomDecks = { A: [], B: [] };
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0x0b1422);
    this.add.text(w / 2, 72, "線上對戰（房間碼）", { fontSize: "34px", color: "#ffffff" }).setOrigin(0.5);

    this._makeButton(w - 120, 36, "返回", () => this.scene.start("MenuScene"), 140, 38);
    this._makeButton(w / 2 - 160, 170, "建立房間", () => this._createRoom(), 240, 52);
    this._makeButton(w / 2 + 160, 170, "加入房間", () => this._joinRoom(), 240, 52);

    this.add.text(w / 2, 250, "輸入房間碼", { fontSize: "20px", color: "#cfe8ff" }).setOrigin(0.5);
    this.add.rectangle(w / 2, 295, 300, 50, 0xffffff, 0.08).setStrokeStyle(1, 0x9ddcff, 0.5);
    this.codeText = this.add.text(w / 2, 295, "", { fontSize: "24px", color: "#ffffff" }).setOrigin(0.5);

    this.add.text(w / 2, 360, "可直接輸入英數，Backspace 刪除", { fontSize: "16px", color: "#9dc4e6" }).setOrigin(0.5);
    this.roomInfoText = this.add.text(w / 2, 420, "", { fontSize: "22px", color: "#ffdca8", align: "center" }).setOrigin(0.5);
    this.statusText = this.add.text(w / 2, 470, "請先選牌組，再建立/加入房間", {
      fontSize: "20px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5);

    this._buildDeckPicker(w / 2, 560);

    this.input.keyboard.on("keydown", (evt) => {
      if (this.roomCode) return;
      if (evt.key === "Backspace") {
        this.inputCode = this.inputCode.slice(0, -1);
      } else if (/^[a-zA-Z0-9]$/.test(evt.key) && this.inputCode.length < 8) {
        this.inputCode += evt.key.toUpperCase();
      }
      this.codeText.setText(this.inputCode || "------");
    });
    this.codeText.setText("------");
  }

  shutdown() {
    if (this.pollTimer) this.pollTimer.remove(false);
    this.pollTimer = null;
  }

  _buildDeckPicker(cx, topY) {
    this.add.text(cx - 350, topY - 20, "建房牌組（點選可預覽內容）", {
      fontSize: "18px",
      color: "#cfe8ff"
    });

    const startX = cx - 340;
    this.roleButtons = [];
    for (let i = 0; i < LEFT_ROLES.length; i += 1) {
      const role = LEFT_ROLES[i];
      const bx = startX + i * 92;
      const by = topY + 18;
      const btn = this._makeButton(bx, by, role, () => {
        this.selectedRole = role;
        this._refreshDeckPreview();
      }, 80, 34);
      this.roleButtons.push({ role, ...btn });
    }

    this.add.rectangle(cx + 90, topY + 70, 550, 145, 0xffffff, 0.05).setStrokeStyle(1, 0x9ddcff, 0.4);
    this.deckPreviewText = this.add.text(cx - 170, topY + 16, "", {
      fontSize: "16px",
      color: "#d7ecff",
      wordWrap: { width: 500, useAdvancedWrap: true },
      lineSpacing: 4
    });
    this._refreshDeckPreview();
  }

  _getSelectedDeckIds() {
    const ids = GameState.getDeckIds(this.selectedRole).filter((id) => !!CardFactory.getCardDef(id));
    return ids.length > 0 ? ids : [...FALLBACK_DECK_IDS];
  }

  _refreshDeckPreview() {
    for (let i = 0; i < this.roleButtons.length; i += 1) {
      const it = this.roleButtons[i];
      const active = it.role === this.selectedRole;
      it.bg.setFillStyle(active ? 0x3a7cc8 : 0xffffff, active ? 0.4 : 0.12);
      it.bg.setStrokeStyle(active ? 2 : 1, active ? 0x9ddcff : 0xffffff, active ? 0.9 : 0.25);
    }

    const ids = this._getSelectedDeckIds();
    const names = ids.map((id) => CardFactory.getCardDef(id)?.name || id);
    const grouped = {};
    for (let i = 0; i < names.length; i += 1) {
      const n = String(names[i] || "").trim() || "未知";
      grouped[n] = (grouped[n] || 0) + 1;
    }
    const summary = Object.keys(grouped).map((k) => `${k} x${grouped[k]}`).join("、");
    this.deckPreviewText.setText(
      `目前牌組：${this.selectedRole}\n張數：${ids.length}\n內容：${summary || "（空）"}`
    );
  }

  async _createRoom() {
    try {
      this.statusText.setText("建立房間中...");
      const deckIds = this._getSelectedDeckIds();
      const res = await ApiClient.createRoom({ deckIds });
      this.roomCode = String(res.roomCode || "");
      this.seed = String(res.seed || "");
      this.playerId = String(res.playerId || "A");
      this.roomDecks = {
        A: Array.isArray(res?.decks?.A) ? res.decks.A.map((x) => String(x)) : deckIds,
        B: Array.isArray(res?.decks?.B) ? res.decks.B.map((x) => String(x)) : []
      };
      this.roomInfoText.setText(`房間碼：${this.roomCode}\n玩家：${this.playerId}`);
      this.statusText.setText("已建立房間，等待另一位玩家加入...");
      this._startWaiting();
    } catch (err) {
      this.statusText.setText(`建立失敗：${String(err.message || err)}`);
    }
  }

  async _joinRoom() {
    const code = this.inputCode.trim().toUpperCase();
    if (!code) {
      this.statusText.setText("請先輸入房間碼");
      return;
    }
    try {
      this.statusText.setText("加入房間中...");
      const deckIds = this._getSelectedDeckIds();
      const res = await ApiClient.joinRoom(code, { deckIds });
      this.roomCode = code;
      this.seed = String(res.seed || "");
      this.playerId = String(res.playerId || "B");
      this.roomDecks = {
        A: Array.isArray(res?.decks?.A) ? res.decks.A.map((x) => String(x)) : [],
        B: Array.isArray(res?.decks?.B) ? res.decks.B.map((x) => String(x)) : deckIds
      };
      this.roomInfoText.setText(`房間碼：${this.roomCode}\n玩家：${this.playerId}`);
      this.statusText.setText("加入成功，準備進入戰鬥...");
      this._enterBattle();
    } catch (err) {
      this.statusText.setText(`加入失敗：${String(err.message || err)}`);
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
          if (state?.status === "ready" || state?.status === "playing") {
            this.statusText.setText("玩家已就緒，進入戰鬥...");
            this._enterBattle();
          }
        } catch {
          this.statusText.setText("連線中斷，正在重試...");
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
      rightDeckIds: Array.isArray(this.roomDecks?.B) ? this.roomDecks.B : []
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
