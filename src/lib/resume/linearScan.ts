/**
 * linearScan.ts — linear-time replacements for regexes that backtracked quadratically.
 *
 * Every function here makes ONE pass over its input (indexOf calls never rescan the same span),
 * so a hostile 100k-character run of letters, digits, spaces, dots or dashes costs milliseconds.
 * Each one is differentially tested against the original regex on random input
 * (src/lib/resume/resumeRedos.test.ts), so scoring results are unchanged for real resumes.
 *
 * Originals (all quadratic on long runs):
 *   EMAIL_RE  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
 *   PHONE_RE  /(\+?\d[\d\s().-]{7,}\d)/
 *   BULLET_RE /(^|\n)\s*[•\-*▪◦·]/
 *   /<[^>]+>/g, /<w:tab[^>]*\/>/g, /[ \t]+\n/g       (DOCX text extraction)
 */

const WS = /\s/ // JS \s, tested one character at a time (never over a run)
const isWs = (c: string) => WS.test(c)

const isLocalChar = (code: number) =>
  (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
  code === 46 || code === 95 || code === 37 || code === 43 || code === 45 // . _ % + -
const isDomainChar = (code: number) =>
  (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 46 || code === 45
const isLetter = (code: number) => (code >= 65 && code <= 90) || (code >= 97 && code <= 122)

/** Same truth value as /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text). */
export function hasEmail(text: string): boolean {
  let at = text.indexOf("@")
  while (at !== -1) {
    if (at > 0 && isLocalChar(text.charCodeAt(at - 1))) {
      // maximal [a-z0-9.-] run after '@' (it cannot contain '@', so runs of different '@' never overlap)
      let end = at + 1
      while (end < text.length && isDomainChar(text.charCodeAt(end))) end++
      // need a '.' at index k >= at+2 (>=1 domain char before it) followed by >= 2 letters inside the run
      for (let k = at + 2; k + 2 < end; k++) {
        if (text.charCodeAt(k) === 46 && isLetter(text.charCodeAt(k + 1)) && isLetter(text.charCodeAt(k + 2))) return true
      }
    }
    at = text.indexOf("@", at + 1)
  }
  return false
}

/** Same truth value as /(\+?\d[\d\s().-]{7,}\d)/.test(text). */
export function hasPhone(text: string): boolean {
  // Within a maximal run of [\d\s().-] characters, a match exists iff the span from the run's first
  // digit to its last digit is at least 9 characters long (digit + >=7 class chars + digit).
  let first = -1
  let last = -1
  const check = () => first !== -1 && last - first + 1 >= 9
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    const digit = code >= 48 && code <= 57
    const cls = digit || code === 40 || code === 41 || code === 46 || code === 45 || isWs(text[i])
    if (!cls) {
      if (check()) return true
      first = -1
      last = -1
    } else if (digit) {
      if (first === -1) first = i
      last = i
    }
  }
  return check()
}

const BULLETS = new Set(["•", "-", "*", "▪", "◦", "·"])

/** Same truth value as /(^|\n)\s*[•\-*▪◦·]/.test(text). */
export function hasBulletLine(text: string): boolean {
  let ok = true // at start of text, or only whitespace seen since the last '\n' / start
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (BULLETS.has(c)) {
      if (ok) return true
      ok = false
    } else if (isWs(c)) {
      if (c === "\n") ok = true
    } else {
      ok = false
    }
  }
  return false
}

/** Same as xml.replace(/<[^>]+>/g, "") */
export function stripTags(s: string): string {
  let out = ""
  let pos = 0
  for (;;) {
    const lt = s.indexOf("<", pos)
    if (lt === -1) break
    const gt = s.indexOf(">", lt + 1)
    if (gt === -1) break // no '>' anywhere after this '<' => no later tag can match either
    if (gt === lt + 1) { // "<>" : '[^>]+' needs at least one character
      out += s.slice(pos, lt + 1)
      pos = lt + 1
      continue
    }
    out += s.slice(pos, lt)
    pos = gt + 1
  }
  return out + s.slice(pos)
}

/** Same as xml.replace(/<w:tab[^>]*\/>/g, "\t") */
export function replaceTabTags(s: string): string {
  const OPEN = "<w:tab"
  let out = ""
  let pos = 0
  let gt = -2 // cached index of the next '>' (every candidate start before it shares the same one)
  for (;;) {
    const start = s.indexOf(OPEN, pos)
    if (start === -1) break
    const bodyStart = start + OPEN.length
    if (gt < bodyStart) {
      gt = s.indexOf(">", bodyStart)
      if (gt === -1) break
    }
    if (gt - 1 >= bodyStart && s.charCodeAt(gt - 1) === 47) { // "...</>" ends with "/>"
      out += s.slice(pos, start) + "\t"
      pos = gt + 1
    } else {
      out += s.slice(pos, start + 1)
      pos = start + 1
    }
  }
  return out + s.slice(pos)
}

/** Same as text.replace(/[ \t]+\n/g, "\n") */
export function trimLineEnds(text: string): string {
  const lines = text.split("\n")
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]
    let e = line.length
    while (e > 0 && (line.charCodeAt(e - 1) === 32 || line.charCodeAt(e - 1) === 9)) e--
    if (e !== line.length) lines[i] = line.slice(0, e)
  }
  return lines.join("\n")
}
