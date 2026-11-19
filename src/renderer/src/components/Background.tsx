import { useEffect, useRef, type CSSProperties } from 'react'
import type { BackgroundSettings } from '../../../shared'

interface Props {
  bg: BackgroundSettings
  colors: [string, string, string]
  artUrl: string | null
  /** Changes every time a new lyric line starts. */
  beat: number
  playing: boolean
}

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Shared animation loop for the canvas backgrounds. Reads live values from refs so it never restarts. */
function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, time: number) => void,
  deps: { speed: number; playing: boolean }
) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw
  const live = useRef(deps)
  live.current = deps
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let last = performance.now()
    let time = 0
    const frame = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const dt = Math.min(0.05, (now - last) / 1000) * live.current.speed * (live.current.playing ? 1 : 0.35)
      last = now
      time += dt
      drawRef.current(ctx, w, h, dt, time)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])
  return ref
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  c: number
  tw: number
}

function Particles({ colors, beat, speed, playing, reactive }: { colors: string[]; beat: number; speed: number; playing: boolean; reactive: boolean }) {
  const parts = useRef<Particle[]>([])
  const kick = useRef(0)
  useEffect(() => {
    if (reactive) kick.current = 1
  }, [beat, reactive])
  const ref = useCanvas(
    (ctx, w, h, dt, time) => {
      if (parts.current.length === 0)
        parts.current = Array.from({ length: Math.round((w * h) / 9000) + 40 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20 - 6,
          r: Math.random() * 2.2 + 0.6,
          c: Math.floor(Math.random() * 3),
          tw: Math.random() * Math.PI * 2
        }))
      const k = kick.current
      kick.current *= Math.pow(0.04, dt || 0.016)
      ctx.clearRect(0, 0, w, h)
      // Soft colour wash behind the particles.
      colors.forEach((c, i) => {
        const x = w * (0.2 + 0.6 * ((Math.sin(time * 0.13 + i * 2.1) + 1) / 2))
        const y = h * (0.25 + 0.5 * ((Math.cos(time * 0.11 + i * 1.7) + 1) / 2))
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.55)
        g.addColorStop(0, c + '55')
        g.addColorStop(1, c + '00')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      })
      ctx.globalCompositeOperation = 'lighter'
      const cx = w / 2
      const cy = h / 2
      const ps = parts.current
      for (const p of ps) {
        if (k > 0.02) {
          const dx = p.x - cx
          const dy = p.y - cy
          const d = Math.hypot(dx, dy) || 1
          p.vx += (dx / d) * k * 90 * dt * 60 * 0.016
          p.vy += (dy / d) * k * 90 * dt * 60 * 0.016
        }
        p.vx *= 1 - 0.6 * dt
        p.vy *= 1 - 0.6 * dt
        p.vx += (Math.random() - 0.5) * 8 * dt
        p.vy += (Math.random() - 0.5) * 8 * dt - 2 * dt
        p.x += p.vx * dt * 3
        p.y += p.vy * dt * 3
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10
        p.tw += dt * 3
        const a = 0.35 + 0.35 * Math.sin(p.tw) + k * 0.3
        const [r, g, b] = hexToRgb(colors[p.c])
        const rad = p.r * (1 + k * 0.8) * 4
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad)
        grad.addColorStop(0, `rgba(255,255,255,${a})`)
        grad.addColorStop(0.25, `rgba(${r},${g},${b},${a * 0.8})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2)
        ctx.fill()
      }
      // Constellation lines between near neighbours.
      ctx.lineWidth = 0.6
      for (let i = 0; i < ps.length; i += 2)
        for (let j = i + 1; j < ps.length; j += 3) {
          const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y)
          if (d < 110) {
            ctx.strokeStyle = `rgba(255,255,255,${(1 - d / 110) * 0.12})`
            ctx.beginPath()
            ctx.moveTo(ps[i].x, ps[i].y)
            ctx.lineTo(ps[j].x, ps[j].y)
            ctx.stroke()
          }
        }
      ctx.globalCompositeOperation = 'source-over'
    },
    { speed, playing }
  )
  return <canvas ref={ref} className="bg-canvas" />
}

function Waves({ colors, beat, speed, playing, reactive }: { colors: string[]; beat: number; speed: number; playing: boolean; reactive: boolean }) {
  const kick = useRef(0)
  useEffect(() => {
    if (reactive) kick.current = 1
  }, [beat, reactive])
  const ref = useCanvas(
    (ctx, w, h, dt, time) => {
      const k = kick.current
      kick.current *= Math.pow(0.08, dt || 0.016)
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      const layers = 9
      for (let i = 0; i < layers; i++) {
        const c = colors[i % 3]
        const [r, g, b] = hexToRgb(c)
        const base = h * (0.35 + (i / layers) * 0.45)
        const amp = h * (0.06 + 0.05 * Math.sin(time * 0.3 + i)) * (1 + k * 0.9)
        const freq = 1.2 + (i % 4) * 0.35
        const phase = time * (0.5 + i * 0.07) + i * 1.3
        const grad = ctx.createLinearGradient(0, base - amp, 0, h)
        grad.addColorStop(0, `rgba(${r},${g},${b},${0.22 + k * 0.1})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(0, h)
        for (let x = 0; x <= w + 8; x += 8) {
          const nx = x / w
          const y =
            base +
            Math.sin(nx * Math.PI * 2 * freq + phase) * amp +
            Math.sin(nx * Math.PI * 5.3 - phase * 1.6) * amp * 0.25
          ctx.lineTo(x, y)
        }
        ctx.lineTo(w, h)
        ctx.closePath()
        ctx.fill()
        // Bright edge on each ribbon.
        ctx.strokeStyle = `rgba(${Math.min(255, r + 80)},${Math.min(255, g + 80)},${Math.min(255, b + 80)},${0.18 + k * 0.25})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        for (let x = 0; x <= w + 8; x += 8) {
          const nx = x / w
          const y = base + Math.sin(nx * Math.PI * 2 * freq + phase) * amp + Math.sin(nx * Math.PI * 5.3 - phase * 1.6) * amp * 0.25
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'source-over'
    },
    { speed, playing }
  )
  return <canvas ref={ref} className="bg-canvas" />
}

export default function Background({ bg, colors, artUrl, beat, playing }: Props) {
  const pal = bg.colorSource === 'custom' ? bg.colors : colors
  const style = {
    '--c1': pal[0],
    '--c2': pal[1],
    '--c3': pal[2],
    '--speed': bg.speed,
    '--blur': `${bg.blur}px`,
    '--bright': bg.brightness,
    '--state': playing ? 'running' : 'paused'
  } as CSSProperties

  return (
    <div className={`background bg-${bg.kind}`} style={style}>
      {bg.kind === 'album' && artUrl && (
        <div className="bg-album" key={artUrl}>
          <img src={artUrl} alt="" />
        </div>
      )}
      {bg.kind === 'aurora' && (
        <div className="aurora">
          <div className={`aurora-pulse ${bg.reactive ? '' : 'still'}`} key={bg.reactive ? beat : 0}>
            <i className="b1" />
            <i className="b2" />
            <i className="b3" />
            <i className="b4" />
          </div>
        </div>
      )}
      {bg.kind === 'particles' && <Particles colors={pal} beat={beat} speed={bg.speed} playing={playing} reactive={bg.reactive} />}
      {bg.kind === 'waves' && <Waves colors={pal} beat={beat} speed={bg.speed} playing={playing} reactive={bg.reactive} />}
      {bg.kind === 'solid' && <div className="bg-solid" />}
      {bg.grain && <div className="grain" style={{ backgroundImage: GRAIN }} />}
      <div className="vignette" />
    </div>
  )
}
