"use server";

import { redirect } from "next/navigation";
import { normalisePhone, requireViewer } from "@/lib/auth";

export type PatientLookup = { patient?: { id: string; full_name: string | null }; error?: string };

export async function findPatient(_prev: PatientLookup, formData: FormData): Promise<PatientLookup> {
  const { supabase } = await requireViewer(["doctor", "admin"]);
  const phone = normalisePhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Enter a valid 10-digit mobile number." };
  const { data, error } = await supabase.rpc("find_patient_by_phone", { p_phone: phone });
  if (error) return { error: "Lookup failed. Please try again." };
  const patient = (data as { id: string; full_name: string | null }[] | null)?.[0];
  if (!patient) {
    return { error: "No patient with this number yet. Ask them to sign in once on Farmacia Tech, then try again." };
  }
  return { patient };
}

export type RxItem = {
  kind: "medicine" | "test" | "injection";
  name: string;
  strength?: string;
  per_day?: string;
  days?: string;
  instructions?: string;
};

export type RxState = { error?: string };

export async function createPrescription(_prev: RxState, formData: FormData): Promise<RxState> {
  const { supabase } = await requireViewer(["doctor"]);

  const patientId = String(formData.get("patient_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/.test(patientId)) return { error: "Choose a patient first." };
  if (title.length < 2) return { error: "Add a diagnosis or title." };

  let items: RxItem[] = [];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Couldn't read the items. Please try again." };
  }
  items = items
    .map((i) => ({ ...i, name: String(i.name ?? "").trim() }))
    .filter((i) => i.name.length > 0);
  if (items.length === 0) return { error: "Add at least one medicine, test or injection." };
  for (const i of items) {
    if (i.kind === "medicine" && (!Number(i.per_day) || !Number(i.days))) {
      return { error: `Set times per day and number of days for ${i.name}.` };
    }
  }

  const vitals = Object.fromEntries(
    ["height_cm", "weight_kg", "bp", "pulse", "temperature_f", "blood_group"]
      .map((k) => [k, String(formData.get(k) ?? "").trim()])
      .filter(([, v]) => v),
  );

  const { data, error } = await supabase.rpc("create_prescription", {
    p_patient_id: patientId,
    p_title: title.slice(0, 200),
    p_notes: String(formData.get("notes") ?? "").slice(0, 2000),
    p_advice: String(formData.get("advice") ?? "").slice(0, 2000),
    p_vitals: vitals,
    p_items: items,
  });
  if (error || !data) return { error: "Couldn't save the prescription. Please try again." };

  redirect(`/app/prescriptions/${data}`);
}
