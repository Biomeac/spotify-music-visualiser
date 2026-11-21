import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { MessagesSettings, Track } from '../../../shared'
import { activeLineIndex, wordProgress, type Line } from '../lib/lrc'
import { applyLiveTyping, toThread, type ScreenEffect, type TextItem, type VoiceItem } from '../lib/threads'
import { hash } from '../lib/hash'
import { ArrowUp, ChevronLeft, ChevronRight, Delete, Mic, Pause, Play, Plus, Smile, Video, ArrowBigUp } from 'lucide-react'

const VISIBLE = 11
const fmtClock = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '')
const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.round(s % 60))).padStart(2, '0')}`

/* ---------------- Little pieces of iOS chrome ---------------- */

function StatusBar() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="ios-status">
      <span className="clock">{fmtClock(now)}</span>
      <span className="island">
        <i className="lens" />
      </span>
      <span className="icons">
        <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
          <rect x="0" y="7.5" width="3.2" height="4.5" rx="1" fill="currentColor" />
          <rect x="4.8" y="5" width="3.2" height="7" rx="1" fill="currentColor" />
          <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="1" fill="currentColor" />
          <rect x="14.4" y="0" width="3.2" height="12" rx="1" fill="currentColor" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden>
          <path d="M8 11.6 5.55 9.05a3.5 3.5 0 0 1 4.9 0Z" fill="currentColor" />
          <path d="M3.55 7.05a6.4 6.4 0 0 1 8.9 0" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" />
          <path d="M1.2 4.4a9.9 9.9 0 0 1 13.6 0" stroke="currentColor" strokeWidth="1.9" fill="none" strokeLinecap="round" />
        </svg>
        <svg width="28" height="13" viewBox="0 0 28 13" aria-hidden>
          <rect x=".6" y=".6" width="23.8" height="11.8" rx="3.8" fill="none" stroke="currentColor" strokeOpacity=".4" strokeWidth="1.1" />
          <rect x="2.2" y="2.2" width="17.5" height="8.6" rx="2.3" fill="currentColor" />
          <path d="M26 4.4v4.2c.8-.3 1.4-1.1 1.4-2.1s-.6-1.8-1.4-2.1Z" fill="currentColor" fillOpacity=".45" />
        </svg>
      </span>
    </div>
  )
}

/** The iMessage bubble tail, drawn the way iOS does: a little hook off the bottom corner. */
function Tail({ side }: { side: 'in' | 'out' }) {
  return (
    <svg className={`tail-svg ${side}`} width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <path d="M0 3H16C16 11.5 18.2 17.6 22 21.4 16.9 22.3 12.2 21.1 9.4 18.8 6.6 21.1 3.6 22 0 22Z" fill="currentColor" />
    </svg>
  )
}

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

/** The iOS keyboard, with the key being "pressed" popping up as your line is typed. */
function Keyboard({ pressed, up }: { pressed: string; up: boolean }) {
  const k = pressed.toLowerCase()
  return (
    <div className={`ios-kb ${up ? 'up' : ''}`}>
      <div className="kb-inner">
        {KEY_ROWS.map((row, r) => (
          <div key={r} className={`kb-row r${r}`}>
            {r === 2 && (
              <span className="key fn shift">
                <ArrowBigUp size={20} strokeWidth={1.6} />
              </span>
            )}
            {row.split('').map((c) => (
              <span key={c} className={`key ${k === c ? 'pressed' : ''}`}>
                {c}
                {k === c && <b className="pop">{c}</b>}
              </span>
            ))}
            {r === 2 && (
              <span className={`key fn del`}>
                <Delete size={20} strokeWidth={1.6} />
              </span>
            )}
          </div>
        ))}
        <div className="kb-row r3">
          <span className="key fn wide">123</span>
          <span className={`key space ${k === ' ' ? 'pressed' : ''}`}>space</span>
          <span className="key fn wide">return</span>
        </div>
        <div className="kb-bottom">
          <Smile size={25} strokeWidth={1.5} />
          <Mic size={23} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

/** Keeps the phone at true iPhone proportions and scales it to fit the window. */
function usePhoneScale() {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.8)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => setScale(Math.min((el.clientHeight - 16) / PHONE_H, (el.clientWidth - 32) / PHONE_W, 1.15))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, scale] as const
}
const PHONE_W = 434
const PHONE_H = 906

function Avatar({ name, color, art, size = 28 }: { name: string; color: string; art?: string | null; size?: number }) {
  return (
    <span className="ios-avatar" style={{ width: size, height: size, background: art ? undefined : `linear-gradient(${color}, color-mix(in srgb, ${color} 60%, #000))`, fontSize: size * 0.42 }}>
      {art ? <img src={art} alt="" /> : name.trim()[0]?.toUpperCase()}
    </span>
  )
}

/* ---------------- Full-screen message effects ---------------- */

const FX_GLYPHS: Record<ScreenEffect, string[]> = {
  love: ['❤️', '💕', '💖', '💗'],
  fire: ['🔥', '🔥', '✨'],
  stars: ['✨', '⭐️', '🌟', '💫'],
  rain: ['💧', '💧', '💦'],
  confetti: [],
  money: ['💸', '💵', '💰', '💎'],
  balloons: ['🎈', '🎈', '🎈']
}
const CONFETTI = ['#ff375f', '#ffd60a', '#30d158', '#64d2ff', '#bf5af2', '#ff9f0a']

function ScreenFx({ kind, seed }: { kind: ScreenEffect; seed: string }) {
  const n = kind === 'confetti' ? 70 : kind === 'rain' ? 40 : 26
  return (
    <div className={`screen-fx fx-${kind}`}>
      {Array.from({ length: n }, (_, i) => {
        const r1 = hash(seed, i)
        const r2 = hash(seed, i + 101)
        const r3 = hash(seed, i + 202)
        const style = {
          '--x': `${r1 * 100}%`,
          '--d': `${r2 * (kind === 'rain' ? 1.2 : 0.9)}s`,
          '--s': 0.6 + r3 * 1.1,
          '--dx': `${(r2 - 0.5) * 120}px`,
          '--rot': `${(r3 - 0.5) * 720}deg`,
          '--c': CONFETTI[i % CONFETTI.length]
        } as CSSProperties
        return kind === 'confetti' ? <i key={i} className="confetti" style={style} /> : (
          <span key={i} style={style}>
            {FX_GLYPHS[kind][i % FX_GLYPHS[kind].length]}
          </span>
        )
      })}
    </div>
  )
}

/* ---------------- Bubbles ---------------- */

function Words({ line, t, ink }: { line: Line; t: number; ink: boolean }) {
  return (
    <>
      {line.words.map((w, j) => {
        const p = wordProgress(w, t)
        return (
          <span key={j} className={`mw ${p > 0 ? 'on' : ''} ${ink && p <= 0 ? 'inked' : ''}`}>
            {w.text}
            {j < line.words.length - 1 ? ' ' : ''}
          </span>
        )
      })}
    </>
  )
}

function VoiceNote({ item, t }: { item: VoiceItem; t: number }) {
  const dur = item.end - item.appearAt
  const p = Math.max(0, Math.min(1, (t - item.appearAt) / dur))
  const playing = p > 0 && p < 1
  return (
    <div className={`voice ${playing ? 'playing' : ''}`}>
      <span className="vplay">{playing ? <Pause size={15} fill="currentColor" strokeWidth={0} /> : <Play size={15} fill="currentColor" strokeWidth={0} />}</span>
      <span className="wave">
        {Array.from({ length: 28 }, (_, i) => {
          const hgt = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + hash(item.id, i) * 3))
          return <i key={i} className={i / 28 < p ? 'done' : ''} style={{ '--h': hgt, '--i': i } as CSSProperties} />
        })}
      </span>
      <span className="vdur">{fmtDur(playing ? dur * (1 - p) : dur)}</span>
    </div>
  )
}

/* ---------------- The thread ---------------- */

export default function MessagesView({ lines, t, track, settings }: { lines: Line[]; t: number; track: Track | null; settings: MessagesSettings }) {
  const artists = useMemo(() => (track?.artists ?? '').split(', ').filter(Boolean), [track?.artists])
  const items = useMemo(() => applyLiveTyping(toThread(lines, artists), settings.liveTyping), [lines, artists, settings.liveTyping])
  const startedAt = useMemo(() => fmtTime(new Date()), [track?.id])
  const active = activeLineIndex(lines, t)
  const group = artists.length > 1

  const shownAll = items.filter((it) => it.appearAt <= t)
  const shown = shownAll.slice(-VISIBLE)
  const pending = items.filter((it) => it.appearAt > t)

  // Incoming "typing…" bubble just before their next message lands.
  const nextIn = pending.find((it) => it.side === 'in')
  const lastShown = shownAll[shownAll.length - 1]
  const lastText = [...shownAll].reverse().find((it): it is TextItem => it.kind === 'text')
  const lead = nextIn?.kind === 'text' ? Math.min(2.2, Math.max(0.8, nextIn.line.text.length * 0.035)) : 0.9
  const typing =
    nextIn &&
    t >= nextIn.appearAt - lead &&
    (!lastText || lastText.side === 'out' || t > lastText.line.singEnd - 0.15) &&
    (!lastShown || lastShown.kind !== 'voice' || t > lastShown.end - 1)

  // Your own line being typed into the text box right now.
  const composing = settings.liveTyping
    ? (pending.find((it): it is TextItem => it.kind === 'text' && it.side === 'out' && t >= it.typeFrom) ?? null)
    : null
  let typed = ''
  if (composing)
    composing.line.words.forEach((w, i) => {
      const n = Math.ceil(wordProgress(w, t) * w.text.length)
      if (n > 0) typed += (i ? ' ' : '') + w.text.slice(0, n)
    })

  // Effects: newest screen effect within 3.6s of arriving; slams shake the phone.
  const fx = settings.effects
    ? [...shownAll].reverse().find((it): it is TextItem => it.kind === 'text' && !!it.screen && t - it.appearAt < 3.6)
    : undefined
  const slam = settings.effects ? [...shownAll].reverse().find((it) => it.kind === 'text' && it.effect === 'slam' && t - it.appearAt < 0.7) : undefined

  const lastOut = [...shownAll].reverse().find((it) => it.side === 'out')
  const readAfter = lastOut && shownAll.some((it) => it.side === 'in' && it.appearAt > lastOut.appearAt)

  // Smoothly slide the thread up when a new bubble arrives (FLIP).
  const innerRef = useRef<HTMLDivElement>(null)
  const prevH = useRef(0)
  const countKey = `${shown.length}-${shown[shown.length - 1]?.id}-${typing ? 1 : 0}`
  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    const h = el.offsetHeight
    const delta = h - prevH.current
    prevH.current = h
    if (delta > 0 && delta < 400) {
      el.style.transition = 'none'
      el.style.transform = `translateY(${delta}px)`
      void el.offsetHeight
      el.style.transition = 'transform .38s cubic-bezier(.2,.9,.25,1)'
      el.style.transform = 'translateY(0)'
    }
  }, [countKey])

  // 3D tilt following the mouse.
  const phoneRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!settings.tilt) return
    const onMove = (e: MouseEvent) => {
      const el = phoneRef.current
      if (!el) return
      const x = e.clientX / window.innerWidth - 0.5
      const y = e.clientY / window.innerHeight - 0.5
      el.style.setProperty('--ry', `${x * 10}deg`)
      el.style.setProperty('--rx', `${-y * 8}deg`)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [settings.tilt])

  const title = group ? artists.join(', ') : (artists[0] ?? 'Unknown')
  const bubbleClass = `bub-${settings.bubble}`

  const [stageRef, scale] = usePhoneScale()
  const keyboardUp =
    settings.keyboard !== false &&
    settings.liveTyping &&
    // Stay up through a back-and-forth instead of bouncing between every line.
    (!!composing ||
      (!!lastOut && t - lastOut.appearAt < 2.5) ||
      pending.some((it) => it.side === 'out' && it.kind === 'text' && it.typeFrom - t < 1.2))
  const pressed = composing && typed ? typed[typed.length - 1] : ''
  const unread = (hash(track?.id ?? 'x') * 40 + 3) | 0

  return (
    <div className={`lyrics style-messages theme-${settings.theme} ${bubbleClass}`} ref={stageRef}>
      <div className={`phone-wrap ${settings.tilt ? 'tilt' : ''}`} ref={phoneRef} style={{ '--s': scale } as CSSProperties}>
        <div className={`iphone ${slam ? 'shake' : ''}`} key={slam?.id ?? 'phone'}>
          <i className="hw action" />
          <i className="hw vol-up" />
          <i className="hw vol-down" />
          <i className="hw power" />
          <i className="hw cam" />
          <div className="screen">
            <StatusBar />
            <div className="ios-header">
              <span className="back">
                <ChevronLeft size={32} strokeWidth={2.3} />
                <b>{unread}</b>
              </span>
              <div className="who">
                {group ? (
                  <span className="stack">
                    {artists.slice(0, 3).map((a, i) => (
                      <Avatar key={a} name={a} color={['#ff9f0a', '#30d158', '#64d2ff'][i]} size={40} />
                    ))}
                  </span>
                ) : (
                  <Avatar name={title} color="#8e8e93" art={track?.artUrl} size={52} />
                )}
                <span className="who-name">
                  {title}
                  <ChevronRight size={11} strokeWidth={2.6} />
                </span>
              </div>
              <span className="video">
                <Video size={27} strokeWidth={1.7} />
              </span>
            </div>

            <div className="thread">
              <div className="thread-inner" ref={innerRef}>
                <div className="stamp">
                  <b>iMessage</b>
                  <br />
                  Today {startedAt}
                </div>
                {shown.map((it, i) => {
                  const prev = shown[i - 1]
                  const next = shown[i + 1]
                  const sameAsPrev = prev && prev.side === it.side && prev.sender.name === it.sender.name
                  const sameAsNext = next && next.side === it.side && next.sender.name === it.sender.name
                  const typingAfter = !next && typing && nextIn?.side === it.side
                  const tail = !sameAsNext && !typingAfter && it.kind !== 'link'
                  const showName = group && it.side === 'in' && !sameAsPrev
                  const showAvatar = group && it.side === 'in' && !sameAsNext && !typingAfter

                  let bubble
                  if (it.kind === 'link')
                    bubble = (
                      <div className="link-card">
                        {track?.artUrl ? <img src={track.artUrl} alt="" /> : <div className="noart" />}
                        <div className="lc-meta">
                          <b>{track?.name}</b>
                          <span>Song · {track?.artists}</span>
                          <small>open.spotify.com</small>
                        </div>
                      </div>
                    )
                  else if (it.kind === 'voice') bubble = <VoiceNote item={it} t={t} />
                  else {
                    const live = it.index === active && it.side === 'in'
                    bubble = (
                      <>
                        {live || it.effect === 'ink' ? <Words line={it.line} t={t} ink={settings.effects && it.effect === 'ink'} /> : it.line.text}
                        {it.reaction && t > it.line.singEnd + 0.6 && <span className={`tapback ${it.side}`}>{it.reaction}</span>}
                      </>
                    )
                  }
                  const fxClass = it.kind === 'text' && settings.effects ? `fx-${it.effect}` : ''
                  return (
                    <div key={it.id} className={`msg ${it.side} ${sameAsPrev ? '' : 'group-start'}`}>
                      {showName && <div className="sender-name">{it.sender.name}</div>}
                      <div className="msg-row">
                        {group && it.side === 'in' && (
                          <span className="avatar-slot">{showAvatar && <Avatar name={it.sender.name} color={it.sender.color} size={26} />}</span>
                        )}
                        <div
                          className={`bubble ${it.side} ${tail ? 'tail' : ''} ${it.kind} ${fxClass} ${it.kind === 'text' && it.index === active ? 'live' : ''}`}
                        >
                          {bubble}
                          {tail && <Tail side={it.side} />}
                        </div>
                      </div>
                      {it === lastOut && <div className="receipt">{readAfter ? <>Read {startedAt}</> : 'Delivered'}</div>}
                    </div>
                  )
                })}
                {typing && nextIn && (
                  <div className={`msg in ${lastShown?.side === 'in' && lastShown.sender.name === nextIn.sender.name ? '' : 'group-start'}`} key={`typing-${nextIn.id}`}>
                    <div className="msg-row">
                      {group && (
                        <span className="avatar-slot">
                          <Avatar name={nextIn.sender.name} color={nextIn.sender.color} size={26} />
                        </span>
                      )}
                      <div className="bubble typing in">
                        <i />
                        <i />
                        <i />
                        <span className="typing-tail" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="composer">
              <span className="plus">
                <Plus size={22} strokeWidth={2.2} />
              </span>
              <div className={`ios-field ${typed ? 'has-text' : ''}`}>
                {typed ? (
                  <>
                    <span>{typed}</span>
                    <span className="caret" />
                  </>
                ) : (
                  <span className="ph">iMessage</span>
                )}
                {typed ? (
                  <span className="send ready">
                    <ArrowUp size={19} strokeWidth={3} />
                  </span>
                ) : (
                  <span className="send">
                    <Mic size={19} strokeWidth={1.8} />
                  </span>
                )}
              </div>
            </div>
            <div className={`kb-space ${keyboardUp ? 'up' : ''}`} />
            <Keyboard pressed={pressed} up={keyboardUp} />
            <div className="home-bar" />
            {fx?.screen && <ScreenFx kind={fx.screen} seed={fx.id} key={fx.id} />}
            <div className="glare" />
          </div>
        </div>
      </div>
    </div>
  )
}
