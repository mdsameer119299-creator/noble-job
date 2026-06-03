'use client'
import { TextareaHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-t1 mb-1.5">{label}</label>}
      <textarea
        ref={ref}
        className={clsx(
          'w-full rounded-[10px] border border-noble-border bg-white text-t1 text-sm px-4 py-3 outline-none resize-vertical min-h-[120px]',
          'focus:border-noble-blue focus:ring-2 focus:ring-noble-blue/10 transition-all placeholder:text-t4',
          error && 'border-noble-red', className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-noble-red">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'
