/**
 * abroadView.ts — the Abroad listing's URL-driven VIEW (search, country, category, status, page) as ONE
 * pure value, shared by the server page and the client panel.
 *
 * Why. The server page used to ignore `?country=` / `?category=` / `?q=` / `?status=`: it always rendered the
 * UNFILTERED first page ("190 international jobs") and the client panel only noticed the filter in an
 * effect after hydration — so a deep link such as `/jobs/abroad?country=UAE` briefly showed the
 * unfiltered total and list before settling on the filtered one. Now the server reads the same URL
 * parameters, renders exactly that view, and tells the client which view it rendered; the client skips
 * its first fetch only when its own URL view equals the rendered one. Filter changes and page
 * navigation still refetch as before.
 *
 * Pure: no server / Next imports (unit-testable, usable from client and server).
 */

export interface AbroadView {
  q: string
  country: string
  category: string
  /** "all" or a job-status tab id; mirrors the panel's `status` param default. */
  status: string
  /** 1-based, always a finite integer >= 1. */
  page: number
}

type Bag = Record<string, string | string[] | undefined>
type Getter = (key: string) => string | null | undefined

const firstOf = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)

/** A `?page=` value → a finite integer >= 1 ("abc", "0", "-3", "2.7" → 1, 1, 1, 2). */
export function normalisePage(raw: unknown): number {
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) && n >= 1 ? n : 1
}

/** The view for any parameter source (server `searchParams` object or client `URLSearchParams`). */
function viewFrom(get: Getter): AbroadView {
  return {
    q: get("q") || "",
    country: get("country") || "",
    category: get("category") || "",
    status: get("status") || "all",
    page: normalisePage(get("page")),
  }
}

/** Server: Next `searchParams` (values may be arrays) → view. */
export function abroadViewFromSearchParams(sp: Bag | undefined): AbroadView {
  return viewFrom(key => firstOf(sp?.[key]))
}

/** Client: `useSearchParams()` / `URLSearchParams` → view. */
export function abroadViewFromParams(params: { get(key: string): string | null }): AbroadView {
  return viewFrom(key => params.get(key))
}

export function sameAbroadView(a: AbroadView | undefined, b: AbroadView | undefined): boolean {
  return !!a && !!b && a.q === b.q && a.country === b.country && a.category === b.category && a.status === b.status && a.page === b.page
}

/** The query the list API / service is called with for a view (status "all" is the absence of a status filter). */
export function abroadQueryFor(view: AbroadView): { q: string; country: string; category: string; status?: string; page: number } {
  return { q: view.q, country: view.country, category: view.category, ...(view.status && view.status !== "all" ? { status: view.status } : {}), page: view.page }
}
