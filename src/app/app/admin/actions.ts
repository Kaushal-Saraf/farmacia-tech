"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";

/** Approve or reject a doctor application. The database checks the admin is fully verified. */
export async function reviewApplication(formData: FormData) {
  const { supabase } = await requireViewer(["admin"]);
  const id = String(formData.get("id"));
  const approve = formData.get("decision") === "approve";
  await supabase.rpc("review_doctor_application", { application_id: id, approve });
  revalidatePath("/app/admin");
}
