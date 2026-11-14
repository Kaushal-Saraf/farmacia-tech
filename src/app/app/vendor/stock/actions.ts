"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { MRP, YEAR_MONTH, normaliseBatchCode, normaliseMrp } from "@/lib/medicine";

export type StockState = { error?: string; ok?: string };

const isUuid = (v: string) => /^[0-9a-f-]{36}$/.test(v);

/** Database messages written for people are passed through; anything else gets a generic message. */
function friendly(message: string | undefined, fallback: string) {
  const known = ["already recorded", "can't be added", "Choose a slot", "Choose the medicine", "Enter the", "Quantity must", "Only ", "locked", "Count must", "Device not found", "Stock not found"];
  return message && known.some((k) => message.includes(k)) ? message : fallback;
}

function refresh(machineId: string) {
  revalidatePath("/app/vendor/stock");
  revalidatePath(`/app/vendor/${machineId}`);
}

/** Add a batch by hand, typed from the strip. */
export async function addStock(_prev: StockState, formData: FormData): Promise<StockState> {
  const { supabase } = await requireViewer(["vendor", "admin"]);
  const g = (k: string) => String(formData.get(k) ?? "").trim();

  const machineId = g("machine_id");
  if (!isUuid(machineId)) return { error: "Choose the device." };

  // Medicine: an existing one from the list, or a new one added to the shared list.
  let productId = g("product_id");
  if (productId === "new") {
    if (g("new_name").length < 2) return { error: "Enter the medicine name." };
    const { data, error } = await supabase.rpc("vendor_get_or_create_product", {
      p_name: g("new_name"),
      p_strength: g("new_strength"),
      p_manufacturer: g("new_manufacturer"),
      p_pack_size: g("new_pack_size"),
    });
    if (error || !data) return { error: "Couldn't save the medicine. Please try again." };
    productId = data as string;
  }
  if (!isUuid(productId)) return { error: "Choose the medicine." };

  const batchCode = normaliseBatchCode(g("batch_code"));
  if (!batchCode) return { error: "Batch number: capital letters, digits and - / . only, no spaces (e.g. NBT-240586)." };
  const mfd = g("mfd");
  const exp = g("exp");
  if (!YEAR_MONTH.test(mfd) || !YEAR_MONTH.test(exp)) return { error: "Enter MFD and EXP as month and year." };
  if (mfd > exp) return { error: "MFD can't be after EXP." };
  const mrp = normaliseMrp(g("mrp"));
  if (!mrp || !MRP.test(mrp)) return { error: "Enter the MRP printed on the strip, e.g. 140.70." };
  const quantity = Number(g("quantity"));
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) return { error: "Quantity must be a whole number from 1 to 10000." };
  const slot = g("slot_no") ? Number(g("slot_no")) : null;
  const shelf = g("shelf") || null;
  if (shelf && shelf.length > 40) return { error: "Keep the shelf name under 40 characters." };

  const { error } = await supabase.rpc("vendor_add_stock", {
    p_machine_id: machineId,
    p_product_id: productId,
    p_batch_code: batchCode,
    p_mfd: mfd,
    p_exp: exp,
    p_mrp: mrp,
    p_quantity: quantity,
    p_slot_no: slot,
    p_shelf: shelf,
    p_note: g("note") || null,
  });
  if (error) return { error: friendly(error.message, "Couldn't add the stock. Please try again.") };
  refresh(machineId);
  redirect(`/app/vendor/stock?device=${machineId}&added=1`);
}

/** Set count, record sold, or remove — one form per stock row. */
export async function changeStock(_prev: StockState, formData: FormData): Promise<StockState> {
  const { supabase } = await requireViewer(["vendor", "admin"]);
  const stockId = String(formData.get("stock_id") ?? "");
  const machineId = String(formData.get("machine_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const quantity = Number(formData.get("quantity"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  if (!isUuid(stockId) || !isUuid(machineId)) return { error: "Something went wrong." };
  if (!Number.isInteger(quantity)) return { error: "Enter a whole number." };

  if (action === "set") {
    const { error } = await supabase.rpc("vendor_set_stock_quantity", { p_stock_id: stockId, p_quantity: quantity, p_note: note });
    if (error) return { error: friendly(error.message, "Couldn't save. Please try again.") };
  } else if (action === "sold" || action === "remove") {
    const reason = action === "sold" ? "manual_sold" : String(formData.get("reason") ?? "");
    if (!["manual_sold", "manual_removed", "removed_expired", "removed_recalled"].includes(reason)) return { error: "Choose a reason." };
    const { error } = await supabase.rpc("vendor_reduce_stock", { p_stock_id: stockId, p_quantity: quantity, p_reason: reason, p_note: note });
    if (error) return { error: friendly(error.message, "Couldn't save. Please try again.") };
  } else {
    return { error: "Something went wrong." };
  }
  refresh(machineId);
  return { ok: "Saved." };
}
