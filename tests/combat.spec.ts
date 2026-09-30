import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function ready(page: Page) {
  await page.goto('/')
  await page.waitForFunction(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    return game.scene.getScene('Game')?.crane !== undefined
  })
}

test('locked throne rejects both pointer and keyboard selection', async ({ page }) => {
  await ready(page)
  await page.keyboard.press('4')
  await page.mouse.click(620, 1100)
  expect(await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    const s = game.scene.getScene('Game')
    return { selected: s.crane.type, unlocked: s.kingUnlocked }
  })).toEqual({ selected: 'stone', unlocked: false })
})

test('stable-only reload, air priority, projectile damage, and cannon area damage', async ({ page }) => {
  await ready(page)
  const result = await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    const blockPath = '/src/entities/CastleBlock.ts', combatPath = '/src/systems/CombatSystem.ts'
    const enemyPath = '/src/entities/Enemy.ts', projectilePath = '/src/entities/Projectile.ts'
    const { CastleBlock } = await import(blockPath), { CombatSystem } = await import(combatPath)
    const { Enemy } = await import(enemyPath), { segmentHit } = await import(projectilePath)
    game.loop.sleep()
    const s = game.scene.getScene('Game'), combat = new CombatSystem(s)
    const archer = new CastleBlock(s, 'archer', 360, 700, 0)
    const air = new Enemy(s, 'gargoyle', -1, 700); air.x = 650
    const ram = new Enemy(s, 'ram', 1, 1120); ram.x = 250; ram.y = 700
    for (const state of ['FALLING', 'SETTLING', 'UNSTABLE']) {
      archer.stability.state = state; combat.update(5000, [archer], [ram, air])
    }
    const blockedShots = combat.shotsFired
    archer.stability.state = 'STABLE'
    combat.update(1, [archer], [ram, air])
    const aimedRight = combat.projectiles[0].vx > 0
    for (let i = 0; i < 25; i++) combat.update(1000 / 60, [], [air])
    const airHp = air.hp, ramHp = ram.hp
    archer.stability.state = 'UNSTABLE'
    const reloadBefore = archer.reloadMs
    combat.update(2000, [archer], [air])
    const frozenReload = archer.reloadMs === reloadBefore
    archer.stability.state = 'STABLE'
    combat.update(1199, [archer], [air])
    const beforeCooldown = combat.shotsFired
    combat.update(1, [archer], [air])
    const afterCooldown = combat.shotsFired
    combat.destroy()
    const artillery = new CombatSystem(s), cannon = new CastleBlock(s, 'cannon', 360, 750, 0)
    cannon.stability.state = 'STABLE'
    const ram1 = new Enemy(s, 'ram', -1, 1120), ram2 = new Enemy(s, 'ram', 1, 1120)
    ram1.x = 100; ram2.x = 155
    artillery.update(1, [cannon], [ram1, ram2])
    const initialUpward = artillery.projectiles[0].vy < 0
    for (let i = 0; i < 240; i++) artillery.update(1000 / 60, [], [ram1, ram2])
    const aoe = [ram1.hp, ram2.hp]
    return { blockedShots, aimedRight, airHp, ramHp, frozenReload, beforeCooldown, afterCooldown, initialUpward, aoe,
      swept: segmentHit(0, 0, 1000, 0, 500, 0, 23) !== null }
  })
  expect(result).toEqual({ blockedShots: 0, aimedRight: true, airHp: 12, ramHp: 120, frozenReload: true,
    beforeCooldown: 1, afterCooldown: 2, initialUpward: true, aoe: [50, 50], swept: true })
})

test('gargoyle swoops and ram impacts apply force and disable weapons immediately', async ({ page }) => {
  await ready(page)
  const result = await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    const blockPath = '/src/entities/CastleBlock.ts', enemyPath = '/src/entities/Enemy.ts'
    const { CastleBlock } = await import(blockPath), { Enemy } = await import(enemyPath)
    game.loop.sleep()
    const s = game.scene.getScene('Game')
    const stone = new CastleBlock(s, 'stone', 360, 1075, 0)
    stone.stability.hasLanded = true; stone.stability.state = 'STABLE'
    const ram = new Enemy(s, 'ram', -1, 1120); ram.x = stone.body.bounds.min.x - 39
    ram.update(16, [stone], false)
    const ramHit = { hp: stone.hp, force: stone.body.force.x > 0, state: stone.stability.state }
    const tower = new CastleBlock(s, 'archer', 360, 650, 0)
    tower.stability.hasLanded = true; tower.stability.state = 'UNSTABLE'
    const gargoyle = new Enemy(s, 'gargoyle', 1, 420)
    for (let i = 0; i < 300 && tower.hp === tower.maxHp; i++) gargoyle.update(1000 / 60, [stone, tower], false)
    return { ramHit, airHit: { hp: tower.hp, force: tower.body.force.x < 0, state: tower.stability.state } }
  })
  expect(result.ramHit).toEqual({ hp: 282, force: true, state: 'SETTLING' })
  expect(result.airHit).toEqual({ hp: 150, force: true, state: 'SETTLING' })
})

test('milestones spawn once; final swarm is one-shot and kills are counted once', async ({ page }) => {
  await ready(page)
  const result = await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    game.loop.sleep()
    const s = game.scene.getScene('Game'), waves = s.waves
    waves.update(600, 20, [], false)
    const initial = waves.enemies.length
    waves.update(600, 8, [], false); waves.update(600, 20, [], false)
    const repeated = waves.enemies.length
    waves.triggerSwarm(); waves.triggerSwarm()
    waves.update(2000, 20, [], true)
    const final = waves.enemies.length
    waves.enemies[0].damage(100); waves.removeDefeated(); waves.removeDefeated()
    return { initial, repeated, final, kills: waves.kills }
  })
  expect(result).toEqual({ initial: 4, repeated: 4, final: 8, kills: 1 })
})

test('coronation victory, paused clock, and next-level cleanup through the UI', async ({ page }) => {
  await ready(page)
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    const blockPath = '/src/entities/CastleBlock.ts', { CastleBlock } = await import(blockPath)
    const s = game.scene.getScene('Game')
    // A broad physical support isolates the victory loop from tower balancing.
    s.matter.add.rectangle(360, 655, 450, 30, { isStatic: true })
    const support = new CastleBlock(s, 'stone', 360, 595, 0)
    const king = new CastleBlock(s, 'king', 360, 490, 0)
    s.blocks.push(support, king); s.kingPlaced = true; s.placed = 2
    s.waves.milestone = 1
  })
  await expect.poll(async () => page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    return game.scene.getScene('Game').coronation.started
  })).toBe(true)
  await page.keyboard.press('h')
  const remaining = await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    return game.scene.getScene('Game').coronation.remainingMs
  })
  await page.waitForTimeout(250)
  expect(await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    return game.scene.getScene('Game').coronation.remainingMs
  })).toBe(remaining)
  await page.keyboard.press('Escape')
  await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    // Leave the already-spawned swarm alive; finish the countdown before its approach.
    game.scene.getScene('Game').coronation.remainingMs = 100
  })
  await expect.poll(async () => page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    return game.scene.getScene('Game').coronation.result
  })).toBe('victory')
  await page.screenshot({ path: 'test-results/victory.png' })
  await page.mouse.click(360, 773)
  await expect.poll(async () => page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    const s = game.scene.getScene('Game')
    return { level: s.coronation.level, target: s.coronation.targetHeight, placed: s.placed, unlocked: s.kingUnlocked, enemies: s.waves.enemies.length, shots: s.combat.projectiles.length }
  })).toEqual({ level: 2, target: 20, placed: 0, unlocked: false, enemies: 0, shots: 0 })
  expect(errors).toEqual([])
})

test('a player can build, unlock, and defend a crown for the full ten seconds', async ({ page }) => {
  test.setTimeout(70_000)
  await ready(page)
  const snapshot = () => page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    const s = game.scene.getScene('Game')
    return { states: s.blocks.map((b: { stability: { state: string } }) => b.stability.state), unlocked: s.kingUnlocked,
      motion: s.blocks.map((b: { hp: number; body: { velocity: { x: number; y: number }; angularVelocity: number }; stability: { settledMs: number; tilt: number }; touching: boolean }) => ({ hp: b.hp, velocity: b.body.velocity, spin: b.body.angularVelocity, settled: b.stability.settledMs, tilt: b.stability.tilt, touching: b.touching })),
      started: s.coronation.started, result: s.coronation.result, remaining: s.coronation.remainingMs, kills: s.waves.kills }
  })
  // Independent side towers stay steady while the central stone keep takes hits.
  // A cannon above four stones reaches 15.3m and supports the crown below 20m,
  // avoiding an optional extra height wave while defending the base from rams.
  const plan = [
    { key: '2', x: 200 }, { key: '2', x: 520 },
    ...Array.from({ length: 4 }, () => ({ key: '1', x: 360 })),
    { key: '3', x: 360 },
  ]
  for (const [index, { key, x }] of plan.entries()) {
    await page.keyboard.press(key)
    await page.mouse.click(x, 650)
    await expect.poll(async () => page.evaluate(async target => {
      const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
      return Math.abs(game.scene.getScene('Game').crane.x - target)
    }, x)).toBeLessThan(.1)
    await page.keyboard.press('Space')
    await expect.poll(async () => (await snapshot()).states[index], { timeout: 8000 }).toBe('STABLE')
  }
  expect((await snapshot()).unlocked).toBe(true)
  await page.screenshot({ path: 'test-results/crown-ready.png' })
  await page.keyboard.press('4')
  await page.keyboard.press('Space')
  await expect.poll(async () => (await snapshot()).started, { timeout: 8000 }).toBe(true)
  await page.screenshot({ path: 'test-results/coronation.png' })
  try {
    await expect.poll(async () => (await snapshot()).result, { timeout: 35_000 }).toBe('victory')
  } catch (error) {
    console.log('Coronation diagnostics:', JSON.stringify(await snapshot()))
    throw error
  }
  expect((await snapshot()).kills).toBeGreaterThan(0)
  expect((await snapshot()).remaining).toBe(0)
  await page.screenshot({ path: 'test-results/crowned-gameplay.png' })
})
