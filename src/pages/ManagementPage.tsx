import { useEffect, useState } from 'react'
import { api } from '../api/client'

type TeamMember = {
  name: string
  role: string
  worksite: string
}

const TEAM: TeamMember[] = [
  { name: 'Safety Admin', role: 'Account Owner', worksite: 'All Worksites' },
  { name: 'Shift Supervisor', role: 'Supervisor', worksite: 'Hypervis Warehouse' },
  { name: 'Floor Operator', role: 'Operator', worksite: 'Hypervis Warehouse' },
]

export function ManagementPage() {
  const [worksites, setWorksites] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .worksites()
      .then((r) => setWorksites(r.worksites))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load worksites'))
  }, [])

  return (
    <>
      <div className="breadcrumb">
        Home &gt; <strong>Management</strong>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Worksites</h3>
          <p className="muted">Sites reporting safety alerts to this dashboard.</p>
          {error && <p className="error">{error}</p>}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Worksite</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {worksites.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      No worksites yet — alerts will appear after Live Monitor runs.
                    </td>
                  </tr>
                )}
                {worksites.map((site, i) => (
                  <tr key={site}>
                    <td>{i + 1}</td>
                    <td>{site}</td>
                    <td>
                      <span className="badge low">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Team &amp; Roles</h3>
          <p className="muted">Warehouse safety team with dashboard access.</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Worksite</th>
                </tr>
              </thead>
              <tbody>
                {TEAM.map((member) => (
                  <tr key={member.name}>
                    <td>{member.name}</td>
                    <td>{member.role}</td>
                    <td className="muted">{member.worksite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
