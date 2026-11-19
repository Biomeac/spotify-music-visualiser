import type { PlaybackState } from '../../../shared'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function NowPlaying({ playback, t }: { playback: PlaybackState; t: number }) {
  const track = playback.track
  if (!track) return null
  const dur = track.durationMs / 1000
  const pos = Math.max(0, Math.min(dur, t))
  const ctl = (a: 'play' | 'pause' | 'next' | 'previous') => window.api.control(a).catch(() => {})
  return (
    <div className="nowplaying">
      {track.artUrl && <img src={track.artUrl} alt="" />}
      <div className="np-meta">
        <div className="title">{track.name}</div>
        <div className="sub">
          {track.artists}
          {playback.device ? ` · on ${playback.device}` : ''}
        </div>
      </div>
      <div className="np-controls">
        <button onClick={() => ctl('previous')} aria-label="Previous">
          ⏮
        </button>
        <button className="pp" onClick={() => ctl(playback.isPlaying ? 'pause' : 'play')} aria-label="Play or pause">
          {playback.isPlaying ? '❚❚' : '▶'}
        </button>
        <button onClick={() => ctl('next')} aria-label="Next">
          ⏭
        </button>
      </div>
      <div className="np-progress">
        <span>{fmt(pos)}</span>
        <div
          className="bar"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            window.api.control('seek', ((e.clientX - r.left) / r.width) * track.durationMs).catch(() => {})
          }}
        >
          <div style={{ width: `${(pos / dur) * 100}%` }} />
        </div>
        <span>{fmt(dur)}</span>
      </div>
    </div>
  )
}
