/**
 * types/candidate.ts — Candidate-related types
 *
 * All 14 candidate dashboard section data shapes.
 * Matches the CAND_JOBS, CAND_APPS, CAND_ALERTS etc. from original.
 */

export interface Candidate {
  id:               string
  userId:           string
  firstName:        string
  lastName:         string
  phone?:           string
  experienceYears?: number
  category?:        string
  expectedSalary?:  number
  skills:           string[]
  resumeUrl?:       string
  city?:            string
  profileScore:     number
  createdAt:        string
}

export interface WorkExperience {
  id:          string
  candidateId: string
  company:     string
  role:        string
  startDate:   string
  endDate?:    string
  isCurrent:   boolean
  description: string
}

export interface Education {
  id:          string
  candidateId: string
  institution: string
  degree:      string
  field:       string
  yearFrom:    number
  yearTo?:     number
}

export type AiResponseType = "suggest" | "resume" | "skills" | "tips" | "improve"

export interface AiResponse {
  type:    AiResponseType
  title:   string
  content: string
  tips:    string[]
}
