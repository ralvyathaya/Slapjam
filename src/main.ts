import Phaser from 'phaser'
import './style.css'
import { gameConfig } from './config/gameConfig'

export const game = new Phaser.Game(gameConfig)

// Belt-and-braces unlock for iOS/Android: resume WebAudio on every gesture, and
// after the tab returns from background, in case Phaser's one-shot unlock missed it.
const resumeAudio = () => {
  const sound = game.sound as Phaser.Sound.WebAudioSoundManager
  if (sound.context && sound.context.state !== 'running' && !sound.mute) sound.context.resume().catch(() => {})
}
for (const type of ['pointerdown', 'touchend', 'keydown'] as const) window.addEventListener(type, resumeAudio, { passive: true })
document.addEventListener('visibilitychange', () => { if (!document.hidden) resumeAudio() })
// Stop long-press menus, double-tap zoom and pull-to-refresh from stealing crane drags.
document.addEventListener('contextmenu', event => event.preventDefault())
document.addEventListener('touchmove', event => { if (event.cancelable) event.preventDefault() }, { passive: false })
document.addEventListener('dblclick', event => event.preventDefault())
