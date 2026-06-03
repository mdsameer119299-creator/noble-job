/**
 * hooks/useToast.ts — Toast notification hook
 *
 * Wrapper around useUIStore.addToast().
 * Replaces the original gnotif(message, type) function used everywhere.
 *
 * Usage:
 *   const toast = useToast()
 *   toast.success("Job saved!")
 *   toast.error("Please fill all fields")
 */

"use client"
import { useUIStore } from "@/store/uiStore"

export function useToast() {
  const addToast = useUIStore(s => s.addToast)
  return {
    success: (msg: string) => addToast(msg, "success"),
    error:   (msg: string) => addToast(msg, "error"),
    info:    (msg: string) => addToast(msg, "info"),
    warning: (msg: string) => addToast(msg, "warning"),
  }
}
