import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const runtimeErrors = new WeakMap<Page, string[]>()

// Read scene state from the real app module; all gameplay actions use the UI.
async function state(page: Page) {
  return page.evaluate(async () => {
    // Reuse Vite's exact entry URL, including its HMR timestamp, to avoid booting twice.
    const path = Array.from(document.scripts).find(script => script.src.includes('/src/main.ts'))!.src
    const { game } = await import(/* @vite-ignore */ path)
    let scene = game.scene.getScene('Game')
    while (!scene?.sys.isActive() || !scene.crane || !scene.cameras.main) {
      await new Promise(requestAnimationFrame)
      scene = game.scene.getScene('Game')
    }
    return {
      placed: scene.placed, lost: scene.lost, height: scene.height, paused: scene.paused,
      gameOver: scene.gameOver, ready: scene.ready, selected: scene.crane.type, angle: scene.crane.angle,
      craneX: scene.crane.x,
      cameraY: scene.cameras.main?.scrollY, bodies: scene.matter.world.getAllBodies().length,
      blocks: scene.blocks.map((b: { type: string; stability: { state: string }; body: { mass: number; parts: unknown[] } }) => ({ type: b.type, state: b.stability.state, mass: b.body.mass, parts: b.body.parts.length })),
    }
  })
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
  await expect.poll(async () => (await state(page)).ready).toBe(true)
})

test.afterEach(async ({ page }) => { expect(runtimeErrors.get(page)).toEqual([]) })

test('pointer drop settles with correct mass; selection and rotation work', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.screenshot({ path: 'test-results/initial.png' })
  await page.mouse.click(442, 1236)
  await expect.poll(async () => (await state(page)).blocks[0]?.state).toBe('STABLE')
  expect((await state(page)).blocks[0]?.mass).toBeCloseTo(12)
  expect((await state(page)).height).toBeGreaterThan(2.9)
  await page.mouse.click(275, 1100)
  expect((await state(page)).selected).toBe('archer')
  await page.mouse.click(105, 1236)
  await expect.poll(async () => (await state(page)).angle).toBeCloseTo(Math.PI / 2)
  await page.keyboard.press('Space')
  await expect.poll(async () => (await state(page)).blocks[1]?.state).toBe('STABLE')
  expect((await state(page)).height).toBeGreaterThan(6)
  await page.screenshot({ path: 'test-results/stack.png' })
  expect(errors).toEqual([])
})

test('camera rises with a tall stack and reset fully cleans physics', async ({ page }) => {
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Space')
    await expect.poll(async () => (await state(page)).blocks[i]?.state).toBe('STABLE')
  }
  await expect.poll(async () => (await state(page)).cameraY).toBeLessThan(0)
  expect((await state(page)).height).toBeGreaterThan(17)
  await page.screenshot({ path: 'test-results/tall-stack.png' })
  await page.mouse.click(660, 55)
  expect((await state(page)).paused).toBe(true)
  await page.mouse.click(360, 760)
  await expect.poll(async () => (await state(page)).placed).toBe(0)
  expect((await state(page)).bodies).toBe(1)
})

test('throne on bare bedrock ends the run and retry works', async ({ page }) => {
  // The milestone was reached earlier, but the old castle has fallen away.
  await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    game.scene.getScene('Game').coronation.unlocked = true
  })
  await page.keyboard.press('4')
  await page.keyboard.press('Space')
  await expect.poll(async () => (await state(page)).gameOver).toBe(true)
  await page.screenshot({ path: 'test-results/defeat.png' })
  await page.mouse.click(360, 865)
  await expect.poll(async () => (await state(page)).placed).toBe(0)
  expect((await state(page)).gameOver).toBe(false)
})

test('balcony uses a compound collider; help pauses and resumes', async ({ page }) => {
  await page.keyboard.press('3')
  await page.keyboard.press('Space')
  await expect.poll(async () => (await state(page)).blocks[0]?.state).toBe('STABLE')
  expect((await state(page)).blocks[0]?.parts).toBe(3)
  expect((await state(page)).blocks[0]?.mass).toBeCloseTo(10)
  await page.keyboard.press('h')
  expect((await state(page)).paused).toBe(true)
  await page.screenshot({ path: 'test-results/help.png' })
  await page.keyboard.press('Space')
  expect((await state(page)).placed).toBe(1)
  await page.keyboard.press('Escape')
  expect((await state(page)).paused).toBe(false)
})

test('mobile touch can aim, choose a room, and drop', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await context.newPage()
  await page.goto('/')
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect.poll(async () => (await state(page)).ready).toBe(true)
  const box = (await canvas.boundingBox())!
  const tap = async (x: number, y: number) => page.touchscreen.tap(box.x + x * box.width / 720, box.y + y * box.height / 1280)
  await tap(350, 650)
  await tap(275, 1100)
  expect((await state(page)).selected).toBe('archer')
  await tap(445, 1236)
  await expect.poll(async () => (await state(page)).blocks[0]?.state).toBe('STABLE')
  await page.screenshot({ path: 'test-results/mobile.png' })
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  await context.close()
})

test('an aimed miss falls into the abyss and frees the next drop', async ({ page }) => {
  await page.keyboard.press('2')
  await page.mouse.move(360, 650)
  await page.mouse.down()
  await page.mouse.move(10, 650, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await state(page)).craneX).toBeLessThan(65)
  await page.keyboard.press('Space')
  await expect.poll(async () => (await state(page)).lost).toBe(1)
  expect((await state(page)).ready).toBe(true)
  expect((await state(page)).bodies).toBe(1)
})

test('a supported throne survives and cannot be placed twice', async ({ page }) => {
  await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    game.scene.getScene('Game').coronation.unlocked = true
  })
  await page.keyboard.press('Space')
  await expect.poll(async () => (await state(page)).blocks[0]?.state).toBe('STABLE')
  await page.keyboard.press('4')
  await page.keyboard.press('Space')
  await expect.poll(async () => (await state(page)).blocks[1]?.state).toBe('STABLE')
  expect((await state(page)).gameOver).toBe(false)
  await page.keyboard.press('4')
  expect((await state(page)).selected).toBe('stone')
})
