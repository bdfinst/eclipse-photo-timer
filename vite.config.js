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
  background_color: '#05070d',
  theme_color: '#05070d',
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
  // main.jsx registers the service worker itself, via the virtual:pwa-register
  // module, so it can listen for an update actually taking over and reload
  // the page — the plugin's own auto-injected registration script has no such
  // listener. Left at the default `injectRegister: 'auto'` deliberately, NOT
  // set to `false` here: the plugin detects the virtual-module import itself
  // and self-suppresses its own script injection in that case (avoiding
  // double registration) — but ALSO only auto-enables the workbox
  // `skipWaiting`/`clientsClaim` options this whole fix depends on when
  // `injectRegister` resolves to `'auto'` or `null`, never when it's the
  // literal `false` (vite-plugin-pwa's own source, `dist/index.js`). Setting
  // `false` explicitly here would silently disable that and leave the new
  // service worker parked in "waiting" forever while a tab stays open —
  // reintroducing the exact bug this change fixes.
  // Documented default, set explicitly: Slice 12's netlify.toml hardcodes
  // a /sw.js no-cache header as an assumed contract with this filename.
  filename: 'sw.js',
  includeAssets: ['favicon.svg', 'icons/icon-192.png'],
  manifest: pwaManifest,
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
  },
}

// Exported for vite.config.test.js. Injected only at build time (see the
// csp-meta plugin below) — a strict script-src 'self' would block Vite's
// dev-mode Fast Refresh inline preamble script (@vitejs/plugin-react
// transformIndexHtml), breaking `npm run dev`. The production build only
// ever loads external, same-origin scripts/styles, so the strict policy is
// safe there. frame-ancestors is deliberately absent — not settable via a
// meta tag; Slice 12's netlify.toml headers own it instead.
export const cspContent =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'"

// Build-only CSP injection, placed immediately after <meta charset> so no
// earlier tag (favicon, apple-touch-icon) escapes the policy.
const CHARSET_TAG = '<meta charset="UTF-8" />'

const cspMetaPlugin = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => {
      const injected = html.replace(
        CHARSET_TAG,
        `${CHARSET_TAG}\n    <meta http-equiv="Content-Security-Policy" content="${cspContent}" />`,
      )
      if (injected === html) {
        throw new Error(
          `csp-meta: could not find ${CHARSET_TAG} in index.html — CSP was not injected`,
        )
      }
      return injected
    },
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA(pwaOptions), cspMetaPlugin],
})
