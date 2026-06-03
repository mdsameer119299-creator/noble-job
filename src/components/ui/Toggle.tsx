'use client'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
        style={{ background: checked ? '#1847d4' : '#e2e8f0' }}
        disabled={disabled}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
      {label && <span className="text-sm font-medium text-t2">{label}</span>}
    </label>
  )
}
