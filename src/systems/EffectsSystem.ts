import Phaser from 'phaser'

type Particle = {
  x: number; y: number; vx: number; vy: number; life: number; duration: number
  size: number; color: number; gravity: number; kind: 'dust' | 'stone' | 'spark' | 'smoke' | 'confetti'
  spin?: number
}

const CONFETTI_COLORS = [0xf2d493, 0xe77c72, 0x8bdbb0, 0x82bdaf, 0xe5e4cd, 0xc3a0cb]

/** One bounded particle batch: no per-particle GameObjects, timers, or tweens. */
export class EffectsSystem {
  readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private readonly scene: Phaser.Scene
  private readonly graphic: Phaser.GameObjects.Graphics
  private readonly sky?: Phaser.GameObjects.Graphics
  private particles: Particle[] = []
  private age = 0
  private seed = 117

  constructor(scene: Phaser.Scene, overlay = false) {
    this.scene = scene
    this.graphic = scene.add.graphics().setDepth(overlay ? 200 : 28)
    if (!overlay) this.sky = scene.add.graphics().setDepth(-10).setScrollFactor(0)
  }

  get activeParticles() { return this.particles.length }
  private random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296 }

  private burst(x: number, y: number, count: number, kind: Particle['kind'], color: number, speed: number) {
    const amount = Math.min(this.reducedMotion ? Math.ceil(count / 3) : count, 240 - this.particles.length)
    for (let i = 0; i < amount; i++) {
      const angle = this.random() * Math.PI * 2, velocity = speed * (.3 + this.random() * .7)
      const duration = kind === 'smoke' ? 1000 + this.random() * 600 : 350 + this.random() * 500
      this.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - (kind === 'smoke' ? 25 : 35),
        life: duration, duration, size: kind === 'smoke' ? 8 + this.random() * 12 : 2 + this.random() * 5,
        color, gravity: kind === 'stone' ? 320 : kind === 'spark' ? 90 : -12, kind })
    }
  }

  shake(intensity: number, duration = 110) {
    if (!this.reducedMotion) this.scene.cameras.main.shake(duration, Math.min(.004, intensity), false)
  }

  landing(x: number, y: number, mass: number, speed: number) {
    this.burst(x, y, 15, 'dust', 0xc4bea0, 90)
    this.burst(x, y, 7, 'stone', 0x9caf9f, 110)
    if (mass >= 10 && speed > 2) this.shake(.0012 + mass / 16000)
  }

  impact(x: number, y: number) { this.burst(x, y, 9, 'stone', 0xb6b49b, 125); this.shake(.0016) }
  shatter(x: number, y: number) { this.burst(x, y, 22, 'stone', 0x91a39b, 200); this.burst(x, y, 10, 'dust', 0xc4bea0, 85) }
  enemyDefeated(x: number, y: number) { this.burst(x, y, 12, 'stone', 0x8f829d, 130); this.burst(x, y, 8, 'spark', 0xe3b680, 80) }

  shot(x: number, y: number, cannon: boolean) {
    this.burst(x, y, cannon ? 12 : 3, 'spark', 0xf5ce87, cannon ? 170 : 75)
    if (cannon) this.burst(x, y, 7, 'smoke', 0x9aaca3, 45)
  }

  explosion(x: number, y: number) {
    this.burst(x, y, 24, 'spark', 0xf6be78, 290)
    this.burst(x, y, 12, 'stone', 0x939e92, 220)
    this.burst(x, y, 12, 'smoke', 0x84928e, 85)
    this.shake(.004, 180)
  }

  crown(x: number, y: number) { this.burst(x, y, 30, 'spark', 0xf2d493, 190) }
  victory(x: number, y: number) { this.burst(x, y, 100, 'spark', 0xf2d493, 310) }

  /** Paper confetti drifting down over the visible screen; bounded by the shared particle cap. */
  confetti(count = 90) {
    const top = this.scene.cameras.main.scrollY
    const amount = Math.min(this.reducedMotion ? Math.ceil(count / 4) : count, 240 - this.particles.length)
    for (let i = 0; i < amount; i++) {
      const duration = 2600 + this.random() * 1800
      this.particles.push({ x: this.random() * 720, y: top - 20 - this.random() * 260, vx: (this.random() - .5) * 90,
        vy: 60 + this.random() * 90, life: duration, duration, size: 6 + this.random() * 6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!, gravity: 30, kind: 'confetti', spin: this.random() * 10 })
    }
  }

  update(delta: number) {
    const step = Math.min(delta, 50), dt = step / 1000
    this.age += step
    this.graphic.clear()
    for (const p of this.particles) {
      p.life -= step
      if (p.life <= 0) continue
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt
      const remaining = p.life / p.duration
      if (p.kind === 'confetti') {
        // Flutter by squashing the width, which reads as a tumbling paper strip.
        const flip = Math.abs(Math.sin(this.age / 140 + p.spin!))
        p.x += Math.sin(this.age / 300 + p.spin!) * 40 * dt
        this.graphic.fillStyle(p.color, Math.min(1, remaining * 3)).fillRect(p.x - p.size * flip / 2, p.y, p.size * flip + 1, p.size * .55)
        continue
      }
      const size = p.kind === 'smoke' ? p.size * (2.5 - remaining * 1.5) : p.size
      this.graphic.fillStyle(p.color, remaining * (p.kind === 'smoke' ? .22 : p.kind === 'dust' ? .35 : .85))
      if (p.kind === 'stone') this.graphic.fillRect(p.x, p.y, size, size * .65)
      else this.graphic.fillCircle(p.x, p.y, size)
    }
    this.particles = this.particles.filter(p => p.life > 0)
    this.drawAtmosphere()
  }

  private drawAtmosphere() {
    if (!this.sky) return
    const g = this.sky.clear(), time = this.reducedMotion ? 0 : this.age / 1000
    for (let i = 0; i < 14; i++) {
      const x = ((i * 137 + time * (2 + i % 3)) % 800) - 40
      const y = 255 + (i * 109) % 600 + Math.sin(time * .45 + i) * 9
      g.fillStyle(0xd9d8a5, .06 + .13 * (.5 + .5 * Math.sin(time + i))).fillCircle(x, y, i % 3 === 0 ? 2 : 1)
    }
    // Slow mist bands remain behind the castle and never obscure targeting.
    g.fillStyle(0xabc3b2, .025)
    for (let i = 0; i < 3; i++) g.fillEllipse(150 + i * 260 + Math.sin(time * .06 + i) * 75, 790 + i * 56, 480, 40)
  }

  destroy() { this.particles = []; this.graphic.destroy(); this.sky?.destroy() }
}
