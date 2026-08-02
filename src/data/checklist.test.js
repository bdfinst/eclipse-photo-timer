import { describe, expect, it } from 'vitest'
import { CHECKLIST_GROUPS, checklistProgress } from './checklist.js'

describe('checklistProgress', () => {
  it('reports zero done and 0% for every group with an empty checked map', () => {
    const progress = checklistProgress({})

    expect(progress).toHaveLength(CHECKLIST_GROUPS.length)
    for (const group of progress) {
      expect(group.done).toBe(0)
      expect(group.percent).toBe(0)
    }
  })

  it('reports 100% for a fully-checked group', () => {
    const [firstGroup] = CHECKLIST_GROUPS
    const checked = Object.fromEntries(firstGroup.items.map((item) => [item.id, true]))

    const progress = checklistProgress(checked)

    expect(progress[0]).toMatchObject({
      id: firstGroup.id,
      done: firstGroup.items.length,
      total: firstGroup.items.length,
      percent: 100,
    })
  })

  it('rounds partial percentages to the nearest integer, per group', () => {
    // Check exactly one item in every group — each group's expected value
    // is derived from its own size rather than hardcoded counts, so this
    // test doesn't break when checklist items are added or removed.
    const checked = Object.fromEntries(CHECKLIST_GROUPS.map((group) => [group.items[0].id, true]))

    const progress = checklistProgress(checked)

    for (const [index, group] of CHECKLIST_GROUPS.entries()) {
      expect(progress[index].done).toBe(1)
      expect(progress[index].percent).toBe(Math.round((1 / group.items.length) * 100))
    }
  })

  it('ignores explicitly-false entries and ids that belong to no group', () => {
    const progress = checklistProgress({
      'night-battery': false,
      'removed-item-from-an-old-version': true,
    })

    for (const group of progress) {
      expect(group.done).toBe(0)
    }
  })
})
