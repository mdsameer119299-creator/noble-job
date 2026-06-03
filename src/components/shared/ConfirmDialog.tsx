'use client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} maxWidth="400px">
      <div className="p-6">
        <h3 className="text-lg font-black text-noble-navy mb-2" style={{ fontFamily: 'Playfair Display,serif' }}>{title}</h3>
        <p className="text-t2 text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}
