// 檔案路徑：src/config/constants.js
export const ROLES = ["L1", "L2", "L3", "L4", "R1", "R2", "R3", "R4"];
export const LEFT_ROLES = ["L1", "L2", "L3", "L4"];
export const RIGHT_ROLES = ["R1", "R2", "R3", "R4"];

export const STORAGE_KEY_DECKS = "my-phaser-game.decks.v1";

// ===== Grid battle rules (你要的 4×12 回合格子制) =====
export const HERO_HP = 120;

export const GRID_ROWS = 4;
export const GRID_COLS = 12;

// 格子區域（你可自行調 UI 位置）
export const GRID_X = 140;
export const GRID_Y = 130;
export const GRID_W = 1000;
export const GRID_H = 360;

export const CELL_W = GRID_W / GRID_COLS;
export const CELL_H = GRID_H / GRID_ROWS;

// 召喚可放置區（左方：0~2；右方：9~11）
export const DEPLOY_LEFT_COL_MAX = 2;
export const DEPLOY_RIGHT_COL_MIN = 9;

export const HAND_LIMIT = 6;
export const START_HAND = 5;
export const DRAW_PER_TURN = 1;

// 你說的：每回合「撿 1 費」（不是回滿）
export const MANA_MAX = 10;
export const MANA_GAIN_PER_TURN = 1;
