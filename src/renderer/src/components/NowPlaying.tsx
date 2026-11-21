import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useSongTime, songPositionMs } from '../lib/clock'
import type { PlaybackState } from '../../../shared'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function Progress({ durationMs }: { durationMs: number }) {
  useSongTime() // re-render each frame
  const dur = durationMs / 1000
  const pos = Math.min(dur, songPositionMs() / 1000)
  return (
    <div className="np-progress">
      <span>{fmt(pos)}</span>
      <div
        className="bar"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          window.api.control('seek', ((e.clientX - r.left) / r.width) * durationMs).catch(() => {})
        }}
      >
        <div style={{ transform: `scaleX(${pos / dur})` }} />
      </div>
      <span>{fmt(dur)}</span>
    </div>
  )
}

export default function NowPlaying({ playback, onError }: { playback: PlaybackState; onError: (m: string) => void }) {
  const track = playback.track
  if (!track) return null
  const ctl = (a: 'play' | 'pause' | 'next' | 'previous') => window.api.control(a).catch((e) => onError(String(e.message)))
  return (
    <div className="nowplaying chrome">
      {track.artUrl && <img src={track.artUrl} alt="" />}
      <div className="np-meta">
        <div className="title">{track.name}</div>
        <div className="sub">
          {track.artists}
          {playback.device ? ` · on ${playback.device}` : ''}
        </div>
      </div>
      <div className="np-controls">
        <button onClick={() => ctl('previous')} aria-label="Previous" title="Previous (P)">
          <SkipBack size={20} fill="currentColor" strokeWidth={1.5} />
        </button>
        <button className="pp" onClick={() => ctl(playback.isPlaying ? 'pause' : 'play')} aria-label="Play or pause" title="Play/pause (Space)">
          {playback.isPlaying ? <Pause size={20} fill="currentColor" strokeWidth={0} /> : <Play size={20} fill="currentColor" strokeWidth={0} style={{ marginLeft: 2 }} />}
        </button>
        <button onClick={() => ctl('next')} aria-label="Next" title="Next (N)">
          <SkipForward size={20} fill="currentColor" strokeWidth={1.5} />
        </button>
      </div>
      <Progress durationMs={track.durationMs} />
    </div>
  )
}
