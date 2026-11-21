# Admin growth dashboard — plan

Status: PLAN ONLY (no code merged). Metric SQL: `admin-dashboard-queries.sql` (validated on PostgreSQL 16 with synthetic data; not yet on Supabase).

## What it shows (one screen, weekly buckets, 90-day default, 30/90/180 toggle)
| Card | Definition | Source |
|---|---|---|
| Candidate registrations | new rows in `candidates` per week | DB |
| Completed profiles | category + experience + ≥1 skill set; shown as count AND % of that signup-week cohort | DB (`candidates`) |
| Applications | rows in `applications` per week + distinct applicants; split pending-review vs approved (`admin_review_status`) | DB |
| Registration → application ≤7d | cohort by signup week | DB |
| Employer registrations | new rows in `employers` per week | DB |
| Approved job posts | jobs with `status='active'` per week, plus submitted / awaiting review / rejected, and median review time | DB (`jobs`) |
| Repeat employers | employers with jobs in ≥2 different weeks; share of all employers | DB |
| Registration funnel (viewed → submitted → verified), by `src` | distinct sessions | `analytics_events` (needs #61 deployed + migration applied) |

All numbers come from the database (source of truth) except the funnel, which is client-event based and will undercount (ad blockers) — label it "tracked sessions".

## Design
- **Route**: `/admin/growth`, behind the existing admin guard (`verifyAdminApi` for the API, admin layout for the page). No public access.
- **API**: `GET /api/admin/growth?days=90` → one RPC call returning JSON. Aggregates only; no names, emails or phone numbers leave the DB.
- **DB**: one additive migration adding `admin_growth_summary(days int)` (`SECURITY DEFINER`, `STABLE`, `search_path` pinned, `EXECUTE` revoked from `anon`/`authenticated`, granted to `service_role`). Rollback = `DROP FUNCTION`. No table changes, no writes.
- **Caching**: `revalidate` 300 s (dashboard, not real time). Cost: 7 small aggregate queries on indexed columns; add `jobs(created_at)` / `applications(applied_at)` indexes only if the staging EXPLAIN shows scans.
- **UI**: stat tiles (this week vs previous week, with arrows) + weekly bar/line charts; mobile-first single column; empty-state copy when staging has no data ("No data yet" instead of 0%).
- **Alerts (phase 2)**: highlight cards red when awaiting-review jobs > N or oldest pending job > 48 h, since manual approval is the employer bottleneck.

## Acceptance tests
1. Function returns exactly the fixture-derived numbers (the Postgres 16 fixture used here becomes a CI test via `pg_ctl` or Supabase local).
2. Non-admin / anon → 401/403 on the API and no data in the page HTML.
3. Response contains no PII keys (assert on keys).
4. Empty database → all zeros, no division errors (`nullif` already used).

## Needs staging Supabase
Everything above that touches real data: the RPC, RLS/permission check (anon cannot execute), real query timings, funnel events. Until then the plan and SQL are the deliverable.

## Build order (each a separate PR)
1. Migration + RPC + SQL fixture test → 2. API route + auth test → 3. Page + tiles → 4. Funnel card (after #61) → 5. Alerts.
