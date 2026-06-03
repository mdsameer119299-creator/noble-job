import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/seo/constants"

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/auth",
          "/auth/callback",
          "/employer/",
          "/candidate/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
