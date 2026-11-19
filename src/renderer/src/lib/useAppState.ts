import { useEffect, useMemo, useRef, useState } from 'react'
import type { AuthStatus, LyricsResult, PlaybackState, Settings } from '../../../shared'
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
  const [auth, setAuth] = useState<AuthStatus>({ hasClientId: false, loggedIn: false, userName: null })
  const [playback, setPlayback] = useState<PlaybackState>(emptyPlayback)
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.init().then((s) => {
      setSettings(s.settings)
      setAuth(s.auth)
      setPlayback(s.playback)
      setLyrics(s.lyrics)
    })
    const offs = [
      window.api.onSettings(setSettings),
      window.api.onAuth(setAuth),
      window.api.onPlayback((p) => {
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

  return {
    ready: !!settings,
    settings: settings ?? { clientId: '', style: 'glow', offsetMs: 0, fontScale: 1, overlayVisible: false, overlayLocked: false },
    auth,
    playback,
    lyrics,
    lines,
    error
  }
}

/** Current song position in seconds, updated every animation frame and interpolated between polls. */
export function useSongTime(playback: PlaybackState, offsetMs: number): number {
  const [t, setT] = useState(0)
  const ref = useRef({ playback, offsetMs })
  ref.current = { playback, offsetMs }
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const { playback: p, offsetMs: o } = ref.current
      const elapsed = p.isPlaying ? Date.now() - p.sampledAt : 0
      const ms = Math.min(p.progressMs + elapsed, p.track?.durationMs ?? Infinity)
      setT((ms + o) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return t
}
