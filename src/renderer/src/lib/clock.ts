import { useEffect, useRef, useState } from 'react'
import type { PlaybackState } from '../../../shared'
import { activeLineIndex, type Line } from './lrc'

/*
 * The song clock. Spotify only tells us the position about once a second, and each reading has
 * ±100ms of network jitter. Snapping to every reading makes lyrics stutter back and forth, so we keep
 * a local clock running at real time and nudge it towards each reading instead. Big differences
 * (seeks, track changes, pause/play) snap immediately.
 */

let anchorPos = 0 // ms into the song at anchorAt
let anchorAt = 0 // performance.now()
let playing = false
let duration = Infinity
let trackId: string | null = null
let offsetMs = 0

const raw = (now = performance.now()) => (playing ? anchorPos + (now - anchorAt) : anchorPos)

export function syncClock(p: PlaybackState) {
  const now = performance.now()
  // Where Spotify says we are right now (its reading plus the time since it was taken).
  const measured = p.progressMs + (p.isPlaying ? Date.now() - p.sampledAt : 0)
  const current = raw(now)
  const drift = measured - current
  const snap = p.track?.id !== trackId || p.isPlaying !== playing || Math.abs(drift) > 900
  anchorPos = snap ? measured : current + drift * 0.3
  anchorAt = now
  playing = p.isPlaying
  duration = p.track?.durationMs ?? Infinity
  trackId = p.track?.id ?? null
}

export function setClockOffset(ms: number) {
  offsetMs = ms
}

// Highlights land a touch early to cover screen refresh and CSS transition time.
const VISUAL_LEAD_MS = 80

/** Song position in seconds, including the user's timing offset. */
export function songTime(): number {
  return (Math.max(0, Math.min(raw(), duration)) + offsetMs + VISUAL_LEAD_MS) / 1000
}

/** Raw position in ms (no offsets), for the progress bar and seeking. */
export function songPositionMs(): number {
  return Math.max(0, Math.min(raw(), duration))
}

/** Re-renders every animation frame with the current song time. Use only in components that animate. */
export function useSongTime(): number {
  const [t, setT] = useState(songTime)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      setT(songTime())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return t
}

/** The active lyric line, re-rendering only when it changes. */
export function useActiveLine(lines: Line[]): number {
  const [idx, setIdx] = useState(-1)
  const linesRef = useRef(lines)
  linesRef.current = lines
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const i = activeLineIndex(linesRef.current, songTime())
      setIdx((prev) => (prev === i ? prev : i))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return idx
}
