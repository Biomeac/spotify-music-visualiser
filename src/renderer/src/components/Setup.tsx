import { useState } from 'react'
import { REDIRECT_URI, type AuthStatus, type Settings } from '../../../shared'

export default function Setup({ settings, auth, onClose }: { settings: Settings; auth: AuthStatus; onClose?: () => void }) {
  const [clientId, setClientId] = useState(settings.clientId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const connect = async () => {
    setError(null)
    setBusy(true)
    try {
      await window.api.setSettings({ clientId: clientId.trim() })
      await window.api.login()
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="setup">
      <div className="eyebrow">Setup</div>
      <h1>Connect Spotify</h1>
      <p className="lede">
        {onClose
          ? 'Lyrics already follow the Spotify app. Connect once to search from here and to follow your phone or speakers. It takes about two minutes and stays private to this Mac.'
          : 'One-time setup. It takes about two minutes and keeps your account private to this Mac.'}
      </p>
      <ol className="steps">
        <li>
          <span className="num">1</span>
          <div>
            Open the{' '}
            <a onClick={() => window.api.openExternal('https://developer.spotify.com/dashboard')}>Spotify developer dashboard</a>{' '}
            and click <b>Create app</b>. Any name and description work.
          </div>
        </li>
        <li>
          <span className="num">2</span>
          <div>
            Add this <b>Redirect URI</b> and tick <b>Web API</b>:
            <button
              className="copy"
              onClick={() => {
                navigator.clipboard.writeText(REDIRECT_URI)
                setCopied(true)
              }}
            >
              <code>{REDIRECT_URI}</code>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </li>
        <li>
          <span className="num">3</span>
          <div>
            Copy the app's <b>Client ID</b> and paste it here.
            <input
              className="field"
              placeholder="Client ID"
              value={clientId}
              spellCheck={false}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
        </li>
      </ol>
      <button className="primary" disabled={!/^[a-z0-9]{32}$/i.test(clientId.trim()) || busy} onClick={connect}>
        {busy ? 'Waiting for Spotify…' : auth.hasClientId ? 'Connect Spotify' : 'Save & connect Spotify'}
      </button>
      {onClose && (
        <button className="ghost later" onClick={onClose}>
          Not now
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
