import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { GameScene } from '../scenes/GameScene'
import { UIScene } from '../scenes/UIScene'

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, parent: 'app', width: 720, height: 1280,
  backgroundColor: '#101e28', antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2, touch: { capture: true } },
  // Keeps keyboard focus working inside the itch.io iframe after the first click.
  autoFocus: true,
  disableContextMenu: true,
  physics: { default: 'matter', matter: {
    gravity: { x: 0, y: 1.25 }, enableSleeping: false, debug: false,
    positionIterations: 16, velocityIterations: 12,
  } },
  scene: [BootScene, GameScene, UIScene],
}
