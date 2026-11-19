import { useMemo } from 'react'
import type { Track } from '../../../shared'
import { activeLineIndex, wordProgress, type Line } from '../lib/lrc'
import { toThread } from '../lib/threads'

const VISIBLE = 9
const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export default function MessagesView({ lines, t, track }: { lines: Line[]; t: number; track: Track | null }) {
  const thread = useMemo(() => toThread(lines), [lines])
  const startedAt = useMemo(() => fmtTime(new Date()), [track?.id])
  const active = activeLineIndex(lines, t)

  // Messages already "sent": every thread message whose line has started.
  const sentCount = thread.findIndex((m) => m.index > active)
  const sent = thread.slice(0, sentCount === -1 ? thread.length : sentCount)
  const next = sentCount === -1 ? null : thread[sentCount]
  const last = sent[sent.length - 1]
  // "Typing…" shows on the next sender's side shortly before their line arrives.
  const typingLead = next ? Math.min(2.2, Math.max(0.9, next.line.text.length * 0.035)) : 0
  const typing = next && t >= next.line.start - typingLead && (!last || t > last.line.singEnd - 0.1)

  const shown = sent.slice(-VISIBLE)
  const lastOut = [...sent].reverse().find((m) => m.side === 'out')
  const readAfter = lastOut && sent.some((m) => m.side === 'in' && m.index > lastOut.index)

  const first = track?.artists.split(', ')[0] ?? 'Unknown'

  return (
    <div className="lyrics style-messages">
      <div className="phone">
        <div className="contact">
          <div className="avatar">{track?.artUrl ? <img src={track.artUrl} alt="" /> : first[0]}</div>
          <div className="contact-name">
            {first} <span>›</span>
          </div>
        </div>
        <div className="thread">
          <div className="stamp">
            <b>iMessage</b>
            <br />
            Today {startedAt}
          </div>
          {shown.map((m, i) => {
            const nextMsg = shown[i + 1]
            const tail = nextMsg ? nextMsg.side !== m.side : !(typing && next?.side === m.side)
            const groupStart = i === 0 || shown[i - 1].side !== m.side
            const live = m.index === active
            const reactAt = m.line.singEnd + 0.6
            return (
              <div key={m.index} className={`msg ${m.side} ${groupStart ? 'group-start' : ''}`}>
                <div className={`bubble ${m.side} ${tail ? 'tail' : ''} ${live ? 'live' : ''}`}>
                  {live
                    ? m.line.words.map((w, j) => {
                        const p = wordProgress(w, t)
                        return (
                          <span key={j} className={`mw ${p > 0 ? 'on' : ''}`}>
                            {w.text}
                            {j < m.line.words.length - 1 ? ' ' : ''}
                          </span>
                        )
                      })
                    : m.line.text}
                  {m.reaction && t > reactAt && <span className={`tapback ${m.side}`}>{m.reaction}</span>}
                </div>
                {m === lastOut && (
                  <div className="receipt">{readAfter ? <>Read {startedAt}</> : 'Delivered'}</div>
                )}
              </div>
            )
          })}
          {typing && next && (
            <div className={`msg ${next.side}`} key={`typing-${next.index}`}>
              <div className={`bubble typing ${next.side} tail`}>
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
