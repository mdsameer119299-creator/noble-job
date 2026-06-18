import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../styles/globals.css'
import '../styles/site-header.css'
import '../styles/mobile-responsive.css'
import { Navbar } from '@/components/shared/Navbar'
import { Footer } from '@/components/shared/Footer'
import { Toast } from '@/components/shared/Toast'
import { SiteSchemas } from '@/components/seo/SiteSchemas'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { SITE_TAGLINE } from '@/lib/seo/constants'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: `Noble Job — ${SITE_TAGLINE}`,
    description:
      "Job Portal India for Jobs in India — Government Jobs, Private Jobs, Work From Home Jobs, and Abroad Jobs. 80,000+ verified openings by NCC Foundation.",
    path: "/",
  }),
  title: {
    default: `Noble Job — ${SITE_TAGLINE}`,
    template: '%s | Noble Job',
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.noblejob.in'),
  authors: [{ name: 'Noble Job — An Initiative of NCC Foundation' }],
  manifest: '/manifest.json',
  icons: {
    // ?v=2 busts the aggressive browser favicon cache after a production deploy.
    icon: [
      { url: '/favicon.ico?v=2', sizes: 'any' },
      { url: '/favicon-16x16.png?v=2', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png?v=2', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png?v=2', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png?v=2', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico?v=2'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className={inter.className}>
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <SiteSchemas />
        <Navbar />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <Toast />
      </body>
    </html>
  )
}
