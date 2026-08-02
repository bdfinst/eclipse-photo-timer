import { describe, expect, it } from 'vitest'
import { formatDuration } from './formatDuration.js'

describe('formatDuration', () => {
  it('zero-pads all three segments', () => {
    expect(formatDuration(5)).toBe('00:00:05')
    expect(formatDuration(65)).toBe('00:01:05')
    expect(formatDuration(3665)).toBe('01:01:05')
  })

  it('clamps negative durations to zero rather than showing a negative time', () => {
    expect(formatDuration(-42)).toBe('00:00:00')
  })

  it('does not truncate or wrap once hours reach 3 digits', () => {
    expect(formatDuration(100 * 3600 + 5)).toBe('100:00:05')
  })

  it('floors sub-second remainders', () => {
    expect(formatDuration(5.9)).toBe('00:00:05')
  })
})
