import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { activeLineIndex, wordProgress, type Line } from '../lib/lrc'
import { hash } from '../lib/hash'

interface Props {
  lines: Line[]
  t: number
}

/** Keeps the previous line on screen briefly so it can animate out. */
function useExiting(lines: Line[], t: number) {
  const active = activeLineIndex(lines, t)
  const line = lines[active]
  const prev = active > 0 ? lines[active - 1] : null
  const exiting = prev?.text && line && t - line.start < 0.7 ? prev : null
  return { active, line, exiting, next: lines[active + 1] }
}

/* ---------------- Kinetic: words fly in from random directions, sizes vary ---------------- */
export function KineticLyrics({ lines, t }: Props) {
  const { active, line, exiting } = useExiting(lines, t)
  const renderLine = (l: Line, idx: number, cls: string) => (
    <div className={`kin-line ${cls}`} key={`${cls}-${idx}`}>
      {l.words.map((w, i) => {
        const p = wordProgress(w, t)
        const h1 = hash(w.text, idx * 31 + i)
        const h2 = hash(w.text, idx * 17 + i + 5)
        const big = w.text.replace(/\W/g, '').length >= 6 || h1 > 0.82
        const style = {
          '--rx': `${(h1 - 0.5) * 140}px`,
          '--ry': `${(h2 - 0.5) * 120 + 40}px`,
          '--rot': `${(h1 - 0.5) * 50}deg`,
          '--sc': big ? 1.3 : 0.85 + h2 * 0.35,
          '--p': p
        } as CSSProperties
        return (
          <span key={i} className={`kw ${p > 0 ? 'in' : ''} ${p > 0 && p < 1 ? 'now' : ''} ${big ? 'big' : ''}`} style={style}>
            {w.text}
          </span>
        )
      })}
    </div>
  )
  return (
    <div className="lyrics style-kinetic">
      {exiting && renderLine(exiting, active - 1, 'exit')}
      {line?.text ? renderLine(line, active, 'enter') : <div className="kin-idle">♪</div>}
    </div>
  )
}

/* ---------------- Neon: tube lettering that flickers on as each word is sung ---------------- */
export function NeonLyrics({ lines, t }: Props) {
  const { active, line, next } = useExiting(lines, t)
  const prev = lines.slice(0, Math.max(0, active)).reverse().find((l) => l.text)
  return (
    <div className="lyrics style-neon">
      {prev && <div className="neon-line dim" key={`p${active}`}>{prev.text}</div>}
      <div className="neon-line main" key={active}>
        {line?.text
          ? line.words.map((w, i) => {
              const p = wordProgress(w, t)
              return (
                <span key={i} className={`nw ${p > 0 ? 'lit' : ''}`} style={{ '--d': `${hash(w.text, i) * 0.25}s` } as CSSProperties}>
                  {w.text}
                  {i < line.words.length - 1 ? ' ' : ''}
                </span>
              )
            })
          : '♪'}
      </div>
      {next?.text && <div className="neon-line off" key={`n${active}`}>{next.text}</div>}
    </div>
  )
}

/* ---------------- Typewriter: characters typed in as they are sung, page scrolls up ---------------- */
export function TypewriterLyrics({ lines, t }: Props) {
  const active = activeLineIndex(lines, t)
  const from = Math.max(0, active - 6)
  const visible = lines.slice(from, active + 1).map((l, i) => ({ l, idx: from + i }))
  return (
    <div className="lyrics style-typewriter">
      <div className="page">
        {visible.map(({ l, idx }) => {
          if (idx !== active)
            return (
              <div className="tw-line" key={idx} style={{ opacity: 0.25 + 0.75 * ((idx - from + 1) / (active - from + 1)) * 0.6 }}>
                {l.text || ' '}
              </div>
            )
          let typed = ''
          l.words.forEach((w, i) => {
            const n = Math.ceil(wordProgress(w, t) * w.text.length)
            if (n > 0) typed += (i ? ' ' : '') + w.text.slice(0, n)
          })
          return (
            <div className="tw-line current" key={idx}>
              {typed.split('').map((ch, i) => (
                <span key={i} className="ch" style={{ '--j': `${(hash(ch, i + idx) - 0.5) * 2}px` } as CSSProperties}>
                  {ch}
                </span>
              ))}
              <span className="caret" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- Bounce: classic bouncing ball hops word to word, letters ripple ---------------- */
export function BounceLyrics({ lines, t }: Props) {
  const active = activeLineIndex(lines, t)
  const line = lines[active]
  const lineRef = useRef<HTMLDivElement>(null)
  const [centres, setCentres] = useState<{ x: number; y: number }[]>([])

  useLayoutEffect(() => {
    const el = lineRef.current
    if (!el) return setCentres([])
    const box = el.getBoundingClientRect()
    setCentres(
      [...el.querySelectorAll<HTMLElement>('.bw')].map((w) => {
        const r = w.getBoundingClientRect()
        return { x: r.left - box.left + r.width / 2, y: r.top - box.top }
      })
    )
  }, [active, lines])

  let ball: CSSProperties | null = null
  if (line?.text && centres.length === line.words.length) {
    const words = line.words
    let i = words.findIndex((w) => t < w.end)
    if (i === -1) i = words.length - 1
    const w = words[i]
    const prevC = centres[Math.max(0, i - 1)]
    const c = centres[i]
    // Hop from previous word to this one during the first part of the word, then rest on it.
    const hopDur = Math.min(0.35, (w.end - w.start) * 0.6)
    const hp = i === 0 && t < w.start ? 0 : Math.max(0, Math.min(1, (t - w.start) / Math.max(0.05, hopDur)))
    const x = prevC.x + (c.x - prevC.x) * hp
    const y = Math.min(prevC.y, c.y) - 14 - Math.sin(Math.PI * hp) * 46
    ball = { transform: `translate(${x}px, ${y}px) scale(${hp > 0.92 || hp < 0.08 ? '1.15, 0.85' : '1'})` }
  }

  const next = lines[active + 1]
  return (
    <div className="lyrics style-bounce">
      <div className="bounce-line" ref={lineRef} key={active}>
        {ball && <div className="ball" style={ball} />}
        {line?.text
          ? line.words.map((w, i) => {
              const p = wordProgress(w, t)
              return (
                <span key={i} className={`bw ${p >= 1 ? 'done' : p > 0 ? 'now' : ''}`}>
                  {w.text.split('').map((ch, j) => (
                    <span key={j} className="bl" style={{ '--i': j } as CSSProperties}>
                      {ch}
                    </span>
                  ))}
                </span>
              )
            })
          : '♪'}
      </div>
      {next?.text && <div className="bounce-next">{next.text}</div>}
    </div>
  )
}
