-- ============================================================================
-- Farmacia Tech — one mobile number, several roles
-- Run after schema.sql and phase2.sql, and BEFORE vendor-functions.sql and
-- family.sql (re-run those two after this one). Safe to run again.
--
-- profiles.roles is the list of what a number may do:
--   patient  everyone
--   doctor   added when an admin approves the doctor application
--   vendor   added when the number links its first device
--   admin    added by hand:  update public.profiles set roles = roles || '{admin}' where phone = '+91XXXXXXXXXX';
-- profiles.role is kept as the "main" role (admin > doctor > vendor > patient) for older code.
-- Which side of the website someone sees is chosen by the sign-in door, not stored here.
-- ============================================================================

alter table public.profiles add column if not exists roles public.app_role[] not null default '{patient}';

-- Keep roles tidy (always includes patient, no duplicates) and role = the main one.
create or replace function public.sync_profile_roles()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Someone set `role` directly (e.g. the old README admin step): add it to the list.
  if tg_op = 'UPDATE' and new.role is distinct from old.role and not (new.role = any (coalesce(new.roles, '{}'))) then
    new.roles := array_append(new.roles, new.role);
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

-- Existing accounts: their single role becomes the list.
update public.profiles set roles = array['patient', role]::public.app_role[]
 where role <> 'patient' and not (role = any (roles));

-- ---------- Role checks used by rules and functions -------------------------
create or replace function public.has_role(r public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select r = any (roles) from public.profiles where id = auth.uid()), false)
$$;
grant execute on function public.has_role(public.app_role) to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('admin')
$$;

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
  if approve then
    update public.profiles
       set roles = roles || '{doctor}'::public.app_role[],
           full_name = coalesce(full_name, (select full_name from public.doctor_applications where id = application_id))
     where id = uid;
  end if;
end $$;

create or replace function public.find_patient_by_phone(p_phone text)
returns table (id uuid, full_name text) language sql stable security definer set search_path = '' as $$
  select id, full_name from public.profiles
   where phone = p_phone and (public.has_role('doctor') or public.is_admin())
$$;

drop policy if exists "rx: verified doctors insert" on public.prescriptions;
create policy "rx: verified doctors insert" on public.prescriptions for insert
  with check (doctor_id = auth.uid() and status = 'issued' and public.has_role('doctor'));

-- Old admin helper from phase2.sql (the website no longer uses it): add the vendor role.
create or replace function public.assign_machine_owner(p_machine_id uuid, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select id into uid from public.profiles where phone = p_phone;
  if uid is null then raise exception 'No user with that phone has signed in yet'; end if;
  update public.profiles set roles = roles || '{vendor}'::public.app_role[] where id = uid;
  update public.machines set owner_id = uid where id = p_machine_id;
end $$;
