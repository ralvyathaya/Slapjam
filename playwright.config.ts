import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests', timeout: 30_000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 720, height: 1280 }, channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
})
