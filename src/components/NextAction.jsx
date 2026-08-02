import Countdown from './Countdown.jsx'

/**
 * Shows the next timeline event's title alongside a countdown to it.
 * Renders nothing once there is no next event (past the final event, C4).
 */
function NextAction({ event, now }) {
  if (!event) {
    return null
  }

  // ceil, not round: the countdown must never under-report — showing "0"
  // half a second before the event actually happens would read as early.
  const secondsRemaining = Math.ceil((Date.parse(event.at) - now) / 1000)

  return (
    <div data-testid="next-action">
      <p className="text-lg font-semibold">{event.title}</p>
      <Countdown secondsRemaining={secondsRemaining} />
    </div>
  )
}

export default NextAction
