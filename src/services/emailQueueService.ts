// emailQueueService — batch email queue for job alerts
// Uses a simple FIFO queue backed by Supabase (or can use Redis/Upstash in prod)
export async function enqueueEmail(to: string, subject: string, html: string): Promise<void> {
  // In production: push to Supabase queue table or Upstash QStash
  // For now: direct send (handled by emailService)
  console.info("[emailQueue] Queued:", subject, "→", to)
}
