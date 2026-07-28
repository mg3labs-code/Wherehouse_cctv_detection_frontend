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
import { api, type Summary, type SeriesPoint } from '../api/client'
import {
  IconClock,
  IconCube,
  IconFilter,
  IconForklift,
  IconHardhat,
  IconImpact,
} from '../components/icons'

type FilterBy = 'all' | 'assets' | 'operators' | 'alerts'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US').format(n)
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

function defaultScope(filterBy: FilterBy): string {
  if (filterBy === 'assets') return 'all'
  if (filterBy === 'operators') return 'ppe'
  if (filterBy === 'alerts') return 'all'
  return 'all'
}

function scopeOptions(filterBy: FilterBy): { value: string; label: string }[] {
  if (filterBy === 'assets') {
    return [
      { value: 'all', label: 'All Assets' },
      { value: 'forklift', label: 'Forklifts' },
      { value: 'cameras', label: 'Cameras' },
    ]
  }
  if (filterBy === 'operators') {
    return [
      { value: 'ppe', label: 'All PPE alerts' },
      { value: 'helmet', label: 'No Helmet' },
      { value: 'vest', label: 'No Vest' },
    ]
  }
  if (filterBy === 'alerts') {
    return [
      { value: 'all', label: 'All Alerts' },
      { value: 'high', label: 'High severity' },
      { value: 'medium', label: 'Medium severity' },
      { value: 'NO_HELMET', label: 'NO_HELMET' },
      { value: 'NO_VEST', label: 'NO_VEST' },
      { value: 'FORKLIFT_OVERSPEED', label: 'FORKLIFT_OVERSPEED' },
    ]
  }
  return [{ value: 'all', label: 'All' }]
}

function scopeLabel(filterBy: FilterBy) {
  if (filterBy === 'assets') return 'Select Asset'
  if (filterBy === 'operators') return 'Operator focus'
  if (filterBy === 'alerts') return 'Alert type'
  return 'Scope'
}

export function SafetyAnalyticsPage() {
  const [worksite, setWorksite] = useState('all')
  const [worksites, setWorksites] = useState<string[]>([])
  const [dateVal, setDateVal] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterBy, setFilterBy] = useState<FilterBy>('all')
  const [scope, setScope] = useState('all')

  const [summary, setSummary] = useState<Summary | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const filterOpts = useMemo(
    () => ({
      worksite: worksite === 'all' ? undefined : worksite,
      day: dateVal || undefined,
      category: filterBy === 'all' ? undefined : filterBy,
      scope: filterBy === 'all' ? undefined : scope,
    }),
    [worksite, dateVal, filterBy, scope],
  )

  const filterKey = `${worksite}|${dateVal}|${filterBy}|${scope}`

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const opts = {
        worksite: worksite === 'all' ? undefined : worksite,
        day: dateVal || undefined,
        category: filterBy === 'all' ? undefined : filterBy,
        scope: filterBy === 'all' ? undefined : scope,
      }
      const [ws, sum, ts] = await Promise.all([
        api.worksites(),
        api.summary(opts),
        api.timeseries(14, {
          worksite: opts.worksite,
          category: opts.category,
          scope: opts.scope,
        }),
      ])
      setWorksites(ws.worksites)
      setSummary(sum)
      setSeries(
        (ts.series || []).map((p) => ({
          date: p.date,
          alerts: p.alerts ?? p.incidents ?? 0,
          medium: p.medium ?? p.overrides ?? 0,
          high: p.high ?? p.emergency ?? 0,
        })),
      )
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 5000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

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

  const chartSeries = useMemo(() => {
    // Daily View focuses charts around the selected day (still show full window)
    return series
  }, [series])

  function onFilterByChange(next: FilterBy) {
    setFilterBy(next)
    setScope(defaultScope(next))
  }

  const secondaryOptions = scopeOptions(filterBy)

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
        <span className={`status-online ${summary?.online ? '' : 'offline'}`}>
          <span className="dot" />
          {summary?.online ? 'Online · live' : 'Offline'}
        </span>
      </div>

      <p className="muted" style={{ margin: '0 0 12px' }}>
        Real-time alerts from Live Monitor (YOLO), not demo seed data.
        {updatedAt ? ` Updated ${updatedAt.toLocaleTimeString()}.` : ''}
        {` Selected day (${formatDateLabel(dateVal)}): ${fmt(dayAlerts)} chart alerts.`}
        {summary
          ? ` Active filter: ${summary.filter_category || filterBy} / ${summary.filter_scope || scope} → ${fmt(summary.total_alerts ?? 0)} KPI alerts.`
          : ''}
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
          <button type="button" className="btn btn-filters" onClick={() => void load()}>
            <IconFilter />
            FILTERS
          </button>
        </div>
        <div className="filter-row secondary">
          <div className="filter-field">
            <label>Filter by</label>
            <select
              value={filterBy}
              onChange={(e) => onFilterByChange(e.target.value as FilterBy)}
            >
              <option value="all">All</option>
              <option value="assets">Assets</option>
              <option value="operators">Operators</option>
              <option value="alerts">Alerts</option>
            </select>
          </div>
          <div className="filter-field">
            <label>{scopeLabel(filterBy)}</label>
            <select
              value={scope}
              disabled={filterBy === 'all'}
              onChange={(e) => setScope(e.target.value)}
            >
              {secondaryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <p className="error">
          Backend: {error}. Start API with: <code>python run_api.py</code> (port 8001)
        </p>
      )}
      {loading && !summary && <p className="muted">Loading analytics…</p>}

      {summary && (
        <div className="kpi-row" key={filterKey}>
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
              <div className="value">{fmt(summary.total_alerts ?? summary.incidents_prevented)}</div>
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
      )}

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
                <LineChart data={chartSeries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
                <BarChart data={chartSeries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
