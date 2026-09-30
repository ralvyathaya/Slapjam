import Phaser from 'phaser'
import { CastleBlock } from '../entities/CastleBlock'
import { DropperCrane } from '../entities/DropperCrane'
import { BLOCK_TYPES, GROUND_Y, PIXELS_PER_METRE } from '../types/blockTypes'
import type { BlockType } from '../types/blockTypes'
import { WaveManager } from '../systems/WaveManager'
import { CombatSystem } from '../systems/CombatSystem'
import { CoronationSystem } from '../systems/CoronationSystem'
import { AudioSystem } from '../systems/AudioSystem'
import { EffectsSystem } from '../systems/EffectsSystem'

export class GameScene extends Phaser.Scene {
  blocks: CastleBlock[] = []
  crane!: DropperCrane
  foundation!: MatterJS.BodyType
  highestY = GROUND_Y
  bestHeight = 0
  placed = 0
  lost = 0
  kingPlaced = false
  gameOver = false
  paused = false
  coronation!: CoronationSystem
  waves!: WaveManager
  combat!: CombatSystem
  audio!: AudioSystem
  effects!: EffectsSystem
  private level = 1
  private elapsed = 0
  private nextDropAt = 0
  private accumulator = 0
  private lastBlock?: CastleBlock
  private aiming = false
  private keys?: Record<string, Phaser.Input.Keyboard.Key>
  private markers!: Phaser.GameObjects.Container

  constructor() { super('Game') }

  init(data: { level?: number }) { this.level = data.level ?? 1 }

  create() {
    this.blocks = []; this.highestY = GROUND_Y; this.bestHeight = 0
    this.placed = 0; this.lost = 0; this.kingPlaced = false; this.gameOver = false
    this.paused = false; this.elapsed = 0; this.nextDropAt = 0; this.accumulator = 0
    this.lastBlock = undefined; this.aiming = false
    this.coronation = new CoronationSystem(this.level)
    this.waves = new WaveManager(this, this.level)
    this.combat = new CombatSystem(this)
    this.audio = new AudioSystem(this)
    this.effects = new EffectsSystem(this)
    this.cameras.main.setViewport(0, 0, 720, 1000).setScroll(0, 160)
    this.add.image(0, 0, 'landscape').setOrigin(0).setScrollFactor(0).setDepth(-20)
    this.makeFoundation()
    this.makeFinishLine()
    this.markers = this.add.container(0, 0).setDepth(-5)
    this.crane = new DropperCrane(this)
    this.events.on('siegeImpact', this.siegeImpact, this)
    this.events.on('enemyDefeated', this.enemyDefeated, this)
    this.events.on('weaponFired', this.weaponFired, this)
    this.events.on('cannonExploded', this.cannonExploded, this)
    this.events.once('shutdown', () => {
      this.events.off('siegeImpact', this.siegeImpact, this)
      this.events.off('enemyDefeated', this.enemyDefeated, this)
      this.events.off('weaponFired', this.weaponFired, this)
      this.events.off('cannonExploded', this.cannonExploded, this)
      this.waves.destroy(); this.combat.destroy()
      this.audio.destroy(); this.effects.destroy()
    })
    // A fixed accumulator keeps settlement and gravity consistent at 30/60/120 Hz.
    this.matter.world.autoUpdate = false
    this.matter.world.on('beforeupdate', () => {
      for (const block of this.blocks) { block.touching = false; block.touchesGround = false }
    })
    const contacts = (event: { pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] }) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA.parent, b = pair.bodyB.parent
        for (const block of this.blocks) {
          if (block.body === a || block.body === b) {
            block.touching = true
            if (a === this.foundation || b === this.foundation) block.touchesGround = true
          }
        }
      }
    }
    this.matter.world.on('collisionstart', contacts)
    this.matter.world.on('collisionactive', contacts)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.paused && !this.gameOver && pointer.y > 190 && pointer.y < 1000) {
        this.aiming = true; this.crane.targetX = pointer.x
      }
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.aiming && pointer.isDown) this.crane.targetX = pointer.x
    })
    this.input.on('pointerup', () => { this.aiming = false })
    this.input.on('pointerupoutside', () => { this.aiming = false })
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,A,D') as Record<string, Phaser.Input.Keyboard.Key>
      this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
        if (event.repeat || this.paused || this.gameOver) return
        if (event.code === 'Space') this.drop()
        if (event.code === 'KeyR') this.rotate()
        const index = Number(event.key) - 1
        if (index >= 0 && index < 4) this.select(BLOCK_TYPES[index]!)
      })
      this.input.keyboard.addCapture(['SPACE', 'LEFT', 'RIGHT'])
    }
    // The scene-owned Matter plugin clears these listeners when it shuts down.
    // Its world is already destroyed by the time scene shutdown callbacks run.
    this.scene.launch('UI')
  }

  get height() { return Math.max(0, (GROUND_Y - this.highestY) / PIXELS_PER_METRE) }
  get kingUnlocked() { return this.coronation.unlocked }
  get ready() {
    return !this.paused && !this.gameOver && this.elapsed >= this.nextDropAt &&
      (!this.lastBlock || this.lastBlock.stability.hasLanded || !this.blocks.includes(this.lastBlock))
  }
  get kingHeight() {
    const king = this.blocks.find(block => block.type === 'king' && block.stability.state === 'STABLE')
    return king ? Math.max(0, (GROUND_Y - king.body.bounds.min.y) / PIXELS_PER_METRE) : 0
  }

  select(type: BlockType) {
    if (this.paused || this.gameOver || (type === 'king' && (this.kingPlaced || !this.kingUnlocked))) return
    this.crane.select(type)
  }
  rotate() { if (!this.paused && !this.gameOver) this.crane.rotate() }
  drop() {
    if (!this.ready || (this.crane.type === 'king' && (this.kingPlaced || !this.kingUnlocked))) return
    const block = new CastleBlock(this, this.crane.type, this.crane.x, this.crane.y, this.crane.angle)
    this.blocks.push(block); this.lastBlock = block; this.placed++
    this.nextDropAt = this.elapsed + 450
    if (this.crane.type === 'king') { this.kingPlaced = true; this.crane.select('stone') }
  }

  update(_time: number, delta: number) {
    if (!this.paused || this.gameOver) this.effects.update(delta)
    if (this.paused || this.gameOver) return
    this.accumulator += Math.min(delta, 100)
    const step = 1000 / 60
    while (this.accumulator >= step) {
      this.matter.world.step(step)
      this.elapsed += step; this.accumulator -= step
      for (const block of [...this.blocks]) {
        const landed = block.stability.hasLanded
        const wasStable = block.stability.state === 'STABLE'
        block.update(step)
        if (!landed && block.stability.hasLanded) {
          this.effects.landing(block.body.position.x, block.body.bounds.max.y, block.body.mass, block.fallSpeed)
          this.audio.play('thud', Math.min(1, .25 + block.fallSpeed / 15), block.body.position.x)
        } else if (wasStable && block.stability.state !== 'STABLE' && block.touching) {
          this.audio.play('grind', .35, block.body.position.x)
        }
      }
      this.removeCollapsed()
      if (this.checkDefeat()) break
      this.measureHeight()
      this.waves.update(step, this.height, this.blocks, this.coronation.started)
      this.combat.update(step, this.blocks, this.waves.enemies)
      this.waves.removeDefeated()
      this.removeCollapsed()
      // Damage and collapse take precedence over victory on the final tick.
      if (this.checkDefeat()) break
      const king = this.blocks.find(block => block.type === 'king')
      const secondsBefore = Math.ceil(this.coronation.remainingMs / 1000)
      const events = this.coronation.update(step, this.height, king?.stability.state)
      const seconds = Math.ceil(this.coronation.remainingMs / 1000)
      if (seconds > 0 && seconds <= 3 && seconds < secondsBefore) this.audio.play('tick', .6)
      if (events.unlocked) {
        this.audio.play('crown', .65); this.effects.crown(360, this.highestY)
        this.events.emit('crownReady')
      }
      if (events.started) { this.waves.triggerSwarm(); this.events.emit('coronationStarted') }
      if (events.victory) { this.finish('victory'); break }
    }
    this.measureHeight()
    // Keep tracking settled rooms while they wobble; losing STABLE for one
    // frame must not send the camera and the next room into the tower.
    const trackedTop = Math.min(GROUND_Y, ...this.blocks.filter(block => block.hasBeenStable).map(block => block.body.bounds.min.y))
    const clearanceTop = Math.min(GROUND_Y, ...this.blocks.filter(block => block.stability.hasLanded).map(block => block.body.bounds.min.y))
    const target = Math.min(160, trackedTop - 640)
    this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, target, 1 - Math.pow(.95, delta / (1000 / 60)))
    if (this.keys) {
      if (this.keys.LEFT!.isDown || this.keys.A!.isDown) this.crane.targetX -= delta * .45
      if (this.keys.RIGHT!.isDown || this.keys.D!.isDown) this.crane.targetX += delta * .45
      this.crane.targetX = Phaser.Math.Clamp(this.crane.targetX, 20, 700)
    }
    this.crane.update(delta, this.cameras.main.scrollY, clearanceTop, this.blocks, this.ready)
    this.updateMilestones()
  }

  private measureHeight() {
    this.highestY = Math.min(GROUND_Y, ...this.blocks.filter(b => b.stability.state === 'STABLE').map(b => b.body.bounds.min.y))
    this.bestHeight = Math.max(this.bestHeight, this.height)
  }

  private removeCollapsed() {
    for (const block of this.blocks.filter(b => b.hp <= 0 || b.stability.state === 'COLLAPSED')) {
      this.effects.shatter(block.body.position.x, block.body.position.y)
      this.audio.play('shatter', .65, block.body.position.x)
      block.destroy(this); this.blocks.splice(this.blocks.indexOf(block), 1); this.lost++
    }
  }

  private checkDefeat() {
    const king = this.blocks.find(b => b.type === 'king')
    const overturned = king && king.stability.hasLanded && Math.abs(Math.atan2(Math.sin(king.body.angle), Math.cos(king.body.angle))) >= 65 * Math.PI / 180
    if (this.kingPlaced && (!king || king.touchesGround || overturned)) { this.finish('defeat'); return true }
    return false
  }

  private finish(result: 'victory' | 'defeat') {
    if (this.gameOver) return
    if (result === 'defeat') this.coronation.defeat()
    this.gameOver = true; this.crane.enabled = false
    this.audio.stop(); this.audio.play(result, .85)
    if (result === 'victory') this.effects.victory(360, this.highestY)
    this.events.emit(result)
  }

  private makeFinishLine() {
    const y = GROUND_Y - this.coronation.targetHeight * PIXELS_PER_METRE
    const g = this.add.graphics().setDepth(-2).lineStyle(2, 0xe6bd73, .65)
    for (let x = 38; x < 680; x += 24) g.lineBetween(x, y, x + 12, y)
    this.add.text(680, y - 24, `FINISH / ${this.coronation.targetHeight}m`, {
      fontFamily: 'Arial', fontSize: '17px', color: '#e6c68c', backgroundColor: '#1c333c', padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setDepth(-1)
  }

  private makeFoundation() {
    this.foundation = this.matter.add.rectangle(360, GROUND_Y + 60, 480, 120, { isStatic: true, friction: 1, label: 'bedrock' })
    const g = this.add.graphics().setDepth(2)
    g.fillStyle(0x132c34).fillPoints([[120, GROUND_Y], [600, GROUND_Y], [572, GROUND_Y + 260], [442, GROUND_Y + 320], [193, GROUND_Y + 240]].map(([x, y]) => new Phaser.Math.Vector2(x, y)), true)
    g.fillStyle(0x364d4b).fillRect(120, GROUND_Y, 480, 95)
    g.lineStyle(2, 0x1b333b)
    for (let row = 0; row < 3; row++) {
      g.lineBetween(120, GROUND_Y + 10 + row * 29, 600, GROUND_Y + 10 + row * 29)
      for (let x = 135 + (row % 2) * 35; x < 600; x += 70) g.lineBetween(x, GROUND_Y + 10 + row * 29, x, GROUND_Y + 39 + row * 29)
    }
    g.fillStyle(0x71816b).fillRect(115, GROUND_Y, 490, 10)
    g.fillStyle(0xc6ba88).fillRect(115, GROUND_Y, 490, 3)
    for (const x of [112, 608]) {
      g.fillStyle(0xbda979).fillRect(x - 2, GROUND_Y - 67, 4, 67)
      g.fillStyle(0x86aa92).fillTriangle(x + 2, GROUND_Y - 67, x + 23, GROUND_Y - 57, x + 2, GROUND_Y - 48)
    }
    this.add.text(360, GROUND_Y + 26, 'THE FOUNDATION', { fontFamily: 'Arial', fontSize: '14px', letterSpacing: 5, color: '#a4b4a0' }).setOrigin(.5).setDepth(3)
  }

  private updateMilestones() {
    const first = Math.floor((GROUND_Y - this.cameras.main.scrollY - 1000) / 300)
    if (this.markers.getData('first') === first) return
    this.markers.setData('first', first); this.markers.removeAll(true)
    for (let i = Math.max(1, first); i < first + 6; i++) {
      const y = GROUND_Y - i * 300
      const line = this.add.graphics().lineStyle(1, 0xbcd0b5, .12).lineBetween(48, y, 672, y)
      const label = this.add.text(38, y - 19, `${i * 10} m`, { fontFamily: 'Arial', fontSize: '16px', color: '#839e96' })
      this.markers.add([line, label])
    }
  }

  private siegeImpact(x: number, y: number) {
    this.effects.impact(x, y); this.audio.play('thud', .55, x)
  }

  private enemyDefeated(x: number, y: number) {
    this.effects.enemyDefeated(x, y); this.audio.play('shatter', .35, x)
  }

  private weaponFired(x: number, y: number, cannon: boolean) {
    this.effects.shot(x, y, cannon); this.audio.play(cannon ? 'cannon' : 'arrow', cannon ? .8 : .5, x)
  }

  private cannonExploded(x: number, y: number) {
    this.effects.explosion(x, y); this.audio.play('thud', .8, x)
  }
}
