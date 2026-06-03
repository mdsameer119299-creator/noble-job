import { getAbroadCountryCounts } from '@/lib/data/jobInventory'
import { AbroadCountriesClient } from './AbroadCountriesClient'

export function AbroadCountriesStrip() {
  const countries = getAbroadCountryCounts()
  return <AbroadCountriesClient countries={countries} />
}
