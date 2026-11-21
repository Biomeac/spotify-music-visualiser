import { useEffect, useMemo, useState } from 'react'
import { setClockOffset, syncClock } from './clock'
import { DEFAULT_BACKGROUND, DEFAULT_MESSAGES, DEFAULT_TEXT, DEFAULT_UI, type AuthStatus, type LyricsResult, type PlaybackState, type Settings } from '../../../shared'
import { parseLrc, type Line } from './lrc'

export interface AppState {
  ready: boolean
  settings: Settings
  auth: AuthStatus
  playback: PlaybackState
  lyrics: LyricsResult | null
  lines: Line[]
  error: string | null
}

const emptyPlayback: PlaybackState = { track: null, isPlaying: false, progressMs: 0, sampledAt: 0, device: null }

export function useAppState(): AppState {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [auth, setAuth] = useState<AuthStatus>({ hasClientId: false, loggedIn: false, userName: null, local: 'unavailable' })
  const [playback, setPlayback] = useState<PlaybackState>(emptyPlayback)
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.init().then((s) => {
      setSettings(s.settings)
      setAuth(s.auth)
      syncClock(s.playback)
      setPlayback(s.playback)
      setLyrics(s.lyrics)
    })
    const offs = [
      window.api.onSettings(setSettings),
      window.api.onAuth(setAuth),
      window.api.onPlayback((p) => {
        syncClock(p)
        setPlayback(p)
        setError(null)
      }),
      window.api.onLyrics(setLyrics),
      window.api.onError(setError)
    ]
    return () => offs.forEach((off) => off())
  }, [])

  const lines = useMemo(
    () => (lyrics?.synced && lyrics.trackId === playback.track?.id ? parseLrc(lyrics.synced, (playback.track?.durationMs ?? 0) / 1000) : []),
    [lyrics, playback.track?.id, playback.track?.durationMs]
  )

  // Global offset plus any offset remembered for this song.
  const trackOffset = (playback.track && settings?.trackOffsets[playback.track.id]) || 0
  // Bluetooth headphones play the audio a little later than Spotify's clock says.
  const latency = settings?.autoLatency === false ? 0 : (playback.outputLatencyMs ?? 0)
  setClockOffset((settings?.offsetMs ?? 0) + trackOffset - latency)

  return {
    ready: !!settings,
    settings: settings ?? { clientId: '', style: 'glow', offsetMs: 0, fontScale: 1, overlayVisible: false, overlayLocked: false, background: DEFAULT_BACKGROUND, text: DEFAULT_TEXT, ui: DEFAULT_UI, messages: DEFAULT_MESSAGES, trackOffsets: {}, autoLatency: true },
    auth,
    playback,
    lyrics,
    lines,
    error
  }
}

