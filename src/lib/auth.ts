import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SIDE_COOKIE, isSide, type Side } from "@/lib/side";
import type { Profile, Role } from "@/lib/types";

/** The signed-in user and their profile, fetched once per request. */
export const getViewer = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const first = await supabase.from("profiles").select("id, role, roles, full_name, phone").eq("id", user.id).single<Profile>();
  let profile = first.data;
  const error = first.error;
  if (error?.code === "42703") {
    // supabase/roles.sql hasn't been run yet: treat the single role as the list.
    const old = await supabase.from("profiles").select("id, role, full_name, phone").eq("id", user.id).single<Omit<Profile, "roles">>();
    profile = old.data && { ...old.data, roles: [...new Set<Role>(["patient", old.data.role])] };
  }
  if (!profile) return null;
  return { user, profile, supabase };
});

export const hasRole = (profile: Pick<Profile, "roles">, role: Role) => profile.roles.includes(role);

/** Applied to be a doctor (pending or rejected) but not approved yet. */
export const isDoctorApplicant = cache(async () => {
  const viewer = await getViewer();
  if (!viewer || hasRole(viewer.profile, "doctor")) return false;
  const { data } = await viewer.supabase
    .from("doctor_applications")
    .select("id")
    .eq("user_id", viewer.profile.id)
    .maybeSingle();
  return Boolean(data);
});

/**
 * The side of the portal in use, from the sign-in door (cookie). Anyone may open the patient side,
 * the doctor side (to apply) and the operator side (to link a device); only admins the admin side.
 */
export const getSide = cache(async (): Promise<Side> => {
  const viewer = await getViewer();
  const saved = (await cookies()).get(SIDE_COOKIE)?.value;
  if (isSide(saved) && (saved !== "admin" || (viewer && hasRole(viewer.profile, "admin")))) return saved;
  return viewer ? viewer.profile.role : "patient";
});

/** Sides this number can switch to (the current one included). */
export async function availableSides(): Promise<Side[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  const p = viewer.profile;
  const out: Side[] = ["patient"];
  if (hasRole(p, "doctor") || (await isDoctorApplicant())) out.push("doctor");
  if (hasRole(p, "vendor")) out.push("vendor");
  if (hasRole(p, "admin")) out.push("admin");
  return out;
}

/** Use at the top of every protected page or action. Redirects if signed out or missing the role. */
export async function requireViewer(roles?: Role[]) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (roles && !roles.some((r) => hasRole(viewer.profile, r))) redirect("/app");
  return viewer;
}

export type AdminStatus = {
  has_role: boolean;
  /** Admin email account + authenticator app in the last 12 hours: what the database calls is_admin(). */
  verified: boolean;
  aal: string | null;
  has_pin: boolean;
  locked_until: string | null;
  unlocked_until: string | null;
};

/** Where this session stands on the admin factors (email code at sign-in, authenticator app). */
export const getAdminStatus = cache(async (): Promise<AdminStatus | null> => {
  const viewer = await getViewer();
  if (!viewer) return null;
  const { data, error } = await viewer.supabase.rpc("admin_status");
  if (error) {
    // roles.sql not run yet: the database still only checks the admin role.
    return ["PGRST202", "42883"].includes(error.code ?? "")
      ? { has_role: hasRole(viewer.profile, "admin"), verified: hasRole(viewer.profile, "admin"), aal: null, has_pin: false, locked_until: null, unlocked_until: null }
      : null;
  }
  return data as AdminStatus;
});

/**
 * Pages belong to one side: opening one from another side goes back to the current side's home.
 * The admin side also needs the authenticator app (asked again every 12 hours).
 */
export async function requireSide(...allowed: Side[]) {
  const viewer = await requireViewer();
  const side = await getSide();
  if (!allowed.includes(side)) redirect("/app");
  if (side === "admin" && !(await getAdminStatus())?.verified) redirect("/app/admin/verify");
  return { ...viewer, side };
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
