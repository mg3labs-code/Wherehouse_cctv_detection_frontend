import { useEffect, useMemo, useState } from 'react'
import { api, type Violation } from '../api/client'

type ReportPeriod = 'daily' | 'weekly' | 'monthly'

const SCHEDULE_KEY = 'hypervis.reportDownloadSchedule'

const PERIOD_HOURS: Record<ReportPeriod, number> = {
  daily: 24,
  weekly: 24 * 7,
  monthly: 24 * 30,
}

function periodLabel(p: ReportPeriod) {
  return p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : 'Monthly'
}

function loadSchedule(): { period: ReportPeriod; enabled: boolean } {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY)
    if (!raw) return { period: 'weekly', enabled: false }
    const parsed = JSON.parse(raw) as { period?: ReportPeriod; enabled?: boolean }
    const period =
      parsed.period === 'daily' || parsed.period === 'weekly' || parsed.period === 'monthly'
        ? parsed.period
        : 'weekly'
    return { period, enabled: Boolean(parsed.enabled) }
  } catch {
    return { period: 'weekly', enabled: false }
  }
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function violationsToCsv(rows: Violation[]) {
  const header = ['id', 'timestamp', 'event', 'severity', 'profile', 'worksite', 'source']
  const lines = [header.join(',')]
  for (const v of rows) {
    lines.push(
      [
        String(v.id),
        v.ts,
        v.event_type,
        v.severity,
        v.profile,
        v.worksite,
        v.source || '',
      ]
        .map((c) => csvEscape(String(c ?? '')))
        .join(','),
    )
  }
  return lines.join('\n')
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  const [items, setItems] = useState<Violation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [period, setPeriod] = useState<ReportPeriod>(() => loadSchedule().period)
  const [scheduleEnabled, setScheduleEnabled] = useState(() => loadSchedule().enabled)
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const sinceHours = PERIOD_HOURS[period]

  async function load() {
    try {
      const r = await api.violations(500, undefined, sinceHours)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const rangeHint = useMemo(() => {
    if (period === 'daily') return 'Last 24 hours'
    if (period === 'weekly') return 'Last 7 days'
    return 'Last 30 days'
  }, [period])

  async function downloadReport() {
    setDownloading(true)
    setError(null)
    try {
      const r = await api.violations(500, undefined, sinceHours)
      const stamp = new Date().toISOString().slice(0, 10)
      const filename = `hypervis-violations-${period}-${stamp}.csv`
      downloadBlob(filename, violationsToCsv(r.items), 'text/csv;charset=utf-8')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  function saveSchedule() {
    localStorage.setItem(
      SCHEDULE_KEY,
      JSON.stringify({ period, enabled: scheduleEnabled }),
    )
    setScheduleMsg(
      scheduleEnabled
        ? `${periodLabel(period)} download preference saved. Automatic delivery can be wired to email later.`
        : 'Schedule preference cleared (downloads stay on-demand).',
    )
  }

  return (
    <>
      <div className="breadcrumb">Home &gt; <strong>Reports</strong></div>
      <div className="card">
        <div className="chart-head">
          <h3>Violation Report</h3>
          <div className="report-actions">
            <div className="filter-field">
              <label>Report period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
                aria-label="Report period"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={downloading}
              onClick={() => void downloadReport()}
            >
              {downloading ? 'Preparing…' : 'Download Report'}
            </button>
          </div>
        </div>

        <div className="report-schedule">
          <label className="schedule-check">
            <input
              type="checkbox"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
            />
            Set up recurring downloads ({periodLabel(period).toLowerCase()})
          </label>
          <button type="button" className="btn" onClick={saveSchedule}>
            Save schedule
          </button>
        </div>
        {scheduleMsg && <p className="muted">{scheduleMsg}</p>}

        <p className="muted">
          Live alerts from the monitor (deduped). Showing {rangeHint}.
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
                    No alerts in this period — start Live Monitor or choose a wider range.
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
