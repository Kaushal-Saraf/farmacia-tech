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
