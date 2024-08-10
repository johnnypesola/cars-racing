import Phaser from "phaser";
import CarsScene from "./cars-scene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  // pixelArt: true,
  antialias: true,
  physics: {
    default: "matter",
    matter: {
      gravity: {
        x: 0,
        y: 0,
      },
    },
    // arcade: {
    //   gravity: { y: 200 },
    // },
  },
  scene: [CarsScene],
};

export default new Phaser.Game(config);
