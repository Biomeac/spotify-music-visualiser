import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_BACKGROUND, DEFAULT_MESSAGES, DEFAULT_TEXT, DEFAULT_UI, type Settings } from '../shared'

const defaults: Settings = {
  clientId: '',
  style: 'glow',
  offsetMs: 0,
  fontScale: 1,
  overlayVisible: false,
  overlayLocked: false,
  background: DEFAULT_BACKGROUND,
  text: DEFAULT_TEXT,
  ui: DEFAULT_UI,
  messages: DEFAULT_MESSAGES,
  trackOffsets: {},
  autoLatency: true
}

export interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

const dir = () => app.getPath('userData')
const settingsPath = () => join(dir(), 'settings.json')
const tokensPath = () => join(dir(), 'tokens.bin')

let cache: Settings | null = null

export function getSettings(): Settings {
  if (cache) return cache
  try {
    const saved = JSON.parse(readFileSync(settingsPath(), 'utf8'))
    cache = { ...defaults, ...saved, background: { ...DEFAULT_BACKGROUND, ...saved.background }, text: { ...DEFAULT_TEXT, ...saved.text }, ui: { ...DEFAULT_UI, ...saved.ui }, messages: { ...DEFAULT_MESSAGES, ...saved.messages } }
  } catch {
    cache = { ...defaults }
  }
  return cache!
}

export function updateSettings(patch: Partial<Settings>): Settings {
  cache = { ...getSettings(), ...patch }
  mkdirSync(dir(), { recursive: true })
  writeFileSync(settingsPath(), JSON.stringify(cache, null, 2))
  return cache
}

// Tokens are encrypted with the macOS Keychain-backed safeStorage when available.
export function loadTokens(): Tokens | null {
  if (!existsSync(tokensPath())) return null
  try {
    const raw = readFileSync(tokensPath())
    const json = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function saveTokens(tokens: Tokens | null): void {
  mkdirSync(dir(), { recursive: true })
  if (!tokens) {
    writeFileSync(tokensPath(), '')
    return
  }
  const json = JSON.stringify(tokens)
  writeFileSync(tokensPath(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : json)
}
