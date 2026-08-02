/** `HH:MM:SS`, UTC, no timezone conversion (spec §3.1/§6.3). */
export function formatUtcTime(ms) {
  return new Date(ms).toISOString().slice(11, 19)
}
