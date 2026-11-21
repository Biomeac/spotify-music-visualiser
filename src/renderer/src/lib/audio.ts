import { useEffect, useState } from 'react'

/*
 * Live analysis of the music that's playing, for backgrounds that move with it.
 * Audio comes from the Mac's output (what Spotify is playing) and is analysed here, frame by frame.
 * Nothing is recorded or sent anywhere.
 *
 * Values are 0..1 and adapt to the song's loudness, so quiet and loud tracks both look alive.
 */

export type AudioStatus = 'off' | 'starting' | 'on' | 'denied' | 'error'

export const audio = {
  /** Kick and bass, 20–150 Hz */
  bass: 0,
  /** Vocals and most instruments, 150 Hz–2 kHz */
  mid: 0,
  /** Hats, cymbals and air, 2–12 kHz */
  high: 0,
  /** Overall loudness */
  level: 0,
  /** Jumps to 1 on each detected beat, then decays */
  beat: 0,
  /** Increments on every beat, so components can react to new beats */
  beats: 0,
  /** 64 log-spaced frequency bands, 0..1 */
  bands: new Float32Array(64),
  active: false
}

let status: AudioStatus = 'off'
const listeners = new Set<(s: AudioStatus) => void>()
const setStatus = (s: AudioStatus) => {
  status = s
  listeners.forEach((l) => l(s))
}

let stream: MediaStream | null = null
let ctx: AudioContext | null = null
let raf = 0

export function useAudioStatus(): AudioStatus {
  const [s, setS] = useState(status)
  useEffect(() => {
    listeners.add(setS)
    return () => void listeners.delete(setS)
  }, [])
  return s
}

export async function startAudio(): Promise<AudioStatus> {
  if (status === 'on' || status === 'starting') return status
  setStatus('starting')
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: { width: 16, height: 16, frameRate: 1 } })
    // Only the sound is used; the screen picture is switched off straight away.
    stream.getVideoTracks().forEach((t) => (t.enabled = false))
    const track = stream.getAudioTracks()[0]
    if (!track || track.readyState === 'ended') {
      stopAudio()
      setStatus('denied')
      return status
    }
    track.addEventListener('ended', () => {
      stopAudio()
      setStatus('denied')
    })
    ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(new MediaStream([track]))
    const an = ctx.createAnalyser()
    an.fftSize = 2048
    an.smoothingTimeConstant = 0.55
    src.connect(an) // not connected to the speakers, so nothing plays twice
    loop(an, ctx.sampleRate)
    setStatus('on')
  } catch (e) {
    stopAudio()
    setStatus(/denied|permission|NotAllowed/i.test(String(e)) ? 'denied' : 'error')
  }
  return status
}

export function stopAudio() {
  cancelAnimationFrame(raf)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  ctx?.close().catch(() => {})
  ctx = null
  audio.active = false
  audio.bass = audio.mid = audio.high = audio.level = audio.beat = 0
  audio.bands.fill(0)
  if (status !== 'denied' && status !== 'error') setStatus('off')
}

function loop(an: AnalyserNode, rate: number) {
  const bins = new Float32Array(an.frequencyBinCount)
  const hz = rate / an.fftSize
  const bin = (f: number) => Math.max(1, Math.min(bins.length - 1, Math.round(f / hz)))
  // Running peaks for automatic gain, and a short history of bass for beat detection.
  const peak = { bass: 0.2, mid: 0.2, high: 0.2, band: new Float32Array(64).fill(0.2) }
  const history: number[] = []
  let lastBeat = 0
  let silentFrames = 0
  let last = performance.now()

  const avg = (from: number, to: number) => {
    let s = 0
    const a = bin(from)
    const b = Math.max(a + 1, bin(to))
    for (let i = a; i < b; i++) s += Math.pow(10, bins[i] / 20) // dB → linear
    return s / (b - a)
  }

  const tick = () => {
    const now = performance.now()
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    an.getFloatFrequencyData(bins)
    const raw = { bass: avg(20, 150), mid: avg(150, 2000), high: avg(2000, 12000) }
    const decay = Math.pow(0.5, dt / 4) // peaks halve over ~4s, so the scale follows the song
    const norm = (k: 'bass' | 'mid' | 'high') => {
      peak[k] = Math.max(raw[k], peak[k] * decay, 1e-5)
      return Math.min(1, raw[k] / peak[k])
    }
    const ease = (cur: number, next: number, up: number, down: number) => cur + (next - cur) * Math.min(1, dt * (next > cur ? up : down))
    audio.bass = ease(audio.bass, norm('bass'), 30, 8)
    audio.mid = ease(audio.mid, norm('mid'), 20, 6)
    audio.high = ease(audio.high, norm('high'), 25, 8)
    audio.level = (audio.bass + audio.mid + audio.high) / 3

    for (let i = 0; i < 64; i++) {
      const f0 = 30 * Math.pow(16000 / 30, i / 64)
      const f1 = 30 * Math.pow(16000 / 30, (i + 1) / 64)
      const v = avg(f0, f1)
      peak.band[i] = Math.max(v, peak.band[i] * decay, 1e-5)
      audio.bands[i] = ease(audio.bands[i], Math.min(1, v / peak.band[i]), 30, 7)
    }

    // A beat is a bass hit clearly louder than the recent average.
    history.push(raw.bass)
    if (history.length > 43) history.shift()
    const mean = history.reduce((a, b) => a + b, 0) / history.length
    if (raw.bass > mean * 1.35 && raw.bass > peak.bass * 0.45 && now - lastBeat > 280) {
      lastBeat = now
      audio.beat = 1
      audio.beats++
    } else audio.beat *= Math.pow(0.02, dt)

    // All quiet (paused, or nothing captured) for a while: let backgrounds fall back to their own motion.
    silentFrames = raw.bass + raw.mid < 1e-6 ? silentFrames + 1 : 0
    audio.active = silentFrames < 90
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}
