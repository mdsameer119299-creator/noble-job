'use client'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
  className?: string
}

export function Modal({ open, onClose, children, maxWidth = '640px', className }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(13,31,78,.55)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className={clsx('noble-modal-panel relative bg-white rounded-[20px] shadow-[0_20px_60px_rgba(13,31,78,.25)] overflow-hidden w-full animate-fade-in', className)}
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
