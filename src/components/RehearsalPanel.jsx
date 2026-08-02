import { clockService } from '../services/clock.js'
import { useRehearsalControls } from '../hooks/useRehearsalControls.js'
import { C1, C2, C3, C4 } from '../data/timeline.js'
import { CHECKBOX_CLASS, TOGGLE_LABEL_CLASS } from './formClasses.js'

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
  const {
    rehearsalOn,
    speed,
    paused,
    jumpTargetMs,
    toggle,
    jumpTo,
    selectSpeed,
    pause,
    resume,
    reset,
  } = useRehearsalControls()

  return (
    <section className="flex flex-col gap-4">
      {/* The enclosing module's summary row already reads "Rehearsal" — keep
          the heading for document structure, hidden visually. */}
      <h2 className="sr-only">Rehearsal</h2>
      <label className={TOGGLE_LABEL_CLASS}>
        <input type="checkbox" className={CHECKBOX_CLASS} checked={rehearsalOn} onChange={toggle} />
        Rehearsal mode
      </label>

      <div>
        <h3 className="mb-2 font-mono text-[0.65rem] tracking-[0.3em] uppercase text-dim">
          Jump to
        </h3>
        <div className="flex flex-wrap gap-2">
          {JUMP_TARGETS.map(({ label, at }) => (
            <button
              key={label}
              type="button"
              className="min-h-11 border border-line bg-void px-3 font-mono text-xs text-ink transition-colors hover:border-corona hover:text-corona aria-pressed:border-corona aria-pressed:bg-corona aria-pressed:font-semibold aria-pressed:text-black"
              aria-pressed={jumpTargetMs === at}
              onClick={() => jumpTo(at)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-mono text-[0.65rem] tracking-[0.3em] uppercase text-dim">Speed</h3>
        <div className="flex gap-2">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className="min-h-11 flex-1 border border-line bg-void px-2 font-mono text-sm text-dim transition-colors hover:text-ink aria-pressed:border-corona aria-pressed:bg-corona aria-pressed:font-semibold aria-pressed:text-black"
              aria-pressed={speed === s}
              onClick={() => selectSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-mono text-[0.65rem] tracking-[0.3em] uppercase text-dim">
          Transport
        </h3>
        <div className="flex items-center gap-2">
          {paused ? (
            <button
              type="button"
              className="min-h-11 flex-1 border border-corona bg-corona/10 px-3 font-display text-base font-medium tracking-[0.2em] uppercase text-corona transition-colors hover:bg-corona hover:text-black"
              onClick={resume}
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              className="min-h-11 flex-1 border border-ink/40 px-3 font-display text-base font-medium tracking-[0.2em] uppercase text-ink transition-colors hover:border-corona hover:text-corona"
              onClick={pause}
            >
              Pause
            </button>
          )}
          <button
            type="button"
            className="min-h-11 px-3 font-mono text-xs text-dim underline-offset-4 transition-colors hover:text-corona hover:underline"
            onClick={reset}
          >
            Reset to real time
          </button>
        </div>
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
