'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Reliable client data fetch for dashboard panels.
 *
 * Guarantees that a panel never spins forever:
 *  - hard timeout (default 10s) → surfaces an error state, never an endless spinner
 *  - non-2xx responses → error state
 *  - aborts in-flight requests on unmount / reload to avoid setState-after-unmount
 *
 * By default it returns `json.data` (the shape every Noble Job API uses); pass a
 * `transform` to map a different shape.
 */
export function useAsyncData<T = unknown>(
  url: string | null,
  opts: { timeoutMs?: number; transform?: (json: unknown) => T } = {}
): AsyncState<T> {
  const { timeoutMs = 10_000 } = opts
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const transformRef = useRef(opts.transform)
  transformRef.current = opts.transform

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!url) {
      setLoading(false)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    setLoading(true)
    setError(null)

    fetch(url, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json) => {
        if (cancelled) return
        const t = transformRef.current
        const value = t ? t(json) : ((json as { data?: T })?.data ?? (json as T))
        setData(value)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const aborted = e instanceof DOMException && e.name === 'AbortError'
        setError(aborted ? 'This is taking longer than expected. Please try again.' : 'Something went wrong.')
      })
      .finally(() => {
        clearTimeout(timer)
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [url, timeoutMs, tick])

  return { data, loading, error, reload }
}
