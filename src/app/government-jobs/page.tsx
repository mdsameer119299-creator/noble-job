import { LandingRoute, landingMetadata } from "@/components/landing/renderLanding"

export const revalidate = 3600
export function generateMetadata() {
  return landingMetadata("government-jobs")
}
export default function Page() {
  return <LandingRoute slug="government-jobs" />
}
