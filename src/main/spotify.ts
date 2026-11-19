import { shell } from 'electron'
import { createServer, type Server } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import { getSettings, loadTokens, saveTokens, type Tokens } from './store'
import { REDIRECT_PORT, REDIRECT_URI, type PlaybackState, type Track } from '../shared'

// Spotify Authorization Code flow with PKCE: no client secret is needed or shipped.
const SCOPES = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing']

let tokens: Tokens | null = loadTokens()
let pendingServer: Server | null = null

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export const isLoggedIn = () => !!tokens?.refreshToken

export function logout() {
  tokens = null
  saveTokens(null)
}

export function login(): Promise<void> {
  const clientId = getSettings().clientId
  if (!clientId) return Promise.reject(new Error('Add your Spotify Client ID first.'))
  pendingServer?.close()

  const verifier = b64url(randomBytes(64))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(16))

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', REDIRECT_URI)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const page = (msg: string) =>
        `<html><body style="background:#000;color:#fff;font:600 20px -apple-system;display:grid;place-items:center;height:100vh;margin:0">${msg}</body></html>`
      const code = url.searchParams.get('code')
      if (url.searchParams.get('state') !== state || !code) {
        res.writeHead(400, { 'Content-Type': 'text/html' }).end(page('Spotify sign-in failed. You can close this tab.'))
        server.close()
        reject(new Error(url.searchParams.get('error') ?? 'Sign-in was cancelled.'))
        return
      }
      try {
        await exchange({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier })
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(page('Connected to Spotify. You can close this tab.'))
        resolve()
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html' }).end(page('Could not finish sign-in.'))
        reject(e)
      } finally {
        server.close()
        pendingServer = null
      }
    })
    server.on('error', reject)
    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      const auth = new URL('https://accounts.spotify.com/authorize')
      auth.search = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: challenge,
        state,
        scope: SCOPES.join(' ')
      }).toString()
      shell.openExternal(auth.toString())
    })
    pendingServer = server
  })
}

async function exchange(params: Record<string, string>) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: getSettings().clientId, ...params })
  })
  if (!res.ok) throw new Error(`Spotify token error ${res.status}: ${await res.text()}`)
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
  tokens = {
    accessToken: j.access_token,
    refreshToken: j.refresh_token ?? tokens?.refreshToken ?? '',
    expiresAt: Date.now() + (j.expires_in - 60) * 1000
  }
  saveTokens(tokens)
}

let refreshing: Promise<void> | null = null
async function accessToken(): Promise<string> {
  if (!tokens) throw new Error('Not signed in to Spotify.')
  if (Date.now() >= tokens.expiresAt) {
    refreshing ??= exchange({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken }).finally(() => {
      refreshing = null
    })
    try {
      await refreshing
    } catch (e) {
      logout()
      throw e
    }
  }
  return tokens!.accessToken
}

async function api<T = unknown>(path: string, init: RequestInit = {}, retried = false): Promise<T | null> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...init.headers }
  })
  if (res.status === 401 && !retried && tokens) {
    tokens.expiresAt = 0
    return api(path, init, true)
  }
  if (res.status === 204 || res.status === 202) return null
  if (!res.ok) {
    let msg = `${res.status}`
    try {
      msg = ((await res.json()) as { error?: { message?: string } }).error?.message ?? msg
    } catch {}
    throw new Error(`Spotify: ${msg}`)
  }
  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
}

interface SpotifyTrack {
  id: string
  uri: string
  name: string
  duration_ms: number
  artists: { name: string }[]
  album: { name: string; images: { url: string; width: number }[] }
}

const toTrack = (t: SpotifyTrack): Track => ({
  id: t.id,
  uri: t.uri,
  name: t.name,
  artists: t.artists.map((a) => a.name).join(', '),
  album: t.album.name,
  artUrl: t.album.images[0]?.url ?? null,
  durationMs: t.duration_ms
})

export async function me(): Promise<string | null> {
  const u = await api<{ display_name: string | null; id: string }>('/me')
  return u?.display_name ?? u?.id ?? null
}

export async function search(q: string): Promise<Track[]> {
  if (!q.trim()) return []
  const r = await api<{ tracks: { items: SpotifyTrack[] } }>(`/search?type=track&limit=10&q=${encodeURIComponent(q)}`)
  return r?.tracks.items.filter(Boolean).map(toTrack) ?? []
}

export async function nowPlaying(): Promise<PlaybackState> {
  const r = await api<{
    is_playing: boolean
    progress_ms: number | null
    item: (SpotifyTrack & { type: string }) | null
    device?: { name: string }
  }>('/me/player?additional_types=track')
  const sampledAt = Date.now()
  if (!r || !r.item || r.item.type !== 'track')
    return { track: null, isPlaying: false, progressMs: 0, sampledAt, device: r?.device?.name ?? null }
  return {
    track: toTrack(r.item),
    isPlaying: r.is_playing,
    progressMs: r.progress_ms ?? 0,
    sampledAt,
    device: r.device?.name ?? null
  }
}

interface Device {
  id: string
  is_active: boolean
  type: string
  name: string
}

async function pickDevice(): Promise<Device | null> {
  const r = await api<{ devices: Device[] }>('/me/player/devices')
  const list = r?.devices ?? []
  return list.find((d) => d.is_active) ?? list.find((d) => d.type === 'Computer') ?? list[0] ?? null
}

/** Plays a track on the active Spotify device, opening the Spotify Mac app if nothing is running. */
export async function play(uri: string): Promise<void> {
  let device = await pickDevice()
  if (!device) {
    await shell.openExternal(uri) // spotify:track:… opens the Spotify desktop app
    for (let i = 0; i < 20 && !device; i++) {
      await new Promise((r) => setTimeout(r, 500))
      device = await pickDevice()
    }
    if (!device) throw new Error('Open Spotify on this Mac (or any device) and try again.')
  }
  await api(`/me/player/play?device_id=${device.id}`, { method: 'PUT', body: JSON.stringify({ uris: [uri] }) })
}

export async function control(action: 'play' | 'pause' | 'next' | 'previous' | 'seek', positionMs?: number) {
  if (action === 'play') await api('/me/player/play', { method: 'PUT' })
  else if (action === 'pause') await api('/me/player/pause', { method: 'PUT' })
  else if (action === 'next') await api('/me/player/next', { method: 'POST' })
  else if (action === 'previous') await api('/me/player/previous', { method: 'POST' })
  else await api(`/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs ?? 0))}`, { method: 'PUT' })
}
