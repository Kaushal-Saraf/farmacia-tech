"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { normalisePhone, requireViewer } from "@/lib/auth";

export type MachineState = { error?: string; ok?: string };

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

export async function createMachine(_prev: MachineState, formData: FormData): Promise<MachineState> {
  const { supabase } = await requireViewer(["admin"]);
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const latitude = num(formData.get("latitude"));
  const longitude = num(formData.get("longitude"));
  const slots = Number(formData.get("slots"));
  const ownerPhone = String(formData.get("owner_phone") ?? "").trim();

  if (!/^[A-Z0-9-]{3,20}$/.test(code)) return { error: "Machine code: 3–20 letters, numbers or dashes (e.g. FT-GZB-001)." };
  if (name.length < 2) return { error: "Give the machine a name." };
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return { error: "Latitude and longitude must be numbers." };
  if (!Number.isInteger(slots) || slots < 1 || slots > 200) return { error: "Slots must be between 1 and 200." };

  const { data: machine, error } = await supabase
    .from("machines")
    .insert({ code, name, address, latitude, longitude })
    .select("id")
    .single();
  if (error || !machine) {
    return { error: error?.code === "23505" ? "A machine with that code already exists." : "Couldn't create the machine." };
  }

  const { error: slotErr } = await supabase
    .from("machine_slots")
    .insert(Array.from({ length: slots }, (_, i) => ({ machine_id: machine.id, slot_no: i + 1 })));
  if (slotErr) return { error: "Machine created, but slots failed. Open it and try again." };

  if (ownerPhone) {
    const phone = normalisePhone(ownerPhone);
    if (phone) await supabase.rpc("assign_machine_owner", { p_machine_id: machine.id, p_phone: phone });
  }

  redirect(`/app/vendor/${machine.id}`);
}

export async function assignOwner(_prev: MachineState, formData: FormData): Promise<MachineState> {
  const { supabase } = await requireViewer(["admin"]);
  const machineId = String(formData.get("machine_id"));
  const phone = normalisePhone(String(formData.get("owner_phone") ?? ""));
  if (!phone) return { error: "Enter a valid 10-digit mobile number." };
  const { error } = await supabase.rpc("assign_machine_owner", { p_machine_id: machineId, p_phone: phone });
  if (error) return { error: error.message.includes("signed in") ? "That number hasn't signed in to Farmacia Tech yet." : "Couldn't assign the operator." };
  revalidatePath(`/app/vendor/${machineId}`);
  return { ok: "Operator assigned." };
}

export async function setMachineActive(formData: FormData) {
  const { supabase } = await requireViewer(["admin"]);
  const id = String(formData.get("machine_id"));
  await supabase.from("machines").update({ is_active: formData.get("active") === "true" }).eq("id", id);
  revalidatePath(`/app/vendor/${id}`);
}

/** Saves every slot row on the stock sheet in one go. Field names look like `s:<slot id>:<field>`. */
export async function saveSlots(_prev: MachineState, formData: FormData): Promise<MachineState> {
  const { supabase } = await requireViewer(["vendor", "admin"]);
  const machineId = String(formData.get("machine_id"));
  const rows = new Map<string, Record<string, string>>();
  for (const [key, value] of formData.entries()) {
    const m = /^s:([0-9a-f-]{36}):(\w+)$/.exec(key);
    if (!m) continue;
    const row = rows.get(m[1]) ?? {};
    row[m[2]] = String(value).trim();
    rows.set(m[1], row);
  }

  for (const [id, r] of rows) {
    const price = r.price ? Math.round(Number(r.price) * 100) : null;
    const stock = r.stock ? Number(r.stock) : 0;
    const perPack = r.units ? Number(r.units) : null;
    if ([price, perPack].some((v) => v !== null && (!Number.isFinite(v) || v < 0)) || !Number.isInteger(stock) || stock < 0) {
      return { error: "Check the numbers: price, units per pack and stock must be positive." };
    }
    const { error } = await supabase
      .from("machine_slots")
      .update({
        medicine_name: r.medicine || null,
        strength: r.strength || null,
        units_per_pack: perPack,
        price_paise: price,
        stock_packs: r.medicine ? stock : 0,
        batch_no: r.batch || null,
        expires_on: r.expiry || null,
      })
      .eq("id", id);
    if (error) return { error: "Couldn't save. Please try again." };
  }
  revalidatePath(`/app/vendor/${machineId}`);
  revalidatePath("/app/vendor");
  return { ok: "Stock saved." };
}
