/**
 * cache-handler.js — filesystem-backed Next.js cache handler for the Hostinger
 * standalone deployment (`output: 'standalone'`, `node server.js`, single
 * process, no PM2/cluster).
 *
 * Why this exists: Next's Data Cache (`unstable_cache`, and `fetch` with
 * `next: { revalidate }`) only has a durable, shared implementation on Vercel.
 * Self-hosted/standalone builds default to an IN-MEMORY cache with no custom
 * handler configured — so it's wiped on every process restart (crash, OOM
 * recycle, redeploy). `src/lib/services/govtStatsSource.ts` wraps the
 * govt_jobs full-table read in a 300s `unstable_cache` specifically to
 * collapse it to one Supabase read per window server-wide; without a
 * persistent handler that guarantee silently doesn't hold, and the read fires
 * on every cold cache instead — the dominant cause of the July 2026 egress
 * overage (see PR-E1 follow-up).
 *
 * This handler persists entries to disk under `.next/cache/custom-handler`
 * (inside the already-deployed standalone tree, so restarts within a
 * deployment reuse it; a fresh deploy naturally starts cold, which is fine),
 * with an in-memory Map in front so hot reads never touch disk.
 *
 * Deliberately dependency-free (fs/path only) and treats `data`/`ctx` as
 * opaque — Next owns their shape, this handler only stores and returns them.
 */
const fs = require("fs")
const path = require("path")

const CACHE_DIR = path.join(process.cwd(), ".next", "cache", "custom-handler")

function keyToFile(key) {
  // Cache keys can contain arbitrary characters (slashes, colons); base64url
  // makes a safe, collision-free filename without needing a hash dependency.
  const safe = Buffer.from(key).toString("base64url")
  return path.join(CACHE_DIR, `${safe}.json`)
}

module.exports = class CacheHandler {
  constructor(options) {
    this.options = options
    this.memoryCache = new Map()
  }

  async get(key) {
    if (this.memoryCache.has(key)) return this.memoryCache.get(key)
    try {
      const file = keyToFile(key)
      if (!fs.existsSync(file)) return undefined
      const entry = JSON.parse(fs.readFileSync(file, "utf8"))
      this.memoryCache.set(key, entry)
      return entry
    } catch {
      return undefined
    }
  }

  async set(key, data, ctx) {
    const entry = { value: data, lastModified: Date.now(), tags: ctx?.tags || [] }
    this.memoryCache.set(key, entry)
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
      fs.writeFileSync(keyToFile(key), JSON.stringify(entry))
    } catch {
      // Best-effort persistence — the in-memory copy still serves this
      // process even if disk writes fail (e.g. read-only filesystem).
    }
  }

  async revalidateTag(tags) {
    const tagList = Array.isArray(tags) ? tags : [tags]
    for (const [key, entry] of this.memoryCache) {
      if (entry.tags?.some((t) => tagList.includes(t))) this.memoryCache.delete(key)
    }
    try {
      if (!fs.existsSync(CACHE_DIR)) return
      for (const file of fs.readdirSync(CACHE_DIR)) {
        const full = path.join(CACHE_DIR, file)
        try {
          const entry = JSON.parse(fs.readFileSync(full, "utf8"))
          if (entry.tags?.some((t) => tagList.includes(t))) fs.unlinkSync(full)
        } catch {
          // Corrupt/partial entry — leave it; a future get() miss will skip it.
        }
      }
    } catch {
      // No cache dir yet — nothing to revalidate.
    }
  }

  resetRequestCache() {}
}
