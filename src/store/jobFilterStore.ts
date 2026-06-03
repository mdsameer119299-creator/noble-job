/**
 * store/jobFilterStore.ts — Job filter state (Zustand)
 *
 * Manages the Private Jobs page filter sidebar state.
 * Synced with URL search params so filters are shareable/bookmarkable.
 *
 * Mirrors the original applyFilters() + doSearch() state:
 *  - Location checkboxes (6 options)
 *  - Salary range checkboxes (6 ranges)
 *  - Experience level checkboxes (6 levels)
 *  - Job type checkboxes (6 types)
 *  - Industry checkboxes
 *  - Text search query
 *  - Category dropdown
 *  - Type dropdown
 *  - Sort order
 */

import { create } from "zustand"

export interface JobFilterState {
  query:       string
  locations:   string[]
  salaries:    string[]
  experiences: string[]
  jobTypes:    string[]
  industries:  string[]
  category:    string
  sort:        string
  page:        number
  setQuery:       (q: string) => void
  setLocations:   (v: string[]) => void
  setSalaries:    (v: string[]) => void
  setExperiences: (v: string[]) => void
  setJobTypes:    (v: string[]) => void
  setCategory:    (v: string) => void
  setSort:        (v: string) => void
  setPage:        (v: number) => void
  clearFilters:   () => void
}

export const useJobFilterStore = create<JobFilterState>((set) => ({
  query: "", locations: [], salaries: [], experiences: [],
  jobTypes: [], industries: [], category: "all", sort: "latest", page: 1,
  setQuery:       (q) => set({ query: q, page: 1 }),
  setLocations:   (v) => set({ locations: v, page: 1 }),
  setSalaries:    (v) => set({ salaries: v, page: 1 }),
  setExperiences: (v) => set({ experiences: v, page: 1 }),
  setJobTypes:    (v) => set({ jobTypes: v, page: 1 }),
  setCategory:    (v) => set({ category: v, page: 1 }),
  setSort:        (v) => set({ sort: v }),
  setPage:        (v) => set({ page: v }),
  clearFilters:   ()  => set({ query:"",locations:[],salaries:[],experiences:[],jobTypes:[],industries:[],category:"all",page:1 }),
}))
