import type { Line } from './lrc'
import { hash } from './hash'

export type ScreenEffect = 'love' | 'fire' | 'stars' | 'rain' | 'confetti' | 'money' | 'balloons'
export type BubbleEffect = 'none' | 'slam' | 'loud' | 'gentle' | 'ink'

export interface Sender {
  name: string
  color: string
}

interface Base {
  id: string
  side: 'in' | 'out'
  sender: Sender
  /** Song time (s) when the item appears in the thread. */
  appearAt: number
}

export interface TextItem extends Base {
  kind: 'text'
  index: number
  line: Line
  effect: BubbleEffect
  screen: ScreenEffect | null
  reaction: string | null
  /** For outgoing lines: when typing into the text box starts. */
  typeFrom: number
}

export interface VoiceItem extends Base {
  kind: 'voice'
  end: number
}

export interface LinkItem extends Base {
  kind: 'link'
}

export type ThreadItem = TextItem | VoiceItem | LinkItem

const REACTIONS = ['❤️', '👍', '😂', '‼️', '🔥', '😭', '😮']
const SENDER_COLORS = ['#ff9f0a', '#30d158', '#64d2ff', '#bf5af2', '#ff375f', '#ffd60a']

const SCREEN_WORDS: [RegExp, ScreenEffect][] = [
  [/\b(love|lovin'?|loving|heart|hearts|kiss|kisses|baby|darling)\b/i, 'love'],
  [/\b(fire|burn|burning|flame|flames|hot|lit|blaze)\b/i, 'fire'],
  [/\b(star|stars|sky|skies|moon|galaxy|satellite|space|universe|shine|shining)\b/i, 'stars'],
  [/\b(rain|raining|cry|crying|tears|storm|ocean|drown|drowning)\b/i, 'rain'],
  [/\b(party|dance|dancing|celebrate|alive|wild|crazy|tonight)\b/i, 'confetti'],
  [/\b(money|cash|rich|gold|diamond|diamonds|dollar|paid|bands)\b/i, 'money'],
  [/\b(fly|flying|high|higher|float|floating|birthday|up)\b/i, 'balloons']
]

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim()

/**
 * Turns lyric lines into a text conversation.
 * - Senders swap at instrumental breaks, long pauses and every 2–4 lines; with several credited
 *   artists the incoming side becomes a group chat that rotates through them.
 * - Choruses arrive with "slam", shouted lines are "loud", lines in brackets are "gentle", and a few
 *   lines hide under invisible ink until they are sung.
 * - Keywords trigger full-screen effects (hearts, fire, stars…), at most one every 12s.
 * - Long instrumental breaks become voice notes.
 */
export function toThread(lines: Line[], artists: string[]): ThreadItem[] {
  const me: Sender = { name: 'You', color: '#0a84ff' }
  const them: Sender[] = (artists.length ? artists : ['Unknown']).map((name, i) => ({ name, color: SENDER_COLORS[i % SENDER_COLORS.length] }))
  const items: ThreadItem[] = [{ kind: 'link', id: 'link', side: 'out', sender: me, appearAt: -Infinity }]

  const seen = new Map<string, number>()
  let side: 'in' | 'out' = 'in'
  let verse = 0
  let run = 0
  let runLimit = 2
  let prevEnd = -Infinity
  let started = false
  let lastScreen = -Infinity
  let prevWasChorus = false
  const flip = () => {
    side = side === 'in' ? 'out' : 'in'
    if (side === 'in') verse++
    run = 0
  }

  lines.forEach((line, index) => {
    if (!line.text) {
      if (started) flip()
      started = false
      return
    }
    const gap = line.start - prevEnd
    if (started && (gap > 2.5 || run >= runLimit)) flip()
    // Long instrumental break: the next sender sends a voice note that "plays" through it.
    if (gap > 7 && Number.isFinite(prevEnd)) {
      const vSender = side === 'out' ? me : them[verse % them.length]
      items.push({ kind: 'voice', id: `v${index}`, side, sender: vSender, appearAt: prevEnd + 0.6, end: line.start - 0.2 })
    }
    if (run === 0) runLimit = 2 + Math.floor(hash(line.text, 99) * 3)
    run++
    started = true
    prevEnd = line.singEnd

    const key = norm(line.text)
    const count = seen.get(key) ?? 0
    seen.set(key, count + 1)
    const isChorus = count > 0
    let effect: BubbleEffect = 'none'
    if (/^\s*[([].*[)\]]\s*$/.test(line.text)) effect = 'gentle'
    else if (isChorus && !prevWasChorus) effect = 'slam'
    else if (/!/.test(line.text) || (line.text === line.text.toUpperCase() && /[A-Z]{3}/.test(line.text))) effect = 'loud'
    else if (!isChorus && line.text.length > 14 && hash(line.text, 3) < 0.12) effect = 'ink'
    prevWasChorus = isChorus

    let screen: ScreenEffect | null = null
    if (line.start - lastScreen > 12) {
      for (const [re, fx] of SCREEN_WORDS)
        if (re.test(line.text)) {
          screen = fx
          lastScreen = line.start
          break
        }
    }

    const h = hash(line.text, index)
    const reaction = h < (isChorus ? 0.3 : 0.12) ? REACTIONS[Math.floor(hash(line.text, 7) * REACTIONS.length)] : null
    const sender = side === 'out' ? me : them[verse % them.length]
    items.push({
      kind: 'text',
      id: `t${index}`,
      index,
      line,
      side,
      sender,
      effect,
      screen,
      reaction,
      typeFrom: line.start,
      appearAt: line.start
    })
  })
  return items
}

/** With live typing, your own lines are typed while sung and "sent" when finished. */
export function applyLiveTyping(items: ThreadItem[], on: boolean): ThreadItem[] {
  if (!on) return items
  return items.map((it) => (it.kind === 'text' && it.side === 'out' ? { ...it, appearAt: Math.max(it.line.start + 0.25, it.line.singEnd) } : it))
}
