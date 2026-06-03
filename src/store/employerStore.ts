import { create } from "zustand"
import type { EmployerStats } from "@/types/employer"
interface EmployerStoreState {
  stats: EmployerStats | null; activeSection: string
  setStats: (s: EmployerStats) => void; setSection: (s: string) => void
}
export const useEmployerStore = create<EmployerStoreState>((set) => ({
  stats: null, activeSection: 'dashboard',
  setStats: (stats) => set({ stats }),
  setSection: (activeSection) => set({ activeSection }),
}))
