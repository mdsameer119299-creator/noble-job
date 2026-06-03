// Simple in-memory TTL cache for server-side use
const store = new Map<string, { data: unknown; expiresAt: number }>()

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry || Date.now() > entry.expiresAt) { store.delete(key); return null }
  return entry.data as T
}

export function cacheSet(key: string, data: unknown, ttlMs = 3_600_000) {
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export function cacheDel(key: string) { store.delete(key) }
