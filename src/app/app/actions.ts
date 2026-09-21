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
  const app: Record<string, string> = {
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

  const file = formData.get("document");
  let document_path: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > 4 * 1024 * 1024) return { error: "The document must be under 4 MB." };
    const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" }[file.type];
    if (!ext) return { error: "Upload a PDF, JPG or PNG." };
    document_path = `${profile.id}/registration.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("doctor-docs")
      .upload(document_path, file, { upsert: true, contentType: file.type });
    if (upErr) return { error: "Couldn't upload the document. Please try again." };
  }

  const { error } = await supabase
    .from("doctor_applications")
    .upsert(document_path ? { ...app, document_path } : app, { onConflict: "user_id" });
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
