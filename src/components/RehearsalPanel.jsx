import { clockService } from '../services/clock.js'
import { useRehearsalControls } from '../hooks/useRehearsalControls.js'
import { C1, C2, C3, C4 } from '../data/timeline.js'

// Speeds above 2x also suppress speech (useAnnouncements.js) so the
// announcement pacing can be evaluated even at high playback rates.
const SPEEDS = [1, 2, 10, 60]

// Five fixed jump-to targets (spec §8) — expressed as an offset in ms from
// each anchor constant, computed once at module load since the anchors
// themselves never change at runtime.
const JUMP_TARGETS = [
  { label: 'C1 −2 min', at: Date.parse(C1) - 2 * 60 * 1000 },
  { label: 'C2 −5 min', at: Date.parse(C2) - 5 * 60 * 1000 },
  { label: 'C2 −30 s', at: Date.parse(C2) - 30 * 1000 },
  { label: 'C3 −20 s', at: Date.parse(C3) - 20 * 1000 },
  { label: 'C4 −1 min', at: Date.parse(C4) - 60 * 1000 },
]

/**
 * Non-negotiable rehearsal capability (spec §8): the operator gets exactly
 * one live run, so this app must be fully testable beforehand. Presentation
 * only — state and clockService/storage wiring live in useRehearsalControls.
 */
function RehearsalPanel() {
  const { rehearsalOn, speed, paused, toggle, jumpTo, selectSpeed, pause, resume, reset } =
    useRehearsalControls()

  return (
    <section>
      <h3>Rehearsal</h3>
      <label>
        <input type="checkbox" checked={rehearsalOn} onChange={toggle} />
        Rehearsal mode
      </label>

      <div>
        <h4>Jump to</h4>
        {JUMP_TARGETS.map(({ label, at }) => (
          <button key={label} type="button" onClick={() => jumpTo(at)}>
            {label}
          </button>
        ))}
      </div>

      <div>
        <h4>Speed</h4>
        {SPEEDS.map((s) => (
          <button key={s} type="button" aria-pressed={speed === s} onClick={() => selectSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>

      <div>
        <h4>Transport</h4>
        {paused ? (
          <button type="button" onClick={resume}>
            Resume
          </button>
        ) : (
          <button type="button" onClick={pause}>
            Pause
          </button>
        )}
        <button type="button" onClick={reset}>
          Reset to real time
        </button>
      </div>
    </section>
  )
}

/**
 * Visually loud, striped so it can't be mistaken for a normal status chip —
 * shown on both PrepScreen and LiveScreen for as long as `isRehearsal()` is
 * true, so the operator is never in doubt about whether they're rehearsing
 * or live.
 */
export function RehearsalBanner() {
  if (!clockService.isRehearsal()) {
    return null
  }

  return (
    <div
      role="status"
      className="w-full bg-[repeating-linear-gradient(45deg,theme(colors.amber.500),theme(colors.amber.500)_10px,theme(colors.black)_10px,theme(colors.black)_20px)] py-2 text-center text-lg font-extrabold text-black"
    >
      REHEARSAL — NOT LIVE
    </div>
  )
}

export default RehearsalPanel
