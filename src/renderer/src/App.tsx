import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppState } from './lib/useAppState'
import { useArtPalette } from './lib/useArtColor'
import { useActiveLine, songPositionMs, songTime } from './lib/clock'
import { lookFor } from './lib/look'
import { plainToLines } from './lib/lrc'
import Background from './components/Background'
import LyricsView from './components/LyricsView'
import Setup from './components/Setup'
import SearchBar from './components/SearchBar'
import NowPlaying from './components/NowPlaying'
import SettingsPanel from './components/SettingsPanel'
import type { LyricStyle } from '../../shared'

const STYLE_KEYS: LyricStyle[] = ['glow', 'karaoke', 'focus', 'messages', 'kinetic', 'neon', 'typewriter', 'bounce', 'poster', 'vinyl', 'glitch', 'cinema', 'wave']
const clean = (m: string) => m.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export default function App() {
  const { ready, settings, auth, playback, lyrics, lines, error: pollError } = useAppState()
  const palette = useArtPalette(playback.track?.artUrl)
  const active = useActiveLine(lines)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [idle, setIdle] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const onError = useCallback((m: string) => setToast(clean(m)), [])
  const onSeek = useCallback((s: number) => window.api.control('seek', s * 1000).catch(() => {}), [])

  useEffect(() => {
    if (auth.loggedIn) setShowSetup(false)
  }, [auth.loggedIn])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])

  // Hide the controls after 2.5s without mouse movement, for a clean full-screen look.
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    const wake = () => {
      setIdle(false)
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => setIdle(true), 2500)
    }
    wake()
    window.addEventListener('mousemove', wake)
    window.addEventListener('keydown', wake)
    return () => {
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('keydown', wake)
      clearTimeout(idleTimer.current)
    }
  }, [])

  // Keyboard shortcuts.
  const stateRef = useRef({ settings, playback, lines })
  stateRef.current = { settings, playback, lines }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || e.metaKey || e.ctrlKey) return
      const { settings: s, playback: p, lines: ls } = stateRef.current
      const trackId = p.track?.id
      const nudge = (ms: number) => {
        if (!trackId) return
        const cur = s.trackOffsets[trackId] ?? 0
        const next = Math.round((cur + ms) / 50) * 50
        window.api.setSettings({ trackOffsets: { ...s.trackOffsets, [trackId]: next } })
        setToast(`This song's timing: ${next > 0 ? '+' : ''}${(next / 1000).toFixed(2)}s`)
      }
      if (e.key === ' ') {
        e.preventDefault()
        window.api.control(p.isPlaying ? 'pause' : 'play').catch(onError)
      } else if (e.key === 'ArrowRight') window.api.control('seek', songPositionMs() + 5000).catch(onError)
      else if (e.key === 'ArrowLeft') window.api.control('seek', songPositionMs() - 5000).catch(onError)
      else if (e.key === ']') nudge(e.shiftKey ? 500 : 100)
      else if (e.key === '[') nudge(e.shiftKey ? -500 : -100)
      else if (e.key === 't' && trackId) {
        // Tap-to-sync: press T the moment you hear a line start. The nearest line is moved to now.
        const now = songTime() - 0.1 // typical reaction time
        const near = ls.filter((l) => l.text).reduce<{ d: number } | null>((best, l) => {
          const d = l.start - now
          return Math.abs(d) < 4 && (!best || Math.abs(d) < Math.abs(best.d)) ? { d } : best
        }, null)
        if (!near) setToast('Press T right as a line starts to sync this song')
        else {
          const cur = s.trackOffsets[trackId] ?? 0
          const next = Math.round((cur + near.d * 1000) / 10) * 10
          window.api.setSettings({ trackOffsets: { ...s.trackOffsets, [trackId]: next } })
          setToast(`Synced. This song's timing: ${next > 0 ? '+' : ''}${(next / 1000).toFixed(2)}s`)
        }
      } else if (e.key === 'n') window.api.control('next').catch(onError)
      else if (e.key === 'p') window.api.control('previous').catch(onError)
      else if (e.key === 's') setShowSettings((v) => !v)
      else if (e.key === 'o') window.api.setSettings({ overlayVisible: !s.overlayVisible })
      else if (e.key === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
      else if (e.key === 'c') window.api.setSettings({ style: STYLE_KEYS[(STYLE_KEYS.indexOf(s.style) + 1) % STYLE_KEYS.length] })
      else if (/^[1-9]$/.test(e.key)) {
        const style = STYLE_KEYS[Number(e.key) - 1]
        window.api.setSettings({ style })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onError])

  if (!ready) return <div className="app" />

  const look = lookFor(settings, palette.accent)
  const track = playback.track
  // The Spotify app on this Mac needs no sign-in; signing in is only needed for search and other devices.
  const connected = auth.loggedIn || auth.local === 'ok' || auth.local === 'not-running'
  const hideChrome = idle && settings.ui.autoHide && !showSettings && !!track && connected

  let body
  if ((!connected || showSetup) && !auth.loggedIn) body = <Setup settings={settings} auth={auth} onClose={connected ? () => setShowSetup(false) : undefined} />
  else if (!track)
    body = (
      <div className="empty">
        <div className="eyebrow">{auth.local === 'not-running' ? 'Spotify is closed' : 'Nothing playing'}</div>
        <h1>{auth.loggedIn ? 'Search any song to start.' : 'Press play in Spotify.'}</h1>
        <p className="lede">
          {auth.local === 'denied'
            ? 'To follow the Spotify app, allow access in System Settings › Privacy & Security › Automation.'
            : auth.loggedIn
              ? 'Or press play in Spotify. Lyrics follow whatever you are listening to.'
              : 'Lyrics follow the Spotify app automatically. Connect your account once to search from here.'}
        </p>
      </div>
    )
  else if (lines.length) body = <LyricsView lines={lines} track={track} style={settings.style} onSeek={onSeek} messages={settings.messages} />
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
          {!lyrics || lyrics.status === 'loading' ? (
            <span className="loading-dots">Finding lyrics</span>
          ) : lyrics.status === 'instrumental' ? (
            'Instrumental. Enjoy the music.'
          ) : lyrics.status === 'error' ? (
            `Couldn't reach the lyrics service (${lyrics.source}).`
          ) : (
            'No lyrics found for this one yet.'
          )}
        </p>
      </div>
    )

  return (
    <div className={`app ${look.className} ${hideChrome ? 'chrome-hidden' : ''} ${playback.isPlaying ? 'is-playing' : ''}`} style={look.style}>
      <Background
        bg={settings.background}
        colors={palette.colors}
        artUrl={track?.artUrl ?? null}
        beat={Math.max(0, active)}
        playing={playback.isPlaying}
      />
      <header className="topbar chrome">
        {connected && <SearchBar onError={onError} canSearch={auth.loggedIn} onNeedLogin={() => setShowSetup(true)} />}
        {connected && (
          <div className="top-actions">
            <button
              className={`chip ${settings.overlayVisible ? 'on' : ''}`}
              onClick={() => window.api.setSettings({ overlayVisible: !settings.overlayVisible })}
              title="Floating lyrics over every app (O)"
            >
              Overlay
            </button>
            <button className="chip" onClick={() => setShowSettings(true)} title="Customise (S)">
              Customise
            </button>
          </div>
        )}
      </header>
      <main className="stage">{body}</main>
      {connected && <NowPlaying playback={playback} onError={onError} />}
      {(toast || pollError) && <div className="toast">{toast ?? pollError}</div>}
      {showSettings && <SettingsPanel settings={settings} auth={auth} track={track} output={{ name: playback.outputName ?? null, latencyMs: playback.outputLatencyMs ?? 0 }} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
