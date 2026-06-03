'use client'

import { EmailAlertForm } from '@/components/jobs/EmailAlertForm'

export function WfhAlertForm() {
  return (
    <div className="wfh-widget">
      <h3 className="wfh-widget__title">🔔 WFH Job Alerts</h3>
      <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 12px', lineHeight: 1.55 }}>
        Get new remote openings straight to your inbox.
      </p>
      <EmailAlertForm board="wfh" placeholder="Your email for WFH alerts" />
    </div>
  )
}
