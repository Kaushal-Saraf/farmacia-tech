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
  perform public.admin_log(
    case when p_key_hash is not null then 'device_key_reset' else 'pairing_code_reset' end,
    (select code from public.machines where id = p_machine_id));
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

-- ============================================================================
-- Step 4 — Device API (docs/device-api.md). Called by /api/device/* with the
-- device key; no user session. One transaction per event.
-- ============================================================================

alter table public.scan_events add column if not exists applied_decision public.scan_decision;  -- what the server did

-- The device for a key (active devices only). Internal.
create or replace function public.device_by_key(p_key text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.machines
   where p_key is not null and char_length(p_key) between 10 and 200
     and device_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
     and is_active
$$;

-- Adds stock and logs it. With p_merge, a device scan adds to the batch's existing row on the device
-- (whatever its shelf); otherwise the given slot/shelf is used. Internal.
create or replace function public._stock_add(
  p_machine uuid, p_batch uuid, p_qty int, p_slot int, p_shelf text, p_merge boolean,
  p_reason public.stock_reason, p_event uuid, p_note text, p_actor uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare sid uuid; newq int; pid uuid;
begin
  select product_id into pid from public.batches where id = p_batch;
  if p_merge then
    select id into sid from public.stock where machine_id = p_machine and batch_id = p_batch order by quantity desc, updated_at desc limit 1 for update;
  end if;
  if sid is not null then
    update public.stock set quantity = quantity + p_qty where id = sid returning quantity into newq;
  else
    insert into public.stock (machine_id, product_id, batch_id, quantity, slot_no, shelf)
    values (p_machine, pid, p_batch, p_qty, p_slot, nullif(btrim(coalesce(p_shelf, '')), ''))
    on conflict (machine_id, batch_id, location) do update set quantity = public.stock.quantity + excluded.quantity
    returning id, quantity into sid, newq;
  end if;
  insert into public.stock_movements (machine_id, stock_id, batch_id, change, quantity_after, reason, note, scan_event_id, actor_id)
  values (p_machine, sid, p_batch, p_qty, newq, p_reason, p_note, p_event, p_actor);
  return sid;
end $$;

-- Takes up to p_qty off one stock row (never below zero) and logs it. Returns how many were taken. Internal.
create or replace function public._stock_take(p_stock uuid, p_qty int, p_reason public.stock_reason, p_event uuid, p_note text, p_actor uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare st public.stock%rowtype; n int;
begin
  select * into st from public.stock where id = p_stock for update;
  if st.id is null then return 0; end if;
  n := least(p_qty, st.quantity);
  if n <= 0 then return 0; end if;
  update public.stock set quantity = quantity - n where id = st.id;
  insert into public.stock_movements (machine_id, stock_id, batch_id, change, quantity_after, reason, note, scan_event_id, actor_id)
  values (st.machine_id, st.id, st.batch_id, -n, st.quantity - n, p_reason, p_note, p_event, p_actor);
  return n;
end $$;

-- ---------- GET /api/device/snapshot ----------------------------------------
create or replace function public.device_snapshot(p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m public.machines%rowtype;
begin
  select * into m from public.machines where id = public.device_by_key(p_key);
  if m.id is null then return null; end if;
  update public.machines set last_seen_at = now() where id = m.id;

  return jsonb_build_object(
    'serverTime', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'device', jsonb_build_object('deviceId', m.code, 'type', m.type, 'name', m.name),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('productId', p.id, 'productName', p.name, 'strength', p.strength,
                                          'manufacturer', p.manufacturer, 'packSize', p.pack_size) order by p.name, p.strength)
        from public.products p), '[]'::jsonb),
    'batches', coalesce((
      select jsonb_agg(jsonb_build_object('productId', p.id, 'productName', p.name, 'strength', p.strength,
                                          'batchCode', b.batch_code, 'mfd', b.mfd, 'exp', b.exp, 'mrp', b.mrp,
                                          'locked', l.r is not null, 'lockReason', l.r) order by p.name, b.exp)
        from public.batches b join public.products p on p.id = b.product_id
        cross join lateral (select public.batch_lock_reason(b.product_id, b.batch_code, b.exp, b.source, null) as r) l
       where b.source <> 'unverified'), '[]'::jsonb),
    'recalls', coalesce((
      select jsonb_agg(jsonb_build_object('productId', p.id, 'productName', p.name, 'strength', p.strength,
                                          'batchCode', r.batch_code, 'reason', r.reason, 'recalledOn', r.recalled_on) order by r.recalled_on desc)
        from public.recalls r join public.products p on p.id = r.product_id), '[]'::jsonb),
    'stock', coalesce((
      select jsonb_agg(jsonb_build_object('productId', s.product_id, 'productName', s.product_name, 'strength', s.strength,
                                          'batchCode', s.batch_code, 'quantity', s.quantity, 'shelf', s.shelf, 'slotNo', s.slot_no,
                                          'notConfirmed', s.not_confirmed, 'locked', s.lock_reason is not null, 'lockReason', s.lock_reason)
                       order by s.product_name, s.exp)
        from public.stock_status s where s.machine_id = m.id and s.quantity > 0), '[]'::jsonb)
  );
end $$;

-- ---------- POST /api/device/events -----------------------------------------
-- One event. Returns {eventId, status: saved|duplicate|rejected, error?, decision?}. Internal.
create or replace function public.device_apply_event(p_machine uuid, p_code text, p_type public.device_type, e jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  eid      text;
  t        timestamptz;
  v_mode   public.scan_mode;
  v_dec    public.scan_decision;
  applied  public.scan_decision;
  pid      uuid;
  pname    text;
  pa       text;
  f        jsonb := '{}'::jsonb;
  k        text;
  fv       jsonb;
  st       text;
  val      text;
  vals     jsonb := '{}'::jsonb;   -- k -> value
  sts      jsonb := '{}'::jsonb;   -- k -> status
  qty      int := 1;
  v_sold   boolean := false;
  mm       boolean := false;
  att      int;
  secs     numeric;
  sev      uuid;
  problems text[] := '{}';
  v_outcome  text;
  rstatus  public.review_status := 'none';
  code     text;
  code_ok  boolean;
  b        public.batches%rowtype;
  lock     text;
  sid      uuid;
  conflict boolean := false;
  ok_mfd   text; ok_exp text; ok_mrp text;
  fmt_ym   constant text := '^[0-9]{4}-(0[1-9]|1[0-2])$';
  fmt_mrp  constant text := '^[0-9]{1,6}\.[0-9]{2}$';
begin
  if jsonb_typeof(e) is distinct from 'object' then
    return jsonb_build_object('eventId', null, 'status', 'rejected', 'error', 'event must be an object');
  end if;
  eid := e->>'eventId';
  if jsonb_typeof(e->'eventId') is distinct from 'string' or char_length(eid) not between 1 and 100 then
    return jsonb_build_object('eventId', left(eid, 100), 'status', 'rejected', 'error', 'eventId must be text, 1-100 characters');
  end if;

  -- ---- shape and values (anything wrong rejects the event) ----
  if e->>'deviceId' is distinct from p_code then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'deviceId does not match this key');
  end if;
  if jsonb_typeof(e->'time') is distinct from 'string'
     or (e->>'time') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?(Z|[+-][0-9]{2}:?[0-9]{2})$' then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'time must be ISO 8601 with a timezone');
  end if;
  begin
    t := (e->>'time')::timestamptz;
  exception when others then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'time is not a real date');
  end;
  if t > now() + interval '10 minutes' then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'time is in the future');
  end if;
  if coalesce(e->>'mode', '') not in ('restock', 'check') then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'mode must be restock or check');
  end if;
  v_mode := (e->>'mode')::public.scan_mode;
  if coalesce(e->>'decision', '') not in ('ACCEPT', 'REVIEW', 'REFUSE') then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'decision must be ACCEPT, REVIEW or REFUSE');
  end if;
  v_dec := (e->>'decision')::public.scan_decision;
  pa := coalesce(e->>'personAnswer', '');
  if pa not in ('', 'yes', 'no') then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'personAnswer must be yes, no or empty');
  end if;

  if jsonb_typeof(e->'productId') = 'string' and e->>'productId' <> '' then
    if (e->>'productId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'productId is not a valid id');
    end if;
    select id into pid from public.products where id = (e->>'productId')::uuid;   -- unknown id = not recognised
  elsif e ? 'productId' and jsonb_typeof(e->'productId') not in ('null', 'string') then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'productId must be text or null');
  end if;
  if e ? 'productName' and jsonb_typeof(e->'productName') not in ('null', 'string') then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'productName must be text');
  end if;
  pname := nullif(btrim(coalesce(e->>'productName', '')), '');
  if char_length(pname) > 200 then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'productName is longer than 200 characters');
  end if;
  if v_dec = 'ACCEPT' and pname is null then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'productName is required for ACCEPT');
  end if;

  if e ? 'fields' and jsonb_typeof(e->'fields') is distinct from 'object' then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'fields must be an object');
  end if;
  foreach k in array array['batch', 'mfd', 'exp', 'mrp'] loop
    fv := e->'fields'->k;
    if fv is null or jsonb_typeof(fv) = 'null' then
      st := 'not_found'; val := '';
    elsif jsonb_typeof(fv) <> 'object' or coalesce(fv->>'status', '') not in ('confirmed', 'read', 'from_record', 'not_found')
          or (fv ? 'value' and jsonb_typeof(fv->'value') not in ('string', 'null')) then
      return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', format('fields.%s needs a text value and a valid status', k));
    else
      st := fv->>'status';
      val := case when st = 'not_found' then '' else btrim(coalesce(fv->>'value', '')) end;
      if char_length(val) > 100 then
        return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', format('fields.%s value is too long', k));
      end if;
    end if;
    f := f || jsonb_build_object(k, jsonb_build_object('value', val, 'status', st));
    vals := vals || jsonb_build_object(k, val);
    sts := sts || jsonb_build_object(k, st);
  end loop;

  if e ? 'matchedMaster' and jsonb_typeof(e->'matchedMaster') not in ('boolean', 'null') then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'matchedMaster must be true or false');
  end if;
  mm := coalesce((e->>'matchedMaster')::boolean, false);
  if e ? 'sold' and jsonb_typeof(e->'sold') not in ('boolean', 'null') then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'sold must be true or false');
  end if;
  v_sold := coalesce((e->>'sold')::boolean, false);
  if e ? 'quantity' and jsonb_typeof(e->'quantity') <> 'null' then
    if jsonb_typeof(e->'quantity') <> 'number' or (e->>'quantity')::numeric % 1 <> 0 or (e->>'quantity')::numeric not between 1 and 1000 then
      return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'quantity must be a whole number from 1 to 1000');
    end if;
    qty := (e->>'quantity')::int;
  end if;
  if e ? 'attempts' and jsonb_typeof(e->'attempts') <> 'null' then
    if jsonb_typeof(e->'attempts') <> 'number' or (e->>'attempts')::numeric not in (1, 2, 3) then
      return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'attempts must be 1, 2 or 3');
    end if;
    att := (e->>'attempts')::int;
  end if;
  if e ? 'seconds' and jsonb_typeof(e->'seconds') <> 'null' then
    if jsonb_typeof(e->'seconds') <> 'number' or (e->>'seconds')::numeric not between 0 and 99999 then
      return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'seconds must be a number of 0 or more');
    end if;
    secs := round((e->>'seconds')::numeric, 2);
  end if;
  if (e ? 'reason' and jsonb_typeof(e->'reason') not in ('string', 'null')) or char_length(e->>'reason') > 500 then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'reason must be text up to 500 characters');
  end if;
  if (e ? 'softwareVersion' and jsonb_typeof(e->'softwareVersion') not in ('string', 'null')) or char_length(e->>'softwareVersion') > 40 then
    return jsonb_build_object('eventId', eid, 'status', 'rejected', 'error', 'softwareVersion must be text up to 40 characters');
  end if;

  -- ---- save once (same eventId twice = duplicate) ----
  insert into public.scan_events (machine_id, event_id, device_code, scanned_at, mode, product_id, product_name, fields,
                                  matched_master, decision, reason, person_answer, quantity, sold, attempts, seconds, software_version)
  values (p_machine, eid, p_code, t, v_mode, pid, pname, f, mm, v_dec, nullif(btrim(coalesce(e->>'reason', '')), ''),
          nullif(pa, ''), qty, v_sold, att, secs, nullif(btrim(coalesce(e->>'softwareVersion', '')), ''))
  on conflict (machine_id, event_id) do nothing
  returning id into sev;
  if sev is null then
    return jsonb_build_object('eventId', eid, 'status', 'duplicate');
  end if;

  code := upper(vals->>'batch');
  code_ok := sts->>'batch' <> 'not_found' and code ~ '^[A-Z0-9][A-Z0-9./-]{0,39}$';
  ok_mfd := case when vals->>'mfd' ~ fmt_ym then vals->>'mfd' end;
  ok_exp := case when vals->>'exp' ~ fmt_ym then vals->>'exp' end;
  ok_mrp := case when vals->>'mrp' ~ fmt_mrp then vals->>'mrp' end;
  applied := v_dec;

  if v_mode = 'restock' and v_dec = 'ACCEPT' then
    -- ---- restock ACCEPT: trusted only if every check passes ----
    if pid is null then problems := problems || 'product not recognised'; end if;
    if not code_ok then problems := problems || 'batch number missing or not in the right format'; end if;
    if cardinality(problems) = 0 then
      select * into b from public.batches where product_id = pid and batch_code = code;
      if mm then
        if b.id is null or b.source = 'unverified' then
          problems := problems || 'no confirmed batch with this number on the server';
        else
          foreach k in array array['mfd', 'exp', 'mrp'] loop
            if sts->>k in ('confirmed', 'read') and vals->>k is distinct from (to_jsonb(b)->>k) then
              problems := problems || format('%s read as %s but the record says %s', upper(k), vals->>k, to_jsonb(b)->>k);
            end if;
          end loop;
        end if;
      else
        foreach k in array array['mfd', 'exp', 'mrp'] loop
          if sts->>k = 'from_record' then
            problems := problems || format('%s marked from_record without a master match', upper(k));
          elsif sts->>k not in ('confirmed', 'read') then
            problems := problems || format('%s not read', upper(k));
          end if;
        end loop;
        if ok_mfd is null or ok_exp is null or ok_mrp is null then
          problems := problems || 'MFD/EXP must be YYYY-MM and MRP like 140.70';
        elsif ok_mfd > ok_exp then
          problems := problems || 'MFD is after EXP';
        end if;
        if cardinality(problems) = 0 then
          if b.id is null then
            insert into public.batches (product_id, batch_code, mfd, exp, mrp, source, created_by_device, confirmed_at)
            values (pid, code, ok_mfd, ok_exp, ok_mrp, 'confirmed_on_device', p_machine, now()) returning * into b;
          elsif b.source = 'unverified' then
            update public.batches set mfd = ok_mfd, exp = ok_exp, mrp = ok_mrp, source = 'confirmed_on_device', confirmed_at = now()
             where id = b.id returning * into b;
          elsif (b.mfd, b.exp, b.mrp) is distinct from (ok_mfd, ok_exp, ok_mrp) then
            problems := problems || format('disagrees with the confirmed batch (MFD %s, EXP %s, MRP %s)', b.mfd, b.exp, b.mrp);
          end if;
        end if;
      end if;
    end if;
    if cardinality(problems) = 0 then
      lock := public.batch_lock_reason(b.product_id, b.batch_code, b.exp, b.source, p_type);
      if lock in ('expired', 'recalled') then problems := problems || format('batch is %s', lock); end if;
    end if;
    if cardinality(problems) = 0 then
      perform public._stock_add(p_machine, b.id, qty, null, null, true, 'scan_restock', sev, null, null);
      v_outcome := format('Added %s to stock', qty);
    else
      applied := 'REVIEW';
      v_outcome := 'Saved as REVIEW: ' || array_to_string(problems, '; ');
    end if;
  end if;

  if v_mode = 'restock' and applied = 'REVIEW' then
    -- ---- restock REVIEW: add as "not confirmed" when the product and batch number are known ----
    rstatus := 'open';
    if pid is null then
      v_outcome := concat_ws('. ', v_outcome, 'Waiting for the owner to choose the product');
    elsif not code_ok then
      v_outcome := concat_ws('. ', v_outcome, 'Waiting: batch number missing');
    else
      select * into b from public.batches where product_id = pid and batch_code = code;
      if b.id is not null and b.source <> 'unverified' then
        foreach k in array array['mfd', 'exp', 'mrp'] loop
          if sts->>k in ('confirmed', 'read') and (case k when 'mrp' then ok_mrp else case when vals->>k ~ fmt_ym then vals->>k end end) is not null
             and vals->>k is distinct from (to_jsonb(b)->>k) then
            conflict := true;
          end if;
        end loop;
      elsif b.id is null then
        insert into public.batches (product_id, batch_code, mfd, exp, mrp, source, created_by_device)
        values (pid, code, case when ok_exp is null or ok_mfd <= ok_exp then ok_mfd end, ok_exp, ok_mrp, 'unverified', p_machine)
        returning * into b;
      end if;
      if conflict then
        v_outcome := concat_ws('. ', v_outcome, 'Waiting: differs from the confirmed batch, nothing added');
      else
        lock := public.batch_lock_reason(b.product_id, b.batch_code, b.exp, b.source, p_type);
        if lock in ('expired', 'recalled') then
          v_outcome := concat_ws('. ', v_outcome, format('Waiting: batch is %s, nothing added', lock));
        else
          perform public._stock_add(p_machine, b.id, qty, null, null, true, 'scan_restock', sev, null, null);
          v_outcome := concat_ws('. ', v_outcome, format('Added %s to stock%s', qty, case when b.source = 'unverified' then ' (not confirmed)' else '' end));
        end if;
      end if;
    end if;

  elsif v_mode = 'restock' and applied = 'REFUSE' then
    rstatus := 'open';
    v_outcome := 'Refused by the device. Nothing added';

  elsif v_mode = 'check' then
    if code_ok then
      if pid is not null then
        select * into b from public.batches where product_id = pid and batch_code = code;
      else
        select bb.* into b from public.batches bb join public.stock s on s.batch_id = bb.id
         where s.machine_id = p_machine and bb.batch_code = code order by s.quantity desc limit 1;
      end if;
    end if;
    if v_dec = 'ACCEPT' and v_sold then
      if b.id is not null then
        select id into sid from public.stock where machine_id = p_machine and batch_id = b.id and quantity > 0 order by quantity desc limit 1;
      end if;
      if sid is null then
        rstatus := 'open';
        v_outcome := 'Sold, but this device has no stock of that batch';
      else
        perform public._stock_take(sid, 1, 'scan_sold', sev, null, null);
        lock := public.batch_lock_reason(b.product_id, b.batch_code, b.exp, b.source, p_type);
        if lock is not null then
          rstatus := 'open';
          v_outcome := format('Sold 1, but the batch is locked (%s)', replace(lock, '_', ' '));
        else
          v_outcome := 'Sold 1';
        end if;
      end if;
    elsif v_dec = 'ACCEPT' then
      v_outcome := 'Checked, not sold';
    elsif v_dec = 'REVIEW' then
      rstatus := 'open';
      v_outcome := 'Needs review';
    else
      v_outcome := 'Reject bin';
    end if;
  end if;

  update public.scan_events
     set applied_decision = applied, outcome = left(v_outcome, 500), review_status = rstatus, batch_id = b.id
   where id = sev;
  return jsonb_build_object('eventId', eid, 'status', 'saved', 'decision', applied);
end $$;

create or replace function public.device_ingest_events(p_key text, p_events jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m    public.machines%rowtype;
  e    jsonb;
  res  jsonb;
  out  jsonb := '[]'::jsonb;
begin
  select * into m from public.machines where id = public.device_by_key(p_key);
  if m.id is null then return null; end if;
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) > 100 then
    raise exception 'events must be an array of at most 100';
  end if;
  update public.machines set last_seen_at = now() where id = m.id;
  for e in select value from jsonb_array_elements(p_events) loop
    begin
      res := public.device_apply_event(m.id, m.code, m.type, e);
    exception when others then
      -- Anything unexpected rejects just this event; the others still save.
      res := jsonb_build_object('eventId', left(e->>'eventId', 100), 'status', 'rejected', 'error', 'server could not process this event');
    end;
    out := out || jsonb_build_array(res);
  end loop;
  return jsonb_build_object('results', out);
end $$;

-- ============================================================================
-- Step 5 — the owner reviews scans
-- ============================================================================

-- Confirm (or correct) a review item. For restock scans the given product and batch facts are used:
-- the batch becomes confirmed_on_website and the quantity is in stock exactly once.
create or replace function public.vendor_review_confirm(
  p_event uuid, p_product_id uuid, p_batch_code text, p_mfd text, p_exp text, p_mrp text,
  p_quantity int, p_slot_no int, p_shelf text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  ev     public.scan_events%rowtype;
  dtype  public.device_type;
  code   text := upper(btrim(coalesce(p_batch_code, '')));
  b      public.batches%rowtype;
  lock   text;
  added  int;
  old_sid uuid;
  same   boolean;
  result public.review_status;
begin
  select * into ev from public.scan_events where id = p_event for update;
  if ev.id is null or not public.owns_device(ev.machine_id) then raise exception 'Scan not found'; end if;
  if ev.review_status <> 'open' then raise exception 'This scan has already been reviewed'; end if;

  if ev.mode = 'check' then
    update public.scan_events set review_status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now() where id = ev.id;
    return 'confirmed';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then raise exception 'Choose the medicine'; end if;
  if code !~ '^[A-Z0-9][A-Z0-9./-]{0,39}$' then raise exception 'Enter the batch number as printed'; end if;
  if coalesce(p_mfd, '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or coalesce(p_exp, '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     or coalesce(p_mrp, '') !~ '^[0-9]{1,6}\.[0-9]{2}$' then
    raise exception 'Enter the batch number, MFD, EXP and MRP exactly as printed';
  end if;
  if p_mfd > p_exp then raise exception 'Enter the batch number, MFD, EXP and MRP exactly as printed: MFD is after EXP'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 10000 then raise exception 'Quantity must be between 1 and 10000'; end if;

  select type into dtype from public.machines where id = ev.machine_id;
  if dtype = 'vending' then
    if p_slot_no is null or not exists (select 1 from public.machine_slots where machine_id = ev.machine_id and slot_no = p_slot_no) then
      raise exception 'Choose a slot on this machine';
    end if;
    p_shelf := null;
  else
    p_slot_no := null;
  end if;

  -- The shared batch: create it, confirm an unverified one, or refuse a conflict with a confirmed one.
  select * into b from public.batches where product_id = p_product_id and batch_code = code for update;
  if b.id is null then
    insert into public.batches (product_id, batch_code, mfd, exp, mrp, source, created_by, confirmed_by, confirmed_at)
    values (p_product_id, code, p_mfd, p_exp, p_mrp, 'confirmed_on_website', auth.uid(), auth.uid(), now()) returning * into b;
  elsif b.source = 'unverified' then
    update public.batches set mfd = p_mfd, exp = p_exp, mrp = p_mrp, source = 'confirmed_on_website', confirmed_by = auth.uid(), confirmed_at = now()
     where id = b.id returning * into b;
  elsif (b.mfd, b.exp, b.mrp) is distinct from (p_mfd, p_exp, p_mrp) then
    raise exception 'Batch % is already recorded as MFD %, EXP %, MRP %. Please check the strip.', code, b.mfd, b.exp, b.mrp;
  end if;
  lock := public.batch_lock_reason(b.product_id, b.batch_code, b.exp, b.source, dtype);
  if lock in ('expired', 'recalled') then
    raise exception 'This batch is %, so it can''t be added for sale. Delete the scan instead.', lock;
  end if;

  -- What this scan already put in stock (if anything).
  select coalesce(sum(change), 0), (array_agg(stock_id order by id desc))[1] into added, old_sid
    from public.stock_movements where scan_event_id = ev.id;

  if added > 0 and ev.batch_id = b.id and added = p_quantity and p_slot_no is null and nullif(btrim(coalesce(p_shelf, '')), '') is null then
    null;  -- already in stock exactly as confirmed
  else
    if added > 0 and old_sid is not null then
      perform public._stock_take(old_sid, added, 'review_confirm', ev.id, 'Replaced in review', auth.uid());
    end if;
    perform public._stock_add(ev.machine_id, b.id, p_quantity, p_slot_no, p_shelf,
                              p_slot_no is null and nullif(btrim(coalesce(p_shelf, '')), '') is null,
                              'review_confirm', ev.id, 'Confirmed in review', auth.uid());
  end if;

  same := ev.product_id is not distinct from p_product_id
          and upper(coalesce(ev.fields->'batch'->>'value', '')) = code
          and coalesce(ev.fields->'mfd'->>'value', '') = p_mfd
          and coalesce(ev.fields->'exp'->>'value', '') = p_exp
          and coalesce(ev.fields->'mrp'->>'value', '') = p_mrp
          and ev.quantity = p_quantity;
  result := case when same then 'confirmed' else 'corrected' end;
  update public.scan_events set review_status = result, reviewed_by = auth.uid(), reviewed_at = now(), batch_id = b.id where id = ev.id;
  return result;
end $$;

-- Delete a review item: anything it added to stock is taken off again (logged).
create or replace function public.vendor_review_delete(p_event uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare ev public.scan_events%rowtype; added int; sid uuid;
begin
  select * into ev from public.scan_events where id = p_event for update;
  if ev.id is null or not public.owns_device(ev.machine_id) then raise exception 'Scan not found'; end if;
  if ev.review_status <> 'open' then raise exception 'This scan has already been reviewed'; end if;
  select coalesce(sum(change), 0), (array_agg(stock_id order by id desc))[1] into added, sid
    from public.stock_movements where scan_event_id = ev.id;
  if added > 0 and sid is not null then
    perform public._stock_take(sid, added, 'manual_removed', ev.id, 'Scan deleted in review', auth.uid());
  end if;
  update public.scan_events set review_status = 'deleted', reviewed_by = auth.uid(), reviewed_at = now() where id = ev.id;
end $$;

-- Permissions: devices call the two API functions without a session; helpers are internal.
do $$
declare f text;
begin
  foreach f in array array['public.device_by_key(text)',
    'public._stock_add(uuid, uuid, int, int, text, boolean, public.stock_reason, uuid, text, uuid)',
    'public._stock_take(uuid, int, public.stock_reason, uuid, text, uuid)',
    'public.device_apply_event(uuid, text, public.device_type, jsonb)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['public.device_snapshot(text)', 'public.device_ingest_events(text, jsonb)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
  foreach f in array array['public.vendor_review_confirm(uuid, uuid, text, text, text, text, int, int, text)', 'public.vendor_review_delete(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
