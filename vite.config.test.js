import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { cspContent, pwaManifest, pwaOptions } from './vite.config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const indexHtml = readFileSync(path.join(__dirname, 'index.html'), 'utf-8')

describe('vite-plugin-pwa configuration', () => {
  it('sets the manifest fields required by spec §9', () => {
    expect(pwaManifest.name).toBe('Eclipse Timer — Ólafsvík 2026')
    expect(pwaManifest.short_name).toBe('Eclipse')
    expect(pwaManifest.display).toBe('standalone')
    expect(pwaManifest.orientation).toBe('any')
    expect(pwaManifest.background_color).toBe('#000000')
    expect(pwaManifest.theme_color).toBe('#000000')
  })

  it('declares icons at 192, 512, and a 512 maskable', () => {
    expect(pwaManifest.icons).toEqual([
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ])
  })

  it('registers with autoUpdate and an explicit sw.js filename', () => {
    expect(pwaOptions.registerType).toBe('autoUpdate')
    expect(pwaOptions.filename).toBe('sw.js')
  })

  it('leaves injectRegister unset (the plugin default), not explicitly false', () => {
    // Left at 'auto' deliberately. vite-plugin-pwa detects main.jsx's own
    // virtual:pwa-register import and self-suppresses its bare fallback
    // registration script either way — but it ALSO only auto-enables the
    // workbox skipWaiting/clientsClaim options this fix depends on (so a new
    // service worker actually takes over instead of parking in "waiting")
    // when injectRegister resolves to 'auto' or null, never the literal
    // `false`. Setting it to `false` here would silently break that.
    expect(pwaOptions.injectRegister).toBeUndefined()
  })

  it('precaches every static asset type with no runtime caching', () => {
    expect(pwaOptions.workbox.globPatterns).toEqual(['**/*.{js,css,html,svg,png,woff2}'])
    expect(pwaOptions.workbox.runtimeCaching).toBeUndefined()
  })
})

describe('build-time CSP', () => {
  it('locks down script/object/base-uri/form-action to same-origin only', () => {
    expect(cspContent).toContain("default-src 'self'")
    expect(cspContent).toContain("script-src 'self'")
    expect(cspContent).toContain("object-src 'none'")
    expect(cspContent).toContain("base-uri 'self'")
    expect(cspContent).toContain("form-action 'none'")
  })

  it('is injected only at build time, never in dev', async () => {
    const { default: config } = await import('./vite.config.js')
    const cspPlugin = config.plugins.find((p) => p.name === 'csp-meta')
    expect(cspPlugin.apply).toBe('build')
  })

  it('lands immediately after <meta charset>, ahead of every other head tag', async () => {
    const { default: config } = await import('./vite.config.js')
    const cspPlugin = config.plugins.find((p) => p.name === 'csp-meta')

    const output = cspPlugin.transformIndexHtml.handler(indexHtml)

    const charsetIndex = output.indexOf('<meta charset="UTF-8" />')
    const cspIndex = output.indexOf('Content-Security-Policy')
    const firstLinkIndex = output.indexOf('<link')

    expect(charsetIndex).toBeGreaterThanOrEqual(0)
    expect(cspIndex).toBeGreaterThan(charsetIndex)
    expect(cspIndex).toBeLessThan(firstLinkIndex)
    expect(output).toContain(cspContent)
  })

  it('throws rather than silently shipping without a policy if the charset marker is missing', async () => {
    const { default: config } = await import('./vite.config.js')
    const cspPlugin = config.plugins.find((p) => p.name === 'csp-meta')
    const htmlWithoutCharsetMarker = indexHtml.replace('<meta charset="UTF-8" />', '')

    expect(() => cspPlugin.transformIndexHtml.handler(htmlWithoutCharsetMarker)).toThrow(/csp-meta/)
  })
})
