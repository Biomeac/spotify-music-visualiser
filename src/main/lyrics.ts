import type { LyricsResult, Track } from '../shared'

// LRCLIB (https://lrclib.net): free, open, no API key, timestamped (LRC) lyrics.
const BASE = 'https://lrclib.net/api'
const HEADERS = { 'User-Agent': 'LyricsVisualiser/0.1 (desktop app)' }

interface LrclibRecord {
  trackName: string
  artistName: string
  duration: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

const cache = new Map<string, LyricsResult>()

function toResult(trackId: string, r: LrclibRecord | null): LyricsResult {
  const base = { trackId, source: 'LRCLIB', synced: null, plain: null }
  if (!r) return { ...base, status: 'not-found' }
  if (r.instrumental) return { ...base, status: 'instrumental' }
  if (r.syncedLyrics) return { ...base, status: 'found', synced: r.syncedLyrics, plain: r.plainLyrics }
  if (r.plainLyrics) return { ...base, status: 'plain-only', plain: r.plainLyrics }
  return { ...base, status: 'not-found' }
}

// "Song - Remastered 2011" / "Song (feat. X)" → "Song"
const clean = (s: string) => s.replace(/\s+-\s+.*$/, '').replace(/\s*[([].*?(feat|with|remaster|version|edit|live|mono|stereo).*?[)\]]/gi, '').trim()

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: HEADERS })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`)
  return (await res.json()) as T
}

const inflight = new Map<string, Promise<LyricsResult>>()

/** Cached and de-duplicated, so a prefetch and a real load of the same song share one request. */
export function fetchLyrics(track: Track): Promise<LyricsResult> {
  const hit = cache.get(track.id)
  if (hit) return Promise.resolve(hit)
  let p = inflight.get(track.id)
  if (!p) {
    p = lookup(track).finally(() => inflight.delete(track.id))
    inflight.set(track.id, p)
  }
  return p
}

async function lookup(track: Track): Promise<LyricsResult> {
  const firstArtist = track.artists.split(', ')[0]
  const duration = Math.round(track.durationMs / 1000)
  let result: LyricsResult
  try {
    // Exact match and fuzzy search run in parallel; the exact match wins when it has synced lyrics.
    const [exact, list] = await Promise.all([
      getJson<LrclibRecord>(
        `${BASE}/get?` +
          new URLSearchParams({ track_name: track.name, artist_name: firstArtist, album_name: track.album, duration: String(duration) })
      ).catch(() => null),
      getJson<LrclibRecord[]>(`${BASE}/search?` + new URLSearchParams({ track_name: clean(track.name), artist_name: firstArtist }))
    ])
    result = toResult(track.id, exact)
    if (result.status !== 'found') {
      // Closest duration wins; a different edit of a song has different timings, so stay within 3s.
      const best = (list ?? [])
        .filter((r) => Math.abs(r.duration - duration) <= 3)
        .sort((a, b) => Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics) || Math.abs(a.duration - duration) - Math.abs(b.duration - duration))[0]
      if (best) {
        const alt = toResult(track.id, best)
        if (alt.status === 'found' || result.status === 'not-found') result = alt
      }
    }
  } catch (e) {
    return { trackId: track.id, status: 'error', synced: null, plain: null, source: String((e as Error).message) }
  }
  cache.set(track.id, result)
  return result
}
