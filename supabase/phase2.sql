-- ============================================================================
-- Farmacia Tech — Phase 2
-- Run AFTER schema.sql (Supabase → SQL Editor → paste → Run).
-- Adds: prescription writer RPC, public machine list, machine-owner
-- assignment, slot column permissions, and private storage for doctor documents.
-- ============================================================================

-- ---------- Machines: public list without exposing owners -------------------
drop policy if exists "machines: read active" on public.machines;
create policy "machines: read (signed in)" on public.machines for select to authenticated
  using (is_active or owner_id = auth.uid() or public.is_admin());

create or replace function public.public_machines()
returns table (code text, name text, address text, latitude double precision, longitude double precision)
language sql stable security definer set search_path = '' as $$
  select code, name, address, latitude, longitude
    from public.machines where is_active order by name
$$;
grant execute on function public.public_machines() to anon, authenticated;

-- Admin: assign a machine to an operator by phone (promotes a patient to vendor).
create or replace function public.assign_machine_owner(p_machine_id uuid, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select id into uid from public.profiles where phone = p_phone;
  if uid is null then raise exception 'No user with that phone has signed in yet'; end if;
  update public.profiles set role = 'vendor' where id = uid and role = 'patient';
  update public.machines set owner_id = uid where id = p_machine_id;
end $$;

-- Operators may edit stock details only; reserved_packs is managed by the server.
revoke update on public.machine_slots from authenticated, anon;
grant update (medicine_name, strength, units_per_pack, price_paise, stock_packs, batch_no, expires_on)
  on public.machine_slots to authenticated;

-- ---------- Prescription writer ---------------------------------------------
-- Creates a prescription and its items in one transaction.
-- SECURITY INVOKER: the RLS policies from 001 still decide who may insert.
create or replace function public.create_prescription(
  p_patient_id uuid,
  p_title      text,
  p_notes      text,
  p_advice     text,
  p_vitals     jsonb,
  p_items      jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare rx_id uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item';
  end if;

  insert into public.prescriptions (doctor_id, patient_id, title, notes, advice, vitals)
  values (auth.uid(), p_patient_id, p_title, nullif(p_notes, ''), nullif(p_advice, ''), coalesce(p_vitals, '{}'::jsonb))
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

-- ---------- Private storage for doctor documents ----------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('doctor-docs', 'doctor-docs', false, 4194304, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Files live at doctor-docs/<user id>/<file>. Users manage their own folder; admins can read all.
create policy "doctor-docs: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'doctor-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "doctor-docs: update own" on storage.objects for update to authenticated
  using (bucket_id = 'doctor-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "doctor-docs: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'doctor-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
