"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";

/** "Removed": takes the whole locked quantity off the device and logs why. */
export async function removeLocked(formData: FormData) {
  const { supabase } = await requireViewer(["vendor", "admin"]);
  const stockId = String(formData.get("stock_id") ?? "");
  const quantity = Number(formData.get("quantity"));
  const reason = formData.get("reason") === "recalled" ? "removed_recalled" : "removed_expired";
  if (!/^[0-9a-f-]{36}$/.test(stockId) || !Number.isInteger(quantity) || quantity < 1) return;
  await supabase.rpc("vendor_reduce_stock", { p_stock_id: stockId, p_quantity: quantity, p_reason: reason, p_note: "Removed from the alerts page" });
  revalidatePath("/app/vendor", "layout");
}
