import { resolveApiOrigin } from '../api/client'

export function SettingsPage() {
  const apiOrigin = resolveApiOrigin() || '(same origin / Vite proxy)'

  return (
    <>
      <div className="breadcrumb">Home &gt; <strong>Settings</strong></div>
      <div className="card">
        <h3>System Settings</h3>
        <p className="muted">
          API origin: <code>{apiOrigin}</code>. Dev proxies JSON <code>/api</code> →{' '}
          <code>http://127.0.0.1:8001</code> when no <code>VITE_API_ORIGIN</code> is set.
        </p>
        <ul className="muted">
          <li>Backend: FastAPI (local :8001 or Railway)</li>
          <li>Frontend: <code>npm run dev</code> → React :5173</li>
          <li>Live: MJPEG / frame snapshots from ComplianceMonitor</li>
        </ul>
      </div>
    </>
  )
}
