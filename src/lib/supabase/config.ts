export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until you add the Supabase keys to .env.local — lets the marketing site run without a backend. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
