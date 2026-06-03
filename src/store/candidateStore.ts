import { create } from "zustand"
import type { Candidate } from "@/types/candidate"
interface CandidateStoreState {
  profile: Candidate | null; profileScore: number; activeSection: string
  setProfile: (p: Candidate) => void; setScore: (n: number) => void; setSection: (s: string) => void
}
export const useCandidateStore = create<CandidateStoreState>((set) => ({
  profile: null, profileScore: 0, activeSection: 'dashboard',
  setProfile: (profile) => set({ profile }),
  setScore: (profileScore) => set({ profileScore }),
  setSection: (activeSection) => set({ activeSection }),
}))
