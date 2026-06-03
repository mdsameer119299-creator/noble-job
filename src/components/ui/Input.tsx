'use client'
import { InputHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-t1 mb-1.5">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-t3">{icon}</span>}
        <input
          ref={ref}
          className={clsx(
            'w-full rounded-[10px] border border-noble-border bg-white text-t1 text-sm px-4 py-3 outline-none',
            'focus:border-noble-blue focus:ring-2 focus:ring-noble-blue/10 transition-all',
            'placeholder:text-t4',
            icon && 'pl-10',
            error && 'border-noble-red',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-noble-red">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'
