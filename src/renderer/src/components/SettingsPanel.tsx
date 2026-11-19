import type { AuthStatus, BackgroundKind, BackgroundSettings, LyricStyle, Settings } from '../../../shared'

const STYLES: { id: LyricStyle; name: string; desc: string }[] = [
  { id: 'glow', name: 'Glow', desc: 'Words light up as they are sung' },
  { id: 'karaoke', name: 'Sweep', desc: 'Colour fills each word left to right' },
  { id: 'focus', name: 'Focus', desc: 'One big line at a time' },
  { id: 'messages', name: 'Messages', desc: 'A realistic text conversation' },
  { id: 'kinetic', name: 'Kinetic', desc: 'Words fly in from everywhere' },
  { id: 'neon', name: 'Neon', desc: 'Glass tubes flicker on' },
  { id: 'typewriter', name: 'Typewriter', desc: 'Typed out as it is sung' },
  { id: 'bounce', name: 'Bounce', desc: 'A ball hops word to word' }
]

const BACKGROUNDS: { id: BackgroundKind; name: string }[] = [
  { id: 'aurora', name: 'Aurora' },
  { id: 'particles', name: 'Particles' },
  { id: 'waves', name: 'Waves' },
  { id: 'album', name: 'Album art' },
  { id: 'solid', name: 'Solid' }
]

const PRESETS: { name: string; colors: [string, string, string] }[] = [
  { name: 'Sunset', colors: ['#ff5e3a', '#ff2a68', '#ffb03a'] },
  { name: 'Ocean', colors: ['#0061ff', '#00d4ff', '#2e1cff'] },
  { name: 'Acid', colors: ['#b6ff00', '#00ff9d', '#00b3ff'] },
  { name: 'Rose', colors: ['#ff8fb1', '#b388ff', '#ffd1dc'] },
  { name: 'Mono', colors: ['#ffffff', '#8a8a8a', '#3a3a3a'] }
]

export default function SettingsPanel({ settings, auth, onClose }: { settings: Settings; auth: AuthStatus; onClose: () => void }) {
  const set = (patch: Partial<Settings>) => window.api.setSettings(patch)
  const bg = settings.background
  const setBg = (patch: Partial<BackgroundSettings>) => set({ background: { ...bg, ...patch } })
  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <div className="panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="eyebrow">Style</div>
        <div className="styles">
          {STYLES.map((s) => (
            <button key={s.id} className={`style-card ${settings.style === s.id ? 'on' : ''}`} onClick={() => set({ style: s.id })}>
              <div className={`preview pv-${s.id}`}>
                <span className="a">Sing</span> <span className="b">it</span> <span className="c">back</span>
              </div>
              <b>{s.name}</b>
              <small>{s.desc}</small>
            </button>
          ))}
        </div>

        <div className="eyebrow">Background</div>
        <div className="bg-kinds">
          {BACKGROUNDS.map((b) => (
            <button key={b.id} className={`bg-kind ${bg.kind === b.id ? 'on' : ''}`} onClick={() => setBg({ kind: b.id })}>
              <span className={`bg-swatch sw-${b.id}`} />
              {b.name}
            </button>
          ))}
        </div>

        <div className="seg">
          <button className={bg.colorSource === 'album' ? 'on' : ''} onClick={() => setBg({ colorSource: 'album' })}>
            Colours from album
          </button>
          <button className={bg.colorSource === 'custom' ? 'on' : ''} onClick={() => setBg({ colorSource: 'custom' })}>
            My colours
          </button>
        </div>
        {bg.colorSource === 'custom' && (
          <>
            <div className="pickers">
              {bg.colors.map((c, i) => (
                <input
                  key={i}
                  type="color"
                  value={c}
                  onChange={(e) => {
                    const colors = [...bg.colors] as [string, string, string]
                    colors[i] = e.target.value
                    setBg({ colors })
                  }}
                />
              ))}
            </div>
            <div className="presets">
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => setBg({ colors: p.colors })} title={p.name}>
                  <span style={{ background: `linear-gradient(135deg, ${p.colors.join(', ')})` }} />
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="slider-row">
          <span>Speed</span>
          <input type="range" min={0.2} max={3} step={0.1} value={bg.speed} onChange={(e) => setBg({ speed: Number(e.target.value) })} />
        </div>
        <div className="slider-row">
          <span>Brightness</span>
          <input type="range" min={0.2} max={1.3} step={0.05} value={bg.brightness} onChange={(e) => setBg({ brightness: Number(e.target.value) })} />
        </div>
        {(bg.kind === 'aurora' || bg.kind === 'album') && (
          <div className="slider-row">
            <span>Blur</span>
            <input type="range" min={0} max={160} step={5} value={bg.blur} onChange={(e) => setBg({ blur: Number(e.target.value) })} />
          </div>
        )}
        <label className="toggle">
          <input type="checkbox" checked={bg.reactive} onChange={(e) => setBg({ reactive: e.target.checked })} />
          Pulse with each new lyric line
        </label>
        <label className="toggle">
          <input type="checkbox" checked={bg.grain} onChange={(e) => setBg({ grain: e.target.checked })} />
          Film grain
        </label>

        <div className="eyebrow">Text size</div>
        <input type="range" min={0.6} max={1.6} step={0.05} value={settings.fontScale} onChange={(e) => set({ fontScale: Number(e.target.value) })} />

        <div className="eyebrow">
          Timing offset <span className="val">{settings.offsetMs > 0 ? '+' : ''}{(settings.offsetMs / 1000).toFixed(1)}s</span>
        </div>
        <input type="range" min={-3000} max={3000} step={100} value={settings.offsetMs} onChange={(e) => set({ offsetMs: Number(e.target.value) })} />
        <small className="hint">Move right if lyrics appear late, left if early.</small>

        <div className="eyebrow">Overlay</div>
        <label className="toggle">
          <input type="checkbox" checked={settings.overlayVisible} onChange={(e) => set({ overlayVisible: e.target.checked })} />
          Floating lyrics on top of every app
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.overlayLocked} onChange={(e) => set({ overlayLocked: e.target.checked })} />
          Lock overlay (clicks pass through; unlock from the ♪ menu bar icon)
        </label>

        <div className="eyebrow">Account</div>
        <div className="account">
          <span>{auth.userName ? `Signed in as ${auth.userName}` : 'Signed in'}</span>
          <button className="ghost" onClick={() => window.api.logout()}>
            Sign out
          </button>
        </div>
        <small className="hint">Lyrics from LRCLIB · Music from Spotify</small>
      </div>
    </div>
  )
}
