import Phaser from 'phaser'
import { BLOCKS, GROUND_Y } from '../types/blockTypes'
import type { BlockType } from '../types/blockTypes'
import type { CastleBlock } from './CastleBlock'

export class DropperCrane {
  type: BlockType = 'stone'
  angle = 0
  x = 360
  y = 740
  targetX = 360
  private readonly graphic: Phaser.GameObjects.Graphics
  private readonly preview: Phaser.GameObjects.Image
  private readonly ghost: Phaser.GameObjects.Image
  private readonly label: Phaser.GameObjects.Text
  enabled = true

  constructor(scene: Phaser.Scene) {
    this.graphic = scene.add.graphics().setDepth(18)
    this.preview = scene.add.image(this.x, this.y, this.type).setDepth(20).setAlpha(.92)
    this.ghost = scene.add.image(this.x, GROUND_Y - 45, this.type).setDepth(9).setAlpha(.13).setTint(0xb9ddba)
    this.label = scene.add.text(this.x, this.y - 100, 'READY TO DROP', { fontFamily: 'Arial', fontSize: '15px', color: '#c4cfb6', letterSpacing: 3 }).setOrigin(.5).setDepth(20)
  }

  select(type: BlockType) { this.type = type; this.angle = 0; this.preview.setTexture(type); this.ghost.setTexture(type) }
  rotate() { this.angle = (this.angle + Math.PI / 2) % (Math.PI * 2) }
  get halfHeight() { const b = BLOCKS[this.type]; return (Math.abs(Math.cos(this.angle)) * b.height + Math.abs(Math.sin(this.angle)) * b.width) / 2 }
  get halfWidth() { const b = BLOCKS[this.type]; return (Math.abs(Math.cos(this.angle)) * b.width + Math.abs(Math.sin(this.angle)) * b.height) / 2 }

  update(delta: number, cameraY: number, highestY: number, blocks: CastleBlock[], ready: boolean) {
    this.x = Phaser.Math.Linear(this.x, Phaser.Math.Clamp(this.targetX, this.halfWidth + 12, 708 - this.halfWidth), 1 - Math.exp(-delta / 70))
    this.y = Math.min(highestY - this.halfHeight - 60, Math.max(cameraY + 470, highestY - 250 - this.halfHeight))
    let surfaceY = GROUND_Y
    for (const block of blocks) {
      if (block.stability.state === 'COLLAPSED' || block.stability.state === 'FALLING') continue
      const b = block.body.bounds
      if (b.max.x > this.x - this.halfWidth && b.min.x < this.x + this.halfWidth) surfaceY = Math.min(surfaceY, b.min.y)
    }
    const safe = this.x + this.halfWidth > 120 && this.x - this.halfWidth < 600
    this.graphic.clear()
    this.preview.setVisible(this.enabled); this.ghost.setVisible(this.enabled); this.label.setVisible(this.enabled)
    if (!this.enabled) return
    const railY = this.y - this.halfHeight - 67
    this.graphic.lineStyle(1, 0xb6c5ac, .18).lineBetween(40, railY, 680, railY)
    for (let x = 40; x <= 680; x += 20) this.graphic.lineBetween(x, railY - 4, x, railY + 4)
    this.graphic.lineStyle(2, 0xc7bb8b, .8).lineBetween(this.x, railY, this.x, this.y - this.halfHeight - 8)
    this.graphic.fillStyle(0xd6bc7e).fillCircle(this.x, railY, 5)
    this.graphic.lineStyle(1, safe ? 0xc8d5b7 : 0xe77c72, .35)
    for (let y = this.y + this.halfHeight + 14; y < surfaceY - 8; y += 20) this.graphic.lineBetween(this.x, y, this.x, y + 7)
    this.preview.setPosition(this.x, this.y).setRotation(this.angle).setAlpha(ready ? .92 : .35)
    this.ghost.setPosition(this.x, surfaceY - this.halfHeight).setRotation(this.angle)
    this.label.setPosition(this.x, railY - 28).setText(ready ? 'READY TO DROP' : 'LET IT SETTLE')
  }
}
