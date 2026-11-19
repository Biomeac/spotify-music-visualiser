import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useAppState, useSongTime } from './lib/useAppState'
import { useArtColor } from './lib/useArtColor'
import { plainToLines } from './lib/lrc'
import LyricsView from './components/LyricsView'
import Setup from './components/Setup'
import SearchBar from './components/SearchBar'
import NowPlaying from './components/NowPlaying'
import SettingsPanel from './components/SettingsPanel'

export default function App() {
  const { ready, settings, auth, playback, lyrics, lines, error: pollError } = useAppState()
  const t = useSongTime(playback, settings.offsetMs)
  const accent = useArtColor(playback.track?.artUrl)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const onError = useCallback((m: string) => setToast(m), [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  if (!ready) return <div className="app" />

  const vars = { '--accent': accent, '--scale': settings.fontScale } as CSSProperties
  const track = playback.track

  let body
  if (!auth.loggedIn) body = <Setup settings={settings} auth={auth} />
  else if (!track)
    body = (
      <div className="empty">
        <div className="eyebrow">Nothing playing</div>
        <h1>Search any song to start.</h1>
        <p className="lede">Or press play in Spotify. Lyrics follow whatever you are listening to.</p>
      </div>
    )
  else if (lines.length) body = <LyricsView lines={lines} t={t} style={settings.style} onSeek={(s) => window.api.control('seek', s * 1000)} />
  else if (lyrics?.status === 'plain-only' && lyrics.plain)
    body = (
      <div className="lyrics plain">
        <div className="eyebrow">Not time-synced</div>
        {plainToLines(lyrics.plain).map((l, i) => (
          <div key={i} className="line">
            {l || ' '}
          </div>
        ))}
      </div>
    )
  else
    body = (
      <div className="empty">
        <div className="eyebrow">{track.artists}</div>
        <h1>{track.name}</h1>
        <p className="lede">
          {!lyrics || lyrics.status === 'loading'
            ? 'Finding lyrics…'
            : lyrics.status === 'instrumental'
              ? 'Instrumental. Enjoy the music.'
              : lyrics.status === 'error'
                ? `Couldn't reach the lyrics service (${lyrics.source}).`
                : 'No lyrics found for this one yet.'}
        </p>
      </div>
    )

  return (
    <div className="app" style={vars}>
      {track?.artUrl && (
        <div className="bg" key={track.id}>
          <img src={track.artUrl} alt="" />
        </div>
      )}
      <div className="vignette" />
      <header className="topbar">
        {auth.loggedIn && <SearchBar onError={onError} />}
        {auth.loggedIn && (
          <div className="top-actions">
            <button
              className={`chip ${settings.overlayVisible ? 'on' : ''}`}
              onClick={() => window.api.setSettings({ overlayVisible: !settings.overlayVisible })}
              title="Floating lyrics over every app"
            >
              Overlay
            </button>
            <button className="chip" onClick={() => setShowSettings(true)}>
              Styles
            </button>
          </div>
        )}
      </header>
      <main className="stage">{body}</main>
      {auth.loggedIn && <NowPlaying playback={playback} t={t} />}
      {(toast || pollError) && <div className="toast">{toast ?? pollError}</div>}
      {showSettings && <SettingsPanel settings={settings} auth={auth} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
