import { expect, test } from '@playwright/test'

// Deliberately generic at this dependency depth (Slice 13 depends only on
// Slice 11 — PrepScreen doesn't exist yet). Slice 14 asserts fully-featured
// content once every slice has landed. playwright.config.js's webServer
// already builds and serves the production preview, so this file only
// navigates and asserts.

const MANIFEST_TITLE = 'Eclipse Timer — Ólafsvík 2026'

function trackPageErrors(page) {
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console error: ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`page error: ${err.message}`))
  page.on('requestfailed', (request) => {
    errors.push(`request failed: ${request.url()} (${request.failure()?.errorText})`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      errors.push(`bad response: ${response.status()} ${response.url()}`)
    }
  })

  return errors
}

test('production build boots online with no console or network errors', async ({ page }) => {
  const errors = trackPageErrors(page)

  await page.goto('/')

  await expect(page).toHaveTitle(MANIFEST_TITLE)
  // The title alone is satisfied by the static HTML shell — proving React
  // actually mounted needs a locator for content only the rendered app emits.
  await expect(page.getByRole('heading', { name: 'Eclipse Timer' })).toBeVisible()
  // Page errors/failed requests can arrive after the load event (React's
  // initial mount is scheduled, not synchronous) — expect.poll alone
  // doesn't help with that: it only dwells until its FIRST passing check,
  // so with `errors` already empty it returns immediately, same as a plain
  // snapshot. A short settle delay first gives late events a window to
  // actually surface before the check runs.
  await page.waitForTimeout(1000)
  expect(errors).toEqual([])
})

test('app still boots after one online load and then going offline', async ({ page, context }) => {
  const errors = trackPageErrors(page)

  // Load online first so the service worker installs and precaches assets.
  await page.goto('/')
  await expect(page).toHaveTitle(MANIFEST_TITLE)
  await page.evaluate(() => navigator.serviceWorker.ready)

  await context.setOffline(true)
  await page.reload()

  await expect(page).toHaveTitle(MANIFEST_TITLE)
  await expect(page.getByRole('heading', { name: 'Eclipse Timer' })).toBeVisible()
  // Confirm the reload was actually served by the service worker rather than
  // an HTTP cache silently satisfying it (navigator.onLine is not a reliable
  // signal here — Chromium doesn't consistently flip it under Playwright's
  // context.setOffline(true)).
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  await page.waitForTimeout(1000)
  expect(errors).toEqual([])
})

test('the generated service worker claims control immediately, without waiting for open tabs to close', async ({
  page,
}) => {
  // Outcome-level check, not just a config assertion (vite.config.test.js
  // asserts the INPUT — pwaOptions.injectRegister left at the plugin
  // default — but a vite-plugin-pwa upgrade could change the guard that
  // input relies on without that test noticing). skipWaiting + clientsClaim
  // are what let a newly-deployed service worker take over an already-open
  // tab immediately; without them a new deploy silently never reaches an
  // already-open tab or installed PWA instance until it's fully closed and
  // reopened — the exact bug this fix addresses.
  await page.goto('/')
  const { ok, swSource } = await page.evaluate(async () => {
    const response = await fetch('/sw.js')
    return { ok: response.ok, swSource: await response.text() }
  })

  expect(ok).toBe(true)
  // workbox-build's sw template (node_modules/workbox-build/build/templates/
  // sw-template.js) emits the literal substring "skipWaiting" in BOTH the
  // enabled branch (an unconditional `self.skipWaiting()` call) AND the
  // disabled one (a `message` listener that only calls `self.skipWaiting()`
  // in response to a "SKIP_WAITING" message) — so matching "skipWaiting"
  // alone can't tell them apart. "SKIP_WAITING" (the message-type string)
  // appears ONLY in the disabled branch, so its ABSENCE is what proves
  // skipWaiting runs unconditionally.
  expect(swSource).not.toMatch(/SKIP_WAITING/)
  expect(swSource).toMatch(/clientsClaim/)
})
