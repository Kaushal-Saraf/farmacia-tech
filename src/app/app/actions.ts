"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";

export type FormState = { error?: string; ok?: boolean };

export async function saveName(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireViewer();
  const name = String(formData.get("full_name") ?? "").trim();
  if (name.length < 2 || name.length > 120) return { error: "Please enter your full name." };
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", profile.id);
  if (error) return { error: "Couldn't save. Please try again." };
  redirect("/app");
}

export async function applyAsDoctor(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireViewer();
  const app = {
    user_id: profile.id,
    full_name: String(formData.get("full_name") ?? "").trim(),
    registration_no: String(formData.get("registration_no") ?? "").trim().toUpperCase(),
    council: String(formData.get("council") ?? "").trim(),
    qualification: String(formData.get("qualification") ?? "").trim(),
  };
  if (app.full_name.length < 2) return { error: "Enter your name as registered." };
  if (!/^[A-Z0-9/-]{3,40}$/.test(app.registration_no)) return { error: "Enter a valid registration number." };
  if (!app.council) return { error: "Select your medical council." };
  if (app.qualification.length < 2) return { error: "Enter your qualification (e.g. MBBS)." };

  const { error } = await supabase.from("doctor_applications").upsert(app, { onConflict: "user_id" });
  if (error) return { error: "Couldn't submit. Please try again." };
  revalidatePath("/app/doctor");
  return { ok: true };
}

export async function reviewApplication(formData: FormData) {
  const { supabase } = await requireViewer(["admin"]);
  const id = String(formData.get("id"));
  const approve = formData.get("decision") === "approve";
  await supabase.rpc("review_doctor_application", { application_id: id, approve });
  revalidatePath("/app/admin");
}
