"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { parseMember } from "@/lib/family-form";

export type FamilyState = { error?: string; ok?: string };

const isUuid = (v: string) => /^[0-9a-f-]{36}$/.test(v);

function refresh() {
  revalidatePath("/app/patient");
  revalidatePath("/app/patient/family");
}

export async function addMember(_prev: FamilyState, formData: FormData): Promise<FamilyState> {
  const { supabase, profile } = await requireViewer(["patient"]);
  const m = parseMember(formData);
  if ("error" in m) return m;
  const { error } = await supabase.from("family_members").insert({ ...m, account_id: profile.id, added_by: profile.id });
  if (error) return { error: "Couldn't add. Please try again." };
  refresh();
  return { ok: `${m.full_name} added.` };
}

export async function updateMember(_prev: FamilyState, formData: FormData): Promise<FamilyState> {
  const { supabase, profile } = await requireViewer(["patient"]);
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: "Something went wrong." };
  const m = parseMember(formData, { allowSelf: true });
  if ("error" in m) return m;

  if (m.relation === "self") {
    // The account holder's name lives on their profile; a trigger copies it to their "self" entry.
    const { error: nameErr } = await supabase.from("profiles").update({ full_name: m.full_name }).eq("id", profile.id);
    if (nameErr) return { error: "Couldn't save. Please try again." };
    const { error } = await supabase.from("family_members").update({ birth_date: m.birth_date, gender: m.gender }).eq("id", id).eq("relation", "self");
    if (error) return { error: "Couldn't save. Please try again." };
  } else {
    const { data, error } = await supabase.from("family_members").update(m).eq("id", id).neq("relation", "self").select("id");
    if (error || !data?.length) return { error: "Couldn't save. Please try again." };
  }
  refresh();
  return { ok: "Saved." };
}

/** Hides the person; their past prescriptions stay in the account. */
export async function removeMember(formData: FormData) {
  const { supabase } = await requireViewer(["patient"]);
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return;
  await supabase.from("family_members").update({ is_archived: true }).eq("id", id).neq("relation", "self");
  refresh();
}
