"use server";

import { redirect } from "next/navigation";
import { normalisePhone, requireViewer } from "@/lib/auth";
import { parseMember } from "@/lib/family-form";
import type { FamilyMember } from "@/lib/types";

export type Family = { account_id: string; members: FamilyMember[] };
export type PatientLookup = { family?: Family; error?: string };

/** Finds the patient account for a mobile number and lists the family members on it. */
export async function findPatient(_prev: PatientLookup, formData: FormData): Promise<PatientLookup> {
  const { supabase } = await requireViewer(["doctor", "admin"]);
  const phone = normalisePhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Enter a valid 10-digit mobile number." };
  const { data, error } = await supabase.rpc("find_family_by_phone", { p_phone: phone });
  if (error) return { error: "Lookup failed. Please try again." };
  if (!data) {
    return { error: "No patient with this number yet. Ask them to sign in once on Farmacia Tech, then try again." };
  }
  return { family: data as Family };
}

export type AddMemberState = { member?: FamilyMember; error?: string };

/** Adds someone who isn't listed yet (e.g. a child's first visit) to the patient's number. */
export async function addFamilyMember(_prev: AddMemberState, formData: FormData): Promise<AddMemberState> {
  const { supabase } = await requireViewer(["doctor"]);
  // "self" is allowed only when the account holder isn't listed yet; the database enforces that.
  const parsed = parseMember(formData, { allowSelf: true });
  if ("error" in parsed) return parsed;
  const accountId = String(formData.get("account_id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(accountId)) return { error: "Look the patient up again." };
  const { data, error } = await supabase.rpc("doctor_add_family_member", {
    p_account_id: accountId,
    p_full_name: parsed.full_name,
    p_relation: parsed.relation,
    p_birth_date: parsed.birth_date,
    p_gender: parsed.gender,
  });
  if (error || !data) return { error: "Couldn't add this person. Please try again." };
  return { member: { id: data as string, ...parsed } };
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
  const memberId = String(formData.get("member_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/.test(patientId)) return { error: "Choose a patient first." };
  if (!/^[0-9a-f-]{36}$/.test(memberId)) return { error: "Choose who the prescription is for." };
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
    p_member_id: memberId,
    p_title: title.slice(0, 200),
    p_notes: String(formData.get("notes") ?? "").slice(0, 2000),
    p_advice: String(formData.get("advice") ?? "").slice(0, 2000),
    p_vitals: vitals,
    p_items: items,
  });
  if (error || !data) return { error: "Couldn't save the prescription. Please try again." };

  redirect(`/app/prescriptions/${data}`);
}
