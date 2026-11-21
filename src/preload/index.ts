import { contextBridge, ipcRenderer } from 'electron'
import type { AuthStatus, LyricsResult, PlaybackState, Settings, Track } from '../shared'

const on =
  <T>(channel: string) =>
  (cb: (value: T) => void) => {
    const listener = (_: unknown, v: T) => cb(v)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }

const api = {
  init: (): Promise<{ settings: Settings; auth: AuthStatus; playback: PlaybackState; lyrics: LyricsResult | null }> =>
    ipcRenderer.invoke('init'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:set', patch),
  login: (): Promise<AuthStatus> => ipcRenderer.invoke('auth:login'),
  logout: (): Promise<AuthStatus> => ipcRenderer.invoke('auth:logout'),
  search: (q: string): Promise<Track[]> => ipcRenderer.invoke('spotify:search', q),
  play: (track: Track): Promise<void> => ipcRenderer.invoke('spotify:play', track),
  prefetchLyrics: (track: Track) => ipcRenderer.invoke('lyrics:prefetch', track),
  control: (action: 'play' | 'pause' | 'next' | 'previous' | 'seek', positionMs?: number): Promise<void> =>
    ipcRenderer.invoke('spotify:control', action, positionMs),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  onPlayback: on<PlaybackState>('playback'),
  onLyrics: on<LyricsResult | null>('lyrics'),
  onSettings: on<Settings>('settings'),
  onAuth: on<AuthStatus>('auth'),
  onError: on<string>('error')
}

export type Api = typeof api
contextBridge.exposeInMainWorld('api', api)
