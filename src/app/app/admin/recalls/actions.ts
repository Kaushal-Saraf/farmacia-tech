"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { normaliseBatchCode } from "@/lib/medicine";

export type RecallState = { error?: string; ok?: string };

export async function addRecall(_prev: RecallState, formData: FormData): Promise<RecallState> {
  const { supabase, profile } = await requireViewer(["admin"]);
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const productId = g("product_id");
  const batch = normaliseBatchCode(g("batch_code"));
  const reason = g("reason");
  const date = g("recalled_on");
  if (!/^[0-9a-f-]{36}$/.test(productId)) return { error: "Choose the medicine." };
  if (!batch) return { error: "Batch number: capital letters, digits and - / . only, no spaces." };
  if (reason.length < 2 || reason.length > 500) return { error: "Give the reason for the recall." };
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Check the date." };

  // Row-level security allows this only for a fully verified admin session.
  const { error } = await supabase.from("recalls").insert({
    product_id: productId,
    batch_code: batch,
    reason,
    notice_ref: g("notice_ref") || null,
    ...(date && { recalled_on: date }),
    created_by: profile.id,
  });
  if (error) return { error: error.code === "23505" ? "That batch is already on the recall list." : "Couldn't save. Please try again." };
  revalidatePath("/app", "layout");
  return { ok: `${batch} recalled. It is now locked from sale on every device.` };
}

export async function removeRecall(formData: FormData) {
  const { supabase } = await requireViewer(["admin"]);
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await supabase.from("recalls").delete().eq("id", id);
  revalidatePath("/app", "layout");
}
