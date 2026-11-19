// Parses LRC (and "enhanced" LRC with <mm:ss.xx> word tags) into lines and words with timings in seconds.

export interface Word {
  text: string
  start: number
  end: number
}

export interface Line {
  start: number
  /** When the next line starts (or the song ends). */
  end: number
  /** When we estimate the singing of this line finishes (<= end). */
  singEnd: number
  text: string
  words: Word[]
}

const LEADING_TIME = /^\s*\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/
const WORD_TAG = /<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>/g

const toSec = (m: string, s: string) => Number(m) * 60 + Number(s.replace(':', '.'))

export function parseLrc(lrc: string, durationSec?: number): Line[] {
  const raw: { start: number; text: string }[] = []
  for (const rawLine of lrc.split(/\r?\n/)) {
    const stamps: number[] = []
    let rest = rawLine
    let m: RegExpExecArray | null
    // Collect every leading [mm:ss.xx] (a line may repeat at several times).
    while ((m = LEADING_TIME.exec(rest))) {
      stamps.push(toSec(m[1], m[2]))
      rest = rest.slice(m[0].length)
    }
    if (!stamps.length) continue
    for (const start of stamps) raw.push({ start, text: rest.trim() })
  }
  raw.sort((a, b) => a.start - b.start)

  const lines: Line[] = []
  for (let i = 0; i < raw.length; i++) {
    const { start, text } = raw[i]
    const end = raw[i + 1]?.start ?? (durationSec && durationSec > start ? durationSec : start + 6)
    const words = text.includes('<') ? enhancedWords(text, start, end) : null
    const plainText = text.replace(WORD_TAG, '').replace(/\s+/g, ' ').trim()
    const singEnd = words?.length ? Math.min(end, words[words.length - 1].end) : estimateSingEnd(plainText, start, end)
    lines.push({ start, end, singEnd, text: plainText, words: words ?? estimateWords(plainText, start, singEnd) })
  }
  return lines
}

function estimateSingEnd(text: string, start: number, end: number) {
  if (!text) return start
  const words = text.split(' ').length
  // Rough singing pace; stops a long instrumental gap from stretching the last words.
  const guess = Math.max(1, text.length * 0.075 + words * 0.08)
  return start + Math.min(end - start, guess)
}

/** Spreads the line's duration across its words, weighted by length. */
export function estimateWords(text: string, start: number, end: number): Word[] {
  if (!text) return []
  const parts = text.split(' ')
  const weights = parts.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1.5)
  const total = weights.reduce((a, b) => a + b, 0)
  const span = Math.max(0, end - start)
  let t = start
  return parts.map((w, i) => {
    const d = (span * weights[i]) / total
    const word = { text: w, start: t, end: t + d }
    t += d
    return word
  })
}

function enhancedWords(text: string, lineStart: number, lineEnd: number): Word[] {
  const out: Word[] = []
  const pieces = text.split(WORD_TAG) // [before, m, s, piece, m, s, piece, ...]
  let lead = pieces[0].trim()
  for (let i = 1; i < pieces.length; i += 3) {
    const at = toSec(pieces[i], pieces[i + 1])
    const chunk = pieces[i + 2] ?? ''
    if (out.length) out[out.length - 1].end = at
    for (const w of (lead + ' ' + chunk).trim().split(/\s+/).filter(Boolean)) out.push({ text: w, start: at, end: at })
    lead = ''
  }
  if (lead) out.unshift({ text: lead, start: lineStart, end: out[0]?.start ?? lineEnd })
  // Words that shared a tag split its time; the final word ends at the next tag or line end.
  const last = out[out.length - 1]
  if (last && last.end <= last.start) last.end = Math.min(lineEnd, last.start + 1)
  for (let i = 0; i < out.length; i++) if (out[i].end <= out[i].start) out[i].end = out[i + 1]?.start ?? out[i].start + 0.3
  return out.filter((w) => w.text)
}

/** Index of the line being sung at time t, or -1 before the first line. */
export function activeLineIndex(lines: Line[], t: number): number {
  let lo = 0
  let hi = lines.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].start <= t) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

export const wordProgress = (w: Word, t: number) => (t <= w.start ? 0 : t >= w.end ? 1 : (t - w.start) / (w.end - w.start))

export function plainToLines(plain: string): string[] {
  return plain.split(/\r?\n/).map((l) => l.trim())
}
