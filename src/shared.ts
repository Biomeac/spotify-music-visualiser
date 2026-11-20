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

export type LyricStyle =
  | 'glow'
  | 'karaoke'
  | 'focus'
  | 'messages'
  | 'kinetic'
  | 'neon'
  | 'typewriter'
  | 'bounce'
  | 'poster'
  | 'vinyl'
  | 'glitch'
  | 'cinema'
  | 'wave'

export type BackgroundKind =
  | 'fluid'
  | 'lava'
  | 'dither'
  | 'synthwave'
  | 'warp'
  | 'bokeh'
  | 'halftone'
  | 'aurora'
  | 'particles'
  | 'waves'
  | 'album'
  | 'solid'

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
  kind: 'fluid',
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
  text: TextSettings
  ui: UiSettings
  messages: MessagesSettings
  /** Extra timing offset remembered per Spotify track id, in ms. */
  trackOffsets: Record<string, number>
}

export interface AuthStatus {
  hasClientId: boolean
  loggedIn: boolean
  userName: string | null
  /** Connection to the Spotify app on this Mac. */
  local: 'ok' | 'not-running' | 'denied' | 'unavailable'
}

export type FontChoice = 'style' | 'sf' | 'rounded' | 'serif' | 'mono' | 'condensed' | 'hand'

export interface TextSettings {
  /** 'style' keeps each lyric style's own font. */
  font: FontChoice
  weight: number
  align: 'left' | 'center' | 'right'
  uppercase: boolean
  activeColor: 'white' | 'accent' | 'custom'
  customColor: string
  /** Opacity of lines that aren't being sung, 0.05 to 0.7. */
  dimOpacity: number
  /** Glow strength, 0 to 2. */
  glow: number
  blurOthers: boolean
  showNext: boolean
  /** Animation speed multiplier, 0.5 (slow) to 2 (fast). */
  animSpeed: number
}

export const DEFAULT_TEXT: TextSettings = {
  font: 'style',
  weight: 800,
  align: 'left',
  uppercase: false,
  activeColor: 'white',
  customColor: '#ffffff',
  dimOpacity: 0.3,
  glow: 1,
  blurOthers: true,
  showNext: true,
  animSpeed: 1
}

export interface UiSettings {
  /** Hide the search bar and player controls when the mouse is idle. */
  autoHide: boolean
  overlayOpacity: number
  overlayScale: number
  overlayShowNext: boolean
}

export const DEFAULT_UI: UiSettings = { autoHide: true, overlayOpacity: 0, overlayScale: 1, overlayShowNext: true }

export interface MessagesSettings {
  theme: 'dark' | 'light'
  bubble: 'blue' | 'green' | 'accent'
  /** Full-screen effects (hearts, confetti, fire…) and bubble effects (slam, loud, invisible ink). */
  effects: boolean
  /** Your lines are typed out live in the text box, then sent. */
  liveTyping: boolean
  /** Tilt the phone in 3D as the mouse moves. */
  tilt: boolean
}

export const DEFAULT_MESSAGES: MessagesSettings = { theme: 'dark', bubble: 'blue', effects: true, liveTyping: true, tilt: true }

export const REDIRECT_PORT = 43821
export const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`
