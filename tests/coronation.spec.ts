import { expect, test } from '@playwright/test'
import { CoronationSystem } from '../src/systems/CoronationSystem'

test('height unlock is one-shot, persists after damage, and scales per level', () => {
  const c = new CoronationSystem()
  expect(c.update(16, 10).unlocked).toBe(false)
  expect(c.update(16, 15).unlocked).toBe(true)
  expect(c.update(16, 15).unlocked).toBe(false)
  c.update(16, 3)
  expect(c.unlocked).toBe(true)
  expect(new CoronationSystem(2).targetHeight).toBe(20)
})

test('ten consecutive stable seconds; wobble resets the clock without another swarm', () => {
  const c = new CoronationSystem()
  c.update(0, 15)
  expect(c.update(1000, 18, 'SETTLING').started).toBe(false)
  expect(c.update(9000, 18, 'STABLE').started).toBe(true)
  expect(c.remainingMs).toBe(1000)
  c.update(16, 18, 'UNSTABLE')
  expect(c.remainingMs).toBe(10000)
  expect(c.update(9999, 18, 'STABLE').started).toBe(false)
  expect(c.result).toBeNull()
  expect(c.update(1, 18, 'STABLE').victory).toBe(true)
  expect(c.update(100, 18, 'STABLE').victory).toBe(false)
})

test('defeat is terminal and cannot become victory on a later tick', () => {
  const c = new CoronationSystem()
  c.update(9999, 15, 'STABLE')
  c.defeat()
  expect(c.update(100, 15, 'STABLE').victory).toBe(false)
  expect(c.result).toBe('defeat')
})
