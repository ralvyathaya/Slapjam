import Phaser from 'phaser'
import { Enemy } from '../entities/Enemy'
import type { EnemyType } from '../entities/Enemy'
import type { CastleBlock } from '../entities/CastleBlock'
import { GROUND_Y } from '../types/blockTypes'

export class WaveManager {
  enemies: Enemy[] = []
  kills = 0
  milestone = 0
  swarmSpawned = false
  private scene: Phaser.Scene
  private level: number
  private groundTimer = 14_000
  private side: -1 | 1 = -1
  private pending: { delay: number; type: EnemyType }[] = []

  constructor(scene: Phaser.Scene, level: number) { this.scene = scene; this.level = level }

  update(delta: number, height: number, blocks: CastleBlock[], coronating: boolean) {
    const top = Math.min(GROUND_Y, ...blocks.filter(b => b.hasBeenStable).map(b => b.body.bounds.min.y))
    const reached = Math.floor((height + .025) / 10)
    while (this.milestone < reached) {
      this.milestone++
      this.queueGargoyles(Math.min(5, 2 + Math.floor(this.level / 2)))
      this.scene.events.emit('airWave', this.milestone * 10)
    }
    this.groundTimer -= delta
    if (this.groundTimer <= 0) {
      if (this.enemies.filter(e => e.alive && e.type === 'ram').length < 4) this.spawn('ram', GROUND_Y)
      this.groundTimer = Math.max(8000, 17_000 - this.level * 1000)
    }
    for (const entry of this.pending) entry.delay -= delta
    for (const entry of this.pending.filter(e => e.delay <= 0)) this.spawn(entry.type, top - 190)
    this.pending = this.pending.filter(e => e.delay > 0)
    for (const enemy of this.enemies) enemy.update(delta, blocks, coronating)
  }

  triggerSwarm() {
    if (this.swarmSpawned) return
    this.swarmSpawned = true
    this.queueGargoyles(3 + Math.min(this.level, 5), true)
  }

  private queueGargoyles(count: number, finalSwarm = false) {
    const available = finalSwarm ? count : Math.max(0, 16 - this.enemies.filter(e => e.alive).length - this.pending.length)
    for (let i = 0; i < Math.min(count, available); i++) this.pending.push({ delay: i * 550, type: 'gargoyle' })
  }

  spawn(type: EnemyType, y: number) {
    const enemy = new Enemy(this.scene, type, this.side, y)
    this.side = this.side === -1 ? 1 : -1
    this.enemies.push(enemy)
    return enemy
  }

  removeDefeated() {
    for (const enemy of this.enemies.filter(e => !e.alive)) {
      this.kills++; this.scene.events.emit('enemyDefeated', enemy.x, enemy.y); enemy.destroy()
    }
    this.enemies = this.enemies.filter(e => e.alive)
  }

  destroy() { this.enemies.forEach(e => e.destroy()); this.enemies = []; this.pending = [] }
}
