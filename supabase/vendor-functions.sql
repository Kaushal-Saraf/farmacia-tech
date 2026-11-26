-- ============================================================================
-- Farmacia Tech — vendor functions and views
-- Run AFTER vendor-devices.sql and roles.sql. Safe to run again: paste the
-- whole file each time it changes.
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
-- (that is also how a device moves to a new operator). Linking adds the operator (vendor) role to the
-- number; it keeps any other roles (a doctor can also run devices). Needs roles.sql.
create or replace function public.claim_device(p_code text, p_pairing_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me     public.profiles%rowtype;
  dev_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Please sign in again'; end if;

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
  update public.profiles set roles = roles || '{vendor}'::public.app_role[] where id = me.id;
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
-- Medicine name on scans
-- ACCEPT must carry the name. REVIEW / REFUSE may arrive without one (the checker
-- has no keyboard); the owner picks or types the product on the website.
-- Also undoes the earlier "always required" rule if it was already applied.
-- ============================================================================
alter table public.scan_events alter column product_name drop not null;
alter table public.scan_events drop constraint if exists scan_events_product_name_required;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'scan_events_accept_has_name') then
    alter table public.scan_events add constraint scan_events_accept_has_name
      check (decision <> 'ACCEPT' or char_length(btrim(coalesce(product_name, ''))) between 1 and 200);
  end if;
end $$;

-- ============================================================================
-- Step 3 — stock edits by the vendor on the website
-- Every change goes through these functions so it is always logged in
-- stock_movements. Browsers cannot write stock directly.
-- ============================================================================

create or replace function public.owns_device(p_machine_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.machines where id = p_machine_id and (owner_id = auth.uid() or public.is_admin()))
$$;

-- Finds a medicine in the shared list (same name + strength + manufacturer, any letter case) or adds it.
create or replace function public.vendor_get_or_create_product(
  p_name text, p_strength text, p_manufacturer text, p_pack_size text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  n  text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  st text := nullif(regexp_replace(btrim(coalesce(p_strength, '')), '\s+', ' ', 'g'), '');
  mf text := nullif(regexp_replace(btrim(coalesce(p_manufacturer, '')), '\s+', ' ', 'g'), '');
  pk text := nullif(regexp_replace(btrim(coalesce(p_pack_size, '')), '\s+', ' ', 'g'), '');
  pid uuid;
begin
  if not (public.has_role('vendor') or public.is_admin()) then raise exception 'forbidden'; end if;
  if char_length(n) < 2 then raise exception 'Enter the medicine name'; end if;
  select id into pid from public.products
   where lower(btrim(name)) = lower(n) and lower(coalesce(strength, '')) = lower(coalesce(st, ''))
     and lower(coalesce(manufacturer, '')) = lower(coalesce(mf, ''));
  if pid is null then
    insert into public.products (name, strength, manufacturer, pack_size, created_by)
    values (n, st, mf, pk, auth.uid()) returning id into pid;
  end if;
  return pid;
end $$;

-- Add a batch by hand (typed from the strip). Creates or confirms the shared batch and adds stock.
create or replace function public.vendor_add_stock(
  p_machine_id uuid, p_product_id uuid, p_batch_code text, p_mfd text, p_exp text, p_mrp text,
  p_quantity int, p_slot_no int, p_shelf text, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  code  text := upper(btrim(coalesce(p_batch_code, '')));
  dtype public.device_type;
  b     public.batches%rowtype;
  lock  text;
  sid   uuid;
  newq  int;
begin
  if not public.owns_device(p_machine_id) then raise exception 'Device not found'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 10000 then raise exception 'Quantity must be between 1 and 10000'; end if;
  if not exists (select 1 from public.products where id = p_product_id) then raise exception 'Choose the medicine'; end if;
  if code = '' or p_mfd is null or p_exp is null or p_mrp is null then
    raise exception 'Enter the batch number, MFD, EXP and MRP exactly as printed';
  end if;

  select type into dtype from public.machines where id = p_machine_id;
  if dtype = 'vending' then
    if p_slot_no is null or not exists (select 1 from public.machine_slots where machine_id = p_machine_id and slot_no = p_slot_no) then
      raise exception 'Choose a slot on this machine';
    end if;
    p_shelf := null;
  else
    p_slot_no := null;
    p_shelf := nullif(btrim(coalesce(p_shelf, '')), '');
  end if;

  select * into b from public.batches where product_id = p_product_id and batch_code = code for update;
  if b.id is null then
    insert into public.batches (product_id, batch_code, mfd, exp, mrp, source, created_by, confirmed_by, confirmed_at)
    values (p_product_id, code, p_mfd, p_exp, p_mrp, 'confirmed_on_website', auth.uid(), auth.uid(), now())
    returning * into b;
  elsif b.source = 'unverified' then
    -- Typed in full from the strip by the vendor: that confirms it.
    update public.batches
       set mfd = p_mfd, exp = p_exp, mrp = p_mrp, source = 'confirmed_on_website', confirmed_by = auth.uid(), confirmed_at = now()
     where id = b.id returning * into b;
  elsif (b.mfd, b.exp, b.mrp) is distinct from (p_mfd, p_exp, p_mrp) then
    raise exception 'Batch % is already recorded as MFD %, EXP %, MRP %. Please check the strip.', code, b.mfd, b.exp, b.mrp;
  end if;

  lock := public.batch_lock_reason(b.product_id, b.batch_code, b.exp, b.source, dtype);
  if lock in ('expired', 'recalled') then
    raise exception 'This batch is %, so it can''t be added for sale', lock;
  end if;

  insert into public.stock (machine_id, product_id, batch_id, quantity, slot_no, shelf)
  values (p_machine_id, p_product_id, b.id, p_quantity, p_slot_no, p_shelf)
  on conflict (machine_id, batch_id, location) do update set quantity = public.stock.quantity + excluded.quantity
  returning id, quantity into sid, newq;

  insert into public.stock_movements (machine_id, stock_id, batch_id, change, quantity_after, reason, note, actor_id)
  values (p_machine_id, sid, b.id, p_quantity, newq, 'manual_add', nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  return sid;
end $$;

-- Set the count after a physical check.
create or replace function public.vendor_set_stock_quantity(p_stock_id uuid, p_quantity int, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare st public.stock%rowtype;
begin
  select * into st from public.stock where id = p_stock_id for update;
  if st.id is null or not public.owns_device(st.machine_id) then raise exception 'Stock not found'; end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > 100000 then raise exception 'Count must be between 0 and 100000'; end if;
  if p_quantity = st.quantity then return; end if;
  update public.stock set quantity = p_quantity where id = st.id;
  insert into public.stock_movements (machine_id, stock_id, batch_id, change, quantity_after, reason, note, actor_id)
  values (st.machine_id, st.id, st.batch_id, p_quantity - st.quantity, p_quantity, 'manual_set', nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
end $$;

-- Record units sold or taken off the shelf.
create or replace function public.vendor_reduce_stock(p_stock_id uuid, p_quantity int, p_reason text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  st   public.stock%rowtype;
  lock text;
begin
  if p_reason not in ('manual_sold', 'manual_removed', 'removed_expired', 'removed_recalled') then raise exception 'Choose a reason'; end if;
  select * into st from public.stock where id = p_stock_id for update;
  if st.id is null or not public.owns_device(st.machine_id) then raise exception 'Stock not found'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Enter how many'; end if;
  if p_quantity > st.quantity then raise exception 'Only % in stock', st.quantity; end if;
  if p_reason = 'manual_sold' then
    select lock_reason into lock from public.stock_status where id = st.id;
    if lock is not null then raise exception 'This batch is locked (%) and can''t be sold', replace(lock, '_', ' '); end if;
  end if;
  update public.stock set quantity = quantity - p_quantity where id = st.id;
  insert into public.stock_movements (machine_id, stock_id, batch_id, change, quantity_after, reason, note, actor_id)
  values (st.machine_id, st.id, st.batch_id, -p_quantity, st.quantity - p_quantity, p_reason::public.stock_reason,
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.owns_device(uuid)',
    'public.vendor_get_or_create_product(text, text, text, text)',
    'public.vendor_add_stock(uuid, uuid, text, text, text, text, int, int, text, text)',
    'public.vendor_set_stock_quantity(uuid, int, text)',
    'public.vendor_reduce_stock(uuid, int, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ============================================================================
-- Operators (vendor role) may add medicines to the shared list. Needs roles.sql.
-- ============================================================================
drop policy if exists "products: vendors add" on public.products;
create policy "products: vendors add" on public.products for insert to authenticated
  with check (created_by = auth.uid() and (public.has_role('vendor') or public.is_admin()));
