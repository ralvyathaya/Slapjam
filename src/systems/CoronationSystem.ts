import type { StabilityState } from '../types/blockTypes'
import { getLevelConfig } from '../config/levels'
import type { LevelConfig } from '../config/levels'

export class CoronationSystem {
  readonly level: number
  readonly config: LevelConfig
  readonly targetHeight: number
  readonly durationMs: number
  unlocked = false
  started = false
  remainingMs: number
  result: 'victory' | 'defeat' | null = null

  constructor(level = 1) {
    this.config = getLevelConfig(level)
    this.level = this.config.level
    this.targetHeight = this.config.targetHeight
    this.durationMs = this.config.coronationMs
    this.remainingMs = this.durationMs
  }

  update(delta: number, height: number, kingState?: StabilityState) {
    const events = { unlocked: false, started: false, victory: false }
    if (this.result) return events
    // Matter's contact slop can leave a nominal 15 m tower a fraction short.
    if (!this.unlocked && height + .025 >= this.targetHeight) {
      this.unlocked = true; events.unlocked = true
    }
    if (this.unlocked && kingState === 'STABLE') {
      if (!this.started) { this.started = true; events.started = true }
      this.remainingMs = Math.max(0, this.remainingMs - delta)
      if (this.remainingMs <= .001) {
        this.remainingMs = 0; this.result = 'victory'; events.victory = true
      }
    } else if (this.started) {
      // Victory requires continuous stability, not accumulated safe fragments.
      this.remainingMs = this.durationMs
    }
    return events
  }

  defeat() { if (!this.result) this.result = 'defeat' }
}
