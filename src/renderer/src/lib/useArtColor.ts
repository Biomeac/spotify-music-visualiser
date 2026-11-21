import { useEffect, useState } from 'react'

export interface ArtPalette {
  /** Bright accent for glows. */
  accent: string
  /** Three distinct colours for backgrounds. */
  colors: [string, string, string]
}

const FALLBACK: ArtPalette = { accent: 'rgb(255,255,255)', colors: ['#5b3cff', '#ff3d8b', '#13b5ff'] }

const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

function rgbToHsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max / 255 }
}

/** Extracts a palette from album art: groups pixels into hue buckets and keeps the most vivid, most common ones. */
export function extractPalette(data: Uint8ClampedArray): ArtPalette {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number; score: number }>()
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const { h, s, v } = rgbToHsv(r, g, b)
    if (v < 0.18) continue
    const key = s < 0.15 ? -1 : Math.floor(h / 30)
    const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, score: 0 }
    bk.n++
    bk.r += r
    bk.g += g
    bk.b += b
    bk.score += 0.4 + s * 1.2 + v * 0.4
    buckets.set(key, bk)
  }
  const ranked = [...buckets.entries()].sort((a, b) => b[1].score - a[1].score).map(([key, bk]) => ({
    key,
    rgb: [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n] as [number, number, number]
  }))
  if (!ranked.length) return FALLBACK
  const vivid = ranked.filter((c) => c.key !== -1)
  const pick = (vivid.length ? vivid : ranked).slice(0, 3)
  while (pick.length < 3) {
    // Not enough distinct hues: derive lighter/darker variants of the main colour.
    const [r, g, b] = pick[0].rgb
    const f = pick.length === 1 ? 0.55 : 1.35
    pick.push({ key: -2, rgb: [Math.min(255, r * f), Math.min(255, g * f), Math.min(255, b * f)] })
  }
  const lift = (v: number) => v + (255 - v) * 0.35
  const [ar, ag, ab] = pick[0].rgb
  return {
    accent: `rgb(${Math.round(lift(ar))},${Math.round(lift(ag))},${Math.round(lift(ab))})`,
    colors: pick.map((c) => toHex(...c.rgb)) as [string, string, string]
  }
}

export function useArtPalette(url: string | null | undefined): ArtPalette {
  const [palette, setPalette] = useState<ArtPalette>(FALLBACK)
  useEffect(() => {
    if (!url) return
    let alive = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 32
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, 32, 32)
        if (alive) setPalette(extractPalette(ctx.getImageData(0, 0, 32, 32).data))
      } catch {
        if (alive) setPalette(FALLBACK)
      }
    }
    img.src = url
    return () => {
      alive = false
    }
  }, [url])
  return palette
}

export const useArtColor = (url: string | null | undefined) => useArtPalette(url).accent
