import { clsx } from 'clsx'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'blue' | 'orange' | 'green' | 'red' | 'purple' | 'grey' | 'new' | 'hot'
  className?: string
}

const variants = {
  blue:   'bg-blue-50 text-noble-blue border-blue-200',
  orange: 'bg-orange-50 text-noble-orange border-orange-200',
  green:  'bg-green-50 text-noble-green border-green-200',
  red:    'bg-red-50 text-noble-red border-red-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  grey:   'bg-gray-100 text-t3 border-gray-200',
  new:    'bg-blue-600 text-white border-transparent',
  hot:    'bg-red-500 text-white border-transparent',
}

export function Badge({ children, variant = 'blue', className }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border', variants[variant], className)}>
      {children}
    </span>
  )
}
