import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset URLs: itch.io serves games from a nested, versioned CDN path inside an iframe.
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    // Phaser alone is ~1.4 MB minified; that is expected and cached separately.
    chunkSizeWarningLimit: 1600,
    // Phaser is the engine-sized dependency; separate it for browser caching.
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }] } } },
  },
})
