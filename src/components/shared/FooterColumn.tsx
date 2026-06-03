import Link from 'next/link'

interface FooterLink { label: string; href: string }
interface FooterColumnProps { title: string; links: FooterLink[] }

export function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div>
      <h4 style={{ color: '#fff', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>{title}</h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {links.map(l => (
          <li key={l.href}>
            <Link href={l.href} style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none', transition: 'color .2s' }}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
