import { TailCityCategoryRoute, tailCityCategoryMetadata } from "@/components/landing/renderTailCityLanding"
import { TAIL_CITIES, getQualifyingCategorySlugsForTailCity } from "@/lib/seo/tailCityLanding"

export const revalidate = 3600

export async function generateStaticParams() {
  const results = await Promise.all(
    TAIL_CITIES.map(async city => {
      const categories = await getQualifyingCategorySlugsForTailCity(city)
      return categories.map(category => ({ city: city.slug, category }))
    }),
  )
  return results.flat()
}

export function generateMetadata({ params }: { params: Promise<{ city: string; category: string }> }) {
  return params.then(({ city, category }) => tailCityCategoryMetadata(city, category))
}

export default async function Page({ params }: { params: Promise<{ city: string; category: string }> }) {
  const { city, category } = await params
  return <TailCityCategoryRoute citySlug={city} categorySlug={category} />
}
