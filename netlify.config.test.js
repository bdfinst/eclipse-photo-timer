import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const netlifyToml = readFileSync(path.join(__dirname, 'netlify.toml'), 'utf-8')
const nvmrc = readFileSync(path.join(__dirname, '.nvmrc'), 'utf-8')

// Binds a Cache-Control-style assertion to the specific [[headers]] block it
// belongs to, rather than an unanchored file-wide substring match — an
// unanchored match can't tell "/sw.js has no-cache" from "some other block,
// anywhere in the file, happens to contain this string" (correctness-review
// finding: the original version of this test stayed green even with the
// index.html-specific value deleted entirely).
function headersBlockFor(forPath) {
  const escaped = forPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = netlifyToml.match(
    new RegExp(`\\[\\[headers\\]\\]\\s*\\n\\s*for = "${escaped}"([\\s\\S]*?)(?=\\n\\[\\[|$)`),
  )
  if (!match) {
    throw new Error(`no [[headers]] block found for "${forPath}"`)
  }
  return match[1]
}

describe('netlify.toml', () => {
  it('carries no [build.environment] block or NODE_VERSION key', () => {
    expect(netlifyToml).not.toMatch(/\[build\.environment\]/)
    expect(netlifyToml).not.toMatch(/NODE_VERSION/)
  })

  it('builds with npm run build and publishes dist', () => {
    expect(netlifyToml).toMatch(/command\s*=\s*"npm run build"/)
    expect(netlifyToml).toMatch(/publish\s*=\s*"dist"/)
  })

  it('sets a no-cache, no-store header on sw.js specifically', () => {
    expect(headersBlockFor('/sw.js')).toMatch(
      /Cache-Control\s*=\s*"no-cache, no-store, must-revalidate"/,
    )
  })

  it('sets a no-cache header on index.html specifically', () => {
    expect(headersBlockFor('/index.html')).toMatch(/Cache-Control\s*=\s*"no-cache"/)
  })

  it('sets an immutable long-lived cache header on assets specifically', () => {
    expect(headersBlockFor('/assets/*')).toMatch(
      /Cache-Control\s*=\s*"public, max-age=31536000, immutable"/,
    )
  })

  it('sets global security headers, including frame-ancestors deferred from the build-time meta CSP', () => {
    const global = headersBlockFor('/*')
    expect(global).toMatch(/Content-Security-Policy/)
    expect(global).toMatch(/frame-ancestors 'none'/)
    expect(global).toMatch(/X-Content-Type-Options\s*=\s*"nosniff"/)
    expect(global).toMatch(/Referrer-Policy/)
    expect(global).toMatch(/Strict-Transport-Security/)
  })

  it('redirects everything to index.html for the SPA', () => {
    expect(netlifyToml).toMatch(/from\s*=\s*"\/\*"/)
    expect(netlifyToml).toMatch(/to\s*=\s*"\/index\.html"/)
    expect(netlifyToml).toMatch(/status\s*=\s*200/)
  })
})

describe('.nvmrc', () => {
  it('contains the Node version "22" as the single source of truth', () => {
    // Not "20" as spec §10's original NODE_VERSION suggested: @testing-library/jest-dom
    // (engines >=22) actually crashes the test suite under Node 20 (jsdom's
    // undici dependency throws "webidl.util.markAsUncloneable is not a
    // function") — confirmed by running the suite under Node 20 directly.
    // Node 22 still satisfies Vite 8's declared engines (^20.19.0 || >=22.12.0).
    expect(nvmrc.trim()).toBe('22')
  })
})
