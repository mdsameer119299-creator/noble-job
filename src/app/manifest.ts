import type { MetadataRoute } from "next"
import { SITE_NAME, siteUrl } from "@/lib/seo/constants"

export default function manifest(): MetadataRoute.Manifest {
  const base = siteUrl()
  return {
    name: `${SITE_NAME} — Job Portal India`,
    short_name: SITE_NAME,
    description:
      "Jobs in India: Government Jobs, Private Jobs, Work From Home Jobs, and Abroad Jobs.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1f4e",
    theme_color: "#1847d4",
    orientation: "portrait-primary",
    lang: "en-IN",
    scope: "/",
    icons: [
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["business", "productivity"],
    id: base,
  }
}
