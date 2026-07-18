import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ── Cache handler (Hostinger standalone) ──────────────────
  // Persists the Data Cache (unstable_cache, fetch revalidate) to disk instead
  // of the framework default of per-process memory, which is wiped on every
  // restart when self-hosting (no such guarantee outside Vercel). See
  // cache-handler.js for the full rationale — this is what makes the 300s
  // shared cache around the govt_jobs pool read (govtStatsSource.ts) actually
  // collapse repeat reads instead of silently re-querying Supabase every time
  // the single Node process restarts.
  cacheHandler: path.join(__dirname, 'cache-handler.js'),
  cacheMaxMemorySize: 0, // defer entirely to the custom handler's own in-memory layer

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
