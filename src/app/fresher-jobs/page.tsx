import { LandingRoute, landingMetadata } from "@/components/landing/renderLanding"

export const revalidate = 3600
export function generateMetadata() {
  return landingMetadata("fresher-jobs")
}
export default function Page() {
  return <LandingRoute slug="fresher-jobs" />
}
