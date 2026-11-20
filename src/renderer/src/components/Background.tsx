import { useEffect, useRef, type CSSProperties } from 'react'
import type { BackgroundSettings } from '../../../shared'
import { DITHER, FLUID, LAVA, SYNTH } from '../lib/shaders'

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


const VERT = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'

/** Full-screen fragment shader with the palette and a lyric-line pulse. Renders at reduced resolution for speed. */
function ShaderBG({ frag, colors, beat, speed, playing, reactive, scale = 0.5 }: { frag: string; colors: string[]; beat: number; speed: number; playing: boolean; reactive: boolean; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef({ colors, speed, playing })
  live.current = { colors, speed, playing }
  const kick = useRef(0)
  useEffect(() => {
    if (reactive) kick.current = 1
  }, [beat, reactive])
  useEffect(() => {
    const canvas = ref.current!
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!gl) return
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh))
      return sh
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag))
    gl.linkProgram(prog)
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const u = (n: string) => gl.getUniformLocation(prog, n)
    const [uTime, uRes, uC1, uC2, uC3, uPulse] = ['u_time', 'u_res', 'u_c1', 'u_c2', 'u_c3', 'u_pulse'].map(u)
    // Colours ease towards the new palette when the song changes.
    const cur = live.current.colors.map(hexToRgb).map((c) => c.map((v) => v / 255))
    let raf = 0
    let last = performance.now()
    let time = Math.random() * 100
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const L = live.current
      time += dt * L.speed * (L.playing ? 1 : 0.3)
      const w = Math.max(1, Math.round(canvas.clientWidth * scale))
      const h = Math.max(1, Math.round(canvas.clientHeight * scale))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      L.colors.forEach((hex, i) => {
        const target = hexToRgb(hex).map((v) => v / 255)
        cur[i] = cur[i].map((v, j) => v + (target[j] - v) * Math.min(1, dt * 2))
      })
      kick.current *= Math.pow(0.05, dt)
      gl.uniform1f(uTime, time)
      gl.uniform2f(uRes, w, h)
      gl.uniform3fv(uC1, cur[0])
      gl.uniform3fv(uC2, cur[1])
      gl.uniform3fv(uC3, cur[2])
      gl.uniform1f(uPulse, kick.current)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [frag, scale])
  return <canvas ref={ref} className="bg-canvas shader" />
}

/** Hyperspace: stars streak outward; each lyric line gives a burst of speed. */
function Warp({ colors, beat, speed, playing, reactive }: { colors: string[]; beat: number; speed: number; playing: boolean; reactive: boolean }) {
  const stars = useRef<{ x: number; y: number; z: number; pz: number; c: number }[]>([])
  const kick = useRef(0)
  useEffect(() => {
    if (reactive) kick.current = 1
  }, [beat, reactive])
  const ref = useCanvas(
    (ctx, w, h, dt) => {
      if (!stars.current.length)
        stars.current = Array.from({ length: 500 }, () => {
          const z = Math.random() * w
          return { x: (Math.random() - 0.5) * w, y: (Math.random() - 0.5) * h, z, pz: z, c: Math.floor(Math.random() * 3) }
        })
      const k = kick.current
      kick.current *= Math.pow(0.06, dt || 0.016)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(0, 0, w, h)
      const v = (120 + k * 900) * (dt || 0.016) * 4
      const cx = w / 2
      const cy = h / 2
      ctx.lineCap = 'round'
      for (const s of stars.current) {
        s.pz = s.z
        s.z -= v
        if (s.z < 1) {
          s.x = (Math.random() - 0.5) * w
          s.y = (Math.random() - 0.5) * h
          s.z = s.pz = w
        }
        const sx = cx + (s.x / s.z) * w * 0.5
        const sy = cy + (s.y / s.z) * h * 0.5
        const px = cx + (s.x / s.pz) * w * 0.5
        const py = cy + (s.y / s.pz) * h * 0.5
        const a = Math.min(1, (1 - s.z / w) * 1.4)
        const [r, g, b] = hexToRgb(colors[s.c])
        ctx.strokeStyle = `rgba(${(r + 255) / 2},${(g + 255) / 2},${(b + 255) / 2},${a})`
        ctx.lineWidth = Math.max(0.5, (1 - s.z / w) * 3)
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(sx, sy)
        ctx.stroke()
      }
    },
    { speed, playing }
  )
  return <canvas ref={ref} className="bg-canvas" />
}

/** Out-of-focus city lights: soft discs with bright rims drifting at different depths. */
function Bokeh({ colors, beat, speed, playing, reactive }: { colors: string[]; beat: number; speed: number; playing: boolean; reactive: boolean }) {
  const discs = useRef<{ x: number; y: number; r: number; vx: number; vy: number; c: number; ph: number; depth: number }[]>([])
  const kick = useRef(0)
  useEffect(() => {
    if (reactive) kick.current = 1
  }, [beat, reactive])
  const ref = useCanvas(
    (ctx, w, h, dt, time) => {
      if (!discs.current.length)
        discs.current = Array.from({ length: 46 }, () => {
          const depth = Math.random()
          return {
            x: Math.random() * w,
            y: Math.random() * h,
            r: 18 + depth * 120,
            vx: (Math.random() - 0.5) * (10 + depth * 25),
            vy: -4 - Math.random() * 10 * (1 + depth),
            c: Math.floor(Math.random() * 3),
            ph: Math.random() * 6.28,
            depth
          }
        })
      const k = kick.current
      kick.current *= Math.pow(0.05, dt || 0.016)
      const g0 = ctx.createLinearGradient(0, 0, 0, h)
      g0.addColorStop(0, '#020205')
      g0.addColorStop(1, colors[2] + '33')
      ctx.fillStyle = g0
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      const sorted = [...discs.current].sort((a, b) => a.depth - b.depth)
      for (const d of sorted) {
        d.x += d.vx * dt
        d.y += d.vy * dt
        if (d.y < -d.r) d.y = h + d.r
        if (d.x < -d.r) d.x = w + d.r
        if (d.x > w + d.r) d.x = -d.r
        const [r, g, b] = hexToRgb(colors[d.c])
        const a = (0.1 + 0.12 * Math.sin(time * 0.8 + d.ph) + 0.14 * (1 - d.depth) + k * 0.12) * 0.9
        const grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r)
        grad.addColorStop(0, `rgba(${r},${g},${b},${a * 0.6})`)
        grad.addColorStop(0.82, `rgba(${r},${g},${b},${a * 0.8})`)
        grad.addColorStop(0.92, `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)},${a * 1.4})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r * (1 + k * 0.06), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    },
    { speed, playing }
  )
  return <canvas ref={ref} className="bg-canvas bokeh" />
}

/** Halftone print: the album art rebuilt from dots, slowly panning like a magazine close-up. */
function Halftone({ colors, artUrl, beat, speed, playing, reactive }: { colors: string[]; artUrl: string | null; beat: number; speed: number; playing: boolean; reactive: boolean }) {
  const pixels = useRef<{ data: Uint8ClampedArray; n: number } | null>(null)
  const kick = useRef(0)
  useEffect(() => {
    if (reactive) kick.current = 1
  }, [beat, reactive])
  useEffect(() => {
    pixels.current = null
    if (!artUrl) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 96
        const x = c.getContext('2d')!
        x.drawImage(img, 0, 0, 96, 96)
        pixels.current = { data: x.getImageData(0, 0, 96, 96).data, n: 96 }
      } catch {
        pixels.current = null
      }
    }
    img.src = artUrl
  }, [artUrl])
  const ref = useCanvas(
    (ctx, w, h, dt, time) => {
      const k = kick.current
      kick.current *= Math.pow(0.05, dt || 0.016)
      ctx.fillStyle = '#060606'
      ctx.fillRect(0, 0, w, h)
      const step = 13
      const zoom = 1.25 + 0.15 * Math.sin(time * 0.05)
      const panX = 0.5 + 0.12 * Math.sin(time * 0.037)
      const panY = 0.5 + 0.12 * Math.cos(time * 0.029)
      const px = pixels.current
      const size = Math.max(w, h) * zoom
      for (let y = step / 2; y < h; y += step)
        for (let x = step / 2 + ((y / step) % 2 ? step / 2 : 0); x < w; x += step) {
          let r: number, g: number, b: number
          if (px) {
            const u = Math.min(px.n - 1, Math.max(0, Math.floor(((x - w / 2) / size + panX) * px.n)))
            const v = Math.min(px.n - 1, Math.max(0, Math.floor(((y - h / 2) / size + panY) * px.n)))
            const i = (v * px.n + u) * 4
            ;[r, g, b] = [px.data[i], px.data[i + 1], px.data[i + 2]]
          } else {
            const f = 0.5 + 0.5 * Math.sin(x * 0.01 + time * 0.4) * Math.cos(y * 0.013 - time * 0.3)
            ;[r, g, b] = hexToRgb(colors[f > 0.66 ? 0 : f > 0.33 ? 1 : 2]).map((c) => c * f)
          }
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
          const rad = (step / 2) * Math.min(1.05, lum * 1.1 + k * 0.15)
          if (rad < 0.4) continue
          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.beginPath()
          ctx.arc(x, y, rad, 0, Math.PI * 2)
          ctx.fill()
        }
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

  const common = { colors: pal, beat, speed: bg.speed, playing, reactive: bg.reactive }
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
      {bg.kind === 'fluid' && <ShaderBG frag={FLUID} {...common} scale={0.35} />}
      {bg.kind === 'dither' && <ShaderBG frag={DITHER} {...common} scale={1} />}
      {bg.kind === 'lava' && <ShaderBG frag={LAVA} {...common} scale={0.5} />}
      {bg.kind === 'synthwave' && <ShaderBG frag={SYNTH} {...common} scale={0.6} />}
      {bg.kind === 'warp' && <Warp {...common} />}
      {bg.kind === 'bokeh' && <Bokeh {...common} />}
      {bg.kind === 'halftone' && <Halftone {...common} artUrl={artUrl} />}
      {bg.grain && <div className="grain" style={{ backgroundImage: GRAIN }} />}
      <div className="vignette" />
    </div>
  )
}
