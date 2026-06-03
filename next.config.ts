import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
