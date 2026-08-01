# Eclipse Timer — Build Specification

A progressive web app for shooting the 12 August 2026 total solar eclipse from
Ólafsvík, Iceland. Two screens: a prep checklist and a live auto-scrolling timeline.
Deployed to Netlify. Must work with **no network at all** on eclipse day.

Build this exactly as specified. Where the spec is silent, prefer the simplest thing
that survives a cold, bright, one-handed morning on an Icelandic beach.

---

## 1. Context you need to understand

The operator is standing behind an OM System OM-1 on a tracking mount. He is looking
through a viewfinder, not at a phone. The phone sits on the tripod or in a pocket. He
has gloves on. There is one 2-minute window in the entire day that cannot be repeated,
and several actions inside it are ordered and time-critical to the second.

The app's job is to tell him *what to do next and when*, loudly enough that he never
has to look down.

Three failure modes matter more than any feature:

1. **The app is wrong about the time.** Contact times are second-accurate.
2. **The app needs the network.** There is no reliable signal on the Snæfellsnes coast.
3. **The screen sleeps.** A blank phone during totality is worse than no phone.

Design against those three first.

---

## 2. Stack

| Concern | Choice |
| --- | --- |
| Framework | React 18 + JS |
| Build | Vite |
| Styling | Tailwind CSS |
| PWA | `vite-plugin-pwa` (Workbox), `registerType: 'autoUpdate'` |
| State | React state + `localStorage`. No Redux, no server state library. |
| Routing | Two views toggled by state, or `react-router` with hash routing. No SSR. |
| Testing | Vitest for the time engine. |
| Host | Netlify |

No runtime network calls of any kind. No fonts from a CDN, no analytics, no icons
fetched at runtime. Everything ships in the bundle.

---

## 3. Time model

### 3.1 Rules

- **All event times are stored as absolute UTC ISO-8601 strings.** Iceland observes
  UTC year-round with no DST, so UTC *is* local time at the site. Display times as
  `HH:MM:SS` with no timezone conversion, ever. Do not use the device timezone.
- The app's notion of now is:

  ```ts
  now() = Date.now() + clockOffsetMs
  ```

  where `clockOffsetMs` is a user-set value in `localStorage`, default `0`.

- In rehearsal mode (§8), `now()` is driven by a virtual clock instead.
- Tick at **4 Hz** (250 ms) using `setInterval`. Recompute derived state from `now()`
  on each tick rather than accumulating — never trust interval drift.
- On `visibilitychange` back to visible, immediately recompute; do not assume timers
  fired while backgrounded.

### 3.2 Clock offset UI

On the prep screen, under Settings:

- Display the current device time to the second, large.
- A stepper: `−10s  −1s  [ +0s ]  +1s  +10s`, and a reset.
- Helper text: *"Check against time.is or a GPS clock while you still have signal.
  Positive offset means the app runs ahead of your phone."*
- Persist to `localStorage` under `eclipse.clockOffsetMs`.

---

## 4. Event data

This is the authoritative timeline. Transcribe it verbatim into
`src/data/timeline.ts`. Do not recompute or "improve" the times.

```ts
export type Phase = 'prep' | 'partial-1' | 'handover-in' | 'totality' | 'handover-out' | 'partial-2' | 'done'
export type Mode  = 'C1' | 'C2' | 'C3' | 'C4' | null

export interface TimelineEvent {
  id: string
  at: string           // absolute UTC ISO-8601
  phase: Phase
  mode: Mode           // camera custom mode chip, or null
  title: string        // imperative, short — this is what gets spoken
  detail?: string      // secondary line, not spoken
  critical: boolean    // drives styling, audio priority, and countdown targeting
  filterOn: boolean    // state of the solar filter AFTER this event
  speak?: string       // override for TTS if the title reads badly aloud
  leadSeconds?: number // announce this many seconds early (default 10 for critical, 0 otherwise)
}
```

### 4.1 Anchor times (Ólafsvík, 64.8945 N, 23.7108 W)

| Contact | UTC |
| --- | --- |
| C1 — first contact | 17:46:10 minus 59:10 → **16:47:00** |
| C2 — totality begins | **17:46:10** |
| C3 — totality ends | **17:48:13** |
| C4 — last contact | **18:47:00** |

Totality duration 2 m 03 s. Sun altitude 31° at C1, 25° at mid-totality, 19° at C4.

### 4.2 The timeline

```ts
export const EVENTS: TimelineEvent[] = [
  // ---------- setup ----------
  { id:'setup',      at:'2026-08-12T15:45:00Z', phase:'prep', mode:null, critical:false, filterOn:true,
    title:'Set up and polar align',
    detail:'Tripod level, GTi on solar rate in SynScan, payload balanced at the 250 zoom mark, camera-heavy.' },

  { id:'focus',      at:'2026-08-12T16:15:00Z', phase:'prep', mode:'C1', critical:false, filterOn:true,
    title:'Focus and lock',
    detail:'Filter on. Zoom 250. Focus a sunspot at 14× magnified live view, then Focus Ring Lock and tape the ring.' },

  { id:'dryrun',     at:'2026-08-12T16:30:00Z', phase:'prep', mode:'C2', critical:false, filterOn:true,
    title:'Dry run the totality bracket',
    detail:'Fire one C2 burst at the filtered sun. Confirm seven RAWs land, including the 1.3-second frame.' },

  { id:'power',      at:'2026-08-12T16:40:00Z', phase:'prep', mode:null, critical:false, filterOn:true,
    title:'Connect USB power',
    detail:'Camera off, plug in the ≥27 W PD bank, power on, confirm USBP on the display. Charged battery still in the body.' },

  { id:'arm',        at:'2026-08-12T16:45:00Z', phase:'prep', mode:'C1', critical:true, filterOn:true,
    title:'Arm the timer',
    detail:'JJC TM-J2: DELAY 0, LONG 1s, INTVL 4s, N = 826. Drive Single. Do not start yet.' },

  // ---------- ingress partials ----------
  { id:'c1',         at:'2026-08-12T16:47:00Z', phase:'partial-1', mode:'C1', critical:true, filterOn:true,
    title:'First contact — start the timer',
    speak:'First contact. Start the timer now.',
    detail:'826 frames at 4 seconds. Last frame 17:42:00. Hands off the rig from here.' },

  { id:'check-1',    at:'2026-08-12T17:00:00Z', phase:'partial-1', mode:null, critical:false, filterOn:true,
    title:'Quiet check',
    detail:'Frame count advancing, sun still centred, filter still taped. Do not recentre — it puts a jump in the time-lapse.' },

  { id:'check-2',    at:'2026-08-12T17:25:00Z', phase:'partial-1', mode:null, critical:false, filterOn:true,
    title:'Quiet check',
    detail:'Last look before the run ends. Confirm power, card space, and that nothing has crept.' },

  // ---------- hand-flown ingress ----------
  { id:'handover-in', at:'2026-08-12T17:42:00Z', phase:'handover-in', mode:'C1', critical:true, filterOn:true,
    title:'Timer done — you have the camera',
    speak:'Timer finished. You have the camera. Open up one half stop.',
    detail:'Frame 826 is in. Open +½ stop for limb darkening. Shoot by hand from here.' },

  { id:'ramp-full',  at:'2026-08-12T17:45:10Z', phase:'handover-in', mode:'C1', critical:true, filterOn:true,
    title:'Open up one stop',
    detail:'Only the limb is left and it is ~1.5 stops darker than disk centre. One minute to totality.' },

  { id:'final-check', at:'2026-08-12T17:45:40Z', phase:'handover-in', mode:'C4', critical:true, filterOn:true,
    title:'Final check — zoom 500, hand on the filter',
    speak:'Final check. Zoom five hundred. Hand on the filter.',
    detail:'Sun centred, camera awake, MF locked, C4 armed, ProCap half-pressed. Thirty seconds.' },

  // ---------- totality ----------
  { id:'c2',         at:'2026-08-12T17:46:10Z', phase:'totality', mode:'C4', critical:true, filterOn:false,
    title:'FILTER OFF — diamond ring',
    speak:'Filter off. Filter off. Shoot the diamond ring.',
    detail:'ProCap burst. Second contact.' },

  { id:'burst-1',    at:'2026-08-12T17:46:15Z', phase:'totality', mode:'C2', critical:true, filterOn:false,
    title:'Bracket burst 1',
    detail:'Tight at zoom 500 — chromosphere and prominences.' },

  { id:'burst-2',    at:'2026-08-12T17:46:25Z', phase:'totality', mode:'C2', critical:true, filterOn:false,
    title:'Bracket burst 2',
    detail:'Second look at the prominences.' },

  { id:'zoom',       at:'2026-08-12T17:46:40Z', phase:'totality', mode:null, critical:true, filterOn:false,
    title:'ZOOM BACK TO 250',
    speak:'Zoom back to two fifty. Recentre.',
    detail:'Pull to the taped mark. Recentre. If it fights you, abandon it and keep shooting tight.' },

  { id:'burst-3',    at:'2026-08-12T17:46:48Z', phase:'totality', mode:'C2', critical:true, filterOn:false,
    title:'Bracket burst 3 — the corona',
    detail:'This is the picture.' },

  { id:'earthshine', at:'2026-08-12T17:46:56Z', phase:'totality', mode:'C3', critical:false, filterOn:false,
    title:'Outer corona / earthshine',
    detail:'ISO 1600. Sweep 1.3s, 2.5s, 5s. Stretch goal — do not overrun.' },

  { id:'lookup',     at:'2026-08-12T17:47:10Z', phase:'totality', mode:null, critical:true, filterOn:false,
    title:'HANDS OFF — LOOK UP',
    speak:'Hands off. Look up. Twenty five seconds.',
    detail:'This is the whole point. Do not touch the camera.' },

  { id:'burst-4',    at:'2026-08-12T17:47:35Z', phase:'totality', mode:'C2', critical:true, filterOn:false,
    title:'Bracket burst 4 — corona',
    detail:'Recentre first; the sun has drifted west.' },

  { id:'arm-c3',     at:'2026-08-12T17:47:50Z', phase:'totality', mode:'C4', critical:true, filterOn:false,
    title:'Arm for third contact',
    speak:'Arm for third contact. Watch the west limb.',
    detail:'Still at 250. Beads first, then the diamond ring with the full corona around it.' },

  // ---------- egress ----------
  { id:'c3',         at:'2026-08-12T17:48:13Z', phase:'handover-out', mode:'C1', critical:true, filterOn:true,
    title:'FILTER BACK ON — eyes away',
    speak:'Filter on. Filter on now. Eyes away.',
    detail:'Third contact. Filter on before the first bead, not after. Then back to +1 stop.' },

  { id:'ramp-down-1', at:'2026-08-12T17:49:15Z', phase:'handover-out', mode:'C1', critical:false, filterOn:true,
    title:'Back to +½ stop',
    detail:'Mirror of the ingress ramp as the crescent widens.' },

  { id:'ramp-down-2', at:'2026-08-12T17:51:30Z', phase:'handover-out', mode:'C1', critical:false, filterOn:true,
    title:'Back to base exposure — 1/400',
    detail:'Reset for the second timer run. Confirm zoom is still 250 so the clips match.' },

  { id:'run-2',      at:'2026-08-12T17:52:00Z', phase:'partial-2', mode:'C1', critical:true, filterOn:true,
    title:'Start timer run 2',
    speak:'Start the second timer run.',
    detail:'Identical program: INTVL 4s, N = 826. Last frame 18:47:00.' },

  { id:'check-3',    at:'2026-08-12T18:15:00Z', phase:'partial-2', mode:null, critical:false, filterOn:true,
    title:'Quiet check',
    detail:'Power, card, framing. Then leave it alone.' },

  { id:'c4',         at:'2026-08-12T18:47:00Z', phase:'done', mode:null, critical:true, filterOn:true,
    title:'Fourth contact — done',
    speak:'Fourth contact. That is the eclipse.',
    detail:'1652 frames, about 29 GB. Back up the card before you do anything else.' },
]
```

### 4.3 A note on one number

The field card says "+½ stop 5 minutes before C2," which would be 17:41:10 — while the
timer is still running. The app resolves this to **17:42:00**, the moment the run
actually ends. The difference is 50 seconds and about 0.1 stop. Use the app's value.

---

## 5. Screen 1 — Prep

Route `/` (or default view). Scrollable, ordinary page.

### 5.1 Header

- App title, and a large **countdown to C2** — `T− 1:23:45` — always visible.
- A prominent button: **GO LIVE →** switches to screen 2.

### 5.2 Checklist

Grouped, collapsible sections. Each item is a checkbox with a large tap target
(min 56 px row height). State persists to `localStorage` under `eclipse.checklist`,
keyed by item id. A "reset all" in Settings.

**The night before**

- [ ] Charge camera battery + two spares
- [ ] Charge the ≥27 W USB-C PD power bank
- [ ] Format a 64 GB+ UHS-II card, in slot 1
- [ ] Confirm HDR bracket `7f 2.0EV` fires seven RAWs including the 1.3 s frame
- [ ] Confirm ProCap SH2 works with the MC-20 attached
- [ ] Confirm the JJC will accept N = 826 (if not, use built-in Interval Shooting)
- [ ] Meter the solar filter: 1/400 at ISO 200, f/11 should be correct
- [ ] Check parfocality: focus at zoom 500, pull to 250, inspect at 14×
- [ ] Tape a mark on the zoom barrel at 250
- [ ] Set the clock offset in this app while you still have signal

**Camera setup**

- [ ] C1 — M, wide open, ISO 200, 1/400, Single, silent, RAW, WB 5400K
- [ ] C2 — M, wide open, ISO 200, base 1/50, HDR `7f 2.0EV`, silent, RAW
- [ ] C3 — M, wide open, ISO 1600, manual sweep 1.3 / 2.5 / 5 s
- [ ] C4 — M, wide open, ISO 200, 1/2500, ProCap SH2
- [ ] ISO is **not** Auto
- [ ] Sleep / auto power-off OFF
- [ ] Rec View OFF
- [ ] IS OFF — body switch *and* lens switch
- [ ] Subject detection OFF, long-exposure NR OFF
- [ ] Custom mode retention: Reset
- [ ] AF set to MF

**At the site (T−60 min)**

- [ ] Tripod level, GTi polar aligned, **solar** tracking rate selected
- [ ] Balanced at the 250 zoom mark, slightly camera-heavy
- [ ] Zoom friction collar set to T
- [ ] Solar filter on the front, **taped** against the wind
- [ ] USB PD connected with the camera off, USBP confirmed on power-up

**T−15 min**

- [ ] Focus locked and taped
- [ ] Timer programmed: DELAY 0, LONG 1s, INTVL 4s, N = 826
- [ ] Dry-run burst fired and reviewed
- [ ] Phone on this app, screen wake lock active, audio unlocked
- [ ] Eclipse glasses in a pocket you can reach with gloves on

### 5.3 Reference card

A collapsed accordion holding the exposure ladder, so it is available without the PDF:

```
Bracket (C2): base 1/50 → 1/3200 · 1/800 · 1/200 · 1/50 · 1/13 · 0.3" · 1.3"
Partial (C1, filter on): 1/400   |   Diamond ring (C4): 1/2500
Earthshine (C3, ISO 1600): 1.3" / 2.5" / 5"
Zoom 250 = corona (2.8 × 3.8 Rs)  ·  Zoom 500 = prominences (1.4 × 1.9 Rs)
```

### 5.4 Settings

- Clock offset stepper (§3.2)
- Audio: master on/off, voice on/off, tones on/off, a **Test audio** button
- Keep screen awake: on/off (default on)
- Rehearsal mode (§8)
- Reset checklist

---

## 6. Screen 2 — Live timeline

This is the screen he actually uses. Optimise it for a glance from three feet away in
bright overcast daylight.

### 6.1 Fixed header (always visible, never scrolls)

Three rows, stacked, full width:

1. **Filter state banner.** Full-bleed, unmissable.
   - Filter ON → black background, white text: `FILTER ON`
   - Filter OFF → amber/red background, black text: `FILTER OFF — DO NOT LOOK`
   - This is derived from the `filterOn` value of the most recent past event.
2. **Next action + countdown.** The next event's `title` in large bold type, with a
   monospace countdown `T− 00:42`. When the countdown is under 10 seconds it switches
   to a large single number.
3. **Current time**, `HH:MM:SS` UTC, monospace, smaller. Plus the applied offset if
   non-zero, e.g. `(+3s)`.

### 6.2 The scroll

A single vertical list of every event, in order.

- Auto-scrolls so the **current/next event sits about one third down** the viewport.
- Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` on the active card, or
  a transform-based virtual scroller. Smooth, not jumpy — retarget at most once per
  second.
- If the user scrolls manually, **suspend auto-scroll** and show a floating
  **↓ NOW** pill. Tapping it, or 12 seconds of no touch, resumes auto-scroll.
- The list must be scrollable through the whole event even while live — he may want
  to read ahead.

### 6.3 Event cards

Each card shows: time (`HH:MM:SS`), a relative label (`T− 4:10` / `T+ 0:38` relative
to C2), the mode chip if present, the title, and the detail line.

State styling:

| State | Treatment |
| --- | --- |
| Past | 40 % opacity, title only, detail collapsed, compact height |
| Active (now → next event) | Full width accent border, largest type, detail always shown, subtle pulse |
| Next up (within 60 s) | Full opacity, slightly raised, detail shown |
| Future | Full opacity, normal type, detail shown |
| Future, > 30 min away | Compact height, detail collapsed |

Critical events get a heavier border and a warmer accent regardless of state.

The nine events with `phase === 'totality'` render with tighter vertical spacing so the
whole 2-minute sequence fits on one screen when it is active. **All nine simultaneously
visible from C2 onward is a hard requirement** — during totality the operator must see
the whole sequence at once, never scroll for it. The C3 filter-on event should also be
visible at the bottom of that block even though its phase is `handover-out`.

### 6.4 Phase colouring

Give each phase a distinct left-edge colour so position in the day is readable
peripherally: prep grey, partials blue, handovers amber, totality red, done green.

### 6.5 Screen wake

Request a `WakeLock` (`navigator.wakeLock.request('screen')`) when screen 2 mounts.
Re-request on `visibilitychange`. Show a small warning chip if the API is unavailable
or the request fails, telling him to set the phone's auto-lock to Never.

---

## 7. Audio

### 7.1 Unlock

Browsers require a user gesture. The **GO LIVE** button is that gesture: on tap, play
a silent buffer through the `AudioContext` and speak a short confirmation
("Audio ready") via `speechSynthesis`. If the app is opened directly on screen 2,
show a **Tap to enable audio** overlay until the gesture happens.

### 7.2 Voice

`window.speechSynthesis`. Prefer an `en-GB` or `en-US` voice; fall back to the default.
Rate 1.0, volume 1.0.

- Speak `event.speak ?? event.title`.
- Fire the announcement `event.leadSeconds` before the event time — default **10 s**
  for critical events, **0** for non-critical.
- For critical events, also speak a bare countdown at T−5: *"five, four, three, two,
  one"* is too slow to complete; instead speak *"five seconds"* at T−5 and let the
  tones carry the rest.
- Never queue more than one utterance. Call `speechSynthesis.cancel()` before each new
  one — a backed-up queue during totality is worse than silence.

### 7.3 Tones

Web Audio API, generated in code (no audio files):

| Cue | Sound |
| --- | --- |
| Non-critical event due | Single 660 Hz sine, 120 ms |
| Critical event T−10 to T−1 | 880 Hz blip, 80 ms, once per second |
| Critical event due | Three 1320 Hz blips, 100 ms apart |
| Filter-off (C2) and filter-on (C3) | Distinct rising / falling two-tone sweep, louder, 600 ms |

The C2 and C3 cues must be unmistakably different from every other sound in the app.

### 7.4 Catch-up rule

If the app is opened, resumed, or the clock offset is changed such that events are
already in the past, **do not announce them**. Only announce events whose time is in
the future at the moment of the tick that schedules them.

---

## 8. Rehearsal mode

Non-negotiable. This app is unusable if it cannot be tested, and it gets exactly one
live run.

In Settings, a **Rehearsal** panel:

- Toggle rehearsal on/off. When on, a persistent striped banner reads
  `REHEARSAL — NOT LIVE` at the top of both screens.
- **Jump to**: a set of buttons — `C1 −2 min`, `C2 −5 min`, `C2 −30 s`, `C3 −20 s`,
  `C4 −1 min` — that set the virtual clock.
- **Speed**: `1× · 2× · 10× · 60×`.
- **Pause / resume / reset to real time.**

Implement as a `ClockService` with a single `now()` method that the entire app depends
on. Nothing in the UI may call `Date.now()` directly.

```ts
interface ClockService {
  now(): number             // ms since epoch, offset- and rehearsal-aware
  isRehearsal(): boolean
  setVirtual(t: number, speed: number): void
  clearVirtual(): void
}
```

Audio fires in rehearsal exactly as it would live, so the audio design can be
evaluated. At speeds above 2×, suppress speech and keep tones only.

---

## 9. PWA and offline

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`, `workbox.globPatterns`
  covering `**/*.{js,css,html,svg,png,woff2}`.
- **Precache everything.** No runtime caching strategies, because there are no runtime
  requests.
- Manifest:
  - `name`: "Eclipse Timer — Ólafsvík 2026", `short_name`: "Eclipse"
  - `display`: `standalone`, `orientation`: `any`, `background_color`/`theme_color`: `#000000`
  - Icons at 192, 512, and a 512 maskable. Generate them in-repo as SVG → PNG; a simple
    black disc with a white corona ring is fine.
- `apple-touch-icon` link and `apple-mobile-web-app-capable` meta for iOS install.
- On first load, show a one-time banner: *"Add to Home Screen and open it once offline
  before you travel."*
- The app must fully function in airplane mode after one online load. Add a Vitest or
  manual test step that verifies this.

---

## 10. Netlify

`netlify.toml` at the repo root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"

[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "no-cache"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

The `sw.js` and `index.html` no-cache headers matter — without them a stale service
worker can pin an old build.

---

## 11. Visual design

Dark theme only. Assume bright overcast daylight and a phone at 100 % brightness.

- Background `#000`, text `#fff`. No mid-greys for body text.
- Type scale is aggressive: next-action title at ~32 px, countdown at ~48 px monospace,
  event titles at ~18 px. Never below 14 px anywhere.
- Font weight 600+ for anything that matters. No thin or light weights.
- Accents: totality red `#ff3b30`, handover amber `#ff9f0a`, partial blue `#0a84ff`,
  done green `#30d158`. These are the iOS system colours and they hold up outdoors.
- Tap targets minimum 56 × 56 px.
- Respect `prefers-reduced-motion` — disable the pulse and use instant scroll.
- Works portrait and landscape. Portrait is the primary case.

---

## 12. Project structure

```
src/
  main.tsx
  App.tsx
  data/timeline.ts          // EVENTS, contact anchors, types
  services/clock.ts         // ClockService — the only place Date.now() appears
  services/audio.ts         // speech + tone generation, unlock handling
  services/wakelock.ts
  services/storage.ts       // typed localStorage wrappers
  hooks/useNow.ts           // 4 Hz tick, returns ms
  hooks/useTimelineState.ts // derives active/next/past + filter state from now
  screens/PrepScreen.tsx
  screens/LiveScreen.tsx
  components/
    FilterBanner.tsx
    NextAction.tsx
    EventCard.tsx
    Countdown.tsx
    ChecklistSection.tsx
    RehearsalPanel.tsx
    SettingsPanel.tsx
  data/checklist.ts
public/
  icons/…
netlify.toml
```

---

## 13. Tests

`src/services/__tests__/` with Vitest:

1. `EVENTS` is sorted ascending by `at`, with no duplicate ids and no duplicate times.
   (The data as given satisfies this: 26 events, strictly ascending.)
2. Every `at` parses to a valid date on 2026-08-12.
3. `filterOn` transitions exactly twice: true → false at `c2`, false → true at `c3`.
4. Given a fixed `now`, `useTimelineState` returns the correct active event, next
   event, and filter state — table-driven across at least: before C1, mid-partial-1,
   during the handover, each totality step, and after C4.
5. Clock offset arithmetic: `+3000 ms` offset moves the active event boundary by
   exactly 3 seconds.
6. Announcement scheduling never fires for an event already in the past.
7. Totality events fit the "all nine simultaneously visible" constraint — assert the
   rendered totality block height against a 640 px viewport in a jsdom snapshot, or at
   minimum assert the count is 9 and the compact style is applied.

---

## 14. Acceptance criteria

The build is done when all of these are true:

- [ ] `npm run build` succeeds and `npm run preview` serves a working app.
- [ ] Installed to a phone home screen, then in **airplane mode**, the app opens and
      runs the full timeline correctly.
- [ ] Rehearsal mode at `C2 −30 s`, 1× speed, produces: the T−10 voice announcement,
      per-second blips from T−10, the filter-off sweep at C2, and correct auto-scroll
      through all nine totality steps without the operator touching the screen.
- [ ] The filter banner is legible from three feet away in direct daylight.
- [ ] Screen does not sleep during a 10-minute unattended run on the live screen.
- [ ] Setting a `+5 s` clock offset visibly shifts every countdown by 5 seconds.
- [ ] Checklist state survives a full app close and reopen.
- [ ] Lighthouse PWA audit passes installability and offline checks.
- [ ] Deployed to Netlify and loads over HTTPS at a stable URL.

---

## 15. Explicitly out of scope

Do not build these. They add failure surface for no gain on the day:

- GPS or geolocation of any kind. The times are fixed to Ólafsvík.
- Recomputing contact times from Besselian elements.
- Weather, cloud cover, or any network data.
- Photo upload, gallery, or camera control.
- Accounts, sync, or a backend.
- Push notifications.
- Light theme.

---

## 16. If you must ask one question

Don't. Build it, deploy it, and report the Netlify URL plus how to enter rehearsal
mode. Anything ambiguous should resolve toward *fewer moving parts*.
