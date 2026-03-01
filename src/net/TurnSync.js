import ApiClient from "./ApiClient";

export default class TurnSync {
  constructor({ roomCode, pollMs = 900, onRemoteTurn, onRemoteAction, onState }) {
    this.roomCode = roomCode;
    this.pollMs = pollMs;
    this.onRemoteTurn = onRemoteTurn;
    this.onRemoteAction = onRemoteAction;
    this.onState = onState;

    this.timer = null;
    this.running = false;
    this.lastSeenTurn = 0;
    this.lastSeenActionSeq = 0;
  }

  start(initialTurn = 0, initialActionSeq = 0) {
    this.lastSeenTurn = Math.max(0, Number(initialTurn || 0));
    this.lastSeenActionSeq = Math.max(0, Number(initialActionSeq || 0));
    this.running = true;
    this._pollNow();
    this.timer = setInterval(() => this._pollNow(), this.pollMs);
  }

  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async _pollNow() {
    if (!this.running) return;

    try {
      const state = await ApiClient.getState(this.roomCode);
      if (typeof this.onState === "function") this.onState(state);

      const liveActions = Array.isArray(state?.liveActions) ? state.liveActions : [];
      let maxSeq = this.lastSeenActionSeq;
      for (let i = 0; i < liveActions.length; i += 1) {
        const item = liveActions[i];
        const seq = Number(item?.seq ?? 0);
        if (!Number.isFinite(seq) || seq <= this.lastSeenActionSeq) continue;
        if (typeof this.onRemoteAction === "function") this.onRemoteAction(item);
        if (seq > maxSeq) maxSeq = seq;
      }
      this.lastSeenActionSeq = maxSeq;

      const currentTurn = Math.max(0, Number(state?.currentTurn ?? 0));
      const turns = state?.turns && typeof state.turns === "object" ? state.turns : null;
      if (!turns || currentTurn <= this.lastSeenTurn) return;

      for (let i = this.lastSeenTurn + 1; i <= currentTurn; i += 1) {
        const action = turns[String(i)] || turns[i];
        if (!action) continue;
        if (typeof this.onRemoteTurn === "function") this.onRemoteTurn(action);
      }
      this.lastSeenTurn = currentTurn;
    } catch {
      // Polling failure should not break local play. Next tick retries.
    }
  }
}
