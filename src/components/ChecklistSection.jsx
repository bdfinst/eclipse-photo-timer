import { useState } from 'react'
import { CHECKLIST_GROUPS, CHECKLIST_STORAGE_KEY, resetChecklist } from '../data/checklist.js'
import { getItem, setItem } from '../services/storage.js'
import { CHECKBOX_CLASS } from './formClasses.js'

function ChecklistSection() {
  const [checked, setChecked] = useState(() => getItem(CHECKLIST_STORAGE_KEY, {}))
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(CHECKLIST_GROUPS.map((group) => [group.id, true])),
  )

  function toggleItem(itemId) {
    const next = { ...checked, [itemId]: !checked[itemId] }
    setChecked(next)
    setItem(CHECKLIST_STORAGE_KEY, next)
  }

  function toggleGroup(groupId) {
    setOpenGroups((previous) => ({ ...previous, [groupId]: !previous[groupId] }))
  }

  function handleReset() {
    resetChecklist()
    setChecked({})
  }

  return (
    <section className="border border-line bg-panel/70">
      <div className="flex min-h-14 items-center justify-between border-b border-line pr-2 pl-4">
        <h2 className="font-display text-base font-medium tracking-[0.25em] uppercase text-dim">
          Checklist
        </h2>
        <button
          type="button"
          className="min-h-11 px-2 font-mono text-[0.65rem] tracking-[0.2em] uppercase text-dim underline-offset-4 transition-colors hover:text-corona hover:underline"
          onClick={handleReset}
        >
          Reset all
        </button>
      </div>
      {CHECKLIST_GROUPS.map((group) => (
        <div key={group.id} className="border-b border-line/60 last:border-0">
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between px-4 text-left font-display text-sm font-medium tracking-[0.2em] uppercase text-ink transition-colors hover:text-corona"
            onClick={() => toggleGroup(group.id)}
            aria-expanded={Boolean(openGroups[group.id])}
          >
            {group.title}
            {/* aria-hidden: decorative — must not leak into the button's
                accessible name, which tests (and screen readers) key on. */}
            <span aria-hidden="true" className="flex items-center gap-2">
              <span className="font-mono text-[0.65rem] tabular-nums text-dim">
                {group.items.filter((item) => checked[item.id]).length}/{group.items.length}
              </span>
              <span
                className={`font-mono text-xs text-corona/70 transition-transform duration-200 ${
                  openGroups[group.id] ? 'rotate-90' : ''
                }`}
              >
                ▸
              </span>
            </span>
          </button>
          {openGroups[group.id] && (
            <ul className="pb-2">
              {group.items.map((item) => (
                <li key={item.id}>
                  <label className="flex min-h-14 w-full items-center gap-3 px-4 text-sm leading-snug text-ink/90 has-checked:text-dim has-checked:line-through">
                    <input
                      type="checkbox"
                      className={CHECKBOX_CLASS}
                      checked={Boolean(checked[item.id])}
                      onChange={() => toggleItem(item.id)}
                    />
                    {item.text}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  )
}

export default ChecklistSection
