import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'demo/demo-room.jpg', 'demo/demo-fixture.jpg'],
      manifest: {
        id: './',
        name: 'FlatStamp — Rental Condition Record',
        short_name: 'FlatStamp',
        description: 'Private, offline-first move-in and move-out condition records for renters.',
        theme_color: '#0b6f67',
        background_color: '#f4f7f6',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,webmanifest}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/demo\//,
            handler: 'CacheFirst',
            options: { cacheName: 'flatstamp-demo', expiration: { maxEntries: 10 } }
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2020',
    sourcemap: false
  }
});
