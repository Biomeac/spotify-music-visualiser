import type { Line } from './lrc'
import { hash } from './hash'

export interface ThreadMessage {
  index: number
  line: Line
  /** 'in' = grey bubble on the left, 'out' = blue bubble on the right. */
  side: 'in' | 'out'
  reaction: string | null
}

const REACTIONS = ['❤️', '👍', '😂', '‼️', '🔥', '😭']

/**
 * Turns lyric lines into a two-person text conversation.
 * The sender switches at instrumental breaks, at pauses of 2.5s+, and otherwise every 2 to 4 lines,
 * so it reads like a back-and-forth chat.
 */
export function toThread(lines: Line[]): ThreadMessage[] {
  const out: ThreadMessage[] = []
  let side: 'in' | 'out' = 'in'
  let prevEnd = -Infinity
  let started = false
  let run = 0
  let runLimit = 2
  const flip = () => {
    side = side === 'in' ? 'out' : 'in'
    run = 0
  }
  lines.forEach((line, index) => {
    if (!line.text) {
      if (started) flip()
      started = false
      return
    }
    if (started && (line.start - prevEnd > 2.5 || run >= runLimit)) flip()
    if (run === 0) runLimit = 2 + Math.floor(hash(line.text, 99) * 3)
    run++
    started = true
    prevEnd = line.singEnd
    const h = hash(line.text, index)
    out.push({ index, line, side, reaction: h < 0.16 ? REACTIONS[Math.floor(hash(line.text, 7) * REACTIONS.length)] : null })
  })
  return out
}
