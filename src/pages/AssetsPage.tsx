import { useEffect, useState } from 'react'
import { api, type VideoItem } from '../api/client'

export function AssetsPage() {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<VideoItem | null>(null)

  useEffect(() => {
    api.videos()
      .then((r) => setVideos(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
  }, [])

  function closePlayer() {
    setPlaying(null)
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
                      onClick={() => setPlaying(v)}
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

      {playing && (
        <div
          className="video-modal-backdrop"
          role="presentation"
          onClick={closePlayer}
        >
          <div
            className="video-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Playing ${playing.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="video-modal-head">
              <h3>{playing.name}</h3>
              <button type="button" className="btn" onClick={closePlayer}>
                Close
              </button>
            </div>
            <video
              key={playing.name}
              className="video-player"
              src={api.videoUrl(playing.name)}
              controls
              autoPlay
              playsInline
            >
              Your browser does not support video playback.
            </video>
          </div>
        </div>
      )}
    </>
  )
}
