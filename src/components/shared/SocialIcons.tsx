import { SOCIAL_PLATFORMS, SocialBrandIcon } from '@/components/shared/SocialBrandIcon'

export function SocialIcons({ size = 36 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {SOCIAL_PLATFORMS.map(s => (
        <a
          key={s.platform}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          title={s.name}
          style={{ textDecoration: 'none' }}
        >
          <SocialBrandIcon platform={s.platform} size={size} />
        </a>
      ))}
    </div>
  )
}
