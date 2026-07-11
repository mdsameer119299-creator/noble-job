import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { ResumeModePlaceholder } from '@/components/candidate/ResumeModePlaceholder'

// Thin "coming soon" placeholder → noindex so it never enters the index or the
// sitemap (the sitemap enumerates a static allowlist and does not include this).
export const metadata: Metadata = buildPageMetadata({
  title: 'Tailor Your Resume for a Job — Resume AI (Coming Soon) | Noble Job',
  description: 'AI resume tailoring for a specific vacancy is coming soon to Noble Job. Get your free Career Report and explore genuine jobs in the meantime.',
  path: '/resume/tailor',
  noIndex: true,
})

export default function ResumeTailorPage() {
  return <ResumeModePlaceholder mode="tailor" />
}
