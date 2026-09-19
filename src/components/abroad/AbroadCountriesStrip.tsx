import { getVisibleAbroadCountryCounts } from '@/lib/services/visibleCounts'
import { AbroadCountriesClient } from './AbroadCountriesClient'

export async function AbroadCountriesStrip() {
  // Per-country counts are the size of the list each card opens (see visibleCounts).
  const countries = await getVisibleAbroadCountryCounts()
  return <AbroadCountriesClient countries={countries} />
}
