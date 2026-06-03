import { Suspense } from 'react'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '80vh' }} />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
