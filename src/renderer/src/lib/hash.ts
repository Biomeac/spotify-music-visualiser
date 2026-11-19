/** Small deterministic hash so per-word / per-line "random" effects are stable across frames. */
export function hash(str: string, seed = 0): number {
  let h = 2166136261 ^ seed
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}
