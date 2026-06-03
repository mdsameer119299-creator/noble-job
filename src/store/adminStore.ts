import { create } from "zustand"
import type { AdminStats } from "@/types/admin"
interface AdminStoreState {
  stats: AdminStats | null; activeSection: string; isAuthed: boolean
  setStats: (s: AdminStats) => void; setSection: (s: string) => void; setAuthed: (v: boolean) => void
}
export const useAdminStore = create<AdminStoreState>((set) => ({
  stats: null, activeSection: 'overview', isAuthed: false,
  setStats: (stats) => set({ stats }),
  setSection: (activeSection) => set({ activeSection }),
  setAuthed: (isAuthed) => set({ isAuthed }),
}))
