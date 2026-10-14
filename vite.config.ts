import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Base path per GitHub Pages o locale
const basePath = process.env.VITE_BASE_PATH || '/Sito-di-vault-attivit-clan/';

export default defineConfig({
  base: basePath,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      base: basePath,
      scope: basePath,
      includeAssets: [
        'favicon.png',
        'fonts/inter-latin.woff2',
        'fonts/inter-latin-ext.woff2',
      ],
      manifest: {
        name: 'Vault Clan — Duc In Altum',
        short_name: 'Vault Clan',
        description: 'Archivio condiviso di Giochi, Bans, Canti e Calendario per Clan Scout',
        theme_color: '#00BDFF',
        background_color: '#FAF6EC',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: basePath,
        start_url: `${basePath}#/`,
        lang: 'it',
        icons: [
          {
            src: `${basePath}icons/icon-192x192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${basePath}icons/icon-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `${basePath}icons/icon-maskable-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${basePath}index.html`,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
