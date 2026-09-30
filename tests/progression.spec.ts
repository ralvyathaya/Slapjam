import { expect, test } from '@playwright/test'
import { getLevelConfig } from '../src/config/levels'
import { scoreRun } from '../src/systems/SaveData'

test('campaign tuning matches the jam brief and endless keeps escalating', () => {
  const [l1, l2, l3, e1, e2] = [1, 2, 3, 4, 5].map(getLevelConfig)
  expect([l1, l2, l3].map(l => [l!.targetHeight, l!.coronationMs])).toEqual([[15, 8000], [25, 10_000], [35, 12_000]])
  expect(l1!.ramIntervalMs).toBe(0)
  expect(l1!.scoutsPerMilestone).toBe(2)
  expect(l2!.ramIntervalMs).toBeGreaterThan(0)
  expect(l3!.wind).toBeGreaterThan(0)
  expect(e1!.endless && e2!.endless).toBe(true)
  expect(e2!.targetHeight).toBeGreaterThan(e1!.targetHeight)
})

test('score rewards height, kills and pace; stars cap at three', () => {
  const base = { level: 1, height: 16, kills: 4, placed: 7, lost: 0, seconds: 60, parSeconds: 120 }
  expect(scoreRun(base).stars).toBe(3)
  expect(scoreRun({ ...base, lost: 5, seconds: 200 }).stars).toBe(1)
  expect(scoreRun({ ...base, kills: 8 }).score).toBeGreaterThan(scoreRun(base).score)
})

test('victory persists progress and high score; defeat names its cause', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    return !!game.scene.getScene('Game')?.crane && game.scene.isActive('UI')
  })).toBe(true)
  const saved = await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    const s = game.scene.getScene('Game')
    s.bestHeight = 16; s.highestY = 1120 - 16 * 30; s.waves.kills = 3; s.placed = 6
    s.finish('victory')
    return JSON.parse(localStorage.getItem('castledown-save-v1')!)
  })
  expect(saved.unlockedLevel).toBe(2)
  expect(saved.highScore).toBeGreaterThan(0)
  expect(saved.bestHeight).toBeCloseTo(16)
  expect(saved.levels['1'].stars).toBeGreaterThanOrEqual(1)
  await page.screenshot({ path: 'test-results/victory-modal.png' })
  await page.keyboard.press('Enter')
  const defeat = await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    let s = game.scene.getScene('Game')
    while (!s.sys.isActive() || s.coronation.level !== 2) { await new Promise(requestAnimationFrame); s = game.scene.getScene('Game') }
    s.lost = 10
    await new Promise(resolve => setTimeout(resolve, 200))
    return { level: s.coronation.level, gameOver: s.gameOver, reason: s.defeatReason }
  })
  expect(defeat).toEqual({ level: 2, gameOver: true, reason: 'collapse' })
  await page.screenshot({ path: 'test-results/defeat-modal.png' })
  expect(errors).toEqual([])
})
