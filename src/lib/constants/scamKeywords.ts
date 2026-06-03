/**
 * scamKeywords.ts
 *
 * Anti-scam keyword blacklist — ported from the original JS SCAM_KEYWORDS array.
 * Used server-side in scamFilter.ts before any job is stored or displayed.
 * 40 terms covering all common Indian job scam patterns.
 */

export const SCAM_KEYWORDS: readonly string[] = [
  'earn daily', 'per day earn', 'easy money', 'no experience needed high salary',
  'work 2 hours', 'data entry 50000', 'whatsapp job', 'telegram job',
  'registration fee', 'training fee', 'pay to join', 'deposit required',
  'lottery winner', 'mlm', 'network marketing', 'direct selling',
  'part time 1 lakh', '₹50000 per day', 'home packing', 'envelope stuffing',
  'work from home 50000', 'earn 10000 per day', 'no investment high return',
  'guaranteed income', 'part time easy income', 'google data entry',
  'ad posting', 'form filling', 'captcha entry', 'typing job',
  'copy paste job', 'online survey', 'reseller scheme', 'chain marketing',
  'binary income', 'downline', 'joining fee', 'security deposit', 'advance payment',
] as const

/** Returns true if a job description/title contains a scam keyword */
export function containsScamKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  return SCAM_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()))
}
