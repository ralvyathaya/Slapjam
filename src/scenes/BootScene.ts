import Phaser from 'phaser'
import { BLOCKS, BLOCK_TYPES } from '../types/blockTypes'
import type { BlockType } from '../types/blockTypes'
import backgroundUrl from '../assets/night-valley.png'
import gargoyleUrl from '../assets/gargoyle.png'

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot') }

  preload() {
    this.load.image('landscape', backgroundUrl)
    this.load.image('gargoyle_sheet', gargoyleUrl)
    this.load.audio('bgm-intro', 'audio/bgm-intro.mp3')
    this.load.audio('bgm-gameplay', 'audio/bgm-gameplay.mp3')
    this.load.audio('bgm-victory', 'audio/bgm-victory.mp3')
    this.load.audio('bgm-defeat', 'audio/bgm-defeat.mp3')
  }

  async create() {
    this.add.text(360, 640, 'Summoning your kingdom…', { fontFamily: 'Georgia', fontSize: '24px', color: '#e5c58c' }).setOrigin(.5)
    // Canvas text captures its font at creation; load the local faces first.
    await Promise.all([
      document.fonts.load('700 32px Cinzel'), document.fonts.load('400 20px "Barlow Condensed"'),
      document.fonts.load('700 20px "Barlow Condensed"'),
    ]).catch(() => {})
    for (const type of BLOCK_TYPES) this.makeRoom(type)
    this.makePanel('hud-metal', 720, 184)
    this.makePanel('dock-wood', 720, 280, true)
    this.makePanel('modal-metal', 610, 630)
    this.makePanel('room-card', 156, 114)
    const gargoyleTex = this.textures.get('gargoyle_sheet')
    if (gargoyleTex && !gargoyleTex.has('0')) {
      gargoyleTex.add('0', 0, 0, 0, 167, 373)
      gargoyleTex.add('1', 0, 167, 0, 167, 373)
      gargoyleTex.add('2', 0, 334, 0, 167, 373)
      gargoyleTex.add('3', 0, 501, 0, 168, 373)
      if (!this.anims.exists('gargoyle_fly')) {
        this.anims.create({
          key: 'gargoyle_fly',
          frames: [
            { key: 'gargoyle_sheet', frame: '0' },
            { key: 'gargoyle_sheet', frame: '1' },
            { key: 'gargoyle_sheet', frame: '2' },
            { key: 'gargoyle_sheet', frame: '3' },
          ],
          frameRate: 6,
          repeat: -1,
        })
      }
    }
    this.scene.start('Game')
  }

  private makePanel(key: string, w: number, h: number, wood = false) {
    const texture = this.textures.createCanvas(key, w, h)!, c = texture.context
    const gradient = c.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, wood ? '#302a27' : '#263c47')
    gradient.addColorStop(.45, wood ? '#201f22' : '#162832')
    gradient.addColorStop(1, wood ? '#141a21' : '#0e1b26')
    c.fillStyle = gradient; c.fillRect(0, 0, w, h)
    for (let i = 0; i < (wood ? 160 : 300); i++) {
      c.fillStyle = i % 3 ? '#c5b28c06' : '#00000010'
      const x = i * 97 % w, y = i * 43 % h
      c.fillRect(x, y, wood ? 30 + i % 120 : 2, 1)
    }
    if (wood) {
      c.strokeStyle = '#070b1280'; c.lineWidth = 2
      for (let y = 35; y < h; y += 46) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke() }
    }
    c.strokeStyle = '#886943'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4)
    c.strokeStyle = '#e1bd7e65'; c.lineWidth = 1; c.strokeRect(6, 6, w - 12, h - 12)
    c.strokeStyle = '#080e1790'; c.lineWidth = 3; c.strokeRect(9, 9, w - 18, h - 18)
    for (const x of [15, w - 15]) for (const y of [15, h - 15]) {
      c.fillStyle = '#090f18'; c.beginPath(); c.arc(x + 1, y + 2, 4, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#a88a5e'; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#e5c58c'; c.fillRect(x - 1, y - 2, 2, 1)
    }
    texture.refresh()
  }

  private makeRoom(type: BlockType) {
    const { width: w, height: h } = BLOCKS[type]
    const texture = this.textures.createCanvas(type, w, h)!
    const c = texture.context
    const gold = type === 'king'
    c.beginPath()
    if (type === 'cannon') {
      c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, 40); c.lineTo(130, 40)
      c.lineTo(130, h); c.lineTo(20, h); c.lineTo(20, 40); c.lineTo(0, 40)
    } else c.rect(0, 0, w, h)
    c.closePath(); c.save(); c.clip()
    c.fillStyle = '#243b40'; c.fillRect(0, 0, w, h)
    const colors = gold ? ['#a99a72', '#bbab81', '#a49470', '#c0ae83'] : ['#7a9291', '#8ca29c', '#708b8a', '#94a89f']
    for (let row = 0; row < Math.ceil(h / 29); row++) {
      for (let col = -1; col < Math.ceil(w / 49); col++) {
        const x = col * 49 + (row % 2) * 24, y = row * 29
        c.fillStyle = colors[(row * 3 + col + 5) % 4]!; c.fillRect(x + 1, y + 1, 47, 27)
        c.fillStyle = '#e5ebcd40'; c.fillRect(x + 2, y + 2, 45, 2)
        c.fillStyle = '#13292f40'; c.fillRect(x + 2, y + 25, 45, 3)
        c.fillStyle = '#13292f28'; c.fillRect(x + 45, y + 4, 3, 21)
        // Fixed grain coordinates keep the art reproducible without consuming gameplay RNG.
        for (let i = 0; i < 12; i++) {
          c.fillStyle = i % 2 ? '#eff0d518' : '#142d3420'
          c.fillRect(x + 4 + (i * 17 + row * 3) % 39, y + 5 + (i * 7 + col * 3 + 9) % 17, 2, 1)
        }
        if ((row + col) % 3 === 0) {
          c.strokeStyle = '#263e4448'; c.lineWidth = 1; c.beginPath()
          c.moveTo(x + 30, y + 1); c.lineTo(x + 26, y + 8); c.lineTo(x + 31, y + 14); c.stroke()
        }
      }
    }
    const shade = c.createLinearGradient(0, 0, w, h)
    shade.addColorStop(0, '#e3dfb510'); shade.addColorStop(.5, '#19303900'); shade.addColorStop(1, '#10283035')
    c.fillStyle = shade; c.fillRect(0, 0, w, h)
    c.fillStyle = '#1b303b40'; c.fillRect(w - 12, 0, 12, h)
    c.strokeStyle = gold ? '#ead298' : '#c0c9b0'; c.lineWidth = 5; c.stroke()
    c.restore()
    const window = (x: number, y: number, width: number, height: number) => {
      c.fillStyle = '#d8d3af'; c.beginPath(); c.roundRect(x - 3, y - 3, width + 6, height + 6, [width / 2, width / 2, 1, 1]); c.fill()
      c.fillStyle = '#263a3d'; c.beginPath(); c.roundRect(x, y, width, height, [width / 2, width / 2, 1, 1]); c.fill()
      const light = c.createLinearGradient(0, y, 0, y + height)
      light.addColorStop(0, '#f4d69a'); light.addColorStop(1, '#a66c42')
      c.fillStyle = light; c.fillRect(x + 5, y + 10, width - 10, height - 15)
      c.fillStyle = '#66543f'; c.fillRect(x + width / 2 - 2, y + 6, 4, height - 6)
      c.fillStyle = '#253c43'; c.fillRect(x - 5, y + height + 2, width + 10, 4)
    }
    if (type === 'stone') {
      c.strokeStyle = '#3f5e62'; c.lineWidth = 3; c.strokeRect(9, 9, w - 18, h - 18)
      c.fillStyle = '#617e7e'; c.beginPath(); c.moveTo(90, 26); c.lineTo(104, 43); c.lineTo(90, 63); c.lineTo(76, 43); c.closePath(); c.fill()
      c.strokeStyle = '#bed0b3'; c.lineWidth = 2; c.stroke()
    }
    if (type === 'archer') {
      window(35, 42, 30, 53)
      c.fillStyle = '#477f77'; c.fillRect(15, 103, 28, 40)
      c.fillStyle = '#91be9e'; c.fillRect(27, 109, 4, 25)
      c.fillStyle = '#d2c79c'; c.fillRect(0, 17, w, 7)
      for (let i = 15; i < w; i += 30) {
        c.fillStyle = '#344e55'; c.fillRect(i, 0, 13, 12)
        c.fillStyle = '#bac8ad'; c.fillRect(i + 13, 0, 15, 3); c.fillRect(i, 12, 13, 2)
      }
    }
    if (type === 'cannon') {
      c.fillStyle = '#bc9b77'; c.fillRect(2, 3, w - 4, 8)
      c.fillStyle = '#253e47'; c.beginPath(); c.arc(78, 27, 22, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#2a3c45'; c.fillRect(78, 13, 91, 23)
      c.fillStyle = '#81908a'; c.fillRect(83, 14, 84, 5)
      c.fillStyle = '#142931'; c.fillRect(163, 12, 10, 26)
      c.fillStyle = '#a1aaa0'; for (const x of [100, 145]) c.fillRect(x, 15, 3, 19)
      window(60, 52, 29, 42)
    }
    if (type === 'king') {
      window(22, 42, 31, 54); window(w - 53, 42, 31, 54)
      c.fillStyle = '#536d68'; c.fillRect(74, 7, 63, 106)
      c.fillStyle = '#253e4360'; c.fillRect(126, 7, 11, 106)
      c.strokeStyle = '#e4c37d'; c.lineWidth = 1; c.strokeRect(78, 10, 55, 99)
      c.fillStyle = '#e4c37d'; c.beginPath(); c.moveTo(84, 38); c.lineTo(89, 66); c.lineTo(121, 66)
      c.lineTo(127, 38); c.lineTo(113, 49); c.lineTo(105, 30); c.lineTo(97, 49); c.closePath(); c.fill()
      c.fillRect(89, 72, 32, 5)
      c.fillStyle = '#d9bc80'; c.fillRect(0, h - 9, w, 7)
    }
    texture.refresh()
  }

}
