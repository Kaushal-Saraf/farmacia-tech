"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type ContactState = { status: "idle" | "success" | "error"; message?: string };

const TYPES = ["partner", "doctor", "investor", "patient", "other"] as const;

export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  // Honeypot: bots fill hidden fields.
  if (formData.get("company_website")) return { status: "success" };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const organisation = String(formData.get("organisation") ?? "").trim();
  const type = String(formData.get("type") ?? "other");
  const message = String(formData.get("message") ?? "").trim();

  if (name.length < 2) return { status: "error", message: "Please enter your name." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { status: "error", message: "Please enter a valid email address." };
  if (phone && !/^[+\d\s-]{7,16}$/.test(phone)) return { status: "error", message: "Please enter a valid phone number." };
  if (!TYPES.includes(type as (typeof TYPES)[number])) return { status: "error", message: "Please choose an enquiry type." };
  if (message.length < 10) return { status: "error", message: "Tell us a little more (at least 10 characters)." };

  const lead = {
    name: name.slice(0, 120),
    email: email.slice(0, 200),
    phone: phone || null,
    organisation: organisation.slice(0, 200) || null,
    type,
    message: message.slice(0, 4000),
  };

  if (!isSupabaseConfigured) {
    console.info("[contact] Supabase not configured — lead not stored:", lead);
    return { status: "success" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert(lead);
  if (error) {
    console.error("[contact] insert failed", error);
    return { status: "error", message: "Something went wrong. Please email us instead." };
  }
  return { status: "success" };
}
