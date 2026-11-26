"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { hashDeviceKey, hashPairingCode, newDeviceCode, newDeviceKey, newPairingCode } from "@/lib/devices";
import { deviceTypeLabel } from "@/lib/device-labels";
import type { DeviceType } from "@/lib/types";

export type DeviceFormState = { error?: string; ok?: string };

/** Secrets are returned once, straight after they're made, and never stored in plain text. */
export type Credentials = { machineId: string; code: string; type: DeviceType; pairingCode?: string; deviceKey?: string };
export type CredentialState = { error?: string; created?: Credentials };

const isUuid = (v: string) => /^[0-9a-f-]{36}$/.test(v);

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

// ---------- Farmacia Tech (admin) -------------------------------------------

/** Registers a device and returns its Device ID, pairing code and device key (shown once). */
export async function registerDevice(_prev: CredentialState, formData: FormData): Promise<CredentialState> {
  const { supabase } = await requireViewer(["admin"]);
  const type = formData.get("type");
  if (type !== "vending" && type !== "checker") return { error: "Choose the type of device." };

  const custom = String(formData.get("code") ?? "").trim().toUpperCase();
  if (custom && !/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(custom)) {
    return { error: "Device ID: 3–20 letters, numbers or dashes, or leave it blank to generate one." };
  }
  const slots = Number(formData.get("slots"));
  if (type === "vending" && (!Number.isInteger(slots) || slots < 1 || slots > 200)) {
    return { error: "Slots must be between 1 and 200." };
  }
  const name = String(formData.get("name") ?? "").trim() || deviceTypeLabel[type];
  if (name.length > 80) return { error: "Keep the name under 80 characters." };

  const pairingCode = newPairingCode();
  const deviceKey = newDeviceKey();

  // A generated ID could (very rarely) collide, so try a few.
  let machine: { id: string; code: string } | null = null;
  for (let attempt = 0; attempt < 5 && !machine; attempt++) {
    const code = custom || newDeviceCode(type);
    const { data, error } = await supabase
      .from("machines")
      .insert({ code, name, type, device_key_hash: hashDeviceKey(deviceKey), pairing_code_hash: hashPairingCode(pairingCode) })
      .select("id, code")
      .single();
    if (data) machine = data;
    else if (error?.code !== "23505") return { error: "Couldn't register the device." };
    else if (custom) return { error: "A device with that ID already exists." };
  }
  if (!machine) return { error: "Couldn't generate a unique Device ID. Please try again." };

  if (type === "vending") {
    const { error } = await supabase
      .from("machine_slots")
      .insert(Array.from({ length: slots }, (_, i) => ({ machine_id: machine.id, slot_no: i + 1 })));
    if (error) return { error: "Device registered, but its slots failed. Open it and contact support." };
  }

  revalidatePath("/app/vendor");
  return { created: { machineId: machine.id, code: machine.code, type, pairingCode, deviceKey } };
}

/** Issues a new pairing code (to hand a device to a new operator) or a new device key. */
export async function resetDeviceSecret(_prev: CredentialState, formData: FormData): Promise<CredentialState> {
  const { supabase } = await requireViewer(["admin"]);
  const machineId = String(formData.get("machine_id") ?? "");
  const which = formData.get("which");
  if (!isUuid(machineId) || (which !== "pairing" && which !== "key")) return { error: "Something went wrong." };

  const { data: m } = await supabase.from("machines").select("code, type").eq("id", machineId).maybeSingle();
  if (!m) return { error: "Device not found." };

  const pairingCode = which === "pairing" ? newPairingCode() : undefined;
  const deviceKey = which === "key" ? newDeviceKey() : undefined;
  const { error } = await supabase.rpc("set_device_secrets", {
    p_machine_id: machineId,
    p_key_hash: deviceKey ? hashDeviceKey(deviceKey) : null,
    p_pairing_hash: pairingCode ? hashPairingCode(pairingCode) : null,
  });
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath(`/app/vendor/${machineId}`);
  return { created: { machineId, code: m.code, type: m.type, pairingCode, deviceKey } };
}

export async function setMachineActive(formData: FormData) {
  const { supabase } = await requireViewer(["admin"]);
  const id = String(formData.get("machine_id"));
  await supabase.from("machines").update({ is_active: formData.get("active") === "true" }).eq("id", id);
  revalidatePath(`/app/vendor/${id}`);
}

// ---------- Operator --------------------------------------------------------

/** Links a device to the signed-in operator using the Device ID and pairing code from Farmacia Tech. */
export async function linkDevice(_prev: DeviceFormState, formData: FormData): Promise<DeviceFormState> {
  const { supabase } = await requireViewer();
  const code = String(formData.get("code") ?? "").trim();
  const pairing = String(formData.get("pairing_code") ?? "").trim();
  if (!code) return { error: "Enter the Device ID." };
  if (pairing.replace(/[^A-Za-z0-9]/g, "").length !== 8) return { error: "The pairing code has 8 letters and numbers, like K7QM-3XHP." };

  const { data, error } = await supabase.rpc("claim_device", { p_code: code, p_pairing_code: pairing });
  if (error || !data) {
    const known = ["not correct", "sign in again"];
    return { error: error && known.some((k) => error.message.includes(k)) ? error.message : "Couldn't link the device. Please try again." };
  }
  revalidatePath("/app", "layout"); // the number may have just gained the operator role
  redirect(`/app/vendor/${data}`);
}

/** Name, location and low-stock limit. Code, type and owner can't be changed here. */
export async function updateDevice(_prev: DeviceFormState, formData: FormData): Promise<DeviceFormState> {
  const { supabase } = await requireViewer(["vendor", "admin"]);
  const id = String(formData.get("machine_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const latitude = num(formData.get("latitude"));
  const longitude = num(formData.get("longitude"));
  const lowStockAt = Number(formData.get("low_stock_at"));

  if (!isUuid(id)) return { error: "Device not found." };
  if (name.length < 2 || name.length > 80) return { error: "Give the device a name (2–80 characters)." };
  if (address && address.length > 200) return { error: "Keep the address under 200 characters." };
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return { error: "Latitude and longitude must be numbers." };
  if ((latitude === null) !== (longitude === null)) return { error: "Enter both latitude and longitude, or neither." };
  if (latitude !== null && (latitude < -90 || latitude > 90)) return { error: "Latitude must be between -90 and 90." };
  if (longitude !== null && (longitude < -180 || longitude > 180)) return { error: "Longitude must be between -180 and 180." };
  if (!Number.isInteger(lowStockAt) || lowStockAt < 0 || lowStockAt > 1000) return { error: "Low-stock alert must be a whole number from 0 to 1000." };

  // Row-level security only lets the owner (or an admin) update this row.
  const { data, error } = await supabase
    .from("machines")
    .update({ name, address, latitude, longitude, low_stock_at: lowStockAt })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: "Couldn't save. Please try again." };
  revalidatePath(`/app/vendor/${id}`);
  revalidatePath("/app/vendor");
  return { ok: "Saved." };
}
