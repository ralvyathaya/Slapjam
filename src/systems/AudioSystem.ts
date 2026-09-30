import Phaser from 'phaser'
import { CUE_DURATIONS, SAMPLE_RATE, synthesize } from './audioSynth'
import type { SoundCue } from './audioSynth'

export const BGM_TRACKS = ['intro', 'gameplay', 'victory', 'defeat'] as const
export type BgmTrack = (typeof BGM_TRACKS)[number]

export class AudioSystem {
  readonly available: boolean
  muted = false
  private readonly manager: Phaser.Sound.BaseSoundManager
  private readonly voices = new Map<SoundCue, Phaser.Sound.BaseSound[]>()
  private readonly bgmSounds = new Map<BgmTrack, Phaser.Sound.BaseSound>()
  private readonly lastPlayed = new Map<SoundCue, number>()
  private readonly scene: Phaser.Scene
  private unlockHandler?: () => void
  private destroyed = false
  currentBgm?: Phaser.Sound.BaseSound
  currentBgmTrack?: BgmTrack
  private currentBgmLoop = true
  private currentBgmVol = 0.45

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
    for (const track of BGM_TRACKS) {
      const key = `bgm-${track}`
      if (scene.cache.audio.exists(key)) {
        this.bgmSounds.set(track, manager.add(key))
      }
    }
  }

  /** Mobile browsers suspend audio until a gesture and again after backgrounding the tab. */
  resume() {
    if (!this.available || this.muted || this.destroyed) return
    const context = (this.manager as Phaser.Sound.WebAudioSoundManager).context
    if (context.state !== 'running') context.resume().catch(() => { /* Retried on the next gesture. */ })
    if (this.currentBgm && !this.currentBgm.isPlaying && !this.manager.locked) {
      try { this.currentBgm.play({ loop: this.currentBgmLoop, volume: Phaser.Math.Clamp(this.currentBgmVol, 0, 1) }) } catch {}
    }
  }

  playBgm(track: BgmTrack, loop?: boolean, volume = 0.45) {
    if (this.destroyed) return
    this.currentBgmTrack = track
    this.currentBgmLoop = loop ?? (track === 'intro' || track === 'gameplay')
    this.currentBgmVol = volume
    if (!this.available || this.muted) return

    let sound = this.bgmSounds.get(track)
    if (!sound) {
      const key = `bgm-${track}`
      if (this.scene.cache.audio.exists(key)) {
        sound = this.manager.add(key)
        this.bgmSounds.set(track, sound)
      }
    }
    if (!sound) return

    if (this.currentBgm === sound && sound.isPlaying) return

    if (this.currentBgm && this.currentBgm !== sound) {
      try { this.currentBgm.stop() } catch {}
    }
    this.currentBgm = sound

    if (!this.manager.locked) {
      try { sound.play({ loop: this.currentBgmLoop, volume: Phaser.Math.Clamp(volume, 0, 1) }) } catch {}
    } else if (!this.unlockHandler) {
      this.unlockHandler = () => {
        if (this.destroyed || this.muted) return
        if (this.currentBgm && !this.currentBgm.isPlaying) {
          try {
            this.currentBgm.play({ loop: this.currentBgmLoop, volume: Phaser.Math.Clamp(this.currentBgmVol, 0, 1) })
          } catch {}
        }
      }
      this.manager.once('unlocked', this.unlockHandler)
    }
  }

  resumeBgm() {
    if (!this.available || this.muted || this.manager.locked || !this.currentBgm || this.destroyed) return
    if (!this.currentBgm.isPlaying) {
      try { this.currentBgm.play({ loop: this.currentBgmLoop, volume: Phaser.Math.Clamp(this.currentBgmVol, 0, 1) }) } catch {}
    }
  }

  stopBgm() {
    if (this.currentBgm) {
      try { this.currentBgm.stop() } catch {}
      this.currentBgm = undefined
    }
  }

  toggleMute() {
    if (!this.available || this.destroyed) return
    this.muted = !this.muted
    this.manager.mute = this.muted
    if (this.muted) this.stop()
    else {
      this.resume()
      this.resumeBgm()
    }
    try { localStorage.setItem('castledown-muted', String(this.muted)) } catch { /* Keep the preference for this session. */ }
  }

  play(cue: SoundCue, volume = 1, x = 360) {
    if (!this.available || this.muted || this.manager.locked || this.destroyed) return false
    const now = this.scene.time.now
    const gap = cue === 'grind' ? 800 : cue === 'arrow' ? 70 : cue === 'thud' ? 100 : 50
    if (now - (this.lastPlayed.get(cue) ?? -Infinity) < gap) return false
    const voices = this.voices.get(cue)!
    const voice = voices.find(sound => !sound.isPlaying) ?? voices[0]!
    const played = voice.play({ volume: Phaser.Math.Clamp(volume, 0, 1), pan: Phaser.Math.Clamp((x - 360) / 600, -.6, .6) })
    if (played) this.lastPlayed.set(cue, now)
    return played
  }

  stop() {
    for (const voices of this.voices.values()) for (const voice of voices) { try { voice.stop() } catch {} }
    for (const bgm of this.bgmSounds.values()) { try { bgm.stop() } catch {} }
  }

  destroy() {
    this.destroyed = true
    if (this.unlockHandler) {
      this.manager.off('unlocked', this.unlockHandler)
      this.unlockHandler = undefined
    }
    this.stop()
    for (const voices of this.voices.values()) {
      for (const voice of voices) {
        try { this.manager.remove(voice) } catch {}
      }
    }
    this.voices.clear()
    for (const bgm of this.bgmSounds.values()) {
      try { this.manager.remove(bgm) } catch {}
    }
    this.bgmSounds.clear()
    this.currentBgm = undefined
  }
}
