import { z } from "zod"

export const applyJobSchema = z.object({
  jobId: z.string().min(1),
  board: z.enum(["private", "govt", "wfh", "abroad"]).default("private"),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  // Stored only as metadata (never shown to candidates): origin of an imported job.
  sourceUrl: z.string().url().max(500).optional().or(z.literal("")),
  source: z.string().max(200).optional(),
  // Optional cover note written by the candidate in the internal application form.
  coverNote: z.string().max(2000).optional(),
})

export const updateApplicationStatusSchema = z.object({
  status: z.enum(["new", "shortlisted", "interview", "hired", "rejected"]),
})
