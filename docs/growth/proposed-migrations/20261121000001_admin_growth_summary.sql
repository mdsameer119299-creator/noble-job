-- PROPOSED (not in supabase/migrations; not applied anywhere). Read-only aggregate function for the admin growth dashboard.
-- Additive: one new function, no table/column changes, no writes. Run on STAGING first.
create or replace function public.admin_growth_summary(p_days integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  d integer := least(greatest(coalesce(p_days, 90), 1), 365);
  since timestamptz := now() - make_interval(days => d);
  res jsonb;
begin
  select jsonb_build_object(
    'days', d,
    'candidate_registrations', coalesce((select jsonb_agg(r order by r.week) from (
        select date_trunc('week', created_at)::date as week, count(*) as registrations,
               count(*) filter (where category is not null and experience_years is not null and coalesce(array_length(skills,1),0) > 0) as completed_profiles
        from public.candidates where created_at >= since group by 1) r), '[]'::jsonb),
    'applications', coalesce((select jsonb_agg(r order by r.week) from (
        select date_trunc('week', applied_at)::date as week, count(*) as applications, count(distinct candidate_id) as distinct_applicants
        from public.applications where applied_at >= since group by 1) r), '[]'::jsonb),
    'employer_registrations', coalesce((select jsonb_agg(r order by r.week) from (
        select date_trunc('week', created_at)::date as week, count(*) as registrations
        from public.employers where created_at >= since group by 1) r), '[]'::jsonb),
    'job_posts', coalesce((select jsonb_agg(r order by r.week) from (
        select date_trunc('week', created_at)::date as week, count(*) as submitted,
               count(*) filter (where status = 'active') as approved,
               count(*) filter (where status = 'rejected') as rejected,
               count(*) filter (where status = 'pending') as awaiting_review
        from public.jobs where employer_id is not null and created_at >= since group by 1) r), '[]'::jsonb),
    'repeat_employers', (select jsonb_build_object('repeat_employers', count(*) filter (where weeks >= 2), 'employers_with_jobs', count(*))
        from (select employer_id, count(distinct date_trunc('week', created_at)) as weeks from public.jobs where employer_id is not null group by 1) t)
  ) into res;
  return res;
end $$;

-- Only the server (service_role) may call it; the API route enforces admin auth before calling.
revoke all on function public.admin_growth_summary(integer) from public, anon, authenticated;
grant execute on function public.admin_growth_summary(integer) to service_role;
