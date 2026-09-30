import Phaser from 'phaser'
import { BLOCKS, BLOCK_TYPES } from '../types/blockTypes'
import type { BlockType } from '../types/blockTypes'
import { GameScene, MAX_LOST_ROOMS } from './GameScene'
import { EffectsSystem } from '../systems/EffectsSystem'
import { loadSave } from '../systems/SaveData'
import { CAMPAIGN_LEVELS, getLevelConfig } from '../config/levels'

const INK = '#e5e4cd', MUTED = '#8fa9a5', GOLD = '#e5c58c'

export class UIScene extends Phaser.Scene {
  private gameScene!: GameScene
  private heightLabel!: Phaser.GameObjects.Text
  private roomsLabel!: Phaser.GameObjects.Text
  private stabilityLabel!: Phaser.GameObjects.Text
  private statusDot!: Phaser.GameObjects.Arc
  private description!: Phaser.GameObjects.Text
  private dropButton!: Phaser.GameObjects.Container
  private dropText!: Phaser.GameObjects.Text
  private cardOutlines = new Map<BlockType, Phaser.GameObjects.Graphics>()
  private cardContainers = new Map<BlockType, Phaser.GameObjects.Container>()
  private emptyHint!: Phaser.GameObjects.Container
  private toast!: Phaser.GameObjects.Text
  private modal?: Phaser.GameObjects.Container
  private previousType?: BlockType
  private previousKing = false
  private previousUnlocked = false
  private displayedMilestone = 0
  private kingLabel!: Phaser.GameObjects.Text
  private kingLock!: Phaser.GameObjects.Graphics
  private countdown!: Phaser.GameObjects.Text
  private stageLabel!: Phaser.GameObjects.Text
  private threatLabel!: Phaser.GameObjects.Text
  private soundIcon!: Phaser.GameObjects.Graphics
  private bestLabel!: Phaser.GameObjects.Text
  private savedBest = 0
  private confetti!: EffectsSystem

  constructor() { super('UI') }

  create() {
    this.gameScene = this.scene.get('Game') as GameScene
    this.cardOutlines.clear(); this.cardContainers.clear(); this.modal = undefined
    this.previousType = undefined; this.previousKing = false; this.displayedMilestone = 0
    this.previousUnlocked = false
    this.drawHeader(); this.drawDock()
    this.confetti = new EffectsSystem(this, true)
    const hint1 = this.text(360, 331, 'Every kingdom starts', 30, INK, 'Georgia').setOrigin(.5)
    const hint2 = this.text(360, 370, 'with a single stone.', 30, INK, 'Georgia').setOrigin(.5)
    const hint3 = this.text(360, 419, 'DRAG TO AIM  ·  TAP DROP TO BUILD', 14, MUTED).setOrigin(.5).setLetterSpacing(2)
    this.emptyHint = this.add.container(0, 0, [hint1, hint2, hint3])
    this.toast = this.text(360, 205, `REACH ${this.gameScene.coronation.targetHeight}m TO UNLOCK THE CROWN`, 15, '#c3cbb6').setOrigin(.5).setLetterSpacing(1)
    this.countdown = this.text(360, 241, '', 25, GOLD, 'Georgia').setOrigin(.5)
    this.threatLabel = this.text(360, 978, '', 14, '#e5bf99').setOrigin(.5).setBackgroundColor('#142a34').setPadding(8, 4)
    this.gameScene.events.on('defeat', this.showDefeat, this)
    this.gameScene.events.on('victory', this.showVictory, this)
    this.gameScene.events.on('crownReady', this.showCrownReady, this)
    this.events.once('shutdown', () => {
      this.gameScene.events.off('defeat', this.showDefeat, this)
      this.gameScene.events.off('victory', this.showVictory, this)
      this.gameScene.events.off('crownReady', this.showCrownReady, this)
      this.confetti.destroy()
    })
    this.input.keyboard?.on('keydown-H', () => this.toggleHelp())
    this.input.keyboard?.on('keydown-M', (event: KeyboardEvent) => { if (!event.repeat) this.gameScene.audio.toggleMute() })
    this.input.keyboard?.on('keydown-ESC', () => { if (this.modal && !this.gameScene.gameOver) this.closeModal() })
    // Quick retry / advance from the keyboard once a run has ended.
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.gameScene.gameOver) this.restart(this.gameScene.coronation.result === 'victory')
    })
  }

  private text(x: number, y: number, value: string, size: number, color = INK, font = 'Arial') {
    return this.add.text(x, y, value, { fontFamily: font, fontSize: `${size}px`, color })
  }

  private drawHeader() {
    const g = this.add.graphics()
    g.fillStyle(0x101f2b, .97).fillRect(0, 0, 720, 176)
    g.lineStyle(1, 0xbdb58a, .25).lineBetween(30, 105, 690, 105).lineBetween(30, 175, 690, 175)
    // A small heraldic tower, drawn as geometry rather than an icon font.
    g.fillStyle(0xdac18a).fillRect(35, 45, 34, 30).fillRect(32, 35, 10, 18).fillRect(48, 35, 9, 18).fillRect(63, 35, 10, 18)
    g.fillStyle(0x101f2b).fillRoundedRect(47, 59, 10, 17, { tl: 5, tr: 5, bl: 0, br: 0 })
    this.text(91, 28, 'CASTLEDOWN', 39, INK, 'Georgia').setLetterSpacing(2)
    this.text(93, 76, 'ONE STONE. ONE KINGDOM.', 12, MUTED).setLetterSpacing(3)
    const soundButton = this.button(507, 33, 48, 48, '', () => this.gameScene.audio.toggleMute(), false)
    this.soundIcon = this.add.graphics()
    soundButton.add(this.soundIcon)
    this.button(572, 33, 48, 48, '?', () => this.toggleHelp(), false)
    this.button(637, 33, 48, 48, '↻', () => this.showReset(), false)
    this.text(34, 120, 'HEIGHT', 11, MUTED).setLetterSpacing(2)
    this.savedBest = loadSave().bestHeight
    this.bestLabel = this.text(104, 120, `BEST ${this.savedBest.toFixed(1)}m`, 11, '#b9a878').setLetterSpacing(1)
    this.heightLabel = this.text(34, 138, '0.0 m', 25, GOLD, 'Georgia')
    this.text(226, 120, 'ROOMS', 11, MUTED).setLetterSpacing(2)
    this.roomsLabel = this.text(226, 138, '00', 25, INK, 'Georgia')
    this.text(442, 120, 'BALANCE', 11, MUTED).setLetterSpacing(2)
    this.statusDot = this.add.circle(449, 151, 4, 0x8bdbb0)
    this.stabilityLabel = this.text(465, 139, 'Ready to build', 20, '#a5cbb3')
  }

  private drawDock() {
    const g = this.add.graphics()
    g.fillStyle(0x0e1c27).fillRect(0, 1000, 720, 280)
    g.fillStyle(0x253b42).fillRect(0, 1000, 720, 2)
    this.text(30, 1017, 'CHOOSE YOUR NEXT ROOM', 12, MUTED).setLetterSpacing(2)
    this.stageLabel = this.text(688, 1017, '', 12, '#c6ba91').setOrigin(1, 0).setLetterSpacing(2)
    BLOCK_TYPES.forEach((type, i) => {
      const x = 30 + i * 168, y = 1044, stats = BLOCKS[type]
      const outline = this.add.graphics()
      const image = this.add.image(76, 41, type).setScale(Math.min(105 / stats.width, 58 / stats.height))
      const title = this.text(76, 82, stats.short, 13, INK).setOrigin(.5).setLetterSpacing(2)
      const mass = this.text(76, 100, `${stats.mass.toFixed(0)} t`, 12, MUTED).setOrigin(.5)
      const card = this.add.container(x, y, [outline, image, title, mass]).setSize(156, 114)
      if (type === 'king') {
        this.kingLabel = mass
        this.kingLock = this.add.graphics().fillStyle(0x26343e, .8).fillRoundedRect(52, 15, 48, 47, 6)
        this.kingLock.lineStyle(3, 0xd0c4a3).strokeRoundedRect(66, 22, 19, 22, 8)
        this.kingLock.fillStyle(0xd0c4a3).fillRoundedRect(62, 35, 27, 21, 3)
        this.kingLock.fillStyle(0x273944).fillCircle(76, 43, 3).fillRect(75, 44, 2, 6)
        card.add(this.kingLock)
      }
      card.setInteractive(new Phaser.Geom.Rectangle(78, 57, 156, 114), Phaser.Geom.Rectangle.Contains)
      card.input!.cursor = 'pointer'
      card.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation(); this.gameScene.select(type)
      })
      this.cardOutlines.set(type, outline); this.cardContainers.set(type, card)
    })
    this.description = this.text(360, 1175, '', 14, '#aebfb2').setOrigin(.5)
    this.button(30, 1197, 150, 68, '↻  ROTATE', () => this.gameScene.rotate(), false)
    this.dropButton = this.button(195, 1197, 495, 68, '↓  DROP ROOM', () => this.gameScene.drop(), true)
    this.dropText = this.dropButton.getAt(1) as Phaser.GameObjects.Text
  }

  private button(x: number, y: number, w: number, h: number, label: string, action: () => void, primary: boolean) {
    const g = this.add.graphics()
    g.fillStyle(primary ? 0xdcc18a : 0x1c313c).fillRoundedRect(0, 0, w, h, 6)
    g.lineStyle(1, primary ? 0xf1d9a5 : 0x42545a, .8).strokeRoundedRect(0, 0, w, h, 6)
    const text = this.text(w / 2, h / 2, label, h > 50 ? 17 : 24, primary ? '#1b3037' : INK).setOrigin(.5)
    if (h > 50) text.setLetterSpacing(2).setFontStyle('bold')
    const button = this.add.container(x, y, [g, text]).setSize(w, h)
    // Container hit testing adds its display origin, unlike its child artwork.
    button.setInteractive(new Phaser.Geom.Rectangle(w / 2, h / 2, w, h), Phaser.Geom.Rectangle.Contains)
    button.input!.cursor = 'pointer'
    button.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation(); action()
    })
    button.on('pointerover', () => g.setAlpha(.8)).on('pointerout', () => g.setAlpha(1))
    return button
  }

  update(_time: number, delta: number) {
    const game = this.gameScene
    this.confetti.update(delta)
    const silent = game.audio.muted || !game.audio.available
    const icon = this.soundIcon.clear().fillStyle(silent ? 0x8fa9a5 : 0xe5c58c)
    icon.fillRect(10, 20, 7, 10).fillTriangle(16, 20, 25, 13, 25, 36)
    icon.lineStyle(2, silent ? 0x8fa9a5 : 0xe5c58c)
    if (silent) icon.lineBetween(30, 20, 39, 29).lineBetween(39, 20, 30, 29)
    else icon.beginPath().arc(24, 25, 12, -.7, .7).strokePath()
    this.emptyHint.setVisible(game.placed === 0)
    this.heightLabel.setText(`${game.height.toFixed(1)} m`)
    this.roomsLabel.setText(String(game.blocks.length).padStart(2, '0'))
    this.dropButton.setAlpha(game.ready ? 1 : .45)
    const fallen = game.defeatReason === 'collapse' ? 'CASTLE COLLAPSED' : 'THE KING HAS FALLEN'
    this.dropText.setText(game.ready ? '↓  DROP ROOM' : game.gameOver ? game.coronation.result === 'victory' ? 'KINGDOM CROWNED' : fallen : 'SETTLING…')
    const unstable = game.blocks.some(b => b.stability.state === 'UNSTABLE')
    const critical = game.blocks.some(b => b.stability.tilt >= 35 * Math.PI / 180)
    const moving = game.blocks.some(b => b.stability.state === 'FALLING' || b.stability.state === 'SETTLING')
    const label = game.gameOver ? game.coronation.result === 'victory' ? 'Crowned' : game.defeatReason === 'collapse' ? 'Collapsed' : 'King fallen' : critical ? 'Critical tilt' : unstable ? 'Wobbling' : moving ? 'Settling' : game.blocks.length ? 'Stable' : 'Ready to build'
    const color = game.coronation.result === 'defeat' || critical ? '#e77c72' : unstable || moving ? '#e8c77e' : '#a5cbb3'
    this.stabilityLabel.setText(label).setColor(color); this.statusDot.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color)
    if (this.previousType !== game.crane.type || this.previousKing !== game.kingPlaced || this.previousUnlocked !== game.kingUnlocked) {
      this.previousType = game.crane.type; this.previousKing = game.kingPlaced
      this.previousUnlocked = game.kingUnlocked
      for (const type of BLOCK_TYPES) {
        const selected = type === game.crane.type, g = this.cardOutlines.get(type)!
        g.clear().fillStyle(selected ? 0x2b4145 : 0x172a35).fillRoundedRect(0, 0, 156, 114, 7)
        g.lineStyle(selected ? 2 : 1, selected ? 0xd9c08d : 0x354950).strokeRoundedRect(0, 0, 156, 114, 7)
        if (selected) g.fillStyle(0xe1c58c).fillCircle(139, 14, 3)
        this.cardContainers.get(type)!.setAlpha(type === 'king' && (!game.kingUnlocked || game.kingPlaced) ? .45 : 1)
        if (type === 'king' && game.kingUnlocked && !game.kingPlaced) {
          g.lineStyle(8, 0xe5bd77, .15).strokeRoundedRect(-2, -2, 160, 118, 8)
          g.lineStyle(2, 0xe5bd77).strokeRoundedRect(0, 0, 156, 114, 7)
        }
      }
      this.kingLock.setVisible(!game.kingUnlocked)
      this.kingLabel.setText(game.kingPlaced ? 'PLACED' : game.kingUnlocked ? 'READY!' : `LOCKED · ${game.coronation.targetHeight}m`).setColor(game.kingUnlocked ? GOLD : MUTED)
      this.description.setText(BLOCKS[game.crane.type].description)
    }
    const air = game.waves.enemies.filter(e => e.type === 'gargoyle').length
    const ground = game.waves.enemies.length - air
    const wind = Math.abs(game.wind) > .00003 ? `  ·  WIND ${game.wind > 0 ? '→' : '←'}` : ''
    const losses = game.lost && !game.kingPlaced ? `  ·  LOST ${game.lost}/${MAX_LOST_ROOMS}` : ''
    this.threatLabel.setText(`AIR ${air}  ·  RAMS ${ground}  ·  DEFEATED ${game.waves.kills}${wind}${losses}`).setVisible(game.placed > 0)
    this.stageLabel.setText(`${game.coronation.config.label} / ${game.coronation.started ? 'DEFEND' : 'BUILD'}`)
    if (game.bestHeight > this.savedBest) this.bestLabel.setText(`BEST ${game.bestHeight.toFixed(1)}m`)
    if (game.coronation.started) {
      const stable = game.blocks.find(b => b.type === 'king')?.stability.state === 'STABLE'
      this.toast.setAlpha(1).setText(stable ? 'HOLD THE THRONE. DEFEND YOUR KING!' : 'THRONE UNSTABLE — COUNTDOWN RESET').setColor(stable ? GOLD : '#edaa86')
      this.countdown.setText(`CORONATION: 00:${String(Math.ceil(game.coronation.remainingMs / 1000)).padStart(2, '0')}`)
      return
    }
    if (game.kingUnlocked) return
    const milestone = Math.floor(game.bestHeight / 10) * 10
    if (milestone > this.displayedMilestone) {
      this.displayedMilestone = milestone
      this.toast.setText(`${milestone} METRES · A KINGDOM RISES`).setAlpha(1)
      this.tweens.add({ targets: this.toast, alpha: 0, delay: 2500, duration: 600 })
    }
  }

  private panel(title: string, subtitle: string) {
    this.gameScene.paused = true
    if (!this.gameScene.gameOver) this.gameScene.audio.stop()
    const shade = this.add.rectangle(360, 640, 720, 1280, 0x07121c, .85).setInteractive()
    shade.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation())
    const g = this.add.graphics().fillStyle(0x172d37).fillRoundedRect(55, 325, 610, 630, 14)
    g.lineStyle(1, 0xd1b983, .6).strokeRoundedRect(55, 325, 610, 630, 14)
    this.modal = this.add.container(0, 0, [shade, g,
      this.text(360, 375, title, 37, GOLD, 'Georgia').setOrigin(.5),
      this.text(360, 422, subtitle, 13, MUTED).setOrigin(.5).setLetterSpacing(2),
    ]).setDepth(100)
    return this.modal
  }

  private toggleHelp() {
    if (this.gameScene.gameOver) return
    if (this.modal) { this.closeModal(); return }
    const panel = this.panel('The art of balance', 'A CASTLE IS ONLY AS STRONG AS ITS FOUNDATION')
    const lines = [
      ['01', 'Build & defend', `Reach ${this.gameScene.coronation.targetHeight}m to unlock your throne. Drag, rotate, drop.`],
      ['02', 'Arm your castle', 'Archers target air. Cannons blast rams. Green can fire.'],
      ['03', 'Watch the skies', 'Gargoyles arrive every 10m; rams assault the base.'],
      ['04', 'The Coronation', `Crown the top. Stay STABLE for ${this.gameScene.coronation.durationMs / 1000}s. Wobble resets it.`],
    ]
    lines.forEach(([n, title, detail], i) => {
      const y = 480 + i * 82
      panel.add(this.text(93, y, n!, 25, GOLD, 'Georgia'))
      panel.add(this.text(148, y, title!, 21, INK))
      panel.add(this.text(148, y + 32, detail!, 15, MUTED))
    })
    panel.add(this.text(360, 828, 'KEYBOARD: ← → / A D aim · R rotate · Space drop · 1–4 rooms', 14, MUTED).setOrigin(.5))
    panel.add(this.text(360, 850, 'M · MUTE SOUND  ·  ENTER · RETRY / NEXT AFTER A RUN', 11, MUTED).setOrigin(.5))
    panel.add(this.button(95, 864, 530, 55, 'RETURN TO YOUR KINGDOM', () => this.closeModal(), true))
  }

  private closeModal() { this.modal?.destroy(); this.modal = undefined; this.gameScene.paused = false }

  private showReset() {
    if (this.modal) return
    const endless = loadSave().unlockedLevel > CAMPAIGN_LEVELS
    if (this.gameScene.placed === 0 && !endless) { this.restart(); return }
    const panel = this.panel('A fresh foundation', 'BEGIN A NEW CASTLE')
    panel.add(this.text(360, 535, `Your castle reached ${this.gameScene.bestHeight.toFixed(1)} metres.`, 25, INK, 'Georgia').setOrigin(.5))
    panel.add(this.text(360, 587, 'Starting again clears the current castle.', 20, MUTED).setOrigin(.5))
    if (endless) {
      panel.add(this.button(95, 645, 530, 60, 'ENDLESS SIEGE', () => this.startLevel(CAMPAIGN_LEVELS + 1), false))
    }
    panel.add(this.button(95, 733, 530, 60, 'BUILD AGAIN', () => this.restart(), true))
    panel.add(this.button(95, 821, 530, 60, 'KEEP BUILDING', () => this.closeModal(), false))
  }

  private showDefeat() {
    const game = this.gameScene
    const collapse = game.defeatReason === 'collapse'
    const panel = this.panel(collapse ? 'Castle collapsed!' : 'The King has fallen!',
      collapse ? 'THE WALLS GAVE WAY BENEATH YOUR KINGDOM' : 'THE THRONE TOPPLED FROM ITS TOWER')
    const best = loadSave().bestHeight
    panel.add(this.text(360, 510, `${game.bestHeight.toFixed(1)} m`, 64, GOLD, 'Georgia').setOrigin(.5))
    panel.add(this.text(360, 579, game.newBestHeight ? '★ NEW BEST HEIGHT ★' : `THIS RUN  ·  ALL-TIME BEST ${best.toFixed(1)} m`, 14, game.newBestHeight ? GOLD : MUTED).setOrigin(.5).setLetterSpacing(3))
    panel.add(this.text(360, 640, `${game.placed} rooms placed  ·  ${game.lost} lost  ·  ${game.waves.kills} enemies defeated`, 20, INK).setOrigin(.5))
    const tip = collapse ? 'Wide stone walls first. Let each room settle.' : 'Crown only a steady tower. Keep archers near the top.'
    panel.add(this.text(360, 700, tip, 19, MUTED).setOrigin(.5))
    panel.add(this.button(95, 760, 530, 70, `↻  TRY AGAIN  ·  ${game.coronation.config.label}`, () => this.restart(), true))
    panel.add(this.text(360, 868, 'PRESS ENTER TO RETRY', 12, MUTED).setOrigin(.5).setLetterSpacing(2))
  }

  private showCrownReady() {
    this.tweens.killTweensOf(this.toast)
    this.toast.setAlpha(1).setColor(GOLD).setText('THE CROWN IS READY! CROWN YOUR CASTLE!')
  }

  private showVictory() {
    const game = this.gameScene, result = game.victoryResult
    const finalCampaign = game.coronation.level === CAMPAIGN_LEVELS
    const title = game.coronation.config.endless ? 'Siege survived' : finalCampaign ? 'Long live the King!' : 'Stage clear'
    const panel = this.panel(title, `${game.coronation.config.label} · ${game.coronation.config.name.toUpperCase()}`)
    const stars = result?.stars ?? 1
    const starArt = this.add.graphics()
    for (let i = 0; i < 3; i++) {
      const lit = i < stars, cx = 270 + i * 90, cy = 478 - (i === 1 ? 12 : 0)
      const points = Array.from({ length: 10 }, (_, k) => {
        const r = k % 2 ? 14 : 32, a = -Math.PI / 2 + k * Math.PI / 5
        return new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
      })
      starArt.fillStyle(lit ? 0xe5c58c : 0x2a3f48).fillPoints(points, true)
      starArt.lineStyle(2, lit ? 0xf6e2b0 : 0x3c535b).strokePoints(points, true)
    }
    panel.add(starArt)
    starArt.setScale(.2).setPosition(288, 381)
    this.tweens.add({ targets: starArt, scale: 1, x: 0, y: 0, duration: 450, ease: 'Back.Out' })
    panel.add(this.text(360, 548, `${(result?.score ?? 0).toLocaleString()}`, 52, GOLD, 'Georgia').setOrigin(.5))
    panel.add(this.text(360, 592, result?.newHighScore ? '★ NEW HIGH SCORE ★' : `SCORE  ·  HIGH ${loadSave().highScore.toLocaleString()}`, 13, result?.newHighScore ? GOLD : MUTED).setOrigin(.5).setLetterSpacing(3))
    const stats: [string, string][] = [
      ['HEIGHT', `${game.height.toFixed(1)} m`], ['ENEMIES', String(game.waves.kills)],
      ['ROOMS', `${game.placed}${game.lost ? ` (-${game.lost})` : ''}`], ['TIME', this.clock(game.runSeconds)],
    ]
    stats.forEach(([label, value], i) => {
      const x = 130 + i * 153
      panel.add(this.text(x, 632, label, 11, MUTED).setOrigin(.5).setLetterSpacing(2))
      panel.add(this.text(x, 662, value, 22, INK, 'Georgia').setOrigin(.5))
    })
    panel.add(this.text(360, 707, `★ Crowned  ·  ★ ≤2 rooms lost  ·  ★ under ${this.clock(game.coronation.config.parSeconds)}`, 13, MUTED).setOrigin(.5))
    const next = getLevelConfig(game.coronation.level + 1)
    const nextLabel = next.endless ? (game.coronation.config.endless ? `NEXT SIEGE · ${next.targetHeight}m` : 'ENDLESS MODE UNLOCKED ▸') : `NEXT LEVEL · ${next.targetHeight}m`
    panel.add(this.button(95, 743, 530, 65, nextLabel, () => this.restart(true), true))
    panel.add(this.button(95, 835, 530, 60, 'PLAY AGAIN', () => this.restart(), false))
    this.confetti.confetti(); this.time.delayedCall(700, () => this.confetti.confetti(60))
  }

  private clock(seconds: number) {
    const s = Math.max(0, Math.round(seconds))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  private restart(next = false) { this.startLevel(this.gameScene.coronation.level + (next ? 1 : 0)) }
  private startLevel(level: number) { this.scene.stop(); this.gameScene.scene.restart({ level }) }
}
