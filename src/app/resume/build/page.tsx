import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { ResumeModePlaceholder } from '@/components/candidate/ResumeModePlaceholder'

// Thin "coming soon" placeholder → noindex so it never enters the index or the
// sitemap (the sitemap enumerates a static allowlist and does not include this).
export const metadata: Metadata = buildPageMetadata({
  title: 'Build a Professional Resume — Resume AI (Coming Soon) | Noble Job',
  description: 'A guided AI resume builder is coming soon to Noble Job. Get your free Career Report and explore genuine jobs in the meantime.',
  path: '/resume/build',
  noIndex: true,
})

export default function ResumeBuildPage() {
  return <ResumeModePlaceholder mode="build" />
}
