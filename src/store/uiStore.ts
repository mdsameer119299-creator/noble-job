/**
 * store/uiStore.ts — Global UI state (Zustand)
 *
 * Manages toast notifications, modal states, mobile menu.
 * Replaces the original gnotif() toast function across all pages.
 */

import { create } from "zustand"

export type ToastType = "success" | "error" | "info" | "warning"

export interface Toast {
  id:      string
  message: string
  type:    ToastType
}

interface UIState {
  toasts:       Toast[]
  isMobileMenuOpen: boolean
  addToast:     (message: string, type?: ToastType) => void
  removeToast:  (id: string) => void
  toggleMenu:   () => void
  closeMenu:    () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  isMobileMenuOpen: false,
  addToast: (message, type = "success") => {
    const id = Date.now().toString()
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  toggleMenu:  () => set(s => ({ isMobileMenuOpen: !s.isMobileMenuOpen })),
  closeMenu:   () => set({ isMobileMenuOpen: false }),
}))
