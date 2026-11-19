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

export type LyricStyle = 'glow' | 'karaoke' | 'focus' | 'messages' | 'kinetic' | 'neon' | 'typewriter' | 'bounce'

export type BackgroundKind = 'aurora' | 'particles' | 'waves' | 'album' | 'solid'

export interface BackgroundSettings {
  kind: BackgroundKind
  /** Take colours from the album art, or use the three custom colours. */
  colorSource: 'album' | 'custom'
  colors: [string, string, string]
  /** Animation speed multiplier, 0.2 to 3. */
  speed: number
  /** 0.2 to 1.3 */
  brightness: number
  /** Blur in px for Aurora and Album backgrounds. */
  blur: number
  grain: boolean
  /** Pulse the background each time a new lyric line starts. */
  reactive: boolean
}

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  kind: 'aurora',
  colorSource: 'album',
  colors: ['#ff3d7f', '#7a2cff', '#00c2ff'],
  speed: 1,
  brightness: 0.8,
  blur: 80,
  grain: true,
  reactive: true
}

export interface Settings {
  clientId: string
  style: LyricStyle
  offsetMs: number
  fontScale: number
  overlayVisible: boolean
  overlayLocked: boolean
  background: BackgroundSettings
}

export interface AuthStatus {
  hasClientId: boolean
  loggedIn: boolean
  userName: string | null
}

export const REDIRECT_PORT = 43821
export const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`
