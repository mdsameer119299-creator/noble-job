import Link from 'next/link'

interface Crumb { label: string; href?: string }

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-t3 py-2">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-t4">›</span>}
          {c.href
            ? <Link href={c.href} className="hover:text-noble-blue transition-colors no-underline">{c.label}</Link>
            : <span className="text-t1 font-medium">{c.label}</span>}
        </span>
      ))}
    </nav>
  )
}
