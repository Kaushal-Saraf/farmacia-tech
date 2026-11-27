-- ============================================================================
-- Module 3 · Patients and family
--
-- One mobile number can hold a whole family (self, spouse, children, parents…).
-- Prescriptions are stored here: each one is for one family member. Patients read
-- their family's prescriptions; doctors write them (rules in 4-doctors).
--
-- Run after 1-accounts and 2-admin.
-- Safe to run again: paste the whole file into Supabase → SQL Editor → Run.
-- ============================================================================

-- ---------- Types -------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'family_relation' and typnamespace = 'public'::regnamespace) then
    execute 'create type public.family_relation as enum (''self'', ''spouse'', ''son'', ''daughter'', ''father'', ''mother'', ''other'')';
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'gender' and typnamespace = 'public'::regnamespace) then
    execute 'create type public.gender as enum (''male'', ''female'', ''other'')';
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'prescription_status' and typnamespace = 'public'::regnamespace) then
    execute 'create type public.prescription_status as enum (''issued'', ''paid'', ''dispensed'', ''cancelled'')';
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'item_kind' and typnamespace = 'public'::regnamespace) then
    execute 'create type public.item_kind as enum (''medicine'', ''test'', ''injection'')';
  end if;
end $$;

-- ---------- Family members ----------------------------------------------------
create table if not exists public.family_members (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references public.profiles (id) on delete cascade,   -- the mobile number's account
  full_name      text not null check (char_length(btrim(full_name)) between 2 and 120),
  relation       public.family_relation not null,
  birth_date     date check (birth_date >= '1900-01-01'),
  gender         public.gender,
  added_by       uuid references public.profiles (id) on delete set null,
  added_by_name  text,                                    -- e.g. "Dr. Mehta" when a doctor added them
  is_archived    boolean not null default false,           -- "removed": hidden, old prescriptions kept
  created_at     timestamptz not null default now()
);
create unique index if not exists family_members_one_self on public.family_members (account_id) where relation = 'self';
create index if not exists family_members_account on public.family_members (account_id);

alter table public.family_members enable row level security;

-- The account holder manages their own family. Doctors never read this table directly.
drop policy if exists "family: read own" on public.family_members;
create policy "family: read own" on public.family_members for select to authenticated
  using (account_id = auth.uid() or public.is_admin());
drop policy if exists "family: add own" on public.family_members;
create policy "family: add own" on public.family_members for insert to authenticated
  with check (account_id = auth.uid() and relation <> 'self' and added_by = auth.uid() and not is_archived);
drop policy if exists "family: edit own" on public.family_members;
create policy "family: edit own" on public.family_members for update to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());
revoke update on public.family_members from authenticated, anon;
grant update (full_name, relation, birth_date, gender, is_archived) on public.family_members to authenticated;

-- "Self" can't be removed or turned into someone else, and nobody else can become "self".
create or replace function public.guard_family_member()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.relation = 'self' and (new.relation <> 'self' or new.is_archived) then
    raise exception 'The account holder can''t be removed';
  end if;
  if old.relation <> 'self' and new.relation = 'self' then
    raise exception 'Only the account holder is "self"';
  end if;
  return new;
end $$;
drop trigger if exists family_members_guard on public.family_members;
create trigger family_members_guard before update on public.family_members
  for each row execute function public.guard_family_member();

-- The account holder's own name lives on their profile; keep their "self" member in step.
create or replace function public.sync_self_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Every number is a patient (module 1), so everyone with a name gets a "self" entry.
  if new.full_name is not null then
    insert into public.family_members (account_id, full_name, relation, added_by)
    values (new.id, new.full_name, 'self', new.id)
    on conflict (account_id) where relation = 'self'
    do update set full_name = excluded.full_name;
  end if;
  return new;
end $$;
drop trigger if exists profiles_sync_self on public.profiles;
create trigger profiles_sync_self after insert or update of full_name, role on public.profiles
  for each row execute function public.sync_self_member();

-- Accounts that already have a name get their "self" member.
insert into public.family_members (account_id, full_name, relation, added_by)
select id, full_name, 'self', id from public.profiles where full_name is not null
on conflict (account_id) where relation = 'self' do nothing;

-- ---------- Prescriptions -----------------------------------------------------
create table if not exists public.prescriptions (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references public.profiles (id),
  patient_id  uuid not null references public.profiles (id),   -- the mobile number's account
  doctor_name  text,                          -- snapshot, filled by trigger
  patient_name text,                          -- snapshot, filled by trigger
  title       text not null,
  notes       text,
  advice      text,
  vitals      jsonb not null default '{}'::jsonb,  -- height, weight, bp, blood group
  status      public.prescription_status not null default 'issued',
  created_at  timestamptz not null default now(),
  member_id   uuid references public.family_members (id) on delete restrict,   -- who it is for
  patient_birth_date date,                    -- snapshot at issue time
  patient_gender public.gender,
  patient_relation public.family_relation
);
alter table public.prescriptions add column if not exists member_id uuid references public.family_members (id) on delete restrict;
alter table public.prescriptions add column if not exists patient_birth_date date;
alter table public.prescriptions add column if not exists patient_gender public.gender;
alter table public.prescriptions add column if not exists patient_relation public.family_relation;

create table if not exists public.prescription_items (
  id               uuid primary key default gen_random_uuid(),
  prescription_id  uuid not null references public.prescriptions (id) on delete cascade,
  kind             public.item_kind not null default 'medicine',
  name             text not null,
  strength         text,
  per_day          int check (per_day > 0),
  days             int check (days > 0),
  instructions     text
);

-- Names (and now age/gender/relation) are copied at issue time, like a printed prescription.
create or replace function public.fill_prescription_names()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.doctor_name := (select full_name from public.profiles where id = new.doctor_id);
  if new.member_id is not null then
    select full_name, birth_date, gender, relation
      into new.patient_name, new.patient_birth_date, new.patient_gender, new.patient_relation
      from public.family_members
     where id = new.member_id and account_id = new.patient_id and not is_archived;
    if not found then raise exception 'That family member is not on this mobile number'; end if;
  else
    new.patient_name := (select full_name from public.profiles where id = new.patient_id);
  end if;
  return new;
end $$;
drop trigger if exists prescriptions_fill_names on public.prescriptions;
create trigger prescriptions_fill_names before insert on public.prescriptions
  for each row execute function public.fill_prescription_names();

-- Older prescriptions belong to the account holder.
update public.prescriptions p
   set member_id = f.id, patient_relation = 'self', patient_name = coalesce(p.patient_name, f.full_name)
  from public.family_members f
 where p.member_id is null and f.account_id = p.patient_id and f.relation = 'self';
update public.prescriptions p
   set patient_name = f.full_name
  from public.family_members f
 where p.patient_name is null and p.member_id = f.id;

-- ---------- Access rules ------------------------------------------------------
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
-- A prescription is visible to its account (the family's number) and the doctor who wrote it.
drop policy if exists "rx: read own" on public.prescriptions;
create policy "rx: read own" on public.prescriptions for select
  using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin());
drop policy if exists "rx items: read with parent" on public.prescription_items;
create policy "rx items: read with parent" on public.prescription_items for select
  using (exists (select 1 from public.prescriptions p where p.id = prescription_id
                 and (p.patient_id = auth.uid() or p.doctor_id = auth.uid() or public.is_admin())));
