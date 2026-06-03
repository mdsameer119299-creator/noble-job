'use client'
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'blue' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-bold rounded-btn transition-all duration-200 cursor-pointer border-none'
    const variants = {
      primary: 'bg-noble-orange text-white shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5',
      outline: 'border-2 border-noble-orange text-noble-orange bg-transparent hover:bg-noble-orange hover:text-white',
      blue:    'bg-noble-blue text-white shadow-blue hover:shadow-blue-lg hover:-translate-y-0.5',
      ghost:   'bg-transparent text-t2 hover:bg-gray-100',
      danger:  'bg-noble-red text-white hover:opacity-90',
    }
    const sizes = { sm: 'text-sm px-3 py-1.5', md: 'text-sm px-5 py-2.5', lg: 'text-base px-7 py-3' }
    return (
      <button
        ref={ref}
        className={clsx(base, variants[variant], sizes[size], (disabled || loading) && 'opacity-60 cursor-not-allowed', className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
