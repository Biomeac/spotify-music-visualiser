import { execFile, spawn, type ChildProcess } from 'node:child_process'
import type { PlaybackState, Track } from '../shared'

/*
 * Talks to the Spotify desktop app on this Mac through AppleScript, the same way DJ apps do.
 * - No login, no network and no rate limits.
 * - Position comes straight from the player with millisecond precision, so lyrics stay in sync.
 * - Playing a specific song works without Spotify Premium.
 * macOS asks once for permission ("Lyrics Visualiser wants to control Spotify").
 */

export type LocalStatus = 'ok' | 'not-running' | 'denied' | 'unavailable'

const SEP = String.fromCharCode(30)

function osa(script: string, timeout = 2500): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stderr: String(stderr) }))
      else resolve(String(stdout).trim())
    })
  })
}

const NOW_PLAYING = `
if application "Spotify" is running then
  tell application "Spotify"
    set s to character id 30
    set t to current track
    return (player state as string) & s & (player position as string) & s & (spotify url of t) & s & (name of t) & s & (artist of t) & s & (album of t) & s & ((duration of t) as string) & s & (artwork url of t)
  end tell
else
  return "not-running"
end if`

let status: LocalStatus = process.platform === 'darwin' ? 'ok' : 'unavailable'
export const localStatus = () => status

const isDenied = (e: unknown) => /-1743|not authori[sz]ed|Not allowed/i.test(String((e as { stderr?: string }).stderr ?? e))

export async function localNowPlaying(): Promise<PlaybackState | null> {
  if (status === 'unavailable' || status === 'denied') return null
  const sentAt = Date.now()
  let out: string
  try {
    out = await osa(NOW_PLAYING)
  } catch (e) {
    if (isDenied(e)) {
      status = 'denied'
      return null
    }
    // Spotify open but nothing loaded yet also errors; treat as idle rather than broken.
    return { track: null, isPlaying: false, progressMs: 0, sampledAt: Date.now(), device: 'This Mac' }
  }
  const sampledAt = Math.round((sentAt + Date.now()) / 2)
  if (out === 'not-running') {
    status = 'not-running'
    return null
  }
  status = 'ok'
  const [state, pos, url, name, artist, album, duration, art] = out.split(SEP)
  const num = (v: string) => Number(String(v).replace(',', '.')) // some locales use a decimal comma
  const id = url?.split(':').pop() ?? ''
  if (!url?.startsWith('spotify:track:') || !id) {
    // Ads, podcasts and local files: nothing to show lyrics for.
    return { track: null, isPlaying: state === 'playing', progressMs: 0, sampledAt, device: 'This Mac' }
  }
  const track: Track = {
    id,
    uri: url,
    name,
    artists: artist,
    album,
    artUrl: art && art !== 'missing value' ? art : null,
    durationMs: num(duration)
  }
  return { track, isPlaying: state === 'playing', progressMs: Math.round(num(pos) * 1000), sampledAt, device: 'This Mac' }
}

export async function localPlay(uri: string): Promise<void> {
  if (!/^spotify:track:[A-Za-z0-9]+$/.test(uri)) throw new Error('Not a Spotify track')
  if (await fastCommand({ a: 'track', uri })) return
  await osa(`tell application "Spotify" to play track "${uri}"`, 8000)
}

export async function localControl(action: 'play' | 'pause' | 'next' | 'previous' | 'seek', positionMs?: number) {
  if (await fastCommand({ a: action, pos: Math.max(0, positionMs ?? 0) / 1000 })) return
  const cmd = {
    play: 'play',
    pause: 'pause',
    next: 'next track',
    previous: 'previous track',
    seek: `set player position to ${(Math.max(0, positionMs ?? 0) / 1000).toFixed(3)}`
  }[action]
  await osa(`tell application "Spotify" to ${cmd}`)
}

/** Whether the local app can be used right now for playback and control. */
export const localUsable = () => status === 'ok' || status === 'not-running'

/* ---------------- Live connection ----------------
 * Starting osascript for every reading costs 100–300ms and blurs when the reading was taken, which is
 * what made lyrics drift. Instead, one long-running JavaScript-for-Automation process reads the player
 * every 200ms and stamps each reading with the exact moment it was taken. A second one waits for
 * commands (play, pause, seek…) so they reach Spotify in a few milliseconds instead of a few hundred.
 */

const READER = `
ObjC.import('Foundation')
function run(argv) {
  const out = $.NSFileHandle.fileHandleWithStandardOutput
  const say = (o) => out.writeData($(JSON.stringify(o) + '\\n').dataUsingEncoding($.NSUTF8StringEncoding))
  const app = Application('Spotify')
  const every = Number(argv[0]) || 0.2
  let lastUrl = '', meta = null
  while (true) {
    try {
      if (!app.running()) { say({ s: 'not-running' }); lastUrl = ''; delay(1); continue }
      const t0 = Date.now()
      const p = app.playerPosition()
      const t1 = Date.now()
      const s = app.playerState()
      let url = ''
      try { url = app.currentTrack.spotifyUrl() } catch (e) {}
      if (url !== lastUrl) {
        lastUrl = url
        const t = app.currentTrack
        try { meta = { name: t.name(), artist: t.artist(), album: t.album(), dur: t.duration(), art: t.artworkUrl() } } catch (e) { meta = null }
      }
      say({ s: s, p: p, at: (t0 + t1) / 2, rt: t1 - t0, url: url, meta: meta })
    } catch (e) {
      say({ err: String(e) })
      delay(1)
    }
    delay(every)
  }
}`

const COMMANDER = `
ObjC.import('Foundation')
function run() {
  const input = $.NSFileHandle.fileHandleWithStandardInput
  const out = $.NSFileHandle.fileHandleWithStandardOutput
  const app = Application('Spotify')
  let buf = ''
  while (true) {
    const data = input.availableData
    if (data.length === 0) return
    buf += $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js
    let i
    while ((i = buf.indexOf('\\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1)
      let res = 'ok'
      try {
        const c = JSON.parse(line)
        if (c.a === 'play') app.play()
        else if (c.a === 'pause') app.pause()
        else if (c.a === 'next') app.nextTrack()
        else if (c.a === 'previous') app.previousTrack()
        else if (c.a === 'seek') app.playerPosition = c.pos
        else if (c.a === 'track') app.playTrack(c.uri)
      } catch (e) { res = String(e).replace(/\\n/g, ' ') }
      out.writeData($(res + '\\n').dataUsingEncoding($.NSUTF8StringEncoding))
    }
  }
}`

let reader: ChildProcess | null = null
let commander: ChildProcess | null = null
let latest: { state: PlaybackState | null; at: number } = { state: null, at: 0 }
let listener: ((p: PlaybackState | null) => void) | null = null
const pendingAcks: ((r: string) => void)[] = []

function onReading(line: string) {
  let r: { s?: string; p?: number; at?: number; url?: string; err?: string; meta?: { name: string; artist: string; album: string; dur: number; art: string } | null }
  try {
    r = JSON.parse(line)
  } catch {
    return
  }
  if (r.err) {
    if (isDenied(r.err)) status = 'denied'
    return
  }
  if (r.s === 'not-running') {
    status = 'not-running'
    latest = { state: null, at: Date.now() }
    listener?.(null)
    return
  }
  status = 'ok'
  const sampledAt = Math.round(r.at ?? Date.now())
  const isPlaying = r.s === 'playing'
  const id = r.url?.split(':').pop() ?? ''
  let state: PlaybackState
  if (!r.url?.startsWith('spotify:track:') || !id || !r.meta) state = { track: null, isPlaying, progressMs: 0, sampledAt, device: 'This Mac' }
  else
    state = {
      track: { id, uri: r.url, name: r.meta.name, artists: r.meta.artist, album: r.meta.album, artUrl: r.meta.art || null, durationMs: Number(r.meta.dur) },
      isPlaying,
      progressMs: Math.round(Number(r.p) * 1000),
      sampledAt,
      device: 'This Mac'
    }
  latest = { state, at: Date.now() }
  listener?.(state)
}

function lines(proc: ChildProcess, cb: (l: string) => void) {
  let buf = ''
  proc.stdout?.on('data', (d: Buffer) => {
    buf += d.toString('utf8')
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (l) cb(l)
    }
  })
}

/** Starts (or restarts) the live readers. Every reading is passed to onState. */
export function startLive(onState: (p: PlaybackState | null) => void) {
  if (process.platform !== 'darwin') return
  listener = onState
  if (!reader) {
    reader = spawn('osascript', ['-l', 'JavaScript', '-e', READER, '0.2'])
    lines(reader, onReading)
    reader.stderr?.on('data', (d: Buffer) => {
      if (isDenied(d.toString())) status = 'denied'
    })
    reader.on('exit', () => {
      reader = null
      // Restart unless permission was refused; the one-shot fallback covers the gap.
      if (status !== 'denied') setTimeout(() => startLive(onState), 2000)
    })
  }
  if (!commander) {
    commander = spawn('osascript', ['-l', 'JavaScript', '-e', COMMANDER])
    lines(commander, (l) => pendingAcks.shift()?.(l))
    commander.on('exit', () => {
      commander = null
      while (pendingAcks.length) pendingAcks.shift()?.('exited')
    })
  }
}

export function stopLive() {
  listener = null
  reader?.kill()
  commander?.kill()
}

/** The latest live reading, if it is fresh. */
export function liveState(): PlaybackState | null | undefined {
  return Date.now() - latest.at < 1000 ? latest.state : undefined
}

/** Sends a command through the fast channel; falls back to one-shot osascript. */
export async function fastCommand(c: { a: string; pos?: number; uri?: string }): Promise<boolean> {
  if (!commander?.stdin?.writable) return false
  const ack = new Promise<string>((resolve) => {
    pendingAcks.push(resolve)
    setTimeout(() => resolve('timeout'), 3000)
  })
  commander.stdin.write(JSON.stringify(c) + '\n')
  const r = await ack
  if (r === 'ok') return true
  if (isDenied(r)) status = 'denied'
  return false
}
