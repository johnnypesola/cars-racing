import Phaser from "phaser";
import CarsScene from "./cars-scene";
import CollisionMapperScene from "./collision-mapper";

// Get URL parameters to determine which scene to load
const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode') || 'game';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  antialias: true,
  physics: {
    default: "matter",
    matter: {
      gravity: {
        x: 0,
        y: 0,
      },
    },
  },
  scene: mode === 'mapper' ? [CollisionMapperScene] : [CarsScene],
};

export default new Phaser.Game(config);

// Add buttons to switch between modes
document.addEventListener('DOMContentLoaded', () => {
  const controlsDiv = document.createElement('div');
  controlsDiv.style.position = 'fixed';
  controlsDiv.style.top = '10px';
  controlsDiv.style.right = '10px';
  controlsDiv.style.zIndex = '1000';
  controlsDiv.style.display = 'flex';
  controlsDiv.style.gap = '10px';

  const gameButton = document.createElement('button');
  gameButton.textContent = 'Game Mode';
  gameButton.style.padding = '10px';
  gameButton.style.backgroundColor = mode === 'game' ? '#4CAF50' : '#ccc';
  gameButton.onclick = () => {
    window.location.href = window.location.pathname;
  };

  const mapperButton = document.createElement('button');
  mapperButton.textContent = 'Collision Mapper';
  mapperButton.style.padding = '10px';
  mapperButton.style.backgroundColor = mode === 'mapper' ? '#4CAF50' : '#ccc';
  mapperButton.onclick = () => {
    window.location.href = window.location.pathname + '?mode=mapper';
  };

  controlsDiv.appendChild(gameButton);
  controlsDiv.appendChild(mapperButton);
  document.body.appendChild(controlsDiv);
});
