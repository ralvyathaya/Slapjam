import Phaser from 'phaser'
import type { CastleBlock } from './CastleBlock'
import { GROUND_Y } from '../types/blockTypes'

export type EnemyType = 'gargoyle' | 'ram'

export class Enemy {
  readonly type: EnemyType
  readonly maxHp: number
  readonly radius: number
  readonly side: -1 | 1
  readonly visual: Phaser.GameObjects.Container
  hp: number
  x: number
  y: number
  vx = 0
  vy = 0
  private readonly scene: Phaser.Scene
  private readonly health: Phaser.GameObjects.Graphics
  private wings: Phaser.GameObjects.Graphics[] = []
  private age = 0
  private cooldown = 0
  private mode: 'approach' | 'windup' | 'swoop' | 'retreat' = 'approach'
  private target?: CastleBlock

  constructor(scene: Phaser.Scene, type: EnemyType, side: -1 | 1, y: number, hp?: number) {
    this.scene = scene; this.type = type; this.side = side
    this.maxHp = hp ?? (type === 'gargoyle' ? 30 : 120); this.hp = this.maxHp
    this.radius = type === 'gargoyle' ? 23 : 40
    this.x = side === -1 ? -50 : 770; this.y = type === 'ram' ? GROUND_Y - 27 : y
    this.health = scene.add.graphics()
    this.visual = scene.add.container(this.x, this.y).setDepth(16)
    this.draw()
    this.visual.add(this.health)
  }

  get alive() { return this.hp > 0 }
  damage(amount: number) { this.hp = Math.max(0, this.hp - amount) }

  update(delta: number, blocks: CastleBlock[], coronating: boolean) {
    if (!this.alive) return
    const dt = delta / 1000, oldX = this.x, oldY = this.y
    this.age += delta; this.cooldown = Math.max(0, this.cooldown - delta)
    const candidates = blocks.filter(b => b.hp > 0 && b.stability.hasLanded && b.stability.state !== 'COLLAPSED')
    if (this.type === 'ram') this.updateRam(dt, candidates)
    else this.updateGargoyle(dt, candidates, coronating)
    this.vx = (this.x - oldX) / dt; this.vy = (this.y - oldY) / dt
    this.visual.setPosition(this.x, this.y)
    this.wings.forEach((wing, i) => wing.setRotation(Math.sin(this.age / 85) * .3 * (i === 0 ? 1 : -1)))
    this.health.clear().fillStyle(0x15252d).fillRoundedRect(-27, -43, 54, 5, 2)
    this.health.fillStyle(this.type === 'gargoyle' ? 0xc3a0cb : 0xe0a17c).fillRect(-26, -42, 52 * this.hp / this.maxHp, 3)
  }

  private updateRam(dt: number, blocks: CastleBlock[]) {
    // Pick the lowest physical room; the static bedrock itself is indestructible.
    const target = blocks.filter(b => b.body.bounds.min.y < GROUND_Y && b.body.bounds.max.y > GROUND_Y - 190 && b.body.bounds.max.y < GROUND_Y + 60)
      .sort((a, b) => b.body.bounds.max.y - a.body.bounds.max.y || this.side * (b.body.position.x - a.body.position.x))[0]
    if (!target) return
    const edge = this.side === -1 ? target.body.bounds.min.x - 39 : target.body.bounds.max.x + 39
    this.moveTo(edge, GROUND_Y - 27, 28, dt)
    if (Math.abs(this.x - edge) < 3 && target.body.bounds.max.y > GROUND_Y - 190 && this.cooldown === 0) {
      this.hit(target, 18, .006)
      this.cooldown = 3000
    }
  }

  private updateGargoyle(dt: number, blocks: CastleBlock[], coronating: boolean) {
    if (!this.target || !blocks.includes(this.target) || this.mode === 'approach') {
      const top = Math.min(GROUND_Y, ...blocks.map(b => b.body.bounds.min.y))
      const upper = blocks.filter(b => b.body.bounds.min.y <= top + 230)
      const rank = (b: CastleBlock) => (coronating && b.type === 'king' ? -10 : 0) + (b.stability.state === 'UNSTABLE' ? -4 : b.stability.state === 'SETTLING' ? -2 : 0)
      this.target = upper.sort((a, b) => rank(a) - rank(b) || a.body.bounds.min.y - b.body.bounds.min.y)[0]
      if (!this.target) { this.y += Math.sin(this.age / 300) * dt * 12; return }
    }
    const target = this.target, body = target.body
    const perchX = Phaser.Math.Clamp(body.position.x + this.side * 190, 45, 675)
    const perchY = body.bounds.min.y - 135
    if (this.mode === 'approach' || this.mode === 'retreat') {
      if (this.moveTo(perchX, perchY, this.mode === 'retreat' ? 210 : 145, dt)) {
        this.mode = 'windup'; this.cooldown = 850
      }
    } else if (this.mode === 'windup') {
      if (this.cooldown === 0) this.mode = 'swoop'
    } else {
      const hitX = this.side === -1 ? body.bounds.min.x : body.bounds.max.x
      this.moveTo(hitX, body.position.y - 8, 380, dt)
      const dx = this.x - Phaser.Math.Clamp(this.x, body.bounds.min.x, body.bounds.max.x)
      const dy = this.y - Phaser.Math.Clamp(this.y, body.bounds.min.y, body.bounds.max.y)
      if (Math.hypot(dx, dy) <= this.radius) {
        this.hit(target, 10, .004)
        this.mode = 'retreat'
      }
    }
  }

  private hit(target: CastleBlock, damage: number, strength: number) {
    target.takeDamage(damage)
    this.scene.matter.body.applyForce(target.body,
      { x: target.body.position.x + this.side * 30, y: target.body.position.y - 25 },
      { x: -this.side * target.body.mass * strength, y: this.type === 'gargoyle' ? target.body.mass * .001 : 0 })
    this.scene.events.emit('siegeImpact', this.x, this.y)
  }

  private moveTo(x: number, y: number, speed: number, dt: number) {
    const dx = x - this.x, dy = y - this.y, length = Math.hypot(dx, dy)
    if (length <= speed * dt) { this.x = x; this.y = y; return true }
    this.x += dx / length * speed * dt; this.y += dy / length * speed * dt
    return false
  }

  private draw() {
    const g = this.scene.add.graphics()
    if (this.type === 'gargoyle') {
      for (const side of [-1, 1]) {
        const wing = this.scene.add.graphics().fillStyle(0x877d9a).lineStyle(2, 0xb0a1b7)
        const points = [[0, 0], [side * 46, -26], [side * 36, 6], [side * 23, -1], [side * 15, 14]].map(([x, y]) => new Phaser.Math.Vector2(x, y))
        wing.fillPoints(points, true).strokePoints(points, true)
        this.visual.add(wing); this.wings.push(wing)
      }
      g.fillStyle(0x687580).fillEllipse(0, 0, 29, 40)
      g.fillStyle(0x9c9aa8).fillTriangle(-14, -12, -13, -33, -3, -17).fillTriangle(14, -12, 13, -33, 3, -17)
      g.fillStyle(0xe5a27e).fillRect(-9, -9, 6, 4).fillRect(3, -9, 6, 4)
      g.lineStyle(2, 0x343e51).lineBetween(-6, 5, 6, 5)
    } else {
      g.fillStyle(0x26383d).fillCircle(-25, 15, 13).fillCircle(25, 15, 13)
      g.lineStyle(3, 0xc7a375).strokeCircle(-25, 15, 10).strokeCircle(25, 15, 10)
      g.fillStyle(0x9e7955).fillRect(-35, -12, 70, 24)
      g.fillStyle(0xceb486).fillRect(-47, -9, 94, 12)
      g.fillStyle(0x9a6359).fillTriangle(-46, -17, 0, -45, 46, -17)
      g.lineStyle(3, 0xd1a078).lineBetween(-45, -17, 0, -45).lineBetween(0, -45, 45, -17)
      g.fillStyle(0x71868a).fillRect(this.side === -1 ? 39 : -50, -13, 12, 20)
    }
    this.visual.add(g)
  }

  destroy() { this.visual.destroy() }
}
