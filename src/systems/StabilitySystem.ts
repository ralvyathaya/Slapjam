import type { StabilityState } from '../types/blockTypes'

export interface StabilitySample {
  angle: number; placementAngle: number; speed: number; angularVelocity: number
  touching: boolean; outOfBounds: boolean
}

/** Fold deviation from the player's chosen orientation at 180 degrees. */
export function tiltFromPlacement(angle: number, placementAngle: number): number {
  return Math.abs(Math.atan2(Math.sin(2 * (angle - placementAngle)), Math.cos(2 * (angle - placementAngle))) / 2)
}

export class StabilitySystem {
  state: StabilityState = 'FALLING'
  settledMs = 0
  hasLanded = false
  tilt = 0

  update(sample: StabilitySample, delta: number): StabilityState {
    if (this.state === 'COLLAPSED') return this.state
    this.tilt = tiltFromPlacement(sample.angle, sample.placementAngle)
    this.hasLanded ||= sample.touching
    if (sample.outOfBounds || (this.hasLanded && this.tilt >= 65 * Math.PI / 180)) {
      this.state = 'COLLAPSED'
    } else if (!sample.touching) {
      this.settledMs = 0
      this.state = 'FALLING'
    } else if (this.tilt >= 15 * Math.PI / 180) {
      this.settledMs = 0
      this.state = 'UNSTABLE'
    } else if (sample.speed < .4 && Math.abs(sample.angularVelocity) < .015) {
      this.settledMs += Math.max(0, delta)
      this.state = this.settledMs >= 600 ? 'STABLE' : 'SETTLING'
    } else {
      this.settledMs = 0
      this.state = 'SETTLING'
    }
    return this.state
  }
}
