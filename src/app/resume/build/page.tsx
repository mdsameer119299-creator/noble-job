import type { Metadata } from 'next'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { ResumeWorkspaceShell } from '@/components/resume/ResumeWorkspaceShell'

// Resume AI workspace (pre-engine). Kept noindex,nofollow and out of the sitemap
// (the sitemap enumerates a static allowlist that does not include this route).
export const metadata: Metadata = buildPageMetadata({
  title: 'Build a Professional Resume — Noble Resume AI | Noble Job',
  description: 'Start a professional resume with Noble Resume AI. Choose how to begin; a guided AI builder is coming soon.',
  path: '/resume/build',
  noIndex: true,
})

export default function ResumeBuildPage() {
  return <ResumeWorkspaceShell mode="build" />
}
