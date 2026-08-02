import { formatDuration } from '../lib/formatDuration.js'

const SINGLE_DIGIT_THRESHOLD_SECONDS = 10

/**
 * Renders a `T− HH:MM:SS` countdown, switching to a large single digit under
 * 10 seconds (spec §5 / plan Slice 7) so the operator can read the final
 * approach at a glance rather than parsing HH:MM:SS digits.
 */
function Countdown({ secondsRemaining }) {
  const clamped = Math.max(0, secondsRemaining)

  if (clamped < SINGLE_DIGIT_THRESHOLD_SECONDS) {
    return <p className="text-7xl font-black">{clamped}</p>
  }

  return <p className="text-2xl font-semibold">T− {formatDuration(clamped)}</p>
}

export default Countdown
