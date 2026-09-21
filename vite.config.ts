import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// `base` must match the GitHub Pages sub-path when deploying there.
const base = process.env.PUBLIC_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.svg', 'samples/*.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            // Background-removal model weights: large, immutable, cache forever.
            urlPattern: /^https:\/\/(staticimgly\.com|huggingface\.co|cdn-lfs.*\.hf\.co)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'charanim-models',
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'CharAnimation',
        short_name: 'CharAnim',
        description: 'Biến một ảnh tĩnh thành animation loop, chạy hoàn toàn trong trình duyệt.',
        lang: 'vi',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#0b0f14',
        theme_color: '#0b0f14',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'react';
          if (id.includes('node_modules/mediabunny')) return 'mediabunny';
          if (id.includes('node_modules/upng-js') || id.includes('node_modules/gifenc')) return 'imgcodecs';
        },
      },
    },
  },
});
