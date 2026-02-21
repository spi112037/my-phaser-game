import {
  GRID_ROWS,
  GRID_COLS,
  GRID_X,
  GRID_Y,
  GRID_W,
  GRID_H,
  CELL_W,
  CELL_H
} from "../config/constants";

const LONG_PRESS_MS = 420;

export default class GridBoardUI {
  constructor(scene, onCellClick, onInspectUnit) {
    this.scene = scene;
    this.onCellClick = onCellClick;
    this.onInspectUnit = onInspectUnit;

    this.container = scene.add.container(0, 0);
    this.effectLayer = scene.add.container(0, 0).setDepth(1800);

    this.cells = [];
    this.unitViews = [];
    this.deployEnabled = false;
    this.inspectEnabled = true;
    this.board = null;
    this.canDeployCellFn = null;
    this.pendingTargets = new Set();

    this._draw();
  }

  _draw() {
    const panel = this.scene.add
      .rectangle(GRID_X + GRID_W / 2, GRID_Y + GRID_H / 2, GRID_W, GRID_H, 0x000000, 0.18)
      .setStrokeStyle(1, 0xffffff, 0.06);
    this.container.add(panel);

    for (let r = 0; r < GRID_ROWS; r += 1) {
      for (let c = 0; c < GRID_COLS; c += 1) {
        const x = GRID_X + c * CELL_W;
        const y = GRID_Y + r * CELL_H;

        const rect = this.scene.add
          .rectangle(x, y, CELL_W, CELL_H, 0xffffff, 0.03)
          .setOrigin(0, 0)
          .setStrokeStyle(1, 0xffffff, 0.04)
          .setInteractive({ useHandCursor: true });

        const cell = { rect, r, c, holdTimer: null, holdTriggered: false };

        rect.on("pointerover", () => {
          if (!this.deployEnabled) return;
          this._refreshCellHighlights();
          const key = `${cell.r},${cell.c}`;
          if (this.pendingTargets.has(key)) return;
          if (this.canDeployCellFn && !this.canDeployCellFn(cell.r, cell.c)) return;
          rect.setFillStyle(0x9ddcff, 0.16);
        });

        rect.on("pointerout", () => {
          this._refreshCellHighlights();
          this._clearCellTimer(cell);
        });

        rect.on("pointerdown", () => {
          this._clearCellTimer(cell);
          cell.holdTriggered = false;

          cell.holdTimer = this.scene.time.delayedCall(LONG_PRESS_MS, () => {
            const unit = this._getUnit(cell.r, cell.c);
            if (!unit) return;
            if (!this.inspectEnabled) return;
            cell.holdTriggered = true;
            if (typeof this.onInspectUnit === "function") this.onInspectUnit(unit);
          });
        });

        rect.on("pointerup", () => {
          this._clearCellTimer(cell);
          if (cell.holdTriggered) return;

          const unit = this._getUnit(cell.r, cell.c);
          if (unit) {
            if (this.deployEnabled && typeof this.onCellClick === "function") {
              this.onCellClick(cell.r, cell.c);
            }
            return;
          }

          if (!this.deployEnabled) return;
          if (typeof this.onCellClick === "function") this.onCellClick(cell.r, cell.c);
        });

        this.container.add(rect);
        this.cells.push(cell);
      }
    }

    const midX = GRID_X + GRID_W / 2;
    const mid = this.scene.add.rectangle(midX, GRID_Y, 2, GRID_H, 0x9ddcff, 0.12).setOrigin(0.5, 0);
    this.container.add(mid);
  }

  _clearCellTimer(cell) {
    if (cell.holdTimer) {
      cell.holdTimer.remove(false);
      cell.holdTimer = null;
    }
  }

  _getUnit(row, col) {
    if (!this.board || !this.board[row]) return null;
    return this.board[row][col] || null;
  }

  _cellCenter(row, col) {
    const x = GRID_X + col * CELL_W + CELL_W / 2;
    const y = GRID_Y + row * CELL_H + CELL_H / 2;
    return { x, y };
  }

  _cellRect(row, col) {
    const x = GRID_X + col * CELL_W;
    const y = GRID_Y + row * CELL_H;
    return { x, y, w: CELL_W, h: CELL_H };
  }

  setDeployEnabled(enabled) {
    this.deployEnabled = Boolean(enabled);
    this.container.setAlpha(this.deployEnabled ? 1 : 0.85);
    this._refreshCellHighlights();
  }

  setInspectEnabled(enabled) {
    this.inspectEnabled = Boolean(enabled);
  }

  setDeployRule(fn) {
    this.canDeployCellFn = typeof fn === "function" ? fn : null;
    this._refreshCellHighlights();
  }

  setPendingTargets(targets) {
    this.pendingTargets = targets instanceof Set ? targets : new Set();
    this._refreshCellHighlights();
  }

  _refreshCellHighlights() {
    for (let i = 0; i < this.cells.length; i += 1) {
      const cell = this.cells[i];
      const key = `${cell.r},${cell.c}`;
      if (this.pendingTargets.has(key)) {
        cell.rect.setFillStyle(0xffc26b, 0.18);
        continue;
      }
      if (!this.deployEnabled) {
        cell.rect.setFillStyle(0xffffff, 0.03);
        continue;
      }
      const can = this.canDeployCellFn ? Boolean(this.canDeployCellFn(cell.r, cell.c)) : true;
      cell.rect.setFillStyle(can ? 0x9ddcff : 0xffffff, can ? 0.1 : 0.03);
    }
  }

  renderBoard(board) {
    this.board = board;
    this._refreshCellHighlights();

    for (let i = 0; i < this.unitViews.length; i += 1) this.unitViews[i].destroy(true);
    this.unitViews = [];

    for (let r = 0; r < board.length; r += 1) {
      for (let c = 0; c < board[r].length; c += 1) {
        const u = board[r][c];
        if (!u) continue;

        const x = GRID_X + c * CELL_W + 4;
        const y = GRID_Y + r * CELL_H + 4;
        const w = CELL_W - 8;
        const h = CELL_H - 8;

        const box = this.scene.add.container(x, y);
        const bg = this.scene.add.rectangle(0, 0, w, h, 0x182336, 0.95).setOrigin(0, 0);
        const borderColor = u.side === "L" ? 0x4db3ff : 0xff6b6b;
        const border = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0).setOrigin(0, 0);
        border.setStrokeStyle(2, borderColor, 0.95);

        box.add([bg, border]);

        const textureKey = `card_${u.cardId || ""}`;
        if (u.cardId && this.scene.textures.exists(textureKey)) {
          const art = this.scene.add.image(w / 2, h / 2 - 2, textureKey);
          art.setDisplaySize(w - 8, h - 18);
          box.add(art);
        } else {
          const fallback = this.scene.add
            .text(w / 2, h / 2 - 5, u.name, {
              fontSize: "12px",
              color: "#ffffff",
              align: "center"
            })
            .setOrigin(0.5);
          box.add(fallback);
        }

        const infoBg = this.scene.add.rectangle(w / 2, h - 9, w - 6, 16, 0x000000, 0.55).setOrigin(0.5);
        const info = this.scene.add
          .text(w / 2, h - 9, `HP:${u.hp} ATK:${u.atk}`, {
            fontSize: "11px",
            color: "#ffffff"
          })
          .setOrigin(0.5);

        box.add([infoBg, info]);

        if (Number(u?.status?.skipSteps ?? 0) > 0) {
          const stunTag = this.scene.add
            .text(w - 6, 4, `暈${u.status.skipSteps}`, {
              fontSize: "11px",
              color: "#ffe17f",
              backgroundColor: "#000000aa",
              padding: { left: 3, right: 3, top: 1, bottom: 1 }
            })
            .setOrigin(1, 0);
          box.add(stunTag);
        }

        bg.setInteractive({ useHandCursor: true });
        let holdTimer = null;
        let holdTriggered = false;

        const clearHold = () => {
          if (holdTimer) {
            holdTimer.remove(false);
            holdTimer = null;
          }
        };

        bg.on("pointerdown", () => {
          clearHold();
          holdTriggered = false;
          holdTimer = this.scene.time.delayedCall(LONG_PRESS_MS, () => {
            if (!this.inspectEnabled) return;
            holdTriggered = true;
            if (typeof this.onInspectUnit === "function") this.onInspectUnit(u);
          });
        });

        bg.on("pointerout", () => {
          clearHold();
        });

        bg.on("pointerup", () => {
          clearHold();
          if (holdTriggered) return;
          if (this.deployEnabled && typeof this.onCellClick === "function") {
            this.onCellClick(u.row, u.col);
          }
        });

        this.container.add(box);
        this.unitViews.push(box);
      }
    }
  }

  playAttackEffects(events) {
    if (!Array.isArray(events) || events.length === 0) return;

    for (let i = 0; i < events.length; i += 1) {
      const e = events[i];
      if (!e) continue;

      const from = this._cellCenter(e.fromRow, e.fromCol);
      const to = this._cellCenter(e.toRow, e.toCol);
      const damageType = String(e.damageType || "physical");
      const styleByType = {
        physical: { beam: e.side === "L" ? 0x8cd8ff : 0xff9d9d, hit: 0xffdca8, text: "#ffe9c5" },
        fire: { beam: 0xff7a3b, hit: 0xff3b30, text: "#ffd0b5" },
        ice: { beam: 0x93e4ff, hit: 0x4ecfff, text: "#dcf6ff" },
        lightning: { beam: 0xbf9dff, hit: 0x8e6bff, text: "#ece1ff" },
        shadow: { beam: 0x7d65df, hit: 0x432b84, text: "#d7cbff" },
        holy: { beam: 0xfff1a6, hit: 0xffe27b, text: "#fff9d8" },
        poison: { beam: 0x7fd96f, hit: 0x4bb943, text: "#dfffd9" }
      };
      const style = styleByType[damageType] || styleByType.physical;
      const color = style.beam;
      const markerColor = style.hit;

      const beam = this.scene.add
        .line(0, 0, from.x, from.y, to.x, to.y, color, 1)
        .setOrigin(0, 0)
        .setLineWidth(4, 1)
        .setAlpha(0.95);

      const targetRect = this._cellRect(e.toRow, e.toCol);
      const cellMark = this.scene.add
        .rectangle(targetRect.x + targetRect.w / 2, targetRect.y + targetRect.h / 2, targetRect.w - 6, targetRect.h - 6, markerColor, 0.12)
        .setStrokeStyle(2, markerColor, 0.95);

      const hitCircle = this.scene.add.circle(to.x, to.y, 8, markerColor, 0.8);
      const dmgText = this.scene.add
        .text(to.x, to.y - 8, `-${Number(e.damage ?? 0)}`, {
          fontSize: "16px",
          color: style.text
        })
        .setOrigin(0.5);

      this.effectLayer.add([beam, cellMark, hitCircle, dmgText]);

      if (damageType === "physical") {
        const slashA = this.scene.add.line(0, 0, to.x - 24, to.y - 14, to.x + 24, to.y + 14, 0xffffff, 0.9).setLineWidth(3, 1);
        const slashB = this.scene.add.line(0, 0, to.x - 20, to.y + 16, to.x + 20, to.y - 16, markerColor, 0.85).setLineWidth(2, 1);
        this.effectLayer.add([slashA, slashB]);
        this.scene.tweens.add({ targets: [slashA, slashB], alpha: 0, duration: 180, ease: "Cubic.easeOut", onComplete: () => { slashA.destroy(); slashB.destroy(); } });
      }

      if (damageType === "fire") {
        const sparks = [];
        for (let k = 0; k < 8; k += 1) {
          const p = this.scene.add.circle(to.x, to.y, Phaser.Math.Between(2, 4), k % 2 ? 0xffb36a : 0xff5a36, 0.9);
          sparks.push(p);
          this.effectLayer.add(p);
          const ang = Phaser.Math.FloatBetween(-Math.PI, Math.PI);
          const dist = Phaser.Math.Between(18, 34);
          this.scene.tweens.add({
            targets: p,
            x: to.x + Math.cos(ang) * dist,
            y: to.y + Math.sin(ang) * dist,
            alpha: 0,
            duration: 260,
            ease: "Cubic.easeOut",
            onComplete: () => p.destroy()
          });
        }
      }

      if (damageType === "ice") {
        const crossA = this.scene.add.line(0, 0, to.x - 18, to.y, to.x + 18, to.y, 0xd8f6ff, 0.95).setLineWidth(2, 1);
        const crossB = this.scene.add.line(0, 0, to.x, to.y - 18, to.x, to.y + 18, 0xbbeeff, 0.95).setLineWidth(2, 1);
        const ring = this.scene.add.circle(to.x, to.y, 10, 0x9ae4ff, 0.2).setStrokeStyle(2, 0xd7f7ff, 0.95);
        this.effectLayer.add([crossA, crossB, ring]);
        this.scene.tweens.add({ targets: [crossA, crossB, ring], alpha: 0, scale: 1.4, duration: 300, ease: "Quad.easeOut", onComplete: () => { crossA.destroy(); crossB.destroy(); ring.destroy(); } });
      }

      if (damageType === "lightning") {
        const bolt = this.scene.add.graphics();
        bolt.lineStyle(3, 0xd8c5ff, 0.95);
        const segs = 6;
        bolt.beginPath();
        bolt.moveTo(from.x, from.y);
        for (let s = 1; s < segs; s += 1) {
          const t = s / segs;
          const px = Phaser.Math.Linear(from.x, to.x, t) + Phaser.Math.Between(-10, 10);
          const py = Phaser.Math.Linear(from.y, to.y, t) + Phaser.Math.Between(-8, 8);
          bolt.lineTo(px, py);
        }
        bolt.lineTo(to.x, to.y);
        bolt.strokePath();
        this.effectLayer.add(bolt);
        this.scene.tweens.add({ targets: bolt, alpha: 0, duration: 180, ease: "Linear", onComplete: () => bolt.destroy() });
      }

      if (damageType === "holy") {
        const rayV = this.scene.add.line(0, 0, to.x, to.y - 28, to.x, to.y + 28, 0xfff6c8, 0.9).setLineWidth(3, 1);
        const rayH = this.scene.add.line(0, 0, to.x - 22, to.y, to.x + 22, to.y, 0xffe89c, 0.8).setLineWidth(2, 1);
        const halo = this.scene.add.circle(to.x, to.y, 12, 0xffefb0, 0.18).setStrokeStyle(2, 0xfff6d2, 0.9);
        this.effectLayer.add([rayV, rayH, halo]);
        this.scene.tweens.add({ targets: [rayV, rayH, halo], alpha: 0, scale: 1.35, duration: 320, ease: "Quad.easeOut", onComplete: () => { rayV.destroy(); rayH.destroy(); halo.destroy(); } });
      }

      if (damageType === "shadow") {
        const fog = [];
        for (let k = 0; k < 6; k += 1) {
          const sm = this.scene.add.circle(
            to.x + Phaser.Math.Between(-6, 6),
            to.y + Phaser.Math.Between(-6, 6),
            Phaser.Math.Between(6, 10),
            k % 2 ? 0x4c3296 : 0x231542,
            0.38
          );
          fog.push(sm);
          this.effectLayer.add(sm);
          this.scene.tweens.add({
            targets: sm,
            x: sm.x + Phaser.Math.Between(-16, 16),
            y: sm.y + Phaser.Math.Between(-16, 16),
            alpha: 0,
            scale: 1.35,
            duration: 320,
            ease: "Cubic.easeOut",
            onComplete: () => sm.destroy()
          });
        }
      }

      this.scene.tweens.add({
        targets: beam,
        alpha: 0,
        duration: 220,
        ease: "Cubic.easeOut",
        onComplete: () => beam.destroy()
      });

      this.scene.tweens.add({
        targets: cellMark,
        alpha: 0,
        scaleX: 1.06,
        scaleY: 1.06,
        duration: 260,
        ease: "Quad.easeOut",
        onComplete: () => cellMark.destroy()
      });

      this.scene.tweens.add({
        targets: hitCircle,
        alpha: 0,
        scale: 2.2,
        duration: 260,
        ease: "Cubic.easeOut",
        onComplete: () => hitCircle.destroy()
      });

      this.scene.tweens.add({
        targets: dmgText,
        alpha: 0,
        y: dmgText.y - 18,
        duration: 280,
        ease: "Quad.easeOut",
        onComplete: () => dmgText.destroy()
      });
    }
  }

  destroy() {
    this.container.destroy(true);
    this.effectLayer.destroy(true);
  }
}
