-- ============================================================================
-- Module 1 · Accounts and roles
--
-- Who is who. Every sign-in (mobile number or the admin email) gets a profile.
-- profiles.roles lists what a person may do:
--   patient  everyone
--   doctor   added when admin approves the doctor application   (module 4)
--   vendor   added when the person links a device                (module 5)
--   admin    only the email accounts in admin_emails; never a mobile number
-- Admin also needs the authenticator app; is_admin() checks both.
--
-- Run order: this file first, then 2-admin, 3-patients, 4-doctors, 5-devices.
-- Safe to run again: paste the whole file into Supabase → SQL Editor → Run.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- Types -------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role' and typnamespace = 'public'::regnamespace) then
    execute 'create type public.app_role as enum (''patient'', ''doctor'', ''vendor'', ''admin'')';
  end if;
end $$;

-- ---------- Profiles (one per sign-in) ----------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.app_role not null default 'patient',   -- main role, kept in sync with roles
  full_name   text check (char_length(full_name) between 2 and 120),
  phone       text unique,
  created_at  timestamptz not null default now(),
  roles       public.app_role[] not null default '{patient}'
);
alter table public.profiles add column if not exists roles public.app_role[] not null default '{patient}';

-- Create a profile automatically when someone signs up with phone OTP.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Supabase stores phone without '+'; keep E.164 (+91…) in profiles.
  insert into public.profiles (id, phone)
  values (new.id, case when new.phone is null or new.phone = '' then null
                       when left(new.phone, 1) = '+' then new.phone else '+' || new.phone end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Who may be admin --------------------------------------------------
-- The only accounts that may be admin: Supabase users signed up with one of these emails.
create table if not exists public.admin_emails (email text primary key check (email = lower(btrim(email))));
alter table public.admin_emails enable row level security;   -- no policies: not readable from the website
insert into public.admin_emails (email) values ('medvendors01@gmail.com') on conflict do nothing;

create or replace function public.is_admin_email(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u join public.admin_emails a on a.email = lower(u.email) where u.id = p_user)
$$;
revoke execute on function public.is_admin_email(uuid) from public, anon, authenticated;

-- Keep roles tidy (always includes patient, no duplicates) and role = the main one.
-- Admin is removed from any account whose email is not in admin_emails (so never a mobile number).
create or replace function public.sync_profile_roles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Someone set `role` directly (e.g. the old README admin step): add it to the list.
  if tg_op = 'UPDATE' and new.role is distinct from old.role and not (new.role = any (coalesce(new.roles, '{}'))) then
    new.roles := array_append(new.roles, new.role);
  end if;
  if 'admin' = any (coalesce(new.roles, '{}')) and not public.is_admin_email(new.id) then
    new.roles := array_remove(new.roles, 'admin');
  end if;
  new.roles := coalesce(new.roles, '{}') || '{patient}'::public.app_role[];
  select array_agg(distinct r order by r) into new.roles from unnest(new.roles) as r;
  new.role := case
    when 'admin'  = any (new.roles) then 'admin'
    when 'doctor' = any (new.roles) then 'doctor'
    when 'vendor' = any (new.roles) then 'vendor'
    else 'patient' end::public.app_role;
  return new;
end $$;
drop trigger if exists profiles_sync_roles on public.profiles;
create trigger profiles_sync_roles before insert or update on public.profiles
  for each row execute function public.sync_profile_roles();

-- Any sign-in that has no profile yet (e.g. created before this file was run) gets one now.
insert into public.profiles (id, phone)
select u.id, case when u.phone is null or u.phone = '' then null
                  when left(u.phone, 1) = '+' then u.phone else '+' || u.phone end
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- Older accounts: their single role becomes the list.
update public.profiles set roles = array['patient', role]::public.app_role[]
 where role <> 'patient' and not (role = any (roles));

-- Admin: the listed email accounts get it; every other account loses it (the trigger enforces this).
update public.profiles set roles = roles where 'admin' = any (roles) or role = 'admin';
update public.profiles p
   set roles = p.roles || '{admin}'::public.app_role[], full_name = coalesce(p.full_name, 'Farmacia Tech admin')
 where public.is_admin_email(p.id) and not ('admin' = any (p.roles));

-- ---------- Role checks used by every module ----------------------------------
-- Helpers used by policies (security definer avoids recursive RLS lookups).
create or replace function public.my_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.has_role(r public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select r = any (roles) from public.profiles where id = auth.uid()), false)
$$;
grant execute on function public.has_role(public.app_role) to authenticated;

create or replace function public.jwt_claim(k text)
returns text language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> k
$$;
-- Admin = an admin-email account (factor 1: code sent to that email) whose session was verified with
-- the authenticator app (factor 2, aal2) in the last 12 hours.
create or replace function public.admin_totp_fresh()
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1
      from jsonb_array_elements(coalesce(coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb -> 'amr', '[]'::jsonb)) a
     where (jsonb_typeof(a) = 'object' and a->>'method' = 'totp'
            and coalesce((a->>'timestamp')::bigint, 0) > extract(epoch from now())::bigint - 12 * 3600)
        or (jsonb_typeof(a) = 'string' and a #>> '{}' = 'totp'))
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('admin')
     and public.jwt_claim('aal') = 'aal2'
     and public.admin_totp_fresh()
$$;

-- ---------- Shared date helper (India time) -----------------------------------
-- Used by modules 3–5 (ages, expiry dates).
create or replace function public.today_ist()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- ---------- Access rules ------------------------------------------------------
alter table public.profiles enable row level security;
-- Read your own profile (admins read all); you may only change your name.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;
