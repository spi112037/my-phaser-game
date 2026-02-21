import "./style.css";
import Phaser from "phaser";

import MenuScene from "./scenes/MenuScene";
import DeckScene from "./scenes/DeckScene";
import BattleScene from "./scenes/BattleScene";
import CardEditorScene from "./scenes/CardEditorScene";
import RoomScene from "./scenes/RoomScene";
import EffectGlossaryScene from "./scenes/EffectGlossaryScene";
import ChallengeScene from "./scenes/ChallengeScene";

const config = {
  type: Phaser.AUTO,
  parent: "app",
  width: 1280,
  height: 720,
  backgroundColor: "#0b1422",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [MenuScene, ChallengeScene, DeckScene, RoomScene, BattleScene, CardEditorScene, EffectGlossaryScene]
};

new Phaser.Game(config);
