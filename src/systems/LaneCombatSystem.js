// 檔案路徑：src/systems/LaneCombatSystem.js
import {
  HERO_HP, MANA_MAX_CAP,
  START_HAND, DRAW_PER_TURN,
  FIELD_LEFT_X, FIELD_RIGHT_X,
  TURN_TIME_AI_DELAY_MS,
  SIM_TICK_MS
} from "../config/constants";

export default class LaneCombatSystem {
  constructor(scene, cardSystem, boardUI) {
    this.scene = scene;
    this.cardSystem = cardSystem;
    this.boardUI = boardUI;

    this.left = null;
    this.right = null;

    this.turnSide = "L";
    this.turnCount = 0;

    this.units = [];
    this.logs = [];

    this._simTimer = null;
  }

  setCombatants(leftHero, rightHero) {
    this.left = leftHero;
    this.right = rightHero;
  }

  start() {
    this.left.hp = HERO_HP;
    this.right.hp = HERO_HP;

    this.left.manaMax = 0;
    this.right.manaMax = 0;
    this.left.mana = 0;
    this.right.mana = 0;

    this.cardSystem.shuffle(this.left.deck);
    this.cardSystem.shuffle(this.right.deck);

    this.cardSystem.draw(this.left, START_HAND);
    this.cardSystem.draw(this.right, START_HAND);

    this._simTimer = this.scene.time.addEvent({
      delay: SIM_TICK_MS,
      loop: true,
      callback: () => this._tick()
    });

    this.turnCount = 0;
    this._startTurn("L");
  }

  destroy() {
    if (this._simTimer) this._simTimer.remove(false);
    this._simTimer = null;
  }

  _startTurn(side) {
    this.turnSide = side;
    this.turnCount += 1;

    const hero = side === "L" ? this.left : this.right;

    hero.manaMax = Math.min(MANA_MAX_CAP, hero.manaMax + 1);
    hero.mana = hero.manaMax;

    this.cardSystem.draw(hero, DRAW_PER_TURN);

    this._log(`回合開始：${side === "L" ? "我方" : "敵方"}（${hero.mana}/${hero.manaMax}）`);
    this._notifyFull();

    if (side === "R") {
      this.scene.time.delayedCall(TURN_TIME_AI_DELAY_MS, () => this._aiPlayThenEnd());
    }
  }

  endTurnByPlayer() {
    if (this.turnSide !== "L") return;
    this._endTurn();
  }

  _endTurn() {
    this._log(`回合結束：${this.turnSide === "L" ? "我方" : "敵方"}`);
    const next = this.turnSide === "L" ? "R" : "L";
    this._startTurn(next);
  }

  trySummonByPlayer(card, lane) {
    if (this.turnSide !== "L") return { ok: false, reason: "not_your_turn" };
    return this._trySummon(this.left, "L", card, lane);
  }

  _trySummon(hero, side, card, lane) {
    if (!card || card.type !== "summon" || !card.unit) return { ok: false, reason: "not_summon" };

    const cost = Number(card.cost ?? 0);
    if (hero.mana < cost) return { ok: false, reason: "no_mana" };

    hero.mana -= cost;
    this.cardSystem.removeFromReady(hero, card);
    this.cardSystem.discard(hero, card);

    const y = this.boardUI.getLaneY(lane);
    const x = side === "L" ? FIELD_LEFT_X + 70 : FIELD_RIGHT_X - 70;

    const unit = {
      id: `${side}_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      side,
      lane,
      x,
      y,
      name: card.unit.name || card.name,
      hp: Number(card.unit.hp ?? 1),
      maxHp: Number(card.unit.hp ?? 1),
      atk: Number(card.unit.atk ?? 1),
      range: Number(card.unit.range ?? 40),
      speed: Number(card.unit.speed ?? 30),
      atkCdMs: Number(card.unit.atkCdMs ?? 900),
      nextAtkAt: 0,
      sprite: null,
      text: null
    };

    this._spawnUnitVisual(unit);
    this.units.push(unit);

    this._log(`${side === "L" ? "我方" : "敵方"}召喚【${unit.name}】(Lane ${lane + 1})`);
    this._notifyFull();
    return { ok: true };
  }

  _aiPlayThenEnd() {
    if (this.turnSide !== "R") return;

    const hero = this.right;
    const hand = Array.isArray(hero.ready) ? hero.ready : [];

    for (let i = 0; i < hand.length; i += 1) {
      const c = hand[i];
      if (!c || c.type !== "summon" || !c.unit) continue;
      const cost = Number(c.cost ?? 0);
      if (hero.mana >= cost) {
        const lane = Math.floor(Math.random() * 4);
        this._trySummon(hero, "R", c, lane);
        break;
      }
    }

    this.scene.time.delayedCall(300, () => this._endTurn());
  }

  _tick() {
    const now = this.scene.time.now;

    const laneBuckets = [[], [], [], []];
    for (let i = 0; i < this.units.length; i += 1) {
      const u = this.units[i];
      if (u.hp > 0) laneBuckets[u.lane].push(u);
    }
    for (let lane = 0; lane < 4; lane += 1) {
      laneBuckets[lane].sort((a, b) => a.x - b.x);
    }

    for (let lane = 0; lane < 4; lane += 1) {
      const list = laneBuckets[lane];

      for (let idx = 0; idx < list.length; idx += 1) {
        const u = list[idx];
        if (u.hp <= 0) continue;

        const target = this._findNearestEnemyInLane(u, list);

        if (target) {
          const dist = Math.abs(target.x - u.x);
          if (dist <= u.range) {
            if (now >= u.nextAtkAt) {
              target.hp = Math.max(0, target.hp - u.atk);
              u.nextAtkAt = now + u.atkCdMs;
              this._floatingText(u.x, u.y - 34, `-${u.atk}`);

              if (target.hp <= 0) this._log(`【${target.name}】陣亡`);
            }
          } else {
            this._moveUnit(u);
          }
        } else {
          const heroX = u.side === "L" ? FIELD_RIGHT_X : FIELD_LEFT_X;
          const distToHero = Math.abs(heroX - u.x);

          if (distToHero <= u.range) {
            if (now >= u.nextAtkAt) {
              if (u.side === "L") this.right.hp = Math.max(0, this.right.hp - u.atk);
              else this.left.hp = Math.max(0, this.left.hp - u.atk);

              u.nextAtkAt = now + u.atkCdMs;
              this._floatingText(u.x, u.y - 34, `-${u.atk}`);

              if (this.left.hp <= 0 || this.right.hp <= 0) {
                this._log(this.left.hp <= 0 ? "我方英雄倒下（失敗）" : "敵方英雄倒下（勝利）");
                this._notifyFull();
                this._finishBattle();
                return;
              }
            }
          } else {
            this._moveUnit(u);
          }
        }

        this._updateUnitVisual(u);
      }
    }

    const alive = [];
    for (let i = 0; i < this.units.length; i += 1) {
      const u = this.units[i];
      if (u.hp > 0) alive.push(u);
      else this._killUnit(u);
    }
    this.units = alive;

    this._notifyTopOnly();
  }

  _moveUnit(u) {
    const dt = SIM_TICK_MS / 1000;
    const dir = u.side === "L" ? 1 : -1;
    u.x += dir * u.speed * dt;

    if (u.side === "L") u.x = Math.min(u.x, FIELD_RIGHT_X - 28);
    else u.x = Math.max(u.x, FIELD_LEFT_X + 28);
  }

  _findNearestEnemyInLane(u, laneSorted) {
    if (u.side === "L") {
      let best = null;
      let bestDx = Infinity;
      for (let i = 0; i < laneSorted.length; i += 1) {
        const t = laneSorted[i];
        if (t.side === "R" && t.x > u.x) {
          const dx = t.x - u.x;
          if (dx < bestDx) { bestDx = dx; best = t; }
        }
      }
      return best;
    }

    let best = null;
    let bestDx = Infinity;
    for (let i = 0; i < laneSorted.length; i += 1) {
      const t = laneSorted[i];
      if (t.side === "L" && t.x < u.x) {
        const dx = u.x - t.x;
        if (dx < bestDx) { bestDx = dx; best = t; }
      }
    }
    return best;
  }

  _spawnUnitVisual(u) {
    const color = u.side === "L" ? 0x4db3ff : 0xff6b6b;
    u.sprite = this.scene.add.circle(u.x, u.y, 18, color, 0.85);
    u.text = this.scene.add.text(u.x, u.y - 28, `${u.name}\n${u.hp}`, {
      fontSize: "12px",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5, 0.5);
  }

  _updateUnitVisual(u) {
    if (!u.sprite || !u.text) return;
    u.sprite.setPosition(u.x, u.y);
    u.text.setPosition(u.x, u.y - 28);
    u.text.setText(`${u.name}\n${u.hp}`);
  }

  _killUnit(u) {
    if (u.sprite) u.sprite.destroy();
    if (u.text) u.text.destroy();
    u.sprite = null;
    u.text = null;
  }

  _floatingText(x, y, text) {
    const t = this.scene.add.text(x, y, text, { fontSize: "14px", color: "#ffdca8" }).setOrigin(0.5);
    this.scene.tweens.add({
      targets: t,
      y: y - 18,
      alpha: 0,
      duration: 550,
      onComplete: () => t.destroy()
    });
  }

  _finishBattle() {
    if (this._simTimer) this._simTimer.remove(false);
    this._simTimer = null;
  }

  _log(line) {
    this.logs.push(line);
    if (this.logs.length > 8) this.logs.shift();
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

  _notifyTopOnly() {
    if (this.scene && typeof this.scene.onBattleTopOnly === "function") {
      this.scene.onBattleTopOnly({
        left: this.left,
        right: this.right,
        turnSide: this.turnSide,
        turnCount: this.turnCount
      });
    }
  }
}
