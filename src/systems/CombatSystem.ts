import Phaser from 'phaser'
import type { CastleBlock } from '../entities/CastleBlock'
import type { Enemy } from '../entities/Enemy'
import { Projectile } from '../entities/Projectile'

export class CombatSystem {
  projectiles: Projectile[] = []
  shotsFired = 0
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) { this.scene = scene }

  update(delta: number, blocks: CastleBlock[], enemies: Enemy[]) {
    for (const block of blocks) {
      if (!block.weaponReady(delta)) continue
      const { x, y } = block.body.position
      const distance = (enemy: Enemy) => Math.hypot(enemy.x - x, enemy.y - y)
      const targets = enemies.filter(e => e.alive && (block.type === 'archer' || e.type === 'ram') && distance(e) <= (block.type === 'archer' ? 1000 : 2400))
      targets.sort((a, b) => (block.type === 'archer' ? Number(a.type === 'ram') - Number(b.type === 'ram') : 0) || distance(a) - distance(b))
      if (!targets[0]) continue
      this.projectiles.push(new Projectile(this.scene, block.type === 'archer' ? 'arrow' : 'cannonball', x, y - 10, targets[0]))
      block.fired(); this.shotsFired++
      this.scene.events.emit('weaponFired', x, y - 10, block.type === 'cannon')
    }
    for (const projectile of this.projectiles) projectile.update(delta, enemies, (x, y) => this.explode(x, y, enemies))
    for (const projectile of this.projectiles.filter(p => !p.alive)) projectile.destroy()
    this.projectiles = this.projectiles.filter(p => p.alive)
  }

  private explode(x: number, y: number, enemies: Enemy[]) {
    for (const enemy of enemies) if (enemy.alive && Math.hypot(enemy.x - x, enemy.y - y) <= 120 + enemy.radius) enemy.damage(70)
    this.scene.events.emit('cannonExploded', x, y)
  }

  destroy() { this.projectiles.forEach(p => p.destroy()); this.projectiles = [] }
}
