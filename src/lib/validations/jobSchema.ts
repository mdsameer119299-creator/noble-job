/**
 * validations/jobSchema.ts — Job posting validation
 *
 * Validates the 7-field "Post a Job" modal form used by employers.
 * Also validates admin direct job posting form.
 * Matches the exact fields in emp-post-modal from the original HTML.
 */

import { z } from "zod"

export const postJobSchema = z.object({
  title:       z.string().min(5, "Job title must be at least 5 characters"),
  location:    z.string().min(2, "Location is required"),
  salaryMin:   z.number().optional(),
  salaryMax:   z.number().optional(),
  jobType:     z.enum(["Full Time", "Part Time", "Contract", "Internship", "Remote", "Freelance"]),
  category:    z.string().min(1, "Category is required"),
  skills:      z.string().optional(),
  description: z.string().min(50, "Job description must be at least 50 characters"),
  expiresAt:   z.string().optional(),
})

export type PostJobFormData = z.infer<typeof postJobSchema>
