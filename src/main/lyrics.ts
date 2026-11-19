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

export async function fetchLyrics(track: Track): Promise<LyricsResult> {
  const hit = cache.get(track.id)
  if (hit) return hit
  const firstArtist = track.artists.split(', ')[0]
  const duration = Math.round(track.durationMs / 1000)
  let result: LyricsResult
  try {
    const exact = await getJson<LrclibRecord>(
      `${BASE}/get?` +
        new URLSearchParams({ track_name: track.name, artist_name: firstArtist, album_name: track.album, duration: String(duration) })
    )
    result = toResult(track.id, exact)
    if (result.status !== 'found') {
      // Fall back to a fuzzy search and pick the closest duration with synced lyrics.
      const list =
        (await getJson<LrclibRecord[]>(
          `${BASE}/search?` + new URLSearchParams({ track_name: clean(track.name), artist_name: firstArtist })
        )) ?? []
      const best = list
        .filter((r) => Math.abs(r.duration - duration) <= 4)
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
