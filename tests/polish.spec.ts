import { expect, test } from '@playwright/test'
import { CUE_DURATIONS, SAMPLE_RATE, synthesize } from '../src/systems/audioSynth'

test('all synthesized cues contain finite, bounded audio with quiet edges', () => {
  for (const cue of Object.keys(CUE_DURATIONS) as (keyof typeof CUE_DURATIONS)[]) {
    const samples = synthesize(cue)
    expect(samples.length).toBe(Math.ceil(CUE_DURATIONS[cue] * SAMPLE_RATE))
    expect(samples.every(value => Number.isFinite(value) && Math.abs(value) < 1)).toBe(true)
    expect(samples.reduce((sum, value) => sum + value * value, 0) / samples.length).toBeGreaterThan(.0001)
    expect(samples[0]).toBe(0)
    expect(Math.abs(samples.at(-1)!)).toBeLessThan(.001)
  }
})

test('first gesture unlocks audible output; mute persists and restart releases voices and effects', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.locator('canvas').waitFor()
  await page.mouse.click(360, 650)
  await expect.poll(async () => page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    return game.sound.context.state === 'running' && !game.sound.locked
  })).toBe(true)
  const output = await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    const s = game.scene.getScene('Game'), analyser = game.sound.context.createAnalyser()
    game.sound.masterVolumeNode.connect(analyser)
    const played = s.audio.play('crown')
    await new Promise(resolve => setTimeout(resolve, 120))
    const samples = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(samples)
    game.sound.masterVolumeNode.disconnect(analyser)
    s.events.emit('cannonExploded', 360, 750)
    return { played, peak: Math.max(...samples.map(Math.abs)), voices: game.sound.sounds.length,
      particles: s.effects.activeParticles, shaking: s.cameras.main.shakeEffect.isRunning }
  })
  expect(output.played).toBe(true)
  expect(output.peak).toBeGreaterThan(.001)
  expect(output.particles).toBeGreaterThan(0)
  expect(output.shaking).toBe(true)
  await page.keyboard.press('m')
  expect(await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    return { gain: game.sound.masterMuteNode.gain.value, playing: game.sound.sounds.some((s: { isPlaying: boolean }) => s.isPlaying),
      saved: localStorage.getItem('castledown-muted'), accepted: game.scene.getScene('Game').audio.play('cannon') }
  })).toEqual({ gain: 0, playing: false, saved: 'true', accepted: false })
  await page.mouse.click(660, 55)
  await expect.poll(async () => page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    const s = game.scene.getScene('Game')
    return { voices: game.sound.sounds.length, particles: s.effects.activeParticles, muted: s.audio.muted,
      listeners: s.events.listenerCount('weaponFired') }
  })).toEqual({ voices: output.voices, particles: 0, muted: true, listeners: 1 })
  await page.mouse.click(530, 55)
  expect(await page.evaluate(() => localStorage.getItem('castledown-muted'))).toBe('false')
  await page.keyboard.press('h')
  expect(await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    return game.sound.sounds.every((s: { isPlaying: boolean }) => !s.isPlaying)
  })).toBe(true)
  expect(errors).toEqual([])
})

test('reduced motion suppresses shake and cosmetic particles stay bounded and expire', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('canvas').waitFor()
  const result = await page.evaluate(async () => {
    const { game } = await import(Array.from(document.scripts).find(s => s.src.includes('/src/main.ts'))!.src)
    game.loop.sleep()
    const s = game.scene.getScene('Game'), effects = s.effects
    for (let i = 0; i < 100; i++) s.events.emit('cannonExploded', 360, 750)
    const peak = effects.activeParticles, shaking = s.cameras.main.shakeEffect.isRunning
    for (let i = 0; i < 40; i++) effects.update(50)
    return { reduced: effects.reducedMotion, peak, shaking, remaining: effects.activeParticles }
  })
  expect(result).toEqual({ reduced: true, peak: 240, shaking: false, remaining: 0 })
})
