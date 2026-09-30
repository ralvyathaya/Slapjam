import Phaser from 'phaser'
import { CUE_DURATIONS, SAMPLE_RATE, synthesize } from './audioSynth'
import type { SoundCue } from './audioSynth'

export class AudioSystem {
  readonly available: boolean
  muted = false
  private readonly manager: Phaser.Sound.BaseSoundManager
  private readonly voices = new Map<SoundCue, Phaser.Sound.BaseSound[]>()
  private readonly lastPlayed = new Map<SoundCue, number>()
  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene; this.manager = scene.sound
    this.available = scene.sound instanceof Phaser.Sound.WebAudioSoundManager
    if (!this.available) return
    const manager = scene.sound as Phaser.Sound.WebAudioSoundManager
    manager.setVolume(.55)
    try { this.muted = localStorage.getItem('castledown-muted') === 'true' } catch { /* Storage can be unavailable in embedded games. */ }
    manager.setMute(this.muted)
    for (const cue of Object.keys(CUE_DURATIONS) as SoundCue[]) {
      const key = `sfx-${cue}`
      if (!scene.cache.audio.exists(key)) {
        const samples = synthesize(cue)
        const buffer = manager.context.createBuffer(1, samples.length, SAMPLE_RATE)
        buffer.getChannelData(0).set(samples)
        scene.cache.audio.add(key, buffer)
      }
      this.voices.set(cue, Array.from({ length: cue === 'arrow' || cue === 'thud' ? 2 : 1 }, () => manager.add(key)))
    }
    // Phaser installs its own first-gesture unlock handlers, including keyboard.
  }

  /** Mobile browsers suspend audio until a gesture and again after backgrounding the tab. */
  resume() {
    if (!this.available || this.muted) return
    const context = (this.manager as Phaser.Sound.WebAudioSoundManager).context
    if (context.state !== 'running') context.resume().catch(() => { /* Retried on the next gesture. */ })
  }

  toggleMute() {
    if (!this.available) return
    // AudioParam gain changes apply on the audio thread; keep UI intent synchronous.
    this.muted = !this.muted
    this.manager.mute = this.muted
    if (this.muted) this.stop()
    else this.resume()
    try { localStorage.setItem('castledown-muted', String(this.muted)) } catch { /* Keep the preference for this session. */ }
  }

  play(cue: SoundCue, volume = 1, x = 360) {
    if (!this.available || this.muted || this.manager.locked) return false
    const now = this.scene.time.now
    const gap = cue === 'grind' ? 800 : cue === 'arrow' ? 70 : cue === 'thud' ? 100 : 50
    if (now - (this.lastPlayed.get(cue) ?? -Infinity) < gap) return false
    const voices = this.voices.get(cue)!
    const voice = voices.find(sound => !sound.isPlaying) ?? voices[0]!
    const played = voice.play({ volume: Phaser.Math.Clamp(volume, 0, 1), pan: Phaser.Math.Clamp((x - 360) / 600, -.6, .6) })
    if (played) this.lastPlayed.set(cue, now)
    return played
  }

  stop() { for (const voices of this.voices.values()) for (const voice of voices) voice.stop() }
  destroy() { for (const voices of this.voices.values()) for (const voice of voices) this.manager.remove(voice); this.voices.clear() }
}
