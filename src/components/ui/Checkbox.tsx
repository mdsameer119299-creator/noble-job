'use client'
import { InputHTMLAttributes } from 'react'

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string | React.ReactNode
}

export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        className="w-4 h-4 rounded border-noble-border text-noble-blue focus:ring-noble-blue"
        {...props}
      />
      {label && <span className="text-sm text-t2">{label}</span>}
    </label>
  )
}
