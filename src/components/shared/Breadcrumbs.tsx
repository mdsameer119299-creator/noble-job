import Link from "next/link"

export interface Crumb { label: string; href?: string }

/** Accessible breadcrumb trail + Schema.org BreadcrumbList structured data. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.noblejob.in"
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: `${base}${c.href}` } : {}),
    })),
  }
  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: 14 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ol style={{ display: "flex", flexWrap: "wrap", gap: 6, listStyle: "none", margin: 0, padding: 0, fontSize: 13, color: "rgba(255,255,255,.75)" }}>
        {items.map((c, i) => (
          <li key={`${c.label}-${c.href ?? i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} style={{ color: "rgba(255,255,255,.8)", textDecoration: "none" }}>{c.label}</Link>
            ) : (
              <span style={{ color: i === items.length - 1 ? "#fff" : "rgba(255,255,255,.8)", fontWeight: i === items.length - 1 ? 700 : 400 }}>{c.label}</span>
            )}
            {i < items.length - 1 && <span style={{ opacity: 0.5 }}>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
