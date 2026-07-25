import { CityCategoryRoute, cityCategoryMetadata } from "@/components/landing/renderCityCategoryLanding"
import { getCityBySlug, getQualifyingCategorySlugsForCity } from "@/lib/seo/cityCategoryLanding"

const CITY_SLUG = "jobs-in-bangalore"

export async function generateStaticParams() {
  const city = getCityBySlug(CITY_SLUG)
  if (!city) return []
  return (await getQualifyingCategorySlugsForCity(city)).map(category => ({ category }))
}

export function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  return params.then(({ category }) => cityCategoryMetadata(CITY_SLUG, category))
}

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  return <CityCategoryRoute citySlug={CITY_SLUG} categorySlug={category} />
}
