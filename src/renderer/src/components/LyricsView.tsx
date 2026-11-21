import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useSongTime } from '../lib/clock'
import { DEFAULT_MESSAGES, type LyricStyle, type MessagesSettings, type Track } from '../../../shared'
import MessagesView from './MessagesView'
import { CinemaLyrics, GlitchLyrics, PosterLyrics, VinylLyrics, WaveLyrics } from './MoreStyles'
import { BounceLyrics, KineticLyrics, NeonLyrics, TypewriterLyrics } from './AnimatedStyles'
import { activeLineIndex, wordProgress, type Line } from '../lib/lrc'

interface Props {
  lines: Line[]
  t: number
  style: LyricStyle
  onSeek?: (sec: number) => void
  track?: Track | null
  messages?: MessagesSettings
}

export function LineWords({ line, t }: { line: Line; t: number }) {
  return (
    <>
      {line.words.map((w, i) => {
        const p = wordProgress(w, t)
        return (
          <span key={i} className={`w ${p >= 1 ? 'sung' : p > 0 ? 'singing' : ''}`} style={{ '--p': p } as CSSProperties}>
            {w.text}
            {i < line.words.length - 1 ? ' ' : ''}
          </span>
        )
      })}
    </>
  )
}

const StaticLine = memo(function StaticLine({ text, state, start, onSeek }: { text: string; state: string; start: number; onSeek?: (s: number) => void }) {
  return (
    <div className={`line ${state}`} onClick={onSeek ? () => onSeek(start) : undefined}>
      {text || '♪'}
    </div>
  )
})

/** Instrumental gaps: three dots that fill up until the next line. */
function Breath({ from, to, t }: { from: number; to: number; t: number }) {
  const p = Math.max(0, Math.min(1, (t - from) / Math.max(0.1, to - from)))
  return (
    <div className="breath">
      {[0, 1, 2].map((i) => (
        <i key={i} style={{ opacity: 0.25 + 0.75 * Math.max(0, Math.min(1, p * 3 - i)) }} />
      ))}
    </div>
  )
}

function ScrollingLyrics({ lines, t, style, onSeek }: Props) {
  const active = activeLineIndex(lines, t)
  const listRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const el = list.children[Math.max(0, active)] as HTMLElement | undefined
    if (el) setOffset(-(el.offsetTop + el.offsetHeight / 2))
  }, [active, lines])

  return (
    <div className={`lyrics scroll style-${style}`}>
      <div className="lyrics-list" ref={listRef}>
        {lines.map((line, i) => {
          // Lines move one after another, like a wave rolling down the list.
          const rel = i - Math.max(0, active)
          const lw = { transform: `translateY(${offset}px)`, transitionDelay: `${rel >= -1 ? Math.min(8, rel + 1) * 38 : 0}ms` }
          let inner
          if (i === active && line.text)
            inner = (
              <div className="line active">
                <LineWords line={line} t={t} />
              </div>
            )
          else if (i === active && !line.text)
            inner = (
              <div className="line active">
                <Breath from={line.start} to={line.end} t={t} />
              </div>
            )
          else {
            const dist = Math.abs(i - active)
            const state = i < active ? `past d${Math.min(dist, 4)}` : `future d${Math.min(dist, 4)}`
            inner = <StaticLine text={line.text} state={state} start={line.start} onSeek={onSeek} />
          }
          return (
            <div key={i} className="lw" style={lw}>
              {inner}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FocusLyrics({ lines, t }: Props) {
  const active = activeLineIndex(lines, t)
  const line = lines[active]
  const next = lines[active + 1]
  if (!line || !line.text) {
    const upcoming = lines[active + 1]
    return (
      <div className="lyrics style-focus">
        {upcoming && <Breath from={line?.start ?? 0} to={upcoming.start} t={t} />}
      </div>
    )
  }
  return (
    <div className="lyrics style-focus">
      <div className="focus-line" key={active}>
        <LineWords line={line} t={t} />
      </div>
      {next?.text && <div className="focus-next">{next.text}</div>}
    </div>
  )
}

/** Lyrics with their own per-frame clock, so the rest of the app doesn't re-render 60 times a second. */
export default function LyricsView(props: Omit<Props, 't'>) {
  const t = useSongTime()
  return <StyledLyrics {...props} t={t} />
}

function StyledLyrics(props: Props) {
  if (props.style === 'focus') return <FocusLyrics {...props} />
  if (props.style === 'messages') return <MessagesView lines={props.lines} t={props.t} track={props.track ?? null} settings={props.messages ?? DEFAULT_MESSAGES} />
  if (props.style === 'kinetic') return <KineticLyrics {...props} />
  if (props.style === 'neon') return <NeonLyrics {...props} />
  if (props.style === 'typewriter') return <TypewriterLyrics {...props} />
  if (props.style === 'bounce') return <BounceLyrics {...props} />
  if (props.style === 'poster') return <PosterLyrics {...props} />
  if (props.style === 'vinyl') return <VinylLyrics {...props} />
  if (props.style === 'glitch') return <GlitchLyrics {...props} />
  if (props.style === 'cinema') return <CinemaLyrics {...props} />
  if (props.style === 'wave') return <WaveLyrics {...props} />
  return <ScrollingLyrics {...props} />
}
