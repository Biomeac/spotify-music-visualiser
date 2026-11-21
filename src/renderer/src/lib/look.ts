import type { CSSProperties } from 'react'
import type { FontChoice, Settings } from '../../../shared'

const FONTS: Record<Exclude<FontChoice, 'style'>, string> = {
  sf: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
  rounded: "ui-rounded, 'SF Pro Rounded', -apple-system, sans-serif",
  serif: "'New York', ui-serif, Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
  condensed: "'Avenir Next Condensed', 'DIN Condensed', 'Arial Narrow', sans-serif",
  hand: "'Bradley Hand', 'Marker Felt', 'Chalkboard SE', cursive"
}

/** Turns text settings into CSS variables and classes on the app root. */
export function lookFor(settings: Settings, accent: string): { style: CSSProperties; className: string } {
  const t = settings.text
  const active = t.activeColor === 'accent' ? accent : t.activeColor === 'custom' ? t.customColor : '#ffffff'
  const style = {
    '--accent': accent,
    '--scale': settings.fontScale,
    '--active': active,
    '--dim': t.dimOpacity,
    '--glow': t.glow,
    '--weight': t.weight,
    '--align': t.align,
    '--anim': 1 / t.animSpeed,
    '--lyric-font': t.font === 'style' ? undefined : FONTS[t.font]
  } as CSSProperties
  const className = [
    t.font !== 'style' && 'custom-font',
    t.uppercase && 'upper',
    !t.blurOthers && 'no-blur',
    !t.showNext && 'hide-next',
    `align-${t.align}`
  ]
    .filter(Boolean)
    .join(' ')
  return { style, className }
}
