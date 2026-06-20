import { LandingRoute, landingMetadata } from "@/components/landing/renderLanding"

export const revalidate = 3600
export function generateMetadata() {
  return landingMetadata("work-from-home-jobs")
}
export default function Page() {
  return <LandingRoute slug="work-from-home-jobs" />
}
