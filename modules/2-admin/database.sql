-- ============================================================================
-- Module 2 · Admin
--
-- Admin signs in with a code sent to the admin email, then the authenticator app
-- (both checked by is_admin() in module 1). This module holds what only admin uses:
--   admin_audit   log of admin sign-ins and actions
--   leads         messages from the website's Contact page (Enquiries tab)
-- Admin's other jobs live with their data: doctor approval in 4-doctors, devices in 5-devices.
--
-- Run after 1-accounts.
-- Safe to run again: paste the whole file into Supabase → SQL Editor → Run.
-- ============================================================================

-- ---------- Admin activity log ------------------------------------------------
create table if not exists public.admin_audit (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  target      text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
drop policy if exists "admin audit: admins read" on public.admin_audit;
create policy "admin audit: admins read" on public.admin_audit for select to authenticated using (public.is_admin());

create or replace function public.admin_log(p_action text, p_target text default null, p_detail jsonb default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_audit (actor_id, action, target, detail) values (auth.uid(), p_action, p_target, p_detail)
$$;
revoke execute on function public.admin_log(text, text, jsonb) from public, anon, authenticated;

-- What the admin verification page needs to know.
create or replace function public.admin_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'has_role', public.has_role('admin'),
    'verified', public.is_admin(),
    'aal',      public.jwt_claim('aal'))
$$;

-- Called by the website right after the authenticator code is accepted.
create or replace function public.admin_note_verified()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then perform public.admin_log('admin_verified'); end if;
end $$;

-- ---------- Enquiries (Contact page) ------------------------------------------
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  phone         text,
  organisation  text,
  type          text not null,
  message       text not null,
  created_at    timestamptz not null default now()
);
alter table public.leads enable row level security;
-- Anyone can send the contact form; only admin can read it.
drop policy if exists "leads: anyone insert" on public.leads;
create policy "leads: anyone insert" on public.leads for insert to anon, authenticated with check (true);
drop policy if exists "leads: admin read" on public.leads;
create policy "leads: admin read" on public.leads for select using (public.is_admin());

-- ---------- Removed: the old admin PIN (no longer used) -----------------------
drop function if exists public.admin_unlock(text);
drop function if exists public.admin_set_pin(text, text);
drop function if exists public.admin_lock();
drop table if exists public.admin_unlocks;
drop table if exists public.admin_secrets;

do $$
declare f text;
begin
  -- signed-in users (each function checks who may do what)
  foreach f in array array['public.admin_status()', 'public.admin_note_verified()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
