# eclipse-photo-timer

A progressive web app for timing camera actions during the 12 August 2026
total solar eclipse in Ólafsvík, Iceland. It runs the operator's full shot
list — timer arm/handover, filter on/off, bracket bursts, totality — against
a live countdown, and is built to run fully offline once loaded, since there
is no guarantee of a signal at the site on the day.

**Stack**: React 19 (JS, not TS) + Vite 8, Tailwind CSS v4, `vite-plugin-pwa`,
Vitest, Playwright (e2e), Husky + lint-staged.

Live deployment: <https://eclipse-photo-timer.netlify.app/>

## Commands

- `npm run dev` — dev server
- `npm run build` / `npm run preview` — production build / preview
- `npm test` / `npm run test:watch` / `npm run test:coverage` — Vitest
- `npm run test:e2e` — Playwright
- `npm run lint` / `npm run lint:fix` — oxlint (fast, day-to-day)
- `npm run lint:deep` — full ESLint pass (React hooks/refresh rules)
- `npm run format` / `npm run format:check` — Prettier

## Manual verification

Everything below is a physical or execution-environment-dependent check that
cannot be (fully) automated. `npm run test:e2e` (`e2e/offline.spec.js`) is the
automatable proxy for the offline/install criterion, not a replacement for
the on-device check — do all of these before travelling to the site.

### Lighthouse PWA audit

**Automated result from this session**: `npx lighthouse http://localhost:4173
--output=json --chrome-flags="--headless --no-sandbox" --preset=desktop`
against a local `npm run build && npm run preview` ran successfully
(Lighthouse v13.4.1) and scored Performance 1.00, Accessibility 0.98,
Best Practices 1.00, SEO 0.82. **It could not produce an installability or
offline verdict**: Lighthouse removed the "PWA" category entirely as of
v10+, and by v13.4.1 none of the individual audits that category used to
run (`installable-manifest`, `service-worker`, `works-offline`,
`maskable-icon`, `viewport`, `splash-screen`) are present in the report at
all — not scored, not flagged, simply absent from `audits`. This is a
Lighthouse-version limitation, not a failure of this app's service worker
(exercised directly by `e2e/offline.spec.js`, which passes) — the web
manifest itself isn't separately fetched/validated by that test, so use one
of the fallbacks below for an actual manifest/installability check.

To re-run the automated part yourself:

```sh
npm run build && npm run preview
npx lighthouse http://localhost:4173 --view
```

To actually get an installability/offline verdict, use one of these instead:

- Chrome DevTools → **Application** panel → **Manifest** (checks the web
  manifest is valid and installable) and **Service Workers** (confirms the
  worker is activated and controlling the page) — open these against the
  `npm run preview` URL or the deployed Netlify URL.
- An older Lighthouse release (`npx lighthouse@9 ... --only-categories=pwa`)
  if you need the numeric PWA score specifically — v9 is the last release
  with a scored "pwa" category.
- [PWABuilder](https://www.pwabuilder.com/) — paste the deployed URL for an
  independent installability report.

### Netlify deployment — confirm the latest build is live

The Netlify site (`eclipse-photo-timer`) already has git integration wired to
`main` — there is no manual deploy step, only a verification step after a
push:

1. Note the commit hash just pushed to `main` (`git log -1 --format=%H`).
2. Open the Netlify dashboard → **Deploys** for this site, and confirm the
   most recent **Published** deploy's commit hash matches, and its status is
   green (not "Failed"/"Building"). The deploy log also shows the build
   command output if anything needs debugging.
3. Load <https://eclipse-photo-timer.netlify.app/> and check DevTools →
   Application → Service Workers shows a controlling worker for `/sw.js` —
   confirms the new build's precache actually took over, not just that the
   HTML shell updated.

### Filter-banner daylight legibility

View the live screen outdoors, in direct daylight, at arm's length (the
distance the phone will actually be from your eyes while operating the
camera). Confirm the green "FILTER ON" / red "FILTER OFF — DO NOT LOOK"
banner is legible at a glance — this is the one state that must never be
missed or misread.

### On-device install + airplane-mode check

1. Install the app to a phone's home screen from
   <https://eclipse-photo-timer.netlify.app/> (the in-app banner prompts for
   this on first load).
2. Open the installed app once while still online, so its service worker and
   precache install.
3. Turn on Airplane Mode (not just Wi-Fi off — the actual radio-off state
   expected at the site).
4. Open the app from the home screen icon and confirm the prep screen loads,
   GO LIVE navigates to the live screen, and the timeline/countdown run
   normally, all fully offline.

This is the literal spec §14 criterion. `e2e/offline.spec.js` is the
automatable proxy for it (same one-online-load-then-offline shape, run
against desktop Chromium in CI) — it is not a substitute for actually doing
this on the device that will be used at the site.

### Screen-does-not-sleep

Leave the live screen open and the phone unattended for at least 10 minutes.
Confirm the display never sleeps or dims to lock — this is the WakeLock
behavior (`useWakeLock`); if it fails silently (WakeLock unsupported or
denied), the app shows an amber warning chip instead, telling you to set the
phone's own auto-lock to Never as a fallback.

### Audio check before travel

In Settings, tap **Test audio** in a quiet room and confirm it's clearly
audible at the phone's normal volume level — the "Audio ready" phrase and all
four tone cues. This is a final human check beyond the automated coverage of
`services/audio.js`, since actual audibility can't be asserted by a test.
