import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

// Exercise built files through an itch-like iframe at a nested URL.
const root = resolve('dist')
const prefix = '/games/castledown/'
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  if (path === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end(`<style>body{margin:0;background:#090f16;display:grid;place-items:center;height:100vh}iframe{border:0}</style><iframe title="Castledown" src="${prefix}index.html" width="390" height="844"></iframe>`)
    return
  }
  if (!path.startsWith(prefix)) { res.writeHead(404).end(); return }
  const file = resolve(root, decodeURIComponent(path.slice(prefix.length)))
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return }
  try {
    const content = await readFile(file)
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(content)
  } catch { res.writeHead(404).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let browser
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge' })
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 } })
  const errors = [], failedAssets = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (response.status() >= 400 && response.url().includes(prefix)) failedAssets.push(response.url()) })
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  const frame = page.frameLocator('iframe')
  await frame.locator('canvas').waitFor({ state: 'visible' })
  await page.waitForTimeout(800)
  assert.deepEqual(await frame.locator('canvas').evaluate(canvas => [canvas.width, canvas.height]), [720, 1280])
  await frame.locator('canvas').click({ position: { x: 195, y: 325 } })
  await page.keyboard.press('Space')
  await page.waitForTimeout(2000)
  assert.deepEqual(errors, [], 'Production runtime errors')
  assert.deepEqual(failedAssets, [], 'Nested asset paths must load')
  await mkdir('artifacts', { recursive: true })
  await page.screenshot({ path: 'artifacts/production-iframe.png' })
  console.log('Production iframe passed: nested relative assets, 720x1280 canvas, no runtime errors.')
} finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
}
