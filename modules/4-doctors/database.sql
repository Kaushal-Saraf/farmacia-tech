-- ============================================================================
-- Module 4 · Doctors
--
-- A doctor applies with their medical registration (and a document); admin approves it,
-- which adds the doctor role. A doctor looks a family up by mobile number, picks the
-- family member (or adds one) and writes the prescription.
--
-- Run after 1-accounts, 2-admin and 3-patients.
-- Safe to run again: paste the whole file into Supabase → SQL Editor → Run.
-- ============================================================================

-- ---------- Types -------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'application_status' and typnamespace = 'public'::regnamespace) then
    execute 'create type public.application_status as enum (''pending'', ''approved'', ''rejected'')';
  end if;
end $$;

-- ---------- Doctor applications -----------------------------------------------
create table if not exists public.doctor_applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references public.profiles (id) on delete cascade,
  full_name        text not null check (char_length(full_name) between 2 and 120),
  registration_no  text not null check (char_length(registration_no) between 3 and 40),
  council          text not null,           -- e.g. NMC, Delhi Medical Council
  qualification    text not null,           -- e.g. MBBS, MD
  document_path    text,                    -- file in the private doctor-docs storage
  status           public.application_status not null default 'pending',
  reviewed_by      uuid references public.profiles (id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);
alter table public.doctor_applications enable row level security;
drop policy if exists "apps: insert own" on public.doctor_applications;
create policy "apps: insert own" on public.doctor_applications for insert
  with check (user_id = auth.uid());
drop policy if exists "apps: read own or admin" on public.doctor_applications;
create policy "apps: read own or admin" on public.doctor_applications for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "apps: resubmit own while pending" on public.doctor_applications;
create policy "apps: resubmit own while pending" on public.doctor_applications for update
  using (user_id = auth.uid() and status <> 'approved') with check (user_id = auth.uid());
revoke update on public.doctor_applications from authenticated, anon;
grant update (user_id, full_name, registration_no, council, qualification, document_path) on public.doctor_applications to authenticated;

-- Approving a doctor adds the doctor role; the number keeps its other roles.
create or replace function public.review_doctor_application(application_id uuid, approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.doctor_applications
     set status = case when approve then 'approved'::public.application_status else 'rejected'::public.application_status end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = application_id
   returning user_id into uid;
  perform public.admin_log(case when approve then 'doctor_approved' else 'doctor_rejected' end, uid::text,
                           jsonb_build_object('application_id', application_id));
  if approve then
    update public.profiles
       set roles = roles || '{doctor}'::public.app_role[],
           full_name = coalesce(full_name, (select full_name from public.doctor_applications where id = application_id))
     where id = uid;
  end if;
end $$;

-- ---------- Private storage for doctor documents ------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('doctor-docs', 'doctor-docs', false, 4194304, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Files live at doctor-docs/<user id>/<file>. Users manage their own folder; admins can read all.
drop policy if exists "doctor-docs: upload own" on storage.objects;
create policy "doctor-docs: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'doctor-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "doctor-docs: update own" on storage.objects;
create policy "doctor-docs: update own" on storage.objects for update to authenticated
  using (bucket_id = 'doctor-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "doctor-docs: read own or admin" on storage.objects;
create policy "doctor-docs: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'doctor-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- Writing prescriptions ---------------------------------------------
-- Only approved doctors may write prescriptions.
drop policy if exists "rx: verified doctors insert" on public.prescriptions;
create policy "rx: verified doctors insert" on public.prescriptions for insert
  with check (doctor_id = auth.uid() and status = 'issued' and public.has_role('doctor'));
drop policy if exists "rx items: doctor insert" on public.prescription_items;
create policy "rx items: doctor insert" on public.prescription_items for insert
  with check (exists (select 1 from public.prescriptions p where p.id = prescription_id and p.doctor_id = auth.uid()));

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
drop function if exists public.create_prescription(uuid, text, text, text, jsonb, jsonb);   -- older version
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
drop function if exists public.find_patient_by_phone(text);   -- replaced by find_family_by_phone

do $$
declare f text;
begin
  -- signed-in users (each function checks who may do what)
  foreach f in array array['public.find_family_by_phone(text)', 'public.doctor_add_family_member(uuid, text, public.family_relation, date, public.gender)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
