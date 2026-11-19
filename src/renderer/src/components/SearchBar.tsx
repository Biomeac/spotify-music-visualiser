import { useEffect, useRef, useState } from 'react'
import type { Track } from '../../../shared'

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

export default function SearchBar({ onError }: { onError: (msg: string) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey && e.key === 'k') || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!q.trim()) {
      setResults([])
      return
    }
    const id = setTimeout(() => {
      window.api
        .search(q)
        .then((r) => {
          setResults(r)
          setSel(0)
        })
        .catch((e) => onError(String(e.message)))
    }, 220)
    return () => clearTimeout(id)
  }, [q, onError])

  const play = (t: Track) => {
    setOpen(false)
    inputRef.current?.blur()
    window.api.play(t.uri).catch((e) => onError(String(e.message).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')))
  }

  return (
    <div className="search">
      <input
        ref={inputRef}
        value={q}
        placeholder="Search any song   ⌘K"
        spellCheck={false}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setSel((s) => Math.min(s + 1, results.length - 1))
          else if (e.key === 'ArrowUp') setSel((s) => Math.max(s - 1, 0))
          else if (e.key === 'Enter' && results[sel]) play(results[sel])
          else if (e.key === 'Escape') inputRef.current?.blur()
        }}
      />
      {open && results.length > 0 && (
        <ul className="results">
          {results.map((t, i) => (
            <li key={t.id} className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)} onMouseDown={() => play(t)}>
              {t.artUrl ? <img src={t.artUrl} alt="" /> : <div className="noart" />}
              <div className="meta">
                <div className="title">{t.name}</div>
                <div className="sub">
                  {t.artists} · {t.album}
                </div>
              </div>
              <span className="dur">{fmt(t.durationMs)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
