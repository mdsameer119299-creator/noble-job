import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { GOVT_TOP_CATEGORIES, getCategoryBySlug } from "@/lib/config/govtTaxonomy"
import { getGovtJobsFiltered, getGovtContent } from "@/lib/services/govtJobService"
import { GovtListingView } from "@/components/govt/GovtListingView"

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

// DB-driven content regenerates so new govt_jobs rows appear without a redeploy.
export const revalidate = 600
export function generateStaticParams() {
  return GOVT_TOP_CATEGORIES.map(c => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) return { title: "Government Jobs — Noble Job" }
  return buildPageMetadata({
    title: `${cat.label} 2026 — Latest Government Job Notifications`,
    description: cat.description,
    path: `/jobs/govt/category/${slug}`,
    keywords: [cat.label, "government jobs", "sarkari naukri", "Jobs in India"],
  })
}

export default async function GovtCategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const page = Number(sp.page || 1)
  const basePath = `/jobs/govt/category/${slug}`
  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Govt Jobs", href: "/jobs/govt" },
    { label: cat.label },
  ]

  if (cat.contentType !== "jobs") {
    const r = await getGovtContent(cat.contentType, { q: sp.q, state: sp.state, page })
    return (
      <GovtListingView
        kind="content"
        crumbs={crumbs}
        title={cat.label}
        description={cat.description}
        icon={cat.icon}
        categorySlug={slug}
        items={r.items}
        total={r.total}
        vacanciesTotal={0}
        page={r.page}
        totalPages={r.totalPages}
        basePath={basePath}
        query={sp}
      />
    )
  }

  const r = await getGovtJobsFiltered({
    category: slug,
    q: sp.q,
    state: sp.state,
    qualification: sp.qualification,
    department: sp.department,
    experience: sp.experience,
    lastDate: sp.lastDate,
    page,
  })

  return (
    <GovtListingView
      kind="jobs"
      crumbs={crumbs}
      title={cat.label}
      description={cat.description}
      icon={cat.icon}
      categorySlug={slug}
      items={r.items}
      facets={r.facets}
      total={r.total}
      vacanciesTotal={r.vacanciesTotal}
      page={r.page}
      totalPages={r.totalPages}
      basePath={basePath}
      query={sp}
    />
  )
}
