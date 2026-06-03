/** Premium card & hero accents per govt browse slug (no emojis). */
export interface GovtCategoryTheme {
  gradient: string
  accent: string
  iconStroke: string
  iconBg: string
}

export const GOVT_CATEGORY_THEME: Record<string, GovtCategoryTheme> = {
  "latest-notifications": {
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
    accent: "#60a5fa",
    iconStroke: "#2563eb",
    iconBg: "rgba(37,99,235,.1)",
  },
  "all-india": {
    gradient: "linear-gradient(135deg, #0d1f4e 0%, #1e40af 55%, #312e81 100%)",
    accent: "#fbbf24",
    iconStroke: "#1e40af",
    iconBg: "rgba(251,191,36,.12)",
  },
  "state-govt": {
    gradient: "linear-gradient(135deg, #0e7490 0%, #0369a1 100%)",
    accent: "#67e8f9",
    iconStroke: "#0e7490",
    iconBg: "rgba(14,116,144,.1)",
  },
  banking: {
    gradient: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
    accent: "#86efac",
    iconStroke: "#166534",
    iconBg: "rgba(22,101,52,.1)",
  },
  railway: {
    gradient: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)",
    accent: "#93c5fd",
    iconStroke: "#1d4ed8",
    iconBg: "rgba(29,78,216,.1)",
  },
  ssc: {
    gradient: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)",
    accent: "#a5b4fc",
    iconStroke: "#4338ca",
    iconBg: "rgba(67,56,202,.1)",
  },
  upsc: {
    gradient: "linear-gradient(135deg, #7c2d12 0%, #b45309 100%)",
    accent: "#fcd34d",
    iconStroke: "#b45309",
    iconBg: "rgba(180,83,9,.1)",
  },
  defence: {
    gradient: "linear-gradient(135deg, #14532d 0%, #1c1917 100%)",
    accent: "#4ade80",
    iconStroke: "#166534",
    iconBg: "rgba(22,101,52,.1)",
  },
  police: {
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
    accent: "#60a5fa",
    iconStroke: "#1e40af",
    iconBg: "rgba(30,64,175,.1)",
  },
  teaching: {
    gradient: "linear-gradient(135deg, #9d174d 0%, #be185d 100%)",
    accent: "#f9a8d4",
    iconStroke: "#be185d",
    iconBg: "rgba(190,24,93,.1)",
  },
  psu: {
    gradient: "linear-gradient(135deg, #374151 0%, #4b5563 100%)",
    accent: "#d1d5db",
    iconStroke: "#4b5563",
    iconBg: "rgba(75,85,99,.1)",
  },
  engineering: {
    gradient: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
    accent: "#5eead4",
    iconStroke: "#0d9488",
    iconBg: "rgba(13,148,136,.1)",
  },
  "admit-cards": {
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #1847d4 100%)",
    accent: "#93c5fd",
    iconStroke: "#1847d4",
    iconBg: "rgba(24,71,212,.1)",
  },
  results: {
    gradient: "linear-gradient(135deg, #065f46 0%, #059669 100%)",
    accent: "#6ee7b7",
    iconStroke: "#059669",
    iconBg: "rgba(5,150,105,.1)",
  },
  "answer-keys": {
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)",
    accent: "#7dd3fc",
    iconStroke: "#0369a1",
    iconBg: "rgba(3,105,161,.1)",
  },
  syllabus: {
    gradient: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)",
    accent: "#c4b5fd",
    iconStroke: "#6d28d9",
    iconBg: "rgba(109,40,217,.1)",
  },
  "previous-papers": {
    gradient: "linear-gradient(135deg, #334155 0%, #475569 100%)",
    accent: "#cbd5e1",
    iconStroke: "#475569",
    iconBg: "rgba(71,85,105,.1)",
  },
  "8th-pass": {
    gradient: "linear-gradient(135deg, #0e7490 0%, #0891b2 100%)",
    accent: "#67e8f9",
    iconStroke: "#0891b2",
    iconBg: "rgba(8,145,178,.12)",
  },
  "10th-pass": {
    gradient: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
    accent: "#93c5fd",
    iconStroke: "#3b82f6",
    iconBg: "rgba(59,130,246,.1)",
  },
  "12th-pass": {
    gradient: "linear-gradient(135deg, #4338ca 0%, #6366f1 100%)",
    accent: "#a5b4fc",
    iconStroke: "#6366f1",
    iconBg: "rgba(99,102,241,.1)",
  },
  iti: {
    gradient: "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
    accent: "#fcd34d",
    iconStroke: "#d97706",
    iconBg: "rgba(217,119,6,.12)",
  },
  diploma: {
    gradient: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
    accent: "#5eead4",
    iconStroke: "#14b8a6",
    iconBg: "rgba(20,184,166,.12)",
  },
  graduate: {
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
    accent: "#60a5fa",
    iconStroke: "#2563eb",
    iconBg: "rgba(37,99,235,.1)",
  },
  "post-graduate": {
    gradient: "linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)",
    accent: "#c4b5fd",
    iconStroke: "#7c3aed",
    iconBg: "rgba(124,58,237,.1)",
  },
  "b-tech": {
    gradient: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
    accent: "#5eead4",
    iconStroke: "#0d9488",
    iconBg: "rgba(13,148,136,.1)",
  },
  mba: {
    gradient: "linear-gradient(135deg, #9d174d 0%, #db2777 100%)",
    accent: "#f9a8d4",
    iconStroke: "#db2777",
    iconBg: "rgba(219,39,119,.1)",
  },
  mca: {
    gradient: "linear-gradient(135deg, #312e81 0%, #4f46e5 100%)",
    accent: "#a5b4fc",
    iconStroke: "#4f46e5",
    iconBg: "rgba(79,70,229,.1)",
  },
}

export function getGovtCategoryTheme(slug: string): GovtCategoryTheme {
  return GOVT_CATEGORY_THEME[slug] ?? GOVT_CATEGORY_THEME["latest-notifications"]
}
