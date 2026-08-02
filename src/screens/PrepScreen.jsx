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

function PrepScreen({ onGoLive }) {
  const now = useNow(clockService)
  const countdown = useMemo(() => formatCountdown(C2_MS - now), [now])

  return (
    <div>
      <RehearsalBanner />
      <header>
        <h1>Eclipse Timer</h1>
        <p>{countdown}</p>
        <button type="button" onClick={onGoLive}>
          GO LIVE →
        </button>
      </header>
      <ChecklistSection />
      <details>
        <summary>Reference card</summary>
        {REFERENCE_CARD_LINES.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </details>
      <details>
        <summary>Settings</summary>
        <SettingsPanel />
      </details>
      <details>
        <summary>Rehearsal</summary>
        <RehearsalPanel />
      </details>
    </div>
  )
}

export default PrepScreen
