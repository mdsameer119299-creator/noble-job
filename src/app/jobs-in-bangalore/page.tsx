import { LandingRoute, landingMetadata } from "@/components/landing/renderLanding"

export const revalidate = 3600
export function generateMetadata() {
  return landingMetadata("jobs-in-bangalore")
}
export default function Page() {
  return <LandingRoute slug="jobs-in-bangalore" />
}
