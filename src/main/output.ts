import { execFile } from 'node:child_process'

/*
 * Which speakers or headphones is the Mac playing through? Bluetooth adds a fixed delay between
 * Spotify's clock and what you hear (AirPods are around 0.2s), which makes lyrics look early.
 */

export interface Output {
  name: string | null
  latencyMs: number
}

let current: Output = { name: null, latencyMs: 0 }
export const currentOutput = () => current

interface AudioItem {
  _name?: string
  coreaudio_default_audio_output_device?: string
  coreaudio_device_transport?: string
}

export function detectOutput(): Promise<Output> {
  if (process.platform !== 'darwin') return Promise.resolve(current)
  return new Promise((resolve) => {
    execFile('system_profiler', ['SPAudioDataType', '-json'], { timeout: 8000 }, (err, stdout) => {
      if (err) return resolve(current)
      try {
        const data = JSON.parse(String(stdout)) as { SPAudioDataType?: { _items?: AudioItem[] }[] }
        const items = (data.SPAudioDataType ?? []).flatMap((d) => d._items ?? [])
        const out = items.find((i) => i.coreaudio_default_audio_output_device === 'spaudio_yes')
        const transport = out?.coreaudio_device_transport ?? ''
        const latencyMs = /bluetooth/i.test(transport) ? 200 : 0
        current = { name: out?._name ?? null, latencyMs }
      } catch {
        // Keep the last known value.
      }
      resolve(current)
    })
  })
}
