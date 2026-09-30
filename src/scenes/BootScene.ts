import Phaser from 'phaser'
import { BLOCKS, BLOCK_TYPES } from '../types/blockTypes'
import type { BlockType } from '../types/blockTypes'

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot') }

  create() {
    for (const type of BLOCK_TYPES) this.makeRoom(type)
    this.makeLandscape()
    this.scene.start('Game')
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

  private makeLandscape() {
    const texture = this.textures.createCanvas('landscape', 720, 1280)!
    const c = texture.context
    const gradient = c.createLinearGradient(0, 0, 0, 1280)
    gradient.addColorStop(0, '#10212e'); gradient.addColorStop(.6, '#29494b'); gradient.addColorStop(1, '#52675b')
    c.fillStyle = gradient; c.fillRect(0, 0, 720, 1280)
    for (let i = 0; i < 95; i++) {
      c.fillStyle = i % 3 === 0 ? '#dcd5ad70' : '#a6c2bd35'
      c.fillRect((i * 173 + 31) % 720, (i * 97 + 180) % 850, i % 4 === 0 ? 2 : 1, 2)
    }
    const halo = c.createRadialGradient(554, 320, 10, 554, 320, 140)
    halo.addColorStop(0, '#e1d7ac25'); halo.addColorStop(1, '#e1d7ac00')
    c.fillStyle = halo; c.fillRect(404, 170, 300, 300)
    c.fillStyle = '#cbd3b3'; c.beginPath(); c.arc(554, 320, 39, 0, Math.PI * 2); c.fill()
    c.fillStyle = '#244048'; c.beginPath(); c.arc(537, 304, 34, 0, Math.PI * 2); c.fill()
    const ridge = (base: number, color: string, points: number[]) => {
      c.fillStyle = color; c.beginPath(); c.moveTo(0, 1280)
      points.forEach((n, i) => c.lineTo(i * 90, base + n)); c.lineTo(720, 1280); c.fill()
    }
    ridge(650, '#29484a', [70, 0, 120, 35, 100, -50, 35, 90, 30])
    ridge(770, '#254346', [20, -40, 65, 0, 90, 30, -20, 80, 40])
    c.fillStyle = '#203d42'
    for (const [x, y, w, h] of [[54, 651, 54, 218], [119, 718, 33, 151], [571, 711, 55, 193], [640, 663, 32, 230]]) {
      c.fillRect(x!, y!, w!, h!); c.beginPath(); c.moveTo(x! - 6, y!); c.lineTo(x! + w! / 2, y! - 40); c.lineTo(x! + w! + 6, y!); c.fill()
      c.fillStyle = '#99a27b25'; c.fillRect(x! + w! / 2 - 3, y! + 28, 6, 15); c.fillStyle = '#203d42'
    }
    ridge(925, '#1a353c', [0, -45, 60, 12, 70, 0, 50, -22, 0])
    for (let i = 0; i < 22; i++) {
      const x = (i * 137) % 720, y = 900 + (i * 31) % 135
      c.fillStyle = '#152f36'; c.beginPath(); c.moveTo(x, y - 55); c.lineTo(x - 22, y + 18); c.lineTo(x + 22, y + 18); c.fill()
    }
    texture.refresh()
  }
}
