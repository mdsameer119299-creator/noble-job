import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: boolean
}

export function Card({ children, className, hover = false, padding = true }: CardProps) {
  return (
    <div className={clsx(
      'bg-white rounded-[16px] border border-noble-border',
      hover && 'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
      !hover && 'shadow-card',
      padding && 'p-6',
      className
    )}>
      {children}
    </div>
  )
}
