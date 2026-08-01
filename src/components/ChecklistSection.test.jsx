import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import ChecklistSection from './ChecklistSection.jsx'
import { CHECKLIST_STORAGE_KEY } from '../data/checklist.js'

describe('ChecklistSection', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists a checked item to localStorage', () => {
    render(<ChecklistSection />)

    const checkbox = screen.getByLabelText('Charge camera battery + two spares')
    fireEvent.click(checkbox)

    expect(checkbox).toBeChecked()
    const persisted = JSON.parse(localStorage.getItem(CHECKLIST_STORAGE_KEY))
    expect(persisted['night-battery']).toBe(true)
  })

  it('renders persisted checked items as checked after a fresh render', () => {
    localStorage.setItem(
      CHECKLIST_STORAGE_KEY,
      JSON.stringify({ 'night-battery': true, 'camera-af': true, 't15-focus': true }),
    )

    render(<ChecklistSection />)

    expect(screen.getByLabelText('Charge camera battery + two spares')).toBeChecked()
    expect(screen.getByLabelText('AF set to MF')).toBeChecked()
    expect(screen.getByLabelText('Focus locked and taped')).toBeChecked()
    expect(screen.getByLabelText('Rec View OFF')).not.toBeChecked()
  })

  it('clears all checked items and localStorage when reset all is invoked', () => {
    localStorage.setItem(
      CHECKLIST_STORAGE_KEY,
      JSON.stringify({ 'night-battery': true, 'camera-af': true }),
    )
    render(<ChecklistSection />)
    expect(screen.getByLabelText('AF set to MF')).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }))

    expect(screen.getByLabelText('Charge camera battery + two spares')).not.toBeChecked()
    expect(screen.getByLabelText('AF set to MF')).not.toBeChecked()
    expect(localStorage.getItem(CHECKLIST_STORAGE_KEY)).toBeNull()
  })

  it('renders all items unchecked without throwing when persisted data is malformed', () => {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, '{not valid json')

    expect(() => render(<ChecklistSection />)).not.toThrow()
    expect(screen.getByLabelText('Charge camera battery + two spares')).not.toBeChecked()
  })
})
