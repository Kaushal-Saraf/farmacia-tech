-- ============================================================================
-- Farmacia Tech — vendor devices, shared medicine master, private stock
-- Run ONCE, after schema.sql and phase2.sql. Then run vendor-functions.sql
-- (that one is safe to re-run, and grows with each build step).
--
-- Shared by everyone:   products, batches, recalls
-- Private per vendor:   devices (machines), stock, stock_movements, scan_events
-- ============================================================================

-- ---------- Enums ----------------------------------------------------------
create type public.device_type   as enum ('vending', 'checker');
create type public.batch_source  as enum ('confirmed_on_device', 'confirmed_on_website', 'unverified');
create type public.scan_mode     as enum ('restock', 'check');
create type public.scan_decision as enum ('ACCEPT', 'REVIEW', 'REFUSE');
create type public.review_status as enum ('none', 'open', 'confirmed', 'corrected', 'deleted');
create type public.stock_reason  as enum (
  'scan_restock',      -- device restock scan added stock
  'scan_sold',         -- device check scan, sold = true
  'manual_set',        -- vendor typed a new quantity
  'manual_add',        -- vendor added a batch by hand
  'manual_sold',       -- vendor recorded a sale
  'manual_removed',    -- vendor removed stock for another reason
  'removed_expired',   -- taken off the shelf: expired
  'removed_recalled',  -- taken off the shelf: recalled
  'review_confirm'     -- stock created when a review item was confirmed
);

-- ---------- Devices: extend the existing machines table ---------------------
-- `machines` keeps its name so existing code and the orders table keep working.
-- code = device ID printed on the device (e.g. FT-CHK-001); address/lat/lng = location.
alter table public.machines
  add column type            public.device_type not null default 'vending',
  add column device_key_hash text unique,            -- SHA-256 hex of the key; the key itself is never stored
  add column last_seen_at    timestamptz,
  add column low_stock_at    int not null default 2 check (low_stock_at between 0 and 1000);

-- Devices are private to their vendor now (patients find vending machines via public_machines()).
drop policy if exists "machines: read (signed in)" on public.machines;
create policy "machines: owner or admin read" on public.machines for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
create policy "machines: owner update" on public.machines for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- What a browser may change directly. Code, type, owner and key go through functions only.
revoke update on public.machines from authenticated, anon;
grant update (name, address, latitude, longitude, low_stock_at, is_active) on public.machines to authenticated;

-- Old per-slot stock columns are no longer used (stock lives in public.stock); slots stay as the layout.
drop policy if exists "slots: read" on public.machine_slots;
create policy "slots: owner or admin read" on public.machine_slots for select to authenticated
  using (public.is_admin() or exists (select 1 from public.machines m where m.id = machine_id and m.owner_id = auth.uid()));

-- ---------- Shared master: products, batches, recalls -----------------------
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(btrim(name)) between 2 and 120),
  strength      text check (char_length(strength) <= 60),        -- e.g. 500 mg
  manufacturer  text check (char_length(manufacturer) <= 120),
  pack_size     text check (char_length(pack_size) <= 60),       -- e.g. 10 tablets
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create unique index products_identity
  on public.products (lower(btrim(name)), lower(coalesce(strength, '')), lower(coalesce(manufacturer, '')));

-- Formats are fixed because the device software depends on them:
--   batch_code  exactly as printed, capitals, hyphens kept    NBT-240586
--   mfd / exp   YYYY-MM                                       2026-05
--   mrp         text, two decimals                            140.70
create table public.batches (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products (id) on delete restrict,
  batch_code         text not null check (batch_code ~ '^[A-Z0-9][A-Z0-9./-]{0,39}$'),
  mfd                text check (mfd ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  exp                text check (exp ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  mrp                text check (mrp ~ '^[0-9]{1,6}\.[0-9]{2}$'),
  source             public.batch_source not null default 'unverified',
  created_by         uuid references public.profiles (id) on delete set null,
  created_by_device  uuid references public.machines (id) on delete set null,
  confirmed_by       uuid references public.profiles (id) on delete set null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now(),
  unique (product_id, batch_code),
  -- A confirmed batch must have every printed fact; an unverified one may have gaps.
  check (source = 'unverified' or (mfd is not null and exp is not null and mrp is not null)),
  check (mfd is null or exp is null or mfd <= exp)
);

-- Matched on product + batch code, so a recall can be entered before the batch is ever scanned.
create table public.recalls (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  batch_code   text not null check (batch_code ~ '^[A-Z0-9][A-Z0-9./-]{0,39}$'),
  reason       text not null check (char_length(btrim(reason)) between 2 and 500),
  notice_ref   text check (char_length(notice_ref) <= 120),   -- e.g. CDSCO alert number
  recalled_on  date not null default current_date,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (product_id, batch_code)
);

-- ---------- Private: stock, scan events, movement log -----------------------
create table public.stock (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid references public.profiles (id) on delete set null,   -- kept equal to the device owner by trigger
  machine_id  uuid not null references public.machines (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete restrict,
  batch_id    uuid not null references public.batches (id) on delete restrict,
  quantity    int  not null default 0 check (quantity between 0 and 100000),
  slot_no     int  check (slot_no > 0),                                  -- vending machine
  shelf       text check (char_length(btrim(shelf)) between 1 and 40),   -- medicine checker
  location    text generated always as (coalesce('slot:' || slot_no::text, 'shelf:' || lower(btrim(shelf)), '')) stored,
  updated_at  timestamptz not null default now(),
  check (slot_no is null or shelf is null),
  unique (machine_id, batch_id, location)
);
create index stock_vendor on public.stock (vendor_id);
create index stock_batch on public.stock (batch_id);

create table public.scan_events (
  id               uuid primary key default gen_random_uuid(),
  machine_id       uuid not null references public.machines (id) on delete cascade,
  vendor_id        uuid references public.profiles (id) on delete set null,
  event_id         text not null check (char_length(event_id) between 1 and 100),  -- made by the device
  device_code      text not null,                                                  -- deviceId as sent
  scanned_at       timestamptz not null,
  received_at      timestamptz not null default now(),
  mode             public.scan_mode not null,
  product_id       uuid references public.products (id) on delete set null,
  product_name     text check (char_length(product_name) <= 200),
  fields           jsonb not null default '{}'::jsonb,   -- {batch|mfd|exp|mrp: {value, status}}
  matched_master   boolean not null default false,
  decision         public.scan_decision not null,        -- as decided by the device
  reason           text check (char_length(reason) <= 500),
  person_answer    text check (person_answer in ('yes', 'no')),
  quantity         int not null default 1 check (quantity between 1 and 1000),
  sold             boolean not null default false,
  attempts         int check (attempts between 1 and 3),
  seconds          numeric(8, 2) check (seconds >= 0),
  software_version text check (char_length(software_version) <= 40),
  -- What the server did with it
  batch_id         uuid references public.batches (id) on delete set null,
  outcome          text check (char_length(outcome) <= 500),
  review_status    public.review_status not null default 'none',
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  unique (machine_id, event_id)                          -- same eventId twice = saved once
);
create index scan_events_vendor_time on public.scan_events (vendor_id, scanned_at desc);
create index scan_events_machine_time on public.scan_events (machine_id, scanned_at desc);
create index scan_events_open_review on public.scan_events (vendor_id) where review_status = 'open';

create table public.stock_movements (
  id              bigint generated always as identity primary key,
  vendor_id       uuid references public.profiles (id) on delete set null,
  machine_id      uuid not null references public.machines (id) on delete cascade,
  stock_id        uuid references public.stock (id) on delete set null,
  batch_id        uuid not null references public.batches (id) on delete restrict,
  change          int  not null check (change <> 0),
  quantity_after  int  not null check (quantity_after >= 0),
  reason          public.stock_reason not null,
  note            text check (char_length(note) <= 500),
  scan_event_id   uuid references public.scan_events (id) on delete set null,
  actor_id        uuid references public.profiles (id) on delete set null,   -- null when a device did it
  created_at      timestamptz not null default now()
);
create index stock_movements_vendor_time on public.stock_movements (vendor_id, created_at desc);

-- ---------- Keep vendor_id and product consistent ---------------------------
create or replace function public.fill_vendor_from_device()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.vendor_id := (select owner_id from public.machines where id = new.machine_id);
  return new;
end $$;

create trigger stock_vendor before insert or update of machine_id on public.stock
  for each row execute function public.fill_vendor_from_device();
create trigger scan_events_vendor before insert or update of machine_id on public.scan_events
  for each row execute function public.fill_vendor_from_device();
create trigger stock_movements_vendor before insert on public.stock_movements
  for each row execute function public.fill_vendor_from_device();

-- Stock rows must match their batch's product, and use slots on vending machines / shelves on checkers.
create or replace function public.check_stock_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare dtype public.device_type;
begin
  if new.product_id <> (select product_id from public.batches where id = new.batch_id) then
    raise exception 'Stock product does not match the batch product';
  end if;
  select type into dtype from public.machines where id = new.machine_id;
  if dtype = 'checker' and new.slot_no is not null then
    raise exception 'A medicine checker uses shelves, not slots';
  end if;
  if dtype = 'vending' and new.shelf is not null then
    raise exception 'A vending machine uses slots, not shelves';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger stock_check before insert or update on public.stock
  for each row execute function public.check_stock_row();

-- When a device changes hands, its private records follow it.
create or replace function public.move_device_records()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.stock           set vendor_id = new.owner_id where machine_id = new.id;
  update public.scan_events     set vendor_id = new.owner_id where machine_id = new.id;
  update public.stock_movements set vendor_id = new.owner_id where machine_id = new.id;
  return new;
end $$;

create trigger machines_owner_changed after update of owner_id on public.machines
  for each row when (old.owner_id is distinct from new.owner_id)
  execute function public.move_device_records();

-- ============================================================================
-- Row Level Security
-- Website writes to stock / batches / scan events go through the functions in
-- vendor-functions.sql, so the tables themselves are read-only to browsers.
-- ============================================================================
alter table public.products        enable row level security;
alter table public.batches         enable row level security;
alter table public.recalls         enable row level security;
alter table public.stock           enable row level security;
alter table public.scan_events     enable row level security;
alter table public.stock_movements enable row level security;

-- Shared facts: readable by every signed-in user. Vendors may add products; admins fix them.
create policy "products: read" on public.products for select to authenticated using (true);
create policy "products: vendors add" on public.products for insert to authenticated
  with check (created_by = auth.uid() and public.my_role() in ('vendor', 'admin'));
create policy "products: admin edit" on public.products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "batches: read" on public.batches for select to authenticated using (true);
create policy "batches: admin edit" on public.batches for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "recalls: read" on public.recalls for select to authenticated using (true);
create policy "recalls: admin write" on public.recalls for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Private: each vendor sees only their own rows.
create policy "stock: own" on public.stock for select to authenticated
  using (vendor_id = auth.uid() or public.is_admin());
create policy "scan events: own" on public.scan_events for select to authenticated
  using (vendor_id = auth.uid() or public.is_admin());
create policy "movements: own" on public.stock_movements for select to authenticated
  using (vendor_id = auth.uid() or public.is_admin());

-- The public machine finder lists vending machines only; checkers are internal benches.
create or replace function public.public_machines()
returns table (code text, name text, address text, latitude double precision, longitude double precision)
language sql stable security definer set search_path = '' as $$
  select code, name, address, latitude, longitude
    from public.machines where is_active and type = 'vending' order by name
$$;
