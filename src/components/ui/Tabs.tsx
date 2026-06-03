'use client'
import { clsx } from 'clsx'

interface Tab { id: string; label: string; count?: number }

interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  variant?: 'underline' | 'pill'
}

export function Tabs({ tabs, active, onChange, variant = 'underline' }: TabsProps) {
  if (variant === 'pill') return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={clsx('px-4 py-2 rounded-full text-sm font-bold transition-all border',
            active === t.id
              ? 'bg-noble-blue text-white border-noble-blue'
              : 'bg-white text-t2 border-noble-border hover:border-noble-blue hover:text-noble-blue'
          )}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-white/20">{t.count}</span>}
        </button>
      ))}
    </div>
  )
  return (
    <div className="flex border-b border-noble-border overflow-x-auto">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={clsx('px-5 py-3 text-sm font-bold whitespace-nowrap transition-all border-b-2 -mb-px',
            active === t.id
              ? 'border-noble-blue text-noble-blue'
              : 'border-transparent text-t3 hover:text-t1'
          )}>
          {t.label}{t.count !== undefined && <span className={clsx('ml-1.5 px-2 py-0.5 rounded-full text-xs', active === t.id ? 'bg-noble-blue/10' : 'bg-gray-100')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
