import { describe, expect, it } from 'vitest'
import { pwaManifest, pwaOptions } from './vite.config.js'

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

  it('precaches every static asset type with no runtime caching', () => {
    expect(pwaOptions.workbox.globPatterns).toEqual(['**/*.{js,css,html,svg,png,woff2}'])
    expect(pwaOptions.workbox.runtimeCaching).toBeUndefined()
  })
})
