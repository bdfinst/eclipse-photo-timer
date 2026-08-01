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
  // expect.poll retries: page errors/failed requests can arrive after the
  // load event (React's initial mount is scheduled, not synchronous), so a
  // plain array snapshot here could miss late events.
  await expect.poll(() => errors).toEqual([])
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
  await expect.poll(() => errors).toEqual([])
})
