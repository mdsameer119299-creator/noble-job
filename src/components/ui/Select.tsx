'use client'
import { SelectHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { label: string; value: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-t1 mb-1.5">{label}</label>}
      <select
        ref={ref}
        className={clsx(
          'w-full rounded-[10px] border border-noble-border bg-white text-t1 text-sm px-4 py-3 outline-none appearance-none',
          'focus:border-noble-blue focus:ring-2 focus:ring-noble-blue/10 transition-all',
          error && 'border-noble-red', className
        )}
        {...props}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-noble-red">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'
