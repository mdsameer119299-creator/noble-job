import { z } from "zod"

export const personalInfoSchema = z.object({
  firstName:       z.string().min(2),
  lastName:        z.string().min(2),
  phone:           z.string().optional(),
  city:            z.string().optional(),
  experienceYears: z.number().min(0).max(50).optional(),
  category:        z.string().optional(),
  expectedSalary:  z.number().optional(),
})

export const workExperienceSchema = z.object({
  company:     z.string().min(2),
  role:        z.string().min(2),
  startDate:   z.string(),
  endDate:     z.string().optional(),
  isCurrent:   z.boolean().default(false),
  description: z.string().optional(),
})

export const educationSchema = z.object({
  institution: z.string().min(2),
  degree:      z.string().min(2),
  field:       z.string().min(2),
  yearFrom:    z.number().optional(),
  yearTo:      z.number().optional(),
})

export const skillsSchema = z.object({
  skills: z.array(z.string()).min(1, "Add at least 1 skill"),
})
