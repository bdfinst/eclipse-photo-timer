import { useState } from 'react'
import { CHECKLIST_GROUPS, CHECKLIST_STORAGE_KEY } from '../data/checklist.js'
import { getItem, setItem } from '../services/storage.js'

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

  return (
    <section>
      {CHECKLIST_GROUPS.map((group) => (
        <div key={group.id}>
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between text-left font-semibold"
            onClick={() => toggleGroup(group.id)}
            aria-expanded={Boolean(openGroups[group.id])}
          >
            {group.title}
          </button>
          {openGroups[group.id] && (
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <label className="flex min-h-14 w-full items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-6 w-6"
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
