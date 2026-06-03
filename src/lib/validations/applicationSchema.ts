import { z } from "zod"

export const applyJobSchema = z.object({
  jobId: z.string().min(1),
  board: z.enum(["private", "govt", "wfh", "abroad"]).default("private"),
  jobTitle: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
})

export const updateApplicationStatusSchema = z.object({
  status: z.enum(["new", "shortlisted", "interview", "hired", "rejected"]),
})
