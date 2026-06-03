import { z } from "zod"

export const alertSubscribeSchema = z.object({
  email:    z.string().email("Please enter a valid email"),
  keywords: z.string().optional(),
  location: z.string().optional(),
  category: z.string().optional(),
  board:    z.enum(["all","private","govt","abroad","wfh"]).default("all"),
  frequency:z.enum(["daily","weekly"]).default("daily"),
})
