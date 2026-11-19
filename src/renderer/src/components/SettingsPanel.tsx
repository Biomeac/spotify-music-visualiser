import type { AuthStatus, LyricStyle, Settings } from '../../../shared'

const STYLES: { id: LyricStyle; name: string; desc: string }[] = [
  { id: 'glow', name: 'Glow', desc: 'Words light up as they are sung' },
  { id: 'karaoke', name: 'Sweep', desc: 'Colour fills each word left to right' },
  { id: 'focus', name: 'Focus', desc: 'One big line at a time' },
  { id: 'messages', name: 'Messages', desc: 'Lyrics arrive like a text thread' }
]

export default function SettingsPanel({ settings, auth, onClose }: { settings: Settings; auth: AuthStatus; onClose: () => void }) {
  const set = (patch: Partial<Settings>) => window.api.setSettings(patch)
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
