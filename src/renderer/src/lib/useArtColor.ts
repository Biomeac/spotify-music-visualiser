import { useEffect, useState } from 'react'

/** Picks a vivid accent colour from the album art (falls back to a soft white). */
export function useArtColor(url: string | null | undefined): string {
  const [color, setColor] = useState('rgb(255,255,255)')
  useEffect(() => {
    if (!url) return
    let alive = true
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 24
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, 24, 24)
        const d = ctx.getImageData(0, 0, 24, 24).data
        let best = { score: -1, r: 255, g: 255, b: 255 }
        for (let i = 0; i < d.length; i += 4) {
          const [r, g, b] = [d[i], d[i + 1], d[i + 2]]
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          const sat = max ? (max - min) / max : 0
          const score = sat * 0.7 + (max / 255) * 0.3 - (max < 60 ? 1 : 0)
          if (score > best.score) best = { score, r, g, b }
        }
        // Lift dark colours so the glow stays readable on black.
        const lift = (v: number) => Math.round(v + (255 - v) * 0.35)
        if (alive) setColor(`rgb(${lift(best.r)},${lift(best.g)},${lift(best.b)})`)
      } catch {
        if (alive) setColor('rgb(255,255,255)')
      }
    }
    img.src = url
    return () => {
      alive = false
    }
  }, [url])
  return color
}
