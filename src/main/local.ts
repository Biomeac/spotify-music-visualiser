import { execFile } from 'node:child_process'
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
  await osa(`tell application "Spotify" to play track "${uri}"`, 8000)
}

export async function localControl(action: 'play' | 'pause' | 'next' | 'previous' | 'seek', positionMs?: number) {
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
