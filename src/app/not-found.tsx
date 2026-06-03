import type { Metadata } from 'next'
import Link from 'next/link'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'Page Not Found',
  description: 'The page you requested does not exist on Noble Job. Browse Government Jobs, Private Jobs, WFH, and Abroad openings.',
  path: '/404',
  noIndex: true,
})

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-6xl font-black text-noble-navy mb-4" style={{fontFamily:'Playfair Display,serif'}}>404</h1>
      <h2 className="text-2xl font-bold text-noble-navy mb-2">Page Not Found</h2>
      <p className="text-t3 mb-8">The page you are looking for does not exist.</p>
      <Link href="/" className="btn-primary inline-block px-8 py-3 rounded-btn text-white font-bold no-underline"
        style={{background:'#f07020'}}>
        Back to Home
      </Link>
    </div>
  )
}
