function pad(n) {
  return String(n).padStart(2, '0')
}

/**
 * Formats a duration in seconds as zero-padded `HH:MM:SS`, clamped at zero
 * (never negative) with no upper bound on hours (a duration past 99 hours
 * renders with a 3+ digit hour segment rather than wrapping or truncating).
 */
export function formatDuration(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = clamped % 60

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}
