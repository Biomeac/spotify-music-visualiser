import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, shell, Tray } from 'electron'
import { join } from 'node:path'
import * as spotify from './spotify'
import { fetchLyrics } from './lyrics'
import { getSettings, updateSettings } from './store'
import type { AuthStatus, LyricsResult, PlaybackState, Settings } from '../shared'

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
    webPreferences: { preload, sandbox: true }
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
    webPreferences: { preload, sandbox: true }
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
let pollTimer: NodeJS.Timeout | null = null
let polling = false

async function poll() {
  if (polling || !spotify.isLoggedIn()) return
  polling = true
  try {
    const next = await spotify.nowPlaying()
    const changed = next.track?.id !== playback.track?.id
    playback = next
    broadcast('playback', playback)
    if (changed) {
      refreshTray()
      if (next.track) {
        const track = next.track
        lyrics = { trackId: track.id, status: 'loading', synced: null, plain: null, source: 'LRCLIB' }
        broadcast('lyrics', lyrics)
        const result = await fetchLyrics(track)
        if (playback.track?.id === track.id) {
          lyrics = result
          broadcast('lyrics', lyrics)
        }
      } else {
        lyrics = null
        broadcast('lyrics', null)
      }
    }
  } catch (e) {
    broadcast('error', (e as Error).message)
  } finally {
    polling = false
  }
}

function startPolling() {
  pollTimer ??= setInterval(poll, 1000)
  poll()
}

const authStatus = (): AuthStatus => ({ hasClientId: !!getSettings().clientId, loggedIn: spotify.isLoggedIn(), userName })

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
  startPolling()
  return authStatus()
})
ipcMain.handle('auth:logout', () => {
  spotify.logout()
  userName = null
  broadcast('auth', authStatus())
  return authStatus()
})
ipcMain.handle('spotify:search', (_e, q: string) => spotify.search(q))
ipcMain.handle('spotify:play', async (_e, uri: string) => {
  await spotify.play(uri)
  setTimeout(poll, 400)
})
ipcMain.handle('spotify:control', async (_e, action: Parameters<typeof spotify.control>[0], pos?: number) => {
  await spotify.control(action, pos)
  setTimeout(poll, 250)
})
ipcMain.handle('open-external', (_e, url: string) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url)
})

app.whenReady().then(() => {
  createMainWindow()
  createTray()
  if (getSettings().overlayVisible) createOverlay()
  if (spotify.isLoggedIn()) {
    refreshUser()
    startPolling()
  }
  app.on('activate', () => {
    if (!mainWin) createMainWindow()
    else mainWin.show()
  })
})

// Keep running in the menu bar when the window is closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
