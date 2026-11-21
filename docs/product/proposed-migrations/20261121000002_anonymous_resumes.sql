-- PROPOSED (not applied anywhere). Additive. Temporary private storage for anonymous resumes + verified-email gate on applications.

-- 1) Private temp bucket: NO storage policies at all => only the service role can read/write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resume-temp','resume-temp', false, 4194304,
        array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

-- 2) Metadata + claim table (service-role only: RLS on, no policy).
create table if not exists public.anonymous_resumes (
  id             uuid primary key default gen_random_uuid(),
  claim_hash     text not null unique,                 -- HMAC(pepper, claim token); the raw token only ever lives in the browser cookie
  object_path    text not null unique,                 -- resume-temp/<random uuid>.<ext>, never derived from user data
  ext            text not null check (ext in ('pdf','docx')),
  size_bytes     integer not null check (size_bytes > 0 and size_bytes <= 4194304),
  sha256         text not null,
  score          smallint,                             -- optional: lets the dashboard show the same score after claim
  client_hash    text not null,                        -- HMAC(ip) (same privacy approach as distributedRateLimit); no raw IP
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '24 hours',
  claimed_by     uuid references auth.users(id) on delete set null,
  claimed_at     timestamptz
);
create index if not exists anonymous_resumes_expiry_idx on public.anonymous_resumes(expires_at) where claimed_by is null;
create index if not exists anonymous_resumes_client_idx on public.anonymous_resumes(client_hash, created_at desc);
alter table public.anonymous_resumes enable row level security;   -- no policy: service-role only

-- 3) Verified e-mail as the app-level truth (users.email_verified already exists; only the service role may change it — migration 20261001000001).
create or replace function public.current_user_email_verified()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select email_verified from public.users where id = auth.uid()), false)
$$;
revoke all on function public.current_user_email_verified() from public, anon;
grant execute on function public.current_user_email_verified() to authenticated, service_role;

-- 4) Defence in depth: a RESTRICTIVE policy ANDs with the existing permissive ones; unverified users cannot create applications even if an API check is missed.
drop policy if exists applications_require_verified_email on public.applications;
create policy applications_require_verified_email on public.applications as restrictive
  for insert to authenticated with check (public.current_user_email_verified());
