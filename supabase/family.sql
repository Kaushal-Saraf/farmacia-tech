-- ============================================================================
-- Farmacia Tech — family members on one mobile number (patient side)
-- Run after schema.sql, phase2.sql and roles.sql. Safe to run again.
--
-- One patient account (mobile number) can hold several people: the account
-- holder ("self"), spouse, children, parents… Each prescription is for one of
-- them. Doctors see a number's members only through find_family_by_phone().
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'family_relation') then
    create type public.family_relation as enum ('self', 'spouse', 'son', 'daughter', 'father', 'mother', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'gender') then
    create type public.gender as enum ('male', 'female', 'other');
  end if;
end $$;

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
  -- Every number is a patient (roles.sql), so everyone with a name gets a "self" entry.
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

-- Existing patients get their "self" member.
insert into public.family_members (account_id, full_name, relation, added_by)
select id, full_name, 'self', id from public.profiles where full_name is not null
on conflict (account_id) where relation = 'self' do nothing;

-- ---------- Prescriptions are for one family member -------------------------
alter table public.prescriptions add column if not exists member_id uuid references public.family_members (id) on delete restrict;
alter table public.prescriptions add column if not exists patient_birth_date date;   -- snapshot at issue time
alter table public.prescriptions add column if not exists patient_gender public.gender;
alter table public.prescriptions add column if not exists patient_relation public.family_relation;

-- Old prescriptions belong to the account holder.
update public.prescriptions p
   set member_id = f.id, patient_relation = 'self', patient_name = coalesce(p.patient_name, f.full_name)
  from public.family_members f
 where p.member_id is null and f.account_id = p.patient_id and f.relation = 'self';
update public.prescriptions p
   set patient_name = f.full_name
  from public.family_members f
 where p.patient_name is null and p.member_id = f.id;

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

-- today_ist() is also defined in vendor-functions.sql; defined here too so this file stands alone.
create or replace function public.today_ist()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- ---------- Doctor: look up a number's family --------------------------------
-- Returns null if no patient has signed in with this number, else the account and its members.
create or replace function public.find_family_by_phone(p_phone text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare acc uuid;
begin
  if not (public.has_role('doctor') or public.is_admin()) then raise exception 'forbidden'; end if;
  select id into acc from public.profiles where phone = p_phone;
  if acc is null then return null; end if;
  return jsonb_build_object(
    'account_id', acc,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'full_name', f.full_name, 'relation', f.relation,
               'birth_date', f.birth_date, 'gender', f.gender)
             order by (f.relation <> 'self'), f.created_at)
        from public.family_members f
       where f.account_id = acc and not f.is_archived), '[]'::jsonb));
end $$;
revoke execute on function public.find_family_by_phone(text) from public, anon;
grant execute on function public.find_family_by_phone(text) to authenticated;

-- Doctor adds someone who isn't listed yet (e.g. a child's first visit). The account holder sees
-- who added them and can edit or remove them.
create or replace function public.doctor_add_family_member(
  p_account_id uuid, p_full_name text, p_relation public.family_relation, p_birth_date date, p_gender public.gender
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if not public.has_role('doctor') then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.profiles where id = p_account_id) then
    raise exception 'No patient account for this number';
  end if;
  if p_relation = 'self' and exists (select 1 from public.family_members where account_id = p_account_id and relation = 'self') then
    raise exception 'The account holder is already listed';
  end if;
  if p_birth_date is not null and p_birth_date > public.today_ist() then raise exception 'Date of birth is in the future'; end if;
  insert into public.family_members (account_id, full_name, relation, birth_date, gender, added_by, added_by_name)
  values (p_account_id, btrim(p_full_name), p_relation, p_birth_date, p_gender, auth.uid(),
          'Dr. ' || coalesce(regexp_replace((select full_name from public.profiles where id = auth.uid()), '^\s*dr\.?\s+', '', 'i'), 'unknown'))
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.doctor_add_family_member(uuid, text, public.family_relation, date, public.gender) from public, anon;
grant execute on function public.doctor_add_family_member(uuid, text, public.family_relation, date, public.gender) to authenticated;

-- ---------- Prescription writer now takes the family member -----------------
drop function if exists public.create_prescription(uuid, text, text, text, jsonb, jsonb);
create or replace function public.create_prescription(
  p_patient_id uuid,
  p_member_id  uuid,
  p_title      text,
  p_notes      text,
  p_advice     text,
  p_vitals     jsonb,
  p_items      jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare rx_id uuid;
begin
  if p_member_id is null then raise exception 'Choose who the prescription is for'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item';
  end if;

  insert into public.prescriptions (doctor_id, patient_id, member_id, title, notes, advice, vitals)
  values (auth.uid(), p_patient_id, p_member_id, p_title, nullif(p_notes, ''), nullif(p_advice, ''), coalesce(p_vitals, '{}'::jsonb))
  returning id into rx_id;

  insert into public.prescription_items (prescription_id, kind, name, strength, per_day, days, instructions)
  select rx_id,
         coalesce(nullif(i->>'kind', ''), 'medicine')::public.item_kind,
         i->>'name',
         nullif(i->>'strength', ''),
         nullif(i->>'per_day', '')::int,
         nullif(i->>'days', '')::int,
         nullif(i->>'instructions', '')
    from jsonb_array_elements(p_items) as i;

  return rx_id;
end $$;
