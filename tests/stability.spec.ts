import { expect, test } from '@playwright/test'
import { StabilitySystem, tiltFromPlacement } from '../src/systems/StabilitySystem'

const still = { angle: 0, placementAngle: 0, speed: 0, angularVelocity: 0, touching: true, outOfBounds: false }

test('requires continuous contact and 600ms of rest; movement resets the timer', () => {
  const system = new StabilitySystem()
  expect(system.update({ ...still, touching: false }, 1000)).toBe('FALLING')
  expect(system.update(still, 599)).toBe('SETTLING')
  expect(system.update({ ...still, speed: .5 }, 16)).toBe('SETTLING')
  expect(system.update(still, 599)).toBe('SETTLING')
  expect(system.update(still, 1)).toBe('STABLE')
  expect(system.update({ ...still, touching: false }, 16)).toBe('FALLING')
})

test('intentional quarter-turn rotations settle and negative tilts are symmetric', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
    const system = new StabilitySystem()
    expect(system.update({ ...still, angle, placementAngle: angle }, 600)).toBe('STABLE')
  }
  expect(tiltFromPlacement(-.2, 0)).toBeCloseTo(tiltFromPlacement(.2, 0))
  expect(tiltFromPlacement(2 * Math.PI + .2, 0)).toBeCloseTo(.2)
})

test('tilt disables stable state, collapse is terminal, and missed drops collapse', () => {
  const system = new StabilitySystem()
  expect(system.update(still, 600)).toBe('STABLE')
  expect(system.update({ ...still, angle: 20 * Math.PI / 180 }, 16)).toBe('UNSTABLE')
  expect(system.update({ ...still, angle: 66 * Math.PI / 180 }, 16)).toBe('COLLAPSED')
  expect(system.update(still, 1000)).toBe('COLLAPSED')
  expect(new StabilitySystem().update({ ...still, touching: false, outOfBounds: true }, 16)).toBe('COLLAPSED')
})
