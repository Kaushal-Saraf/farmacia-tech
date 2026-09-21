import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Profile, Role } from "@/lib/types";

/** The signed-in user and their profile, fetched once per request. */
export const getViewer = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) return null;
  return { user, profile, supabase };
});

/** Use at the top of every protected page. Redirects if signed out or wrong role. */
export async function requireViewer(roles?: Role[]) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (roles && !roles.includes(viewer.profile.role)) redirect("/app");
  return viewer;
}

/** Only allow redirects back into the portal, never to other sites. */
export function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
}

/** Normalise an Indian mobile number to E.164 (+91XXXXXXXXXX). Returns null if invalid. */
export function normalisePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}
