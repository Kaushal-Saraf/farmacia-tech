"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { availableSides, requireViewer } from "@/lib/auth";
import { SIDE_COOKIE, SIDE_COOKIE_OPTIONS, isSide } from "@/lib/side";

/** Account actions shared by every side: your name, and switching side. */
export type FormState = { error?: string; ok?: boolean };

export async function saveName(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireViewer();
  const name = String(formData.get("full_name") ?? "").trim();
  if (name.length < 2 || name.length > 120) return { error: "Please enter your full name." };
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", profile.id);
  if (error) return { error: "Couldn't save. Please try again." };
  redirect("/app");
}

/** Switch between the sides this number holds (patient / doctor / operator / admin). */
export async function switchSide(formData: FormData) {
  await requireViewer();
  const side = formData.get("side");
  if (isSide(side) && (await availableSides()).includes(side)) {
    (await cookies()).set(SIDE_COOKIE, side, SIDE_COOKIE_OPTIONS);
  }
  redirect("/app");
}
