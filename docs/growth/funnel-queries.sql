-- Noble Job funnel queries (READ-ONLY).
--
-- VALIDATION STATUS (21 Nov 2026): every query below was executed on a throwaway PostgreSQL 16 with synthetic fixtures
-- (hand-computed expected values matched: e.g. query 3 -> 3 candidates / 1 applied within 7d; query 6 -> 1 repeat employer).
-- NOT yet run against Supabase: column names were taken from src/database/schema.sql (candidates.created_at,
-- employers.created_at, jobs.employer_id/created_at/status, applications.candidate_id/applied_at, analytics_events.*).
--
-- WHAT NEEDS STAGING / DEPLOYED CODE
--   Q1 weekly signups ........ needs only a read connection (production read-only OR staging with seeded data)
--   Q2 registration funnel ... needs feat/funnel-events DEPLOYED and the analytics_events migration applied; returns empty before that
--   Q3 candidate -> 7d apply . read connection; meaningful only with real candidate/application data
--   Q4 employer -> first job . read connection; meaningful only with real data
--   Q5 approval health ....... read connection
--   Q6 repeat employers ...... read connection; needs >= 2 weeks of data
-- Run on STAGING first to confirm the schema matches, then production READ-ONLY (SELECT only). Replace intervals as needed.

-- 1) Visitor -> registration (candidates + employers). Visitors come from Vercel Web Analytics / Search Console;
--    registrations come from the DB (source of truth, independent of client tracking).
select date_trunc('week', created_at) as week, count(*) as new_candidates from public.candidates group by 1 order by 1;
select date_trunc('week', created_at) as week, count(*) as new_employers  from public.employers  group by 1 order by 1;

-- 2) Registration funnel drop-off by role and source (needs feat/funnel-events).
select props->>'role' as role, coalesce(nullif(props->>'src',''),'direct') as src,
       count(distinct session_id) filter (where event='register_viewed')    as viewed,
       count(distinct session_id) filter (where event='register_submitted') as submitted,
       count(distinct session_id) filter (where event='register_verified')  as verified
from public.analytics_events
where event in ('register_viewed','register_submitted','register_verified') and created_at > now() - interval '30 days'
group by 1,2 order by viewed desc;

-- 3) Registration -> first application (candidates), % within 7 days of signup.
select count(*) as candidates,
       count(*) filter (where exists (select 1 from public.applications a where a.candidate_id=c.id
                                     and a.applied_at <= c.created_at + interval '7 days')) as applied_7d
from public.candidates c where c.created_at > now() - interval '90 days';

-- 4) Employer registration -> first job submitted (and time to first job).
select count(*) as employers,
       count(*) filter (where exists (select 1 from public.jobs j where j.employer_id=e.id)) as posted_any,
       percentile_cont(0.5) within group (order by fj.first_job - e.created_at) as median_time_to_first_job
from public.employers e
left join lateral (select min(created_at) as first_job from public.jobs j where j.employer_id=e.id) fj on true
where e.created_at > now() - interval '90 days';

-- 5) Approval health: how many submitted jobs go live, and how long review takes.
select status, count(*) from public.jobs where employer_id is not null group by 1;

-- 6) Repeat employer posting: employers with >=2 jobs in different calendar weeks.
select count(*) as repeat_employers from (
  select employer_id from public.jobs where employer_id is not null
  group by 1 having count(distinct date_trunc('week', created_at)) >= 2) t;
