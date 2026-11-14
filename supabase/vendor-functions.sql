-- ============================================================================
-- Farmacia Tech — vendor functions and views
-- Run AFTER vendor-devices.sql. Safe to run again: paste the whole file each
-- time it changes.
-- ============================================================================

-- ---------- Dates ------------------------------------------------------------
-- Pharmacy dates follow Indian time.
create or replace function public.today_ist()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- "2026-05" on a strip means usable until 31 May 2026.
create or replace function public.exp_last_day(p_exp text)
returns date language sql immutable set search_path = '' as $$
  select case when p_exp ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    then (make_date(left(p_exp, 4)::int, right(p_exp, 2)::int, 1) + interval '1 month' - interval '1 day')::date
  end
$$;

-- ---------- The one rule for "locked from sale" ------------------------------
-- Returns null when the batch may be sold, otherwise why not:
--   recalled       on the recall list
--   expired        past the last day of its expiry month
--   not_confirmed  unverified batch on a vending machine (never dispensed)
create or replace function public.batch_lock_reason(
  p_product_id uuid,
  p_batch_code text,
  p_exp        text,
  p_source     public.batch_source,
  p_device     public.device_type default null
) returns text language sql stable set search_path = '' as $$
  select case
    when exists (select 1 from public.recalls r where r.product_id = p_product_id and r.batch_code = p_batch_code) then 'recalled'
    when public.exp_last_day(p_exp) < public.today_ist() then 'expired'
    when p_device = 'vending' and p_source = 'unverified' then 'not_confirmed'
  end
$$;

-- ---------- Stock with everything the vendor pages need ----------------------
-- security_invoker: the vendor's own RLS applies, so each vendor sees only their rows.
create or replace view public.stock_status with (security_invoker = true) as
select
  s.id,
  s.vendor_id,
  s.machine_id,
  m.type            as device_type,
  m.code            as device_code,
  m.name            as device_name,
  m.low_stock_at,
  s.product_id,
  p.name            as product_name,
  p.strength,
  p.manufacturer,
  p.pack_size,
  s.batch_id,
  b.batch_code,
  b.mfd,
  b.exp,
  b.mrp,
  b.source,
  b.source = 'unverified'                    as not_confirmed,
  s.quantity,
  s.slot_no,
  s.shelf,
  s.updated_at,
  public.exp_last_day(b.exp)                 as expires_on,
  public.exp_last_day(b.exp) - public.today_ist() as days_left,
  public.batch_lock_reason(b.product_id, b.batch_code, b.exp, b.source, m.type) as lock_reason
from public.stock s
join public.machines m on m.id = s.machine_id
join public.products p on p.id = s.product_id
join public.batches  b on b.id = s.batch_id;

grant select on public.stock_status to authenticated;

-- ============================================================================
-- Step 2 — device registration and self-linking
-- Farmacia Tech registers a device (type, Device ID, pairing code, device key).
-- The operator links it to their own account with Device ID + pairing code.
-- ============================================================================

alter table public.machines add column if not exists pairing_code_hash text;  -- SHA-256 hex; cleared once used
alter table public.machines add column if not exists linked_at timestamptz;

-- Same normalisation the website uses before hashing: letters and digits only, upper case.
create or replace function public.hash_pairing_code(p_code text)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex')
$$;

-- Operator links a device. The pairing code works once; a new one is issued only by Farmacia Tech
-- (that is also how a device moves to a new operator). Linking makes a patient-role number an operator.
create or replace function public.claim_device(p_code text, p_pairing_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me     public.profiles%rowtype;
  dev_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Please sign in again'; end if;
  if me.role = 'doctor' then
    raise exception 'This number is registered as a doctor. Please use a different mobile number for your devices.';
  end if;

  -- One message for "no such ID" and "wrong code", so IDs can't be probed.
  select id into dev_id from public.machines
   where code = upper(btrim(p_code))
     and pairing_code_hash is not null
     and pairing_code_hash = public.hash_pairing_code(p_pairing_code)
   for update;
  if dev_id is null then raise exception 'Device ID or pairing code is not correct'; end if;

  update public.machines
     set owner_id = me.id, pairing_code_hash = null, linked_at = now()
   where id = dev_id;
  if me.role = 'patient' then
    update public.profiles set role = 'vendor' where id = me.id;
  end if;
  return dev_id;
end $$;
revoke execute on function public.claim_device(text, text) from public, anon;
grant execute on function public.claim_device(text, text) to authenticated;

-- Admin only: replace a device's key and/or pairing code (hashes are made on the server).
create or replace function public.set_device_secrets(p_machine_id uuid, p_key_hash text, p_pairing_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_key_hash is not null and p_key_hash !~ '^[0-9a-f]{64}$' then raise exception 'bad key hash'; end if;
  if p_pairing_hash is not null and p_pairing_hash !~ '^[0-9a-f]{64}$' then raise exception 'bad pairing hash'; end if;
  update public.machines
     set device_key_hash   = coalesce(p_key_hash, device_key_hash),
         pairing_code_hash = coalesce(p_pairing_hash, pairing_code_hash)
   where id = p_machine_id;
end $$;
revoke execute on function public.set_device_secrets(uuid, text, text) from public, anon;
grant execute on function public.set_device_secrets(uuid, text, text) to authenticated;

-- When a device changes hands, the stock physically inside it goes with it.
-- Scan history and the stock log stay with the operator who owned it at the time.
create or replace function public.move_device_records()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.stock set vendor_id = new.owner_id where machine_id = new.id;
  return new;
end $$;

-- Public finder: active vending machines that an operator has linked.
create or replace function public.public_machines()
returns table (code text, name text, address text, latitude double precision, longitude double precision)
language sql stable security definer set search_path = '' as $$
  select code, name, address, latitude, longitude
    from public.machines
   where is_active and type = 'vending' and owner_id is not null
   order by name
$$;

-- ============================================================================
-- Every scan must carry the medicine name (as read, or from the recognised product).
-- ============================================================================
do $$
begin
  if exists (select 1 from public.scan_events where product_name is null or btrim(product_name) = '') then
    raise exception 'Some scan events have no medicine name; fix them before adding this rule';
  end if;
  alter table public.scan_events alter column product_name set not null;
  if not exists (select 1 from pg_constraint where conname = 'scan_events_product_name_required') then
    alter table public.scan_events add constraint scan_events_product_name_required
      check (char_length(btrim(product_name)) between 1 and 200);
  end if;
end $$;
