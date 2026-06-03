import { clsx } from 'clsx'

interface AvatarProps {
  name?: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: string
  className?: string
}

const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg', xl: 'w-20 h-20 text-2xl' }

export function Avatar({ name, src, size = 'md', color = '#1847d4', className }: AvatarProps) {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  if (src) return <img src={src} alt={name || ''} className={clsx('rounded-full object-cover', sizes[size], className)} />
  return (
    <div className={clsx('rounded-full flex items-center justify-center font-black text-white flex-shrink-0', sizes[size], className)}
      style={{ background: color }}>
      {initials}
    </div>
  )
}
