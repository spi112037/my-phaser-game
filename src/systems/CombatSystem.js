// 檔案路徑：src/systems/GridCombatSystem.js
import {
  HERO_HP,
  GRID_ROWS, GRID_COLS,
  DEPLOY_LEFT_COL_MAX, DEPLOY_RIGHT_COL_MIN,
  START_HAND, DRAW_PER_TURN,
  MANA_MAX, MANA_GAIN_PER_TURN
} from "../config/constants";

export default class GridCombatSystem {
  constructor(scene, cardSystem, boardUI) {
    this.scene = scene;
    this.cardSystem = cardSystem;
    this.boardUI = boardUI;

    this.left = null;
    this.right = null;

    this.turnSide = "L"; // "L" or "R"
    this.turnCount = 0;

    // board[r][c] = unit or null
    this.board = Array.from({ length: GRID_ROWS }, () =>
      Array.from({ length: GRID_COLS }, () => null)
    );

    this.logs = [];
  }

  setCombatants(leftHero, rightHero) {
    this.left = leftHero;
    this.right = rightHero;
  }

  start() {
    this.left.hp = HERO_HP;
    this.right.hp = HERO_HP;

    this.left.mana = 1;
    this.right.mana = 1;

    this.cardSystem.shuffle(this.left.deck);
    this.cardSystem.shuffle(this.right.deck);

    this.cardSystem.draw(this.left, START_HAND);
    this.cardSystem.draw(this.right, START_HAND);

    this.turnCount = 1;
    this.turnSide = "L";

    this._log("戰鬥開始");
    this._notifyFull();
  }

  // ========== 玩家操作 ==========
  trySummonByPlayer(card, row, col) {
    if (this.turnSide !== "L") return { ok: false, reason: "not_your_turn" };
    return this._trySummon(this.left, "L", card, row, col);
  }

  // ========== AI 操作 ==========
  aiTakeTurn() {
    if (this.turnSide !== "R") return;

    // 簡單 AI：找第一張能下的 summon 卡，丟到右側召喚區的任一空格
    const hero = this.right;
    const hand = Array.isArray(hero.ready) ? hero.ready : [];

    let card = null;
    for (let i = 0; i < hand.length; i += 1) {
      const c = hand[i];
      if (!c || c.type !== "summon" || !c.unit) continue;
      const cost = Number(c.cost ?? 0);
      if (hero.mana >= cost) { card = c; break; }
    }

    if (card) {
      // 從右側召喚區找空格（9~11）
      const candidates = [];
      for (let r = 0; r < GRID_ROWS; r += 1) {
        for (let c = DEPLOY_RIGHT_COL_MIN; c < GRID_COLS; c += 1) {
          if (!this.board[r][c]) candidates.push({ r, c });
        }
      }
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        this._trySummon(hero, "R", card, pick.r, pick.c);
      }
    }

    // AI 下完就結束
    this.endTurn();
  }

  // ========== 回合結束：推進 + 攻擊（一次） ==========
  endTurn() {
    // 只有當前方可結束（玩家按鈕或 AI 自己）
    this._log(`回合結束：${this.turnSide === "L" ? "我方" : "敵方"}`);

    // 核心：按一次 endTurn 才推進/攻擊（你要的）
    this._resolveStep();

    // 勝負判定
    if (this.left.hp <= 0 || this.right.hp <= 0) {
      this._log(this.left.hp <= 0 ? "我方英雄倒下（失敗）" : "敵方英雄倒下（勝利）");
      this._notifyFull();
      return;
    }

    // 換邊
    this.turnSide = this.turnSide === "L" ? "R" : "L";
    if (this.turnSide === "L") this.turnCount += 1;

    // 新回合：抽 1 + 撿 1 費（不是回滿）
    const hero = this.turnSide === "L" ? this.left : this.right;
    hero.mana = Math.min(MANA_MAX, hero.mana + MANA_GAIN_PER_TURN);
    this.cardSystem.draw(hero, DRAW_PER_TURN);

    this._log(`回合開始：${this.turnSide === "L" ? "我方" : "敵方"}（能量 ${hero.mana}/${MANA_MAX}）`);
    this._notifyFull();

    // AI 自動行動
    if (this.turnSide === "R") {
      this.scene.time.delayedCall(450, () => this.aiTakeTurn());
    }
  }

  // ========== 私有：召喚 ==========
  _trySummon(hero, side, card, row, col) {
    if (!card || card.type !== "summon" || !card.unit) return { ok: false, reason: "not_summon" };

    const cost = Number(card.cost ?? 0);
    if (hero.mana < cost) return { ok: false, reason: "no_mana" };

    // 檢查位置合法
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return { ok: false, reason: "bad_cell" };
    if (this.board[row][col]) return { ok: false, reason: "occupied" };

    if (side === "L" && col > DEPLOY_LEFT_COL_MAX) return { ok: false, reason: "bad_deploy_zone" };
    if (side === "R" && col < DEPLOY_RIGHT_COL_MIN) return { ok: false, reason: "bad_deploy_zone" };

    hero.mana -= cost;
    this.cardSystem.removeFromReady(hero, card);
    this.cardSystem.discard(hero, card);

    const unit = {
      side,
      name: card.unit.name || card.name,
      hp: Number(card.unit.hp ?? 1),
      maxHp: Number(card.unit.hp ?? 1),
      atk: Number(card.unit.atk ?? 1),
      row,
      col
    };

    this.board[row][col] = unit;

    this._log(`${side === "L" ? "我方" : "敵方"}召喚【${unit.name}】@(${row + 1},${col + 1})`);
    this.boardUI.renderBoard(this.board);
    this._notifyFull();

    return { ok: true };
  }

  // ========== 私有：步進（前進 + 攻擊） ==========
  _resolveStep() {
    // 先攻擊再移動？ 你說「前進 攻擊」：我照字面做「先前進，再攻擊」
    this._advanceAllUnits();
    this._attackAllUnits();
    this._cleanupDead();
    this.boardUI.renderBoard(this.board);
  }

  _advanceAllUnits() {
    // 讓移動不互相影響：先收集要移動的，再套用
    const moves = [];

    for (let r = 0; r < GRID_ROWS; r += 1) {
      for (let c = 0; c < GRID_COLS; c += 1) {
        const u = this.board[r][c];
        if (!u) continue;

        const dir = u.side === "L" ? 1 : -1;
        const nc = c + dir;

        // 到對方英雄（走出棋盤）就不移動，改由攻擊階段處理
        if (nc < 0 || nc >= GRID_COLS) continue;

        // 只能前進到空格
        if (!this.board[r][nc]) {
          moves.push({ u, fromR: r, fromC: c, toR: r, toC: nc });
        }
      }
    }

    // 套用移動（避免重複搬）
    for (let i = 0; i < moves.length; i += 1) {
      const m = moves[i];
      // 途中可能已被移走，保險檢查
      if (this.board[m.fromR][m.fromC] !== m.u) continue;
      if (this.board[m.toR][m.toC]) continue;
      this.board[m.fromR][m.fromC] = null;
      m.u.row = m.toR;
      m.u.col = m.toC;
      this.board[m.toR][m.toC] = m.u;
    }
  }

  _attackAllUnits() {
    // 同步計算傷害（避免先打死影響另一隻出手）
    const dmgToUnit = new Map(); // unit -> dmg
    let dmgToLeftHero = 0;
    let dmgToRightHero = 0;

    for (let r = 0; r < GRID_ROWS; r += 1) {
      for (let c = 0; c < GRID_COLS; c += 1) {
        const u = this.board[r][c];
        if (!u) continue;

        const dir = u.side === "L" ? 1 : -1;
        const fc = c + dir;

        // 1) 前方是敵人 => 打敵人
        if (fc >= 0 && fc < GRID_COLS) {
          const front = this.board[r][fc];
          if (front && front.side !== u.side) {
            dmgToUnit.set(front, (dmgToUnit.get(front) ?? 0) + u.atk);
            continue;
          }
        }

        // 2) 前方超出棋盤 => 代表貼到對方英雄 => 打英雄
        if (fc < 0) {
          // 右方單位跑到最左外：打我方英雄
          dmgToLeftHero += u.atk;
        } else if (fc >= GRID_COLS) {
          // 左方單位跑到最右外：打敵方英雄
          dmgToRightHero += u.atk;
        }
      }
    }

    // 套用傷害
    for (const [unit, dmg] of dmgToUnit.entries()) {
      unit.hp = Math.max(0, unit.hp - dmg);
      this._log(`【${unit.name}】受傷 -${dmg}（${unit.hp}/${unit.maxHp}）`);
    }

    if (dmgToLeftHero > 0) {
      this.left.hp = Math.max(0, this.left.hp - dmgToLeftHero);
      this._log(`我方英雄受傷 -${dmgToLeftHero}（${this.left.hp}/${HERO_HP}）`);
    }
    if (dmgToRightHero > 0) {
      this.right.hp = Math.max(0, this.right.hp - dmgToRightHero);
      this._log(`敵方英雄受傷 -${dmgToRightHero}（${this.right.hp}/${HERO_HP}）`);
    }
  }

  _cleanupDead() {
    for (let r = 0; r < GRID_ROWS; r += 1) {
      for (let c = 0; c < GRID_COLS; c += 1) {
        const u = this.board[r][c];
        if (u && u.hp <= 0) {
          this._log(`【${u.name}】陣亡`);
          this.board[r][c] = null;
        }
      }
    }
  }

  // ========== 通知 UI ==========
  _log(line) {
    this.logs.push(line);
    if (this.logs.length > 10) this.logs.shift();
  }

  _notifyFull() {
    if (this.scene && typeof this.scene.onBattleState === "function") {
      this.scene.onBattleState({
        left: this.left,
        right: this.right,
        turnSide: this.turnSide,
        turnCount: this.turnCount,
        logs: [...this.logs]
      });
    }
  }
}
