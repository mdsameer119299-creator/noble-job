-- Admin growth dashboard — metric definitions as READ-ONLY SQL (one row per metric/week). :days = window length.
-- Validated on PostgreSQL 16 with synthetic fixtures only (NOT yet run on Supabase; needs staging for real data).
-- Columns assumed (src/database/schema.sql + migrations): candidates(created_at, category, experience_years, skills, resume_url),
--   employers(created_at), jobs(employer_id, status, created_at), applications(candidate_id, applied_at, admin_review_status).

-- 1) Candidate registrations per week
select date_trunc('week', created_at)::date as week, count(*) as candidate_registrations
from public.candidates where created_at >= now() - make_interval(days => 90) group by 1 order by 1;

-- 2) Completed profiles per week (cohort = signup week): category + experience + >=1 skill all set. "Completion rate" = completed / registrations.
select date_trunc('week', created_at)::date as signup_week, count(*) as registrations,
       count(*) filter (where category is not null and experience_years is not null and coalesce(array_length(skills,1),0) > 0) as completed_profiles,
       round(100.0 * count(*) filter (where category is not null and experience_years is not null and coalesce(array_length(skills,1),0) > 0) / nullif(count(*),0), 1) as completion_pct
from public.candidates where created_at >= now() - make_interval(days => 90) group by 1 order by 1;

-- 3) Applications per week, and distinct applicants (apps are admin-reviewed before employers see them)
select date_trunc('week', applied_at)::date as week, count(*) as applications, count(distinct candidate_id) as distinct_applicants
from public.applications where applied_at >= now() - make_interval(days => 90) group by 1 order by 1;

-- 4) Registration -> first application within 7 days, by signup week
select date_trunc('week', c.created_at)::date as signup_week, count(*) as registrations,
       count(*) filter (where exists (select 1 from public.applications a where a.candidate_id = c.id and a.applied_at <= c.created_at + interval '7 days')) as applied_within_7d
from public.candidates c where c.created_at >= now() - make_interval(days => 90) group by 1 order by 1;

-- 5) Employer registrations per week
select date_trunc('week', created_at)::date as week, count(*) as employer_registrations
from public.employers where created_at >= now() - make_interval(days => 90) group by 1 order by 1;

-- 6) Job posts per week by status; "approved" = status 'active' (manual review gate)
select date_trunc('week', created_at)::date as week, count(*) as submitted, count(*) filter (where status = 'active') as approved,
       count(*) filter (where status = 'rejected') as rejected, count(*) filter (where status = 'pending') as awaiting_review
from public.jobs where employer_id is not null and created_at >= now() - make_interval(days => 90) group by 1 order by 1;

-- 7) Repeat employers: >=2 jobs on different calendar weeks; plus share of all employers that posted at all
select count(*) filter (where weeks >= 2) as repeat_employers, count(*) as employers_with_jobs,
       (select count(*) from public.employers) as all_employers
from (select employer_id, count(distinct date_trunc('week', created_at)) as weeks from public.jobs where employer_id is not null group by 1) t;
