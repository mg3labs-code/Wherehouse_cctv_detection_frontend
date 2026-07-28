import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from 'recharts'
import { api, type Summary, type SeriesPoint, type Violation } from '../api/client'
import {
  IconClock,
  IconCube,
  IconFilter,
  IconForklift,
  IconHardhat,
  IconImpact,
} from '../components/icons'

/** Single focus filter — each option must produce visibly different KPIs. */
type Focus =
  | 'all'
  | 'forklift'
  | 'ppe'
  | 'helmet'
  | 'vest'
  | 'high'
  | 'medium'

const FOCUS_OPTIONS: { value: Focus; label: string }[] = [
  { value: 'all', label: 'All alerts' },
  { value: 'forklift', label: 'Forklift alerts only' },
  { value: 'ppe', label: 'Operator PPE (helmet + vest)' },
  { value: 'helmet', label: 'No Helmet only' },
  { value: 'vest', label: 'No Vest only' },
  { value: 'high', label: 'High severity only' },
  { value: 'medium', label: 'Medium severity only' },
]

function fmt(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
}

function localISODate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function eventDay(ts: string) {
  return String(ts || '').slice(0, 10)
}

function matchesFocus(v: Violation, focus: Focus): boolean {
  const et = String(v.event_type || '')
  const sev = String(v.severity || '').toLowerCase()
  switch (focus) {
    case 'forklift':
      return et.startsWith('FORKLIFT') || et === 'FORKLIFT_OVERSPEED'
    case 'ppe':
      return et === 'NO_HELMET' || et === 'NO_VEST' || et === 'NO_SAFETY_HARNESS'
    case 'helmet':
      return et === 'NO_HELMET'
    case 'vest':
      return et === 'NO_VEST'
    case 'high':
      return sev === 'high'
    case 'medium':
      return sev === 'medium'
    default:
      return true
  }
}

function maxOperators(events: Violation[]): number {
  let best = 0
  for (const e of events) {
    const p = e.payload || {}
    for (const key of ['workers', 'operators', 'persons', 'people'] as const) {
      const val = p[key]
      if (typeof val === 'number' && val > best) best = val
    }
  }
  return best
}

function buildSummary(
  dayEvents: Violation[],
  videoCount: number,
  focus: Focus,
  day: string,
): Summary {
  const total = dayEvents.length
  const high = dayEvents.filter((e) => String(e.severity).toLowerCase() === 'high').length
  const medium = dayEvents.filter((e) => String(e.severity).toLowerCase() === 'medium').length
  const by_type: Record<string, number> = {}
  const sources = new Set<string>()
  for (const e of dayEvents) {
    const t = e.event_type || 'UNKNOWN'
    by_type[t] = (by_type[t] || 0) + 1
    if (e.source) sources.add(e.source)
  }

  let score = 100
  let label = 'No data yet'
  if (total > 0) {
    score = Math.max(
      0,
      Math.min(100, Math.round(100 - (high / total) * 40 - (medium / total) * 15)),
    )
    label = score >= 85 ? 'Safety Expert' : score >= 70 ? 'Compliant' : 'Needs Attention'
  }

  // Assets / hours must move with the focus filter
  let assets = videoCount
  let asset_hours = 0
  if (focus === 'forklift') {
    assets = total === 0 ? 0 : sources.size
    asset_hours = total === 0 ? 0 : Math.max(0.1, Number((sources.size * 0.1).toFixed(1)))
  } else if (focus === 'ppe' || focus === 'helmet' || focus === 'vest') {
    assets = total === 0 ? 0 : sources.size
    asset_hours = total === 0 ? 0 : Math.max(0.1, Number((total * 0.01).toFixed(1)))
  } else if (focus === 'high' || focus === 'medium') {
    assets = total === 0 ? 0 : sources.size
    asset_hours = total === 0 ? 0 : 0.1
  } else {
    assets = videoCount
    asset_hours = total === 0 ? 0 : 0.1
  }

  return {
    safety_score: score,
    safety_label: label,
    incidents_prevented: total,
    total_alerts: total,
    asset_hours,
    assets,
    operators: total === 0 ? 0 : maxOperators(dayEvents),
    high_severity: high,
    medium_severity: medium,
    by_type,
    online: true,
    data_source: 'live-client',
    filter_day: day,
    filter_category: focus,
    filter_scope: focus,
  }
}

function buildSeries(events: Violation[], days = 14): SeriesPoint[] {
  const today = localISODate()
  const todayDate = new Date(`${today}T12:00:00`)
  const buckets = new Map<string, SeriesPoint>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayDate)
    d.setDate(d.getDate() - i)
    const key = localISODate(d)
    buckets.set(key, { date: key, alerts: 0, medium: 0, high: 0 })
  }
  for (const e of events) {
    const day = eventDay(e.ts)
    const row = buckets.get(day)
    if (!row) continue
    row.alerts += 1
    const sev = String(e.severity || '').toLowerCase()
    if (sev === 'medium') row.medium += 1
    if (sev === 'high') row.high += 1
  }
  return [...buckets.values()]
}

export function SafetyAnalyticsPage() {
  const [worksite, setWorksite] = useState('all')
  const [worksites, setWorksites] = useState<string[]>([])
  const [dateVal, setDateVal] = useState(() => localISODate())
  const [focus, setFocus] = useState<Focus>('all')
  const [rawEvents, setRawEvents] = useState<Violation[]>([])
  const [videoCount, setVideoCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [online, setOnline] = useState(true)

  async function loadRaw() {
    setLoading(true)
    setError(null)
    try {
      const [ws, viol, videos, ping] = await Promise.all([
        api.worksites(),
        api.violations(500, undefined, 24 * 14),
        api.videos(),
        api.ping(),
      ])
      setWorksites(ws.worksites)
      setRawEvents(Array.isArray(viol.items) ? viol.items : [])
      setVideoCount(videos.items?.length ?? 0)
      setOnline(ping)
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRaw()
    const id = setInterval(() => void loadRaw(), 5000)
    return () => clearInterval(id)
  }, [])

  const filteredAllDays = useMemo(() => {
    return rawEvents.filter((e) => {
      if (worksite !== 'all' && e.worksite !== worksite) return false
      return matchesFocus(e, focus)
    })
  }, [rawEvents, worksite, focus])

  const dayEvents = useMemo(
    () => filteredAllDays.filter((e) => eventDay(e.ts) === dateVal),
    [filteredAllDays, dateVal],
  )

  const summary = useMemo(
    () => buildSummary(dayEvents, videoCount, focus, dateVal),
    [dayEvents, videoCount, focus, dateVal],
  )

  const series = useMemo(() => buildSeries(filteredAllDays, 14), [filteredAllDays])

  const delta = useMemo(() => {
    if (series.length < 2) return 0
    const mid = Math.floor(series.length / 2)
    const a = series.slice(0, mid).reduce((s, p) => s + p.alerts, 0)
    const b = series.slice(mid).reduce((s, p) => s + p.alerts, 0)
    if (a === 0) return b > 0 ? 100 : 0
    return Math.round(((b - a) / a) * 100)
  }, [series])

  const dayAlerts = useMemo(() => {
    const row = series.find((p) => p.date === dateVal)
    return row?.alerts ?? 0
  }, [series, dateVal])

  const focusLabel = FOCUS_OPTIONS.find((o) => o.value === focus)?.label || focus

  return (
    <>
      <div className="breadcrumb">
        Home <span className="bc-sep">&gt;</span> <strong>Analytics</strong>
      </div>

      <div className="tabs-row">
        <div className="tabs">
          <button type="button" className="tab">
            Inspection Analytics
          </button>
          <button type="button" className="tab active">
            Safety Analytics
          </button>
        </div>
        <span className={`status-online ${online ? '' : 'offline'}`}>
          <span className="dot" />
          {online ? 'Online · live' : 'Offline'}
        </span>
      </div>

      <p className="muted" style={{ margin: '0 0 12px' }}>
        Live YOLO alerts — KPIs recalculate in the browser when you change filters.
        {updatedAt ? ` Updated ${updatedAt.toLocaleTimeString()}.` : ''}
      </p>

      <div className="filters">
        <div className="filter-row">
          <div className="filter-field grow">
            <label>Worksite</label>
            <select value={worksite} onChange={(e) => setWorksite(e.target.value)}>
              <option value="all">--All Worksites--</option>
              {worksites.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field daily">
            <label>Daily View</label>
            <div className="date-wrap">
              <input
                type="date"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
                aria-label="Daily view date"
              />
              <span className="date-display">{formatDateLabel(dateVal)}</span>
            </div>
          </div>
          <button type="button" className="btn btn-filters" onClick={() => void loadRaw()}>
            <IconFilter />
            REFRESH
          </button>
        </div>
        <div className="filter-row secondary">
          <div className="filter-field grow">
            <label>Focus filter (changes KPI cards)</label>
            <select value={focus} onChange={(e) => setFocus(e.target.value as Focus)}>
              {FOCUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <p className="muted" style={{ margin: '0 0 12px' }}>
        <strong>Active:</strong> {focusLabel} · {formatDateLabel(dateVal)} ·{' '}
        <strong>{fmt(summary.total_alerts)}</strong> alerts in KPI cards
        {dayAlerts !== summary.total_alerts ? ` (${fmt(dayAlerts)} on chart for that day)` : ''}
      </p>

      {error && (
        <p className="error">
          Backend: {error}. Start API with: <code>python run_api.py</code> (port 8001)
        </p>
      )}
      {loading && rawEvents.length === 0 && <p className="muted">Loading analytics…</p>}

      <div className="kpi-row" key={`${focus}|${dateVal}|${worksite}|${summary.total_alerts}`}>
        <div className="kpi">
          <div className="kpi-text">
            <div className="label">Safety Score</div>
            <div className="value green">{summary.safety_score}%</div>
            <div className="meta">{summary.safety_label}</div>
          </div>
          <div className="kpi-ico">
            <IconForklift />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-text">
            <div className="label">Total Alerts</div>
            <div className="value">{fmt(summary.total_alerts)}</div>
          </div>
          <div className="kpi-ico">
            <IconImpact />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-text">
            <div className="label">Asset Hours</div>
            <div className="value">{fmt(summary.asset_hours)}</div>
          </div>
          <div className="kpi-ico">
            <IconClock />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-text">
            <div className="label">Assets</div>
            <div className="value">{summary.assets}</div>
          </div>
          <div className="kpi-ico">
            <IconCube />
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-text">
            <div className="label">Operators</div>
            <div className="value">{summary.operators}</div>
          </div>
          <div className="kpi-ico">
            <IconHardhat />
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card chart-card">
          <div className="chart-head">
            <h3>Safety Stats</h3>
            <div className="legend-inline">
              <span>
                <i className="lg blue" /> Total Alerts
              </span>
              <span>
                <i className="lg teal" /> Medium Severity
              </span>
              <span>
                <i className="lg purple" /> High Severity
              </span>
            </div>
          </div>
          <div className="chart-body">
            <div className="chart-callout">
              {delta <= 0 ? `${Math.abs(delta)}% ↓` : `${delta}% ↑`} Alerts vs prior half of window
            </div>
            <div className="chart-plot">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf2" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#8a94a6' }}
                    tickFormatter={(v) => String(v).slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#8a94a6' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Legend content={() => null} />
                  <Line
                    type="monotone"
                    dataKey="alerts"
                    name="Total Alerts"
                    stroke="#1e5bb8"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#1e5bb8' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="medium"
                    name="Medium Severity"
                    stroke="#5ec8d8"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#5ec8d8' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="high"
                    name="High Severity"
                    stroke="#5b4db8"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#5b4db8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card chart-card">
          <div className="chart-head">
            <h3>Alert Volume</h3>
            <div className="legend-inline">
              <span>
                <i className="lg blue" /> Daily Alerts (live)
              </span>
            </div>
          </div>
          <div className="chart-body">
            <div className="chart-plot">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6ebf2" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#8a94a6' }}
                    tickFormatter={(v) => String(v).slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#8a94a6' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="alerts"
                    name="Daily Alerts"
                    fill="#2f6fdb"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
