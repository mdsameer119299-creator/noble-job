import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { ResumeModePlaceholder } from '@/components/candidate/ResumeModePlaceholder'

// Thin "coming soon" placeholder → noindex so it never enters the index or the
// sitemap (the sitemap enumerates a static allowlist and does not include this).
export const metadata: Metadata = buildPageMetadata({
  title: 'Improve My Resume — Resume AI (Coming Soon) | Noble Job',
  description: 'AI resume improvement is coming soon to Noble Job. Get your free Career Report and explore genuine jobs in the meantime.',
  path: '/resume/improve',
  noIndex: true,
})

export default function ResumeImprovePage() {
  return <ResumeModePlaceholder mode="improve" />
}
