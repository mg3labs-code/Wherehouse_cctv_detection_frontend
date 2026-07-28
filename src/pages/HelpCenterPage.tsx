const TOPICS = [
  {
    title: 'Getting started',
    body: 'Open Live Monitor, pick a CCTV clip or upload a video, then click Start Monitor. YOLO overlays appear once the model loads (~15 seconds).',
  },
  {
    title: 'Inspect Asset',
    body: 'View all uploaded CCTV files. Click Play Video to open Live Monitor with that clip selected and monitoring started automatically.',
  },
  {
    title: 'Analytics',
    body: 'KPI cards and charts update from live YOLO alerts. Use the Focus filter to narrow by alert type or severity, then download Daily / Weekly / Monthly / Yearly CSV reports.',
  },
  {
    title: 'Reports',
    body: 'Download violation logs for the last 24 hours, 7 days, or 30 days. Schedule preferences are saved in your browser.',
  },
  {
    title: 'Checklist Settings',
    body: 'Turn individual safety detection rules on or off. Changes apply to future Live Monitor sessions.',
  },
  {
    title: 'Troubleshooting',
    body: 'If the feed stays on “Connecting…”, hard-refresh the page. Ensure the backend API is online (green status). On Railway, confirm both frontend and backend services are deployed.',
  },
]

export function HelpCenterPage() {
  return (
    <>
      <div className="breadcrumb">
        Home &gt; <strong>Help Center</strong>
      </div>
      <div className="card">
        <h3>Help Center</h3>
        <p className="muted">
          Quick guides for Hypervis Warehouse Safety. For support, contact your account administrator.
        </p>
        <div className="help-topics">
          {TOPICS.map((topic) => (
            <section key={topic.title} className="help-topic">
              <h4>{topic.title}</h4>
              <p className="muted">{topic.body}</p>
            </section>
          ))}
        </div>
        <p className="card-note">
          Backend API: <code>wherehousecctvdetection-production.up.railway.app</code>
        </p>
      </div>
    </>
  )
}
