import type { CSSProperties } from 'react'
import { useAppState } from '../lib/useAppState'
import { useArtColor } from '../lib/useArtColor'
import { useSongTime } from '../lib/clock'
import { lookFor } from '../lib/look'
import { activeLineIndex, type Line } from '../lib/lrc'
import { LineWords } from './LyricsView'

function OverlayLines({ lines, trackLoaded }: { lines: Line[]; trackLoaded: boolean }) {
  const t = useSongTime()
  const active = activeLineIndex(lines, t)
  const line = lines[active]
  const next = lines.slice(active + 1).find((l) => l.text)
  return (
    <>
      {line?.text ? (
        <div className="ov-line line active" key={active}>
          <LineWords line={line} t={t} />
        </div>
      ) : (
        <div className="ov-line idle">{trackLoaded ? '♪' : 'Play something on Spotify'}</div>
      )}
      {next && <div className="ov-next">{next.text}</div>}
    </>
  )
}

export default function Overlay() {
  const { ready, settings, playback, lines } = useAppState()
  const accent = useArtColor(playback.track?.artUrl)
  if (!ready) return null
  const look = lookFor(settings, accent)
  const kind = settings.style === 'karaoke' ? 'style-karaoke' : 'style-glow'
  const style = { ...look.style, '--scale': settings.ui.overlayScale, '--ov-bg': settings.ui.overlayOpacity } as CSSProperties
  return (
    <div
      className={`overlay ${look.className} ${settings.overlayLocked ? 'locked' : ''} ${settings.ui.overlayShowNext ? '' : 'ov-no-next'}`}
      style={style}
    >
      <div className={`overlay-inner ${kind}`}>
        <OverlayLines lines={lines} trackLoaded={!!playback.track} />
      </div>
    </div>
  )
}
