import type { CSSProperties } from 'react'
import { useAppState, useSongTime } from '../lib/useAppState'
import { useArtColor } from '../lib/useArtColor'
import { activeLineIndex } from '../lib/lrc'
import { LineWords } from './LyricsView'

export default function Overlay() {
  const { ready, settings, playback, lines } = useAppState()
  const t = useSongTime(playback, settings.offsetMs)
  const accent = useArtColor(playback.track?.artUrl)
  if (!ready) return null
  const active = activeLineIndex(lines, t)
  const line = lines[active]
  const next = lines.slice(active + 1).find((l) => l.text)
  const kind = settings.style === 'karaoke' ? 'style-karaoke' : 'style-glow'
  return (
    <div
      className={`overlay ${settings.overlayLocked ? 'locked' : ''}`}
      style={{ '--accent': accent, '--scale': settings.fontScale } as CSSProperties}
    >
      <div className={`overlay-inner ${kind}`}>
        {line?.text ? (
          <div className="ov-line line active" key={active}>
            <LineWords line={line} t={t} />
          </div>
        ) : (
          <div className="ov-line idle">{playback.track ? '♪' : 'Play something on Spotify'}</div>
        )}
        {next && <div className="ov-next">{next.text}</div>}
      </div>
    </div>
  )
}
