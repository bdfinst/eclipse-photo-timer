const SINGLE_DIGIT_THRESHOLD_SECONDS = 10

function pad(n) {
  return String(n).padStart(2, '0')
}

/**
 * Renders a `T− MM:SS` countdown (minutes unpadded beyond 2 digits when the
 * event is over 99 minutes away), switching to a large single digit under
 * 10 seconds (spec §5 / plan Slice 7) so the operator can read the final
 * approach at a glance rather than parsing MM:SS digits.
 */
function Countdown({ secondsRemaining }) {
  const clamped = Math.max(0, secondsRemaining)

  if (clamped < SINGLE_DIGIT_THRESHOLD_SECONDS) {
    return <p className="text-7xl font-black">{clamped}</p>
  }

  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60

  return (
    <p className="text-2xl font-semibold">
      T− {pad(minutes)}:{pad(seconds)}
    </p>
  )
}

export default Countdown
