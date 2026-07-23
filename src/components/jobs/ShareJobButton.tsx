'use client'
import { useToast } from '@/hooks/useToast'

interface ShareJobButtonProps { title: string; url?: string }

export function ShareJobButton({ title, url }: ShareJobButtonProps) {
  const toast = useToast()

  const handleShare = async () => {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl })
      } catch {
        /* user cancelled the share sheet — not an error */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <button type="button" onClick={handleShare} title="Share job" style={btn}>
      🔗 Share
    </button>
  )
}

const btn: React.CSSProperties = { background: 'transparent', border: '1.5px solid #e2e8f0', color: '#6b7280', padding: '7px 12px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }
