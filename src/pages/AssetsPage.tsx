import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type VideoItem } from '../api/client'

export function AssetsPage() {
  const navigate = useNavigate()
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.videos()
      .then((r) => setVideos(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  function playVideo(video: VideoItem) {
    const qs = new URLSearchParams({
      source: video.path,
      autostart: '1',
    })
    navigate(`/live?${qs}`)
  }

  return (
    <>
      <div className="breadcrumb">Home &gt; <strong>Inspect Asset</strong></div>
      <div className="card">
        <h3>Camera / Video Assets</h3>
        {error && <p className="error">{error}</p>}
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Path</th>
                <th>Size</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.path}>
                  <td>{v.id}</td>
                  <td>{v.name}</td>
                  <td className="muted">{v.path}</td>
                  <td>{v.size_mb} MB</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => playVideo(v)}
                    >
                      Play Video
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
