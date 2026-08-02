import { useMemo } from 'react'
import { useNow } from '../hooks/useNow.js'
import { clockService } from '../services/clock.js'
import { C2 } from '../data/timeline.js'
import { formatDuration } from '../lib/formatDuration.js'
import ChecklistSection from '../components/ChecklistSection.jsx'
import SettingsPanel from '../components/SettingsPanel.jsx'
import RehearsalPanel, { RehearsalBanner } from '../components/RehearsalPanel.jsx'

// Verbatim from eclipse-timer-spec.md §5.3 — do not reformat the numbers.
const REFERENCE_CARD_LINES = [
  'Bracket (C2): base 1/50 → 1/3200 · 1/800 · 1/200 · 1/50 · 1/13 · 0.3" · 1.3"',
  'Partial (C1, filter on): 1/400   |   Diamond ring (C4): 1/2500',
  'Earthshine (C3, ISO 1600): 1.3" / 2.5" / 5"',
  'Zoom 250 = corona (2.8 × 3.8 Rs)  ·  Zoom 500 = prominences (1.4 × 1.9 Rs)',
]

const C2_MS = Date.parse(C2)

/**
 * Formats a countdown/elapsed delta as `T− HH:MM:SS` before C2, switching to
 * `T+ HH:MM:SS` once C2 has passed (spec §5, §14 AC) — the operator can now
 * navigate back to this screen from the live timeline at any point (the
 * "← Setup" button), including after C2, so a countdown frozen at
 * "T− 00:00:00" forever past that instant would be misleading.
 *
 * The remaining (T−) side ceils, never floors: matching NextAction.jsx's
 * own stated convention, showing "00:00:00" for the entire final second
 * before C2 would under-report and read as early. The elapsed (T+) side
 * floors, which is correct for elapsed time (a partially-elapsed second
 * hasn't fully elapsed yet).
 */
function formatCountdown(deltaMs) {
  if (deltaMs < 0) {
    return `T+ ${formatDuration(Math.floor(-deltaMs / 1000))}`
  }

  return `T− ${formatDuration(Math.ceil(deltaMs / 1000))}`
}

/**
 * Collapsible instrument module: hairline-framed panel with an uppercase
 * display-face summary row. The `label` must stay a plain-text child so the
 * summary's accessible text is exactly the label (the +/× indicator is
 * aria-hidden and contributes nothing to it).
 */
function Module({ label, delayMs, children }) {
  return (
    <details
      className="rise group border border-line bg-panel/70"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-display text-base font-medium tracking-[0.25em] uppercase text-dim transition-colors select-none hover:text-ink [&::-webkit-details-marker]:hidden">
        {label}
        <span
          aria-hidden="true"
          className="font-mono text-sm text-corona/70 transition-transform duration-200 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="border-t border-line px-4 py-4">{children}</div>
    </details>
  )
}

function PrepScreen({ onGoLive }) {
  const now = useNow(clockService)
  const countdown = useMemo(() => formatCountdown(C2_MS - now), [now])
  const pastC2 = C2_MS - now < 0

  return (
    <div className="min-h-dvh pb-24">
      <RehearsalBanner />

      <header className="mx-auto flex max-w-md flex-col items-center px-4 pt-12 text-center">
        <h1 className="rise font-display text-2xl font-medium tracking-[0.45em] uppercase text-ink">
          Eclipse Timer
        </h1>
        <p className="rise mt-2 font-mono text-[0.65rem] tracking-[0.3em] uppercase text-dim [animation-delay:80ms]">
          Total solar eclipse · Ólafsvík · 12 Aug 2026
        </p>

        <div
          aria-hidden="true"
          className="rise relative mt-10 mb-9 h-36 w-36 [animation-delay:160ms]"
        >
          <div className="corona-glow absolute -inset-3 rounded-full" />
          <div className="moon-disc absolute inset-0 rounded-full" />
        </div>

        <p className="rise font-mono text-[clamp(2.3rem,10.5vw,3.4rem)] font-semibold tracking-tight tabular-nums [animation-delay:240ms]">
          {countdown}
        </p>
        <p className="rise mt-1 font-mono text-[0.65rem] tracking-[0.3em] uppercase text-corona/80 [animation-delay:300ms]">
          {pastC2 ? 'since second contact — totality' : 'to second contact — totality'}
        </p>

        <button
          type="button"
          onClick={onGoLive}
          className="rise mt-9 w-full max-w-sm border border-corona bg-corona px-6 py-4 font-display text-3xl font-bold tracking-[0.3em] uppercase text-black shadow-[0_0_28px_rgb(255_179_71/0.35)] transition hover:bg-ember hover:shadow-[0_0_44px_rgb(255_139_61/0.5)] active:translate-y-px [animation-delay:360ms]"
        >
          GO LIVE →
        </button>
      </header>

      <main className="mx-auto mt-12 flex max-w-md flex-col gap-3 px-4">
        <div className="rise [animation-delay:420ms]">
          <ChecklistSection />
        </div>

        <Module label="Reference card" delayMs={480}>
          {REFERENCE_CARD_LINES.map((line) => (
            <p
              key={line}
              className="border-b border-line/60 py-2 font-mono text-xs leading-relaxed text-ink/90 last:border-0"
            >
              {line}
            </p>
          ))}
        </Module>

        <Module label="Settings" delayMs={540}>
          <SettingsPanel />
        </Module>

        <Module label="Rehearsal" delayMs={600}>
          <RehearsalPanel />
        </Module>
      </main>
    </div>
  )
}

export default PrepScreen
