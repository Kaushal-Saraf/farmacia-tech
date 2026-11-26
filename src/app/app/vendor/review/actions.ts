"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { MRP, YEAR_MONTH, normaliseBatchCode, normaliseMrp } from "@/lib/medicine";

export type ReviewState = { error?: string; ok?: string };

const isUuid = (v: string) => /^[0-9a-f-]{36}$/.test(v);

function friendly(message: string | undefined, fallback: string) {
  const known = ["already recorded", "can't be added", "Choose", "Enter the", "Quantity must", "already been reviewed", "Scan not found"];
  return message && known.some((k) => message.includes(k)) ? message : fallback;
}

function refresh() {
  revalidatePath("/app/vendor", "layout");
}

/** Confirm a review item; any field the owner changed makes it "corrected". */
export async function confirmReview(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const { supabase } = await requireViewer(["vendor", "admin"]);
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const eventId = g("event_id");
  if (!isUuid(eventId)) return { error: "Something went wrong." };

  if (g("mode") === "check") {
    const { error } = await supabase.rpc("vendor_review_confirm", {
      p_event: eventId, p_product_id: null, p_batch_code: null, p_mfd: null, p_exp: null, p_mrp: null, p_quantity: null, p_slot_no: null, p_shelf: null,
    });
    if (error) return { error: friendly(error.message, "Couldn't save. Please try again.") };
    refresh();
    return { ok: "Marked as reviewed." };
  }

  let productId = g("product_id");
  if (productId === "new") {
    if (g("new_name").length < 2) return { error: "Enter the medicine name." };
    const { data, error } = await supabase.rpc("vendor_get_or_create_product", {
      p_name: g("new_name"), p_strength: g("new_strength"), p_manufacturer: g("new_manufacturer"), p_pack_size: g("new_pack_size"),
    });
    if (error || !data) return { error: "Couldn't save the medicine. Please try again." };
    productId = data as string;
  }
  if (!isUuid(productId)) return { error: "Choose the medicine." };
  const batch = normaliseBatchCode(g("batch_code"));
  if (!batch) return { error: "Batch number: capital letters, digits and - / . only, no spaces." };
  const mfd = g("mfd");
  const exp = g("exp");
  if (!YEAR_MONTH.test(mfd) || !YEAR_MONTH.test(exp)) return { error: "Enter MFD and EXP as month and year." };
  if (mfd > exp) return { error: "MFD can't be after EXP." };
  const mrp = normaliseMrp(g("mrp"));
  if (!mrp || !MRP.test(mrp)) return { error: "Enter the MRP printed on the strip, e.g. 140.70." };
  const quantity = Number(g("quantity"));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) return { error: "Quantity must be a whole number from 1 to 10000." };

  const { data, error } = await supabase.rpc("vendor_review_confirm", {
    p_event: eventId,
    p_product_id: productId,
    p_batch_code: batch,
    p_mfd: mfd,
    p_exp: exp,
    p_mrp: mrp,
    p_quantity: quantity,
    p_slot_no: g("slot_no") ? Number(g("slot_no")) : null,
    p_shelf: g("shelf") || null,
  });
  if (error) return { error: friendly(error.message, "Couldn't save. Please try again.") };
  refresh();
  return { ok: data === "corrected" ? "Corrected and confirmed." : "Confirmed." };
}

export async function deleteReview(formData: FormData) {
  const { supabase } = await requireViewer(["vendor", "admin"]);
  const eventId = String(formData.get("event_id") ?? "");
  if (!isUuid(eventId)) return;
  await supabase.rpc("vendor_review_delete", { p_event: eventId });
  refresh();
}
