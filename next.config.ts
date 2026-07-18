import path from 'node:path'
import type { NextConfig } from 'next'

/**
 * Vercel sets VERCEL=1 in every build AND runtime context for that platform
 * (preview and production alike) — and since Next.js reads `cacheHandler` at
 * config-load time (i.e. whichever machine runs `next build` for a given
 * deploy target), this one check correctly resolves per-target with no
 * separate config files:
 *
 *   - Hostinger (production): `next build` runs off-Vercel (either locally via
 *     `npm run build:hostinger` then a ZIP upload, or on Hostinger's own
 *     build infra) — VERCEL is unset, so the custom handler applies. This is
 *     the ONLY target the filesystem cache handler has been tested against
 *     (see cache-handler.js): verified live that it survives a full process
 *     kill+restart on the single Node `server.js` process this deploy uses.
 *   - Vercel (production + preview): `next build` runs on Vercel's own build
 *     servers, which set VERCEL=1 — cacheOverrides is empty, so `cacheHandler`
 *     and `cacheMaxMemorySize` are absent from the config entirely and Next
 *     falls through to Vercel's own native Data Cache / ISR implementation,
 *     completely untouched by this repo's code. Vercel's serverless functions
 *     also don't have a writable, persistent filesystem at `process.cwd()`
 *     the way Hostinger's single long-lived process does, so the custom
 *     handler would silently degrade to a per-invocation, non-shared,
 *     in-memory-only fallback there — worse than either Vercel's own cache OR
 *     Next's own in-memory default. Excluding it is not a missed
 *     optimization, it's what makes this safe to ship to a dual-deployment app.
 *   - Local dev (`next dev`/`next start`): VERCEL is unset here too, same as
 *     Hostinger, so the custom handler applies — harmless (writes to the
 *     already-gitignored `.next/cache/custom-handler`), and gives local
 *     testing the same cache behaviour as production Hostinger.
 */
const isVercel = !!process.env.VERCEL

const cacheOverrides: Pick<NextConfig, 'cacheHandler' | 'cacheMaxMemorySize'> = isVercel
  ? {}
  : {
      cacheHandler: path.join(__dirname, 'cache-handler.js'),
      cacheMaxMemorySize: 0, // defer entirely to the custom handler's own in-memory layer
    }

const nextConfig: NextConfig = {
  ...cacheOverrides,

  // ── Images ──────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },     // Supabase Storage CDN
      { protocol: 'https', hostname: 'himalayas.app' },      // Himalayas company logos
      { protocol: 'https', hostname: '*.amazonaws.com' },    // S3 if needed
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // ── Security Headers ─────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://himalayas.app",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },

  // ── Redirects ────────────────────────────────────────────
  async redirects() {
    return [
      { source: '/jobs', destination: '/jobs/private', permanent: true },
      { source: '/employer', destination: '/employer/dashboard', permanent: false },
      { source: '/candidate', destination: '/candidate/dashboard', permanent: false },
      { source: '/admin', destination: '/admin/dashboard', permanent: false },
      // Canonical-slug redirect: external/indexed title-derived slug → stored slug.
      {
        source: '/jobs/govt/rrb-ntpc-graduate-level-recruitment-2026',
        destination: '/jobs/govt/rrb-ntpc-graduate-level-2026',
        permanent: true,
      },
    ]
  },

  // ── Environment ──────────────────────────────────────────
  env: {
    NEXT_PUBLIC_APP_NAME: 'Noble Job',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://www.noblejob.in',
  },

  // ── Experimental ─────────────────────────────────────────
  experimental: {},

  // Avoid stale webpack chunks on Windows (/_not-found MODULE_NOT_FOUND during collect)
  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = false
    }
    return config
  },

  // ── Production (Hostinger / Node.js) ─────────────────────
  poweredByHeader: false,
  compress: true,

  // ── Output: minimal Node server bundle (.next/standalone) ─
  output: 'standalone',
}

export default nextConfig
