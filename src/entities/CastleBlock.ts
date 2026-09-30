import Phaser from 'phaser'
import { BLOCKS, GROUND_Y, STATE_COLORS } from '../types/blockTypes'
import type { BlockType } from '../types/blockTypes'
import { StabilitySystem } from '../systems/StabilitySystem'

export class CastleBlock {
  readonly body: MatterJS.BodyType
  readonly visual: Phaser.GameObjects.Container
  readonly stability = new StabilitySystem()
  readonly type: BlockType
  readonly placementAngle: number
  private readonly aura: Phaser.GameObjects.Graphics
  private readonly badge: Phaser.GameObjects.Arc
  touching = false
  touchesGround = false
  hasBeenStable = false
  fallSpeed = 0
  readonly maxHp: number
  hp: number
  reloadMs = 0
  private readonly health: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene, type: BlockType, x: number, y: number, angle: number) {
    this.type = type; this.placementAngle = angle
    const stats = BLOCKS[type]
    this.maxHp = type === 'stone' ? 300 : type === 'king' ? 180 : 160
    this.hp = this.maxHp
    const options = { label: `castle-${type}`, friction: stats.friction, frictionStatic: 1.2, frictionAir: .01, restitution: .05, chamfer: { radius: 3 } }
    if (type === 'cannon') {
      const top = scene.matter.bodies.rectangle(x, y - 30, 200, 40, options)
      const stem = scene.matter.bodies.rectangle(x - 25, y + 20, 110, 60, options)
      this.body = scene.matter.body.create({ ...options, parts: [top, stem] })
    } else {
      this.body = scene.matter.bodies.rectangle(x, y, stats.width, stats.height, options)
    }
    // Keep the art aligned with the compound body's actual center of mass.
    const offsetX = x - this.body.position.x, offsetY = y - this.body.position.y
    scene.matter.body.setMass(this.body, stats.mass)
    scene.matter.body.setAngle(this.body, angle)
    scene.matter.body.setPosition(this.body, {
      x: x - (offsetX * Math.cos(angle) - offsetY * Math.sin(angle)),
      y: y - (offsetX * Math.sin(angle) + offsetY * Math.cos(angle)),
    })
    scene.matter.world.add(this.body)
    this.aura = scene.add.graphics()
    this.health = scene.add.graphics()
    const image = scene.add.image(offsetX, offsetY, type)
    this.badge = scene.add.circle(offsetX + stats.width / 2 - 12, offsetY + stats.height / 2 - 12, 4, STATE_COLORS.FALLING)
    this.visual = scene.add.container(this.body.position.x, this.body.position.y, [this.aura, image, this.badge, this.health]).setDepth(10)
    this.visual.setRotation(angle)
  }

  update(delta: number) {
    if (!this.stability.hasLanded) this.fallSpeed = Math.max(this.fallSpeed, Math.hypot(this.body.velocity.x, this.body.velocity.y))
    // Contact damping dissipates siege oscillation without sleeping or freezing
    // the body. Keep the original light air drag while a room is falling.
    this.body.frictionAir = this.touching ? .035 : .01
    this.stability.update({ angle: this.body.angle, placementAngle: this.placementAngle,
      speed: Math.hypot(this.body.velocity.x, this.body.velocity.y), angularVelocity: this.body.angularVelocity,
      touching: this.touching, outOfBounds: this.body.position.y > GROUND_Y + 350 || Math.abs(this.body.position.x - 360) > 1000,
    }, delta)
    this.hasBeenStable ||= this.stability.state === 'STABLE'
    this.visual.setPosition(this.body.position.x, this.body.position.y).setRotation(this.body.angle)
    const color = this.stability.tilt >= 35 * Math.PI / 180 ? 0xe77c72 : STATE_COLORS[this.stability.state]
    this.badge.setFillStyle(color)
    this.health.clear()
    if (this.hp < this.maxHp) {
      this.health.fillStyle(0x142831).fillRect(-30, -12, 60, 5)
      this.health.fillStyle(this.hp / this.maxHp > .4 ? 0xe4bc78 : 0xe77c72).fillRect(-30, -12, 60 * this.hp / this.maxHp, 5)
    }
    this.aura.clear()
    if (this.stability.state !== 'FALLING') {
      const parts = this.body.parts.length > 1 ? this.body.parts.slice(1) : [this.body]
      const cos = Math.cos(-this.body.angle), sin = Math.sin(-this.body.angle)
      for (const part of parts) {
        const vertices = (part.vertices ?? []).map(v => {
          const dx = v.x - this.body.position.x, dy = v.y - this.body.position.y
          return new Phaser.Math.Vector2(dx * cos - dy * sin, dx * sin + dy * cos)
        })
        this.aura.lineStyle(12, color, .08).strokePoints(vertices, true)
        this.aura.lineStyle(4, color, .35).strokePoints(vertices, true)
      }
    }
  }

  takeDamage(amount: number) {
    if (this.hp <= 0 || this.stability.state === 'COLLAPSED') return
    this.hp = Math.max(0, this.hp - amount)
    this.stability.settledMs = 0
    this.stability.state = this.hp === 0 ? 'COLLAPSED' : 'SETTLING'
  }

  weaponReady(delta: number) {
    if (this.hp <= 0 || this.stability.state !== 'STABLE' || (this.type !== 'archer' && this.type !== 'cannon')) return false
    this.reloadMs = Math.max(0, this.reloadMs - delta)
    return this.reloadMs === 0
  }

  fired() { this.reloadMs = this.type === 'archer' ? 1200 : 2500 }

  destroy(scene: Phaser.Scene) { scene.matter.world.remove(this.body); this.visual.destroy() }
}
