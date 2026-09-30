import Phaser from 'phaser'
import type { Enemy } from './Enemy'
import { GROUND_Y } from '../types/blockTypes'

export type ProjectileType = 'arrow' | 'cannonball'

/** Swept circle test prevents fast arrows skipping a target between ticks. */
export function segmentHit(ax: number, ay: number, bx: number, by: number, x: number, y: number, radius: number): number | null {
  const dx = bx - ax, dy = by - ay, ox = ax - x, oy = ay - y
  const a = dx * dx + dy * dy, c = ox * ox + oy * oy - radius * radius
  if (c <= 0) return 0
  if (a === 0) return null
  const b = 2 * (ox * dx + oy * dy), discriminant = b * b - 4 * a * c
  if (discriminant < 0) return null
  const t = (-b - Math.sqrt(discriminant)) / (2 * a)
  return t >= 0 && t <= 1 ? t : null
}

export class Projectile {
  readonly type: ProjectileType
  x: number
  y: number
  vx: number
  vy: number
  alive = true
  private age = 0
  private readonly graphic: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, type: ProjectileType, x: number, y: number, target: Enemy) {
    this.type = type; this.x = x; this.y = y
    this.graphic = scene.add.graphics().setDepth(22)
    if (type === 'arrow') {
      const travel = Math.hypot(target.x - x, target.y - y) / 900
      const dx = target.x + target.vx * travel - x, dy = target.y + target.vy * travel - y
      const distance = Math.max(1, Math.hypot(dx, dy))
      this.vx = dx / distance * 900; this.vy = dy / distance * 900
    } else {
      const time = Math.sqrt(2 * (Math.max(0, target.y - y) + 220) / 600)
      this.vx = (target.x + target.vx * time * .5 - x) / time
      this.vy = (target.y - y - .5 * 600 * time * time) / time
    }
  }

  update(delta: number, enemies: Enemy[], explode: (x: number, y: number) => void) {
    if (!this.alive) return
    const dt = delta / 1000, ox = this.x, oy = this.y, gravity = this.type === 'cannonball' ? 600 : 0
    this.age += delta
    this.x += this.vx * dt; this.y += this.vy * dt + .5 * gravity * dt * dt; this.vy += gravity * dt
    let closest: Enemy | undefined, hitTime = Infinity
    for (const enemy of enemies) {
      if (!enemy.alive) continue
      const t = segmentHit(ox, oy, this.x, this.y, enemy.x, enemy.y, enemy.radius + (this.type === 'arrow' ? 3 : 8))
      if (t !== null && t < hitTime) { closest = enemy; hitTime = t }
    }
    if (closest) {
      this.x = Phaser.Math.Linear(ox, this.x, hitTime); this.y = Phaser.Math.Linear(oy, this.y, hitTime)
      if (this.type === 'arrow') closest.damage(18)
      else explode(this.x, this.y)
      this.alive = false
    } else if (this.type === 'cannonball' && this.y >= GROUND_Y - 10) {
      explode(this.x, GROUND_Y - 10); this.alive = false
    } else if (this.age > 6000 || this.x < -300 || this.x > 1020) this.alive = false
    this.graphic.clear()
    if (this.type === 'arrow') {
      const angle = Math.atan2(this.vy, this.vx)
      this.graphic.lineStyle(3, 0xe1d5a8).lineBetween(this.x, this.y, this.x - Math.cos(angle) * 25, this.y - Math.sin(angle) * 25)
      this.graphic.fillStyle(0xe9edda).fillCircle(this.x, this.y, 3)
    } else {
      this.graphic.lineStyle(5, 0xe1a46a, .35).lineBetween(ox, oy, this.x, this.y)
      this.graphic.fillStyle(0xf2bb78).fillCircle(this.x, this.y, 8).fillStyle(0x374750).fillCircle(this.x, this.y, 5)
    }
  }

  destroy() { this.graphic.destroy() }
}
