import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./config";

/** Cookie-less client for public, cacheable reads (no user session). */
export function createPublicClient() {
  if (!isSupabaseConfigured) return null;
  return createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
}

export type PublicMachine = {
  code: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function getPublicMachines(): Promise<PublicMachine[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("public_machines");
  if (error) {
    console.error("[locations]", error.message);
    return [];
  }
  return (data ?? []) as PublicMachine[];
}
