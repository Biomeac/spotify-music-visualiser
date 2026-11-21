import type { CSSProperties } from 'react'
import type { Track } from '../../../shared'
import { activeLineIndex, wordProgress, type Line } from '../lib/lrc'
import { hash } from '../lib/hash'

interface Props {
  lines: Line[]
  t: number
  track?: Track | null
}

const nextText = (lines: Line[], from: number) => lines.slice(from + 1).find((l) => l.text)
const prevText = (lines: Line[], from: number) => lines.slice(0, Math.max(0, from)).reverse().find((l) => l.text)
const tc = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const f = Math.floor((s % 1) * 24)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}:${String(f).padStart(2, '0')}`
}

/* ---------------- Poster: Swiss editorial type, one stacked word per row ---------------- */
export function PosterLyrics({ lines, t, track }: Props) {
  const active = activeLineIndex(lines, t)
  const line = lines[active]
  const sungCount = lines.filter((l) => l.text).length
  const number = lines.slice(0, active + 1).filter((l) => l.text).length
  const words = line?.text ? line.words : []
  const longest = Math.max(4, ...words.map((w) => w.text.length))
  const rows = Math.max(1, words.length)
  const size = `min(${Math.min(22, 70 / rows)}vh, ${Math.min(16, 130 / longest)}vw)`
  return (
    <div className="lyrics style-poster">
      <div className="poster-meta top">
        <span>
          Nº {String(number).padStart(2, '0')} / {String(sungCount).padStart(2, '0')}
        </span>
        <span>{track?.artists}</span>
      </div>
      <div className="poster-words" key={active} style={{ fontSize: `calc(${size} * var(--scale))` }}>
        {words.length ? (
          words.map((w, i) => {
            const p = wordProgress(w, t)
            return (
              <div key={i} className={`pw ${p >= 1 ? 'sung' : p > 0 ? 'now' : ''} ${i % 3 === 1 ? 'serif' : ''}`} style={{ '--p': p, '--i': i } as CSSProperties}>
                <span className="outline">{w.text}</span>
                <span className="fill">{w.text}</span>
              </div>
            )
          })
        ) : (
          <div className="pw rest">—</div>
        )}
      </div>
      <div className="poster-meta bottom">
        <span>{track?.name}</span>
        <span className="mono">{tc(Math.max(0, t))}</span>
      </div>
    </div>
  )
}

/* ---------------- Vinyl: a spinning record with the line wrapped around it ---------------- */
function ArcText({ line, t, id, d, size, dim }: { line: Line; t: number; id: string; d: string; size: number; dim?: boolean }) {
  return (
    <>
      <path id={id} d={d} fill="none" />
      <text className={`arc-text ${dim ? 'dim' : ''}`} style={{ fontSize: size }}>
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {line.words.map((w, i) => {
            const p = dim ? 0 : wordProgress(w, t)
            return (
              <tspan key={i} className={p >= 1 ? 'sung' : p > 0 ? 'now' : ''}>
                {w.text + (i < line.words.length - 1 ? ' ' : '')}
              </tspan>
            )
          })}
        </textPath>
      </text>
    </>
  )
}

export function VinylLyrics({ lines, t, track }: Props) {
  const active = activeLineIndex(lines, t)
  const line = lines[active]
  const next = nextText(lines, active)
  const arc = Math.PI * 395
  const fit = (l: Line, max: number) => Math.max(26, Math.min(max, arc / (l.text.length * 0.56)))
  return (
    <div className="lyrics style-vinyl">
      <svg viewBox="0 0 1000 1000" className="vinyl-svg">
        <defs>
          <clipPath id="label">
            <circle cx="500" cy="500" r="118" />
          </clipPath>
          <radialGradient id="grooves" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#111" />
            <stop offset="100%" stopColor="#050505" />
          </radialGradient>
        </defs>
        <g className="disc">
          <circle cx="500" cy="500" r="300" fill="url(#grooves)" />
          {Array.from({ length: 26 }, (_, i) => (
            <circle key={i} cx="500" cy="500" r={130 + i * 6.4} fill="none" stroke="rgba(255,255,255,.045)" strokeWidth="1" />
          ))}
          <path d="M 500 200 A 300 300 0 0 1 760 350" stroke="rgba(255,255,255,.14)" strokeWidth="30" fill="none" className="sheen" />
          {track?.artUrl ? (
            <image href={track.artUrl} x="382" y="382" width="236" height="236" clipPath="url(#label)" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <circle cx="500" cy="500" r="118" fill="var(--accent)" />
          )}
          <circle cx="500" cy="500" r="9" fill="#000" />
        </g>
        <g className="tonearm">
          <circle cx="840" cy="170" r="26" fill="#2a2a2e" stroke="#555" />
          <path d="M 840 170 L 800 520 L 720 600" stroke="#b9b9be" strokeWidth="9" strokeLinecap="round" fill="none" />
          <rect x="690" y="585" width="50" height="26" rx="5" fill="#d8d8dc" transform="rotate(-40 715 598)" />
        </g>
        {line?.text && <ArcText key={active} line={line} t={t} id="arcTop" d="M 105 500 A 395 395 0 0 1 895 500" size={fit(line, 74)} />}
        {next && <ArcText key={`n${active}`} line={next} t={t} id="arcBottom" d="M 85 500 A 415 415 0 0 0 915 500" size={fit(next, 40) * 0.8} dim />}
      </svg>
    </div>
  )
}

/* ---------------- Glitch: RGB-split, sliced type that corrupts as each word hits ---------------- */
export function GlitchLyrics({ lines, t }: Props) {
  const active = activeLineIndex(lines, t)
  const line = lines[active]
  const next = nextText(lines, active)
  return (
    <div className="lyrics style-glitch">
      <div className="scanlines" />
      <div className="glitch-line" key={active}>
        {line?.text
          ? line.words.map((w, i) => {
              const p = wordProgress(w, t)
              return (
                <span key={i} className={`gw ${p >= 1 ? 'sung' : p > 0 ? 'now' : ''}`} data-text={w.text} style={{ '--g': hash(w.text, i) } as CSSProperties}>
                  {w.text}
                </span>
              )
            })
          : <span className="gw sung blink">▮</span>}
      </div>
      {next && <div className="glitch-next">&gt; {next.text}</div>}
    </div>
  )
}

/* ---------------- Cinema: letterboxed film with subtitles ---------------- */
export function CinemaLyrics({ lines, t, track }: Props) {
  const active = activeLineIndex(lines, t)
  const line = lines[active]
  const prev = prevText(lines, active)
  return (
    <div className="lyrics style-cinema">
      <div className="bar top">
        <span>{track?.artists?.toUpperCase()}</span>
        <span>“{track?.name}”</span>
      </div>
      <div className="frame">
        <div className="subs">
          {prev && t - (line?.start ?? 0) < 0.5 && <div className="sub-line prev">{prev.text}</div>}
          {line?.text && (
            <div className="sub-line" key={active}>
              {line.words.map((w, i) => {
                const p = wordProgress(w, t)
                return (
                  <span key={i} className={p > 0 ? 'on' : ''}>
                    {w.text}
                    {i < line.words.length - 1 ? ' ' : ''}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <div className="bar bottom">
        <span className="mono">{tc(Math.max(0, t))}</span>
        <span>SUBTITLES · EN</span>
      </div>
    </div>
  )
}

/* ---------------- Wave: letters ride a travelling wave that swells around the sung word ---------------- */
export function WaveLyrics({ lines, t }: Props) {
  const active = activeLineIndex(lines, t)
  const line = lines[active]
  const next = nextText(lines, active)
  let k = 0
  return (
    <div className="lyrics style-wave">
      <div className="wave-line" key={active}>
        {line?.text
          ? line.words.map((w, i) => {
              const p = wordProgress(w, t)
              const near = p > 0 && p < 1 ? 1 : p >= 1 ? 0.35 : 0.2
              return (
                <span key={i} className={`ww ${p >= 1 ? 'sung' : p > 0 ? 'now' : ''}`}>
                  {w.text.split('').map((ch, j) => {
                    const idx = k++
                    const lit = p * w.text.length > j
                    const y = Math.sin(t * 4.2 - idx * 0.42) * 0.16 * near
                    return (
                      <span key={j} className={`wl ${lit ? 'lit' : ''}`} style={{ transform: `translateY(${y}em) rotate(${y * 30}deg)` }}>
                        {ch}
                      </span>
                    )
                  })}
                </span>
              )
            })
          : '♪'}
      </div>
      {next && <div className="wave-next">{next.text}</div>}
    </div>
  )
}
