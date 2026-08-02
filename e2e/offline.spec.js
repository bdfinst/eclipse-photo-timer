import { expect, test } from '@playwright/test'

// The fully-integrated counterpart to Slice 13's smoke.spec.js: that file
// deliberately stayed generic (PrepScreen/LiveScreen didn't exist yet at
// Slice 13's dependency depth) and said so in its own comment — "Slice 14
// asserts fully-featured content once every slice has landed." This is that
// slice. playwright.config.js's webServer already builds and serves the
// production preview, so this file only navigates and asserts.

const MANIFEST_TITLE = 'Eclipse Timer — Ólafsvík 2026'

// Copied from smoke.spec.js — see that file for the rationale on each
// listener (late console/page errors arrive after the load event because
// React's initial mount is scheduled, not synchronous).
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

test('full app — prep, GO LIVE, rehearsal, and live screen — functions offline after one online load', async ({
  page,
  context,
}) => {
  const errors = trackPageErrors(page)

  // Load online once first so the service worker installs and precaches
  // every asset the fully-integrated app needs (Slice 11's globPatterns
  // already covers js/css/html/svg/png/woff2 — no gap found here).
  await page.goto('/')
  await expect(page).toHaveTitle(MANIFEST_TITLE)
  await page.evaluate(() => navigator.serviceWorker.ready)

  await context.setOffline(true)
  await page.reload()

  // --- Prep screen renders fully, offline ---
  await expect(page).toHaveTitle(MANIFEST_TITLE)
  await expect(page.getByRole('heading', { name: 'Eclipse Timer' })).toBeVisible()
  await expect(page.getByText(/^T− \d+:\d{2}:\d{2}$/)).toBeVisible()
  const goLiveButton = page.getByRole('button', { name: 'GO LIVE →' })
  await expect(goLiveButton).toBeVisible()
  // Setup status block rendered on the home view (one row per checklist
  // group — the checklist itself now lives behind the hamburger menu).
  await expect(page.getByText('The night before')).toBeVisible()
  // Confirm this reload was actually served by the service worker rather
  // than an HTTP cache silently satisfying it (same rationale as
  // smoke.spec.js — navigator.onLine isn't a reliable signal here).
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

  // --- Rehearsal mode can be toggled while offline, and shows the banner ---
  // The rehearsal section now lives behind the hamburger menu.
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Rehearsal', exact: true }).click()
  const rehearsalToggle = page.getByLabel('Rehearsal mode')
  await rehearsalToggle.check()
  await expect(page.getByText('REHEARSAL — NOT LIVE')).toBeVisible()

  // Pins the virtual clock to a known instant (rather than un-checking back
  // to the real wall clock) so every assertion below is genuinely
  // deterministic — FILTER ON/OFF and the next-action text both depend on
  // "now", so leaving this on the real clock would make the test start
  // failing on/after 12 August 2026 (the actual eclipse date), and fail
  // outright once real "now" passes C4 (NextAction renders nothing with no
  // next event). "C1 −2 min" lands exactly on the 'arm' event's own
  // timestamp (src/data/timeline.js) — filterOn: true, next event 'c1'.
  await page.getByRole('button', { name: 'C1 −2 min' }).click()

  // GO LIVE lives on the home view only — return there from the rehearsal
  // section before tapping it.
  await page.getByRole('button', { name: '← Home' }).click()

  // --- GO LIVE navigates to the live screen, still offline ---
  // unlockAudio() (App.jsx's handleGoLive) runs synchronously off this
  // click, a real user gesture under Playwright. Real Chromium has both
  // AudioContext and speechSynthesis available, so this exercises
  // unlockAudio()'s *success* path — the failure-chip path is covered
  // separately below, by actually removing those browser APIs.
  await goLiveButton.click()

  // Rehearsal is still pinned, so both the banner and the timeline state
  // are exactly what the 'arm' instant produces — deterministic, not
  // "whatever the real clock happens to be right now".
  await expect(page.getByText('REHEARSAL — NOT LIVE')).toBeVisible()
  // Scoped to live-content and exact-matched, not a bare page-wide
  // substring match — event details containing "Filter on" text exist
  // elsewhere in the timeline data and would otherwise risk ambiguity.
  await expect(
    page.getByTestId('live-content').getByText('FILTER ON', { exact: true }),
  ).toBeVisible()
  // Scoped to live-content, not a bare page-wide match — every EventCard's
  // own timestamp span (EventCard.jsx) also matches HH:MM:SS and would
  // otherwise make this locator ambiguous (Playwright strict mode).
  await expect(page.getByTestId('live-content').getByText(/^\d{2}:\d{2}:\d{2}/)).toBeVisible()
  await expect(page.getByTestId('next-action')).toContainText('First contact — start the timer')
  await expect(page.getByTestId('event-list')).toBeVisible()
  // The tap-to-enable overlay only shows when no unlock gesture has
  // happened yet (audioStatus === 'pending') — GO LIVE already performed
  // one, successful or not, so it must never appear here.
  await expect(page.getByRole('dialog', { name: 'Enable audio' })).toHaveCount(0)

  // expect.poll only dwells until its FIRST passing check — with `errors`
  // already empty, it would return immediately and provide no window to
  // catch a late console/page error or a failed request for a precache
  // gap (the exact risk the comment on trackPageErrors warns about). A
  // short settle delay first gives any in-flight async work (a tick from
  // useAnnouncements, a late service-worker event) a chance to surface.
  await page.waitForTimeout(1000)
  expect(errors).toEqual([])
})

test('shows the persistent audio-unlock-failure warning chip when GO LIVE cannot unlock audio, while offline', async ({
  page,
  context,
}) => {
  const errors = trackPageErrors(page)

  // Removes the browser APIs unlockAudio() depends on before any page
  // script runs, on every document (including the offline reload below) —
  // so services/audio.js's own feature-detection takes the real,
  // deterministic failure path. This is a genuine unlock failure, not a
  // mock of the app's own audio module.
  await page.addInitScript(() => {
    delete window.AudioContext
    delete window.webkitAudioContext
    delete window.speechSynthesis
  })

  await page.goto('/')
  await expect(page).toHaveTitle(MANIFEST_TITLE)
  await page.evaluate(() => navigator.serviceWorker.ready)

  await context.setOffline(true)
  await page.reload()

  await page.getByRole('button', { name: 'GO LIVE →' }).click()

  await expect(page.getByText(/audio confirmation could not be verified/i)).toBeVisible()
  // The overlay is for a DIRECT load on the live screen with no prior
  // gesture — GO LIVE already performed one (unsuccessfully), so it must
  // not additionally prompt the operator to tap again.
  await expect(page.getByRole('dialog', { name: 'Enable audio' })).toHaveCount(0)

  await page.waitForTimeout(1000)
  expect(errors).toEqual([])
})
