-- PROPOSED (not applied anywhere). Additive.
-- Anonymous temp resumes (service-role only) + DB-enforced verified-email rules.

-- 1) Private temp bucket: NO storage policies => only the service role can read/write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resume-temp','resume-temp', false, 4194304,
        array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

-- 2) Metadata + claim table (RLS on, no policy => service-role only).
create table if not exists public.anonymous_resumes (
  id             uuid primary key default gen_random_uuid(),
  claim_hash     text not null unique,        -- HMAC(pepper, 256-bit token); raw token only in the browser cookie
  email_hash     text not null,               -- HMAC(pepper, lower(trim(email))) entered at opt-in; binds the claim to a mailbox
  object_path    text not null unique,        -- random uuid.ext, never from user data
  ext            text not null check (ext in ('pdf','docx')),
  size_bytes     integer not null check (size_bytes > 0 and size_bytes <= 4194304),
  sha256         text not null,
  score          smallint,
  client_hash    text not null,               -- HMAC(ip); no raw IP, no plaintext e-mail anywhere
  bad_claims     smallint not null default 0, -- claim attempts by a non-matching account
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '24 hours',
  claimed_by     uuid references auth.users(id) on delete set null,
  claimed_at     timestamptz,
  revoked_at     timestamptz
);
create index if not exists anonymous_resumes_expiry_idx on public.anonymous_resumes(expires_at) where claimed_by is null;
create index if not exists anonymous_resumes_client_idx on public.anonymous_resumes(client_hash, created_at desc);
alter table public.anonymous_resumes enable row level security;

-- 3) Authoritative verified status = public.users.email_verified (service-role-only writes, migration 20261001000001).
create or replace function public.current_user_email_verified()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select email_verified from public.users where id = auth.uid()), false)
$$;
revoke all on function public.current_user_email_verified() from public, anon;
grant execute on function public.current_user_email_verified() to authenticated, service_role;

-- 4) Applying requires a verified e-mail even if an API check is missed (RESTRICTIVE ANDs with existing policies).
drop policy if exists applications_require_verified_email on public.applications;
create policy applications_require_verified_email on public.applications as restrictive
  for insert to authenticated with check (public.current_user_email_verified());

-- 5) Atomic, single-use, DB-enforced claim. Service role only. Returns the object to copy, or no row.
--    Consumes the token ONLY if: not expired/claimed/revoked, the account is verified, and the account's e-mail hash matches.
create or replace function public.claim_anonymous_resume(p_claim_hash text, p_user_id uuid, p_email_hash text)
returns table(object_path text, ext text, score smallint, sha256 text)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_match boolean;
begin
  if not coalesce((select email_verified from public.users where id = p_user_id), false) then
    return;                                           -- unverified account can never claim
  end if;
  select id, (email_hash = p_email_hash) into v_id, v_match
    from public.anonymous_resumes
   where claim_hash = p_claim_hash and claimed_by is null and revoked_at is null and expires_at > now()
   for update;                                        -- row lock: concurrent claims serialise
  if v_id is null then return; end if;
  if not v_match then                                 -- stolen token + wrong mailbox: do not consume, count, revoke after 5
    update public.anonymous_resumes set bad_claims = bad_claims + 1,
           revoked_at = case when bad_claims + 1 >= 5 then now() end where id = v_id;
    return;
  end if;
  return query
    update public.anonymous_resumes a set claimed_by = p_user_id, claimed_at = now()
     where a.id = v_id and a.claimed_by is null
 returning a.object_path, a.ext, a.score, a.sha256;
end $$;
revoke all on function public.claim_anonymous_resume(text,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_anonymous_resume(text,uuid,text) to service_role;

-- 6) Unverified accounts may not attach a resume to their profile by writing candidates.resume_url directly.
create or replace function public.guard_candidate_resume_url()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.resume_url is distinct from old.resume_url
     and coalesce(auth.role(),'') <> 'service_role'
     and not coalesce((select email_verified from public.users where id = auth.uid()), false) then
    raise exception 'verified e-mail required to change resume' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists candidates_guard_resume_url on public.candidates;
create trigger candidates_guard_resume_url before update on public.candidates
  for each row execute function public.guard_candidate_resume_url();
