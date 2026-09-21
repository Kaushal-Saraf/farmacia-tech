-- ============================================================================
-- Farmacia Tech — database schema (Supabase / Postgres)
-- Run this once in Supabase → SQL Editor. Safe to read top to bottom.
-- Every table has Row Level Security ON: the browser can only see rows the
-- policies below allow.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- Enums ----------------------------------------------------------
create type public.app_role as enum ('patient', 'doctor', 'vendor', 'admin');
create type public.application_status as enum ('pending', 'approved', 'rejected');
create type public.prescription_status as enum ('issued', 'paid', 'dispensed', 'cancelled');
create type public.item_kind as enum ('medicine', 'test', 'injection');
create type public.order_status as enum ('pending_payment', 'paid', 'dispensed', 'refunded', 'expired');

-- ---------- Profiles (1:1 with auth.users) ----------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.app_role not null default 'patient',
  full_name   text check (char_length(full_name) between 2 and 120),
  phone       text unique,
  created_at  timestamptz not null default now()
);

-- Create a profile automatically when someone signs up with phone OTP.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Supabase stores phone without '+'; keep E.164 (+91…) in profiles.
  insert into public.profiles (id, phone)
  values (new.id, case when new.phone is null or new.phone = '' then null
                       when left(new.phone, 1) = '+' then new.phone else '+' || new.phone end);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers used by policies (security definer avoids recursive RLS lookups).
create or replace function public.my_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- ---------- Doctor verification ---------------------------------------------
create table public.doctor_applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references public.profiles (id) on delete cascade,
  full_name        text not null check (char_length(full_name) between 2 and 120),
  registration_no  text not null check (char_length(registration_no) between 3 and 40),
  council          text not null,           -- e.g. NMC, Delhi Medical Council
  qualification    text not null,           -- e.g. MBBS, MD
  document_path    text,                    -- Supabase Storage path (Phase 2)
  status           public.application_status not null default 'pending',
  reviewed_by      uuid references public.profiles (id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

-- Approving an application promotes the user to doctor (admins only).
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
    update public.profiles set role = 'doctor', full_name = coalesce(full_name,
      (select full_name from public.doctor_applications where id = application_id))
    where id = uid;
  end if;
end $$;

-- ---------- Machines & slots -----------------------------------------------
create table public.machines (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- printed on the machine, e.g. FT-GZB-001
  name        text not null,
  address     text,
  latitude    double precision,
  longitude   double precision,
  owner_id    uuid references public.profiles (id),   -- the vendor / operator
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.machine_slots (
  id            uuid primary key default gen_random_uuid(),
  machine_id    uuid not null references public.machines (id) on delete cascade,
  slot_no       int  not null check (slot_no > 0),
  medicine_name text,
  strength      text,                         -- e.g. 500 mg
  units_per_pack int check (units_per_pack > 0),
  price_paise   int check (price_paise >= 0), -- store money as integer paise
  stock_packs   int not null default 0 check (stock_packs >= 0),
  reserved_packs int not null default 0 check (reserved_packs >= 0),
  batch_no      text,
  expires_on    date,
  unique (machine_id, slot_no)
);

-- ---------- Prescriptions ----------------------------------------------------
create table public.prescriptions (
  id          uuid primary key default gen_random_uuid(),
  doctor_id   uuid not null references public.profiles (id),
  patient_id  uuid not null references public.profiles (id),
  doctor_name  text,                          -- snapshot, filled by trigger
  patient_name text,                          -- snapshot, filled by trigger
  title       text not null,
  notes       text,
  advice      text,
  vitals      jsonb not null default '{}'::jsonb,  -- height, weight, bp, blood group
  status      public.prescription_status not null default 'issued',
  created_at  timestamptz not null default now()
);

-- Names are copied from profiles at issue time (like a printed prescription),
-- so patients never need read access to the doctor's profile row and vice versa.
create or replace function public.fill_prescription_names()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.doctor_name  := (select full_name from public.profiles where id = new.doctor_id);
  new.patient_name := (select full_name from public.profiles where id = new.patient_id);
  return new;
end $$;

create trigger prescriptions_fill_names
  before insert on public.prescriptions
  for each row execute function public.fill_prescription_names();

create table public.prescription_items (
  id               uuid primary key default gen_random_uuid(),
  prescription_id  uuid not null references public.prescriptions (id) on delete cascade,
  kind             public.item_kind not null default 'medicine',
  name             text not null,
  strength         text,
  per_day          int check (per_day > 0),
  days             int check (days > 0),
  instructions     text
);

-- Doctors look patients up by phone number and only get back id + name.
create or replace function public.find_patient_by_phone(p_phone text)
returns table (id uuid, full_name text) language sql stable security definer set search_path = '' as $$
  select id, full_name from public.profiles
   where phone = p_phone and public.my_role() in ('doctor', 'admin')
$$;

-- ---------- Orders & single-use dispense tokens (Phase 3) -------------------
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  prescription_id  uuid not null references public.prescriptions (id),
  patient_id       uuid not null references public.profiles (id),
  machine_id       uuid not null references public.machines (id),
  amount_paise     int not null check (amount_paise >= 0),
  status           public.order_status not null default 'pending_payment',
  payment_ref      text,                    -- Razorpay payment id
  created_at       timestamptz not null default now()
);

create table public.dispense_tokens (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null unique references public.orders (id) on delete cascade,
  token_hash  text not null unique,        -- store only a hash of the QR secret
  expires_at  timestamptz not null,
  used_at     timestamptz
);

-- ---------- Marketing leads -------------------------------------------------
create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  phone         text,
  organisation  text,
  type          text not null,
  message       text not null,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.doctor_applications enable row level security;
alter table public.machines            enable row level security;
alter table public.machine_slots       enable row level security;
alter table public.prescriptions       enable row level security;
alter table public.prescription_items  enable row level security;
alter table public.orders              enable row level security;
alter table public.dispense_tokens     enable row level security;
alter table public.leads               enable row level security;

-- Profiles: read your own (admins read all); you may only change your name.
create policy "profiles: read own" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name) on public.profiles to authenticated;

-- Doctor applications
create policy "apps: insert own" on public.doctor_applications for insert
  with check (user_id = auth.uid());
create policy "apps: read own or admin" on public.doctor_applications for select
  using (user_id = auth.uid() or public.is_admin());
create policy "apps: resubmit own while pending" on public.doctor_applications for update
  using (user_id = auth.uid() and status <> 'approved') with check (user_id = auth.uid());
revoke update on public.doctor_applications from authenticated, anon;
grant update (user_id, full_name, registration_no, council, qualification, document_path) on public.doctor_applications to authenticated;

-- Machines: any signed-in user can see active machines (to pick one nearby).
create policy "machines: read active" on public.machines for select
  using (is_active or owner_id = auth.uid() or public.is_admin());
create policy "machines: admin write" on public.machines for all
  using (public.is_admin()) with check (public.is_admin());

create policy "slots: read" on public.machine_slots for select using (auth.uid() is not null);
create policy "slots: owner or admin update" on public.machine_slots for update
  using (public.is_admin() or exists (select 1 from public.machines m where m.id = machine_id and m.owner_id = auth.uid()));
create policy "slots: admin insert/delete" on public.machine_slots for all
  using (public.is_admin()) with check (public.is_admin());

-- Prescriptions: visible to the patient and the issuing doctor only.
create policy "rx: read own" on public.prescriptions for select
  using (patient_id = auth.uid() or doctor_id = auth.uid() or public.is_admin());
create policy "rx: verified doctors insert" on public.prescriptions for insert
  with check (doctor_id = auth.uid() and status = 'issued' and public.my_role() = 'doctor');

create policy "rx items: read with parent" on public.prescription_items for select
  using (exists (select 1 from public.prescriptions p where p.id = prescription_id
                 and (p.patient_id = auth.uid() or p.doctor_id = auth.uid() or public.is_admin())));
create policy "rx items: doctor insert" on public.prescription_items for insert
  with check (exists (select 1 from public.prescriptions p where p.id = prescription_id and p.doctor_id = auth.uid()));

-- Orders: patients read their own. Writes happen server-side (service role) in Phase 3.
create policy "orders: read own" on public.orders for select
  using (patient_id = auth.uid() or public.is_admin());
-- dispense_tokens: no policies → only the server (service role) can touch them.

-- Leads: anyone can submit the contact form; only admins can read.
create policy "leads: anyone insert" on public.leads for insert to anon, authenticated with check (true);
create policy "leads: admin read" on public.leads for select using (public.is_admin());

-- ============================================================================
-- After you sign in for the first time, make yourself admin:
--   update public.profiles set role = 'admin' where phone = '91XXXXXXXXXX';
-- ============================================================================
