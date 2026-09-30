import { expect, test } from '@playwright/test'
import { CoronationSystem } from '../src/systems/CoronationSystem'

test('height unlock is one-shot, persists after damage, and scales per level', () => {
  const c = new CoronationSystem()
  expect(c.update(16, 10).unlocked).toBe(false)
  expect(c.update(16, 15).unlocked).toBe(true)
  expect(c.update(16, 15).unlocked).toBe(false)
  c.update(16, 3)
  expect(c.unlocked).toBe(true)
  expect(new CoronationSystem(2).targetHeight).toBe(25)
  expect(new CoronationSystem(3).targetHeight).toBe(35)
  expect([1, 2, 3].map(level => new CoronationSystem(level).durationMs)).toEqual([8000, 10_000, 12_000])
  expect(new CoronationSystem(4).config.endless).toBe(true)
})

test('eight consecutive stable seconds on L1; wobble resets the clock without another swarm', () => {
  const c = new CoronationSystem()
  c.update(0, 15)
  expect(c.update(1000, 18, 'SETTLING').started).toBe(false)
  expect(c.update(7000, 18, 'STABLE').started).toBe(true)
  expect(c.remainingMs).toBe(1000)
  c.update(16, 18, 'UNSTABLE')
  expect(c.remainingMs).toBe(8000)
  expect(c.update(7999, 18, 'STABLE').started).toBe(false)
  expect(c.result).toBeNull()
  expect(c.update(1, 18, 'STABLE').victory).toBe(true)
  expect(c.update(100, 18, 'STABLE').victory).toBe(false)
})

test('defeat is terminal and cannot become victory on a later tick', () => {
  const c = new CoronationSystem()
  c.update(c.durationMs - 1, 15, 'STABLE')
  c.defeat()
  expect(c.update(100, 15, 'STABLE').victory).toBe(false)
  expect(c.result).toBe('defeat')
})
