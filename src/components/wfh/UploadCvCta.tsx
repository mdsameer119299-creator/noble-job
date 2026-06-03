import Link from 'next/link'

export function UploadCvCta() {
  return (
    <div className="wfh-widget">
      <h3 className="wfh-widget__title">Boost Your Profile</h3>
      <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 14px', lineHeight: 1.55 }}>
        Upload your CV for AI matching against remote openings.
      </p>
      <Link href="/auth?role=candidate&tab=register" className="wfh-upload-cta">
        Upload CV — Free →
      </Link>
    </div>
  )
}
