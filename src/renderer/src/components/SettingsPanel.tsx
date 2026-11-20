import { useState, type ReactNode } from 'react'
import {
  DEFAULT_BACKGROUND,
  DEFAULT_TEXT,
  DEFAULT_UI,
  type AuthStatus,
  type BackgroundKind,
  type BackgroundSettings,
  type FontChoice,
  type LyricStyle,
  type Settings,
  type TextSettings,
  type Track,
  type UiSettings
} from '../../../shared'

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

const FONTS: { id: FontChoice; name: string; css: string }[] = [
  { id: 'style', name: 'Style default', css: 'inherit' },
  { id: 'sf', name: 'SF Pro', css: '-apple-system, sans-serif' },
  { id: 'rounded', name: 'Rounded', css: "ui-rounded, 'SF Pro Rounded', sans-serif" },
  { id: 'serif', name: 'Serif', css: "'New York', ui-serif, Georgia, serif" },
  { id: 'mono', name: 'Mono', css: 'ui-monospace, Menlo, monospace' },
  { id: 'condensed', name: 'Condensed', css: "'Avenir Next Condensed', 'Arial Narrow', sans-serif" },
  { id: 'hand', name: 'Handwritten', css: "'Bradley Hand', 'Marker Felt', cursive" }
]

type Tab = 'style' | 'text' | 'background' | 'sync' | 'overlay' | 'more'
const TABS: { id: Tab; name: string }[] = [
  { id: 'style', name: 'Style' },
  { id: 'text', name: 'Text' },
  { id: 'background', name: 'Background' },
  { id: 'sync', name: 'Timing' },
  { id: 'overlay', name: 'Overlay' },
  { id: 'more', name: 'More' }
]

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div className="slider-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <em>{fmt ? fmt(value) : value}</em>
    </div>
  )
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; name: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.name}
        </button>
      ))}
    </div>
  )
}

const secs = (ms: number) => `${ms > 0 ? '+' : ''}${(ms / 1000).toFixed(2)}s`

export default function SettingsPanel({ settings, auth, track, onClose }: { settings: Settings; auth: AuthStatus; track: Track | null; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('style')
  const set = (patch: Partial<Settings>) => window.api.setSettings(patch)
  const bg = settings.background
  const setBg = (patch: Partial<BackgroundSettings>) => set({ background: { ...bg, ...patch } })
  const tx = settings.text
  const setTx = (patch: Partial<TextSettings>) => set({ text: { ...tx, ...patch } })
  const ui = settings.ui
  const setUi = (patch: Partial<UiSettings>) => set({ ui: { ...ui, ...patch } })
  const songOffset = track ? (settings.trackOffsets[track.id] ?? 0) : 0
  const setSongOffset = (ms: number) => track && set({ trackOffsets: { ...settings.trackOffsets, [track.id]: ms } })
  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <div className="panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.name}
            </button>
          ))}
        </div>

        {tab === 'style' && (
          <>
            <div className="eyebrow">Lyric style · keys 1–8</div>
            <div className="styles">
              {STYLES.map((s, i) => (
                <button key={s.id} className={`style-card ${settings.style === s.id ? 'on' : ''}`} onClick={() => set({ style: s.id })}>
                  <div className={`preview pv-${s.id}`}>
                    <span className="a">Sing</span> <span className="b">it</span> <span className="c">back</span>
                  </div>
                  <b>
                    {s.name} <kbd>{i + 1}</kbd>
                  </b>
                  <small>{s.desc}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'text' && (
          <>
            <div className="eyebrow">Font</div>
            <div className="fonts">
              {FONTS.map((f) => (
                <button key={f.id} className={tx.font === f.id ? 'on' : ''} style={{ fontFamily: f.css }} onClick={() => setTx({ font: f.id })}>
                  {f.name}
                </button>
              ))}
            </div>
            <Slider label="Size" value={settings.fontScale} min={0.5} max={1.8} step={0.05} onChange={(v) => set({ fontScale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Weight" value={tx.weight} min={300} max={900} step={100} onChange={(v) => setTx({ weight: v })} />
            <div className="eyebrow">Alignment</div>
            <Seg
              value={tx.align}
              options={[
                { id: 'left', name: 'Left' },
                { id: 'center', name: 'Centre' },
                { id: 'right', name: 'Right' }
              ]}
              onChange={(align) => setTx({ align })}
            />
            <div className="eyebrow">Sung word colour</div>
            <Seg
              value={tx.activeColor}
              options={[
                { id: 'white', name: 'White' },
                { id: 'accent', name: 'From album' },
                { id: 'custom', name: 'Custom' }
              ]}
              onChange={(activeColor) => setTx({ activeColor })}
            />
            {tx.activeColor === 'custom' && (
              <div className="pickers">
                <input type="color" value={tx.customColor} onChange={(e) => setTx({ customColor: e.target.value })} />
              </div>
            )}
            <Slider label="Glow" value={tx.glow} min={0} max={2} step={0.1} onChange={(v) => setTx({ glow: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Other lines" value={tx.dimOpacity} min={0.05} max={0.7} step={0.05} onChange={(v) => setTx({ dimOpacity: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Animation" value={tx.animSpeed} min={0.5} max={2.5} step={0.1} onChange={(v) => setTx({ animSpeed: v })} fmt={(v) => `${v.toFixed(1)}×`} />
            <Toggle checked={tx.uppercase} onChange={(v) => setTx({ uppercase: v })}>
              ALL CAPS
            </Toggle>
            <Toggle checked={tx.blurOthers} onChange={(v) => setTx({ blurOthers: v })}>
              Blur lines further away
            </Toggle>
            <Toggle checked={tx.showNext} onChange={(v) => setTx({ showNext: v })}>
              Preview the next line
            </Toggle>
            <button className="ghost reset" onClick={() => set({ text: DEFAULT_TEXT, fontScale: 1 })}>
              Reset text
            </button>
          </>
        )}

        {tab === 'background' && (
          <>
            <div className="eyebrow">Background</div>
            <div className="bg-kinds">
              {BACKGROUNDS.map((b) => (
                <button key={b.id} className={`bg-kind ${bg.kind === b.id ? 'on' : ''}`} onClick={() => setBg({ kind: b.id })}>
                  <span className={`bg-swatch sw-${b.id}`} />
                  {b.name}
                </button>
              ))}
            </div>
            <Seg
              value={bg.colorSource}
              options={[
                { id: 'album', name: 'Colours from album' },
                { id: 'custom', name: 'My colours' }
              ]}
              onChange={(colorSource) => setBg({ colorSource })}
            />
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
            <Slider label="Speed" value={bg.speed} min={0.2} max={3} step={0.1} onChange={(v) => setBg({ speed: v })} fmt={(v) => `${v.toFixed(1)}×`} />
            <Slider label="Brightness" value={bg.brightness} min={0.2} max={1.3} step={0.05} onChange={(v) => setBg({ brightness: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            {(bg.kind === 'aurora' || bg.kind === 'album') && (
              <Slider label="Blur" value={bg.blur} min={0} max={160} step={5} onChange={(v) => setBg({ blur: v })} fmt={(v) => `${v}px`} />
            )}
            <Toggle checked={bg.reactive} onChange={(v) => setBg({ reactive: v })}>
              Pulse with each new lyric line
            </Toggle>
            <Toggle checked={bg.grain} onChange={(v) => setBg({ grain: v })}>
              Film grain
            </Toggle>
            <button className="ghost reset" onClick={() => set({ background: DEFAULT_BACKGROUND })}>
              Reset background
            </button>
          </>
        )}

        {tab === 'sync' && (
          <>
            <div className="eyebrow">This song</div>
            {track ? (
              <>
                <Slider label="Offset" value={songOffset} min={-3000} max={3000} step={50} onChange={setSongOffset} fmt={secs} />
                <small className="hint">
                  Remembered for “{track.name}”. Shortcut: <kbd>[</kbd> / <kbd>]</kbd> moves 0.1s, hold Shift for 0.5s.
                </small>
              </>
            ) : (
              <small className="hint">Play a song to adjust its timing.</small>
            )}
            <div className="eyebrow">All songs</div>
            <Slider label="Offset" value={settings.offsetMs} min={-3000} max={3000} step={50} onChange={(v) => set({ offsetMs: v })} fmt={secs} />
            <small className="hint">
              Use this for a constant delay, such as Bluetooth headphones or AirPlay speakers. Move right if lyrics appear late.
            </small>
            <div className="eyebrow">Connection</div>
            <small className="hint">
              {auth.local === 'ok'
                ? 'Following the Spotify app on this Mac directly, for the tightest sync.'
                : auth.local === 'denied'
                  ? 'Not allowed to read the Spotify app. Turn it on in System Settings › Privacy & Security › Automation, then reopen this app.'
                  : auth.loggedIn
                    ? 'Following your Spotify account (phone, speakers or this Mac).'
                    : 'Open Spotify on this Mac and press play.'}
            </small>
          </>
        )}

        {tab === 'overlay' && (
          <>
            <div className="eyebrow">Floating lyrics · key O</div>
            <Toggle checked={settings.overlayVisible} onChange={(v) => set({ overlayVisible: v })}>
              Show on top of every app
            </Toggle>
            <Toggle checked={settings.overlayLocked} onChange={(v) => set({ overlayLocked: v })}>
              Lock (clicks pass through; unlock from the ♪ menu bar icon)
            </Toggle>
            <Toggle checked={ui.overlayShowNext} onChange={(v) => setUi({ overlayShowNext: v })}>
              Show the next line
            </Toggle>
            <Slider label="Size" value={ui.overlayScale} min={0.5} max={2} step={0.05} onChange={(v) => setUi({ overlayScale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Backdrop" value={ui.overlayOpacity} min={0} max={0.9} step={0.05} onChange={(v) => setUi({ overlayOpacity: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
            <small className="hint">The overlay uses your text settings and the Glow or Sweep look.</small>
          </>
        )}

        {tab === 'more' && (
          <>
            <Toggle checked={ui.autoHide} onChange={(v) => setUi({ autoHide: v })}>
              Hide controls when the mouse is still
            </Toggle>
            <div className="eyebrow">Shortcuts</div>
            <div className="keys">
              <span><kbd>Space</kbd> Play / pause</span>
              <span><kbd>←</kbd> <kbd>→</kbd> Back / forward 5s</span>
              <span><kbd>N</kbd> <kbd>P</kbd> Next / previous</span>
              <span><kbd>[</kbd> <kbd>]</kbd> Nudge timing</span>
              <span><kbd>1</kbd>–<kbd>8</kbd> Switch style</span>
              <span><kbd>⌘K</kbd> Search</span>
              <span><kbd>O</kbd> Overlay</span>
              <span><kbd>F</kbd> Full screen</span>
              <span><kbd>S</kbd> Customise</span>
            </div>
            <div className="eyebrow">Account</div>
            {auth.loggedIn ? (
              <div className="account">
                <span>{auth.userName ? `Signed in as ${auth.userName}` : 'Signed in'}</span>
                <button className="ghost" onClick={() => window.api.logout()}>
                  Sign out
                </button>
              </div>
            ) : (
              <small className="hint">Not signed in. Lyrics still follow the Spotify app on this Mac.</small>
            )}
            <button className="ghost reset" onClick={() => set({ text: DEFAULT_TEXT, background: DEFAULT_BACKGROUND, ui: DEFAULT_UI, offsetMs: 0, fontScale: 1 })}>
              Reset all customisation
            </button>
            <small className="hint">Lyrics from LRCLIB · Music from Spotify</small>
          </>
        )}
      </div>
    </div>
  )
}
