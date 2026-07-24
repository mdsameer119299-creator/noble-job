import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { getArticle, ARTICLE_SLUGS, buildArticleView, fetchArticleJobs } from "@/lib/seo/articles"
import { ArticlePage } from "@/components/articles/ArticlePage"

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 3600

export function generateStaticParams() {
  return ARTICLE_SLUGS.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const a = getArticle(slug)
  if (!a) return { title: "Guide Not Found — Noble Job", robots: { index: false, follow: false } }
  return buildPageMetadata({
    title: a.metaTitle,
    description: a.metaDescription,
    path: `/guides/${slug}`,
    keywords: a.keywords,
    ogType: "article",
  })
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const a = getArticle(slug)
  if (!a) notFound()
  const [view, jobs] = await Promise.all([
    Promise.resolve(buildArticleView(a)),
    fetchArticleJobs(a),
  ])
  return <ArticlePage view={view} jobs={jobs} />
}
