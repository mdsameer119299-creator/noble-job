drop policy if exists applications_require_verified_email on public.applications;
drop function if exists public.current_user_email_verified();
drop table if exists public.anonymous_resumes;
-- bucket: empty it via the Storage API first, then:
delete from storage.buckets where id = 'resume-temp';
