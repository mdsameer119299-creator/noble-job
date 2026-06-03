/**
 * Premium category mini-scenes — unique identity per category.
 * Transparent canvas, soft shadow, no shared blue-square frame.
 * Run: node scripts/generate-category-illustrations.mjs
 */
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, "..", "public", "images", "categories")
mkdirSync(outDir, { recursive: true })

const NAVY = "#0d1f4e"
const ROYAL = "#1847d4"
const ROYAL_MID = "#2563eb"
const SKY = "#93c5fd"
const GOLD = "#d4a853"
const GOLD_LIGHT = "#f5d78e"
const WHITE = "#ffffff"
const TEAL = "#0d9488"
const ROSE = "#e11d48"
const AMBER = "#f59e0b"
const SLATE = "#64748b"
const GREEN = "#059669"
const INDIGO = "#4f46e5"

function scene(id, glow, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="glow-${id}" x1="20%" y1="0%" x2="80%" y2="100%">${glow}</linearGradient>
    <filter id="sh-${id}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="${NAVY}" flood-opacity="0.22"/>
    </filter>
    <filter id="sh2-${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="${NAVY}" flood-opacity="0.15"/>
    </filter>
  </defs>
  <ellipse cx="60" cy="108" rx="42" ry="7" fill="${NAVY}" opacity="0.1"/>
  ${body}
</svg>`
}

const scenes = {
  "it-software": scene(
    "it",
    `<stop offset="0%" stop-color="${SKY}" stop-opacity="0.55"/><stop offset="100%" stop-color="${ROYAL_MID}" stop-opacity="0.08"/>`,
    `<ellipse cx="62" cy="52" rx="46" ry="40" fill="url(#glow-it)"/>
    <g filter="url(#sh-it)">
      <path d="M28 78 L52 66 L88 66 L92 78 Z" fill="${SLATE}" opacity="0.35"/>
      <rect x="34" y="48" width="52" height="34" rx="4" fill="${NAVY}"/>
      <rect x="38" y="52" width="44" height="24" rx="2" fill="${SKY}" opacity="0.95"/>
      <path d="M42 58h32M42 64h24M42 70h28" stroke="${ROYAL}" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
      <rect x="48" y="82" width="24" height="4" rx="2" fill="${SLATE}"/>
      <rect x="78" y="70" width="14" height="10" rx="2" fill="${GREEN}" opacity="0.85"/>
      <circle cx="85" cy="66" r="5" fill="${GOLD}"/>
      <rect x="24" y="58" width="10" height="18" rx="3" fill="${ROYAL_MID}"/>
    </g>`,
  ),

  banking: scene(
    "bank",
    `<stop offset="0%" stop-color="${GOLD_LIGHT}" stop-opacity="0.5"/><stop offset="100%" stop-color="${ROYAL}" stop-opacity="0.05"/>`,
    `<ellipse cx="58" cy="50" rx="44" ry="38" fill="url(#glow-bank)"/>
    <g filter="url(#sh-bank)">
      <path d="M24 72h72" stroke="${GOLD}" stroke-width="4" stroke-linecap="round"/>
      <path d="M30 72V46 L60 28 L90 46V72" fill="${WHITE}" stroke="${NAVY}" stroke-width="2.2"/>
      <path d="M30 72H90" fill="${ROYAL}" opacity="0.15"/>
      <rect x="38" y="58" width="10" height="14" rx="1" fill="${ROYAL_MID}"/>
      <rect x="52" y="52" width="10" height="20" rx="1" fill="${ROYAL}"/>
      <rect x="66" y="60" width="10" height="12" rx="1" fill="${ROYAL_MID}" opacity="0.8"/>
      <circle cx="60" cy="38" r="6" fill="${GOLD}"/>
      <rect x="72" y="34" width="18" height="12" rx="3" fill="${WHITE}" opacity="0.9" stroke="${GOLD}" stroke-width="1.5"/>
      <text x="76" y="43" font-size="8" font-weight="700" fill="${NAVY}">₹</text>
    </g>`,
  ),

  teaching: scene(
    "teach",
    `<stop offset="0%" stop-color="${AMBER}" stop-opacity="0.45"/><stop offset="100%" stop-color="${INDIGO}" stop-opacity="0.06"/>`,
    `<ellipse cx="60" cy="48" rx="48" ry="42" fill="url(#glow-teach)"/>
    <g filter="url(#sh-teach)">
      <rect x="52" y="32" width="36" height="26" rx="3" fill="${NAVY}"/>
      <rect x="56" y="36" width="28" height="18" rx="2" fill="${SKY}" opacity="0.95"/>
      <path d="M60 40h20M60 46h14M60 52h18" stroke="${WHITE}" stroke-width="1.8" stroke-linecap="round"/>
      <rect x="48" y="58" width="44" height="6" rx="2" fill="${SLATE}" opacity="0.4"/>
      <circle cx="38" cy="54" r="10" fill="${AMBER}"/>
      <path d="M34 54h8M38 50v8" stroke="${WHITE}" stroke-width="2" stroke-linecap="round"/>
      <rect x="30" y="64" width="16" height="22" rx="8" fill="${INDIGO}"/>
      <rect x="28" y="72" width="20" height="14" rx="6" fill="${ROYAL_MID}"/>
      <path d="M26 48 L38 42 L38 56 Z" fill="${GOLD}" opacity="0.9"/>
    </g>`,
  ),

  engineering: scene(
    "eng",
    `<stop offset="0%" stop-color="${TEAL}" stop-opacity="0.4"/><stop offset="100%" stop-color="${NAVY}" stop-opacity="0.08"/>`,
    `<ellipse cx="62" cy="50" rx="46" ry="40" fill="url(#glow-eng)"/>
    <g filter="url(#sh-eng)">
      <rect x="58" y="70" width="28" height="8" rx="2" fill="${AMBER}" opacity="0.9"/>
      <path d="M44 70 L58 58 L72 70 Z" fill="${WHITE}" stroke="${NAVY}" stroke-width="1.5"/>
      <circle cx="58" cy="52" r="11" fill="${AMBER}"/>
      <rect x="52" y="48" width="12" height="8" rx="2" fill="${NAVY}" opacity="0.3"/>
      <rect x="72" y="44" width="24" height="32" rx="2" fill="${WHITE}" stroke="${TEAL}" stroke-width="2" transform="rotate(-8 84 60)"/>
      <path d="M76 52 L88 48 L90 68 L74 72 Z" fill="${SKY}" opacity="0.35"/>
      <path d="M78 56h10M78 62h8M78 68h12" stroke="${ROYAL}" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="34" y="78" width="18" height="5" rx="2" fill="${SLATE}" opacity="0.5"/>
    </g>`,
  ),

  healthcare: scene(
    "health",
    `<stop offset="0%" stop-color="${ROSE}" stop-opacity="0.35"/><stop offset="100%" stop-color="${SKY}" stop-opacity="0.1"/>`,
    `<ellipse cx="58" cy="50" rx="44" ry="40" fill="url(#glow-health)"/>
    <g filter="url(#sh-health)">
      <rect x="64" y="38" width="32" height="40" rx="4" fill="${WHITE}" stroke="${ROYAL_MID}" stroke-width="2"/>
      <path d="M70 58h20M70 64h14" stroke="${SKY}" stroke-width="2" stroke-linecap="round"/>
      <rect x="70" y="44" width="16" height="8" rx="2" fill="${ROSE}" opacity="0.25"/>
      <path d="M74 48h8M78 44v8" stroke="${ROSE}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="42" cy="50" r="12" fill="${WHITE}" stroke="${ROYAL}" stroke-width="2"/>
      <rect x="34" y="62" width="16" height="20" rx="6" fill="${ROYAL_MID}"/>
      <path d="M38 50h8M42 46v8" stroke="${ROSE}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="42" cy="42" r="8" fill="${WHITE}"/>
    </g>`,
  ),

  "sales-marketing": scene(
    "sales",
    `<stop offset="0%" stop-color="${GREEN}" stop-opacity="0.4"/><stop offset="100%" stop-color="${ROYAL}" stop-opacity="0.06"/>`,
    `<ellipse cx="60" cy="48" rx="48" ry="42" fill="url(#glow-sales)"/>
    <g filter="url(#sh-sales)">
      <rect x="32" y="44" width="56" height="36" rx="4" fill="${NAVY}"/>
      <rect x="36" y="48" width="48" height="26" rx="2" fill="${WHITE}" opacity="0.95"/>
      <rect x="42" y="62" width="8" height="10" fill="${ROYAL_MID}"/><rect x="54" y="56" width="8" height="16" fill="${ROYAL}"/>
      <rect x="66" y="52" width="8" height="20" fill="${GREEN}"/>
      <path d="M42 54 L54 58 L66 50 L74 46" stroke="${GREEN}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="74" cy="46" r="4" fill="${GOLD}"/>
      <path d="M78 38 L90 32 L92 44 Z" fill="${GOLD}" opacity="0.95"/>
      <rect x="78" y="78" width="20" height="4" rx="2" fill="${SLATE}" opacity="0.35"/>
    </g>`,
  ),

  "government-jobs": scene(
    "govt",
    `<stop offset="0%" stop-color="${GOLD_LIGHT}" stop-opacity="0.45"/><stop offset="100%" stop-color="${NAVY}" stop-opacity="0.1"/>`,
    `<ellipse cx="60" cy="48" rx="50" ry="44" fill="url(#glow-govt)"/>
    <g filter="url(#sh-govt)">
      <rect x="28" y="68" width="64" height="10" rx="2" fill="${SLATE}" opacity="0.25"/>
      <path d="M36 68V52c0-12 24-20 24-20s24 8 24 20v16" fill="${WHITE}" stroke="${NAVY}" stroke-width="2"/>
      <path d="M48 68V56h24v12" fill="${ROYAL}" opacity="0.2"/>
      <circle cx="60" cy="40" r="14" fill="${ROYAL_MID}"/>
      <rect x="46" y="52" width="28" height="6" rx="1" fill="${GOLD}"/>
      <path d="M54 36h12v8h-12z" fill="${GOLD}" opacity="0.85"/>
      <rect x="22" y="72" width="8" height="14" fill="${NAVY}" opacity="0.5"/>
      <rect x="90" y="72" width="8" height="14" fill="${NAVY}" opacity="0.5"/>
      <path d="M32 44h6v6h-6zM82 44h6v6h-6z" fill="${GOLD}" opacity="0.7"/>
    </g>`,
  ),

  "work-from-home": scene(
    "wfh",
    `<stop offset="0%" stop-color="${TEAL}" stop-opacity="0.35"/><stop offset="100%" stop-color="${AMBER}" stop-opacity="0.12"/>`,
    `<ellipse cx="58" cy="50" rx="46" ry="40" fill="url(#glow-wfh)"/>
    <g filter="url(#sh-wfh)">
      <rect x="68" y="30" width="28" height="22" rx="3" fill="${SKY}" opacity="0.5" stroke="${WHITE}" stroke-width="2"/>
      <path d="M72 52 Q82 44 92 52" stroke="${AMBER}" stroke-width="2" fill="none"/>
      <rect x="26" y="52" width="48" height="32" rx="3" fill="${WHITE}" stroke="${NAVY}" stroke-width="1.8"/>
      <rect x="30" y="56" width="40" height="20" rx="2" fill="${ROYAL}" opacity="0.2"/>
      <circle cx="72" cy="62" r="9" fill="${AMBER}"/>
      <rect x="64" y="72" width="16" height="14" rx="5" fill="${INDIGO}"/>
      <rect x="30" y="84" width="20" height="5" rx="2" fill="${SLATE}" opacity="0.4"/>
      <path d="M38 48h8v6h-8z" fill="${GREEN}" opacity="0.8"/>
    </g>`,
  ),

  defence: scene(
    "def",
    `<stop offset="0%" stop-color="${GOLD}" stop-opacity="0.4"/><stop offset="100%" stop-color="${NAVY}" stop-opacity="0.12"/>`,
    `<ellipse cx="60" cy="50" rx="44" ry="40" fill="url(#glow-def)"/>
    <g filter="url(#sh-def)">
      <path d="M60 28 L88 40 V64 C88 78 60 92 60 92 S32 78 32 64 V40 Z" fill="${NAVY}" stroke="${GOLD}" stroke-width="2.5"/>
      <path d="M60 44 L72 68 H48 Z" fill="${GOLD}" opacity="0.9"/>
      <circle cx="60" cy="52" r="10" fill="${ROYAL_MID}" stroke="${WHITE}" stroke-width="2"/>
      <path d="M56 52h8M60 48v8" stroke="${WHITE}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="60" cy="52" r="4" fill="${GOLD}"/>
      <rect x="44" y="78" width="32" height="14" rx="4" fill="${WHITE}" stroke="${GOLD}" stroke-width="2"/>
      <path d="M52 86h16" stroke="${NAVY}" stroke-width="2" stroke-linecap="round"/>
    </g>`,
  ),

  railway: scene(
    "rail",
    `<stop offset="0%" stop-color="${ROYAL_MID}" stop-opacity="0.45"/><stop offset="100%" stop-color="${TEAL}" stop-opacity="0.08"/>`,
    `<ellipse cx="60" cy="50" rx="48" ry="42" fill="url(#glow-rail)"/>
    <g filter="url(#sh-rail)">
      <rect x="18" y="70" width="84" height="6" rx="2" fill="${SLATE}" opacity="0.3"/>
      <rect x="24" y="52" width="72" height="24" rx="10" fill="${ROYAL}"/>
      <rect x="28" y="44" width="64" height="16" rx="8" fill="${ROYAL_MID}"/>
      <rect x="36" y="48" width="20" height="8" rx="2" fill="${SKY}" opacity="0.8"/>
      <rect x="64" y="48" width="20" height="8" rx="2" fill="${SKY}" opacity="0.8"/>
      <circle cx="34" cy="78" r="7" fill="${NAVY}"/><circle cx="86" cy="78" r="7" fill="${NAVY}"/>
      <circle cx="34" cy="78" r="3" fill="${SLATE}"/><circle cx="86" cy="78" r="3" fill="${SLATE}"/>
      <rect x="48" y="38" width="24" height="8" rx="3" fill="${GOLD}"/>
      <path d="M20 58h8M92 58h8" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>
    </g>`,
  ),

  aviation: scene(
    "air",
    `<stop offset="0%" stop-color="${SKY}" stop-opacity="0.55"/><stop offset="100%" stop-color="${INDIGO}" stop-opacity="0.06"/>`,
    `<ellipse cx="62" cy="48" rx="50" ry="44" fill="url(#glow-air)"/>
    <g filter="url(#sh-air)">
      <path d="M18 58 Q40 42 60 50 Q80 58 102 52 L98 62 Q70 68 60 64 Q50 68 22 62 Z" fill="${SKY}" opacity="0.35"/>
      <path d="M28 62 L60 38 L92 62 L80 66 H40 Z" fill="${WHITE}" stroke="${NAVY}" stroke-width="2"/>
      <path d="M44 62 L60 48 L76 62" fill="${ROYAL_MID}" opacity="0.85"/>
      <circle cx="60" cy="54" r="5" fill="${GOLD}"/>
      <rect x="52" y="66" width="16" height="4" rx="2" fill="${SLATE}" opacity="0.5"/>
      <path d="M22 54h10M88 50h10" stroke="${ROYAL}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    </g>`,
  ),

  hospitality: scene(
    "hotel",
    `<stop offset="0%" stop-color="${AMBER}" stop-opacity="0.4"/><stop offset="100%" stop-color="${ROSE}" stop-opacity="0.08"/>`,
    `<ellipse cx="58" cy="50" rx="46" ry="40" fill="url(#glow-hotel)"/>
    <g filter="url(#sh-hotel)">
      <rect x="38" y="68" width="44" height="14" rx="3" fill="${NAVY}" opacity="0.15"/>
      <rect x="44" y="36" width="32" height="36" rx="4" fill="${WHITE}" stroke="${GOLD}" stroke-width="2"/>
      <path d="M52 48c0-4 16-4 16 0v14H52V48z" fill="${ROYAL}" opacity="0.12"/>
      <circle cx="60" cy="44" r="8" fill="${AMBER}"/>
      <rect x="54" y="40" width="12" height="6" rx="2" fill="${GOLD}"/>
      <path d="M72 52h14v8H72z" fill="${GOLD}" opacity="0.95"/>
      <circle cx="79" cy="50" r="4" fill="${NAVY}"/>
      <rect x="76" y="54" width="6" height="4" rx="1" fill="${GOLD_LIGHT}"/>
      <rect x="28" y="58" width="12" height="20" rx="4" fill="${INDIGO}"/>
      <rect x="30" y="64" width="8" height="10" rx="2" fill="${WHITE}" opacity="0.9"/>
    </g>`,
  ),
}

for (const [slug, svg] of Object.entries(scenes)) {
  writeFileSync(join(outDir, `${slug}.svg`), svg, "utf8")
  console.log("wrote", slug)
}

console.log("Done:", Object.keys(scenes).length, "unique scenes")
