import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, shell, Tray } from 'electron'
import { join } from 'node:path'
import * as spotify from './spotify'
import { fetchLyrics } from './lyrics'
import * as local from './local'
import { getSettings, updateSettings } from './store'
import { currentOutput, detectOutput } from './output'
import type { AuthStatus, LyricsResult, PlaybackState, Settings, Track } from '../shared'

let mainWin: BrowserWindow | null = null
let overlayWin: BrowserWindow | null = null
let tray: Tray | null = null

let playback: PlaybackState = { track: null, isPlaying: false, progressMs: 0, sampledAt: Date.now(), device: null }
let lyrics: LyricsResult | null = null
let userName: string | null = null

const preload = join(__dirname, '../preload/index.js')

function load(win: BrowserWindow, hash = '') {
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`)
  else win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
}

const broadcast = (channel: string, payload: unknown) => {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload)
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    show: false,
    webPreferences: { preload, sandbox: true, backgroundThrottling: false }
  })
  mainWin.once('ready-to-show', () => mainWin?.show())
  mainWin.on('closed', () => (mainWin = null))
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  load(mainWin)
}

function createOverlay() {
  const { workArea } = screen.getPrimaryDisplay()
  const width = Math.min(900, workArea.width - 80)
  overlayWin = new BrowserWindow({
    width,
    height: 190,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: workArea.y + workArea.height - 230,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    focusable: !getSettings().overlayLocked,
    webPreferences: { preload, sandbox: true, backgroundThrottling: false }
  })
  // Float above full-screen apps and on every Space.
  overlayWin.setAlwaysOnTop(true, 'screen-saver')
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  applyOverlayLock()
  overlayWin.on('closed', () => {
    overlayWin = null
    if (getSettings().overlayVisible) setSettings({ overlayVisible: false })
  })
  load(overlayWin, 'overlay')
}

function applyOverlayLock() {
  if (!overlayWin) return
  const locked = getSettings().overlayLocked
  overlayWin.setIgnoreMouseEvents(locked, { forward: true })
  overlayWin.setFocusable(!locked)
}

function setSettings(patch: Partial<Settings>): Settings {
  const s = updateSettings(patch)
  if ('overlayVisible' in patch) {
    if (s.overlayVisible && !overlayWin) createOverlay()
    if (!s.overlayVisible && overlayWin) overlayWin.close()
  }
  if ('overlayLocked' in patch) applyOverlayLock()
  broadcast('settings', s)
  refreshTray()
  return s
}

function refreshTray() {
  if (!tray) return
  const s = getSettings()
  const t = playback.track
  tray.setToolTip(t ? `${t.name} · ${t.artists}` : 'Lyrics Visualiser')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: t ? `${t.name} · ${t.artists}` : 'Nothing playing', enabled: false },
      { type: 'separator' },
      { label: 'Open Lyrics Window', click: () => (mainWin ? mainWin.show() : createMainWindow()) },
      { label: 'Show Overlay', type: 'checkbox', checked: s.overlayVisible, click: () => setSettings({ overlayVisible: !s.overlayVisible }) },
      { label: 'Lock Overlay (click-through)', type: 'checkbox', checked: s.overlayLocked, click: () => setSettings({ overlayLocked: !s.overlayLocked }) },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' }
    ])
  )
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty())
  tray.setTitle('♪')
  refreshTray()
}

// ---- Polling: one poller in the main process feeds every window. ----
// The renderer interpolates the position locally, so polling only needs to correct drift: every 2s
// while playing, briefly faster right after the user does something, at the exact end of a track, and
// much slower when paused, idle or hidden. Spotify rate limits are respected via Retry-After. Responses that started before a user action are discarded so they
// can't undo an optimistic update.
let pollTimer: NodeJS.Timeout | null = null
let polling = false
let fastUntil = 0
let epoch = 0

const estimateProgress = () =>
  playback.progressMs + (playback.isPlaying ? Date.now() - playback.sampledAt : 0)

function setPlayback(next: PlaybackState) {
  const changed = next.track?.id !== playback.track?.id
  const out = currentOutput()
  playback = { ...next, outputLatencyMs: out.latencyMs, outputName: out.name }
  broadcast('playback', playback)
  if (changed) {
    refreshTray()
    loadLyrics(next.track)
  }
}

let lyricsFor: string | null = null
function loadLyrics(track: Track | null) {
  if (!track) {
    lyricsFor = null
    lyrics = null
    broadcast('lyrics', null)
    return
  }
  if (lyricsFor === track.id) return
  lyricsFor = track.id
  lyrics = { trackId: track.id, status: 'loading', synced: null, plain: null, source: 'LRCLIB' }
  broadcast('lyrics', lyrics)
  // Not awaited inside the poll, so position updates keep flowing while lyrics load.
  fetchLyrics(track).then((result) => {
    if (playback.track?.id !== track.id) return
    lyrics = result
    broadcast('lyrics', lyrics)
    // Warm the cache for what's coming up next so the next song starts instantly.
    if (spotify.isLoggedIn())
      spotify
        .upNext()
        .then((list) => list.forEach((t) => fetchLyrics(t).catch(() => {})))
        .catch(() => {})
  })
}

/** Where the last reading came from: the Spotify app on this Mac, or the Web API (phone, speakers…). */
let source: 'local' | 'web' | 'none' = 'none'
let lastLocalStatus = local.localStatus()

async function poll() {
  if (polling) return
  polling = true
  const startedEpoch = epoch
  try {
    // The live reader is usually fresh; only start osascript when it isn't.
    const live = local.liveState()
    let next = live !== undefined ? live : await local.localNowPlaying()
    if (local.localStatus() !== lastLocalStatus) {
      lastLocalStatus = local.localStatus()
      broadcast('auth', authStatus())
    }
    if (next && (next.track || !spotify.isLoggedIn())) source = 'local'
    else if (spotify.isLoggedIn()) {
      next = await spotify.nowPlaying()
      source = 'web'
    } else {
      next = { track: null, isPlaying: false, progressMs: 0, sampledAt: Date.now(), device: null }
      source = 'none'
    }
    if (startedEpoch === epoch) setPlayback(next)
  } catch (e) {
    broadcast('error', (e as Error).message)
  } finally {
    polling = false
  }
}

const anyWindowVisible = () =>
  (!!mainWin && mainWin.isVisible() && !mainWin.isMinimized()) || (!!overlayWin && overlayWin.isVisible())

function scheduleNext() {
  if (pollTimer) clearTimeout(pollTimer)
  let delay: number
  if (source === 'local') {
    // Reading the local app is cheap, so read it often for tight sync.
    delay = local.liveState() !== undefined ? 2000 : !playback.track ? 1500 : playback.isPlaying ? 500 : 1000
    if (!anyWindowVisible()) delay = 3000
    if (Date.now() < fastUntil) delay = 250
  } else {
    delay = !playback.track ? 5000 : playback.isPlaying ? 2000 : 4000
    if (!anyWindowVisible()) delay = 10000
    if (Date.now() < fastUntil) delay = 700
  }
  const t = playback.track
  if (t && playback.isPlaying) {
    const remaining = t.durationMs - estimateProgress()
    if (remaining > 0 && remaining < delay) delay = remaining + 250 // catch the next track right away
  }
  const blocked = source === 'web' ? spotify.rateLimitedUntil() - Date.now() : 0
  if (blocked > 0) delay = Math.max(delay, blocked)
  pollTimer = setTimeout(async () => {
    await poll()
    scheduleNext()
  }, delay)
}

function startPolling() {
  poll().then(scheduleNext)
  local.startLive(onLiveReading)
  // Check the audio output now and then (headphones connected or removed).
  const checkOutput = () =>
    detectOutput().then((o) => {
      if (o.latencyMs !== playback.outputLatencyMs || o.name !== playback.outputName) setPlayback(playback)
    })
  checkOutput()
  setInterval(checkOutput, 20000)
}

/** Readings that arrive while a command is on its way to Spotify would undo the optimistic update. */
let holdLiveUntil = 0
let lastLiveBroadcast = 0

function onLiveReading(next: PlaybackState | null) {
  if (local.localStatus() !== lastLocalStatus) {
    lastLocalStatus = local.localStatus()
    broadcast('auth', authStatus())
  }
  if (!next || next.sampledAt < holdLiveUntil) return
  if (!next.track && spotify.isLoggedIn() && source === 'web') return // following another device
  source = 'local'
  // Only tell the windows when something changed: a new song, play/pause, or the clock moved.
  const drift = Math.abs(next.progressMs - (playback.progressMs + (playback.isPlaying ? next.sampledAt - playback.sampledAt : 0)))
  const changed = next.track?.id !== playback.track?.id || next.isPlaying !== playback.isPlaying || drift > 25
  if (changed || Date.now() - lastLiveBroadcast > 1000) {
    lastLiveBroadcast = Date.now()
    setPlayback(next)
  }
}

/** After a user action: ignore in-flight polls, poll quickly for a few seconds. */
function afterAction() {
  epoch++
  fastUntil = Date.now() + 2000
  setTimeout(() => poll().then(scheduleNext), source === 'local' ? 150 : 500)
}

const authStatus = (): AuthStatus => ({
  hasClientId: !!getSettings().clientId,
  loggedIn: spotify.isLoggedIn(),
  userName,
  local: local.localStatus()
})

async function refreshUser() {
  try {
    userName = spotify.isLoggedIn() ? await spotify.me() : null
  } catch {
    userName = null
  }
  broadcast('auth', authStatus())
}

// ---- IPC ----
ipcMain.handle('init', () => ({ settings: getSettings(), auth: authStatus(), playback, lyrics }))
ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => setSettings(patch))
ipcMain.handle('auth:login', async () => {
  await spotify.login()
  await refreshUser()
  mainWin?.show()
  mainWin?.focus()
  return authStatus()
})
ipcMain.handle('auth:logout', () => {
  spotify.logout()
  userName = null
  broadcast('auth', authStatus())
  return authStatus()
})
ipcMain.handle('spotify:search', (_e, q: string) => spotify.search(q))
ipcMain.handle('spotify:play', async (_e, track: Track) => {
  // Optimistic: show the song and start loading its lyrics before Spotify confirms.
  const prev = playback
  setPlayback({ track, isPlaying: true, progressMs: 0, sampledAt: Date.now(), device: playback.device })
  epoch++
  holdLiveUntil = Infinity
  try {
    if (process.platform === 'darwin' && local.localUsable()) await local.localPlay(track.uri)
    else await spotify.play(track.uri)
    // Playback really starts when Spotify answers, so restart the clock from here.
    setPlayback({ ...playback, progressMs: 0, sampledAt: Date.now() })
  } catch (e) {
    setPlayback(prev)
    throw e
  } finally {
    holdLiveUntil = Date.now() + 150
    afterAction()
  }
})
ipcMain.handle('spotify:control', async (_e, action: Parameters<typeof spotify.control>[0], pos?: number) => {
  const now = Date.now()
  if (action === 'pause') setPlayback({ ...playback, isPlaying: false, progressMs: estimateProgress(), sampledAt: now })
  if (action === 'play') setPlayback({ ...playback, isPlaying: true, progressMs: estimateProgress(), sampledAt: now })
  if (action === 'seek') setPlayback({ ...playback, progressMs: Math.max(0, pos ?? 0), sampledAt: now })
  epoch++
  holdLiveUntil = Infinity
  try {
    if (source === 'local' || (source === 'none' && local.localUsable())) await local.localControl(action, pos)
    else await spotify.control(action, pos)
  } finally {
    // Give Spotify a moment to apply it (seeking re-buffers) before trusting readings again.
    holdLiveUntil = Date.now() + (action === 'seek' ? 150 : 60)
    afterAction()
  }
})
ipcMain.handle('lyrics:prefetch', (_e, track: Track) => {
  fetchLyrics(track).catch(() => {})
})
ipcMain.handle('open-external', (_e, url: string) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url)
})

app.whenReady().then(() => {
  createMainWindow()
  createTray()
  if (getSettings().overlayVisible) createOverlay()
  if (spotify.isLoggedIn()) refreshUser()
  // Always poll: the Spotify Mac app works without signing in.
  startPolling()
  app.on('activate', () => {
    if (!mainWin) createMainWindow()
    else mainWin.show()
  })
})

// Keep running in the menu bar when the window is closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => local.stopLive())
