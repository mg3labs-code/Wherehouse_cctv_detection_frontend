import { useEffect, useState } from 'react'
import { api, type Violation } from '../api/client'

export function ReportsPage() {
  const [items, setItems] = useState<Violation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  async function load() {
    try {
      const r = await api.violations(100)
      setItems(r.items)
      setUpdatedAt(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <div className="breadcrumb">Home &gt; <strong>Reports</strong></div>
      <div className="card">
        <h3>Violation Report</h3>
        <p className="muted">
          Live alerts from the monitor (deduped). Not demo seed data.
          {updatedAt ? ` Updated ${updatedAt.toLocaleTimeString()}.` : ''}
        </p>
        {error && <p className="error">{error}</p>}
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Severity</th>
                <th>Profile</th>
                <th>Worksite</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !error && (
                <tr>
                  <td colSpan={6} className="muted">
                    No alerts yet — start Live Monitor to generate real-time events.
                  </td>
                </tr>
              )}
              {items.map((v) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{new Date(v.ts).toLocaleString()}</td>
                  <td>{v.event_type}</td>
                  <td><span className={`badge ${v.severity}`}>{v.severity}</span></td>
                  <td>{v.profile}</td>
                  <td>{v.worksite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
