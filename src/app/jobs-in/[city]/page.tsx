import { TailCityRoute, tailCityMetadata } from "@/components/landing/renderTailCityLanding"
import { getQualifyingTailCitySlugs } from "@/lib/seo/tailCityLanding"

export const revalidate = 3600

export async function generateStaticParams() {
  const slugs = await getQualifyingTailCitySlugs()
  return slugs.map(city => ({ city }))
}

export function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  return params.then(({ city }) => tailCityMetadata(city))
}

export default async function Page({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params
  return <TailCityRoute citySlug={city} />
}
