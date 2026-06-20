import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { getCategoryLanding, getCityLanding, buildLandingView, fetchLandingJobs } from "@/lib/seo/landing"
import { LandingPage } from "@/components/landing/LandingPage"
import type { Landing } from "@/lib/seo/landingTypes"

function resolve(slug: string): Landing | undefined {
  return getCategoryLanding(slug) ?? getCityLanding(slug)
}

export function landingMetadata(slug: string): Metadata {
  const cfg = resolve(slug)
  if (!cfg) return { title: "Jobs — Noble Job" }
  return buildPageMetadata({
    title: cfg.metaTitle,
    description: cfg.metaDescription,
    path: `/${slug}`,
    keywords: cfg.keywords,
  })
}

export async function LandingRoute({ slug }: { slug: string }) {
  const cfg = resolve(slug)
  if (!cfg) notFound()
  const [view, jobs] = await Promise.all([
    Promise.resolve(buildLandingView(cfg)),
    fetchLandingJobs(cfg),
  ])
  return <LandingPage view={view} jobs={jobs} />
}
