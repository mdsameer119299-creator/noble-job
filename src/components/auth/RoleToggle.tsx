'use client'

import '@/styles/auth.css'
import { JobSeekerIcon, EmployerIcon } from '@/components/shared/RoleIcons'

interface RoleToggleProps {
  role: 'employer' | 'candidate'
  onChange: (r: 'employer' | 'candidate') => void
}

export function RoleToggle({ role, onChange }: RoleToggleProps) {
  return (
    <div className="auth-role-toggle">
      <button
        type="button"
        className={`auth-role-btn ${role === 'candidate' ? 'auth-role-btn--active' : ''}`}
        onClick={() => onChange('candidate')}
      >
        <span className="auth-role-btn__icon" aria-hidden>
          <JobSeekerIcon size={18} />
        </span>
        Job Seeker
      </button>
      <button
        type="button"
        className={`auth-role-btn auth-role-btn--employer ${role === 'employer' ? 'auth-role-btn--active' : ''}`}
        onClick={() => onChange('employer')}
      >
        <span className="auth-role-btn__icon" aria-hidden>
          <EmployerIcon size={18} />
        </span>
        Employer
      </button>
    </div>
  )
}
