import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Exported for vite.config.test.js — spec §9's manifest requirements, asserted
// directly rather than reverse-engineered from the built Workbox plugin.
export const pwaManifest = {
  name: 'Eclipse Timer — Ólafsvík 2026',
  short_name: 'Eclipse',
  display: 'standalone',
  orientation: 'any',
  background_color: '#000000',
  theme_color: '#000000',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: 'icons/icon-512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}

// Exported for vite.config.test.js — the service-worker filename is a
// documented contract with Slice 12's netlify.toml /sw.js header rule.
export const pwaOptions = {
  registerType: 'autoUpdate',
  // Documented default, set explicitly: Slice 12's netlify.toml hardcodes
  // a /sw.js no-cache header as an assumed contract with this filename.
  filename: 'sw.js',
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  manifest: pwaManifest,
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA(pwaOptions)],
})
