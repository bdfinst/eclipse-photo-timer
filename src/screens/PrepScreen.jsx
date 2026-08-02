import { useMemo } from 'react'
import { useNow } from '../hooks/useNow.js'
import { clockService } from '../services/clock.js'
import { C2 } from '../data/timeline.js'
import ChecklistSection from '../components/ChecklistSection.jsx'
import SettingsPanel from '../components/SettingsPanel.jsx'

// Verbatim from eclipse-timer-spec.md §5.3 — do not reformat the numbers.
const REFERENCE_CARD_LINES = [
  'Bracket (C2): base 1/50 → 1/3200 · 1/800 · 1/200 · 1/50 · 1/13 · 0.3" · 1.3"',
  'Partial (C1, filter on): 1/400   |   Diamond ring (C4): 1/2500',
  'Earthshine (C3, ISO 1600): 1.3" / 2.5" / 5"',
  'Zoom 250 = corona (2.8 × 3.8 Rs)  ·  Zoom 500 = prominences (1.4 × 1.9 Rs)',
]

const C2_MS = Date.parse(C2)

function pad(n) {
  return String(n).padStart(2, '0')
}

/**
 * Formats a countdown delta as `T− H:MM:SS` (spec §5, §14 AC). Clamped at
 * zero — this screen never needs to show a negative countdown past C2.
 */
function formatCountdown(deltaMs) {
  const totalSeconds = Math.max(0, Math.floor(deltaMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `T− ${hours}:${pad(minutes)}:${pad(seconds)}`
}

// GO LIVE is a no-op this slice — navigation to the live timeline screen is
// wired in Slice 9.
function PrepScreen() {
  const now = useNow(clockService)
  const countdown = useMemo(() => formatCountdown(C2_MS - now), [now])

  return (
    <div>
      <header>
        <h1>Eclipse Timer</h1>
        <p>{countdown}</p>
        <button type="button">GO LIVE →</button>
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
    </div>
  )
}

export default PrepScreen
