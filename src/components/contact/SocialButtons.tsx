import { SOCIAL_PLATFORMS, SocialBrandIcon } from '@/components/shared/SocialBrandIcon'

export function SocialButtons() {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '18px 16px' }}>
      <h4 style={{ fontWeight: 900, color: '#0d1f4e', fontSize: 14, marginBottom: 12 }}>Follow Noble Job</h4>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {SOCIAL_PLATFORMS.map(s => (
          <a
            key={s.platform}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            title={s.name}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              borderRadius: 10,
              background: '#f8faff',
              border: '1.5px solid #e2e8f0',
              fontSize: 13,
              fontWeight: 700,
              color: '#374151',
              textDecoration: 'none',
              transition: 'all .2s',
            }}
            className="hover:border-noble-blue hover:shadow-sm"
          >
            <SocialBrandIcon platform={s.platform} size={32} />
            {s.name}
          </a>
        ))}
      </div>
    </div>
  )
}
