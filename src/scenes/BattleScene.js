import Phaser from "phaser";

import GameState from "../core/GameState";
import CardFactory from "../models/CardFactory";

import CardSystem from "../systems/CardSystem";
import GridCombatSystem from "../systems/GridCombatSystem";

import GridBoardUI from "../ui/GridBoardUI";
import HeroHUD from "../ui/HeroHUD";
import HandBar from "../ui/HandBar";
import CardDetailModal from "../ui/CardDetailModal";

import { DEPLOY_LEFT_COL_MAX, DEPLOY_RIGHT_COL_MIN } from "../config/constants";
import { createRng } from "../engine/rng";
import ApiClient from "../net/ApiClient";
import TurnSync from "../net/TurnSync";

function getCardCost(card) {
  return Math.max(0, Number(card?.cost ?? card?.baseCost ?? 0));
}

function countPlayable(actor) {
  const hand = Array.isArray(actor?.ready) ? actor.ready : [];
  let count = 0;
  for (let i = 0; i < hand.length; i += 1) {
    const c = hand[i];
    if (c && c.type === "summon" && c.unit && getCardCost(c) === 0) count += 1;
  }
  return count;
}

const BATTLEFIELD_BG_POOL = [
  { key: "bg_battlefield_01", path: "/cards/custom/bg_battlefield_01__.png" },
  { key: "bg_battlefield_02", path: "/cards/custom/bg_battlefield_02__.png" },
  { key: "bg_battlefield_03", path: "/cards/custom/bg_battlefield_03__.png" }
];

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");

    this.allies = 1;
    this.enemies = 1;

    this.mode = "local";
    this.roomCode = "";
    this.seed = "";
    this.playerId = "";
    this.mySide = "L";
    this.nextTurnIndex = 0;

    this.rng = Math.random;
    this.cardSystem = null;
    this.combat = null;
    this.turnSync = null;

    this.boardUI = null;
    this.hud = null;
    this.hand = null;
    this.cardModal = null;

    this.leftHero = null;
    this.rightHero = null;

    this.selectedCard = null;
    this.removeMode = false;
    this.turnActionBuffer = [];
    this.pendingTargets = new Set();
    this.pendingCardUse = new Map();
    this.autoPlayerEnabled = false;
    this.autoTurnPending = false;
    this.leftStartHp = 30;
    this.rightStartHp = 30;
    this.leftDeckIds = [];
    this.rightDeckIds = [];
    this.challengeLabel = "";
  }

  preload() {
    const deckIds = this._collectBattleDeckIds();
    const unique = new Set(deckIds);

    unique.forEach((id) => {
      const def = CardFactory.getCardDef(id);
      if (!def?.id || !def?.image) return;
      this.load.image(card_, def.image);
    });

    for (let i = 0; i < BATTLEFIELD_BG_POOL.length; i += 1) {
      const it = BATTLEFIELD_BG_POOL[i];
      this.load.image(it.key, it.path);
    }
  }

  init(data) {
    this.allies = Number(data?.allies ?? 1);
    this.enemies = Number(data?.enemies ?? 1);

    this.mode = String(data?.mode || "local");
    this.roomCode = String(data?.roomCode || "");
    this.seed = String(data?.seed || "");
    this.playerId = String(data?.playerId || "");
    this.mySide = this.playerId === "B" ? "R" : "L";

    this.nextTurnIndex = 0;
    this.selectedCard = null;
    this.removeMode = false;
    this.autoPlayerEnabled = Boolean(data?.autoPlayerEnabled ?? false);
    this.autoTurnPending = false;
    this.leftStartHp = Math.max(1, Number(data?.leftStartHp ?? 30));
    this.rightStartHp = Math.max(1, Number(data?.rightStartHp ?? 30));
    this.leftDeckIds = Array.isArray(data?.leftDeckIds)
      ? data.leftDeckIds.filter((id) => !!CardFactory.getCardDef(id)).map((id) => String(id))
      : [];
    this.rightDeckIds = Array.isArray(data?.rightDeckIds)
      ? data.rightDeckIds.filter((id) => !!CardFactory.getCardDef(id)).map((id) => String(id))
      : [];
    this.challengeLabel = String(data?.challengeLabel || "");
    this._clearTurnBuffer();
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    const bgIdx = Math.floor(this.rng() * BATTLEFIELD_BG_POOL.length);
    const bg = BATTLEFIELD_BG_POOL[Math.max(0, Math.min(BATTLEFIELD_BG_POOL.length - 1, bgIdx))];
    this.add.image(w / 2, h / 2, bg.key).setDisplaySize(w, h).setDepth(-1000);

    this.add
      .text(w - 140, 12, "霑泌屓驕ｸ蝟ｮ", { fontSize: "18px", color: "#9ddcff" })
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => {
        this._stopSync();
        this.scene.start("MenuScene");
      });

    this.rng = this.seed ? createRng(this.seed) : Math.random;
    this.cardSystem = new CardSystem(this.rng);

    this.leftHero = this._createHero("L1", "L");
    this.rightHero = this._createHero("R1", "R");

    this.boardUI = new GridBoardUI(
      this,
      (r, c) => this._onCellClick(r, c),
      (unit) => this._onInspectUnit(unit)
    );
    this.boardUI.setDeployRule((r, c) => this._canDeployAt(r, c));
    this.hud = new HeroHUD(this);
    this.hand = new HandBar(
      this,
      (card) => this._onSelectCard(card),
      () => this._onEndTurn(),
      (card) => this._onInspectCard(card),
      () => this._onToggleRemoveMode(),
      () => this._onToggleAutoPlayer()
    );
    this.cardModal = new CardDetailModal(this);

    this.combat = new GridCombatSystem(this, this.cardSystem, this.boardUI, this.rng);
    this.combat.setCombatants(this.leftHero, this.rightHero);
    this.combat.setInitialHeroHp(this.leftStartHp, this.rightStartHp);
    if (this._isOnlineMode()) {
      this.combat.setAutoAi(false);
      this.autoPlayerEnabled = false;
    } else {
      this.combat.setAutoAi(false);
      this.combat.setAutoAiForSide("R", true);
      this.combat.setAutoAiForSide("L", this.autoPlayerEnabled);
    }
    this.combat.start();

    this.onBattleState({
      left: this.leftHero,
      right: this.rightHero,
      turnSide: "L",
      turnCount: 1,
      logs: []
    });
    if (this.challengeLabel) {
      this.combat._log(`副本：${this.challengeLabel}`);
    }
    this.boardUI.renderBoard(this.combat.board);

    if (this._isOnlineMode()) this._startOnlineSync();
  }

  shutdown() {
    this._stopSync();
  }

  _isOnlineMode() {
    return this.mode === "online" && this.roomCode && this.playerId;
  }

  _isMyTurn() {
    if (!this.combat) return false;
    if (!this._isOnlineMode()) return this.combat.turnSide === "L";
    return this.combat.turnSide === this.mySide;
  }

  _sideFromPlayerId(playerId) {
    if (String(playerId) === "B") return "R";
    return "L";
  }

  _startOnlineSync() {
    this.turnSync = new TurnSync({
      roomCode: this.roomCode,
      pollMs: 2000,
      onRemoteTurn: (turnAction) => {
        if (!turnAction) return;
        const idx = Number(turnAction.turnIndex ?? 0);
        if (idx <= this.nextTurnIndex) return;

        if (String(turnAction.playerId) !== this.playerId) {
          this.applyTurnAction(turnAction);
        }
        this.nextTurnIndex = idx;
      }
    });
    this.turnSync.start(0);
  }

  _stopSync() {
    if (this.turnSync) this.turnSync.stop();
    this.turnSync = null;
  }

  _collectBattleDeckIds() {
    const fallback = this._demoDeckIds();

    const leftForced = Array.isArray(this.leftDeckIds) ? this.leftDeckIds : [];
    const rightForced = Array.isArray(this.rightDeckIds) ? this.rightDeckIds : [];
    if (leftForced.length > 0 || rightForced.length > 0) {
      return [...leftForced, ...rightForced, ...fallback];
    }

    const leftSaved = GameState.getDeckIds("L1").filter((id) => !!CardFactory.getCardDef(id));
    const rightSaved = GameState.getDeckIds("R1").filter((id) => !!CardFactory.getCardDef(id));

    const left = leftSaved.length > 0 ? leftSaved : fallback;
    const right = rightSaved.length > 0 ? rightSaved : fallback;

    return [...left, ...right, ...fallback];
  }

  _createHero(roleKey, side) {
    const forced = roleKey === "L1" ? this.leftDeckIds : (roleKey === "R1" ? this.rightDeckIds : []);
    const validForced = Array.isArray(forced)
      ? forced.filter((id) => !!CardFactory.getCardDef(id))
      : [];

    const saved = GameState.getDeckIds(roleKey);
    const validSaved = saved.filter((id) => !!CardFactory.getCardDef(id));
    const finalIds = validForced.length > 0
      ? validForced
      : (validSaved.length > 0 ? validSaved : this._demoDeckIds());

    return {
      id: roleKey,
      side,
      hp: 30,
      deck: finalIds.map((id) => CardFactory.create(id)),
      ready: [],
      grave: []
    };
  }

  _demoDeckIds() {
    return [
      "s_swordsman",
      "s_swordsman",
      "s_archer",
      "s_archer",
      "s_guard",
      "s_mage",
      "s_guard"
    ];
  }

  _onSelectCard(card) {
    if (!this._isMyTurn()) return;
    if (getCardCost(card) !== 0) return;
    this.removeMode = false;
    this.selectedCard = card;
    this.onBattleState({
      left: this.leftHero,
      right: this.rightHero,
      turnSide: this.combat?.turnSide || "L",
      turnCount: this.combat?.turnCount || 1,
      logs: this.combat?.logs || []
    });
  }

  _onToggleRemoveMode() {
    if (!this._isMyTurn()) return;
    this.removeMode = !this.removeMode;
    if (this.removeMode) {
      this.selectedCard = null;
      this.hand.clearSelection();
    }
    this.onBattleState({
      left: this.leftHero,
      right: this.rightHero,
      turnSide: this.combat.turnSide,
      turnCount: this.combat.turnCount,
      logs: this.combat.logs
    });
  }

  _onInspectCard(card) {
    if (!this.cardModal || !card) return;
    this.cardModal.showFromCard(card);
  }

  _onInspectUnit(unit) {
    if (this.removeMode) return;
    if (!this.cardModal || !unit) return;
    this.cardModal.showFromUnit(unit);
  }

  _onToggleAutoPlayer() {
    if (!this._isMyTurn()) return;
    if (!this.combat) return;

    this.autoPlayerEnabled = !this.autoPlayerEnabled;

    if (!this._isOnlineMode()) {
      this.combat.setAutoAiForSide("L", this.autoPlayerEnabled);
      this.combat._log(`我方自動AI：${this.autoPlayerEnabled ? "開啟" : "關閉"}`);
      this.onBattleState({
        left: this.leftHero,
        right: this.rightHero,
        turnSide: this.combat.turnSide,
        turnCount: this.combat.turnCount,
        logs: this.combat.logs
      });
      if (this.autoPlayerEnabled && this.combat.turnSide === "L") {
        this.time.delayedCall(220, () => {
          if (this.combat && this.combat.turnSide === "L" && this.autoPlayerEnabled) {
            this.combat.aiTakeTurn("L");
          }
        });
      }
      return;
    }

    this.combat._log(`連線自動戰鬥：${this.autoPlayerEnabled ? "開啟" : "關閉"}`);
    this.onBattleState({
      left: this.leftHero,
      right: this.rightHero,
      turnSide: this.combat.turnSide,
      turnCount: this.combat.turnCount,
      logs: this.combat.logs
    });

    if (this.autoPlayerEnabled) this._runOnlineAutoTurn();
  }

  _runOnlineAutoTurn() {
    if (!this._isOnlineMode()) return;
    if (!this.autoPlayerEnabled) return;
    if (!this._isMyTurn()) return;
    if (this.autoTurnPending) return;

    this.autoTurnPending = true;
    this.time.delayedCall(260, async () => {
      try {
        if (!this._isOnlineMode() || !this.autoPlayerEnabled || !this._isMyTurn()) return;

        this._clearTurnBuffer();
        const side = this.mySide;
        const hero = side === "R" ? this.rightHero : this.leftHero;
        const hand = Array.isArray(hero?.ready) ? hero.ready : [];

        for (let i = 0; i < hand.length; i += 1) {
          const card = hand[i];
          if (!card || String(card.type || "") !== "summon") continue;
          if (!card.unit || getCardCost(card) !== 0) continue;
          if (this._countAvailableCardUse(card.id) <= 0) continue;

          const bounds = this._deployBoundsForCard(card);
          let placed = false;
          for (let row = 0; row < 4 && !placed; row += 1) {
            if (side === "L") {
              for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
                if (this.combat?.board?.[row]?.[col]) continue;
                const key = `${row},${col}`;
                if (this.pendingTargets.has(key)) continue;
                this.turnActionBuffer.push({ type: "playCard", cardId: card.id, target: { row, col } });
                this.pendingTargets.add(key);
                this.pendingCardUse.set(card.id, (this.pendingCardUse.get(card.id) || 0) + 1);
                placed = true;
                break;
              }
            } else {
              for (let col = bounds.maxCol; col >= bounds.minCol; col -= 1) {
                if (this.combat?.board?.[row]?.[col]) continue;
                const key = `${row},${col}`;
                if (this.pendingTargets.has(key)) continue;
                this.turnActionBuffer.push({ type: "playCard", cardId: card.id, target: { row, col } });
                this.pendingTargets.add(key);
                this.pendingCardUse.set(card.id, (this.pendingCardUse.get(card.id) || 0) + 1);
                placed = true;
                break;
              }
            }
          }
        }

        await this._onEndTurn();
      } finally {
        this.autoTurnPending = false;
      }
    });
  }

  _countAvailableCardUse(cardId) {
    const side = this._isOnlineMode() ? this.mySide : "L";
    const hero = side === "L" ? this.leftHero : this.rightHero;
    const hand = Array.isArray(hero?.ready) ? hero.ready : [];
    let available = 0;
    for (let i = 0; i < hand.length; i += 1) {
      const c = hand[i];
      if (!c || c.id !== cardId) continue;
      const tp = String(c.type || "");
      if (tp !== "summon" && tp !== "skill") continue;
      if (tp === "summon" && !c.unit) continue;
      if (getCardCost(c) !== 0) continue;
      available += 1;
    }
    const used = this.pendingCardUse.get(cardId) || 0;
    return Math.max(0, available - used);
  }

  _cardHasNoMove(card) {
    const lines = [
      String(card?.ability1 || "").trim(),
      String(card?.ability2 || "").trim(),
      String(card?.ability3 || "").trim(),
      String(card?.ability4 || "").trim(),
      String(card?.ability5 || "").trim(),
      ...(Array.isArray(card?.abilities) ? card.abilities.map((x) => String(x || "").trim()) : [])
    ].filter((x) => x);
    const text = lines.join(" ");
    return /(不能移動|不能移动|無法移動|无法移动|禁止移動|禁止移动)/.test(text);
  }

  _deployBoundsForCard(card) {
    const noMove = this._cardHasNoMove(card);
    const maxCol = Math.max(0, Number(this.combat?.board?.[0]?.length ?? 12) - 1);
    if (this._isOnlineMode()) {
      if (this.mySide === "L") {
        return { minCol: 0, maxCol: noMove ? Math.min(maxCol, DEPLOY_LEFT_COL_MAX + 2) : DEPLOY_LEFT_COL_MAX };
      }
      return { minCol: noMove ? Math.max(0, DEPLOY_RIGHT_COL_MIN - 2) : DEPLOY_RIGHT_COL_MIN, maxCol };
    }
    return { minCol: 0, maxCol: noMove ? Math.min(maxCol, DEPLOY_LEFT_COL_MAX + 2) : DEPLOY_LEFT_COL_MAX };
  }

  _canDeployAt(row, col) {
    const bounds = this._deployBoundsForCard(this.selectedCard);
    if (col < bounds.minCol || col > bounds.maxCol) return false;

    if (this.combat?.board?.[row]?.[col]) return false;
    if (this.pendingTargets.has(`${row},${col}`)) return false;
    return true;
  }

  _onCellClick(row, col) {
    if (!this._isMyTurn()) return;

    if (this.removeMode) {
      if (!this._isOnlineMode()) {
        const res = this.combat.removeOwnUnitBySide("L", row, col);
        if (res?.ok) this.removeMode = false;
      } else {
        const unit = this.combat?.board?.[row]?.[col];
        if (!unit || unit.side !== this.mySide) return;
        this.turnActionBuffer.push({
          type: "removeUnit",
          target: { row, col }
        });
        this.removeMode = false;
      }
      this.onBattleState({
        left: this.leftHero,
        right: this.rightHero,
        turnSide: this.combat.turnSide,
        turnCount: this.combat.turnCount,
        logs: this.combat.logs
      });
      return;
    }

    if (!this.selectedCard) return;
    if (getCardCost(this.selectedCard) !== 0) return;

    if (!this._isOnlineMode()) {
      const isSkill = String(this.selectedCard?.type || "") === "skill";
      const res = isSkill
        ? this.combat.tryCastSkillByPlayer(this.selectedCard, row, col)
        : this.combat.trySummonByPlayer(this.selectedCard, row, col);
      if (res.ok) {
        this.selectedCard = null;
        this.hand.clearSelection();
      }
      return;
    }

    const isSkill = String(this.selectedCard?.type || "") === "skill";
    if (!isSkill && !this._canDeployAt(row, col)) return;
    if (this._countAvailableCardUse(this.selectedCard.id) <= 0) return;

    this.turnActionBuffer.push({
      type: isSkill ? "castSkill" : "playCard",
      cardId: this.selectedCard.id,
      target: { row, col }
    });
    if (!isSkill) this.pendingTargets.add(`${row},${col}`);
    this.pendingCardUse.set(this.selectedCard.id, (this.pendingCardUse.get(this.selectedCard.id) || 0) + 1);
    this.combat?._log?.(`已暫存${isSkill ? "技能" : "召喚"}【${this.selectedCard.name}】@(${row + 1},${col + 1})，回合結束後送出`);

    this.selectedCard = null;
    this.hand.clearSelection();
    this.onBattleState({
      left: this.leftHero,
      right: this.rightHero,
      turnSide: this.combat.turnSide,
      turnCount: this.combat.turnCount,
      logs: this.combat.logs
    });
  }

  async _onEndTurn() {
    this.selectedCard = null;
    this.removeMode = false;
    this.hand.clearSelection();

    if (!this._isOnlineMode()) {
      if (this.combat) this.combat.endTurn();
      return;
    }
    if (!this._isMyTurn()) return;

    const turnIndex = this.nextTurnIndex + 1;
    const turnAction = {
      roomCode: this.roomCode,
      playerId: this.playerId,
      turnIndex,
      actions: [...this.turnActionBuffer, { type: "endTurn" }]
    };

    this.applyTurnAction(turnAction);
    this.nextTurnIndex = turnIndex;
    if (this.turnSync) this.turnSync.lastSeenTurn = turnIndex;

    try {
      await ApiClient.postTurn(this.roomCode, this.playerId, turnIndex, turnAction);
    } catch (err) {
      if (this.combat) {
        this.combat._log?.(`荳雁さ蝗槫粋螟ｱ謨暦ｼ・{String(err.message || err)}`);
        this.onBattleState({
          left: this.leftHero,
          right: this.rightHero,
          turnSide: this.combat.turnSide,
          turnCount: this.combat.turnCount,
          logs: this.combat.logs
        });
      }
    }
  }

  _findPlayableCardById(side, cardId, expectType = "summon") {
    const hero = side === "L" ? this.leftHero : this.rightHero;
    const hand = Array.isArray(hero?.ready) ? hero.ready : [];
    for (let i = 0; i < hand.length; i += 1) {
      const c = hand[i];
      if (!c || c.id !== cardId) continue;
      if (String(c.type || "") !== String(expectType || "summon")) continue;
      if (expectType === "summon" && !c.unit) continue;
      if (getCardCost(c) !== 0) continue;
      return c;
    }
    return null;
  }

  applyTurnAction(turnAction) {
    if (!turnAction || !this.combat) return;
    const side = this._isOnlineMode() ? this._sideFromPlayerId(turnAction.playerId) : this.combat.turnSide;
    const actions = Array.isArray(turnAction.actions) ? turnAction.actions : [];

    for (let i = 0; i < actions.length; i += 1) {
      const act = actions[i];
      if (!act || !act.type) continue;

      if (act.type === "playCard") {
        const card = this._findPlayableCardById(side, String(act.cardId || ""), "summon");
        const row = Number(act?.target?.row);
        const col = Number(act?.target?.col);
        if (!card || !Number.isFinite(row) || !Number.isFinite(col)) continue;
        this.combat.trySummonBySide(side, card, row, col);
        continue;
      }

      if (act.type === "castSkill") {
        const card = this._findPlayableCardById(side, String(act.cardId || ""), "skill");
        const row = Number(act?.target?.row);
        const col = Number(act?.target?.col);
        if (!card || !Number.isFinite(row) || !Number.isFinite(col)) continue;
        this.combat.tryCastSkillBySide(side, card, row, col);
        continue;
      }

      if (act.type === "endTurn") {
        this.combat.endTurn();
        continue;
      }

      if (act.type === "removeUnit") {
        const row = Number(act?.target?.row);
        const col = Number(act?.target?.col);
        if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
        this.combat.removeOwnUnitBySide(side, row, col);
      }
    }

    if (String(turnAction.playerId) === this.playerId) this._clearTurnBuffer();
  }

  _clearTurnBuffer() {
    this.turnActionBuffer = [];
    this.pendingTargets.clear();
    this.pendingCardUse.clear();
  }

  onBattleState(state) {
    const left = state.left;
    const right = state.right;

    const isMyTurn = this._isOnlineMode()
      ? state.turnSide === this.mySide
      : state.turnSide === "L";
    const turnStr = `回合 ${state.turnCount} | ${isMyTurn ? "我方回合" : "敵方回合"}`;

    const leftPlayable = countPlayable(left);
    const rightPlayable = countPlayable(right);

    const leftStr = `L1 HP:${left.hp} | 可出牌:${leftPlayable} | 手:${left.ready.length} 牌庫:${left.deck.length} 墓:${left.grave.length}`;
    const rightStr = `R1 HP:${right.hp} | 可出牌:${rightPlayable} | 手:${right.ready.length} 牌庫:${right.deck.length} 墓:${right.grave.length}`;

    this.hud.setTop(leftStr, rightStr, turnStr);
    this.hud.setLog(state.logs);
    this.hand.setBattleLog(state.logs);

    const canOperate = this._isMyTurn();
    this.boardUI.setDeployEnabled(canOperate && (this.removeMode || Boolean(this.selectedCard)));
    this.boardUI.setPendingTargets(this.pendingTargets);
    this.boardUI.setInspectEnabled(!this.removeMode);

    let hint = this.removeMode
      ? "剷除模式：點擊我方場上士兵，送入墓地"
      : this.selectedCard
        ? `已選牌：${this.selectedCard.name}（費用倒數 ${getCardCost(this.selectedCard)}）`
        : "請先選擇費用倒數 = 0 的卡片，或啟用剷除模式";

    if (this._isOnlineMode()) {
      hint += ` | 房號:${this.roomCode} 玩家:${this.playerId} | 已暫存動作:${this.turnActionBuffer.length}`;
      hint += " | 連線模式：我方自動AI停用";
    }

    const myHero = this._isOnlineMode() && this.mySide === "R" ? right : left;
    this.hand.setState(myHero, canOperate, hint, this.removeMode, {
      autoPlayerEnabled: this.autoPlayerEnabled
    });

    if (this.combat) this.boardUI.renderBoard(this.combat.board);

    if (this._isOnlineMode() && this.autoPlayerEnabled && this._isMyTurn()) {
      this._runOnlineAutoTurn();
    }
  }
}





