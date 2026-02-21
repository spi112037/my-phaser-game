import Phaser from "phaser";
import ApiClient from "../net/ApiClient";

export default class RoomScene extends Phaser.Scene {
  constructor() {
    super("RoomScene");
    this.inputCode = "";
    this.roomCode = "";
    this.playerId = "";
    this.seed = "";
    this.pollTimer = null;
    this.statusText = null;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0x0b1422);
    this.add.text(w / 2, 72, "線上對戰（房間碼）", { fontSize: "34px", color: "#ffffff" }).setOrigin(0.5);

    this._makeButton(w - 120, 36, "返回", () => this.scene.start("MenuScene"), 140, 38);

    this._makeButton(w / 2 - 160, 170, "建立房間", () => this._createRoom(), 240, 52);

    this.add.text(w / 2, 250, "輸入房間碼", { fontSize: "20px", color: "#cfe8ff" }).setOrigin(0.5);
    this.codeBox = this.add.rectangle(w / 2, 295, 300, 50, 0xffffff, 0.08).setStrokeStyle(1, 0x9ddcff, 0.5);
    this.codeText = this.add.text(w / 2, 295, "", { fontSize: "24px", color: "#ffffff" }).setOrigin(0.5);

    this._makeButton(w / 2 + 160, 170, "加入房間", () => this._joinRoom(), 240, 52);

    this.add.text(w / 2, 360, "可直接輸入英數，Backspace 刪除", { fontSize: "16px", color: "#9dc4e6" }).setOrigin(0.5);
    this.roomInfoText = this.add.text(w / 2, 420, "", { fontSize: "22px", color: "#ffdca8", align: "center" }).setOrigin(0.5);
    this.statusText = this.add.text(w / 2, 470, "尚未配對", { fontSize: "20px", color: "#ffffff", align: "center" }).setOrigin(0.5);

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

  async _createRoom() {
    try {
      this.statusText.setText("建立房間中...");
      const res = await ApiClient.createRoom();
      this.roomCode = String(res.roomCode || "");
      this.seed = String(res.seed || "");
      this.playerId = String(res.playerId || "A");
      this.roomInfoText.setText(`房間碼：${this.roomCode}\n你是玩家 ${this.playerId}`);
      this.statusText.setText("等待另一位玩家加入...");
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
      const res = await ApiClient.joinRoom(code);
      this.roomCode = code;
      this.seed = String(res.seed || "");
      this.playerId = String(res.playerId || "B");
      this.roomInfoText.setText(`房間碼：${this.roomCode}\n你是玩家 ${this.playerId}`);
      this.statusText.setText("加入成功，開始進入戰鬥...");
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
          if (state?.status === "ready" || state?.status === "playing") {
            this.statusText.setText("玩家已到齊，進入戰鬥...");
            this._enterBattle();
          }
        } catch {
          this.statusText.setText("連線中斷，持續重試...");
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
      playerId: this.playerId
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
