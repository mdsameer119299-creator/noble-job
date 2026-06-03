import { JsonLd } from "@/components/seo/JsonLd"
import { organizationSchema, websiteSchema } from "@/lib/seo/schema"

/** Global Organization + WebSite schema on every public page */
export function SiteSchemas() {
  return <JsonLd data={[organizationSchema(), websiteSchema()]} />
}
