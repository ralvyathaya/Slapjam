import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    // Phaser is the engine-sized dependency; separate it for browser caching.
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }] } } },
  },
})
