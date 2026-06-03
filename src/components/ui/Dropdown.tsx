'use client'
import { useState, useRef, useEffect } from 'react'

interface DropdownItem { label: string; value: string; icon?: React.ReactNode }

interface DropdownProps {
  trigger: React.ReactNode
  items: DropdownItem[]
  onSelect: (value: string) => void
}

export function Dropdown({ trigger, items, onSelect }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">{trigger}</div>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-noble-border rounded-[12px] shadow-[0_8px_32px_rgba(13,31,78,.12)] z-50 min-w-[160px] py-1 animate-fade-in">
          {items.map(item => (
            <button key={item.value} onClick={() => { onSelect(item.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-t2 hover:bg-blue-50 hover:text-noble-blue text-left transition-colors">
              {item.icon && <span className="text-t3">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
