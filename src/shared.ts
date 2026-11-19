// Types shared by the main process, preload and renderer.

export interface Track {
  id: string
  uri: string
  name: string
  artists: string
  album: string
  artUrl: string | null
  durationMs: number
}

export interface PlaybackState {
  track: Track | null
  isPlaying: boolean
  progressMs: number
  /** Local Date.now() when progressMs was sampled, used to interpolate between polls. */
  sampledAt: number
  device: string | null
}

export interface LyricsResult {
  trackId: string
  status: 'loading' | 'found' | 'plain-only' | 'instrumental' | 'not-found' | 'error'
  synced: string | null
  plain: string | null
  source: string
}

export type LyricStyle = 'glow' | 'karaoke' | 'focus' | 'messages'

export interface Settings {
  clientId: string
  style: LyricStyle
  offsetMs: number
  fontScale: number
  overlayVisible: boolean
  overlayLocked: boolean
}

export interface AuthStatus {
  hasClientId: boolean
  loggedIn: boolean
  userName: string | null
}

export const REDIRECT_PORT = 43821
export const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`
