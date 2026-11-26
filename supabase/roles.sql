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
--            Opening the admin side then needs an authenticator app and an admin PIN (see below).
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

-- ---------- Admin needs three factors -----------------------------------------
-- 1. SMS code (normal sign-in)  2. authenticator-app code (session at aal2)  3. admin PIN.
-- is_admin() is true only when all three passed: admin role + aal2 session + a PIN unlock
-- for THIS session that is less than 30 minutes old. Every admin rule and function uses it.

create table if not exists public.admin_secrets (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  pin_hash         text not null,                 -- bcrypt
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  updated_at       timestamptz not null default now()
);
create table if not exists public.admin_unlocks (
  session_id  uuid primary key,                   -- Supabase session (JWT session_id)
  user_id     uuid not null references public.profiles (id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create table if not exists public.admin_audit (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  target      text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
-- No policies on secrets/unlocks: only the functions below can touch them.
alter table public.admin_secrets enable row level security;
alter table public.admin_unlocks enable row level security;
alter table public.admin_audit   enable row level security;

create or replace function public.jwt_claim(k text)
returns text language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> k
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('admin')
     and public.jwt_claim('aal') = 'aal2'
     and exists (select 1 from public.admin_unlocks u
                  where u.session_id = nullif(public.jwt_claim('session_id'), '')::uuid
                    and u.user_id = auth.uid() and u.expires_at > now())
$$;

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
    'has_role',       public.has_role('admin'),
    'aal',            public.jwt_claim('aal'),
    'has_pin',        exists (select 1 from public.admin_secrets where user_id = auth.uid()),
    'locked_until',   (select locked_until from public.admin_secrets where user_id = auth.uid() and locked_until > now()),
    'unlocked_until', (select expires_at from public.admin_unlocks
                        where session_id = nullif(public.jwt_claim('session_id'), '')::uuid
                          and user_id = auth.uid() and expires_at > now()))
$$;

-- Unlock admin for this session with the PIN. Returns {ok} or {error}; never raises, so a wrong
-- PIN is still counted. 5 wrong PINs lock it for 15 minutes.
create or replace function public.admin_unlock(p_pin text)
returns jsonb language plpgsql security definer set search_path = extensions, public, pg_temp as $$
declare
  sec  public.admin_secrets%rowtype;
  sid  uuid := nullif(public.jwt_claim('session_id'), '')::uuid;
  till timestamptz;
begin
  if not public.has_role('admin') then return jsonb_build_object('error', 'Not an admin'); end if;
  if public.jwt_claim('aal') is distinct from 'aal2' or sid is null then
    return jsonb_build_object('error', 'Verify with your authenticator app first');
  end if;
  select * into sec from public.admin_secrets where user_id = auth.uid() for update;
  if sec.user_id is null then return jsonb_build_object('error', 'Set your admin PIN first'); end if;
  if sec.locked_until > now() then
    return jsonb_build_object('error', format('Too many wrong PINs. Try again after %s.', to_char(sec.locked_until at time zone 'Asia/Kolkata', 'HH24:MI')));
  end if;

  if sec.pin_hash = crypt(coalesce(p_pin, ''), sec.pin_hash) then
    update public.admin_secrets set failed_attempts = 0, locked_until = null where user_id = sec.user_id;
    delete from public.admin_unlocks where expires_at < now();
    till := now() + interval '30 minutes';
    insert into public.admin_unlocks (session_id, user_id, expires_at) values (sid, sec.user_id, till)
      on conflict (session_id) do update set user_id = excluded.user_id, expires_at = excluded.expires_at;
    perform public.admin_log('admin_unlocked');
    return jsonb_build_object('ok', true, 'unlocked_until', till);
  end if;

  if sec.failed_attempts + 1 >= 5 then
    update public.admin_secrets set failed_attempts = 0, locked_until = now() + interval '15 minutes' where user_id = sec.user_id;
    perform public.admin_log('admin_pin_locked');
    return jsonb_build_object('error', 'Too many wrong PINs. Admin is locked for 15 minutes.');
  end if;
  update public.admin_secrets set failed_attempts = failed_attempts + 1 where user_id = sec.user_id;
  perform public.admin_log('admin_pin_wrong');
  return jsonb_build_object('error', format('Wrong PIN. %s tries left.', 5 - (sec.failed_attempts + 1)));
end $$;

-- Set the admin PIN (first time), or change it (needs the current PIN). Needs an aal2 session.
create or replace function public.admin_set_pin(p_new text, p_current text default null)
returns jsonb language plpgsql security definer set search_path = extensions, public, pg_temp as $$
declare
  sec  public.admin_secrets%rowtype;
  res  jsonb;
begin
  if not public.has_role('admin') then return jsonb_build_object('error', 'Not an admin'); end if;
  if public.jwt_claim('aal') is distinct from 'aal2' then return jsonb_build_object('error', 'Verify with your authenticator app first'); end if;
  if p_new is null or char_length(p_new) < 6 or char_length(p_new) > 32 then
    return jsonb_build_object('error', 'The PIN must be 6 to 32 characters');
  end if;
  select * into sec from public.admin_secrets where user_id = auth.uid();
  if sec.user_id is not null then
    res := public.admin_unlock(p_current);            -- checks (and counts) the current PIN
    if res ? 'error' then return res; end if;
  end if;
  insert into public.admin_secrets (user_id, pin_hash) values (auth.uid(), crypt(p_new, gen_salt('bf', 10)))
    on conflict (user_id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
  perform public.admin_log(case when sec.user_id is null then 'admin_pin_set' else 'admin_pin_changed' end);
  return public.admin_unlock(p_new);
end $$;

-- Lock admin again for this session.
create or replace function public.admin_lock()
returns void language sql security definer set search_path = '' as $$
  delete from public.admin_unlocks where session_id = nullif(public.jwt_claim('session_id'), '')::uuid and user_id = auth.uid()
$$;

do $$
declare f text;
begin
  foreach f in array array['public.admin_status()', 'public.admin_unlock(text)', 'public.admin_set_pin(text, text)', 'public.admin_lock()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Devices are registered by admins only (machines has no other insert rule): log each one.
create or replace function public.log_device_registered()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_log('device_registered', new.code, jsonb_build_object('type', new.type, 'machine_id', new.id));
  return new;
end $$;
drop trigger if exists machines_log_registered on public.machines;
create trigger machines_log_registered after insert on public.machines
  for each row execute function public.log_device_registered();

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
