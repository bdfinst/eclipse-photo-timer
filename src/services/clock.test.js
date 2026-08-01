import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setItem } from './storage.js'

describe('clockService', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('applies the stored clock offset', async () => {
    setItem('eclipse.clockOffsetMs', 3000)
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    const { clockService } = await import('./clock.js')

    expect(clockService.now()).toBe(1_003_000)
  })

  it('defaults to zero offset', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    const { clockService } = await import('./clock.js')

    expect(clockService.now()).toBe(1_000_000)
  })

  it('falls back to zero when the persisted offset is malformed but valid JSON', async () => {
    setItem('eclipse.clockOffsetMs', 'not-a-number')
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    const { clockService } = await import('./clock.js')

    expect(clockService.now()).toBe(1_000_000)
  })

  it('setVirtual and clearVirtual mutate state every importer observes (real shared-state check, not reference equality)', async () => {
    const { clockService: writer } = await import('./clock.js')
    const { clockService: reader } = await import('./clock.js')

    writer.setVirtual(5_000_000, 1)
    expect(reader.isRehearsal()).toBe(true)

    writer.clearVirtual()
    expect(reader.isRehearsal()).toBe(false)
  })

  it('returns the injected virtual time while rehearsal is active', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const { clockService } = await import('./clock.js')

    clockService.setVirtual(5_000_000, 1)

    expect(clockService.now()).toBe(5_000_000)
  })

  it('advances the virtual clock at the given speed multiplier', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const { clockService } = await import('./clock.js')

    clockService.setVirtual(5_000_000, 60)
    nowSpy.mockReturnValue(1_000_060) // 60ms of wall time elapses

    expect(clockService.now()).toBe(5_003_600) // 60ms * 60x = 3600ms of virtual time
  })

  it('clearVirtual resumes the real offset-adjusted clock', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    setItem('eclipse.clockOffsetMs', 3000)
    const { clockService } = await import('./clock.js')

    clockService.setVirtual(5_000_000, 1)
    clockService.clearVirtual()

    expect(clockService.isRehearsal()).toBe(false)
    expect(clockService.now()).toBe(1_003_000)
  })

  it('never writes rehearsal/virtual-clock state to storage', async () => {
    // Import storage.js fresh in this reset cycle first, and spy on THAT
    // instance — clock.js's internal `import { getItem } from './storage.js'`
    // resolves to the same cached module within this cycle, so the spy
    // actually observes calls clock.js makes (a static top-level import
    // would go stale after vi.resetModules() and never see them).
    const storageModule = await import('./storage.js')
    const setItemSpy = vi.spyOn(storageModule, 'setItem')
    const { clockService } = await import('./clock.js')

    clockService.setVirtual(5_000_000, 60)
    clockService.clearVirtual()

    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('never persists rehearsal state across a fresh load', async () => {
    const { clockService } = await import('./clock.js')
    clockService.setVirtual(1_000_000, 1)
    expect(clockService.isRehearsal()).toBe(true)

    vi.resetModules()
    const { clockService: fresh } = await import('./clock.js')

    expect(fresh.isRehearsal()).toBe(false)
  })
})
