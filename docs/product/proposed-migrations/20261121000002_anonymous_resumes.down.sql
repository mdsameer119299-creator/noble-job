drop trigger if exists candidates_guard_resume_url on public.candidates;
drop function if exists public.guard_candidate_resume_url();
drop function if exists public.claim_anonymous_resume(text,uuid,text);
drop policy if exists applications_require_verified_email on public.applications;
drop function if exists public.current_user_email_verified();
drop table if exists public.anonymous_resumes;
-- bucket: empty via Storage API first, then:
delete from storage.buckets where id = 'resume-temp';
