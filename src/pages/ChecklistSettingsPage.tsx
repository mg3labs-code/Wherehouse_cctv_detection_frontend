import { useEffect, useState } from 'react'

const STORAGE_KEY = 'hypervis.checklistSettings'

type ChecklistItem = {
  id: string
  label: string
  description: string
  enabled: boolean
}

const DEFAULT_ITEMS: ChecklistItem[] = [
  {
    id: 'ppe-helmet',
    label: 'PPE — Helmet',
    description: 'Require hard hat detection before zone entry.',
    enabled: true,
  },
  {
    id: 'ppe-vest',
    label: 'PPE — Safety Vest',
    description: 'Require high-visibility vest on operators.',
    enabled: true,
  },
  {
    id: 'forklift-speed',
    label: 'Forklift Speed Limit',
    description: 'Alert when forklift exceeds configured aisle speed.',
    enabled: true,
  },
  {
    id: 'forklift-route',
    label: 'Safe Route / Aisle Lock',
    description: 'Enforce designated forklift travel paths.',
    enabled: true,
  },
  {
    id: 'conveyor-proximity',
    label: 'Conveyor Proximity',
    description: 'Alert when personnel enter conveyor danger zones.',
    enabled: true,
  },
  {
    id: 'harness',
    label: 'Safety Harness',
    description: 'Check harness compliance at height work areas.',
    enabled: false,
  },
]

function loadItems(): ChecklistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_ITEMS
    const saved = JSON.parse(raw) as Record<string, boolean>
    return DEFAULT_ITEMS.map((item) => ({
      ...item,
      enabled: saved[item.id] ?? item.enabled,
    }))
  } catch {
    return DEFAULT_ITEMS
  }
}

function saveItems(items: ChecklistItem[]) {
  const payload = Object.fromEntries(items.map((item) => [item.id, item.enabled]))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function ChecklistSettingsPage() {
  const [items, setItems] = useState<ChecklistItem[]>(() => loadItems())
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  useEffect(() => {
    saveItems(items)
    setSavedAt(new Date())
  }, [items])

  function toggle(id: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item)),
    )
  }

  const activeCount = items.filter((item) => item.enabled).length

  return (
    <>
      <div className="breadcrumb">
        Home &gt; <strong>Checklist Settings</strong>
      </div>
      <div className="card">
        <h3>Safety Checklist Rules</h3>
        <p className="muted">
          Enable or disable YOLO detection rules used during Live Monitor sessions.{' '}
          {activeCount} of {items.length} active.
          {savedAt ? ` Saved ${savedAt.toLocaleTimeString()}.` : ''}
        </p>
        <div className="settings-list">
          {items.map((item) => (
            <label key={item.id} className="settings-row">
              <div className="settings-row-text">
                <strong>{item.label}</strong>
                <span className="muted">{item.description}</span>
              </div>
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => toggle(item.id)}
                aria-label={`Toggle ${item.label}`}
              />
            </label>
          ))}
        </div>
      </div>
    </>
  )
}
